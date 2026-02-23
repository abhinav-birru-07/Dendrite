import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

import {
  initDb, listConversations, getConversationTree, addNode,
  createConversation, getContextPath, getNodeChildren, getRootNode,
  updateConversationName, updateNodeBranchLabel, deleteConversation, getConversation
} from './db.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const app = express();
app.use(cors());
app.use(express.json());

await initDb();

async function getLLMResponse(userMessage, contextPath) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const history = contextPath
    .filter(msg => msg.role !== 'system')
    .map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }));
  const chat = model.startChat({ history, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } });
  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

async function generateTitle(contextPath) {
  try {
    const contextText = contextPath
      .filter(m => m.role !== 'system')
      .slice(0, 4) // look at up to first 4 messages
      .map(m => `${m.role}: ${m.content.substring(0, 150)}`)
      .join('\n');

    if (!contextText.trim()) return null;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(
      `Based on the following start of a conversation, generate a short chat title (2-4 words, no quotes, no punctuation). 
CRITICAL RULE: If the conversation is just a generic greeting ("hi", "hello", "how are you", "what's up") OR lacks any specific concrete topic (e.g. "I have a question", "help me"), you MUST reply EXACTLY with the word SKIP and nothing else.

Examples of SKIP:
User: hi -> SKIP
User: hello, can you help me? -> SKIP
Assistant: How can I help? -> SKIP

Examples of Titles:
User: Can you explain black holes? -> Black Holes Explained
User: Write a python script for sorting -> Python Sorting Script

Conversation:
${contextText}
Title:`
    );
    const title = result.response.text().trim().replace(/^["'`]|["'`]$/g, '');
    return title === 'SKIP' ? null : title;
  } catch {
    return null;
  }
}

// GET: List all conversations
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await listConversations();
    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Delete conversation
app.delete('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    await deleteConversation(conversationId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Create new conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const conversationId = uuidv4();
    const rootNodeId = uuidv4();
    await addNode({
      id: rootNodeId, conversationId, parentId: null,
      message: 'Conversation started', response: '', role: 'system', timestamp: Date.now()
    });
    await createConversation(conversationId, rootNodeId);
    res.json({ conversationId, rootNodeId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Get conversation tree
app.get('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const tree = await getConversationTree(conversationId);
    const rootNode = await getRootNode(conversationId);
    res.json({ conversationId, rootNodeId: rootNode?.id, nodes: tree });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Rename conversation
app.patch('/api/conversations/:conversationId/name', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { name } = req.body;
    await updateConversationName(conversationId, name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Rename branch label
app.patch('/api/conversations/:conversationId/nodes/:nodeId/branch-label', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { branchLabel } = req.body;
    await updateNodeBranchLabel(nodeId, branchLabel);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Send message
app.post('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message, parentNodeId, branchLabel } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const contextPath = await getContextPath(conversationId, parentNodeId);
    const response = await getLLMResponse(message, contextPath);

    const userNodeId = uuidv4();
    await addNode({
      id: userNodeId, conversationId, parentId: parentNodeId || null,
      message, response: '', role: 'user', timestamp: Date.now(), branchLabel: branchLabel || null
    });

    const assistantNodeId = uuidv4();
    await addNode({
      id: assistantNodeId, conversationId, parentId: userNodeId,
      message: '', response, role: 'assistant', timestamp: Date.now()
    });

    const tree = await getConversationTree(conversationId);

    // Append new messages to the context path for the naming prompt
    const fullContext = [...contextPath, { role: 'user', content: message }, { role: 'assistant', content: response }];

    // Auto-title if the conversation doesn't have a name yet
    let generatedName = null;
    const conversation = await getConversation(conversationId);
    if (!conversation.name) {
      generatedName = await generateTitle(fullContext);
      if (generatedName) {
        await updateConversationName(conversationId, generatedName);
      }
    }

    res.json({ userNodeId, assistantNodeId, response, tree, generatedName });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Context path
app.get('/api/conversations/:conversationId/context/:nodeId', async (req, res) => {
  try {
    const { conversationId, nodeId } = req.params;
    const contextPath = await getContextPath(conversationId, nodeId);
    res.json({ contextPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Node children
app.get('/api/conversations/:conversationId/nodes/:nodeId/children', async (req, res) => {
  try {
    const { conversationId, nodeId } = req.params;
    const children = await getNodeChildren(conversationId, nodeId);
    res.json({ children });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;

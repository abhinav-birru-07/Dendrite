import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();

import {
  initDb,
  getConversationTree,
  addNode,
  createConversation,
  getContextPath,
  getNodeChildren,
  getRootNode
} from './db.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database
await initDb();

// Get LLM response from Google Gemini
async function getLLMResponse(userMessage, contextPath) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  // Build conversation history for Gemini
  const history = contextPath
    .filter(msg => msg.role !== 'system')
    .map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

  const chat = model.startChat({
    history: history,
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.7
    }
  });

  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

// POST: Send message and create/append node
app.post('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message, parentNodeId, branchLabel } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Get context path up to parent node
    const contextPath = await getContextPath(conversationId, parentNodeId);

    // Generate LLM response
    const response = await getLLMResponse(message, contextPath);

    // Create new user message node
    const userNodeId = uuidv4();
    await addNode({
      id: userNodeId,
      conversationId,
      parentId: parentNodeId || null,
      message,
      response: '',
      role: 'user',
      timestamp: Date.now(),
      branchLabel: branchLabel || null
    });

    // Create assistant response node
    const assistantNodeId = uuidv4();
    await addNode({
      id: assistantNodeId,
      conversationId,
      parentId: userNodeId,
      message: '',
      response,
      role: 'assistant',
      timestamp: Date.now()
    });

    // Get updated tree
    const tree = await getConversationTree(conversationId);

    res.json({
      userNodeId,
      assistantNodeId,
      response,
      tree
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Create new conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const conversationId = uuidv4();
    const rootNodeId = uuidv4();

    // Create root node
    await addNode({
      id: rootNodeId,
      conversationId,
      parentId: null,
      message: 'Conversation started',
      response: '',
      role: 'system',
      timestamp: Date.now()
    });

    // Create conversation
    await createConversation(conversationId, rootNodeId);

    res.json({
      conversationId,
      rootNodeId
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Get conversation tree
app.get('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const tree = await getConversationTree(conversationId);
    const rootNode = await getRootNode(conversationId);

    res.json({
      conversationId,
      rootNodeId: rootNode?.id,
      nodes: tree
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Get context path for a node
app.get('/api/conversations/:conversationId/context/:nodeId', async (req, res) => {
  try {
    const { conversationId, nodeId } = req.params;
    const contextPath = await getContextPath(conversationId, nodeId);

    res.json({ contextPath });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Get children of a node
app.get('/api/conversations/:conversationId/nodes/:nodeId/children', async (req, res) => {
  try {
    const { conversationId, nodeId } = req.params;
    const children = await getNodeChildren(conversationId, nodeId);

    res.json({ children });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

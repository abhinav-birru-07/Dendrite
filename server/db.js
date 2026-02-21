import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'conversations.db');

const db = new sqlite3.Database(dbPath);

// Promisify db methods for easier async/await
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Initialize schema
export async function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          rootNodeId TEXT NOT NULL,
          createdAt INTEGER NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS nodes (
          id TEXT PRIMARY KEY,
          conversationId TEXT NOT NULL,
          parentId TEXT,
          message TEXT NOT NULL,
          response TEXT NOT NULL,
          role TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          branchLabel TEXT,
          tokenCount INTEGER DEFAULT 0,
          model TEXT DEFAULT 'gpt-3.5-turbo',
          FOREIGN KEY (conversationId) REFERENCES conversations(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Get all nodes for a conversation
export async function getConversationTree(conversationId) {
  const nodes = await dbAll(
    'SELECT * FROM nodes WHERE conversationId = ?',
    [conversationId]
  );
  
  const tree = {};
  nodes.forEach(node => {
    tree[node.id] = node;
  });
  
  return tree;
}

// Get root node
export async function getRootNode(conversationId) {
  const conv = await dbGet(
    'SELECT rootNodeId FROM conversations WHERE id = ?',
    [conversationId]
  );
  
  if (!conv) return null;
  
  return dbGet('SELECT * FROM nodes WHERE id = ?', [conv.rootNodeId]);
}

// Add node
export async function addNode(nodeData) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO nodes (
        id, conversationId, parentId, message, response, role, 
        timestamp, branchLabel, tokenCount, model
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeData.id,
        nodeData.conversationId,
        nodeData.parentId || null,
        nodeData.message,
        nodeData.response,
        nodeData.role,
        nodeData.timestamp,
        nodeData.branchLabel || null,
        nodeData.tokenCount || 0,
        nodeData.model || 'gpt-3.5-turbo'
      ],
      function(err) {
        if (err) reject(err);
        else resolve({ id: nodeData.id });
      }
    );
  });
}

// Create conversation
export async function createConversation(conversationId, rootNodeId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO conversations (id, rootNodeId, createdAt) VALUES (?, ?, ?)',
      [conversationId, rootNodeId, Date.now()],
      (err) => {
        if (err) reject(err);
        else resolve({ id: conversationId });
      }
    );
  });
}

// Get context path (all nodes from root to current)
export async function getContextPath(conversationId, currentNodeId) {
  const tree = await getConversationTree(conversationId);
  
  if (!tree[currentNodeId]) return [];

  // Build path from current node back to root
  const path = [];
  let currentId = currentNodeId;
  
  while (currentId) {
    const node = tree[currentId];
    if (!node) break;
    
    path.unshift({
      id: node.id,
      role: node.role,
      content: node.role === 'user' ? node.message : node.response,
      timestamp: node.timestamp,
      branchLabel: node.branchLabel
    });
    
    currentId = node.parentId;
  }
  
  return path;
}

// Get children of a node
export async function getNodeChildren(conversationId, nodeId) {
  return dbAll(
    'SELECT * FROM nodes WHERE conversationId = ? AND parentId = ?',
    [conversationId, nodeId]
  );
}

export default db;

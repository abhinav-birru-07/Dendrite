import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbName = process.env.NODE_ENV === 'test' ? 'test.db' : 'conversations.db';
const dbPath = path.join(__dirname, dbName);
const db = new sqlite3.Database(dbPath);

const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

export async function initDb() {
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          rootNodeId TEXT NOT NULL,
          name TEXT,
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
          model TEXT DEFAULT 'gemini',
          FOREIGN KEY (conversationId) REFERENCES conversations(id)
        )
      `, err => { if (err) reject(err); else resolve(); });
    });
  });
  // Migration: add name column if it doesn't exist yet
  await dbRun('ALTER TABLE conversations ADD COLUMN name TEXT').catch(() => { });
}

export async function listConversations() {
  return dbAll('SELECT * FROM conversations ORDER BY createdAt DESC');
}

export async function getConversationTree(conversationId) {
  const nodes = await dbAll('SELECT * FROM nodes WHERE conversationId = ?', [conversationId]);
  const tree = {};
  nodes.forEach(node => { tree[node.id] = node; });
  return tree;
}

export async function getConversation(conversationId) {
  return dbGet('SELECT * FROM conversations WHERE id = ?', [conversationId]);
}

export async function getRootNode(conversationId) {
  const conv = await dbGet('SELECT rootNodeId FROM conversations WHERE id = ?', [conversationId]);
  if (!conv) return null;
  return dbGet('SELECT * FROM nodes WHERE id = ?', [conv.rootNodeId]);
}

export async function addNode(nodeData) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO nodes (id, conversationId, parentId, message, response, role, timestamp, branchLabel, tokenCount, model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nodeData.id, nodeData.conversationId, nodeData.parentId || null,
      nodeData.message, nodeData.response, nodeData.role, nodeData.timestamp,
      nodeData.branchLabel || null, nodeData.tokenCount || 0, nodeData.model || 'gemini'],
      function (err) { if (err) reject(err); else resolve({ id: nodeData.id }); }
    );
  });
}

export async function createConversation(conversationId, rootNodeId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO conversations (id, rootNodeId, createdAt) VALUES (?, ?, ?)',
      [conversationId, rootNodeId, Date.now()],
      err => { if (err) reject(err); else resolve({ id: conversationId }); }
    );
  });
}

export async function updateConversationName(conversationId, name) {
  return dbRun('UPDATE conversations SET name = ? WHERE id = ?', [name, conversationId]);
}

export async function updateNodeBranchLabel(nodeId, branchLabel) {
  return dbRun('UPDATE nodes SET branchLabel = ? WHERE id = ?', [branchLabel, nodeId]);
}

export async function deleteConversation(conversationId) {
  await dbRun('DELETE FROM nodes WHERE conversationId = ?', [conversationId]);
  await dbRun('DELETE FROM conversations WHERE id = ?', [conversationId]);
}

export async function getContextPath(conversationId, currentNodeId) {
  const tree = await getConversationTree(conversationId);
  if (!tree[currentNodeId]) return [];
  const result = [];
  let currentId = currentNodeId;
  while (currentId) {
    const node = tree[currentId];
    if (!node) break;
    result.unshift({
      id: node.id, role: node.role,
      content: node.role === 'user' ? node.message : node.response,
      timestamp: node.timestamp, branchLabel: node.branchLabel
    });
    currentId = node.parentId;
  }
  return result;
}

export async function getNodeChildren(conversationId, nodeId) {
  return dbAll('SELECT * FROM nodes WHERE conversationId = ? AND parentId = ?', [conversationId, nodeId]);
}

export default db;

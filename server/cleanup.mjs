// cleanup.mjs - deletes conversations with no real messages (only system root node)
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new sqlite3.Database(path.join(__dirname, 'conversations.db'));

db.serialize(() => {
    db.run(`
    DELETE FROM conversations WHERE id NOT IN (
      SELECT DISTINCT conversationId FROM nodes WHERE role != 'system'
    )
  `, function () { console.log(`Deleted ${this.changes} empty conversations`); });

    db.run(`
    DELETE FROM nodes WHERE conversationId NOT IN (SELECT id FROM conversations)
  `, function () { console.log(`Deleted ${this.changes} orphaned nodes`); db.close(); });
});

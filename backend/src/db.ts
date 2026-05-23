import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../database.sqlite');
const db: SqliteDatabase = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sessionId TEXT PRIMARY KEY,
    tokensUsed INTEGER DEFAULT 0,
    tokensSaved INTEGER DEFAULT 0,
    lastReset INTEGER
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId TEXT,
    prompt TEXT,
    compressed TEXT,
    originalTokens INTEGER,
    optimizedTokens INTEGER,
    costSaved REAL,
    timestamp INTEGER,
    method TEXT
  );

  CREATE TABLE IF NOT EXISTS pricing (
    platform TEXT PRIMARY KEY,
    pricePerMillion REAL
  );

  INSERT OR IGNORE INTO pricing (platform, pricePerMillion) VALUES ('chatgpt', 5.00);
  INSERT OR IGNORE INTO pricing (platform, pricePerMillion) VALUES ('claude', 3.00);
  INSERT OR IGNORE INTO pricing (platform, pricePerMillion) VALUES ('gemini', 1.25);
  INSERT OR IGNORE INTO pricing (platform, pricePerMillion) VALUES ('default', 1.00);
`);

export default db;

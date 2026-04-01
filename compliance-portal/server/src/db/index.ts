import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { seedWcagData } from './seed-wcag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../../data/compliance.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema eagerly so prepared statements in queries.ts can be created at import time
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Auto-seed WCAG reference data if the tables are empty
const wcagCount = db.prepare('SELECT COUNT(*) as cnt FROM wcag_criteria').get() as { cnt: number };
if (wcagCount.cnt === 0) {
  seedWcagData(db);
}

export function initializeDatabase(): void {
  // Schema is applied eagerly above; this function is kept as an explicit
  // lifecycle hook that callers (e.g. server startup) can invoke for clarity.
  console.log('Database initialized successfully');
}

export default db;

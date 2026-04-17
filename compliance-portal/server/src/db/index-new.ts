import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { seedWcagData } from './seed-wcag.js';
import PostgresDatabase from './postgres.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment configuration
// Detect Azure App Service environment
const IS_AZURE = process.env.WEBSITE_INSTANCE_ID || process.env.WEBSITE_SITE_NAME;
const USE_POSTGRES = process.env.PGHOST || process.env.DATABASE_URL;
const DB_TYPE = USE_POSTGRES ? 'postgres' : 'sqlite';

console.log(`Environment: ${IS_AZURE ? 'Azure App Service' : 'Local'}`);
console.log(`Using database: ${DB_TYPE}`);

let db: SqliteDatabase | PostgresDatabase;

if (DB_TYPE === 'postgres') {
  // PostgreSQL configuration from environment variables
  const dbConfig = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'compliancedb',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSLMODE === 'require',
    useAzureAuth: process.env.AZURE_POSTGRESQL_PASSWORDLESS === 'true',
  };
  
  db = new PostgresDatabase(dbConfig) as any;
} else {
  // SQLite configuration (for local development)
  const DB_PATH = path.join(__dirname, '../../../data/compliance.db');
  const dataDir = path.dirname(DB_PATH);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  db = new Database(DB_PATH) as any;
  
  // Enable WAL mode for better concurrent read performance (SQLite only)
  (db as SqliteDatabase).pragma('journal_mode = WAL');
  (db as SqliteDatabase).pragma('foreign_keys = ON');
}

export async function initializeDatabase(): Promise<void> {
  try {
    console.log('Initializing database...');
    
    if (DB_TYPE === 'postgres') {
      const pgDb = db as PostgresDatabase;
      
      // Test connection first
      try {
        await pgDb.query('SELECT 1');
        console.log('PostgreSQL connection successful');
      } catch (connErr) {
        console.error('PostgreSQL connection failed:', connErr);
        throw new Error(`Failed to connect to PostgreSQL: ${connErr instanceof Error ? connErr.message : String(connErr)}`);
      }
      
      // Execute schema
      const schema = fs.readFileSync(path.join(__dirname, 'schema-postgres.sql'), 'utf-8');
      const statements = schema.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pgDb.execute(statement);
          } catch (err) {
            // Ignore errors for statements that already exist (like tables, indexes)
            if (err instanceof Error && !err.message.includes('already exists')) {
              console.warn('Schema statement warning:', err.message);
            }
          }
        }
      }
      
      // Check if WCAG data needs to be seeded
      const result = await pgDb.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM wcag_criteria');
      if (result && parseInt(result.count) === 0) {
        console.log('Seeding WCAG data...');
        await seedWcagDataPostgres(pgDb);
      }
    } else {
      // SQLite schema
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
      (db as SqliteDatabase).exec(schema);
      
      // Auto-seed WCAG reference data if the tables are empty
      const wcagCount = (db as SqliteDatabase).prepare('SELECT COUNT(*) as cnt FROM wcag_criteria').get() as { cnt: number };
      if (wcagCount.cnt === 0) {
        console.log('Seeding WCAG data...');
        seedWcagData(db as SqliteDatabase);
      }
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

async function seedWcagDataPostgres(pgDb: PostgresDatabase): Promise<void> {
  console.log('Seeding WCAG data for PostgreSQL...');
  // This would use the same seed data but with async queries
  // For now, implementing basic seeding - you can enhance this
  const principles = [
    { id: '1', name: 'Perceivable', description: 'Information and user interface components must be presentable to users in ways they can perceive.' },
    { id: '2', name: 'Operable', description: 'User interface components and navigation must be operable.' },
    { id: '3', name: 'Understandable', description: 'Information and the operation of user interface must be understandable.' },
    { id: '4', name: 'Robust', description: 'Content must be robust enough that it can be interpreted by a wide variety of user agents.' },
  ];
  
  for (const p of principles) {
    await pgDb.execute(
      'INSERT INTO wcag_principles (id, name, description) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [p.id, p.name, p.description]
    );
  }
  
  console.log('WCAG data seeded successfully');
}

export { DB_TYPE };
export default db;

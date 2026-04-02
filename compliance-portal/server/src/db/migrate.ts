import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../../data/compliance.db');

/**
 * Simple migration runner for the compliance portal database.
 * Applies SQL migration files from the migrations directory.
 */
function runMigrations() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('Database does not exist yet. Migrations will be applied when database is initialized.');
    return;
  }

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found.');
    db.close();
    return;
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('No migration files found.');
    db.close();
    return;
  }

  console.log(`Found ${migrationFiles.length} migration file(s)`);

  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log(`Applying migration: ${file}`);
    
    try {
      db.exec(sql);
      console.log(`✓ ${file} applied successfully`);
    } catch (err) {
      // Check if error is about duplicate column (already applied)
      const errorMsg = (err as Error).message;
      if (errorMsg.includes('duplicate column')) {
        console.log(`⊘ ${file} already applied (skipped)`);
      } else {
        console.error(`✗ ${file} failed:`, errorMsg);
        throw err;
      }
    }
  }

  db.close();
  console.log('All migrations completed.');
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };

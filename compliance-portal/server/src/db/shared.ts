/**
 * Shared database instance singleton
 * Prevents multiple connection pools from being created across different modules
 */
import PostgresDatabase from './postgres.js';

// Detect PostgreSQL primary mode
const USE_POSTGRES_PRIMARY = Boolean(process.env.PGHOST || process.env.DATABASE_URL);

// Create a single shared PostgreSQL instance
export const sharedPgDb = USE_POSTGRES_PRIMARY
  ? new PostgresDatabase({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'compliancedb',
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSLMODE === 'require',
      useAzureAuth: process.env.AZURE_POSTGRESQL_PASSWORDLESS === 'true',
    })
  : null;

export const USE_POSTGRES = USE_POSTGRES_PRIMARY;

// Log the database configuration on startup
if (sharedPgDb) {
  console.log('[DB] Using shared PostgreSQL connection pool');
} else {
  console.log('[DB] Using SQLite (no shared PostgreSQL instance)');
}

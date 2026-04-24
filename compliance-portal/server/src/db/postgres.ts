import pg from 'pg';
import { DefaultAzureCredential } from '@azure/identity';

const { Pool } = pg;

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  useAzureAuth?: boolean;
}

class PostgresDatabase {
  private pool: pg.Pool | null = null;
  private config: DatabaseConfig;
  private useAzureAuth: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.useAzureAuth = config.useAzureAuth || false;
  }

  async getPool(): Promise<pg.Pool> {
    if (this.pool) {
      return this.pool;
    }

    const poolConfig: pg.PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      ssl: this.config.ssl ? {
        rejectUnauthorized: false,
        // Azure PostgreSQL requires SSL
        requestCert: true,
      } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased from 2s to 10s for Azure
    };

    if (this.useAzureAuth) {
      // Use Azure Managed Identity for passwordless authentication
      const credential = new DefaultAzureCredential();
      const token = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
      
      poolConfig.user = this.config.user;
      poolConfig.password = token.token;
      
      // Refresh token before it expires (tokens expire after 5-60 minutes)
      setInterval( async () => {
        try {
          const newToken = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
          // Recreate pool with new token
          await this.pool?.end();
          poolConfig.password = newToken.token;
          this.pool = new Pool(poolConfig);
        } catch (err) {
          console.error('Failed to refresh Azure AD token:', err);
        }
      }, 45 * 60 * 1000); // Refresh every 45 minutes
    } else {
      poolConfig.user = this.config.user;
      poolConfig.password = this.config.password;
    }

    this.pool = new Pool(poolConfig);
    
    // Test connection with detailed logging
    try {
      console.log(`Attempting PostgreSQL connection to ${this.config.host}:${this.config.port}/${this.config.database}`);
      console.log(`SSL Mode: ${this.config.ssl ? 'required' : 'disabled'}`);
      console.log(`Auth Method: ${this.useAzureAuth ? 'Azure AD' : 'password'}`);
      
      const client = await this.pool.connect();
      console.log('[OK] PostgreSQL connected successfully');
      
      // Test a simple query
      const result = await client.query('SELECT version()');
      console.log('PostgreSQL version:', result.rows[0]?.version?.substring(0, 50));
      
      client.release();
    } catch (err) {
      console.error('[ERROR] PostgreSQL connection error:', {
        message: err instanceof Error ? err.message : String(err),
        code: (err as any)?.code,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        ssl: this.config.ssl,
      });
      throw err;
    }

    return this.pool;
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const pool = await this.getPool();
    const result = await pool.query(text, params);
    return result.rows;
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(text: string, params?: any[]): Promise<void> {
    const pool = await this.getPool();
    await pool.query(text, params);
  }

  async transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const pool = await this.getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

export default PostgresDatabase;

/**
 * Data migration from SQLite to PostgreSQL
 * Run this script to copy all existing data from local SQLite to Azure PostgreSQL
 * 
 * Usage:
 *   npx ts-node src/db/migrate-to-postgres.ts
 * 
 * Prerequisites:
 *   - PGHOST, PGUSER, PGPASSWORD, PGDATABASE env vars must be set
 *   - PostgreSQL schemas already initialized (via server startup)
 *   - SQLite database at data/compliance.db must exist
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import PostgresDatabase from './postgres.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqliteDbPath = path.resolve(__dirname, '../../data/compliance.db');

// Initialize connections
const sqlite = new Database(sqliteDbPath);
const pgDb = new PostgresDatabase({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'compliancedb',
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSLMODE === 'require',
  useAzureAuth: process.env.AZURE_POSTGRESQL_PASSWORDLESS === 'true',
});

async function migrate() {
  console.log('🚀 Starting data migration from SQLite to PostgreSQL...\n');

  try {
    // 1. Migrate campaigns
    console.log('📋 Migrating campaigns...');
    const campaigns = sqlite.prepare('SELECT * FROM campaigns').all() as any[];
    for (const campaign of campaigns) {
      await pgDb.execute(
        `INSERT INTO campaigns (id, name, compliance_level, categories, scan_depth, max_pages_to_scan, site_concurrency, page_concurrency, schedule_cron, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          campaign.id,
          campaign.name,
          campaign.compliance_level,
          campaign.categories,
          campaign.scan_depth,
          campaign.max_pages_to_scan,
          campaign.site_concurrency,
          campaign.page_concurrency,
          campaign.schedule_cron,
          campaign.status,
          campaign.created_at,
          campaign.updated_at,
        ]
      );
    }
    console.log(`  ✓ Migrated ${campaigns.length} campaigns\n`);

    // 2. Migrate campaign sites
    console.log('🌐 Migrating campaign sites...');
    const sites = sqlite.prepare('SELECT * FROM campaign_sites').all() as any[];
    for (const site of sites) {
      await pgDb.execute(
        `INSERT INTO campaign_sites (id, campaign_id, url, label)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [site.id, site.campaign_id, site.url, site.label]
      );
    }
    console.log(`  ✓ Migrated ${sites.length} campaign sites\n`);

    // 3. Migrate scans
    console.log('📊 Migrating scans...');
    const scans = sqlite.prepare('SELECT * FROM scans').all() as any[];
    for (const scan of scans) {
      await pgDb.execute(
        `INSERT INTO scans (id, campaign_id, status, started_at, completed_at, summary)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          scan.id,
          scan.campaign_id,
          scan.status,
          scan.started_at,
          scan.completed_at,
          scan.summary,
        ]
      );
    }
    console.log(`  ✓ Migrated ${scans.length} scans\n`);

    // 4. Migrate scan results
    console.log('📈 Migrating scan results...');
    const results = sqlite.prepare('SELECT * FROM scan_results').all() as any[];
    for (const result of results) {
      await pgDb.execute(
        `INSERT INTO scan_results (id, scan_id, page_url, status_code, elapsed_ms, axe_scan_time, axe_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          result.id,
          result.scan_id,
          result.page_url,
          result.status_code,
          result.elapsed_ms,
          result.axe_scan_time,
          result.axe_version,
        ]
      );
    }
    console.log(`  ✓ Migrated ${results.length} scan results\n`);

    // 5. Migrate scan issues
    console.log('🐛 Migrating scan issues...');
    const issues = sqlite.prepare('SELECT * FROM scan_issues').all() as any[];
    for (const issue of issues) {
      await pgDb.execute(
        `INSERT INTO scan_issues (id, scan_result_id, axe_rule_id, impact, element, html)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          issue.id,
          issue.scan_result_id,
          issue.axe_rule_id,
          issue.impact,
          issue.element,
          issue.html,
        ]
      );
    }
    console.log(`  ✓ Migrated ${issues.length} scan issues\n`);

    // 6. Migrate audit logs
    console.log('📝 Migrating audit logs...');
    const auditLogs = sqlite.prepare('SELECT * FROM scan_audit_log').all() as any[];
    for (const log of auditLogs) {
      await pgDb.execute(
        `INSERT INTO scan_audit_log (id, scan_id, category, item_count, severity, message, event_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          log.id,
          log.scan_id,
          log.category,
          log.item_count,
          log.severity,
          log.message,
          log.event_date,
        ]
      );
    }
    console.log(`  ✓ Migrated ${auditLogs.length} audit logs\n`);

    console.log('✨ Migration complete!');
    console.log(`\nSummary:`);
    console.log(`  Campaigns: ${campaigns.length}`);
    console.log(`  Campaign Sites: ${sites.length}`);
    console.log(`  Scans: ${scans.length}`);
    console.log(`  Scan Results: ${results.length}`);
    console.log(`  Scan Issues: ${issues.length}`);
    console.log(`  Audit Logs: ${auditLogs.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

migrate().catch(console.error);

-- WCAG Compliance Portal Database Schema (PostgreSQL)
-- Migration from SQLite to PostgreSQL

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  compliance_level TEXT NOT NULL CHECK(compliance_level IN ('A', 'AA', 'AAA')),
  categories TEXT NOT NULL DEFAULT '[]',
  scan_depth INTEGER NOT NULL DEFAULT 2 CHECK(scan_depth BETWEEN 1 AND 5),
  max_pages_to_scan INTEGER DEFAULT NULL,
  site_concurrency INTEGER NOT NULL DEFAULT 2 CHECK(site_concurrency BETWEEN 1 AND 5),
  page_concurrency INTEGER NOT NULL DEFAULT 3 CHECK(page_concurrency BETWEEN 1 AND 10),
  schedule_cron TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Campaign sites table
CREATE TABLE IF NOT EXISTS campaign_sites (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT ''
);

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Scan results table
CREATE TABLE IF NOT EXISTS scan_results (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES campaign_sites(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('accessibility', 'performance', 'seo')),
  score REAL DEFAULT 0,
  issues_count INTEGER DEFAULT 0,
  details TEXT DEFAULT '{}'
);

-- Scan issues table
CREATE TABLE IF NOT EXISTS scan_issues (
  id TEXT PRIMARY KEY,
  result_id TEXT NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK(severity IN ('critical', 'serious', 'moderate', 'minor')),
  wcag_criterion TEXT,
  wcag_level TEXT CHECK(wcag_level IN ('A', 'AA', 'AAA')),
  description TEXT NOT NULL,
  element TEXT,
  help_url TEXT,
  failure_summary TEXT,
  related_nodes TEXT
);

-- Indexes on foreign keys and commonly queried columns
CREATE INDEX IF NOT EXISTS idx_campaign_sites_campaign_id ON campaign_sites(campaign_id);
CREATE INDEX IF NOT EXISTS idx_scans_campaign_id ON scans(campaign_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at);
CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_site_id ON scan_results(site_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_category ON scan_results(category);
CREATE INDEX IF NOT EXISTS idx_scan_issues_result_id ON scan_issues(result_id);
CREATE INDEX IF NOT EXISTS idx_scan_issues_severity ON scan_issues(severity);

-- ---------------------------------------------------------------------------
-- WCAG 2.1 Reference Data
-- ---------------------------------------------------------------------------

-- WCAG Principles table
CREATE TABLE IF NOT EXISTS wcag_principles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

-- WCAG Guidelines table
CREATE TABLE IF NOT EXISTS wcag_guidelines (
  id TEXT PRIMARY KEY,
  principle_id TEXT NOT NULL REFERENCES wcag_principles(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

-- WCAG Criteria table
CREATE TABLE IF NOT EXISTS wcag_criteria (
  id TEXT PRIMARY KEY,
  guideline_id TEXT NOT NULL REFERENCES wcag_guidelines(id),
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('A', 'AA', 'AAA')),
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'accessibility',
  help_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- WCAG Axe Rules mapping table
CREATE TABLE IF NOT EXISTS wcag_axe_rules (
  id SERIAL PRIMARY KEY,
  criterion_id TEXT NOT NULL REFERENCES wcag_criteria(id) ON DELETE CASCADE,
  axe_rule_id TEXT NOT NULL,
  UNIQUE(criterion_id, axe_rule_id)
);

CREATE INDEX IF NOT EXISTS idx_wcag_criteria_level ON wcag_criteria(level);
CREATE INDEX IF NOT EXISTS idx_wcag_criteria_guideline ON wcag_criteria(guideline_id);
CREATE INDEX IF NOT EXISTS idx_wcag_axe_rules_criterion ON wcag_axe_rules(criterion_id);
CREATE INDEX IF NOT EXISTS idx_wcag_axe_rules_rule ON wcag_axe_rules(axe_rule_id);

-- WCAG Import log table
CREATE TABLE IF NOT EXISTS wcag_import_log (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK(source_type IN ('seed', 'pdf', 'csv', 'json', 'manual')),
  source_name TEXT,
  records_imported INTEGER DEFAULT 0,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Scan Audit Log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scan_audit_log (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('accessibility')),
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  expected INTEGER NOT NULL DEFAULT 1,
  executed INTEGER NOT NULL DEFAULT 0,
  passed INTEGER,
  error_message TEXT,
  site_id TEXT,
  page_url TEXT,
  executed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scan_audit_log_scan_id ON scan_audit_log(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_audit_log_category ON scan_audit_log(category);
CREATE INDEX IF NOT EXISTS idx_scan_audit_log_rule_id ON scan_audit_log(rule_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wcag_criteria_updated_at ON wcag_criteria;
CREATE TRIGGER update_wcag_criteria_updated_at BEFORE UPDATE ON wcag_criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

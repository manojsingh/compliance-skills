-- Migration: Add diagnostic details to scan_issues table
-- Date: 2026-04-01
-- Description: Adds failure_summary and related_nodes columns to provide more context for issues

-- Add failure_summary column (contains diagnostic info like color values for contrast issues)
ALTER TABLE scan_issues ADD COLUMN failure_summary TEXT;

-- Add related_nodes column (JSON array of related HTML elements)
ALTER TABLE scan_issues ADD COLUMN related_nodes TEXT;

-- Note: This migration is idempotent - if run multiple times, it will fail gracefully
-- after the first successful run (column already exists error).

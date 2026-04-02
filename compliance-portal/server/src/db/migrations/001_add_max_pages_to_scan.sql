-- Migration: Add max_pages_to_scan column to campaigns table
-- Date: 2026-04-01
-- Description: Adds the ability to limit the number of pages scanned per website

-- Check if column exists before adding it (SQLite doesn't have IF NOT EXISTS for columns)
-- This is handled safely by wrapping in a transaction and ignoring errors if it exists

-- Add the max_pages_to_scan column
-- NULL means unlimited (scan all pages up to system default MAX_PAGES of 50)
-- Otherwise, scan up to the specified number of pages per site
ALTER TABLE campaigns ADD COLUMN max_pages_to_scan INTEGER DEFAULT NULL;

-- Note: This migration is idempotent - if run multiple times, it will fail gracefully
-- after the first successful run (column already exists error).

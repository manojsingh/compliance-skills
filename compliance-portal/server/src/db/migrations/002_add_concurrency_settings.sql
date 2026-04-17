-- Migration: Add site_concurrency and page_concurrency columns to campaigns table
-- Date: 2026-04-01
-- Description: Adds configurable concurrency settings for controlling scan performance

-- Add the site_concurrency column (how many sites to scan in parallel)
-- Default: 2, Range: 1-5
ALTER TABLE campaigns ADD COLUMN site_concurrency INTEGER NOT NULL DEFAULT 2 CHECK(site_concurrency BETWEEN 1 AND 5);

-- Add the page_concurrency column (how many pages per site to scan in parallel)
-- Default: 3, Range: 1-10
ALTER TABLE campaigns ADD COLUMN page_concurrency INTEGER NOT NULL DEFAULT 3 CHECK(page_concurrency BETWEEN 1 AND 10);

-- Note: This migration is idempotent - if run multiple times, it will fail gracefully
-- after the first successful run (column already exists error).

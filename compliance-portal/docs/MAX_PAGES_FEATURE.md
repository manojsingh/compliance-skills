# Maximum Pages to Scan Feature

## Overview
This feature allows you to limit the number of pages scanned per website in a campaign. This is useful for large websites where you want to control scan duration and resource usage.

## How It Works

### Difference from Scan Depth
- **Scan Depth**: Controls how many levels deep the crawler will navigate from the starting URL (e.g., depth 2 = homepage + directly linked pages)
- **Max Pages to Scan**: Limits the total number of pages that will be scanned per website, regardless of depth

Both settings work together to control the scan scope:
- If max pages is set to 20 and scan depth is 3, the scanner will stop at 20 pages even if there are more pages within depth 3
- If max pages is unlimited (null), the scanner will crawl up to the system limit (50 pages) respecting the depth setting

### Default Behavior
- **New Campaigns**: By default, max pages is set to `null` (unlimited), meaning all discoverable pages up to the system limit of 50 pages will be scanned
- **Existing Campaigns**: After migration, existing campaigns will have max pages set to `null` (unlimited) to maintain backward compatibility

### UI
The campaign configuration page includes a new "Page Limit" section where you can:
1. Check "Scan all pages" to scan without page limits (default)
2. Uncheck the box and enter a specific number to limit pages per site

## Technical Implementation

### Database Changes
- Added `max_pages_to_scan` column to the `campaigns` table
- Type: `INTEGER`, nullable (NULL = unlimited)
- Default: `NULL`

### Backend Changes
1. **Validation**: Updated validation middleware to accept and validate `maxPagesToScan` (positive integer or null)
2. **Queries**: Updated campaign create/update queries to handle the new field
3. **Scanner**: Modified crawler to respect the page limit
4. **Scheduler**: Updated scheduled scans to pass the max pages setting

### Frontend Changes
1. **Types**: Added `maxPagesToScan` to Campaign interface
2. **Component**: Created `MaxPagesInput` component for user input
3. **Form**: Updated campaign configuration page to include the new setting

## Migration

For existing databases, run the migration:

```bash
cd server
npm run migrate
```

Or manually apply:
```sql
ALTER TABLE campaigns ADD COLUMN max_pages_to_scan INTEGER DEFAULT NULL;
```

## Examples

### Example 1: Scan exactly 10 pages per site
- Scan Depth: 5
- Max Pages: 10
- Result: Will scan up to 10 pages, stopping even if depth 5 hasn't been fully explored

### Example 2: Scan all pages within depth 2
- Scan Depth: 2  
- Max Pages: Unlimited (null)
- Result: Will scan homepage + all directly linked pages (up to system limit of 50)

### Example 3: Quick sample scan
- Scan Depth: 1
- Max Pages: 5
- Result: Will scan the homepage and up to 4 additional pages from depth 1

## API Usage

### Create Campaign
```json
{
  "name": "My Campaign",
  "complianceLevel": "AA",
  "categories": ["accessibility"],
  "scanDepth": 2,
  "maxPagesToScan": 25,
  "sites": [
    {"url": "https://example.com", "label": "Example Site"}
  ]
}
```

### Update Campaign
```json
{
  "maxPagesToScan": 50
}
```

Set to `null` for unlimited:
```json
{
  "maxPagesToScan": null
}
```

## Notes
- The crawler always enforces the system maximum of 50 pages to prevent resource exhaustion
- Setting max pages to a very large number (e.g., 10000) is equivalent to unlimited
- The page limit is per site, not per campaign (each site in the campaign can scan up to the limit)

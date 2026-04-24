# Scan Status Issue - Fix Summary

## Problem
Scans were showing as "completed" in logs but the dashboard continued displaying them as "scanning". This indicated that status updates were failing silently.

## Root Cause
Multiple PostgreSQL connection pools were being created across different modules:
- Routes (campaigns, scans, dashboard, reports, wcag)
- Services (scanner, scheduler)
- Each module was creating its own `PostgresDatabase` instance

This caused:
1. Connection pool fragmentation
2. Potential race conditions
3. Silent failures in database updates
4. Status updates not persisting properly

## Solution Implemented

### 1. Created Shared Database Singleton (`server/src/db/shared.ts`)
- Single PostgreSQL connection pool shared across all modules
- Prevents connection pool fragmentation
- Better resource management

### 2. Added Detailed Error Logging
Enhanced logging in:
- `setScanStatus()` function - logs every status update attempt
- `updateScanStatusPostgres()` - logs database operations and errors
- Added `RETURNING id` clause to verify updates succeed

### 3. Updated All Modules to Use Shared Instance
Files updated to use `sharedPgDb`:
- `server/src/services/scanner/index.ts`
- `server/src/routes/campaigns.ts`
- `server/src/routes/scans.ts`
- `server/src/routes/dashboard.ts`
- `server/src/routes/reports.ts`
- `server/src/routes/wcag.ts`
- `server/src/services/scheduler/index.ts`

## Testing Instructions

### 1. Rebuild and Deploy
```bash
cd compliance-portal/server
npm run build
```

### 2. Monitor Logs During Scan
Watch for these new log messages:
```
[setScanStatus] Updating scan <scanId> to status: running
[setScanStatus] SUCCESS - Scan <scanId> updated to running (DB confirmed status: running)
[updateScanStatusPostgres] Updated scan <scanId> - affected 1 row(s)
[setScanStatus] Updating scan <scanId> to status: completed
[setScanStatus] SUCCESS - Scan <scanId> updated to completed (DB confirmed status: completed)
```

### 3. Check for Errors
If you see these, there's still an issue:
```
[setScanStatus] FAILED to update scan <scanId> to <status>:
[setScanStatus] WARNING - updateScanStatusPostgres returned null
[updateScanStatusPostgres] No scan found with id: <scanId>
[updateScanStatusPostgres] Database error updating scan <scanId>:
```

### 4. Verify Dashboard Updates
1. Start a scan
2. Wait for logs to show "Scan <id> completed"
3. Check dashboard immediately - status should be "completed"
4. Refresh page - status should remain "completed"

## Additional Improvements

### Startup Recovery (Already Implemented)
The `recoverInterruptedScans()` function marks any pending/running scans as failed on startup. This prevents orphaned scans from appearing stuck.

### Connection Pool Benefits
- **Before**: Multiple pools × multiple modules = resource waste
- **After**: Single shared pool = efficient connection reuse
- **Result**: Better performance and reliability

## Debugging Tips

If issues persist after this fix:

1. **Check connection pool status**:
   ```sql
   SELECT * FROM pg_stat_activity WHERE datname = 'compliancedb';
   ```

2. **Verify scan status directly in DB**:
   ```sql
   SELECT id, status, started_at, completed_at 
   FROM scans 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. **Check for connection errors**:
   - Review Azure PostgreSQL firewall rules
   - Verify current IP against allowed IPs (see user memory note)
   - Check for connection timeout errors

4. **Monitor connection count**:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'compliancedb';
   ```
   Should be reasonable (< 20 concurrent connections)

## Related User Memory Note
> Azure PostgreSQL timeout with correct credentials often indicates firewall IP mismatch; compare current egress IP (ifconfig.me) against flexible-server firewall rules and retest tcp/5432.

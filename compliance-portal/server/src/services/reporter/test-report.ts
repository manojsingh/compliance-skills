/**
 * Test script for report generation.
 * Run with: npx tsx server/src/services/reporter/test-report.ts
 */
import { initializeDatabase } from '../../db/index.js';
import { listScans } from '../../db/queries.js';
import { createReport, getReportPath, listReports } from './index.js';
import fs from 'fs';

async function main() {
  initializeDatabase();

  // Find a completed scan
  const scans = listScans();
  const completedScan = scans.find((s) => s.status === 'completed');

  if (!completedScan) {
    console.error('No completed scans found. Run the seed script first:');
    console.error('  npx tsx server/src/db/seed.ts');
    process.exit(1);
  }

  console.log(`Using scan: ${completedScan.id} (${completedScan.campaignName})`);

  // Generate report with details
  console.log('Generating PDF report...');
  const reportId = await createReport(completedScan.id, true);
  console.log(`Report created with ID: ${reportId}`);

  // Verify the file
  const filePath = await getReportPath(reportId);
  if (!filePath) {
    console.error('ERROR: Report file not found!');
    process.exit(1);
  }

  const stats = fs.statSync(filePath);
  console.log(`Report file: ${filePath}`);
  console.log(`File size: ${stats.size} bytes`);

  if (stats.size < 1024) {
    console.error('ERROR: Report file is suspiciously small (<1KB)');
    process.exit(1);
  }

  // Verify PDF header
  const header = Buffer.alloc(5);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, header, 0, 5, 0);
  fs.closeSync(fd);

  if (header.toString() !== '%PDF-') {
    console.error('ERROR: File does not have a valid PDF header');
    process.exit(1);
  }

  // List reports
  const reports = await listReports(completedScan.id);
  console.log(`Reports for this scan: ${reports.length}`);

  console.log('\n✅ Report generation test PASSED');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

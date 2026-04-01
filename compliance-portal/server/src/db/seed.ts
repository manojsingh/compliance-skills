/**
 * Seed script for development data.
 * Run with: npx tsx server/src/db/seed.ts
 */
import { initializeDatabase } from './index.js';
import db from './index.js';
import {
  createCampaign,
  createScan,
  updateScanStatus,
  insertScanResult,
  insertScanIssues,
} from './queries.js';
import { seedWcagData } from './seed-wcag.js';
import type { ScanSummary, AuditCategory } from '@compliance-portal/shared';

initializeDatabase();

// Seed WCAG reference data (idempotent)
seedWcagData(db);

console.log('Seeding database...');

// --- Campaign 1: E-Commerce AA compliance ---
const campaign1 = createCampaign({
  name: 'E-Commerce Platform Audit',
  complianceLevel: 'AA',
  categories: ['accessibility'],
  scanDepth: 3,
  scheduleCron: '0 2 * * 1',
  sites: [
    { url: 'https://shop.example.com', label: 'Main Store' },
    { url: 'https://shop.example.com/checkout', label: 'Checkout Flow' },
  ],
});
console.log(`Created campaign: ${campaign1.name} (${campaign1.id})`);

// --- Campaign 2: Government portal AAA compliance ---
const campaign2 = createCampaign({
  name: 'Government Portal Compliance',
  complianceLevel: 'AAA',
  categories: ['accessibility'],
  scanDepth: 5,
  sites: [
    { url: 'https://portal.gov.example.com', label: 'Main Portal' },
    { url: 'https://portal.gov.example.com/services', label: 'Services' },
  ],
});
console.log(`Created campaign: ${campaign2.name} (${campaign2.id})`);

// --- Campaign 3: Blog A compliance ---
const campaign3 = createCampaign({
  name: 'Corporate Blog Scan',
  complianceLevel: 'A',
  categories: ['accessibility'],
  scanDepth: 2,
  sites: [
    { url: 'https://blog.example.com', label: 'Blog Home' },
  ],
});
console.log(`Created campaign: ${campaign3.name} (${campaign3.id})`);

// --- Completed scan for campaign 1 ---
const scan1 = createScan(campaign1.id);
const site1 = campaign1.sites[0];
const site2 = campaign1.sites[1];

const result1 = insertScanResult({
  scanId: scan1.id,
  siteId: site1.id,
  pageUrl: 'https://shop.example.com',
  category: 'accessibility',
  score: 72,
  issuesCount: 5,
  details: { passes: 48, violations: 5, incomplete: 3 },
});

insertScanIssues([
  {
    resultId: result1.id,
    severity: 'critical',
    wcagCriterion: '1.1.1',
    wcagLevel: 'A',
    description: 'Images must have alternate text',
    element: '<img src="hero.jpg">',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
  },
  {
    resultId: result1.id,
    severity: 'serious',
    wcagCriterion: '4.1.2',
    wcagLevel: 'A',
    description: 'Form elements must have labels',
    element: '<input type="text" name="search">',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/label',
  },
  {
    resultId: result1.id,
    severity: 'moderate',
    wcagCriterion: '1.4.3',
    wcagLevel: 'AA',
    description: 'Elements must have sufficient color contrast',
    element: '<p class="light-text">Sale ends soon</p>',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
  },
  {
    resultId: result1.id,
    severity: 'minor',
    wcagCriterion: '2.4.6',
    wcagLevel: 'AA',
    description: 'Headings and labels should be descriptive',
    element: '<h3>Click here</h3>',
  },
  {
    resultId: result1.id,
    severity: 'moderate',
    wcagCriterion: '2.4.1',
    wcagLevel: 'A',
    description: 'Page must have means to bypass repeated blocks',
    element: '<body>',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/bypass',
  },
]);

const result4 = insertScanResult({
  scanId: scan1.id,
  siteId: site2.id,
  pageUrl: 'https://shop.example.com/checkout',
  category: 'accessibility',
  score: 65,
  issuesCount: 3,
  details: { passes: 32, violations: 3, incomplete: 5 },
});

insertScanIssues([
  {
    resultId: result4.id,
    severity: 'critical',
    wcagCriterion: '3.3.2',
    wcagLevel: 'A',
    description: 'Form input fields must have accessible labels',
    element: '<input type="email" placeholder="Email">',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/label',
  },
  {
    resultId: result4.id,
    severity: 'serious',
    wcagCriterion: '2.1.1',
    wcagLevel: 'A',
    description: 'All functionality must be operable through a keyboard interface',
    element: '<div onclick="submit()">Place Order</div>',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/keyboard',
  },
  {
    resultId: result4.id,
    severity: 'serious',
    wcagCriterion: '1.3.1',
    wcagLevel: 'A',
    description: 'Form fields must have proper structure and relationships',
    element: '<div class="form-group">',
  },
]);

const summary1: ScanSummary = {
  totalPages: 2,
  totalIssues: 8,
  criticalCount: 2,
  seriousCount: 3,
  moderateCount: 2,
  minorCount: 1,
  scores: { accessibility: 68.5 },
};

updateScanStatus(scan1.id, 'completed', summary1);
console.log(`Created completed scan for: ${campaign1.name}`);

// --- Completed scan for campaign 2 ---
const scan2 = createScan(campaign2.id);
const govSite1 = campaign2.sites[0];

const result5 = insertScanResult({
  scanId: scan2.id,
  siteId: govSite1.id,
  pageUrl: 'https://portal.gov.example.com',
  category: 'accessibility',
  score: 88,
  issuesCount: 2,
  details: { passes: 64, violations: 2, incomplete: 1 },
});

insertScanIssues([
  {
    resultId: result5.id,
    severity: 'moderate',
    wcagCriterion: '1.4.6',
    wcagLevel: 'AAA',
    description: 'Enhanced contrast ratio of at least 7:1 is required',
    element: '<span class="subtitle">Welcome</span>',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast-enhanced',
  },
  {
    resultId: result5.id,
    severity: 'minor',
    wcagCriterion: '3.1.2',
    wcagLevel: 'AA',
    description: 'Language of parts should be identified',
    element: '<blockquote>Bienvenue</blockquote>',
  },
]);

const summary2: ScanSummary = {
  totalPages: 1,
  totalIssues: 2,
  criticalCount: 0,
  seriousCount: 0,
  moderateCount: 1,
  minorCount: 1,
  scores: { accessibility: 88 },
};

updateScanStatus(scan2.id, 'completed', summary2);
console.log(`Created completed scan for: ${campaign2.name}`);

// --- Pending scan for campaign 3 ---
const scan3 = createScan(campaign3.id);
console.log(`Created pending scan for: ${campaign3.name}`);

console.log('\nSeed complete!');
process.exit(0);

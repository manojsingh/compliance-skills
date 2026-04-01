export interface Campaign {
  id: string;
  name: string;
  complianceLevel: 'A' | 'AA' | 'AAA';
  categories: AuditCategory[];
  scanDepth: number;
  scheduleCron: string | null;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSite {
  id: string;
  campaignId: string;
  url: string;
  label: string;
}

export type AuditCategory = 'accessibility';

export interface Scan {
  id: string;
  campaignId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  summary: ScanSummary | null;
}

export interface ScanSummary {
  totalPages: number;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  scores: { accessibility: number };
}

export interface ScanResult {
  id: string;
  scanId: string;
  siteId: string;
  pageUrl: string;
  category: AuditCategory;
  score: number;
  issuesCount: number;
  details: any;
}

export interface ScanIssue {
  id: string;
  resultId: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagCriterion: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  description: string;
  element: string;
  helpUrl: string;
}

export type ComplianceLevel = 'A' | 'AA' | 'AAA';

// ---------------------------------------------------------------------------
// Scan Audit Log
// ---------------------------------------------------------------------------

export interface ScanAuditEntry {
  id: string;
  scanId: string;
  category: AuditCategory;
  ruleId: string;
  ruleName: string;
  expected: boolean;
  executed: boolean;
  passed: boolean | null;
  errorMessage: string | null;
  siteId: string | null;
  pageUrl: string | null;
  executedAt: string | null;
  createdAt: string;
}

export interface ScanAuditSummary {
  totalExpected: number;
  totalExecuted: number;
  totalPassed: number;
  totalFailed: number;
  totalErrored: number;
  coveragePercent: number;
  byCategory: Record<AuditCategory, {
    expected: number;
    executed: number;
    passed: number;
    failed: number;
    errored: number;
  }>;
}

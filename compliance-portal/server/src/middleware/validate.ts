import type { AuditCategory, ComplianceLevel } from '@compliance-portal/shared';
import { ValidationError } from './errorHandler.js';

const VALID_COMPLIANCE_LEVELS: ComplianceLevel[] = ['A', 'AA', 'AAA'];
const VALID_CATEGORIES: AuditCategory[] = ['accessibility'];

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ValidatedCampaignBody {
  name: string;
  complianceLevel: ComplianceLevel;
  categories: AuditCategory[];
  scanDepth: number;
  maxPagesToScan: number | null;
  scheduleCron: string | null;
  sites: { url: string; label: string }[];
}

export function validateCampaignCreate(body: unknown): ValidatedCampaignBody {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required');
  }

  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  // name
  if (!b.name || typeof b.name !== 'string' || b.name.trim().length === 0) {
    errors.push('name is required and must be a non-empty string');
  }

  // complianceLevel
  if (!b.complianceLevel || !VALID_COMPLIANCE_LEVELS.includes(b.complianceLevel as ComplianceLevel)) {
    errors.push(`complianceLevel must be one of: ${VALID_COMPLIANCE_LEVELS.join(', ')}`);
  }

  // categories
  if (!Array.isArray(b.categories) || b.categories.length === 0) {
    errors.push('categories must be an array with at least one item');
  } else {
    const invalid = b.categories.filter((c: unknown) => !VALID_CATEGORIES.includes(c as AuditCategory));
    if (invalid.length > 0) {
      errors.push(`Invalid categories: ${invalid.join(', ')}. Must be: ${VALID_CATEGORIES.join(', ')}`);
    }
  }

  // scanDepth
  const scanDepth = b.scanDepth !== undefined ? Number(b.scanDepth) : 2;
  if (!Number.isInteger(scanDepth) || scanDepth < 1 || scanDepth > 5) {
    errors.push('scanDepth must be an integer between 1 and 5');
  }

  // maxPagesToScan
  let maxPagesToScan: number | null = null;
  if (b.maxPagesToScan !== undefined && b.maxPagesToScan !== null) {
    const mpts = Number(b.maxPagesToScan);
    if (!Number.isInteger(mpts) || mpts < 1) {
      errors.push('maxPagesToScan must be a positive integer or null');
    } else {
      maxPagesToScan = mpts;
    }
  }

  // scheduleCron
  const scheduleCron = b.scheduleCron !== undefined ? (b.scheduleCron as string | null) : null;

  // sites
  if (!Array.isArray(b.sites) || b.sites.length === 0) {
    errors.push('sites must be an array with at least one site');
  } else {
    for (let i = 0; i < b.sites.length; i++) {
      const site = b.sites[i] as Record<string, unknown>;
      if (!site.url || typeof site.url !== 'string' || !isValidUrl(site.url)) {
        errors.push(`sites[${i}].url must be a valid HTTP(S) URL`);
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid campaign data', errors);
  }

  return {
    name: (b.name as string).trim(),
    complianceLevel: b.complianceLevel as ComplianceLevel,
    categories: b.categories as AuditCategory[],
    scanDepth,
    maxPagesToScan,
    scheduleCron,
    sites: (b.sites as { url: string; label?: string }[]).map((s) => ({
      url: s.url,
      label: s.label ?? '',
    })),
  };
}

export function validateCampaignUpdate(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required');
  }

  const b = body as Record<string, unknown>;
  const errors: string[] = [];
  const result: Record<string, unknown> = {};

  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || b.name.trim().length === 0) {
      errors.push('name must be a non-empty string');
    } else {
      result.name = b.name.trim();
    }
  }

  if (b.complianceLevel !== undefined) {
    if (!VALID_COMPLIANCE_LEVELS.includes(b.complianceLevel as ComplianceLevel)) {
      errors.push(`complianceLevel must be one of: ${VALID_COMPLIANCE_LEVELS.join(', ')}`);
    } else {
      result.complianceLevel = b.complianceLevel;
    }
  }

  if (b.categories !== undefined) {
    if (!Array.isArray(b.categories) || b.categories.length === 0) {
      errors.push('categories must be an array with at least one item');
    } else {
      const invalid = b.categories.filter((c: unknown) => !VALID_CATEGORIES.includes(c as AuditCategory));
      if (invalid.length > 0) {
        errors.push(`Invalid categories: ${invalid.join(', ')}`);
      } else {
        result.categories = b.categories;
      }
    }
  }

  if (b.scanDepth !== undefined) {
    const sd = Number(b.scanDepth);
    if (!Number.isInteger(sd) || sd < 1 || sd > 5) {
      errors.push('scanDepth must be an integer between 1 and 5');
    } else {
      result.scanDepth = sd;
    }
  }

  if (b.maxPagesToScan !== undefined) {
    if (b.maxPagesToScan === null) {
      result.maxPagesToScan = null;
    } else {
      const mpts = Number(b.maxPagesToScan);
      if (!Number.isInteger(mpts) || mpts < 1) {
        errors.push('maxPagesToScan must be a positive integer or null');
      } else {
        result.maxPagesToScan = mpts;
      }
    }
  }

  if (b.scheduleCron !== undefined) {
    result.scheduleCron = b.scheduleCron;
  }

  if (b.status !== undefined) {
    if (!['active', 'paused', 'completed'].includes(b.status as string)) {
      errors.push('status must be one of: active, paused, completed');
    } else {
      result.status = b.status;
    }
  }

  if (b.sites !== undefined) {
    if (!Array.isArray(b.sites) || b.sites.length === 0) {
      errors.push('sites must be an array with at least one site');
    } else {
      const invalid = (b.sites as { url?: string }[]).filter(
        (s) => !s.url || typeof s.url !== 'string' || !isValidUrl(s.url),
      );
      if (invalid.length > 0) {
        errors.push('One or more site URLs are invalid');
      } else {
        result.sites = (b.sites as { url: string; label?: string }[]).map((s) => ({
          url: s.url,
          label: s.label ?? '',
        }));
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid campaign data', errors);
  }

  return result;
}

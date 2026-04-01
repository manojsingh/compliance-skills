import type { ParseResult, ParsedCriterion } from './types.js';

/**
 * Parse WCAG criteria from a JSON file.
 *
 * Supports three formats:
 *   1. Flat array of criteria
 *   2. Hierarchical object with principles/guidelines/criteria keys
 *   3. Internal export format (same structure as wcag-guidelines.ts)
 */
export async function parseJson(buffer: Buffer, filename: string): Promise<ParseResult> {
  const warnings: string[] = [];
  let data: unknown;

  try {
    data = JSON.parse(buffer.toString());
  } catch {
    warnings.push('Invalid JSON file.');
    return { criteria: [], principles: [], guidelines: [], warnings, source: filename };
  }

  // --- Format 1: Flat array ---
  if (Array.isArray(data)) {
    return parseFlatArray(data, filename, warnings);
  }

  // --- Format 2 & 3: Object with known keys ---
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Check for hierarchical/internal format
    if (obj.criteria || obj.principles || obj.guidelines) {
      return parseHierarchical(obj, filename, warnings);
    }

    // Check if it's wrapped in a single key like { data: [...] }
    const keys = Object.keys(obj);
    if (keys.length === 1 && Array.isArray(obj[keys[0]])) {
      return parseFlatArray(obj[keys[0]] as unknown[], filename, warnings);
    }
  }

  warnings.push('Unrecognized JSON structure. Expected an array of criteria or an object with criteria/principles/guidelines keys.');
  return { criteria: [], principles: [], guidelines: [], warnings, source: filename };
}

function parseFlatArray(arr: unknown[], filename: string, warnings: string[]): ParseResult {
  const criteria: ParsedCriterion[] = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') {
      warnings.push(`Item ${i}: not an object, skipped.`);
      continue;
    }

    const id = str(item.id ?? item.criterion_id ?? item.criterionId);
    if (!id || !/^\d+\.\d+\.\d+$/.test(id)) {
      warnings.push(`Item ${i}: missing or invalid criterion ID, skipped.`);
      continue;
    }

    const name = str(item.name ?? item.title) || id;
    const levelRaw = str(item.level ?? item.conformanceLevel)?.toUpperCase() || 'A';
    const level = (['A', 'AA', 'AAA'].includes(levelRaw) ? levelRaw : 'A') as 'A' | 'AA' | 'AAA';
    if (!['A', 'AA', 'AAA'].includes(levelRaw)) {
      warnings.push(`Item ${i} (${id}): invalid level "${levelRaw}", defaulting to "A".`);
    }

    const parts = id.split('.');
    const guidelineId = str(item.guidelineId ?? item.guideline_id) || `${parts[0]}.${parts[1]}`;
    const description = str(item.description ?? item.desc) || name;
    const helpUrl = str(item.helpUrl ?? item.help_url) || undefined;

    let axeRules: string[] | undefined;
    if (Array.isArray(item.axeRules)) {
      axeRules = (item.axeRules as unknown[]).map(String).filter(Boolean);
    } else if (Array.isArray(item.axe_rules)) {
      axeRules = (item.axe_rules as unknown[]).map(String).filter(Boolean);
    } else if (typeof item.axeRules === 'string') {
      axeRules = (item.axeRules as string).split(/[|,]/).map((r) => r.trim()).filter(Boolean);
    }

    criteria.push({ id, name, level, description, guidelineId, helpUrl, axeRules });
  }

  return { criteria, principles: [], guidelines: [], warnings, source: filename };
}

function parseHierarchical(obj: Record<string, unknown>, filename: string, warnings: string[]): ParseResult {
  const principles: ParseResult['principles'] = [];
  const guidelines: ParseResult['guidelines'] = [];
  const criteria: ParsedCriterion[] = [];

  // Parse principles
  if (Array.isArray(obj.principles)) {
    for (const p of obj.principles as Record<string, unknown>[]) {
      const id = str(p.id);
      const name = str(p.name);
      if (id && name) {
        principles.push({ id, name, description: str(p.description) || name });
      }
    }
  }

  // Parse guidelines
  if (Array.isArray(obj.guidelines)) {
    for (const g of obj.guidelines as Record<string, unknown>[]) {
      const id = str(g.id);
      const name = str(g.name);
      const principleId = str(g.principleId ?? g.principle_id) || id?.split('.')[0] || '';
      if (id && name) {
        guidelines.push({ id, principleId, name, description: str(g.description) || name });
      }
    }
  }

  // Parse criteria (reuse flat array logic)
  if (Array.isArray(obj.criteria)) {
    const result = parseFlatArray(obj.criteria as unknown[], filename, warnings);
    criteria.push(...result.criteria);
  }

  return { criteria, principles, guidelines, warnings, source: filename };
}

function str(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return '';
}

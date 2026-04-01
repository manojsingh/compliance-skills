import { parse } from 'csv-parse/sync';
import type { ParseResult, ParsedCriterion } from './types.js';

// Flexible column name mappings
const ID_COLS = ['id', 'criterion_id', 'criterionid', 'sc', 'success_criterion'];
const NAME_COLS = ['name', 'title', 'criterion_name'];
const LEVEL_COLS = ['level', 'conformance_level', 'wcag_level'];
const DESC_COLS = ['description', 'desc', 'details'];
const GUIDELINE_COLS = ['guideline_id', 'guidelineid', 'guideline'];
const HELP_COLS = ['help_url', 'helpurl', 'url', 'reference', 'link'];
const AXE_COLS = ['axe_rules', 'axerules', 'axe', 'rules', 'automated_rules'];

function findColumn(headers: string[], candidates: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

/**
 * Parse WCAG criteria from a CSV file.
 * Supports flexible column naming and pipe- or comma-delimited axe rules.
 */
export async function parseCsv(buffer: Buffer, filename: string): Promise<ParseResult> {
  const records: Record<string, string>[] = parse(buffer.toString(), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const warnings: string[] = [];

  if (records.length === 0) {
    warnings.push('CSV file contains no data rows.');
    return { criteria: [], principles: [], guidelines: [], warnings, source: filename };
  }

  const headers = Object.keys(records[0]);
  const idCol = findColumn(headers, ID_COLS);
  const nameCol = findColumn(headers, NAME_COLS);
  const levelCol = findColumn(headers, LEVEL_COLS);
  const descCol = findColumn(headers, DESC_COLS);
  const guidelineCol = findColumn(headers, GUIDELINE_COLS);
  const helpCol = findColumn(headers, HELP_COLS);
  const axeCol = findColumn(headers, AXE_COLS);

  if (!idCol) {
    warnings.push(`No ID column found. Expected one of: ${ID_COLS.join(', ')}`);
    return { criteria: [], principles: [], guidelines: [], warnings, source: filename };
  }

  const criteria: ParsedCriterion[] = [];
  const validLevels = new Set(['A', 'AA', 'AAA']);

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // +2 for header row + 0-indexing

    const id = row[idCol]?.trim();
    if (!id) {
      warnings.push(`Row ${rowNum}: missing ID, skipped.`);
      continue;
    }

    // Validate ID format (digits.digits.digits)
    if (!/^\d+\.\d+\.\d+$/.test(id)) {
      warnings.push(`Row ${rowNum}: invalid criterion ID format "${id}", skipped.`);
      continue;
    }

    const name = nameCol ? row[nameCol]?.trim() : '';
    const levelRaw = levelCol ? row[levelCol]?.trim().toUpperCase() : '';
    const description = descCol ? row[descCol]?.trim() : name || '';
    const helpUrl = helpCol ? row[helpCol]?.trim() : undefined;

    // Parse level
    let level: 'A' | 'AA' | 'AAA' = 'A';
    if (validLevels.has(levelRaw)) {
      level = levelRaw as 'A' | 'AA' | 'AAA';
    } else if (levelRaw) {
      warnings.push(`Row ${rowNum}: invalid level "${levelRaw}", defaulting to "A".`);
    }

    // Derive guideline ID from criterion ID
    const parts = id.split('.');
    const guidelineId = guidelineCol
      ? row[guidelineCol]?.trim() || `${parts[0]}.${parts[1]}`
      : `${parts[0]}.${parts[1]}`;

    // Parse axe rules (pipe-delimited or comma-delimited)
    let axeRules: string[] | undefined;
    if (axeCol && row[axeCol]?.trim()) {
      const raw = row[axeCol].trim();
      axeRules = raw.includes('|')
        ? raw.split('|').map((r) => r.trim()).filter(Boolean)
        : raw.split(',').map((r) => r.trim()).filter(Boolean);
    }

    if (!name) {
      warnings.push(`Row ${rowNum}: missing name for criterion ${id}.`);
    }

    criteria.push({
      id,
      name: name || id,
      level,
      description,
      guidelineId,
      helpUrl: helpUrl || undefined,
      axeRules,
    });
  }

  return { criteria, principles: [], guidelines: [], warnings, source: filename };
}

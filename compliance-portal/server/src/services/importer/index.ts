import { parsePdf } from './pdf-parser.js';
import { parseCsv } from './csv-parser.js';
import { parseJson } from './json-parser.js';
import type { ParseResult } from './types.js';
import {
  upsertPrinciple,
  upsertGuideline,
  bulkImportCriteria,
  clearAllWcagData,
  logImport,
} from '../../db/wcag-queries.js';

export type { ParseResult, ParsedCriterion } from './types.js';

/**
 * Route a file buffer to the appropriate parser based on mime type or extension.
 */
export async function importFromFile(buffer: Buffer, filename: string, mimeType: string): Promise<ParseResult> {
  const lower = filename.toLowerCase();

  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    return parsePdf(buffer, filename);
  }
  if (mimeType === 'text/csv' || mimeType === 'text/plain' || lower.endsWith('.csv')) {
    return parseCsv(buffer, filename);
  }
  if (mimeType === 'application/json' || lower.endsWith('.json')) {
    return parseJson(buffer, filename);
  }

  throw new Error(`Unsupported file type: ${mimeType} (${filename})`);
}

/**
 * Persist parsed WCAG data into the database.
 *
 * @param parseResult  The output from one of the parsers.
 * @param mode         'merge' keeps existing data and upserts; 'replace' wipes first.
 */
export function importToDatabase(
  parseResult: ParseResult,
  mode: 'merge' | 'replace',
): { imported: number; updated: number; errors: string[] } {
  if (mode === 'replace') {
    clearAllWcagData();
  }

  // Insert principles first (they are parents)
  for (const p of parseResult.principles) {
    upsertPrinciple(p);
  }

  // Then guidelines
  for (const g of parseResult.guidelines) {
    upsertGuideline(g);
  }

  // Finally criteria (with axe rules)
  const result = bulkImportCriteria(
    parseResult.criteria.map((c) => ({
      id: c.id,
      guidelineId: c.guidelineId,
      name: c.name,
      level: c.level,
      description: c.description,
      helpUrl: c.helpUrl,
      axeRules: c.axeRules,
    })),
  );

  // Determine source type from filename
  const ext = parseResult.source.split('.').pop()?.toLowerCase() ?? 'manual';
  const sourceType = (['pdf', 'csv', 'json'].includes(ext) ? ext : 'manual') as 'pdf' | 'csv' | 'json' | 'manual';

  logImport(sourceType, parseResult.source, result.imported + result.updated);

  return result;
}

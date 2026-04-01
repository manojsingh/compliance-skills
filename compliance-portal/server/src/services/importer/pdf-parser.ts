import { PDFParse } from 'pdf-parse';
import type { ParseResult, ParsedCriterion } from './types.js';

/**
 * Parse WCAG criteria from a PDF document using regex-based extraction.
 * PDF parsing is inherently fuzzy — results include warnings for unparseable content.
 */
export async function parsePdf(buffer: Buffer, filename: string): Promise<ParseResult> {
  const pdf = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await pdf.getText();
  const text: string = textResult.text;
  await pdf.destroy();

  const warnings: string[] = [];
  const principles: ParseResult['principles'] = [];
  const guidelines: ParseResult['guidelines'] = [];
  const criteria: ParsedCriterion[] = [];

  // --- Extract Principles ---
  // Pattern: "Principle 1: Perceivable" or "Principle 1 – Perceivable"
  const principleRe = /Principle\s+(\d+)\s*[:\u2013\u2014-]\s*(.+)/gi;
  let match: RegExpExecArray | null;
  while ((match = principleRe.exec(text)) !== null) {
    const id = match[1];
    const name = match[2].trim().replace(/\s+/g, ' ');
    if (!principles.find((p) => p.id === id)) {
      principles.push({ id, name, description: name });
    }
  }

  // --- Extract Guidelines ---
  // Pattern: "Guideline 1.1 Text Alternatives" or "Guideline 1.1: Text Alternatives"
  const guidelineRe = /Guideline\s+(\d+\.\d+)\s*[:\u2013\u2014-]?\s*(.+)/gi;
  while ((match = guidelineRe.exec(text)) !== null) {
    const id = match[1];
    const name = match[2].trim().replace(/\s+/g, ' ');
    const principleId = id.split('.')[0];
    if (!guidelines.find((g) => g.id === id)) {
      guidelines.push({ id, principleId, name, description: name });
    }
  }

  // --- Extract Criteria ---
  // Pattern variations:
  //   "1.1.1 Non-text Content (Level A)"
  //   "1.1.1 Non-text Content Level A"
  //   "Success Criterion 1.1.1 Non-text Content (Level A)"
  const criterionRe =
    /(?:Success\s+Criterion\s+)?(\d+\.\d+\.\d+)\s+(.+?)(?:\(Level\s+(A{1,3})\)|Level\s+(A{1,3}))/gi;
  while ((match = criterionRe.exec(text)) !== null) {
    const id = match[1];
    const name = match[2].trim().replace(/\s+/g, ' ');
    const level = (match[3] || match[4]) as 'A' | 'AA' | 'AAA';
    const parts = id.split('.');
    const guidelineId = `${parts[0]}.${parts[1]}`;

    if (!criteria.find((c) => c.id === id)) {
      criteria.push({
        id,
        name,
        level,
        description: name, // PDF descriptions are hard to isolate; use name as fallback
        guidelineId,
      });
    }
  }

  if (criteria.length === 0) {
    warnings.push(
      'No WCAG criteria could be extracted from the PDF. Ensure the document contains standard WCAG formatting.',
    );
  }

  if (principles.length === 0 && criteria.length > 0) {
    warnings.push('No principles found — they will need to exist in the database before import.');
  }

  if (guidelines.length === 0 && criteria.length > 0) {
    warnings.push('No guidelines found — they will need to exist in the database before import.');
  }

  return { criteria, principles, guidelines, warnings, source: filename };
}

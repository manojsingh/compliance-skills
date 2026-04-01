export interface ParsedCriterion {
  id: string;            // e.g., '1.1.1'
  name: string;          // e.g., 'Non-text Content'
  level: 'A' | 'AA' | 'AAA';
  description: string;
  guidelineId: string;   // e.g., '1.1'
  helpUrl?: string;
  axeRules?: string[];
}

export interface ParseResult {
  criteria: ParsedCriterion[];
  principles: Array<{ id: string; name: string; description: string }>;
  guidelines: Array<{ id: string; principleId: string; name: string; description: string }>;
  warnings: string[];
  source: string;        // filename
}

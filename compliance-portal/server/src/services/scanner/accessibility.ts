import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright';
import { mapAxeRuleToCriterion } from '../../data/wcag-helpers.js';
import type { ComplianceLevel } from '@compliance-portal/shared';

// Handle both default and named export patterns
const AxeBuilderClass = (AxeBuilder as any).default ?? AxeBuilder;

export interface AccessibilityIssue {
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagCriterion: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  description: string;
  element: string;
  helpUrl: string;
}

export interface AccessibilityResult {
  score: number;
  issues: AccessibilityIssue[];
  totalChecks: number;
  passedChecks: number;
}

/** Map compliance level to axe WCAG tag filters */
function getAxeTags(level: ComplianceLevel): string[] {
  const tags: Record<ComplianceLevel, string[]> = {
    A: ['wcag2a', 'wcag21a'],
    AA: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    AAA: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
  };
  return tags[level];
}

/** Map axe impact severity to our severity levels */
function mapImpactToSeverity(
  impact: string | undefined | null,
): AccessibilityIssue['severity'] {
  switch (impact) {
    case 'critical':
      return 'critical';
    case 'serious':
      return 'serious';
    case 'moderate':
      return 'moderate';
    default:
      return 'minor';
  }
}

// Severity weights for scoring — heavier violations penalise the score more
const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

export async function auditAccessibility(
  page: Page,
  complianceLevel: ComplianceLevel,
): Promise<AccessibilityResult> {
  const tags = getAxeTags(complianceLevel);

  const results = await new AxeBuilderClass({ page }).withTags(tags).analyze();

  const issues: AccessibilityIssue[] = [];

  for (const violation of results.violations) {
    const criterion = mapAxeRuleToCriterion(violation.id);

    for (const node of violation.nodes) {
      issues.push({
        severity: mapImpactToSeverity(violation.impact),
        wcagCriterion: criterion?.id ?? '',
        wcagLevel: (criterion?.level ?? 'A') as 'A' | 'AA' | 'AAA',
        description: violation.help,
        element: node.html.slice(0, 500),
        helpUrl: violation.helpUrl,
      });
    }
  }

  // Weighted score: each rule contributes its weight; violations reduce the score
  // proportionally to their severity weight. This is stable — it doesn't swing
  // by 3 points just because one extra minor rule now passes.
  let totalWeight = 0;
  let penaltyWeight = 0;

  for (const pass of results.passes) {
    // Passed rules carry weight 1 (we don't know their severity, axe doesn't expose it)
    totalWeight += 1;
  }
  for (const violation of results.violations) {
    const w = SEVERITY_WEIGHTS[violation.impact ?? 'minor'] ?? 1;
    totalWeight += w;
    penaltyWeight += w;
  }

  const score =
    totalWeight > 0
      ? Math.round(((totalWeight - penaltyWeight) / totalWeight) * 100)
      : 100;

  const passedChecks = results.passes.length;
  const violationChecks = results.violations.length;
  const totalChecks = passedChecks + violationChecks;

  return {
    score,
    issues,
    totalChecks,
    passedChecks,
  };
}

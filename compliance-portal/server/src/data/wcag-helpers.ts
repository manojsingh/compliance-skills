/**
 * WCAG helper functions — backed by SQLite via wcag-queries.
 *
 * Function signatures are preserved so existing consumers
 * (e.g. the accessibility scanner) don't need to change imports.
 */
import {
  getAllCriteria as dbGetAllCriteria,
  getCriteriaByLevel as dbGetCriteriaByLevel,
  getAxeRulesForLevel as dbGetAxeRulesForLevel,
  mapAxeRuleToCriterion as dbMapAxeRuleToCriterion,
  getCriteriaByPrinciple as dbGetCriteriaByPrinciple,
  getLevelStats as dbGetLevelStats,
  type WcagCriterion,
} from '../db/wcag-queries.js';
import type { ComplianceLevel } from '@compliance-portal/shared';

/**
 * Get all criteria that apply to a given compliance level.
 * Levels are cumulative: AA includes A; AAA includes A and AA.
 */
export function getCriteriaForLevel(level: ComplianceLevel): WcagCriterion[] {
  return dbGetCriteriaByLevel(level);
}

/**
 * Collect all unique axe-core rule IDs relevant to a compliance level.
 */
export function getAxeRulesForLevel(level: ComplianceLevel): string[] {
  return dbGetAxeRulesForLevel(level);
}

/**
 * Given an axe-core rule ID, return the WCAG criterion it maps to (first match).
 */
export function mapAxeRuleToCriterion(
  ruleId: string,
): WcagCriterion | undefined {
  return dbMapAxeRuleToCriterion(ruleId);
}

/**
 * Group criteria by their parent principle for a given compliance level.
 * Keys are principle IDs ('1', '2', '3', '4').
 */
export function getCriteriaByPrinciple(
  level: ComplianceLevel,
): Record<string, WcagCriterion[]> {
  return dbGetCriteriaByPrinciple(level);
}

/**
 * Return summary statistics for a compliance level:
 * - total: number of success criteria
 * - automated: criteria with at least one axe-core rule
 * - manual: criteria that require manual testing (no axe rules)
 */
export function getLevelStats(
  level: ComplianceLevel,
): { total: number; automated: number; manual: number } {
  return dbGetLevelStats(level);
}

export type { WcagCriterion };

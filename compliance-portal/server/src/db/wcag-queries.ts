import { v4 as uuidv4 } from 'uuid';
import db from './index.js';
import type { ComplianceLevel } from '@compliance-portal/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WcagPrinciple {
  id: string;
  name: string;
  description: string;
}

export interface WcagGuideline {
  id: string;
  principleId: string;
  name: string;
  description: string;
}

export interface WcagCriterion {
  id: string;
  guidelineId: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
  description: string;
  axeRules: string[];
  category: string;
  helpUrl: string;
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface CriterionRow {
  id: string;
  guideline_id: string;
  name: string;
  level: string;
  description: string;
  category: string;
  help_url: string | null;
  axe_rules_csv: string | null;
}

interface GuidelineRow {
  id: string;
  principle_id: string;
  name: string;
  description: string;
}

interface ImportLogRow {
  id: string;
  source_type: string;
  source_name: string | null;
  records_imported: number;
  imported_at: string;
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

const allPrinciplesStmt = db.prepare(`SELECT * FROM wcag_principles ORDER BY id`);

export function getAllPrinciples(): WcagPrinciple[] {
  return allPrinciplesStmt.all() as WcagPrinciple[];
}

const allGuidelinesStmt = db.prepare(`SELECT * FROM wcag_guidelines ORDER BY id`);

export function getAllGuidelines(): WcagGuideline[] {
  const rows = allGuidelinesStmt.all() as GuidelineRow[];
  return rows.map((r) => ({
    id: r.id,
    principleId: r.principle_id,
    name: r.name,
    description: r.description,
  }));
}

const allCriteriaStmt = db.prepare(`
  SELECT c.*, GROUP_CONCAT(a.axe_rule_id) as axe_rules_csv
  FROM wcag_criteria c
  LEFT JOIN wcag_axe_rules a ON a.criterion_id = c.id
  GROUP BY c.id
  ORDER BY c.id
`);

export function getAllCriteria(): WcagCriterion[] {
  const rows = allCriteriaStmt.all() as CriterionRow[];
  return rows.map(mapCriterionRow);
}

const criteriaByLevelStmt = db.prepare(`
  SELECT c.*, GROUP_CONCAT(a.axe_rule_id) as axe_rules_csv
  FROM wcag_criteria c
  LEFT JOIN wcag_axe_rules a ON a.criterion_id = c.id
  WHERE c.level IN (SELECT value FROM json_each(@levels))
  GROUP BY c.id
  ORDER BY c.id
`);

export function getCriteriaByLevel(level: ComplianceLevel): WcagCriterion[] {
  const levelMap: Record<ComplianceLevel, string[]> = {
    A: ['A'],
    AA: ['A', 'AA'],
    AAA: ['A', 'AA', 'AAA'],
  };
  const rows = criteriaByLevelStmt.all({
    levels: JSON.stringify(levelMap[level]),
  }) as CriterionRow[];
  return rows.map(mapCriterionRow);
}

const criterionByIdStmt = db.prepare(`
  SELECT c.*, GROUP_CONCAT(a.axe_rule_id) as axe_rules_csv
  FROM wcag_criteria c
  LEFT JOIN wcag_axe_rules a ON a.criterion_id = c.id
  WHERE c.id = ?
  GROUP BY c.id
`);

export function getCriterionById(id: string): WcagCriterion | null {
  const row = criterionByIdStmt.get(id) as CriterionRow | undefined;
  if (!row || !row.id) return null;
  return mapCriterionRow(row);
}

export function getAxeRulesForLevel(level: ComplianceLevel): string[] {
  const criteria = getCriteriaByLevel(level);
  const rules = new Set<string>();
  for (const c of criteria) {
    for (const r of c.axeRules) {
      rules.add(r);
    }
  }
  return [...rules];
}

export function mapAxeRuleToCriterion(ruleId: string): WcagCriterion | undefined {
  const all = getAllCriteria();
  return all.find((c) => c.axeRules.includes(ruleId));
}

export function getCriteriaByPrinciple(level: ComplianceLevel): Record<string, WcagCriterion[]> {
  const principles = getAllPrinciples();
  const gdLines = getAllGuidelines();
  const criteriaList = getCriteriaByLevel(level);

  const result: Record<string, WcagCriterion[]> = {};
  for (const p of principles) {
    result[p.id] = [];
  }

  const guidelineToPrinciple = new Map(
    gdLines.map((g) => [g.id, g.principleId]),
  );

  for (const c of criteriaList) {
    const principleId = guidelineToPrinciple.get(c.guidelineId);
    if (principleId && result[principleId]) {
      result[principleId].push(c);
    }
  }
  return result;
}

export function getLevelStats(level: ComplianceLevel): { total: number; automated: number; manual: number } {
  const all = getCriteriaByLevel(level);
  const automated = all.filter((c) => c.axeRules.length > 0).length;
  return {
    total: all.length,
    automated,
    manual: all.length - automated,
  };
}

export function getWcagStats(): { principles: number; guidelines: number; criteria: { A: number; AA: number; AAA: number; total: number } } {
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM wcag_principles) as principles,
      (SELECT COUNT(*) FROM wcag_guidelines) as guidelines,
      (SELECT COUNT(*) FROM wcag_criteria WHERE level = 'A') as level_a,
      (SELECT COUNT(*) FROM wcag_criteria WHERE level = 'AA') as level_aa,
      (SELECT COUNT(*) FROM wcag_criteria WHERE level = 'AAA') as level_aaa,
      (SELECT COUNT(*) FROM wcag_criteria) as total
  `).get() as { principles: number; guidelines: number; level_a: number; level_aa: number; level_aaa: number; total: number };
  return {
    principles: stats.principles,
    guidelines: stats.guidelines,
    criteria: {
      A: stats.level_a,
      AA: stats.level_aa,
      AAA: stats.level_aaa,
      total: stats.total,
    },
  };
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

const upsertPrincipleStmt = db.prepare(`
  INSERT OR REPLACE INTO wcag_principles (id, name, description)
  VALUES (@id, @name, @description)
`);

export function upsertPrinciple(data: { id: string; name: string; description: string }): void {
  upsertPrincipleStmt.run(data);
}

const upsertGuidelineStmt = db.prepare(`
  INSERT OR REPLACE INTO wcag_guidelines (id, principle_id, name, description)
  VALUES (@id, @principle_id, @name, @description)
`);

export function upsertGuideline(data: { id: string; principleId: string; name: string; description: string }): void {
  upsertGuidelineStmt.run({
    id: data.id,
    principle_id: data.principleId,
    name: data.name,
    description: data.description,
  });
}

const upsertCriterionStmt = db.prepare(`
  INSERT OR REPLACE INTO wcag_criteria (id, guideline_id, name, level, description, category, help_url, updated_at)
  VALUES (@id, @guideline_id, @name, @level, @description, @category, @help_url, datetime('now'))
`);

const deleteAxeRulesStmt = db.prepare(`DELETE FROM wcag_axe_rules WHERE criterion_id = ?`);
const insertAxeRuleStmt = db.prepare(`
  INSERT OR IGNORE INTO wcag_axe_rules (criterion_id, axe_rule_id)
  VALUES (@criterion_id, @axe_rule_id)
`);

export function upsertCriterion(data: {
  id: string;
  guidelineId: string;
  name: string;
  level: string;
  description: string;
  helpUrl?: string;
  axeRules?: string[];
}): void {
  const txn = db.transaction(() => {
    upsertCriterionStmt.run({
      id: data.id,
      guideline_id: data.guidelineId,
      name: data.name,
      level: data.level,
      description: data.description,
      category: 'accessibility',
      help_url: data.helpUrl ?? null,
    });

    if (data.axeRules) {
      deleteAxeRulesStmt.run(data.id);
      for (const ruleId of data.axeRules) {
        insertAxeRuleStmt.run({ criterion_id: data.id, axe_rule_id: ruleId });
      }
    }
  });
  txn();
}

const deleteCriterionStmt = db.prepare(`DELETE FROM wcag_criteria WHERE id = ?`);

export function deleteCriterion(id: string): void {
  deleteCriterionStmt.run(id);
}

export function updateAxeRules(criterionId: string, ruleIds: string[]): void {
  const txn = db.transaction(() => {
    deleteAxeRulesStmt.run(criterionId);
    for (const ruleId of ruleIds) {
      insertAxeRuleStmt.run({ criterion_id: criterionId, axe_rule_id: ruleId });
    }
  });
  txn();
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export function bulkImportCriteria(
  data: Array<{
    id: string;
    guidelineId: string;
    name: string;
    level: string;
    description: string;
    helpUrl?: string;
    axeRules?: string[];
  }>,
): { imported: number; updated: number; errors: string[] } {
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];

  const txn = db.transaction(() => {
    for (const item of data) {
      try {
        const existing = db.prepare(`SELECT id FROM wcag_criteria WHERE id = ?`).get(item.id);
        upsertCriterionStmt.run({
          id: item.id,
          guideline_id: item.guidelineId,
          name: item.name,
          level: item.level,
          description: item.description,
          category: 'accessibility',
          help_url: item.helpUrl ?? null,
        });

        if (item.axeRules) {
          deleteAxeRulesStmt.run(item.id);
          for (const ruleId of item.axeRules) {
            insertAxeRuleStmt.run({ criterion_id: item.id, axe_rule_id: ruleId });
          }
        }

        if (existing) {
          updated++;
        } else {
          imported++;
        }
      } catch (err) {
        errors.push(`${item.id}: ${(err as Error).message}`);
      }
    }
  });

  txn();
  return { imported, updated, errors };
}

export function clearAllWcagData(): void {
  const txn = db.transaction(() => {
    db.prepare(`DELETE FROM wcag_axe_rules`).run();
    db.prepare(`DELETE FROM wcag_criteria`).run();
    db.prepare(`DELETE FROM wcag_guidelines`).run();
    db.prepare(`DELETE FROM wcag_principles`).run();
  });
  txn();
}

// ---------------------------------------------------------------------------
// Import log
// ---------------------------------------------------------------------------

const insertImportLogStmt = db.prepare(`
  INSERT INTO wcag_import_log (id, source_type, source_name, records_imported)
  VALUES (@id, @source_type, @source_name, @records_imported)
`);

export function logImport(sourceType: string, sourceName: string, count: number): string {
  const id = uuidv4();
  insertImportLogStmt.run({
    id,
    source_type: sourceType,
    source_name: sourceName,
    records_imported: count,
  });
  return id;
}

const importHistoryStmt = db.prepare(`
  SELECT * FROM wcag_import_log ORDER BY imported_at DESC
`);

export function getImportHistory(): Array<{
  id: string;
  sourceType: string;
  sourceName: string | null;
  recordsImported: number;
  importedAt: string;
}> {
  const rows = importHistoryStmt.all() as ImportLogRow[];
  return rows.map((r) => ({
    id: r.id,
    sourceType: r.source_type,
    sourceName: r.source_name,
    recordsImported: r.records_imported,
    importedAt: r.imported_at,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapCriterionRow(row: CriterionRow): WcagCriterion {
  return {
    id: row.id,
    guidelineId: row.guideline_id,
    name: row.name,
    level: row.level as 'A' | 'AA' | 'AAA',
    description: row.description,
    axeRules: row.axe_rules_csv ? row.axe_rules_csv.split(',') : [],
    category: row.category,
    helpUrl: row.help_url ?? '',
  };
}

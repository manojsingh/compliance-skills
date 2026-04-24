/**
 * PostgreSQL-specific async query layer for WCAG data
 * Use these functions when PostgreSQL primary mode is enabled
 */

import PostgresDatabase from './postgres.js';
import type { ComplianceLevel } from '@compliance-portal/shared';

// Export the same types as wcag-queries
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

// Read-only WCAG queries for PostgreSQL
export async function getAllPrinciplesPostgres(db: PostgresDatabase): Promise<WcagPrinciple[]> {
  const rows = await db.query<any>(
    'SELECT id, name, description FROM wcag_principles ORDER BY id'
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
  }));
}

export async function getAllGuidelinesPostgres(db: PostgresDatabase): Promise<WcagGuideline[]> {
  const rows = await db.query<any>(
    'SELECT id, principle_id, name, description FROM wcag_guidelines ORDER BY id'
  );
  return rows.map((row) => ({
    id: row.id,
    principleId: row.principle_id,
    name: row.name,
    description: row.description,
  }));
}

export async function getAllCriteriaPostgres(db: PostgresDatabase): Promise<WcagCriterion[]> {
  const rows = await db.query<any>(
    `SELECT id, guideline_id, name, level, description, category, help_url, axe_rules_csv
    FROM wcag_criteria ORDER BY id`
  );
  return rows.map((row) => ({
    id: row.id,
    guidelineId: row.guideline_id,
    name: row.name,
    level: row.level as 'A' | 'AA' | 'AAA',
    description: row.description,
    axeRules: row.axe_rules_csv ? row.axe_rules_csv.split(',') : [],
    category: row.category,
    helpUrl: row.help_url || '',
  }));
}

export async function getCriteriaByLevelPostgres(db: PostgresDatabase, level: ComplianceLevel): Promise<WcagCriterion[]> {
  const levelMap: Record<ComplianceLevel, string[]> = {
    A: ['A'],
    AA: ['A', 'AA'],
    AAA: ['A', 'AA', 'AAA'],
  };
  
  const levels = levelMap[level];
  const placeholders = levels.map((_, i) => `$${i + 1}`).join(',');
  const rows = await db.query<any>(
    `SELECT id, guideline_id, name, level, description, category, help_url, axe_rules_csv
    FROM wcag_criteria
    WHERE level IN (${placeholders})
    ORDER BY id`,
    levels
  );
  
  return rows.map((row) => ({
    id: row.id,
    guidelineId: row.guideline_id,
    name: row.name,
    level: row.level as 'A' | 'AA' | 'AAA',
    description: row.description,
    axeRules: row.axe_rules_csv ? row.axe_rules_csv.split(',') : [],
    category: row.category,
    helpUrl: row.help_url || '',
  }));
}

export async function getCriterionByIdPostgres(db: PostgresDatabase, id: string): Promise<WcagCriterion | null> {
  const row = await db.queryOne<any>(
    `SELECT id, guideline_id, name, level, description, category, help_url, axe_rules_csv
    FROM wcag_criteria
    WHERE id = $1`,
    [id]
  );
  if (!row) return null;

  return {
    id: row.id,
    guidelineId: row.guideline_id,
    name: row.name,
    level: row.level as 'A' | 'AA' | 'AAA',
    description: row.description,
    axeRules: row.axe_rules_csv ? row.axe_rules_csv.split(',') : [],
    category: row.category,
    helpUrl: row.help_url || '',
  };
}

export async function getAxeRulesForLevelPostgres(db: PostgresDatabase, level: ComplianceLevel): Promise<string[]> {
  const levelMap: Record<ComplianceLevel, string[]> = {
    A: ['A'],
    AA: ['A', 'AA'],
    AAA: ['A', 'AA', 'AAA'],
  };
  
  const levels = levelMap[level];
  const placeholders = levels.map((_, i) => `$${i + 1}`).join(',');
  const rows = await db.query<any>(
    `SELECT DISTINCT axe_rules_csv FROM wcag_criteria WHERE level IN (${placeholders})`,
    levels
  );

  const allRules = new Set<string>();
  for (const row of rows) {
    if (row.axe_rules_csv) {
      row.axe_rules_csv.split(',').forEach((rule: string) => allRules.add(rule.trim()));
    }
  }
  return Array.from(allRules);
}

export async function mapAxeRuleToCriterionPostgres(db: PostgresDatabase, ruleId: string): Promise<WcagCriterion | undefined> {
  const rows = await db.query<any>(
    `SELECT id, guideline_id, name, level, description, category, help_url, axe_rules_csv
    FROM wcag_criteria
    WHERE axe_rules_csv LIKE $1`,
    [`%${ruleId}%`]
  );

  if (!rows.length) return undefined;

  const row = rows[0];
  return {
    id: row.id,
    guidelineId: row.guideline_id,
    name: row.name,
    level: row.level as 'A' | 'AA' | 'AAA',
    description: row.description,
    axeRules: row.axe_rules_csv ? row.axe_rules_csv.split(',') : [],
    category: row.category,
    helpUrl: row.help_url || '',
  };
}

export async function getLevelStatsPostgres(db: PostgresDatabase, level: ComplianceLevel): Promise<{ total: number; automated: number; manual: number }> {
  const levelMap: Record<ComplianceLevel, string[]> = {
    A: ['A'],
    AA: ['A', 'AA'],
    AAA: ['A', 'AA', 'AAA'],
  };
  
  const levels = levelMap[level];
  const placeholders = levels.map((_, i) => `$${i + 1}`).join(',');
  const row = await db.queryOne<any>(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN axe_rules_csv IS NOT NULL AND axe_rules_csv != '' THEN 1 ELSE 0 END) as automated
    FROM wcag_criteria
    WHERE level IN (${placeholders})`,
    levels
  );

  const total = row?.total ?? 0;
  const automated = row?.automated ?? 0;

  return {
    total,
    automated,
    manual: total - automated,
  };
}

export async function getWcagStatsPostgres(db: PostgresDatabase): Promise<{
  principles: number;
  guidelines: number;
  criteria: { A: number; AA: number; AAA: number; total: number };
}> {
  const [principlesRow, guidelinesRow, criteriaRow] = await Promise.all([
    db.queryOne<any>('SELECT COUNT(*) as count FROM wcag_principles'),
    db.queryOne<any>('SELECT COUNT(*) as count FROM wcag_guidelines'),
    db.queryOne<any>(
      `SELECT 
        SUM(CASE WHEN level = 'A' THEN 1 ELSE 0 END) as a_count,
        SUM(CASE WHEN level = 'AA' THEN 1 ELSE 0 END) as aa_count,
        SUM(CASE WHEN level = 'AAA' THEN 1 ELSE 0 END) as aaa_count,
        COUNT(*) as total
      FROM wcag_criteria`
    ),
  ]);

  return {
    principles: principlesRow?.count ?? 0,
    guidelines: guidelinesRow?.count ?? 0,
    criteria: {
      A: criteriaRow?.a_count ?? 0,
      AA: criteriaRow?.aa_count ?? 0,
      AAA: criteriaRow?.aaa_count ?? 0,
      total: criteriaRow?.total ?? 0,
    },
  };
}

export async function getCriteriaByPrinciplePostgres(db: PostgresDatabase, level: ComplianceLevel): Promise<Record<string, WcagCriterion[]>> {
  const levelMap: Record<ComplianceLevel, string[]> = {
    A: ['A'],
    AA: ['A', 'AA'],
    AAA: ['A', 'AA', 'AAA'],
  };
  
  const levels = levelMap[level];
  const placeholders = levels.map((_, i) => `$${i + 1}`).join(',');
  const rows = await db.query<any>(
    `SELECT c.id, c.guideline_id, c.name, c.level, c.description, c.category, c.help_url, c.axe_rules_csv, g.principle_id
    FROM wcag_criteria c
    JOIN wcag_guidelines g ON c.guideline_id = g.id
    WHERE c.level IN (${placeholders})
    ORDER BY g.principle_id, c.id`,
    levels
  );

  const result: Record<string, WcagCriterion[]> = {};
  for (const row of rows) {
    const principleId = row.principle_id;
    if (!result[principleId]) {
      result[principleId] = [];
    }
    result[principleId].push({
      id: row.id,
      guidelineId: row.guideline_id,
      name: row.name,
      level: row.level as 'A' | 'AA' | 'AAA',
      description: row.description,
      axeRules: row.axe_rules_csv ? row.axe_rules_csv.split(',') : [],
      category: row.category,
      helpUrl: row.help_url || '',
    });
  }

  return result;
}

export async function getImportHistoryPostgres(db: PostgresDatabase): Promise<
  Array<{
    id: string;
    sourceType: string;
    sourceName: string;
    count: number;
    importedAt: string;
  }>
> {
  const rows = await db.query<any>(
    'SELECT id, source_type, source_name, count, imported_at FROM wcag_import_log ORDER BY imported_at DESC'
  );
  return rows.map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceName: row.source_name,
    count: row.count,
    importedAt: row.imported_at,
  }));
}

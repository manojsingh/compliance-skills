/**
 * Seed WCAG 2.1 reference data from the hardcoded source into SQLite.
 * Idempotent — safe to run multiple times (uses INSERT OR REPLACE).
 *
 * Accepts the db instance to avoid circular imports (index.ts → seed-wcag → wcag-queries → index.ts).
 */
import { v4 as uuidv4 } from 'uuid';
import { principles, guidelines, criteria } from '../data/wcag-guidelines.js';
import type { Database as DatabaseType } from 'better-sqlite3';

export function seedWcagData(db: DatabaseType): void {
  const upsertPrinciple = db.prepare(`
    INSERT OR REPLACE INTO wcag_principles (id, name, description)
    VALUES (@id, @name, @description)
  `);

  const upsertGuideline = db.prepare(`
    INSERT OR REPLACE INTO wcag_guidelines (id, principle_id, name, description)
    VALUES (@id, @principle_id, @name, @description)
  `);

  const upsertCriterion = db.prepare(`
    INSERT OR REPLACE INTO wcag_criteria (id, guideline_id, name, level, description, category, help_url, updated_at)
    VALUES (@id, @guideline_id, @name, @level, @description, @category, @help_url, datetime('now'))
  `);

  const deleteAxeRules = db.prepare(`DELETE FROM wcag_axe_rules WHERE criterion_id = ?`);
  const insertAxeRule = db.prepare(`
    INSERT OR IGNORE INTO wcag_axe_rules (criterion_id, axe_rule_id)
    VALUES (@criterion_id, @axe_rule_id)
  `);

  const insertImportLog = db.prepare(`
    INSERT INTO wcag_import_log (id, source_type, source_name, records_imported)
    VALUES (@id, @source_type, @source_name, @records_imported)
  `);

  const txn = db.transaction(() => {
    for (const p of principles) {
      upsertPrinciple.run(p);
    }
    for (const g of guidelines) {
      upsertGuideline.run({
        id: g.id,
        principle_id: g.principleId,
        name: g.name,
        description: g.description,
      });
    }
    for (const c of criteria) {
      upsertCriterion.run({
        id: c.id,
        guideline_id: c.guidelineId,
        name: c.name,
        level: c.level,
        description: c.description,
        category: 'accessibility',
        help_url: c.helpUrl,
      });

      deleteAxeRules.run(c.id);
      for (const ruleId of c.axeRules) {
        insertAxeRule.run({ criterion_id: c.id, axe_rule_id: ruleId });
      }
    }

    insertImportLog.run({
      id: uuidv4(),
      source_type: 'seed',
      source_name: 'built-in',
      records_imported: criteria.length,
    });
  });

  txn();

  console.log(
    `Seeded WCAG data: ${principles.length} principles, ${guidelines.length} guidelines, ${criteria.length} criteria`,
  );
}

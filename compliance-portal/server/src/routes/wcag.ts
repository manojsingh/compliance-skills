import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import {
  getAllPrinciples,
  getAllGuidelines,
  getAllCriteria,
  getCriteriaByLevel,
  getCriterionById,
  getWcagStats,
  getLevelStats,
  upsertPrinciple,
  upsertGuideline,
  upsertCriterion,
  deleteCriterion,
  getImportHistory,
  clearAllWcagData,
  logImport,
} from '../db/wcag-queries.js';
import { seedWcagData } from '../db/seed-wcag.js';
import db from '../db/index.js';
import { importFromFile, importToDatabase } from '../services/importer/index.js';
import type { ParseResult } from '../services/importer/index.js';
import type { ComplianceLevel } from '@compliance-portal/shared';
import PostgresDatabase from '../db/postgres.js';
import * as pgWcagQueries from '../db/wcag-queries-postgres.js';

// Detect PostgreSQL primary mode
const USE_POSTGRES_PRIMARY = Boolean(process.env.PGHOST || process.env.DATABASE_URL);
const pgDb = USE_POSTGRES_PRIMARY
  ? new PostgresDatabase({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'compliancedb',
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSLMODE === 'require',
      useAzureAuth: process.env.AZURE_POSTGRESQL_PASSWORDLESS === 'true',
    })
  : null;

const router = Router();

// ---------------------------------------------------------------------------
// Multer config for file uploads
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['application/pdf', 'text/csv', 'application/json', 'text/plain'];
    const allowedExt = /\.(pdf|csv|json)$/i;
    cb(null, allowedMimes.includes(file.mimetype) || allowedExt.test(file.originalname));
  },
});

// ---------------------------------------------------------------------------
// Read endpoints
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper: enrich criteria with principle/guideline names for the client
// ---------------------------------------------------------------------------

function enrichCriteria(rawCriteria: ReturnType<typeof getAllCriteria>) {
  const principles = getAllPrinciples();
  const guidelines = getAllGuidelines();

  const principleMap = new Map(principles.map((p) => [p.id, p.name]));
  const guidelineMap = new Map(guidelines.map((g) => [g.id, { name: g.name, principleId: g.principleId }]));

  return rawCriteria.map((c) => {
    const gl = guidelineMap.get(c.guidelineId);
    const principleId = gl?.principleId ?? c.guidelineId.split('.')[0] ?? '';
    return {
      id: c.id,
      criterionId: c.id,          // client calls this field "criterionId"
      name: c.name,
      level: c.level,
      principle: principleId,
      principleName: principleMap.get(principleId) ?? '',
      guideline: c.guidelineId,
      guidelineName: gl?.name ?? '',
      description: c.description,
      helpUrl: c.helpUrl ?? '',
      axeRules: c.axeRules,
    };
  });
}

async function enrichCriteriaAsync(rawCriteria: Awaited<ReturnType<typeof pgWcagQueries.getAllCriteriaPostgres>>) {
  const principles = await pgWcagQueries.getAllPrinciplesPostgres(pgDb!);
  const guidelines = await pgWcagQueries.getAllGuidelinesPostgres(pgDb!);

  const principleMap = new Map(principles.map((p) => [p.id, p.name]));
  const guidelineMap = new Map(guidelines.map((g) => [g.id, { name: g.name, principleId: g.principleId }]));

  return rawCriteria.map((c) => {
    const gl = guidelineMap.get(c.guidelineId);
    const principleId = gl?.principleId ?? c.guidelineId.split('.')[0] ?? '';
    return {
      id: c.id,
      criterionId: c.id,
      name: c.name,
      level: c.level,
      principle: principleId,
      principleName: principleMap.get(principleId) ?? '',
      guideline: c.guidelineId,
      guidelineName: gl?.name ?? '',
      description: c.description,
      helpUrl: c.helpUrl ?? '',
      axeRules: c.axeRules,
    };
  });
}

// GET /api/wcag/criteria — List all criteria (optionally filtered by level)
router.get(
  '/criteria',
  asyncHandler(async (req, res) => {
    const levelParam = (req.query.level as string)?.toUpperCase();
    if (levelParam && !['A', 'AA', 'AAA'].includes(levelParam)) {
      throw new ValidationError('Invalid level. Must be A, AA, or AAA.');
    }

    let raw;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      raw = levelParam
        ? await pgWcagQueries.getCriteriaByLevelPostgres(pgDb, levelParam as ComplianceLevel)
        : await pgWcagQueries.getAllCriteriaPostgres(pgDb);
      res.json(await enrichCriteriaAsync(raw));
    } else {
      raw = levelParam
        ? getCriteriaByLevel(levelParam as ComplianceLevel)
        : getAllCriteria();
      res.json(enrichCriteria(raw));
    }
  }),
);

// GET /api/wcag/criteria/:id — Single criterion
router.get(
  '/criteria/:id',
  asyncHandler(async (req, res) => {
    let criterion;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      criterion = await pgWcagQueries.getCriterionByIdPostgres(pgDb, req.params.id as string);
    } else {
      criterion = getCriterionById(req.params.id as string);
    }
    
    if (!criterion) throw new NotFoundError('Criterion');
    
    if (USE_POSTGRES_PRIMARY && pgDb) {
      res.json((await enrichCriteriaAsync([criterion]))[0]);
    } else {
      res.json(enrichCriteria([criterion])[0]);
    }
  }),
);

// GET /api/wcag/principles
router.get(
  '/principles',
  asyncHandler(async (_req, res) => {
    if (USE_POSTGRES_PRIMARY && pgDb) {
      res.json(await pgWcagQueries.getAllPrinciplesPostgres(pgDb));
    } else {
      res.json(getAllPrinciples());
    }
  }),
);

// GET /api/wcag/guidelines
router.get(
  '/guidelines',
  asyncHandler(async (_req, res) => {
    let guidelines;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      guidelines = await pgWcagQueries.getAllGuidelinesPostgres(pgDb);
    } else {
      guidelines = getAllGuidelines();
    }
    // Return shape the client expects: { id, name, principleId }
    res.json(guidelines.map((g) => ({ id: g.id, name: g.name, principleId: g.principleId })));
  }),
);

// GET /api/wcag/stats — Summary stats
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    let totalCriteria, aCount, aaCount, aaaCount, automated, manual;
    
    if (USE_POSTGRES_PRIMARY && pgDb) {
      const allCriteria = await pgWcagQueries.getAllCriteriaPostgres(pgDb);
      aCount = allCriteria.filter((c) => c.level === 'A').length;
      aaCount = allCriteria.filter((c) => c.level === 'AA').length;
      aaaCount = allCriteria.filter((c) => c.level === 'AAA').length;
      totalCriteria = allCriteria.length;
      automated = allCriteria.filter((c) => c.axeRules.length > 0).length;
      manual = totalCriteria - automated;
    } else {
      const allLevelA = getLevelStats('A');
      const allCriteria = getAllCriteria();
      aCount = allCriteria.filter((c) => c.level === 'A').length;
      aaCount = allCriteria.filter((c) => c.level === 'AA').length;
      aaaCount = allCriteria.filter((c) => c.level === 'AAA').length;
      totalCriteria = allCriteria.length;
      automated = allCriteria.filter((c) => c.axeRules.length > 0).length;
      manual = totalCriteria - automated;
    }

    res.json({
      totalCriteria,
      byLevel: { A: aCount, AA: aaCount, AAA: aaaCount },
      automated,
      manual,
    });
  }),
);

// ---------------------------------------------------------------------------
// Write endpoints
// ---------------------------------------------------------------------------

// POST /api/wcag/criteria — Add a new criterion manually
router.post(
  '/criteria',
  asyncHandler(async (req, res) => {
    // Client sends { criterionId, guideline, name, level, description, helpUrl, axeRules }
    // Server DB uses { id, guidelineId, ... }
    const { criterionId, id: bodyId, guideline, guidelineId: bodyGuidelineId, name, level, description, helpUrl, axeRules } = req.body;
    const id = criterionId ?? bodyId;
    const guidelineId = guideline ?? bodyGuidelineId;

    if (!id || !guidelineId || !name || !level) {
      throw new ValidationError('criterionId (or id), guideline (or guidelineId), name, and level are required.');
    }
    if (!['A', 'AA', 'AAA'].includes(level)) {
      throw new ValidationError('level must be A, AA, or AAA.');
    }

    upsertCriterion({ id, guidelineId, name, level, description: description || name, helpUrl, axeRules });
    logImport('manual', 'api', 1);

    const created = getCriterionById(id);
    res.status(201).json(enrichCriteria([created!])[0]);
  }),
);

// PUT /api/wcag/criteria/:id — Update a criterion
router.put(
  '/criteria/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const existing = getCriterionById(id);
    if (!existing) throw new NotFoundError('Criterion');

    // Client may send guideline or guidelineId
    const { name, level, description, helpUrl, axeRules, guideline, guidelineId: bodyGuidelineId } = req.body;
    const guidelineId = guideline ?? bodyGuidelineId;
    if (level && !['A', 'AA', 'AAA'].includes(level)) {
      throw new ValidationError('level must be A, AA, or AAA.');
    }

    upsertCriterion({
      id,
      guidelineId: guidelineId ?? existing.guidelineId,
      name: name ?? existing.name,
      level: level ?? existing.level,
      description: description ?? existing.description,
      helpUrl: helpUrl ?? existing.helpUrl,
      axeRules: axeRules ?? existing.axeRules,
    });

    res.json(enrichCriteria([getCriterionById(id)!])[0]);
  }),
);

// DELETE /api/wcag/criteria/:id
router.delete(
  '/criteria/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const existing = getCriterionById(id);
    if (!existing) throw new NotFoundError('Criterion');
    deleteCriterion(id);
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Import endpoints (two-step: preview → confirm)
// ---------------------------------------------------------------------------

// In-memory store for pending import previews (keyed by importId)
const pendingImports = new Map<string, { parseResult: ParseResult; mode: string }>();

// POST /api/wcag/import — Upload + preview
router.post(
  '/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded. Send a multipart field named "file".');
    }

    const mode = (req.body.mode as string) || 'merge';
    if (mode !== 'merge' && mode !== 'replace') {
      throw new ValidationError('mode must be "merge" or "replace".');
    }

    const parseResult = await importFromFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    // Generate an importId and stash the parse result for the confirm step
    const importId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingImports.set(importId, { parseResult, mode });
    // Auto-expire after 10 minutes
    setTimeout(() => pendingImports.delete(importId), 10 * 60 * 1000);

    // Determine per-criterion status (new vs existing)
    let existingCriteria;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      existingCriteria = await pgWcagQueries.getAllCriteriaPostgres(pgDb);
    } else {
      existingCriteria = getAllCriteria();
    }
    
    const existingIds = new Set(existingCriteria.map((c) => c.id));
    const criteriaPreview = parseResult.criteria.map((c) => ({
      criterionId: c.id,
      name: c.name,
      level: c.level,
      status: existingIds.has(c.id) ? 'update' : 'new',
    }));

    res.json({
      criteria: criteriaPreview,
      guidelines: parseResult.guidelines.length,
      principles: parseResult.principles.length,
      warnings: parseResult.warnings,
      importId,
    });
  }),
);

// POST /api/wcag/import/confirm — Commit a previously previewed import
router.post(
  '/import/confirm',
  asyncHandler(async (req, res) => {
    const { importId, mode: bodyMode } = req.body as { importId?: string; mode?: string; importData?: ParseResult };

    if (!importId || !pendingImports.has(importId)) {
      throw new ValidationError('Invalid or expired importId. Please re-upload the file.');
    }

    const { parseResult, mode: storedMode } = pendingImports.get(importId)!;
    pendingImports.delete(importId);

    const finalMode = (bodyMode ?? storedMode) as 'merge' | 'replace';
    if (finalMode !== 'merge' && finalMode !== 'replace') {
      throw new ValidationError('mode must be "merge" or "replace".');
    }

    const result = importToDatabase(parseResult, finalMode);
    res.json(result);
  }),
);

// ---------------------------------------------------------------------------
// Export endpoint
// ---------------------------------------------------------------------------

// GET /api/wcag/export?format=json|csv
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const format = (req.query.format as string)?.toLowerCase() || 'json';

    let principles, guidelines, criteria;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      principles = await pgWcagQueries.getAllPrinciplesPostgres(pgDb);
      guidelines = await pgWcagQueries.getAllGuidelinesPostgres(pgDb);
      criteria = await pgWcagQueries.getAllCriteriaPostgres(pgDb);
    } else {
      principles = getAllPrinciples();
      guidelines = getAllGuidelines();
      criteria = getAllCriteria();
    }

    if (format === 'csv') {
      const header = 'id,name,level,description,guideline_id,help_url,axe_rules';
      const rows = criteria.map((c) => {
        const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
        return [
          c.id,
          escape(c.name),
          c.level,
          escape(c.description),
          c.guidelineId,
          c.helpUrl || '',
          c.axeRules.join('|'),
        ].join(',');
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="wcag-export.csv"');
      res.send([header, ...rows].join('\n'));
      return;
    }

    // Default: JSON
    res.setHeader('Content-Disposition', 'attachment; filename="wcag-export.json"');
    res.json({ principles, guidelines, criteria });
  }),
);

// ---------------------------------------------------------------------------
// Import history
// ---------------------------------------------------------------------------

// GET /api/wcag/imports
router.get(
  '/imports',
  asyncHandler(async (_req, res) => {
    let history;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      history = await pgWcagQueries.getImportHistoryPostgres(pgDb);
    } else {
      history = getImportHistory();
    }
    
    // Map to the shape the client expects
    res.json(
      history.map((h: any) => ({
        id: h.id,
        date: h.importedAt,
        sourceType: h.sourceType,
        filename: h.sourceName ?? h.sourceType,
        recordsImported: h.count ?? h.recordsImported,
        mode: 'merge', // not stored, default to merge
      })),
    );
  }),
);

// ---------------------------------------------------------------------------
// Reset to built-in defaults
// ---------------------------------------------------------------------------

// POST /api/wcag/reset
router.post(
  '/reset',
  asyncHandler(async (_req, res) => {
    clearAllWcagData();
    seedWcagData(db);
    res.json({ message: 'WCAG data reset to built-in defaults.', stats: getWcagStats() });
  }),
);

export default router;

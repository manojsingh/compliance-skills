import { Router } from 'express';
import fs from 'fs';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { createReport, getReportPath, listReports } from '../services/reporter/index.js';
import { getScan, listScans } from '../db/queries.js';

const router = Router();

// POST /api/reports/generate — Generate a PDF report for a scan
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const { scanId, includeDetails } = req.body as {
      scanId?: string;
      includeDetails?: boolean;
    };
    if (!scanId || typeof scanId !== 'string') {
      throw new ValidationError('scanId is required');
    }

    const scan = getScan(scanId);
    if (!scan) throw new NotFoundError('Scan');
    if (scan.status !== 'completed') {
      throw new ValidationError('Scan must be completed before generating a report');
    }

    const reportId = await createReport(scanId, includeDetails ?? true);
    const reports = await listReports(scanId);
    const report = reports.find((r) => r.id === reportId);

    res.status(201).json({
      reportId,
      scanId,
      createdAt: report?.createdAt ?? new Date().toISOString(),
    });
  }),
);

// GET /api/reports — List reports, optionally filtered by ?scanId= or ?campaignId=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { scanId, campaignId } = req.query as {
      scanId?: string;
      campaignId?: string;
    };

    let scanIds: string[] = [];

    if (scanId) {
      scanIds = [scanId];
    } else if (campaignId) {
      const scans = listScans(campaignId);
      scanIds = scans.map((s) => s.id);
    } else {
      // All scans
      const scans = listScans();
      scanIds = scans.map((s) => s.id);
    }

    const allReports = (
      await Promise.all(
        scanIds.map(async (sid) => {
          const scan = getScan(sid);
          const rpts = await listReports(sid);
          return rpts.map((r) => ({
            ...r,
            campaignId: scan?.campaignId ?? '',
            scanStatus: scan?.status ?? '',
            scanCompletedAt: scan?.completedAt ?? null,
            scanSummary: scan?.summary ?? null,
          }));
        })
      )
    )
      .flat()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    res.json(allReports);
  }),
);

// GET /api/reports/:id/download — Stream the PDF file to the client
router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const filePath = await getReportPath(id);
    if (!filePath) throw new NotFoundError('Report');

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="compliance-report-${id}.pdf"`
    );
    res.setHeader('Content-Length', stat.size);

    fs.createReadStream(filePath).pipe(res);
  }),
);

export default router;

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

import campaignsRouter from './routes/campaigns.js';
import scansRouter from './routes/scans.js';
import dashboardRouter from './routes/dashboard.js';
import reportsRouter from './routes/reports.js';
import schedulerRouter from './routes/scheduler.js';
import wcagRouter from './routes/wcag.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { perfMonitor } from './utils/performance.js';
import { cache } from './utils/cache.js';

const app = express();

// Middleware
app.use(cors());

// Enable gzip/deflate compression for all responses
// Compresses JSON and HTML responses, significantly reducing bandwidth
app.use(compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  // Compression level (0-9, default 6). 6 is a good balance of speed vs size
  level: 6,
  // Only compress these MIME types
  filter: (req, res) => {
    // Don't compress if explicitly disabled
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Fallback to standard compression filter
    return compression.filter(req, res);
  }
}));

app.use(express.json());

// Structured request logging with performance tracking
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.request(req.method, req.originalUrl, res.statusCode, duration);
  });
  next();
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Performance and diagnostics endpoint (useful for monitoring)
app.get('/api/metrics', (_req: Request, res: Response) => {
  const health = perfMonitor.getHealthMetrics();
  const cacheStats = cache.getStats();
  
  res.json({
    health,
    cache: cacheStats,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/campaigns', campaignsRouter);
app.use('/api/scans', scansRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/wcag', wcagRouter);

// 404 handler for unknown API routes
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: 'API route not found',
      code: 'NOT_FOUND',
    },
  });
});

// Serve static files from the React app
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In production, client is at ../client (relative to dist/)
const clientPath = path.join(__dirname, '../client');

logger.debug('Client path configured', { clientPath });
app.use(express.static(clientPath));

// Handle React Router - send all non-API requests to index.html
app.get('*', (_req: Request, res: Response) => {
  const indexPath = path.join(clientPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error('Error serving index.html', err, { indexPath });
      res.status(404).json({ error: 'Frontend not found' });
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;

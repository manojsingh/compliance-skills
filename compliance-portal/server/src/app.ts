import express, { type Request, type Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import campaignsRouter from './routes/campaigns.js';
import scansRouter from './routes/scans.js';
import dashboardRouter from './routes/dashboard.js';
import reportsRouter from './routes/reports.js';
import schedulerRouter from './routes/scheduler.js';
import wcagRouter from './routes/wcag.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });
  next();
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

console.log('Client path:', clientPath);
app.use(express.static(clientPath));

// Handle React Router - send all non-API requests to index.html
app.get('*', (_req: Request, res: Response) => {
  const indexPath = path.join(clientPath, 'index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(404).json({ error: 'Frontend not found' });
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;

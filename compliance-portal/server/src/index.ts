import app from './app.js';
import { initializeDatabase } from './db/index.js';
import { scheduler } from './services/scheduler/index.js';

// Initialize database schema before starting the server
initializeDatabase();

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Initialize the scan scheduler after the server is ready
  scheduler.initialize().catch((err) => {
    console.error('Failed to initialize scheduler:', err);
  });
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down…`);
  scheduler.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

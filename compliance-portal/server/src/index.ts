import app from './app.js';
import { initializeDatabase } from './db/index-new.js';
import { scheduler } from './services/scheduler/index.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Check and install Playwright browsers if needed
async function ensurePlaywrightBrowsers() {
  try {
    // Check if Chromium browser exists
    const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH || 
      path.join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers');
    
    // Check for any chromium version directory (don't hardcode version)
    if (fs.existsSync(browserPath)) {
      const files = fs.readdirSync(browserPath);
      const hasChromium = files.some(f => f.startsWith('chromium'));
      
      if (hasChromium) {
        console.log('✓ Playwright browsers already installed');
        return;
      }
    }

    console.log('Installing Playwright Chromium browser...');
    console.log('This may take 2-3 minutes on first startup...');
    
    // Install Chromium browser
    execSync('npx playwright install chromium --with-deps', {
      stdio: 'inherit',
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserPath }
    });
    
    console.log('✓ Playwright browsers installed successfully');
  } catch (error) {
    console.error('Warning: Failed to install Playwright browsers:', error);
    console.error('Scans may not work properly');
    // Don't exit - let the app start anyway
  }
}

// Ensure Playwright browsers are available
await ensurePlaywrightBrowsers();

// Initialize database schema before starting the server
await initializeDatabase().catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

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

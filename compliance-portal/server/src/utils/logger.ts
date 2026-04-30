/**
 * Structured logging utility with log levels
 * Reduces noise in production and improves observability
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel;
  private isProduction: boolean;

  constructor() {
    // Parse log level from environment or default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.level = LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // In Azure, default to WARN to reduce noise
    if (process.env.WEBSITES_PORT && this.level > LogLevel.WARN) {
      this.level = LogLevel.WARN;
    }
  }

  /**
   * Format log message with timestamp and level
   */
  private format(level: string, message: string, meta?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (meta && Object.keys(meta).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(meta)}`;
    }
    
    return `${prefix} ${message}`;
  }

  /**
   * Log error messages (always shown)
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, any>): void {
    if (this.level < LogLevel.ERROR) return;
    
    const enrichedMeta = { ...meta };
    
    if (error instanceof Error) {
      enrichedMeta.error = {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack,
      };
    } else if (error) {
      enrichedMeta.error = error;
    }
    
    console.error(this.format('ERROR', message, enrichedMeta));
  }

  /**
   * Log warning messages
   */
  warn(message: string, meta?: Record<string, any>): void {
    if (this.level < LogLevel.WARN) return;
    console.warn(this.format('WARN', message, meta));
  }

  /**
   * Log informational messages
   */
  info(message: string, meta?: Record<string, any>): void {
    if (this.level < LogLevel.INFO) return;
    console.log(this.format('INFO', message, meta));
  }

  /**
   * Log debug messages (only in development or when LOG_LEVEL=DEBUG)
   */
  debug(message: string, meta?: Record<string, any>): void {
    if (this.level < LogLevel.DEBUG) return;
    console.log(this.format('DEBUG', message, meta));
  }

  /**
   * Log HTTP request (optimized format)
   */
  request(method: string, url: string, statusCode: number, duration: number): void {
    if (this.level < LogLevel.INFO) return;
    
    // In production, only log slow requests or errors
    if (this.isProduction) {
      if (statusCode >= 400 || duration > 1000) {
        this.info(`HTTP ${method} ${url}`, { statusCode, duration });
      }
    } else {
      this.info(`HTTP ${method} ${url}`, { statusCode, duration });
    }
  }

  /**
   * Log scan progress (only important milestones)
   */
  scanProgress(scanId: string, stage: string, meta?: Record<string, any>): void {
    this.info(`[Scan ${scanId}] ${stage}`, meta);
  }

  /**
   * Log database operations (debug only)
   */
  db(operation: string, meta?: Record<string, any>): void {
    this.debug(`[DB] ${operation}`, meta);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, meta?: Record<string, any>): void {
    // Only log slow operations in production
    if (this.isProduction && duration < 1000) return;
    
    this.info(`[Performance] ${operation}`, { duration, ...meta });
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set log level programmatically
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Singleton instance
export const logger = new Logger();

// Log initialization
logger.info('Logger initialized', {
  level: LogLevel[logger.getLevel()],
  environment: process.env.NODE_ENV,
  isAzure: !!process.env.WEBSITES_PORT,
});

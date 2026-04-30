/**
 * Performance monitoring utilities
 * Track operation timings and resource usage
 */

import { logger } from './logger.js';

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 100; // Keep last 100 metrics in memory
  private timers = new Map<string, number>();

  /**
   * Start a timer for an operation
   */
  start(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * End a timer and record the metric
   */
  end(name: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      logger.warn('Performance timer not found', { name });
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    this.recordMetric({
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    // Log slow operations
    if (duration > 1000) {
      logger.performance(name, duration, metadata);
    }

    return duration;
  }

  /**
   * Measure an async operation
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        name,
        duration,
        timestamp: Date.now(),
        metadata,
      });

      // Log slow operations
      if (duration > 1000) {
        logger.performance(name, duration, metadata);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Performance: ${name} failed after ${duration}ms`, error as Error, metadata);
      throw error;
    }
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Get statistics for a specific operation
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return null;

    const durations = filtered.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);

    return {
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      avg: sum / durations.length,
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
    };
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
  } {
    const usage = process.memoryUsage();
    return {
      rss: this.formatBytes(usage.rss),
      heapTotal: this.formatBytes(usage.heapTotal),
      heapUsed: this.formatBytes(usage.heapUsed),
      external: this.formatBytes(usage.external),
    };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  /**
   * Get system health metrics
   */
  getHealthMetrics(): {
    memory: {
      rss: string;
      heapTotal: string;
      heapUsed: string;
      external: string;
    };
    uptime: number;
    activeTimers: number;
    recentMetrics: number;
  } {
    return {
      memory: this.getMemoryUsage(),
      uptime: process.uptime(),
      activeTimers: this.timers.size,
      recentMetrics: this.metrics.length,
    };
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

// Log memory usage every 5 minutes
setInterval(() => {
  const memory = perfMonitor.getMemoryUsage();
  logger.debug('Memory usage', memory);
}, 5 * 60 * 1000);

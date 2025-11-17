/**
 * Enhanced Structured Logger
 * Provides comprehensive logging with context, metrics, and error tracking
 */

import { getErrorMetadata } from './error-codes.js';

export class EnhancedLogger {
  constructor(config = {}) {
    this.level = config.level || 'INFO';
    this.enableMetrics = config.enableMetrics !== false;
    this.enableConsole = config.enableConsole !== false;
    this.sessionId = this._generateSessionId();
    this.metrics = new Map();
    this.errorBuffer = [];
    this.maxErrorBuffer = config.maxErrorBuffer || 100;

    this._levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };
  }

  /**
   * Generate unique session ID
   */
  _generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format log entry with full context
   */
  _formatEntry(level, message, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      sessionId: this.sessionId,
      context: {
        ...context,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      },
    };
  }

  /**
   * Check if message should be logged
   */
  _shouldLog(level) {
    return this._levels[level] >= this._levels[this.level];
  }

  /**
   * Output to console if enabled
   */
  _outputToConsole(level, entry) {
    if (!this.enableConsole) return;

    const timestamp = entry.timestamp.split('T')[1]?.slice(0, 12) || '00:00:00.000';
    const prefix = `[${timestamp}] [${level}]`;

    const consoleMethod = {
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
    }[level] || 'log';

    if (Object.keys(entry.context).length > 2) {
      console[consoleMethod](prefix, entry.message, entry.context);
    } else {
      console[consoleMethod](prefix, entry.message);
    }
  }

  /**
   * Send to error monitoring service
   */
  _sendToMonitoring(entry) {
    // Hook for error monitoring integration
    if (typeof window !== 'undefined' && window.__errorMonitor) {
      try {
        window.__errorMonitor.captureLog(entry);
      } catch (err) {
        // Silently fail to avoid infinite loop
      }
    }
  }

  /**
   * Log debug message
   */
  debug(message, context = {}) {
    if (!this._shouldLog('DEBUG')) return;

    const entry = this._formatEntry('DEBUG', message, context);
    this._outputToConsole('DEBUG', entry);
    this._sendToMonitoring(entry);
  }

  /**
   * Log info message
   */
  info(message, context = {}) {
    if (!this._shouldLog('INFO')) return;

    const entry = this._formatEntry('INFO', message, context);
    this._outputToConsole('INFO', entry);
    this._sendToMonitoring(entry);
  }

  /**
   * Log warning message
   */
  warn(message, context = {}) {
    if (!this._shouldLog('WARN')) return;

    const entry = this._formatEntry('WARN', message, context);
    this._outputToConsole('WARN', entry);
    this._sendToMonitoring(entry);
  }

  /**
   * Log error with full details
   */
  error(message, error = null, context = {}) {
    if (!this._shouldLog('ERROR')) return;

    const errorContext = {
      ...context,
    };

    if (error) {
      errorContext.error = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: error.code,
        userMessage: error.userMessage,
        recoverySuggestion: error.recoverySuggestion,
        severity: error.severity,
        recoverable: error.recoverable,
      };

      // If error has a code, add metadata
      if (error.code) {
        const metadata = getErrorMetadata(error.code);
        errorContext.metadata = metadata;
      }
    }

    const entry = this._formatEntry('ERROR', message, errorContext);
    this._outputToConsole('ERROR', entry);
    this._sendToMonitoring(entry);

    // Add to error buffer
    this.errorBuffer.push(entry);
    if (this.errorBuffer.length > this.maxErrorBuffer) {
      this.errorBuffer.shift();
    }
  }

  /**
   * Record performance metric
   */
  recordMetric(name, value, tags = {}) {
    if (!this.enableMetrics) return;

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name).push({
      value,
      tags,
      timestamp: Date.now(),
    });

    // Keep only last 1000 entries per metric
    const entries = this.metrics.get(name);
    if (entries.length > 1000) {
      entries.shift();
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(name) {
    const startTime = performance.now();
    const recordMetric = this.recordMetric.bind(this);

    return {
      name,
      startTime,
      end: (tags = {}) => {
        const duration = performance.now() - startTime;
        recordMetric(name, duration, tags);
        return duration;
      },
    };
  }

  /**
   * Get metric statistics
   */
  getMetricStats(name) {
    const entries = this.metrics.get(name);
    if (!entries || entries.length === 0) {
      return null;
    }

    const values = entries.map(e => e.value);
    const sorted = [...values].sort((a, b) => a - b);

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const result = {};
    for (const [name, entries] of this.metrics.entries()) {
      result[name] = {
        entries: entries.slice(-10), // Last 10 entries
        stats: this.getMetricStats(name),
      };
    }
    return result;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count = 10) {
    return this.errorBuffer.slice(-count);
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics.clear();
  }

  /**
   * Clear error buffer
   */
  clearErrors() {
    this.errorBuffer = [];
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (this._levels.hasOwnProperty(level)) {
      this.level = level;
      this.info(`Log level changed to ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}`);
    }
  }

  /**
   * Get current log level
   */
  getLevel() {
    return this.level;
  }

  /**
   * Export logs for debugging
   */
  exportLogs() {
    return {
      sessionId: this.sessionId,
      level: this.level,
      errors: this.errorBuffer,
      metrics: this.getAllMetrics(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Create singleton instance
export const enhancedLogger = new EnhancedLogger({
  level: 'INFO',
  enableMetrics: true,
  enableConsole: true,
});

// Export for console access
if (typeof window !== 'undefined') {
  window.__logger = enhancedLogger;
}

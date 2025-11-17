/**
 * Global Error Boundary Handler
 * Catches and handles all unhandled errors and promise rejections
 */

import { enhancedLogger } from './enhanced-logger.js';
import { ERROR_CODES, createError } from './error-codes.js';

export class GlobalErrorHandler {
  constructor(config = {}) {
    this.logger = config.logger || enhancedLogger;
    this.showUserNotification = config.showUserNotification || this._defaultNotification;
    this.onError = config.onError || null;
    this.errorCount = 0;
    this.errorRateLimit = config.errorRateLimit || 10; // Max errors per minute
    this.errorTimestamps = [];
    this.initialized = false;
  }

  /**
   * Initialize global error handlers
   */
  init() {
    if (this.initialized) {
      this.logger.warn('GlobalErrorHandler already initialized');
      return;
    }

    // Handle uncaught errors
    window.addEventListener('error', this._handleError.bind(this));

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', this._handleRejection.bind(this));

    // Handle resource loading errors (images, scripts, etc.)
    window.addEventListener('error', this._handleResourceError.bind(this), true);

    this.initialized = true;
    this.logger.info('Global error handler initialized');
  }

  /**
   * Handle synchronous errors
   */
  _handleError(event) {
    // Ignore resource loading errors (handled separately)
    if (event.target !== window) {
      return;
    }

    const error = event.error || new Error(event.message);

    // Add error code if not present
    if (!error.code) {
      error.code = ERROR_CODES.SYS_UNKNOWN_ERROR;
    }

    const context = {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: 'error',
    };

    this._processError(error, context);

    // Prevent default browser error handling if we're handling it
    if (this._shouldSuppressError(error)) {
      event.preventDefault();
    }
  }

  /**
   * Handle unhandled promise rejections
   */
  _handleRejection(event) {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    // Add error code if not present
    if (!error.code) {
      error.code = ERROR_CODES.SYS_UNKNOWN_ERROR;
    }

    const context = {
      promise: event.promise,
      type: 'unhandledRejection',
    };

    this._processError(error, context);

    // Prevent default browser error handling
    event.preventDefault();
  }

  /**
   * Handle resource loading errors
   */
  _handleResourceError(event) {
    // Only handle actual resource loading errors
    if (event.target === window || !event.target.src) {
      return;
    }

    const resourceType = event.target.tagName?.toLowerCase() || 'resource';
    const resourceSrc = event.target.src || event.target.href;

    this.logger.warn('Resource loading failed', {
      type: resourceType,
      src: resourceSrc,
    });

    // Don't show notifications for resource errors (too noisy)
    // Just log them
  }

  /**
   * Process and log error
   */
  _processError(error, context = {}) {
    // Check rate limiting
    if (!this._checkRateLimit()) {
      this.logger.warn('Error rate limit exceeded, suppressing notification');
      return;
    }

    // Increment error count
    this.errorCount++;

    // Log error with full context
    this.logger.error('Unhandled error caught', error, context);

    // Show user notification
    this._notifyUser(error, context);

    // Call custom error handler if provided
    if (this.onError) {
      try {
        this.onError(error, context);
      } catch (err) {
        this.logger.error('Error in custom error handler', err);
      }
    }

    // Send to monitoring service
    this._sendToMonitoring(error, context);
  }

  /**
   * Check error rate limiting
   */
  _checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old timestamps
    this.errorTimestamps = this.errorTimestamps.filter(t => t > oneMinuteAgo);

    // Check if we've exceeded the limit
    if (this.errorTimestamps.length >= this.errorRateLimit) {
      return false;
    }

    // Add current timestamp
    this.errorTimestamps.push(now);
    return true;
  }

  /**
   * Determine if error should suppress default handling
   */
  _shouldSuppressError(error) {
    // Suppress errors that we can handle gracefully
    return error.recoverable === true;
  }

  /**
   * Notify user about error
   */
  _notifyUser(error, context) {
    // Get user-friendly message
    const userMessage = error.userMessage || error.message;
    const recoverySuggestion = error.recoverySuggestion || '';

    // Determine severity for notification
    const severity = error.severity || 'error';

    // Show notification
    this.showUserNotification(userMessage, severity, {
      recoverySuggestion,
      errorCode: error.code,
      context,
    });
  }

  /**
   * Default notification implementation
   */
  _defaultNotification(message, severity, details) {
    // Try to use application's showStatus function if available
    if (typeof window !== 'undefined' && typeof window.showStatus === 'function') {
      window.showStatus(message, severity, 5000);
    } else {
      // Fallback to console
      console.error(`[${severity.toUpperCase()}] ${message}`);
      if (details.recoverySuggestion) {
        console.info(`Recovery: ${details.recoverySuggestion}`);
      }
    }
  }

  /**
   * Send error to monitoring service
   */
  _sendToMonitoring(error, context) {
    if (typeof window !== 'undefined' && window.__errorMonitor) {
      try {
        window.__errorMonitor.captureError({
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
            code: error.code,
          },
          context,
          timestamp: Date.now(),
          sessionId: this.logger.sessionId,
        });
      } catch (err) {
        // Silently fail
        this.logger.debug('Failed to send error to monitoring', { error: err.message });
      }
    }
  }

  /**
   * Manually report an error
   */
  reportError(error, context = {}) {
    this._processError(error, { ...context, manual: true });
  }

  /**
   * Wrap a function with error handling
   */
  wrapFunction(fn, context = {}) {
    return (...args) => {
      try {
        const result = fn(...args);

        // Handle promise returns
        if (result && typeof result.then === 'function') {
          return result.catch(error => {
            this._processError(error, { ...context, async: true });
            throw error;
          });
        }

        return result;
      } catch (error) {
        this._processError(error, { ...context, sync: true });
        throw error;
      }
    };
  }

  /**
   * Wrap an async function with error handling
   */
  wrapAsync(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this._processError(error, { ...context, async: true });
        throw error;
      }
    };
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      totalErrors: this.errorCount,
      recentErrors: this.logger.getRecentErrors(),
      errorRate: this.errorTimestamps.length,
      rateLimitActive: this.errorTimestamps.length >= this.errorRateLimit,
    };
  }

  /**
   * Reset error counters
   */
  reset() {
    this.errorCount = 0;
    this.errorTimestamps = [];
    this.logger.clearErrors();
  }

  /**
   * Destroy error handler
   */
  destroy() {
    if (!this.initialized) return;

    window.removeEventListener('error', this._handleError);
    window.removeEventListener('unhandledrejection', this._handleRejection);
    window.removeEventListener('error', this._handleResourceError, true);

    this.initialized = false;
    this.logger.info('Global error handler destroyed');
  }
}

// Create and export singleton instance
export const globalErrorHandler = new GlobalErrorHandler();

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      globalErrorHandler.init();
    });
  } else {
    globalErrorHandler.init();
  }

  // Export for console access
  window.__errorHandler = globalErrorHandler;
}

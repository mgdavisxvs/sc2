/**
 * Error Monitoring Service Integration
 * Provides integration with external error monitoring services (Sentry, Rollbar, custom)
 */

import { enhancedLogger } from './enhanced-logger.js';

export class ErrorMonitor {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.endpoint = config.endpoint || null;
    this.apiKey = config.apiKey || null;
    this.environment = config.environment || 'production';
    this.release = config.release || 'unknown';
    this.sampleRate = config.sampleRate || 1.0; // 1.0 = 100% of errors
    this.logger = config.logger || enhancedLogger;
    this.provider = config.provider || 'custom'; // 'sentry', 'rollbar', 'custom'
    this.queue = [];
    this.maxQueueSize = config.maxQueueSize || 50;
    this.flushInterval = config.flushInterval || 10000; // 10 seconds
    this.flushTimer = null;
    this.sessionId = this._generateSessionId();
  }

  /**
   * Generate unique session ID
   */
  _generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize error monitoring
   */
  init() {
    if (!this.enabled) {
      this.logger.info('Error monitoring disabled');
      return;
    }

    // Start flush timer
    this._startFlushTimer();

    // Add to window for global access
    if (typeof window !== 'undefined') {
      window.__errorMonitor = this;
    }

    this.logger.info('Error monitoring initialized', {
      provider: this.provider,
      environment: this.environment,
      release: this.release,
    });
  }

  /**
   * Start automatic queue flushing
   */
  _startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Capture an error
   */
  captureError(errorData) {
    if (!this.enabled) return;

    // Sample rate check
    if (Math.random() > this.sampleRate) {
      return;
    }

    // Enrich error data
    const enrichedData = this._enrichErrorData(errorData);

    // Add to queue
    this.queue.push(enrichedData);

    // Flush if queue is full
    if (this.queue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  /**
   * Capture a log entry
   */
  captureLog(logEntry) {
    if (!this.enabled) return;

    // Only capture errors and warnings
    if (logEntry.level !== 'ERROR' && logEntry.level !== 'WARN') {
      return;
    }

    this.captureError({
      error: {
        message: logEntry.message,
        name: logEntry.level,
      },
      context: logEntry.context,
      timestamp: Date.parse(logEntry.timestamp),
      sessionId: logEntry.sessionId,
    });
  }

  /**
   * Enrich error data with additional context
   */
  _enrichErrorData(errorData) {
    return {
      ...errorData,
      environment: this.environment,
      release: this.release,
      sessionId: this.sessionId,
      timestamp: errorData.timestamp || Date.now(),
      user: this._getUserContext(),
      device: this._getDeviceContext(),
      breadcrumbs: this._getBreadcrumbs(),
    };
  }

  /**
   * Get user context (if available)
   */
  _getUserContext() {
    // Override this method to provide user information
    return {
      id: 'anonymous',
      sessionId: this.sessionId,
    };
  }

  /**
   * Get device/browser context
   */
  _getDeviceContext() {
    if (typeof window === 'undefined') {
      return {};
    }

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screen: {
        width: screen.width,
        height: screen.height,
      },
      url: window.location.href,
      referrer: document.referrer,
    };
  }

  /**
   * Get breadcrumbs (navigation history)
   */
  _getBreadcrumbs() {
    // Simple implementation - can be extended
    return [];
  }

  /**
   * Flush error queue to monitoring service
   */
  async flush() {
    if (this.queue.length === 0) {
      return;
    }

    const errors = [...this.queue];
    this.queue = [];

    try {
      await this._sendToProvider(errors);
      this.logger.debug(`Flushed ${errors.length} errors to monitoring service`);
    } catch (error) {
      this.logger.error('Failed to send errors to monitoring service', error);

      // Re-queue errors if flush failed (up to max queue size)
      this.queue = [...errors.slice(-this.maxQueueSize), ...this.queue];
    }
  }

  /**
   * Send errors to monitoring provider
   */
  async _sendToProvider(errors) {
    switch (this.provider) {
      case 'sentry':
        return this._sendToSentry(errors);
      case 'rollbar':
        return this._sendToRollbar(errors);
      case 'custom':
        return this._sendToCustomEndpoint(errors);
      default:
        this.logger.warn(`Unknown error monitoring provider: ${this.provider}`);
    }
  }

  /**
   * Send to Sentry
   */
  async _sendToSentry(errors) {
    // Sentry integration - requires Sentry SDK
    if (typeof window !== 'undefined' && window.Sentry) {
      errors.forEach(errorData => {
        window.Sentry.captureException(errorData.error, {
          contexts: errorData.context,
          tags: {
            environment: errorData.environment,
            release: errorData.release,
          },
          user: errorData.user,
        });
      });
    } else {
      this.logger.warn('Sentry SDK not loaded');
    }
  }

  /**
   * Send to Rollbar
   */
  async _sendToRollbar(errors) {
    // Rollbar integration - requires Rollbar SDK
    if (typeof window !== 'undefined' && window.Rollbar) {
      errors.forEach(errorData => {
        window.Rollbar.error(errorData.error, {
          context: errorData.context,
          environment: errorData.environment,
          release: errorData.release,
          person: errorData.user,
        });
      });
    } else {
      this.logger.warn('Rollbar SDK not loaded');
    }
  }

  /**
   * Send to custom endpoint
   */
  async _sendToCustomEndpoint(errors) {
    if (!this.endpoint) {
      this.logger.debug('No custom endpoint configured, skipping error reporting');
      return;
    }

    const payload = {
      errors,
      environment: this.environment,
      release: this.release,
      timestamp: Date.now(),
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error monitoring endpoint returned ${response.status}`);
    }
  }

  /**
   * Set user context
   */
  setUser(user) {
    this._userContext = user;
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb) {
    // Simple implementation - can be extended
    if (!this._breadcrumbs) {
      this._breadcrumbs = [];
    }

    this._breadcrumbs.push({
      ...breadcrumb,
      timestamp: Date.now(),
    });

    // Keep only last 50 breadcrumbs
    if (this._breadcrumbs.length > 50) {
      this._breadcrumbs.shift();
    }
  }

  /**
   * Test error monitoring
   */
  test() {
    this.captureError({
      error: {
        message: 'Test error from error monitoring system',
        name: 'TestError',
        stack: new Error().stack,
      },
      context: {
        test: true,
      },
    });

    this.logger.info('Test error sent to monitoring service');
  }

  /**
   * Get monitoring stats
   */
  getStats() {
    return {
      enabled: this.enabled,
      provider: this.provider,
      environment: this.environment,
      release: this.release,
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      sampleRate: this.sampleRate,
      sessionId: this.sessionId,
    };
  }

  /**
   * Destroy error monitor
   */
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining errors
    this.flush();

    this.logger.info('Error monitoring destroyed');
  }
}

// Create singleton instance with default config
export const errorMonitor = new ErrorMonitor({
  enabled: false, // Disabled by default - enable via config
  provider: 'custom',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.APP_VERSION || 'unknown',
  sampleRate: 1.0,
});

// Export for console access
if (typeof window !== 'undefined') {
  window.__errorMonitor = errorMonitor;
}

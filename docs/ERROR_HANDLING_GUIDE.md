# Error Handling Guide

> **Complete reference for the SC2 Build Lab enterprise-grade error handling system**

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Components](#components)
5. [Error Codes Reference](#error-codes-reference)
6. [Enhanced Logger](#enhanced-logger)
7. [Global Error Handler](#global-error-handler)
8. [Error Monitoring](#error-monitoring)
9. [Best Practices](#best-practices)
10. [Migration Guide](#migration-guide)
11. [Testing](#testing)
12. [Examples](#examples)

---

## Overview

The SC2 Build Lab error handling system provides enterprise-grade error management with:

- **Standardized Error Codes**: Consistent error identification across the application
- **Structured Logging**: Context-aware logging with metrics and performance tracking
- **Global Error Boundary**: Catches all unhandled errors and promise rejections
- **Error Monitoring**: Integration with external monitoring services (Sentry, Rollbar, custom)
- **User-Friendly Messages**: Automatic translation of technical errors to user-friendly messages
- **Recovery Suggestions**: Actionable guidance for error resolution
- **Performance Metrics**: Built-in tracking of error rates and patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Code                         │
└──────────────┬──────────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────────┐
│                  Global Error Handler                         │
│  • Catches unhandled errors                                  │
│  • Rate limiting                                             │
│  • User notifications                                        │
└──────────────┬───────────────────────────────────────────────┘
               │
               ├─────────────┬─────────────┬──────────────┐
               ↓             ↓             ↓              ↓
         ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ Enhanced │  │  Error   │  │  Error   │  │   User   │
         │  Logger  │  │  Codes   │  │ Monitor  │  │   UI     │
         └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## Quick Start

### 1. Using Error Codes

```javascript
import { ERROR_CODES, createError } from './core/error-codes.js';

// Create a standardized error
const error = createError(
  ERROR_CODES.DATA_LOAD_INVALID_FORMAT,
  'Failed to parse JSON file',
  { filename: 'sc2units.json', line: 42 }
);

throw error;
```

### 2. Structured Logging

```javascript
import { enhancedLogger } from './core/enhanced-logger.js';

// Log with context
enhancedLogger.info('Build order saved', {
  buildId: 123,
  race: 'protoss',
  itemCount: 15
});

// Log errors with full details
enhancedLogger.error('Failed to load data', error, {
  code: ERROR_CODES.DATA_LOAD_NETWORK_ERROR,
  url: 'https://api.example.com/data'
});

// Track performance
const timer = enhancedLogger.startTimer('buildCalculation');
// ... do work ...
timer.end({ complexity: 'high' });
```

### 3. Error Monitoring

```javascript
import { errorMonitor } from './core/error-monitor.js';

// Configure error monitoring
errorMonitor.enabled = true;
errorMonitor.endpoint = 'https://your-monitoring-service.com/errors';
errorMonitor.apiKey = 'your-api-key';
errorMonitor.init();

// Manually capture an error
errorMonitor.captureError({
  error: new Error('Something went wrong'),
  context: { userId: 123, action: 'saveData' }
});
```

---

## Architecture

### Design Principles

1. **Fail-Safe**: Error handling must never cause errors
2. **User-Centric**: Always provide user-friendly messages
3. **Developer-Friendly**: Include detailed context for debugging
4. **Performance**: Minimal overhead in production
5. **Observable**: Comprehensive metrics and monitoring

### Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                       Error Flow                             │
└─────────────────────────────────────────────────────────────┘

1. Error Occurs
   ↓
2. Error Code Assigned (if not present)
   ↓
3. Enhanced Logger Records Error
   ↓
4. Global Error Handler Processes
   ↓
5. User Notification Displayed
   ↓
6. Error Sent to Monitoring Service
   ↓
7. Metrics Updated
```

---

## Components

### 1. Error Codes (`error-codes.js`)

Provides standardized error codes following the format: `[COMPONENT]-[CATEGORY]-[NUMBER]`

**Categories:**
- `DATA-LOAD-xxx`: Data loading errors
- `DATA-VAL-xxx`: Data validation errors
- `DATA-IMP-xxx`: Data import errors
- `BUILD-xxx`: Build order errors
- `UI-xxx`: User interface errors
- `VIZ-xxx`: Visualization errors
- `STORE-xxx`: Storage errors
- `ALGO-xxx`: Algorithm errors
- `WORK-xxx`: Web worker errors
- `NET-xxx`: Network errors
- `SYS-xxx`: System errors

### 2. Enhanced Logger (`enhanced-logger.js`)

Advanced logging with:
- Structured log entries with full context
- Performance metrics tracking
- Error buffering
- Session tracking
- Multiple log levels (DEBUG, INFO, WARN, ERROR)

### 3. Global Error Handler (`global-error-handler.js`)

Catches all unhandled errors:
- Synchronous errors (`window.error`)
- Asynchronous errors (`unhandledrejection`)
- Resource loading errors
- Rate limiting (prevents error flooding)
- Automatic user notifications
- Integration with monitoring

### 4. Error Monitor (`error-monitor.js`)

External monitoring integration:
- Supports Sentry, Rollbar, custom endpoints
- Automatic batching and flushing
- Sample rate configuration
- Session tracking
- Device/browser context

---

## Error Codes Reference

### Data Loading Errors

| Code | Message | Recoverable | User Message |
|------|---------|-------------|--------------|
| DATA-LOAD-001 | File not found | No | The requested file could not be found |
| DATA-LOAD-002 | Invalid file format | No | The file format is not supported |
| DATA-LOAD-003 | Failed to parse data | No | The data file contains errors |
| DATA-LOAD-004 | Network request failed | Yes | Failed to load data due to a network error |
| DATA-LOAD-005 | Request timeout | Yes | The request took too long to complete |
| DATA-LOAD-006 | CORS error | No | Cross-origin request blocked |

### Data Validation Errors

| Code | Message | Recoverable | User Message |
|------|---------|-------------|--------------|
| DATA-VAL-001 | Missing required field | No | Required data field is missing |
| DATA-VAL-002 | Invalid data type | No | Data type mismatch |
| DATA-VAL-003 | Constraint violation | No | Data constraint violated |
| DATA-VAL-004 | Schema mismatch | No | Data schema does not match expected format |
| DATA-VAL-005 | Duplicate key | No | Duplicate key found |

### Build Order Errors

| Code | Message | Recoverable | User Message |
|------|---------|-------------|--------------|
| BUILD-001 | Missing prerequisites | Yes | Required prerequisites are missing |
| BUILD-002 | Invalid build order | No | Build order is invalid |
| BUILD-003 | Insufficient resources | Yes | Not enough resources |
| BUILD-004 | Save failed | Yes | Failed to save build |
| BUILD-005 | Load failed | Yes | Failed to load build |

[See full reference in `src/core/error-codes.js`]

---

## Enhanced Logger

### Basic Usage

```javascript
import { enhancedLogger } from './core/enhanced-logger.js';

// Different log levels
enhancedLogger.debug('Detailed debug info', { variable: value });
enhancedLogger.info('Operation completed', { result: data });
enhancedLogger.warn('Potential issue detected', { issue: description });
enhancedLogger.error('Operation failed', error, { context: details });
```

### Performance Tracking

```javascript
// Method 1: Using timer
const timer = enhancedLogger.startTimer('dataImport');
await importData();
const duration = timer.end({ source: 'file', size: 1024 });

// Method 2: Direct metric recording
enhancedLogger.recordMetric('apiLatency', 150, { endpoint: '/api/data' });

// Get metric statistics
const stats = enhancedLogger.getMetricStats('dataImport');
console.log(stats);
// {
//   count: 50,
//   min: 120,
//   max: 450,
//   avg: 250,
//   median: 240,
//   p95: 380,
//   p99: 425
// }
```

### Error Logging

```javascript
import { ERROR_CODES, createError } from './core/error-codes.js';

try {
  await loadData();
} catch (err) {
  // Create standardized error with code
  const error = createError(
    ERROR_CODES.DATA_LOAD_NETWORK_ERROR,
    'Failed to fetch data from server',
    { url, statusCode: 500 }
  );

  // Log with full context
  enhancedLogger.error('Data load failed', error, {
    operation: 'loadData',
    retryCount: 3,
    timestamp: Date.now()
  });

  throw error;
}
```

### Configuration

```javascript
// Change log level
enhancedLogger.setLevel('DEBUG'); // DEBUG, INFO, WARN, ERROR

// Get current level
const level = enhancedLogger.getLevel();

// Export logs for debugging
const logs = enhancedLogger.exportLogs();
console.log(logs);
// {
//   sessionId: '1234567890-abc123',
//   level: 'INFO',
//   errors: [...],
//   metrics: {...},
//   timestamp: '2025-01-15T10:30:00.000Z'
// }
```

---

## Global Error Handler

### Automatic Initialization

The global error handler is automatically initialized when the application starts:

```javascript
// In main.js
import { globalErrorHandler } from './core/global-error-handler.js';

globalErrorHandler.init();
```

### Manual Error Reporting

```javascript
// Report errors manually
globalErrorHandler.reportError(error, {
  component: 'BuildOrder',
  action: 'save',
  userId: 123
});
```

### Function Wrapping

```javascript
// Wrap functions for automatic error handling
const safeFunction = globalErrorHandler.wrapFunction(
  riskyFunction,
  { component: 'DataLoader' }
);

// Wrap async functions
const safeAsyncFunction = globalErrorHandler.wrapAsync(
  riskyAsyncFunction,
  { component: 'API' }
);
```

### Error Statistics

```javascript
// Get error statistics
const stats = globalErrorHandler.getStats();
console.log(stats);
// {
//   totalErrors: 15,
//   recentErrors: [...],
//   errorRate: 5,
//   rateLimitActive: false
// }
```

### Configuration

```javascript
const globalErrorHandler = new GlobalErrorHandler({
  logger: enhancedLogger,
  showUserNotification: showStatus,
  errorRateLimit: 10, // Max errors per minute
  onError: (error, context) => {
    // Custom error handler
    console.log('Error occurred:', error);
  }
});
```

---

## Error Monitoring

### Setup

```javascript
import { errorMonitor } from './core/error-monitor.js';

// Configure for custom endpoint
errorMonitor.enabled = true;
errorMonitor.endpoint = 'https://your-service.com/errors';
errorMonitor.apiKey = 'your-api-key';
errorMonitor.provider = 'custom'; // 'sentry', 'rollbar', 'custom'
errorMonitor.environment = 'production';
errorMonitor.release = '1.0.0';
errorMonitor.sampleRate = 1.0; // 100% of errors
errorMonitor.init();
```

### Sentry Integration

```javascript
// Load Sentry SDK first
<script src="https://cdn.sentry.io/..."></script>

// Configure error monitor
errorMonitor.enabled = true;
errorMonitor.provider = 'sentry';
errorMonitor.init();

// Errors will automatically be sent to Sentry
```

### Rollbar Integration

```javascript
// Load Rollbar SDK first
<script src="https://cdn.rollbar.com/..."></script>

// Configure error monitor
errorMonitor.enabled = true;
errorMonitor.provider = 'rollbar';
errorMonitor.init();
```

### Custom Endpoint

```javascript
// Your custom error tracking endpoint
errorMonitor.endpoint = 'https://api.yourapp.com/errors';
errorMonitor.apiKey = 'your-secret-key';

// Payload sent to your endpoint:
{
  "errors": [
    {
      "error": {
        "message": "...",
        "name": "...",
        "stack": "...",
        "code": "DATA-LOAD-001"
      },
      "context": {...},
      "environment": "production",
      "release": "1.0.0",
      "sessionId": "...",
      "timestamp": 1234567890,
      "user": {...},
      "device": {...}
    }
  ],
  "timestamp": 1234567890
}
```

### User Context

```javascript
// Set user information
errorMonitor.setUser({
  id: '12345',
  email: 'user@example.com',
  username: 'player123'
});
```

### Breadcrumbs

```javascript
// Add breadcrumbs for debugging
errorMonitor.addBreadcrumb({
  message: 'User clicked save button',
  category: 'ui',
  level: 'info'
});
```

---

## Best Practices

### 1. Always Use Error Codes

```javascript
// ❌ Bad
throw new Error('File not found');

// ✅ Good
import { ERROR_CODES, createError } from './core/error-codes.js';
throw createError(
  ERROR_CODES.DATA_LOAD_FILE_NOT_FOUND,
  'File not found: sc2units.json',
  { filename: 'sc2units.json' }
);
```

### 2. Include Context in Logs

```javascript
// ❌ Bad
enhancedLogger.info('Data loaded');

// ✅ Good
enhancedLogger.info('Data loaded successfully', {
  source: 'file',
  filename: 'sc2units.json',
  recordCount: 1523,
  duration: 250
});
```

### 3. Log Errors with Full Details

```javascript
// ❌ Bad
console.error('Error:', error.message);

// ✅ Good
enhancedLogger.error('Failed to save build order', error, {
  code: ERROR_CODES.BUILD_SAVE_ERROR,
  buildId: 123,
  itemCount: 15,
  race: 'protoss'
});
```

### 4. Use Structured Try-Catch

```javascript
// ✅ Good pattern
async function loadBuild(buildId) {
  const timer = enhancedLogger.startTimer('loadBuild');

  try {
    enhancedLogger.info('Loading build', { buildId });

    const build = await database.getBuild(buildId);

    if (!build) {
      throw createError(
        ERROR_CODES.BUILD_LOAD_ERROR,
        'Build not found',
        { buildId }
      );
    }

    timer.end({ success: true });
    enhancedLogger.info('Build loaded successfully', { buildId });

    return build;
  } catch (error) {
    timer.end({ success: false });
    enhancedLogger.error('Failed to load build', error, { buildId });
    throw error;
  }
}
```

### 5. Provide Recovery Suggestions

```javascript
// Always include recovery information in errors
const error = createError(
  ERROR_CODES.STORE_QUOTA_EXCEEDED,
  'Storage quota exceeded',
  { currentSize: 50000000, maxSize: 52428800 }
);

// Error automatically includes:
// - userMessage: "Not enough storage space available"
// - recoverySuggestion: "Free up space by deleting old builds..."
```

### 6. Track Performance

```javascript
// Track critical operations
async function optimizeBuildOrder() {
  const timer = enhancedLogger.startTimer('optimizeBuildOrder');

  try {
    const result = await algorithm.optimize();
    timer.end({
      iterations: result.iterations,
      complexity: 'high'
    });
    return result;
  } catch (error) {
    timer.end({ success: false });
    throw error;
  }
}

// Review metrics
const stats = enhancedLogger.getMetricStats('optimizeBuildOrder');
if (stats.p95 > 5000) {
  enhancedLogger.warn('Optimization is slow', { p95: stats.p95 });
}
```

---

## Migration Guide

### From Console Logging

```javascript
// Before
console.log('User logged in');
console.error('Failed to load:', error);
console.warn('Quota almost exceeded');

// After
enhancedLogger.info('User logged in', { userId: 123 });
enhancedLogger.error('Failed to load data', error, {
  code: ERROR_CODES.DATA_LOAD_NETWORK_ERROR
});
enhancedLogger.warn('Storage quota almost exceeded', {
  usage: 0.95,
  available: 50000000
});
```

### From Basic Error Handling

```javascript
// Before
try {
  await loadData();
} catch (error) {
  console.error(error);
  showNotification('Failed to load data', 'error');
}

// After
import { ERROR_CODES, createError } from './core/error-codes.js';

try {
  await loadData();
} catch (err) {
  const error = createError(
    ERROR_CODES.DATA_LOAD_NETWORK_ERROR,
    'Failed to load data from server',
    { url, statusCode: err.status }
  );

  enhancedLogger.error('Data load failed', error);

  // Global error handler automatically shows user notification
  throw error;
}
```

### Migration Checklist

- [ ] Replace all `console.log/error/warn` with `enhancedLogger`
- [ ] Add error codes to all thrown errors
- [ ] Include context objects in all log statements
- [ ] Update try-catch blocks to use createError
- [ ] Add performance tracking for critical operations
- [ ] Configure error monitoring
- [ ] Update tests to verify error codes
- [ ] Review and update error messages for user-friendliness

---

## Testing

### Unit Tests

```javascript
import { expect } from 'chai';
import { ERROR_CODES, createError, getErrorMetadata } from './core/error-codes.js';

describe('Error Codes', () => {
  it('should create error with correct metadata', () => {
    const error = createError(
      ERROR_CODES.DATA_LOAD_FILE_NOT_FOUND,
      'File missing',
      { filename: 'test.json' }
    );

    expect(error.code).to.equal('DATA-LOAD-001');
    expect(error.recoverable).to.be.false;
    expect(error.userMessage).to.include('could not be found');
    expect(error.context.filename).to.equal('test.json');
  });

  it('should provide recovery suggestions', () => {
    const metadata = getErrorMetadata(ERROR_CODES.BUILD_MISSING_PREREQ);
    expect(metadata.recoverySuggestion).to.include('required');
  });
});
```

### Integration Tests

```javascript
describe('Enhanced Logger', () => {
  let logger;

  beforeEach(() => {
    logger = new EnhancedLogger({ enableConsole: false });
  });

  it('should track metrics', () => {
    logger.recordMetric('test', 100);
    logger.recordMetric('test', 200);
    logger.recordMetric('test', 150);

    const stats = logger.getMetricStats('test');
    expect(stats.count).to.equal(3);
    expect(stats.avg).to.equal(150);
    expect(stats.min).to.equal(100);
    expect(stats.max).to.equal(200);
  });

  it('should buffer errors', () => {
    logger.error('Test error 1', new Error('Error 1'));
    logger.error('Test error 2', new Error('Error 2'));

    const errors = logger.getRecentErrors(10);
    expect(errors).to.have.length(2);
  });
});
```

### Error Handler Tests

```javascript
describe('Global Error Handler', () => {
  it('should catch unhandled errors', (done) => {
    const handler = new GlobalErrorHandler({
      onError: (error, context) => {
        expect(error).to.exist;
        expect(context.type).to.equal('error');
        done();
      }
    });

    handler.init();

    // Trigger error
    setTimeout(() => {
      throw new Error('Test error');
    }, 10);
  });

  it('should rate limit errors', () => {
    const handler = new GlobalErrorHandler({
      errorRateLimit: 2
    });

    // Simulate 3 errors
    handler._processError(new Error('1'));
    handler._processError(new Error('2'));
    handler._processError(new Error('3')); // Should be rate limited

    const stats = handler.getStats();
    expect(stats.rateLimitActive).to.be.true;
  });
});
```

---

## Examples

### Example 1: Data Import with Full Error Handling

```javascript
import { enhancedLogger } from './core/enhanced-logger.js';
import { ERROR_CODES, createError } from './core/error-codes.js';

async function importGameData(source) {
  const timer = enhancedLogger.startTimer('importGameData');

  enhancedLogger.info('Starting game data import', {
    source: source.type,
    size: source.size
  });

  try {
    // Validate input
    if (!source || !source.data) {
      throw createError(
        ERROR_CODES.DATA_LOAD_INVALID_FORMAT,
        'Invalid data source',
        { source }
      );
    }

    // Parse data
    let parsedData;
    try {
      parsedData = JSON.parse(source.data);
    } catch (err) {
      throw createError(
        ERROR_CODES.DATA_LOAD_PARSE_ERROR,
        'Failed to parse JSON',
        { error: err.message, position: err.position }
      );
    }

    // Validate schema
    const validationErrors = validateGameData(parsedData);
    if (validationErrors.length > 0) {
      throw createError(
        ERROR_CODES.DATA_VAL_SCHEMA_MISMATCH,
        'Data validation failed',
        { errors: validationErrors }
      );
    }

    // Save to cache
    await cache.setGameData(parsedData);

    const duration = timer.end({
      success: true,
      recordCount: Object.keys(parsedData).length
    });

    enhancedLogger.info('Game data import completed', {
      duration,
      recordCount: Object.keys(parsedData).length
    });

    return { success: true, data: parsedData };

  } catch (error) {
    timer.end({ success: false });
    enhancedLogger.error('Game data import failed', error);
    throw error;
  }
}
```

### Example 2: Build Order Save with Retry

```javascript
async function saveBuildOrder(build, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      enhancedLogger.info('Saving build order', {
        buildId: build.id,
        attempt,
        maxAttempts: retries
      });

      const result = await database.saveBuild(build);

      enhancedLogger.info('Build order saved', {
        buildId: result.id,
        attempt
      });

      return result;

    } catch (error) {
      enhancedLogger.warn('Build save attempt failed', {
        buildId: build.id,
        attempt,
        error: error.message
      });

      if (attempt === retries) {
        const finalError = createError(
          ERROR_CODES.BUILD_SAVE_ERROR,
          'Failed to save build after multiple attempts',
          { buildId: build.id, attempts: retries }
        );

        enhancedLogger.error('Build save failed', finalError);
        throw finalError;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### Example 3: API Call with Circuit Breaker

```javascript
class APIClient {
  constructor() {
    this.circuitBreaker = {
      failures: 0,
      threshold: 5,
      timeout: 60000,
      state: 'CLOSED',
      nextAttempt: null
    };
  }

  async fetch(url, options = {}) {
    // Check circuit breaker
    if (this.circuitBreaker.state === 'OPEN') {
      if (Date.now() < this.circuitBreaker.nextAttempt) {
        throw createError(
          ERROR_CODES.NET_CIRCUIT_BREAKER_OPEN,
          'Circuit breaker is open',
          { url, nextAttempt: this.circuitBreaker.nextAttempt }
        );
      }
      this.circuitBreaker.state = 'HALF_OPEN';
    }

    const timer = enhancedLogger.startTimer('apiRequest');

    try {
      enhancedLogger.debug('API request started', { url, method: options.method });

      const response = await fetch(url, options);

      if (!response.ok) {
        throw createError(
          ERROR_CODES.NET_REQUEST_FAILED,
          `HTTP ${response.status}: ${response.statusText}`,
          { url, status: response.status }
        );
      }

      const data = await response.json();

      // Success - reset circuit breaker
      this.circuitBreaker.failures = 0;
      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.circuitBreaker.state = 'CLOSED';
      }

      timer.end({ success: true, status: response.status });

      return data;

    } catch (error) {
      timer.end({ success: false });

      // Increment circuit breaker
      this.circuitBreaker.failures++;
      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.state = 'OPEN';
        this.circuitBreaker.nextAttempt = Date.now() + this.circuitBreaker.timeout;

        enhancedLogger.warn('Circuit breaker opened', {
          failures: this.circuitBreaker.failures,
          nextAttempt: this.circuitBreaker.nextAttempt
        });
      }

      enhancedLogger.error('API request failed', error, { url });
      throw error;
    }
  }
}
```

---

## Console Access

All error handling components are available in the browser console for debugging:

```javascript
// Access from console
window.SC2BuildLab.enhancedLogger
window.SC2BuildLab.errorHandler
window.SC2BuildLab.errorMonitor

// Or directly
window.__logger
window.__errorHandler
window.__errorMonitor

// Examples:
window.__logger.exportLogs()
window.__errorHandler.getStats()
window.__errorMonitor.test()
```

---

## Summary

The SC2 Build Lab error handling system provides:

✅ **Standardized Error Codes** - Consistent error identification
✅ **Structured Logging** - Rich context and metrics
✅ **Global Error Boundary** - Catches all unhandled errors
✅ **Error Monitoring** - Integration with external services
✅ **User-Friendly Messages** - Automatic translation
✅ **Performance Tracking** - Built-in metrics
✅ **Developer Experience** - Easy to use and debug

For questions or issues, refer to the individual component documentation or check the error codes reference.

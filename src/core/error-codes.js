/**
 * Standardized Error Codes
 * Provides consistent error identification across the application
 * Format: [COMPONENT]-[CATEGORY]-[NUMBER]
 */

export const ERROR_CODES = {
  // Data Loading Errors (DATA-LOAD-xxx)
  DATA_LOAD_FILE_NOT_FOUND: 'DATA-LOAD-001',
  DATA_LOAD_INVALID_FORMAT: 'DATA-LOAD-002',
  DATA_LOAD_PARSE_ERROR: 'DATA-LOAD-003',
  DATA_LOAD_NETWORK_ERROR: 'DATA-LOAD-004',
  DATA_LOAD_TIMEOUT: 'DATA-LOAD-005',
  DATA_LOAD_CORS_ERROR: 'DATA-LOAD-006',

  // Data Validation Errors (DATA-VAL-xxx)
  DATA_VAL_MISSING_FIELD: 'DATA-VAL-001',
  DATA_VAL_INVALID_TYPE: 'DATA-VAL-002',
  DATA_VAL_CONSTRAINT_VIOLATION: 'DATA-VAL-003',
  DATA_VAL_SCHEMA_MISMATCH: 'DATA-VAL-004',
  DATA_VAL_DUPLICATE_KEY: 'DATA-VAL-005',

  // Data Import Errors (DATA-IMP-xxx)
  DATA_IMP_SOURCE_ERROR: 'DATA-IMP-001',
  DATA_IMP_BACKUP_FAILED: 'DATA-IMP-002',
  DATA_IMP_MERGE_CONFLICT: 'DATA-IMP-003',
  DATA_IMP_CACHE_ERROR: 'DATA-IMP-004',
  DATA_IMP_HISTORY_ERROR: 'DATA-IMP-005',
  DATA_IMP_BULK_DELETE_ERROR: 'DATA-IMP-006',
  DATA_IMP_CLONE_ERROR: 'DATA-IMP-007',
  DATA_IMP_FILTER_ERROR: 'DATA-IMP-008',

  // Build Order Errors (BUILD-xxx)
  BUILD_MISSING_PREREQ: 'BUILD-001',
  BUILD_INVALID_ORDER: 'BUILD-002',
  BUILD_INSUFFICIENT_RESOURCES: 'BUILD-003',
  BUILD_SAVE_ERROR: 'BUILD-004',
  BUILD_LOAD_ERROR: 'BUILD-005',
  BUILD_DELETE_ERROR: 'BUILD-006',

  // UI Errors (UI-xxx)
  UI_MODAL_NOT_FOUND: 'UI-001',
  UI_RENDER_ERROR: 'UI-002',
  UI_EVENT_HANDLER_ERROR: 'UI-003',
  UI_DOM_NOT_READY: 'UI-004',
  UI_INVALID_INPUT: 'UI-005',

  // Visualization Errors (VIZ-xxx)
  VIZ_CHART_ERROR: 'VIZ-001',
  VIZ_TIMELINE_ERROR: 'VIZ-002',
  VIZ_DEPENDENCY_ERROR: 'VIZ-003',
  VIZ_TECH_TREE_ERROR: 'VIZ-004',
  VIZ_MRTS_ERROR: 'VIZ-005',
  VIZ_COMPARISON_ERROR: 'VIZ-006',

  // Storage Errors (STORE-xxx)
  STORE_INDEXEDDB_ERROR: 'STORE-001',
  STORE_QUOTA_EXCEEDED: 'STORE-002',
  STORE_READ_ERROR: 'STORE-003',
  STORE_WRITE_ERROR: 'STORE-004',
  STORE_DELETE_ERROR: 'STORE-005',

  // Algorithm Errors (ALGO-xxx)
  ALGO_OPTIMIZATION_ERROR: 'ALGO-001',
  ALGO_SIMULATION_ERROR: 'ALGO-002',
  ALGO_GRAPH_ERROR: 'ALGO-003',
  ALGO_MRTS_ERROR: 'ALGO-004',
  ALGO_COMPARISON_ERROR: 'ALGO-005',

  // Worker Errors (WORK-xxx)
  WORK_CREATION_FAILED: 'WORK-001',
  WORK_MESSAGE_ERROR: 'WORK-002',
  WORK_TIMEOUT: 'WORK-003',
  WORK_TERMINATED: 'WORK-004',

  // Network Errors (NET-xxx)
  NET_REQUEST_FAILED: 'NET-001',
  NET_TIMEOUT: 'NET-002',
  NET_OFFLINE: 'NET-003',
  NET_RATE_LIMIT: 'NET-004',
  NET_CIRCUIT_BREAKER_OPEN: 'NET-005',

  // System Errors (SYS-xxx)
  SYS_UNKNOWN_ERROR: 'SYS-001',
  SYS_INITIALIZATION_ERROR: 'SYS-002',
  SYS_OUT_OF_MEMORY: 'SYS-003',
  SYS_BROWSER_NOT_SUPPORTED: 'SYS-004',
  SYS_FEATURE_NOT_AVAILABLE: 'SYS-005',
};

/**
 * Error metadata including user-friendly messages and recovery suggestions
 */
export const ERROR_METADATA = {
  [ERROR_CODES.DATA_LOAD_FILE_NOT_FOUND]: {
    message: 'File not found',
    userMessage: 'The requested file could not be found. Please check the file path and try again.',
    recoverySuggestion: 'Verify the file exists and you have permission to access it.',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.DATA_LOAD_INVALID_FORMAT]: {
    message: 'Invalid file format',
    userMessage: 'The file format is not supported. Please upload a valid JSON file.',
    recoverySuggestion: 'Ensure the file is a valid sc2units.json format.',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.DATA_LOAD_PARSE_ERROR]: {
    message: 'Failed to parse data',
    userMessage: 'The data file contains errors and could not be parsed.',
    recoverySuggestion: 'Check the JSON syntax and ensure all fields are properly formatted.',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.DATA_LOAD_NETWORK_ERROR]: {
    message: 'Network request failed',
    userMessage: 'Failed to load data due to a network error.',
    recoverySuggestion: 'Check your internet connection and try again.',
    severity: 'error',
    recoverable: true,
  },
  [ERROR_CODES.DATA_LOAD_TIMEOUT]: {
    message: 'Request timeout',
    userMessage: 'The request took too long to complete.',
    recoverySuggestion: 'Check your connection speed and try again with a smaller file.',
    severity: 'warning',
    recoverable: true,
  },
  [ERROR_CODES.BUILD_MISSING_PREREQ]: {
    message: 'Missing prerequisites',
    userMessage: 'Cannot add this item because required prerequisites are missing.',
    recoverySuggestion: 'Add the required buildings or tech first.',
    severity: 'warning',
    recoverable: true,
  },
  [ERROR_CODES.STORE_QUOTA_EXCEEDED]: {
    message: 'Storage quota exceeded',
    userMessage: 'Not enough storage space available.',
    recoverySuggestion: 'Free up space by deleting old builds or clearing browser data.',
    severity: 'error',
    recoverable: true,
  },
  [ERROR_CODES.UI_MODAL_NOT_FOUND]: {
    message: 'Modal not found',
    userMessage: 'The requested dialog could not be displayed.',
    recoverySuggestion: 'Refresh the page and try again.',
    severity: 'error',
    recoverable: true,
  },
  [ERROR_CODES.NET_CIRCUIT_BREAKER_OPEN]: {
    message: 'Service temporarily unavailable',
    userMessage: 'The service is experiencing issues. Please try again in a few moments.',
    recoverySuggestion: 'Wait a minute and retry your request.',
    severity: 'warning',
    recoverable: true,
  },
  [ERROR_CODES.SYS_UNKNOWN_ERROR]: {
    message: 'Unknown error occurred',
    userMessage: 'An unexpected error occurred. Please try again.',
    recoverySuggestion: 'Refresh the page or contact support if the issue persists.',
    severity: 'error',
    recoverable: false,
  },
};

/**
 * Get error metadata for a given error code
 * @param {string} code - Error code
 * @returns {Object} Error metadata
 */
export function getErrorMetadata(code) {
  return ERROR_METADATA[code] || ERROR_METADATA[ERROR_CODES.SYS_UNKNOWN_ERROR];
}

/**
 * Check if an error is recoverable
 * @param {string} code - Error code
 * @returns {boolean} True if error is recoverable
 */
export function isRecoverable(code) {
  const metadata = getErrorMetadata(code);
  return metadata.recoverable === true;
}

/**
 * Get user-friendly message for error code
 * @param {string} code - Error code
 * @returns {string} User-friendly message
 */
export function getUserMessage(code) {
  const metadata = getErrorMetadata(code);
  return metadata.userMessage;
}

/**
 * Get recovery suggestion for error code
 * @param {string} code - Error code
 * @returns {string} Recovery suggestion
 */
export function getRecoverySuggestion(code) {
  const metadata = getErrorMetadata(code);
  return metadata.recoverySuggestion;
}

/**
 * Create a standardized error object
 * @param {string} code - Error code
 * @param {string} message - Technical message
 * @param {Object} context - Additional context
 * @returns {Error} Standardized error object
 */
export function createError(code, message, context = {}) {
  const metadata = getErrorMetadata(code);
  const error = new Error(message || metadata.message);

  error.code = code;
  error.userMessage = metadata.userMessage;
  error.recoverySuggestion = metadata.recoverySuggestion;
  error.severity = metadata.severity;
  error.recoverable = metadata.recoverable;
  error.context = context;
  error.timestamp = Date.now();

  return error;
}

/**
 * Logger Module
 * Provides structured logging with log levels
 */

export class Logger {
  constructor(level = 'INFO') {
    this.level = level;
    this._levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  }

  _log(level, ...args) {
    if (this._levels.indexOf(level) < this._levels.indexOf(this.level)) return;
    const ts = new Date().toISOString().split('T')[1]?.slice(0, 12) || '00:00:00.000';
    const prefix = `[${ts}] [${level}]`;
    (console[level.toLowerCase()] || console.log).call(console, prefix, ...args);
  }

  debug(...args) { this._log('DEBUG', ...args); }
  info(...args)  { this._log('INFO',  ...args); }
  warn(...args)  { this._log('WARN',  ...args); }
  error(...args) { this._log('ERROR', ...args); }

  setLevel(level) {
    if (this._levels.includes(level)) {
      this.level = level;
    } else {
      this.warn(`Invalid log level: ${level}`);
    }
  }
}

// Default logger instance
export const logger = new Logger('INFO');

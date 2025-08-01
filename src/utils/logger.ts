/**
 * Logging utilities for consistent error logging throughout the application
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, error, metadata);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, undefined, metadata);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, undefined, metadata);
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, undefined, metadata);
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, error?: Error, metadata?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      error,
      metadata
    };

    // Format the log message
    const logMessage = this.formatLogMessage(logEntry);
    
    // Output to console based on level
    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        if (error) {
          console.error('Stack trace:', error.stack);
        }
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
    }
  }

  /**
   * Format log message for output
   */
  private formatLogMessage(entry: LogEntry): string {
    let message = `[${entry.timestamp}] ${entry.level} [${entry.context}] ${entry.message}`;
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += ` | Metadata: ${JSON.stringify(entry.metadata)}`;
    }
    
    return message;
  }
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

/**
 * Global error handler for unhandled promise rejections
 */
export function setupGlobalErrorHandling(): void {
  const logger = createLogger('GlobalErrorHandler');

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
      promise: promise.toString()
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
    // Exit the process after logging the error
    process.exit(1);
  });
}
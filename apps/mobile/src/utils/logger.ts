/**
 * Centralized logging utility for ProTour
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableCrashlytics: boolean;
  enableFileLogging: boolean;
}

const defaultConfig: LogConfig = {
  minLevel: __DEV__ ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: __DEV__,
  enableCrashlytics: !__DEV__,
  enableFileLogging: false,
};

class Logger {
  private config: LogConfig;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.minLevel;
  }

  private formatMessage(level: string, message: string, extra?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (extra !== undefined) {
      return `${baseMessage} ${JSON.stringify(extra, null, 2)}`;
    }
    
    return baseMessage;
  }

  debug(message: string, extra?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const formattedMessage = this.formatMessage('DEBUG', message, extra);
    
    if (this.config.enableConsole) {
      console.log(formattedMessage);
    }
  }

  info(message: string, extra?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const formattedMessage = this.formatMessage('INFO', message, extra);
    
    if (this.config.enableConsole) {
      console.info(formattedMessage);
    }

    if (this.config.enableCrashlytics) {
      // Send to Crashlytics (Firebase)
      try {
        // crashlytics().log(formattedMessage);
      } catch (error) {
        // Ignore crashlytics errors
      }
    }
  }

  warn(message: string, extra?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const formattedMessage = this.formatMessage('WARN', message, extra);
    
    if (this.config.enableConsole) {
      console.warn(formattedMessage);
    }

    if (this.config.enableCrashlytics) {
      try {
        // crashlytics().log(formattedMessage);
      } catch (error) {
        // Ignore crashlytics errors
      }
    }
  }

  error(message: string, error?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const formattedMessage = this.formatMessage('ERROR', message, error);
    
    if (this.config.enableConsole) {
      console.error(formattedMessage);
    }

    if (this.config.enableCrashlytics) {
      try {
        // crashlytics().recordError(new Error(message));
        // crashlytics().log(formattedMessage);
      } catch (crashError) {
        // Ignore crashlytics errors
      }
    }
  }

  setConfig(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LogConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export factory function for custom loggers
export const createLogger = (config?: Partial<LogConfig>): Logger => {
  return new Logger(config);
};

export default logger;
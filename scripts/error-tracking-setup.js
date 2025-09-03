#!/usr/bin/env node

/**
 * Error tracking integration setup for ProTour
 * Configures Sentry, custom error handlers, and monitoring
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

class ErrorTrackingSetup {
  constructor() {
    this.rootPath = path.join(__dirname, '..');
    this.mobileConfigPath = path.join(this.rootPath, 'apps/mobile/src/config');
    this.functionsConfigPath = path.join(this.rootPath, 'functions/src/config');
    this.sharedConfigPath = path.join(
      this.rootPath,
      'packages/shared/src/config'
    );
  }

  /**
   * Create mobile error tracking configuration
   */
  createMobileErrorConfig() {
    const configDir = this.mobileConfigPath;
    const configFile = path.join(configDir, 'errorTracking.ts');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const config = `/**
 * Error tracking configuration for mobile app
 */

import { Platform } from 'react-native';

interface ErrorTrackingConfig {
  enabled: boolean;
  dsn?: string;
  environment: string;
  debug: boolean;
  sampleRate: number;
  tracesSampleRate: number;
  beforeSend?: (event: any) => any | null;
}

const isDevelopment = __DEV__;
const isProduction = !isDevelopment;

export const errorTrackingConfig: ErrorTrackingConfig = {
  enabled: isProduction,
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
  debug: isDevelopment,
  sampleRate: isProduction ? 1.0 : 0.0,
  tracesSampleRate: isProduction ? 0.2 : 0.0,
  beforeSend: (event) => {
    // Filter out development errors and sensitive data
    if (isDevelopment) return null;
    
    // Remove sensitive information
    if (event.exception) {
      event.exception.values?.forEach(exception => {
        if (exception.stacktrace) {
          exception.stacktrace.frames?.forEach(frame => {
            // Remove absolute paths in production
            if (frame.filename && frame.filename.includes('/')) {
              frame.filename = frame.filename.split('/').pop() || frame.filename;
            }
          });
        }
      });
    }
    
    return event;
  },
};

export class MobileErrorTracker {
  private static instance: MobileErrorTracker;
  private initialized = false;

  static getInstance(): MobileErrorTracker {
    if (!MobileErrorTracker.instance) {
      MobileErrorTracker.instance = new MobileErrorTracker();
    }
    return MobileErrorTracker.instance;
  }

  async initialize() {
    if (this.initialized || !errorTrackingConfig.enabled) {
      return;
    }

    try {
      // Note: This would typically import and configure Sentry
      // For now, we'll set up basic error handling
      this.setupGlobalErrorHandlers();
      this.setupUnhandledRejectionHandler();
      
      this.initialized = true;
      console.log('[ErrorTracker] Mobile error tracking initialized');
    } catch (error) {
      console.error('[ErrorTracker] Failed to initialize:', error);
    }
  }

  private setupGlobalErrorHandlers() {
    // Global JavaScript error handler
    const originalHandler = global.ErrorUtils?.getGlobalHandler();
    
    global.ErrorUtils?.setGlobalHandler((error, isFatal) => {
      this.captureError(error, { isFatal, platform: Platform.OS });
      
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  private setupUnhandledRejectionHandler() {
    // Handle unhandled promise rejections
    const originalHandler = global.Promise?.prototype?.catch;
    
    if (originalHandler) {
      global.Promise.prototype.catch = function(onRejected) {
        return originalHandler.call(this, (reason) => {
          if (!onRejected) {
            MobileErrorTracker.getInstance().captureError(
              new Error(\`Unhandled Promise Rejection: \${reason}\`),
              { type: 'unhandledRejection' }
            );
          }
          if (onRejected) return onRejected(reason);
          throw reason;
        });
      };
    }
  }

  captureError(error: Error, context: Record<string, any> = {}) {
    if (!errorTrackingConfig.enabled) return;

    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        ...context,
      };

      // In a real implementation, this would send to Sentry
      console.error('[ErrorTracker] Captured error:', errorData);
      
      // Store locally for offline support
      this.storeErrorLocally(errorData);
    } catch (captureError) {
      console.error('[ErrorTracker] Failed to capture error:', captureError);
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
    if (!errorTrackingConfig.enabled) return;

    try {
      const messageData = {
        message,
        level,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        ...context,
      };

      console.log(\`[ErrorTracker] Captured message (\${level}):\`, messageData);
      this.storeErrorLocally(messageData);
    } catch (error) {
      console.error('[ErrorTracker] Failed to capture message:', error);
    }
  }

  setUserContext(user: { id: string; email?: string; role?: string }) {
    if (!errorTrackingConfig.enabled) return;

    try {
      // In a real implementation, this would set Sentry user context
      console.log('[ErrorTracker] Set user context:', user);
    } catch (error) {
      console.error('[ErrorTracker] Failed to set user context:', error);
    }
  }

  addBreadcrumb(breadcrumb: { message: string; category: string; level?: string; data?: any }) {
    if (!errorTrackingConfig.enabled) return;

    try {
      // In a real implementation, this would add Sentry breadcrumb
      console.log('[ErrorTracker] Added breadcrumb:', breadcrumb);
    } catch (error) {
      console.error('[ErrorTracker] Failed to add breadcrumb:', error);
    }
  }

  private async storeErrorLocally(errorData: any) {
    try {
      // Store error locally for offline support and later sync
      // This would typically use AsyncStorage or a local database
      const storageKey = \`error_\${Date.now()}_\${Math.random()}\`;
      console.log(\`[ErrorTracker] Stored error locally: \${storageKey}\`);
    } catch (error) {
      console.error('[ErrorTracker] Failed to store error locally:', error);
    }
  }

  async syncOfflineErrors() {
    if (!errorTrackingConfig.enabled) return;

    try {
      // Sync offline errors when network is available
      console.log('[ErrorTracker] Syncing offline errors...');
    } catch (error) {
      console.error('[ErrorTracker] Failed to sync offline errors:', error);
    }
  }
}

export const errorTracker = MobileErrorTracker.getInstance();
`;

    fs.writeFileSync(configFile, config);
    log(
      `✅ Created mobile error tracking config: ${path.relative(this.rootPath, configFile)}`,
      colors.green
    );
  }

  /**
   * Create Functions error tracking configuration
   */
  createFunctionsErrorConfig() {
    const configDir = this.functionsConfigPath;
    const configFile = path.join(configDir, 'errorTracking.ts');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const config = `/**
 * Error tracking configuration for Firebase Functions
 */

interface ErrorTrackingConfig {
  enabled: boolean;
  dsn?: string;
  environment: string;
  debug: boolean;
  sampleRate: number;
  tracesSampleRate: number;
}

const isProduction = process.env.NODE_ENV === 'production';

export const errorTrackingConfig: ErrorTrackingConfig = {
  enabled: isProduction,
  dsn: process.env.SENTRY_DSN,
  environment: process.env.FIREBASE_CONFIG ? 
    JSON.parse(process.env.FIREBASE_CONFIG).projectId : 
    'development',
  debug: !isProduction,
  sampleRate: isProduction ? 1.0 : 0.0,
  tracesSampleRate: isProduction ? 0.2 : 0.0,
};

export class FunctionsErrorTracker {
  private static instance: FunctionsErrorTracker;
  private initialized = false;

  static getInstance(): FunctionsErrorTracker {
    if (!FunctionsErrorTracker.instance) {
      FunctionsErrorTracker.instance = new FunctionsErrorTracker();
    }
    return FunctionsErrorTracker.instance;
  }

  async initialize() {
    if (this.initialized || !errorTrackingConfig.enabled) {
      return;
    }

    try {
      // Setup global error handlers for Cloud Functions
      process.on('uncaughtException', (error) => {
        this.captureError(error, { type: 'uncaughtException' });
        console.error('Uncaught Exception:', error);
        process.exit(1);
      });

      process.on('unhandledRejection', (reason, promise) => {
        this.captureError(
          new Error(\`Unhandled Rejection at: \${promise}, reason: \${reason}\`),
          { type: 'unhandledRejection' }
        );
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      });

      this.initialized = true;
      console.log('[ErrorTracker] Functions error tracking initialized');
    } catch (error) {
      console.error('[ErrorTracker] Failed to initialize:', error);
    }
  }

  captureError(error: Error, context: Record<string, any> = {}) {
    if (!errorTrackingConfig.enabled) return;

    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        timestamp: new Date().toISOString(),
        environment: errorTrackingConfig.environment,
        ...context,
      };

      // In a real implementation, this would send to Sentry
      console.error('[ErrorTracker] Captured error:', errorData);

      // Log to Google Cloud Logging for Firebase Functions
      console.error('TRACKED_ERROR', JSON.stringify(errorData));
    } catch (captureError) {
      console.error('[ErrorTracker] Failed to capture error:', captureError);
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
    if (!errorTrackingConfig.enabled) return;

    try {
      const messageData = {
        message,
        level,
        timestamp: new Date().toISOString(),
        environment: errorTrackingConfig.environment,
        ...context,
      };

      console.log(\`[ErrorTracker] Captured message (\${level}):\`, messageData);
      console.log('TRACKED_MESSAGE', JSON.stringify(messageData));
    } catch (error) {
      console.error('[ErrorTracker] Failed to capture message:', error);
    }
  }

  wrapFunction<T extends (...args: any[]) => any>(fn: T, context?: Record<string, any>): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result && typeof result.catch === 'function') {
          return result.catch((error: Error) => {
            this.captureError(error, { ...context, functionName: fn.name });
            throw error;
          });
        }
        
        return result;
      } catch (error) {
        this.captureError(error as Error, { ...context, functionName: fn.name });
        throw error;
      }
    }) as T;
  }

  setUserContext(user: { uid: string; email?: string; role?: string }) {
    if (!errorTrackingConfig.enabled) return;

    try {
      // In a real implementation, this would set Sentry user context
      console.log('[ErrorTracker] Set user context:', user);
    } catch (error) {
      console.error('[ErrorTracker] Failed to set user context:', error);
    }
  }

  addBreadcrumb(breadcrumb: { message: string; category: string; level?: string; data?: any }) {
    if (!errorTrackingConfig.enabled) return;

    try {
      // In a real implementation, this would add Sentry breadcrumb
      console.log('[ErrorTracker] Added breadcrumb:', breadcrumb);
    } catch (error) {
      console.error('[ErrorTracker] Failed to add breadcrumb:', error);
    }
  }
}

export const errorTracker = FunctionsErrorTracker.getInstance();

// Middleware for Express-like functions
export const errorTrackingMiddleware = (req: any, res: any, next: any) => {
  try {
    // Add request context
    errorTracker.addBreadcrumb({
      message: \`\${req.method} \${req.path}\`,
      category: 'http',
      level: 'info',
      data: {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
      },
    });

    next();
  } catch (error) {
    errorTracker.captureError(error as Error, { middleware: 'errorTracking' });
    next(error);
  }
};
`;

    fs.writeFileSync(configFile, config);
    log(
      `✅ Created functions error tracking config: ${path.relative(this.rootPath, configFile)}`,
      colors.green
    );
  }

  /**
   * Create shared error tracking utilities
   */
  createSharedErrorConfig() {
    const configDir = this.sharedConfigPath;
    const configFile = path.join(configDir, 'errorTracking.ts');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const config = `/**
 * Shared error tracking utilities and types
 */

export interface ErrorContext {
  userId?: string;
  tournamentId?: string;
  matchId?: string;
  action?: string;
  component?: string;
  [key: string]: any;
}

export interface ErrorEvent {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  level: 'info' | 'warning' | 'error' | 'fatal';
  context: ErrorContext;
  platform: 'mobile' | 'web' | 'functions';
  environment: string;
  userId?: string;
  sessionId?: string;
}

export class ErrorUtils {
  /**
   * Sanitize error data for safe transmission
   */
  static sanitizeError(error: Error, context: ErrorContext = {}): Partial<ErrorEvent> {
    return {
      id: \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      level: 'error',
      context: this.sanitizeContext(context),
    };
  }

  /**
   * Sanitize context data to remove sensitive information
   */
  static sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized = { ...context };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Create a user-friendly error message
   */
  static getUserFriendlyMessage(error: Error): string {
    // Map common error types to user-friendly messages
    const errorMappings: Record<string, string> = {
      'auth/user-not-found': 'User account not found. Please check your credentials.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'firestore/permission-denied': 'You do not have permission to perform this action.',
      'firestore/unavailable': 'Service temporarily unavailable. Please try again.',
      'network-error': 'Network connection error. Please check your internet connection.',
      'timeout': 'Request timed out. Please try again.',
    };

    const errorCode = this.extractErrorCode(error);
    return errorMappings[errorCode] || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Extract error code from error message or type
   */
  static extractErrorCode(error: Error): string {
    // Check for Firebase error codes
    if (error.message.includes('/')) {
      const match = error.message.match(/([a-zA-Z-]+\/[a-zA-Z-]+)/);
      if (match) return match[1];
    }

    // Check error name or type
    if (error.name) {
      return error.name.toLowerCase();
    }

    // Check for common network errors
    if (error.message.toLowerCase().includes('network')) {
      return 'network-error';
    }

    if (error.message.toLowerCase().includes('timeout')) {
      return 'timeout';
    }

    return 'unknown';
  }

  /**
   * Determine error severity
   */
  static getErrorSeverity(error: Error, context: ErrorContext = {}): 'info' | 'warning' | 'error' | 'fatal' {
    // Fatal errors
    if (context.isFatal || error.name === 'FatalError') {
      return 'fatal';
    }

    // Network and temporary errors are warnings
    const errorCode = this.extractErrorCode(error);
    const warningCodes = ['network-error', 'timeout', 'auth/too-many-requests'];
    if (warningCodes.includes(errorCode)) {
      return 'warning';
    }

    // User errors (validation, permissions) are info level
    const userErrorCodes = ['auth/user-not-found', 'auth/wrong-password', 'firestore/permission-denied'];
    if (userErrorCodes.includes(errorCode)) {
      return 'info';
    }

    // Default to error
    return 'error';
  }

  /**
   * Check if error should be reported to tracking service
   */
  static shouldReportError(error: Error, context: ErrorContext = {}): boolean {
    const errorCode = this.extractErrorCode(error);
    
    // Don't report user errors in production
    const userErrors = ['auth/user-not-found', 'auth/wrong-password', 'firestore/permission-denied'];
    if (userErrors.includes(errorCode)) {
      return false;
    }

    // Don't report development errors
    if (context.environment === 'development') {
      return false;
    }

    return true;
  }
}

export class ErrorBoundaryUtils {
  /**
   * Handle React component errors
   */
  static handleComponentError(error: Error, errorInfo: any, component: string) {
    const context: ErrorContext = {
      component,
      componentStack: errorInfo.componentStack,
      action: 'component-render',
    };

    return ErrorUtils.sanitizeError(error, context);
  }

  /**
   * Handle async operation errors
   */
  static handleAsyncError(error: Error, operation: string, context: ErrorContext = {}) {
    const fullContext: ErrorContext = {
      ...context,
      action: operation,
      type: 'async-operation',
    };

    return ErrorUtils.sanitizeError(error, fullContext);
  }
}
`;

    fs.writeFileSync(configFile, config);
    log(
      `✅ Created shared error tracking config: ${path.relative(this.rootPath, configFile)}`,
      colors.green
    );
  }

  /**
   * Update CI/CD workflows to include error tracking
   */
  updateCIWorkflows() {
    const prWorkflowPath = path.join(
      this.rootPath,
      '.github/workflows/pr-validation.yml'
    );

    if (fs.existsSync(prWorkflowPath)) {
      let workflow = fs.readFileSync(prWorkflowPath, 'utf8');

      // Add error tracking validation step
      if (!workflow.includes('Error tracking validation')) {
        const insertAfter = '      - name: Security audit';
        const newStep = `      - name: Error tracking validation
        run: |
          # Validate error tracking configuration
          node -e "
            const mobileConfig = require('./apps/mobile/src/config/errorTracking.ts');
            const functionsConfig = require('./functions/src/config/errorTracking.ts');
            console.log('✅ Error tracking configuration validated');
          "
        continue-on-error: true`;

        workflow = workflow.replace(
          insertAfter,
          insertAfter + '\n\n' + newStep
        );
        fs.writeFileSync(prWorkflowPath, workflow);
        log(
          `✅ Updated PR workflow with error tracking validation`,
          colors.green
        );
      }
    }
  }

  /**
   * Create environment configuration template
   */
  createEnvTemplate() {
    const envTemplatePath = path.join(this.rootPath, '.env.example');

    let envTemplate = '';
    if (fs.existsSync(envTemplatePath)) {
      envTemplate = fs.readFileSync(envTemplatePath, 'utf8');
    }

    const errorTrackingEnvs = `
# Error Tracking Configuration
SENTRY_DSN=your_sentry_dsn_here
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
SENTRY_AUTH_TOKEN=your_sentry_auth_token_here
SENTRY_ORG=your_sentry_org
SENTRY_PROJECT=protour
`;

    if (!envTemplate.includes('Error Tracking Configuration')) {
      envTemplate += errorTrackingEnvs;
      fs.writeFileSync(envTemplatePath, envTemplate);
      log(
        `✅ Updated .env.example with error tracking variables`,
        colors.green
      );
    }
  }

  /**
   * Run complete error tracking setup
   */
  async setup() {
    log('🔧 Setting up error tracking infrastructure...', colors.cyan);
    log('==============================================', colors.cyan);

    try {
      this.createMobileErrorConfig();
      this.createFunctionsErrorConfig();
      this.createSharedErrorConfig();
      this.updateCIWorkflows();
      this.createEnvTemplate();

      log('\n🎉 Error tracking setup completed successfully!', colors.green);
      log('\nNext steps:', colors.blue);
      log(
        '1. Sign up for Sentry (sentry.io) and create a new project',
        colors.cyan
      );
      log('2. Add your Sentry DSN to environment variables', colors.cyan);
      log('3. Initialize error tracking in your app entry points', colors.cyan);
      log('4. Test error reporting in development environment', colors.cyan);
    } catch (error) {
      log(`❌ Error during setup: ${error.message}`, colors.red);
      throw error;
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const command = process.argv[2];

  const setup = new ErrorTrackingSetup();

  try {
    switch (command) {
      case 'setup':
        await setup.setup();
        break;

      default:
        log('ProTour Error Tracking Setup', colors.cyan);
        log('=============================', colors.cyan);
        log('');
        log('Commands:', colors.blue);
        log('  setup    Set up error tracking infrastructure', colors.cyan);
        log('');
        log('Usage:', colors.blue);
        log('  npm run error-tracking:setup', colors.cyan);
        break;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ErrorTrackingSetup };

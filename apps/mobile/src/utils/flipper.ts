/**
 * Flipper debugging utilities for ProTour
 */

import { logger } from './logger';

let flipperEnabled = false;

// Flipper network plugin
let networkLogger: any = null;

// Flipper logger plugin  
let flipperLogger: any = null;

/**
 * Initialize Flipper debugging tools
 */
export const initializeFlipper = (): void => {
  if (!__DEV__) {
    return;
  }

  try {
    // Import Flipper modules only in development
    const { logger: flipperLoggerImport } = require('flipper-plugin-react-native-logger');
    const { networker } = require('@react-native-community/flipper-plugin-network');

    flipperLogger = flipperLoggerImport;
    networkLogger = networker();

    // Enable Flipper
    flipperEnabled = true;

    logger.info('Flipper debugging initialized successfully');
  } catch (error) {
    logger.warn('Flipper not available or failed to initialize:', error);
    flipperEnabled = false;
  }
};

/**
 * Log network request to Flipper
 */
export const logNetworkRequest = (
  url: string,
  method: string,
  headers?: any,
  body?: any,
): void => {
  if (!flipperEnabled || !networkLogger) return;

  try {
    networkLogger.logRequest({
      url,
      method,
      headers,
      body,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.warn('Failed to log network request to Flipper:', error);
  }
};

/**
 * Log network response to Flipper
 */
export const logNetworkResponse = (
  url: string,
  status: number,
  headers?: any,
  body?: any,
  duration?: number,
): void => {
  if (!flipperEnabled || !networkLogger) return;

  try {
    networkLogger.logResponse({
      url,
      status,
      headers,
      body,
      timestamp: Date.now(),
      duration,
    });
  } catch (error) {
    logger.warn('Failed to log network response to Flipper:', error);
  }
};

/**
 * Log custom event to Flipper
 */
export const logFlipperEvent = (
  event: string,
  data?: any,
  level: 'info' | 'warn' | 'error' = 'info',
): void => {
  if (!flipperEnabled || !flipperLogger) return;

  try {
    flipperLogger[level](event, data);
  } catch (error) {
    logger.warn('Failed to log event to Flipper:', error);
  }
};

/**
 * Check if Flipper is enabled and available
 */
export const isFlipperEnabled = (): boolean => {
  return flipperEnabled;
};

export default {
  initialize: initializeFlipper,
  logNetworkRequest,
  logNetworkResponse,
  logEvent: logFlipperEvent,
  isEnabled: isFlipperEnabled,
};
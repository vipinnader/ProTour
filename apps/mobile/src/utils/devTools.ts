/**
 * Development tools and debugging utilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { logger } from './logger';

declare global {
  var __DEV__: boolean;
  var __BUNDLE_START_TIME__: number;
  var __METRO_GLOBAL_PREFIX__: string;
}

/**
 * Development tools configuration
 */
export interface DevToolsConfig {
  enableConsoleDebugging: boolean;
  enableNetworkLogging: boolean;
  enablePerformanceMonitoring: boolean;
  enableReduxDevTools: boolean;
  enableFlipperIntegration: boolean;
}

const DEFAULT_CONFIG: DevToolsConfig = {
  enableConsoleDebugging: true,
  enableNetworkLogging: true,
  enablePerformanceMonitoring: true,
  enableReduxDevTools: true,
  enableFlipperIntegration: true,
};

let devToolsConfig: DevToolsConfig = DEFAULT_CONFIG;

/**
 * Initialize development tools
 */
export const initializeDevTools = async (): Promise<void> => {
  if (!__DEV__) {
    return;
  }

  try {
    // Load saved configuration
    const savedConfig = await AsyncStorage.getItem('devtools_config');
    if (savedConfig) {
      devToolsConfig = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
    }

    // Setup console debugging
    if (devToolsConfig.enableConsoleDebugging) {
      setupConsoleDebugging();
    }

    // Setup React DevTools
    setupReactDevTools();

    // Setup performance monitoring
    if (devToolsConfig.enablePerformanceMonitoring) {
      setupPerformanceMonitoring();
    }

    // Setup network debugging
    if (devToolsConfig.enableNetworkLogging) {
      setupNetworkLogging();
    }

    logger.info('Development tools initialized', devToolsConfig);
  } catch (error) {
    logger.error('Failed to initialize development tools:', error);
  }
};

/**
 * Setup enhanced console debugging
 */
const setupConsoleDebugging = (): void => {
  // Enhanced console.log with timestamps and source
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    const timestamp = new Date().toISOString();
    originalLog(`[${timestamp}] [LOG]`, ...args);
  };

  console.warn = (...args: any[]) => {
    const timestamp = new Date().toISOString();
    originalWarn(`[${timestamp}] [WARN]`, ...args);
  };

  console.error = (...args: any[]) => {
    const timestamp = new Date().toISOString();
    originalError(`[${timestamp}] [ERROR]`, ...args);
  };

  // Global error handler
  const originalHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    console.error('Global Error:', {
      message: error.message,
      stack: error.stack,
      isFatal,
    });
    
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
};

/**
 * Setup React DevTools
 */
const setupReactDevTools = (): void => {
  try {
    // Import React DevTools if available
    if (typeof require !== 'undefined') {
      const { connectToDevTools } = require('react-devtools-core');
      
      connectToDevTools({
        host: 'localhost',
        port: 8097,
        resolveRNStyle: require('react-native/Libraries/StyleSheet/flattenStyle'),
      });

      logger.info('React DevTools connected');
    }
  } catch (error) {
    logger.warn('React DevTools not available:', error);
  }
};

/**
 * Setup performance monitoring
 */
const setupPerformanceMonitoring = (): void => {
  // Monitor app startup time
  const startTime = __BUNDLE_START_TIME__ || Date.now();
  const loadTime = Date.now() - startTime;
  
  setTimeout(() => {
    logger.info('App Performance Metrics', {
      bundleLoadTime: loadTime,
      platform: Platform.OS,
      platformVersion: Platform.Version,
    });
  }, 1000);

  // Monitor component render performance
  if (typeof performance !== 'undefined' && performance.mark) {
    const originalMark = performance.mark;
    performance.mark = (name: string) => {
      logger.debug('Performance Mark:', name);
      return originalMark.call(performance, name);
    };
  }
};

/**
 * Setup network request/response logging
 */
const setupNetworkLogging = (): void => {
  // Override fetch for logging
  const originalFetch = global.fetch;
  
  global.fetch = async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    const startTime = Date.now();
    
    logger.debug('Network Request', {
      url,
      method: init?.method || 'GET',
      headers: init?.headers,
    });

    try {
      const response = await originalFetch(input, init);
      const endTime = Date.now();
      
      logger.debug('Network Response', {
        url,
        status: response.status,
        statusText: response.statusText,
        duration: endTime - startTime,
      });

      return response;
    } catch (error) {
      const endTime = Date.now();
      
      logger.error('Network Error', {
        url,
        error: error.message,
        duration: endTime - startTime,
      });

      throw error;
    }
  };

  // Override XMLHttpRequest for logging
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method: string, url: string, ...args: any[]) {
    this._method = method;
    this._url = url;
    this._startTime = Date.now();
    
    return originalXHROpen.call(this, method, url, ...args);
  };

  XMLHttpRequest.prototype.send = function(body?: any) {
    logger.debug('XHR Request', {
      method: this._method,
      url: this._url,
      body,
    });

    this.addEventListener('loadend', () => {
      const duration = Date.now() - this._startTime;
      
      logger.debug('XHR Response', {
        method: this._method,
        url: this._url,
        status: this.status,
        statusText: this.statusText,
        duration,
      });
    });

    return originalXHRSend.call(this, body);
  };
};

/**
 * Show development menu
 */
export const showDevMenu = (): void => {
  if (!__DEV__) {
    return;
  }

  const options = [
    { text: 'Reload', onPress: () => reloadApp() },
    { text: 'Debug JS Remotely', onPress: () => enableRemoteDebugging() },
    { text: 'Toggle Inspector', onPress: () => toggleInspector() },
    { text: 'Show Performance Monitor', onPress: () => showPerformanceMonitor() },
    { text: 'Clear AsyncStorage', onPress: () => clearAsyncStorage() },
    { text: 'Cancel', style: 'cancel' },
  ];

  Alert.alert('ProTour Dev Menu', 'Choose an action:', options);
};

/**
 * Reload the app
 */
export const reloadApp = (): void => {
  if (__DEV__) {
    const { DevSettings } = require('react-native');
    DevSettings.reload();
  }
};

/**
 * Enable remote debugging
 */
export const enableRemoteDebugging = (): void => {
  if (__DEV__) {
    const { NativeModules } = require('react-native');
    NativeModules.DevSettings?.setIsDebuggingRemotely(true);
  }
};

/**
 * Toggle element inspector
 */
export const toggleInspector = (): void => {
  if (__DEV__) {
    const { NativeModules } = require('react-native');
    NativeModules.DevSettings?.toggleElementInspector();
  }
};

/**
 * Show performance monitor
 */
export const showPerformanceMonitor = (): void => {
  if (__DEV__) {
    const { NativeModules } = require('react-native');
    NativeModules.DevSettings?.showFPS(true);
  }
};

/**
 * Clear AsyncStorage for testing
 */
export const clearAsyncStorage = async (): Promise<void> => {
  try {
    await AsyncStorage.clear();
    Alert.alert('Success', 'AsyncStorage cleared successfully');
    logger.info('AsyncStorage cleared');
  } catch (error) {
    Alert.alert('Error', 'Failed to clear AsyncStorage');
    logger.error('Failed to clear AsyncStorage:', error);
  }
};

/**
 * Update development tools configuration
 */
export const updateDevToolsConfig = async (newConfig: Partial<DevToolsConfig>): Promise<void> => {
  devToolsConfig = { ...devToolsConfig, ...newConfig };
  
  try {
    await AsyncStorage.setItem('devtools_config', JSON.stringify(devToolsConfig));
    logger.info('Development tools configuration updated', devToolsConfig);
  } catch (error) {
    logger.error('Failed to save development tools configuration:', error);
  }
};

/**
 * Get current development tools configuration
 */
export const getDevToolsConfig = (): DevToolsConfig => {
  return devToolsConfig;
};

export default {
  initialize: initializeDevTools,
  showDevMenu,
  reloadApp,
  updateConfig: updateDevToolsConfig,
  getConfig: getDevToolsConfig,
};
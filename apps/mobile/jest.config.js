/**
 * Jest configuration for ProTour Mobile App
 */

module.exports = {
  preset: 'react-native',
  
  // Root directory for tests
  rootDir: '.',
  
  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx|js)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx|js)',
    '<rootDir>/__tests__/**/*.(ts|tsx|js)',
  ],
  
  // Setup files
  setupFiles: [
    '<rootDir>/src/setupTests.ts',
  ],
  
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTestsAfterEnv.ts',
    '@testing-library/jest-native/extend-expect',
  ],
  
  // Module paths and aliases
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@protour/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
  ],
  
  // Transform ignore patterns (don't transform these node_modules)
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vector-icons|@react-native-firebase|@react-navigation|native-base|react-native-svg|react-native-reanimated|@react-native-async-storage)/)',
  ],
  
  // Coverage configuration
  collectCoverage: false, // Enable via CLI or CI
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/setupTests.ts',
    '!src/setupTestsAfterEnv.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/index.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
  ],
  
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
  ],
  
  coverageDirectory: '<rootDir>/coverage',
  
  // Globals
  globals: {
    __DEV__: true,
  },
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: false,
  
  // Timeouts
  testTimeout: 10000,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Cache
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  
  // Reporters for CI/CD
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
  ],
  
  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
  ],
};
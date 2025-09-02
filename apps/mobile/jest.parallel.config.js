/**
 * Jest parallel execution configuration for CI/CD
 */

const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  
  // Enable parallel execution
  maxWorkers: '50%', // Use 50% of available CPU cores
  
  // Optimize for CI environment
  cache: false,
  ci: true,
  
  // Faster test execution
  testTimeout: 5000, // Reduced timeout for faster feedback
  
  // Parallel test execution options
  runInBand: false, // Allow parallel execution
  
  // Coverage optimizations for CI
  collectCoverage: true,
  coverageReporters: ['text-summary', 'lcov', 'json'],
  
  // Reporters optimized for CI
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test-results',
        outputName: 'junit-parallel.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/test-results',
        filename: 'test-report.html',
        expand: true,
        hideIcon: true,
        pageTitle: 'ProTour Mobile Test Results',
      },
    ],
  ],
  
  // Test result processors
  testResultsProcessor: 'jest-sonar-reporter',
  
  // Bail configuration for faster feedback
  bail: 1, // Stop on first test failure in CI
  
  // Memory management
  maxConcurrency: 5, // Limit concurrent tests to prevent memory issues
  
  // Verbose output for CI debugging
  verbose: true,
  
  // Force exit to prevent hanging in CI
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true,
};
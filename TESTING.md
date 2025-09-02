# Testing Infrastructure Guide

This guide covers the comprehensive testing infrastructure for ProTour, including unit tests, integration tests, and end-to-end testing.

## Overview

ProTour uses a multi-layered testing approach:
- **Unit Tests** - Individual component and function testing
- **Integration Tests** - Firebase integration and API testing
- **End-to-End Tests** - Full user workflow testing with Detox
- **Performance Tests** - Load testing and performance benchmarks

## Testing Stack

### Mobile Testing
- **Jest** - Test runner and assertion library
- **React Native Testing Library** - Component testing utilities
- **Detox** - End-to-end mobile testing framework
- **Firebase Emulators** - Local Firebase services for testing

### Backend Testing
- **Jest** - Unit and integration testing
- **Firebase Test SDK** - Firebase Functions testing
- **Supertest** - HTTP API testing

### Coverage & Reporting
- **Jest Coverage** - Code coverage reporting (80% minimum)
- **Jest HTML Reporter** - Visual test reports
- **Jest JUnit Reporter** - CI/CD integration

## Quick Start

### Run All Tests
```bash
# Run all test suites
npm test

# Run tests with coverage
npm run test:ci

# Run specific test types
npm run test:mobile
npm run test:functions
npm run test:shared
```

### Mobile App Testing
```bash
cd apps/mobile

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### E2E Testing
```bash
cd apps/mobile

# Build E2E test app
npm run test:e2e:build

# Run on iOS simulator
npm run test:e2e:ios

# Run on Android emulator
npm run test:e2e:android
```

## Test Structure

### Directory Organization
```
ProTour/
├── apps/mobile/
│   ├── src/
│   │   ├── __tests__/          # Unit tests
│   │   ├── components/
│   │   │   └── Button.test.tsx
│   │   ├── utils/
│   │   │   ├── testHelpers.ts
│   │   │   └── api.integration.test.ts
│   │   ├── setupTests.ts
│   │   └── setupTestsAfterEnv.ts
│   ├── e2e/                    # E2E tests
│   │   ├── app.e2e.ts
│   │   ├── multiDevice.e2e.ts
│   │   └── setup.ts
│   ├── jest.config.js
│   └── .detoxrc.js
├── functions/
│   ├── src/
│   │   ├── __tests__/
│   │   └── *.test.ts
│   └── jest.config.js
├── packages/shared/
│   ├── src/
│   │   ├── __tests__/
│   │   └── *.test.ts
│   └── jest.config.js
└── scripts/
    └── test-reporting.js
```

### Test File Naming Conventions
- `*.test.ts/tsx` - Unit tests
- `*.integration.test.ts/tsx` - Integration tests  
- `*.e2e.ts` - End-to-end tests
- `*.perf.test.ts` - Performance tests
- `__mocks__/` - Manual mocks
- `setupTests.ts` - Test environment setup

## Writing Tests

### Unit Tests

```typescript
// Button.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button Component', () => {
  it('should render with correct text', () => {
    const { getByText } = render(
      <Button title="Click me" onPress={jest.fn()} />
    );
    
    expect(getByText('Click me')).toBeVisible();
  });

  it('should call onPress when pressed', () => {
    const mockPress = jest.fn();
    const { getByText } = render(
      <Button title="Click me" onPress={mockPress} />
    );
    
    fireEvent.press(getByText('Click me'));
    expect(mockPress).toHaveBeenCalledTimes(1);
  });

  it('should have valid accessibility props', () => {
    const { getByText } = render(
      <Button title="Click me" onPress={jest.fn()} />
    );
    
    expect(getByText('Click me')).toHaveValidAccessibility();
  });
});
```

### Integration Tests

```typescript
// auth.integration.test.ts
import { AuthTestHelpers, DatabaseTestHelpers } from '../utils/testHelpers';

describe('Authentication Integration', () => {
  beforeEach(async () => {
    await DatabaseTestHelpers.setup();
  });

  afterEach(async () => {
    await DatabaseTestHelpers.teardown();
    await AuthTestHelpers.signOut();
  });

  it('should create user profile on signup', async () => {
    const email = 'test@example.com';
    const password = 'testpass123';
    
    await AuthTestHelpers.signInTestUser(email, password);
    
    const userProfile = await DatabaseTestHelpers.waitForDoc('users', 'test-user-id');
    expect(userProfile).toBeDefined();
    expect(userProfile.email).toBe(email);
  });
});
```

### E2E Tests

```typescript
// tournament.e2e.ts
import { device, expect, element, by } from 'detox';

describe('Tournament Management', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should create new tournament', async () => {
    // Navigate to create tournament
    await element(by.id('create-tournament-button')).tap();
    
    // Fill tournament details
    await element(by.id('tournament-name-input')).typeText('Test Tournament');
    await element(by.id('tournament-date-picker')).tap();
    
    // Save tournament
    await element(by.id('save-tournament-button')).tap();
    
    // Verify tournament created
    await expect(element(by.text('Test Tournament'))).toBeVisible();
  });
});
```

## Test Utilities & Helpers

### Global Test Helpers

The testing infrastructure includes comprehensive helpers:

```typescript
// Available global helpers
global.testHelpers = {
  waitFor: (condition, timeout) => Promise<boolean>,
  createMockNavigation: (overrides) => MockNavigation,
  createMockRoute: (params, overrides) => MockRoute,
  createMockTournament: (overrides) => MockTournament,
  createMockUser: (overrides) => MockUser,
  createMockMatch: (overrides) => MockMatch,
  createMockFirebaseUser: (overrides) => MockFirebaseUser,
};
```

### Database Test Helpers

```typescript
import { DatabaseTestHelpers } from '../utils/testHelpers';

// Setup test data
const tournament = await DatabaseTestHelpers.createTestTournament({
  name: 'Test Tournament',
  maxParticipants: 32,
});

const user = await DatabaseTestHelpers.createTestUser({
  email: 'player@example.com',
  role: 'player',
});

// Clean up after tests
await DatabaseTestHelpers.clearCollection('tournaments');
```

### Authentication Test Helpers

```typescript
import { AuthTestHelpers } from '../utils/testHelpers';

// Sign in test user
await AuthTestHelpers.signInTestUser('admin@example.com');

// Set custom claims
const adminUser = await AuthTestHelpers.setCustomClaims('user-id', {
  admin: true,
  role: 'organizer',
});
```

## Firebase Emulator Testing

### Setup
Firebase emulators are automatically configured for testing:

```typescript
// Emulator configuration
export const FIREBASE_EMULATOR_CONFIG = {
  auth: { host: 'localhost', port: 9099 },
  firestore: { host: 'localhost', port: 8080 },
  functions: { host: 'localhost', port: 5001 },
  storage: { host: 'localhost', port: 9199 },
};
```

### Integration Test Example
```typescript
describe('Tournament Creation', () => {
  beforeEach(async () => {
    await setupFirebaseEmulators();
    await cleanupFirebaseEmulators();
  });

  it('should create tournament in Firestore', async () => {
    const tournament = await DatabaseTestHelpers.createTestTournament({
      name: 'Firebase Test Tournament',
    });

    expect(tournament.id).toBeDefined();
    expect(tournament.name).toBe('Firebase Test Tournament');
  });
});
```

## Coverage Requirements

### Minimum Coverage Thresholds
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

### Coverage Reports
- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV Report**: `coverage/lcov.info`
- **JSON Report**: `coverage/coverage-final.json`
- **Text Summary**: Console output during test runs

## Continuous Integration

### CI Test Configuration
```bash
# Parallel test execution for CI
npm run test:ci

# Individual package testing
npm run test:mobile:ci
npm run test:functions:ci
npm run test:shared:ci

# Generate test reports
npm run test:report
```

### Pre-commit Testing
Tests run automatically on commit:
- Related unit tests for changed files
- Type checking for affected packages
- Linting and formatting

### Test Reporting
Automated test reports include:
- Test result summaries
- Coverage metrics
- Failed test details
- Performance metrics
- HTML and JSON reports

## Performance Testing

### Performance Test Example
```typescript
import { PerformanceTestHelpers } from '../utils/testHelpers';

describe('Tournament Loading Performance', () => {
  it('should load tournament list within 2 seconds', async () => {
    const startTime = PerformanceTestHelpers.startMeasurement('tournament-load');
    
    // Load tournament list
    await loadTournamentList();
    
    const duration = PerformanceTestHelpers.endMeasurement('tournament-load', startTime);
    
    expect(duration).toBeLessThan(2000);
  });
});
```

## Best Practices

### Test Organization
- Group related tests in `describe` blocks
- Use descriptive test names that explain the expected behavior
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests focused and atomic

### Mock Strategy
- Mock external dependencies (Firebase, APIs)
- Use real implementations for internal utilities
- Avoid over-mocking - test real behavior when possible
- Mock time-dependent functionality consistently

### Test Data Management
- Use factory functions for test data creation
- Clean up test data after each test
- Use unique identifiers to avoid test conflicts
- Keep test data minimal and focused

### Error Testing
- Test both happy path and error scenarios
- Verify error messages and error states
- Test edge cases and boundary conditions
- Ensure graceful error handling

### Accessibility Testing
- Test keyboard navigation
- Verify screen reader compatibility
- Check color contrast and text size
- Test with accessibility tools enabled

## Debugging Tests

### Common Issues
```bash
# Clear Jest cache
npm run test -- --clearCache

# Run tests in verbose mode
npm run test -- --verbose

# Run specific test file
npm run test Button.test.tsx

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Debugging E2E Tests
```bash
# Run Detox with debug logs
npm run test:e2e -- --loglevel verbose

# Take screenshots on failure
npm run test:e2e -- --take-screenshots failing

# Record test videos
npm run test:e2e -- --record-videos failing
```

## Test Maintenance

### Updating Test Dependencies
```bash
# Update testing dependencies
npm update @testing-library/react-native jest detox

# Check for security vulnerabilities
npm audit

# Update snapshots
npm run test -- --updateSnapshot
```

### Performance Monitoring
- Monitor test execution times
- Optimize slow tests
- Use parallel execution in CI
- Profile memory usage for large test suites

## Troubleshooting

### Common Test Failures
- **Mock issues**: Ensure mocks match real API signatures
- **Timing issues**: Use `waitFor` for async operations
- **Environment issues**: Check Firebase emulator connectivity
- **Memory leaks**: Properly clean up test resources

### E2E Test Issues
- **Device not found**: Check simulator/emulator availability
- **App not found**: Rebuild test app with `npm run test:e2e:build`
- **Element not found**: Use Detox debug mode to inspect UI
- **Timing issues**: Add appropriate wait conditions

For additional support, check the test utilities in `src/utils/testHelpers.ts` and refer to the Jest and Detox documentation.
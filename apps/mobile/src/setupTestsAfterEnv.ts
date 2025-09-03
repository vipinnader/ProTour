/**
 * Jest setup after environment - runs after test environment is set up
 * This file contains additional test configuration and custom matchers
 */

import { cleanup } from '@testing-library/react-native';

// Clean up after each test
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

// Custom matchers for better assertions
expect.extend({
  toBeVisibleOnScreen(received) {
    const pass =
      received && received.props && received.props.style?.display !== 'none';

    if (pass) {
      return {
        message: () => `expected element not to be visible on screen`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected element to be visible on screen`,
        pass: false,
      };
    }
  },

  toHaveValidAccessibility(received) {
    const hasAccessibilityLabel =
      received && received.props && received.props.accessibilityLabel;
    const hasAccessibilityRole =
      received && received.props && received.props.accessibilityRole;

    const pass = hasAccessibilityLabel || hasAccessibilityRole;

    if (pass) {
      return {
        message: () => `expected element not to have valid accessibility props`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected element to have accessibilityLabel or accessibilityRole`,
        pass: false,
      };
    }
  },
});

// Global test helpers
global.testHelpers = {
  // Wait for async operations
  waitFor: async (callback: () => boolean, timeout = 5000) => {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (callback()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },

  // Create mock navigation props
  createMockNavigation: (overrides = {}) => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    setParams: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => false),
    ...overrides,
  }),

  // Create mock route props
  createMockRoute: (params = {}, overrides = {}) => ({
    key: 'test-route',
    name: 'TestScreen',
    params,
    ...overrides,
  }),

  // Create mock tournament data
  createMockTournament: (overrides = {}) => ({
    id: 'test-tournament-1',
    name: 'Test Tournament',
    description: 'A test tournament for unit tests',
    ownerId: 'test-user-1',
    organizerIds: ['test-user-1'],
    refereeIds: [],
    status: 'draft',
    isPublic: true,
    maxParticipants: 32,
    participantCount: 0,
    startDate: new Date('2024-07-15'),
    endDate: new Date('2024-07-16'),
    registrationDeadline: new Date('2024-07-10'),
    venue: 'Test Venue',
    rules: 'Test rules',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Create mock user data
  createMockUser: (overrides = {}) => ({
    uid: 'test-user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
    isActive: true,
    role: 'player',
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {
      notifications: {
        email: true,
        sms: false,
        push: true,
      },
      privacy: {
        showProfile: true,
        showStats: true,
      },
    },
    ...overrides,
  }),

  // Create mock match data
  createMockMatch: (overrides = {}) => ({
    id: 'test-match-1',
    tournamentId: 'test-tournament-1',
    player1Id: 'test-player-1',
    player2Id: 'test-player-2',
    status: 'scheduled',
    round: 1,
    scheduledTime: new Date('2024-07-15T10:00:00Z'),
    score: null,
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Mock Firebase auth user
  createMockFirebaseUser: (overrides = {}) => ({
    uid: 'test-user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
    emailVerified: true,
    getIdToken: jest.fn(() => Promise.resolve('mock-token')),
    getIdTokenResult: jest.fn(() =>
      Promise.resolve({
        token: 'mock-token',
        claims: { role: 'player' },
      })
    ),
    ...overrides,
  }),
};

// Extend global types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeVisibleOnScreen(): R;
      toHaveValidAccessibility(): R;
    }
  }

  var testHelpers: {
    waitFor: (callback: () => boolean, timeout?: number) => Promise<boolean>;
    createMockNavigation: (overrides?: any) => any;
    createMockRoute: (params?: any, overrides?: any) => any;
    createMockTournament: (overrides?: any) => any;
    createMockUser: (overrides?: any) => any;
    createMockMatch: (overrides?: any) => any;
    createMockFirebaseUser: (overrides?: any) => any;
  };
}

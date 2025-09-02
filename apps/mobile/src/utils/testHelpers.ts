/**
 * Test helpers and utilities for ProTour mobile app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase emulator configuration for tests
export const FIREBASE_EMULATOR_CONFIG = {
  auth: {
    host: 'localhost',
    port: 9099,
  },
  firestore: {
    host: 'localhost',
    port: 8080,
  },
  functions: {
    host: 'localhost',
    port: 5001,
  },
  storage: {
    host: 'localhost',
    port: 9199,
  },
};

/**
 * Set up Firebase emulators for integration tests
 */
export const setupFirebaseEmulators = async () => {
  if (!__DEV__) return;

  try {
    // Import Firebase modules
    const auth = require('@react-native-firebase/auth').default;
    const firestore = require('@react-native-firebase/firestore').default;
    const functions = require('@react-native-firebase/functions').default;
    const storage = require('@react-native-firebase/storage').default;

    // Connect to emulators
    auth().useEmulator(`http://${FIREBASE_EMULATOR_CONFIG.auth.host}:${FIREBASE_EMULATOR_CONFIG.auth.port}`);
    firestore().useEmulator(FIREBASE_EMULATOR_CONFIG.firestore.host, FIREBASE_EMULATOR_CONFIG.firestore.port);
    functions().useEmulator(FIREBASE_EMULATOR_CONFIG.functions.host, FIREBASE_EMULATOR_CONFIG.functions.port);
    storage().useEmulator(FIREBASE_EMULATOR_CONFIG.storage.host, FIREBASE_EMULATOR_CONFIG.storage.port);

    console.log('Firebase emulators connected for testing');
  } catch (error) {
    console.warn('Failed to connect to Firebase emulators:', error);
  }
};

/**
 * Clean up Firebase emulator data between tests
 */
export const cleanupFirebaseEmulators = async () => {
  if (!__DEV__) return;

  try {
    // Clear emulator data (this would typically be done via REST API calls to emulators)
    const response = await fetch(`http://localhost:8080/emulator/v1/projects/protour-dev/databases/(default)/documents`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      console.warn('Failed to clear Firestore emulator data');
    }
  } catch (error) {
    console.warn('Error cleaning up Firebase emulators:', error);
  }
};

/**
 * Database test helpers
 */
export class DatabaseTestHelpers {
  private static db: any;

  static async setup() {
    if (!this.db) {
      const firestore = require('@react-native-firebase/firestore').default;
      this.db = firestore();
    }
    return this.db;
  }

  static async teardown() {
    // Clean up test data
    await cleanupFirebaseEmulators();
  }

  static async createTestTournament(data = {}) {
    const db = await this.setup();
    const tournament = testHelpers.createMockTournament(data);
    
    const docRef = await db.collection('tournaments').add(tournament);
    return { ...tournament, id: docRef.id };
  }

  static async createTestUser(data = {}) {
    const db = await this.setup();
    const user = testHelpers.createMockUser(data);
    
    await db.collection('users').doc(user.uid).set(user);
    return user;
  }

  static async createTestMatch(tournamentId: string, data = {}) {
    const db = await this.setup();
    const match = testHelpers.createMockMatch({ tournamentId, ...data });
    
    const docRef = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .add(match);
    
    return { ...match, id: docRef.id };
  }

  static async clearCollection(collectionPath: string) {
    const db = await this.setup();
    const snapshot = await db.collection(collectionPath).get();
    
    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }

  static async waitForDoc(collectionPath: string, docId: string, timeout = 5000) {
    const db = await this.setup();
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const doc = await db.collection(collectionPath).doc(docId).get();
      if (doc.exists) {
        return doc.data();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Document ${collectionPath}/${docId} not found within ${timeout}ms`);
  }
}

/**
 * Authentication test helpers
 */
export class AuthTestHelpers {
  private static auth: any;

  static async setup() {
    if (!this.auth) {
      const auth = require('@react-native-firebase/auth').default;
      this.auth = auth();
    }
    return this.auth;
  }

  static async signInTestUser(email = 'test@example.com', password = 'testpass123') {
    const auth = await this.setup();
    
    try {
      // Try to create user first (might already exist)
      await auth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
      // User might already exist, ignore error
    }
    
    return auth.signInWithEmailAndPassword(email, password);
  }

  static async signOut() {
    const auth = await this.setup();
    return auth.signOut();
  }

  static async getCurrentUser() {
    const auth = await this.setup();
    return auth.currentUser;
  }

  static async setCustomClaims(uid: string, claims: Record<string, any>) {
    // This would typically be done via Admin SDK in the backend
    // For tests, we'll mock this functionality
    const mockUser = {
      uid,
      getIdTokenResult: jest.fn(() => Promise.resolve({
        token: 'mock-token',
        claims: { ...claims, role: claims.role || 'player' },
      })),
    };
    
    return mockUser;
  }

  static createMockAuthUser(overrides = {}) {
    return testHelpers.createMockFirebaseUser(overrides);
  }
}

/**
 * API test utilities
 */
export class APITestHelpers {
  private static baseURL = 'http://localhost:5001/protour-dev/us-central1';

  static async callFunction(functionName: string, data = {}) {
    const response = await fetch(`${this.baseURL}/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      throw new Error(`Function call failed: ${response.statusText}`);
    }

    return response.json();
  }

  static mockFetchResponse(data: any, status = 200) {
    return jest.fn(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
      })
    );
  }

  static mockFetchError(message = 'Network error') {
    return jest.fn(() => Promise.reject(new Error(message)));
  }
}

/**
 * Storage test helpers
 */
export class StorageTestHelpers {
  static async clearStorage() {
    await AsyncStorage.clear();
  }

  static async setStorageItem(key: string, value: any) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  static async getStorageItem(key: string) {
    const item = await AsyncStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  }

  static mockStorageError() {
    const originalImpl = AsyncStorage.getItem;
    AsyncStorage.getItem = jest.fn(() => Promise.reject(new Error('Storage error')));
    
    return () => {
      AsyncStorage.getItem = originalImpl;
    };
  }
}

/**
 * Test data generators
 */
export class TestDataGenerators {
  static generateTournamentData(count = 5, overrides = {}) {
    return Array.from({ length: count }, (_, index) => 
      testHelpers.createMockTournament({
        id: `tournament-${index + 1}`,
        name: `Tournament ${index + 1}`,
        ...overrides,
      })
    );
  }

  static generateUserData(count = 10, overrides = {}) {
    return Array.from({ length: count }, (_, index) => 
      testHelpers.createMockUser({
        uid: `user-${index + 1}`,
        email: `user${index + 1}@example.com`,
        displayName: `User ${index + 1}`,
        ...overrides,
      })
    );
  }

  static generateMatchData(tournamentId: string, playerIds: string[], overrides = {}) {
    const matches = [];
    
    for (let i = 0; i < playerIds.length - 1; i += 2) {
      matches.push(
        testHelpers.createMockMatch({
          id: `match-${i / 2 + 1}`,
          tournamentId,
          player1Id: playerIds[i],
          player2Id: playerIds[i + 1],
          round: 1,
          ...overrides,
        })
      );
    }
    
    return matches;
  }

  static generateBracket(playerIds: string[], tournamentId: string) {
    const rounds = [];
    let currentPlayers = [...playerIds];
    let roundNumber = 1;
    
    while (currentPlayers.length > 1) {
      const roundMatches = [];
      const nextRoundPlayers = [];
      
      for (let i = 0; i < currentPlayers.length; i += 2) {
        const matchId = `round-${roundNumber}-match-${i / 2 + 1}`;
        const match = testHelpers.createMockMatch({
          id: matchId,
          tournamentId,
          player1Id: currentPlayers[i],
          player2Id: currentPlayers[i + 1] || null,
          round: roundNumber,
        });
        
        roundMatches.push(match);
        nextRoundPlayers.push(`winner-of-${matchId}`);
      }
      
      rounds.push(roundMatches);
      currentPlayers = nextRoundPlayers;
      roundNumber++;
    }
    
    return rounds;
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestHelpers {
  private static measurements: Record<string, number[]> = {};

  static startMeasurement(name: string) {
    return Date.now();
  }

  static endMeasurement(name: string, startTime: number) {
    const duration = Date.now() - startTime;
    
    if (!this.measurements[name]) {
      this.measurements[name] = [];
    }
    
    this.measurements[name].push(duration);
    return duration;
  }

  static getMeasurements(name: string) {
    return this.measurements[name] || [];
  }

  static getAverageDuration(name: string) {
    const measurements = this.measurements[name] || [];
    if (measurements.length === 0) return 0;
    
    return measurements.reduce((sum, duration) => sum + duration, 0) / measurements.length;
  }

  static clearMeasurements(name?: string) {
    if (name) {
      delete this.measurements[name];
    } else {
      this.measurements = {};
    }
  }

  static expectPerformance(name: string, maxDuration: number) {
    const average = this.getAverageDuration(name);
    expect(average).toBeLessThan(maxDuration);
  }
}

// Export all helpers
export default {
  DatabaseTestHelpers,
  AuthTestHelpers,
  APITestHelpers,
  StorageTestHelpers,
  TestDataGenerators,
  PerformanceTestHelpers,
  setupFirebaseEmulators,
  cleanupFirebaseEmulators,
};
// Real-Time Sync Service Tests for Epic 2B.3 - Story 2B.3 Task 3 Validation
// Tests AC2B.3.5 & AC2B.3.6: Sync Queue & Conflict Management with Network Resilience

import {
  RealTimeSyncService,
  TournamentUpdate,
  SyncOperation,
  NetworkQuality,
  SyncConflict,
} from '../src/services/RealTimeSyncService';

// Mock dependencies
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
}));

jest.mock('../src/services/OfflineDataService', () => ({
  offlineDataService: {
    createOffline: jest.fn(),
    queryOffline: jest.fn(),
    updateOffline: jest.fn(),
  },
}));

jest.mock('../src/services/MultiDeviceService', () => ({
  multiDeviceService: {
    getCurrentDevice: jest.fn(() => ({
      deviceId: 'test-device',
      userId: 'test-user',
    })),
    getCurrentSession: jest.fn(() => ({ tournamentId: 'test-tournament' })),
  },
}));

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: 1, // OPEN
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

describe('RealTimeSyncService - Task 3: Sync Queue & Conflict Management', () => {
  let service: RealTimeSyncService;
  let mockWebSocket: any;

  beforeEach(() => {
    service = new RealTimeSyncService();
    mockWebSocket = new WebSocket('ws://test');
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('AC2B.3.5: Intelligent Sync Ordering', () => {
    test('should prioritize operations by priority level', async () => {
      // Create operations with different priorities
      const criticalOp: SyncOperation = {
        id: 'critical-1',
        operation: 'update',
        collection: 'matches',
        documentId: 'match-1',
        data: { score: [6, 4] },
        timestamp: Date.now(),
        priority: 'critical',
        retryCount: 0,
        maxRetries: 5,
      };

      const normalOp: SyncOperation = {
        id: 'normal-1',
        operation: 'update',
        collection: 'tournaments',
        documentId: 'tournament-1',
        data: { status: 'in_progress' },
        timestamp: Date.now() - 1000, // Older timestamp
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
      };

      const lowOp: SyncOperation = {
        id: 'low-1',
        operation: 'update',
        collection: 'players',
        documentId: 'player-1',
        data: { lastSeen: Date.now() },
        timestamp: Date.now() + 1000, // Newer timestamp
        priority: 'low',
        retryCount: 0,
        maxRetries: 2,
      };

      // Add operations to queue in wrong order
      (service as any).syncQueue.set('low-1', lowOp);
      (service as any).syncQueue.set('normal-1', normalOp);
      (service as any).syncQueue.set('critical-1', criticalOp);

      // Mock WebSocket connection
      (service as any).connection = { readyState: 1, send: jest.fn() };

      // Process sync queue
      await service.processSyncQueue();

      // Verify that operations were processed in priority order
      const sendCalls = (service as any).connection.send.mock.calls;
      expect(sendCalls.length).toBeGreaterThan(0);

      const processedOperations = sendCalls
        .map(
          (call: any) => JSON.parse(call[0]).operations || [JSON.parse(call[0])]
        )
        .flat();

      // Critical should be first, then normal, then low
      const criticalIndex = processedOperations.findIndex(
        (op: any) => op.id === 'critical-1'
      );
      const normalIndex = processedOperations.findIndex(
        (op: any) => op.id === 'normal-1'
      );
      const lowIndex = processedOperations.findIndex(
        (op: any) => op.id === 'low-1'
      );

      expect(criticalIndex).toBeLessThan(normalIndex);
      expect(normalIndex).toBeLessThan(lowIndex);
    });

    test('should order operations by timestamp within same priority', async () => {
      const earlyOp: SyncOperation = {
        id: 'early-1',
        operation: 'create',
        collection: 'matches',
        documentId: 'match-1',
        timestamp: 1000,
        priority: 'high',
        retryCount: 0,
        maxRetries: 3,
        data: {},
      };

      const lateOp: SyncOperation = {
        id: 'late-1',
        operation: 'create',
        collection: 'matches',
        documentId: 'match-2',
        timestamp: 2000,
        priority: 'high',
        retryCount: 0,
        maxRetries: 3,
        data: {},
      };

      // Add in wrong order
      (service as any).syncQueue.set('late-1', lateOp);
      (service as any).syncQueue.set('early-1', earlyOp);

      (service as any).connection = { readyState: 1, send: jest.fn() };

      await service.processSyncQueue();

      const sendCalls = (service as any).connection.send.mock.calls;
      const processedOperations = sendCalls
        .map(
          (call: any) => JSON.parse(call[0]).operations || [JSON.parse(call[0])]
        )
        .flat();

      const earlyIndex = processedOperations.findIndex(
        (op: any) => op.id === 'early-1'
      );
      const lateIndex = processedOperations.findIndex(
        (op: any) => op.id === 'late-1'
      );

      // Earlier timestamp should be processed first
      expect(earlyIndex).toBeLessThan(lateIndex);
    });

    test('should batch process operations efficiently', async () => {
      // Create multiple operations
      const operations = [];
      for (let i = 0; i < 15; i++) {
        const op: SyncOperation = {
          id: `op-${i}`,
          operation: 'update',
          collection: 'matches',
          documentId: `match-${i}`,
          timestamp: Date.now() + i,
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
          data: { updated: true },
        };
        operations.push(op);
        (service as any).syncQueue.set(op.id, op);
      }

      // Mock connection and network quality
      (service as any).connection = { readyState: 1, send: jest.fn() };
      (service as any).networkQuality = { effectiveType: '4g' };

      await service.processSyncQueue();

      // Should batch operations (4G batch size is 20, so all should fit in one batch)
      const sendCalls = (service as any).connection.send.mock.calls;
      expect(sendCalls.length).toBeGreaterThan(0);

      // Verify all operations were processed
      expect((service as any).syncQueue.size).toBe(0);
    });
  });

  describe('AC2B.3.6: Network Resilience with Exponential Backoff', () => {
    test('should adapt batch size based on network quality', async () => {
      const operations = [];
      for (let i = 0; i < 25; i++) {
        const op: SyncOperation = {
          id: `op-${i}`,
          operation: 'update',
          collection: 'matches',
          documentId: `match-${i}`,
          timestamp: Date.now() + i,
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
          data: {},
        };
        operations.push(op);
        (service as any).syncQueue.set(op.id, op);
      }

      (service as any).connection = { readyState: 1, send: jest.fn() };

      // Test 2G network - should use smaller batches
      (service as any).networkQuality = { effectiveType: '2g' };
      const batchSize2G = (service as any).getBatchSizeForNetwork();
      expect(batchSize2G).toBe(5);

      // Test 4G network - should use larger batches
      (service as any).networkQuality = { effectiveType: '4g' };
      const batchSize4G = (service as any).getBatchSizeForNetwork();
      expect(batchSize4G).toBe(20);
    });

    test('should handle network connectivity changes', () => {
      const networkQuality: NetworkQuality = {
        type: 'cellular',
        effectiveType: '2g',
        downlink: 0.1,
        rtt: 2000,
        isOnline: true,
        isInternetReachable: true,
      };

      service.optimizeForNetwork(networkQuality);

      expect((service as any).networkQuality).toEqual(networkQuality);
    });

    test('should implement exponential backoff for reconnection', done => {
      const userId = 'test-user';
      const role = 'organizer';

      // Mock failed connection attempts
      let attemptCount = 0;
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback, delay) => {
        attemptCount++;

        // Verify exponential backoff delays
        if (attemptCount === 1) {
          expect(delay).toBe(1000); // First retry: 1s
        } else if (attemptCount === 2) {
          expect(delay).toBe(2000); // Second retry: 2s
        } else if (attemptCount === 3) {
          expect(delay).toBe(4000); // Third retry: 4s
        }

        if (attemptCount <= 3) {
          // Simulate continued failures for first few attempts
          callback();
        }

        if (attemptCount === 3) {
          global.setTimeout = originalSetTimeout;
          done();
        }

        return 123; // Mock timer ID
      }) as any;

      // Trigger reconnection attempts
      (service as any).reconnectAttempts = 0;
      (service as any).scheduleReconnection(userId, role);
    });

    test('should stop reconnection after max attempts', () => {
      const emitSpy = jest.spyOn(service as any, 'emit');

      // Set max attempts reached
      (service as any).reconnectAttempts = 10;
      (service as any).maxReconnectAttempts = 10;

      (service as any).scheduleReconnection('test-user', 'organizer');

      expect(emitSpy).toHaveBeenCalledWith('reconnectionFailed', {
        attempts: 10,
      });
    });

    test('should handle degraded functionality during poor connectivity', () => {
      const poorNetworkQuality: NetworkQuality = {
        type: 'cellular',
        effectiveType: '2g',
        downlink: 0.1,
        rtt: 3000,
        isOnline: true,
        isInternetReachable: false,
      };

      service.optimizeForNetwork(poorNetworkQuality);

      // Should enable low bandwidth mode
      expect((service as any).networkQuality.effectiveType).toBe('2g');
    });

    test('should queue operations when offline', async () => {
      const update: TournamentUpdate = {
        id: 'update-1',
        type: 'score_update',
        tournamentId: 'tournament-1',
        matchId: 'match-1',
        data: { score: [6, 4] },
        timestamp: Date.now(),
        deviceId: 'device-1',
        userId: 'user-1',
        priority: 'high',
        requiresBroadcast: true,
      };

      // Simulate offline connection
      (service as any).connection = null;

      const result = await service.broadcastUpdate(update);

      expect(result.success).toBe(false);
      expect(result.failedDeliveries).toContain('offline');
      expect((service as any).syncQueue.size).toBeGreaterThan(0);
    });
  });

  describe('Conflict Detection and Resolution', () => {
    test('should detect simultaneous score entries', async () => {
      const mockConflict: SyncConflict = {
        conflictId: 'conflict-1',
        collection: 'matches',
        documentId: 'match-1',
        localChange: { score: [6, 4] },
        remoteChange: { score: [4, 6] },
        timestamp: Date.now(),
        severity: 'critical',
      };

      const handleSyncConflictSpy = jest.spyOn(
        service as any,
        'handleSyncConflict'
      );

      // Simulate receiving a conflict message
      const messageData = JSON.stringify({
        type: 'sync_conflict',
        conflict: mockConflict,
        timestamp: Date.now(),
      });

      (service as any).handleIncomingMessage(messageData);

      expect(handleSyncConflictSpy).toHaveBeenCalledWith(mockConflict);
    });

    test('should emit conflict events for manual resolution', () => {
      const emitSpy = jest.spyOn(service as any, 'emit');
      const mockConflict: SyncConflict = {
        conflictId: 'conflict-1',
        collection: 'matches',
        documentId: 'match-1',
        localChange: { score: [6, 4] },
        remoteChange: { score: [4, 6] },
        timestamp: Date.now(),
        severity: 'critical',
      };

      (service as any).handleSyncConflict(mockConflict);

      expect(emitSpy).toHaveBeenCalledWith('sync_conflict', mockConflict);
    });

    test('should maintain data integrity during sync operations', async () => {
      const update: TournamentUpdate = {
        id: 'update-1',
        type: 'match_status',
        tournamentId: 'tournament-1',
        matchId: 'match-1',
        data: { status: 'completed', winnerId: 'player-1' },
        timestamp: Date.now(),
        deviceId: 'device-1',
        userId: 'user-1',
        priority: 'high',
        requiresBroadcast: true,
      };

      // Mock successful connection
      (service as any).connection = {
        readyState: 1,
        send: jest.fn(),
      };

      const storeUpdateSpy = jest.spyOn(service as any, 'storeUpdateLocally');

      await service.broadcastUpdate(update);

      // Should store locally first (offline-first architecture)
      expect(storeUpdateSpy).toHaveBeenCalledWith(update);
    });
  });

  describe('Real-time Performance and Latency', () => {
    test('should track connection statistics', () => {
      const stats = service.getConnectionStats();

      expect(stats).toHaveProperty('isConnected');
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('totalUpdates');
      expect(stats).toHaveProperty('successfulUpdates');
      expect(stats).toHaveProperty('failedUpdates');
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('networkQuality');
    });

    test('should update average latency correctly', () => {
      // Access private method for testing
      const updateLatency = (service as any).updateAverageLatency.bind(service);

      // First latency measurement
      updateLatency(100);
      expect((service as any).connectionStats.averageLatency).toBe(100);

      // Second measurement should use exponential moving average
      updateLatency(200);
      const expectedAverage = 100 * 0.9 + 200 * 0.1; // alpha = 0.1
      expect((service as any).connectionStats.averageLatency).toBe(
        expectedAverage
      );
    });

    test('should handle message parsing errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Send invalid JSON
      (service as any).handleIncomingMessage('invalid json {');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse incoming message:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Event System and Subscriptions', () => {
    test('should allow subscription and unsubscription to events', () => {
      const mockListener = jest.fn();

      // Subscribe to event
      const unsubscribe = service.subscribe('tournament_update', mockListener);

      // Emit event
      (service as any).emit('tournament_update', { test: 'data' });

      expect(mockListener).toHaveBeenCalledWith({ test: 'data' });

      // Unsubscribe
      unsubscribe();

      // Emit again - should not call listener
      (service as any).emit('tournament_update', { test: 'data2' });

      expect(mockListener).toHaveBeenCalledTimes(1); // Only called once
    });

    test('should handle listener errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const failingListener = jest.fn(() => {
        throw new Error('Listener error');
      });

      service.subscribe('test_event', failingListener);
      (service as any).emit('test_event', {});

      expect(consoleSpy).toHaveBeenCalledWith(
        'Event listener error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Data Compression and Optimization', () => {
    test('should compress data for network transmission', () => {
      const testData = {
        matchId: 'match-123',
        players: ['player1', 'player2'],
        scores: [6, 4, 6, 7],
        tournament: 'Test Tournament with Long Name',
      };

      const compressed = (service as any).compressData(testData);
      const original = JSON.stringify(testData);

      expect(compressed.length).toBeLessThanOrEqual(original.length);
    });

    test('should handle compression errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Try to compress circular reference
      const circularData: any = { test: 'data' };
      circularData.self = circularData;

      const result = (service as any).compressData(circularData);

      // Should handle error and return fallback
      expect(typeof result).toBe('string');

      consoleSpy.mockRestore();
    });
  });

  describe('Connection Management', () => {
    test('should establish WebSocket connection with proper configuration', async () => {
      const mockWS = {
        readyState: 0, // CONNECTING
        onopen: null as any,
        onmessage: null as any,
        onclose: null as any,
        onerror: null as any,
        send: jest.fn(),
        close: jest.fn(),
      };

      (global.WebSocket as jest.Mock).mockImplementation(() => mockWS);

      const connectionPromise = service.establishConnection(
        'test-user',
        'organizer'
      );

      // Simulate successful connection
      setTimeout(() => {
        mockWS.readyState = 1; // OPEN
        if (mockWS.onopen) mockWS.onopen({});
      }, 10);

      const connection = await connectionPromise;

      expect(connection.userId).toBe('test-user');
      expect(connection.role).toBe('organizer');
      expect(connection.isActive).toBe(true);
    });

    test('should handle connection timeout', async () => {
      const mockWS = {
        readyState: 0, // CONNECTING - never opens
        onopen: null as any,
        onerror: null as any,
        send: jest.fn(),
        close: jest.fn(),
      };

      (global.WebSocket as jest.Mock).mockImplementation(() => mockWS);

      // Should timeout after 10 seconds
      await expect(
        service.establishConnection('test-user', 'organizer')
      ).rejects.toThrow('WebSocket connection timeout');
    }, 11000);

    test('should clean up resources properly', () => {
      const mockConnection = {
        readyState: 1,
        close: jest.fn(),
      };

      (service as any).connection = mockConnection;
      (service as any).syncQueue.set('test', {} as SyncOperation);

      service.cleanup();

      expect(mockConnection.close).toHaveBeenCalledWith(
        1000,
        'Manual disconnect'
      );
      expect((service as any).syncQueue.size).toBe(0);
    });
  });
});

// Integration tests for end-to-end scenarios
describe('RealTimeSyncService Integration Tests', () => {
  let service: RealTimeSyncService;

  beforeEach(() => {
    service = new RealTimeSyncService();
  });

  afterEach(() => {
    service.cleanup();
  });

  test('should handle complete tournament update flow', async () => {
    // Mock WebSocket connection
    const mockConnection = {
      readyState: 1,
      send: jest.fn(),
      close: jest.fn(),
    };
    (service as any).connection = mockConnection;

    const tournamentUpdate: TournamentUpdate = {
      id: 'update-complete-flow',
      type: 'bracket_update',
      tournamentId: 'tournament-integration',
      data: {
        bracket: { round1: ['player1', 'player2'] },
        updatedAt: Date.now(),
      },
      timestamp: Date.now(),
      deviceId: 'integration-device',
      userId: 'integration-user',
      priority: 'high',
      requiresBroadcast: true,
    };

    const result = await service.broadcastUpdate(tournamentUpdate);

    expect(result.success).toBe(true);
    expect(mockConnection.send).toHaveBeenCalled();

    const sentData = JSON.parse(mockConnection.send.mock.calls[0][0]);
    expect(sentData.type).toBe('broadcast_update');
    expect(sentData.update.id).toBe('update-complete-flow');
  });

  test('should maintain sync queue integrity during network interruptions', async () => {
    const updates: TournamentUpdate[] = [];
    for (let i = 0; i < 5; i++) {
      updates.push({
        id: `batch-update-${i}`,
        type: 'score_update',
        tournamentId: 'batch-tournament',
        matchId: `match-${i}`,
        data: { score: [i, i + 1] },
        timestamp: Date.now() + i,
        deviceId: 'batch-device',
        userId: 'batch-user',
        priority: i < 2 ? 'critical' : 'normal',
        requiresBroadcast: true,
      });
    }

    // Start with no connection (offline)
    (service as any).connection = null;

    // Send updates while offline - should queue them
    const results = await Promise.all(
      updates.map(update => service.broadcastUpdate(update))
    );

    // All should fail initially
    results.forEach(result => expect(result.success).toBe(false));

    // Verify queue has all operations
    expect((service as any).syncQueue.size).toBe(5);

    // Simulate connection restored
    const mockConnection = {
      readyState: 1,
      send: jest.fn(),
      close: jest.fn(),
    };
    (service as any).connection = mockConnection;

    // Process the queue
    await service.processSyncQueue();

    // Verify queue is now empty
    expect((service as any).syncQueue.size).toBe(0);

    // Verify sends were made
    expect(mockConnection.send).toHaveBeenCalled();
  });
});

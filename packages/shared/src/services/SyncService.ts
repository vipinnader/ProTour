// Real-time sync service for ProTour - Epic 2B Implementation

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { ConflictResolution } from '../types';

export interface SyncQueueItem {
  id: string;
  collection: string;
  documentId: string;
  operation: 'create' | 'update' | 'delete';
  data?: any;
  timestamp: number;
  userId: string;
  retryCount: number;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: number;
  pendingOperations: number;
  syncInProgress: boolean;
}

export class SyncService {
  private db: FirebaseFirestoreTypes.Module;
  private isOnline: boolean = false;
  private syncQueue: SyncQueueItem[] = [];
  private listeners: Map<string, (() => void)[]> = new Map();
  private syncInProgress: boolean = false;
  private deviceId: string;
  private conflicts: ConflictResolution[] = [];

  private readonly STORAGE_KEYS = {
    SYNC_QUEUE: '@protour/sync_queue',
    OFFLINE_DATA: '@protour/offline_data',
    LAST_SYNC: '@protour/last_sync',
    DEVICE_ID: '@protour/device_id',
    CONFLICTS: '@protour/conflicts',
  } as const;

  constructor() {
    this.db = firestore();
    this.initializeDeviceId();
    this.setupNetworkListener();
    this.loadSyncQueue();
    this.loadConflicts();
  }

  private async initializeDeviceId(): Promise<void> {
    try {
      let deviceId = await AsyncStorage.getItem(this.STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(this.STORAGE_KEYS.DEVICE_ID, deviceId);
      }
      this.deviceId = deviceId;
    } catch (error) {
      console.error('Error initializing device ID:', error);
      this.deviceId = `fallback_${Date.now()}`;
    }
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;

      if (!wasOnline && this.isOnline) {
        // Just came online, start sync
        this.processSyncQueue();
      }

      this.notifyListeners('connectivity');
    });
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(
        this.STORAGE_KEYS.SYNC_QUEUE
      );
      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
      this.syncQueue = [];
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.SYNC_QUEUE,
        JSON.stringify(this.syncQueue)
      );
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  private async loadConflicts(): Promise<void> {
    try {
      const conflictsData = await AsyncStorage.getItem(
        this.STORAGE_KEYS.CONFLICTS
      );
      if (conflictsData) {
        this.conflicts = JSON.parse(conflictsData);
      }
    } catch (error) {
      console.error('Error loading conflicts:', error);
      this.conflicts = [];
    }
  }

  private async saveConflicts(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.CONFLICTS,
        JSON.stringify(this.conflicts)
      );
    } catch (error) {
      console.error('Error saving conflicts:', error);
    }
  }

  // Queue operations for offline sync
  async queueOperation(
    collection: string,
    documentId: string,
    operation: 'create' | 'update' | 'delete',
    data?: any,
    userId?: string
  ): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: `${collection}_${documentId}_${Date.now()}`,
      collection,
      documentId,
      operation,
      data,
      timestamp: Date.now(),
      userId: userId || 'anonymous',
      retryCount: 0,
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();

    // Also store in offline data for immediate local updates
    await this.updateOfflineData(collection, documentId, data, operation);

    if (this.isOnline) {
      this.processSyncQueue();
    }

    this.notifyListeners('queue');
  }

  private async updateOfflineData(
    collection: string,
    documentId: string,
    data: any,
    operation: string
  ): Promise<void> {
    try {
      const key = `${this.STORAGE_KEYS.OFFLINE_DATA}_${collection}`;
      const existingData = await AsyncStorage.getItem(key);
      let collectionData: Record<string, any> = {};

      if (existingData) {
        collectionData = JSON.parse(existingData);
      }

      if (operation === 'delete') {
        delete collectionData[documentId];
      } else {
        collectionData[documentId] = {
          ...data,
          _syncMetadata: {
            lastModified: Date.now(),
            deviceId: this.deviceId,
            operation,
          },
        };
      }

      await AsyncStorage.setItem(key, JSON.stringify(collectionData));
    } catch (error) {
      console.error('Error updating offline data:', error);
    }
  }

  // Process sync queue when online
  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.notifyListeners('syncStart');

    try {
      const batch = firestore().batch();
      const processedItems: string[] = [];
      const maxBatchSize = 500; // Firestore batch limit
      let batchCount = 0;

      for (const item of this.syncQueue) {
        if (batchCount >= maxBatchSize) {
          break;
        }

        try {
          const docRef = this.db
            .collection(item.collection)
            .doc(item.documentId);

          // Check for conflicts before applying
          const remoteDoc = await docRef.get();
          if (await this.detectConflict(item, remoteDoc)) {
            continue; // Skip conflicted items
          }

          switch (item.operation) {
            case 'create':
              batch.set(docRef, {
                ...item.data,
                _syncMetadata: {
                  deviceId: this.deviceId,
                  lastModified: firestore.FieldValue.serverTimestamp(),
                  createdAt: firestore.FieldValue.serverTimestamp(),
                },
              });
              break;
            case 'update':
              batch.update(docRef, {
                ...item.data,
                _syncMetadata: {
                  deviceId: this.deviceId,
                  lastModified: firestore.FieldValue.serverTimestamp(),
                },
              });
              break;
            case 'delete':
              batch.delete(docRef);
              break;
          }

          processedItems.push(item.id);
          batchCount++;
        } catch (error) {
          console.error(`Error processing sync item ${item.id}:`, error);
          item.retryCount++;

          // Remove items with too many retries
          if (item.retryCount >= 3) {
            processedItems.push(item.id);
          }
        }
      }

      // Commit batch
      if (batchCount > 0) {
        await batch.commit();
      }

      // Remove processed items from queue
      this.syncQueue = this.syncQueue.filter(
        item => !processedItems.includes(item.id)
      );
      await this.saveSyncQueue();

      // Update last sync time
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.LAST_SYNC,
        Date.now().toString()
      );
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.syncInProgress = false;
      this.notifyListeners('syncComplete');
    }
  }

  private async detectConflict(
    localItem: SyncQueueItem,
    remoteDoc: FirebaseFirestoreTypes.DocumentSnapshot
  ): Promise<boolean> {
    if (!remoteDoc.exists) {
      return false; // No conflict if remote doesn't exist
    }

    const remoteData = remoteDoc.data();
    if (!remoteData?._syncMetadata) {
      return false; // No sync metadata, assume no conflict
    }

    // Check if remote was modified after local operation
    const remoteLastModified =
      remoteData._syncMetadata.lastModified?.toMillis() || 0;
    const localTimestamp = localItem.timestamp;

    if (
      remoteLastModified > localTimestamp &&
      remoteData._syncMetadata.deviceId !== this.deviceId
    ) {
      // Create conflict resolution record
      const conflict: ConflictResolution = {
        conflictId: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        collection: localItem.collection,
        documentId: localItem.documentId,
        localVersion: localItem.data,
        remoteVersion: remoteData,
        timestamp: Date.now(),
        resolved: false,
      };

      this.conflicts.push(conflict);
      await this.saveConflicts();
      this.notifyListeners('conflict');

      return true;
    }

    return false;
  }

  // Get offline data for a collection
  async getOfflineData<T>(collection: string): Promise<Record<string, T>> {
    try {
      const key = `${this.STORAGE_KEYS.OFFLINE_DATA}_${collection}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error(`Error getting offline data for ${collection}:`, error);
      return {};
    }
  }

  // Get offline document
  async getOfflineDocument<T>(
    collection: string,
    documentId: string
  ): Promise<T | null> {
    try {
      const collectionData = await this.getOfflineData<T>(collection);
      return collectionData[documentId] || null;
    } catch (error) {
      console.error(`Error getting offline document ${documentId}:`, error);
      return null;
    }
  }

  // Subscribe to sync events
  subscribe(event: string, callback: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private notifyListeners(event: string): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }

  // Get sync status
  getSyncStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      lastSyncTime: 0, // Will be loaded from AsyncStorage
      pendingOperations: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
    };
  }

  // Get unresolved conflicts
  getConflicts(): ConflictResolution[] {
    return this.conflicts.filter(conflict => !conflict.resolved);
  }

  // Resolve conflict
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'manual',
    manualData?: any
  ): Promise<void> {
    const conflict = this.conflicts.find(c => c.conflictId === conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    let resolvedData: any;
    switch (resolution) {
      case 'local':
        resolvedData = conflict.localVersion;
        break;
      case 'remote':
        resolvedData = conflict.remoteVersion;
        break;
      case 'manual':
        resolvedData = manualData;
        break;
    }

    // Queue the resolved data for sync
    await this.queueOperation(
      conflict.collection,
      conflict.documentId,
      'update',
      resolvedData
    );

    // Mark conflict as resolved
    conflict.resolved = true;
    await this.saveConflicts();

    this.notifyListeners('conflictResolved');
  }

  // Clear old offline data
  async clearOfflineData(
    maxAge: number = 7 * 24 * 60 * 60 * 1000
  ): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(key =>
        key.startsWith(this.STORAGE_KEYS.OFFLINE_DATA)
      );

      for (const key of offlineKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          const filtered: Record<string, any> = {};

          for (const [docId, docData] of Object.entries(parsed)) {
            const lastModified =
              (docData as any)?._syncMetadata?.lastModified || 0;
            if (Date.now() - lastModified < maxAge) {
              filtered[docId] = docData;
            }
          }

          if (Object.keys(filtered).length > 0) {
            await AsyncStorage.setItem(key, JSON.stringify(filtered));
          } else {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Error clearing old offline data:', error);
    }
  }

  // Force sync
  async forceSync(): Promise<void> {
    if (this.isOnline) {
      await this.processSyncQueue();
    }
  }
}

export const syncService = new SyncService();

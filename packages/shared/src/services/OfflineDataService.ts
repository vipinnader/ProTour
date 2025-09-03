// Offline-first data service for ProTour - Epic 2B Implementation

import { DatabaseService } from './DatabaseService';
import { syncService, SyncService } from './SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import NetInfo from '@react-native-community/netinfo';

export interface OfflineQuery {
  collection: string;
  where?: Array<[string, FirebaseFirestoreTypes.WhereFilterOp, any]>;
  orderBy?: Array<[string, 'asc' | 'desc']>;
  limit?: number;
}

export interface OfflineDocument<T = any> {
  id: string;
  data: T;
  _metadata: {
    isFromCache: boolean;
    hasPendingWrites: boolean;
    lastSyncTime: number;
    deviceId?: string;
  };
}

export class OfflineDataService extends DatabaseService {
  private syncService: SyncService;
  private realtimeListeners: Map<string, () => void> = new Map();

  constructor() {
    super();
    this.syncService = syncService;
  }

  // Enhanced create with offline support
  async create<T>(collection: string, data: Omit<T, 'id'>, userId?: string): Promise<T> {
    const documentId = firestore().collection(collection).doc().id;
    
    // Add to offline storage immediately
    const timestamp = Date.now();
    const enhancedData = {
      ...data,
      id: documentId,
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
    } as T;

    // Queue for sync
    await this.syncService.queueOperation(collection, documentId, 'create', enhancedData, userId);

    // Try immediate sync if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && netInfo.isInternetReachable) {
      try {
        return await super.create<T>(collection, data);
      } catch (error) {
        console.warn('Online create failed, using offline version:', error);
      }
    }

    return enhancedData;
  }

  // Enhanced read with offline-first approach
  async read<T>(collection: string, id: string): Promise<T | null> {
    // First try to get from offline storage
    const offlineData = await this.syncService.getOfflineDocument<T>(collection, id);
    
    // Check network status
    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

    if (!isOnline) {
      return offlineData;
    }

    // If online, try to get fresh data but fall back to offline
    try {
      const onlineData = await super.read<T>(collection, id);
      if (onlineData) {
        // Update offline cache
        await this.updateOfflineCache(collection, id, onlineData);
        return onlineData;
      }
    } catch (error) {
      console.warn('Online read failed, using offline data:', error);
    }

    return offlineData;
  }

  // Enhanced update with offline support
  async update<T>(collection: string, id: string, data: Partial<T>, userId?: string): Promise<void> {
    // Update offline storage immediately
    const timestamp = Date.now();
    const enhancedData = {
      ...data,
      updatedAt: new Date(timestamp),
    };

    // Queue for sync
    await this.syncService.queueOperation(collection, id, 'update', enhancedData, userId);

    // Try immediate sync if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && netInfo.isInternetReachable) {
      try {
        await super.update(collection, id, data);
        return;
      } catch (error) {
        console.warn('Online update failed, queued for sync:', error);
      }
    }
  }

  // Enhanced delete with offline support
  async delete(collection: string, id: string, userId?: string): Promise<void> {
    // Queue for sync
    await this.syncService.queueOperation(collection, id, 'delete', undefined, userId);

    // Try immediate sync if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && netInfo.isInternetReachable) {
      try {
        await super.delete(collection, id);
        return;
      } catch (error) {
        console.warn('Online delete failed, queued for sync:', error);
      }
    }
  }

  // Query with offline support
  async query<T>(queryConfig: OfflineQuery): Promise<OfflineDocument<T>[]> {
    const { collection, where, orderBy, limit } = queryConfig;
    
    // Get offline data
    const offlineData = await this.syncService.getOfflineData<T>(collection);
    let offlineResults = Object.entries(offlineData).map(([id, data]) => ({
      id,
      data,
      _metadata: {
        isFromCache: true,
        hasPendingWrites: this.hasPendingWrites(collection, id),
        lastSyncTime: (data as any)?._syncMetadata?.lastModified || 0,
        deviceId: (data as any)?._syncMetadata?.deviceId,
      },
    }));

    // Apply filters to offline data
    if (where) {
      offlineResults = this.applyWhereFilters(offlineResults, where);
    }

    if (orderBy) {
      offlineResults = this.applyOrderBy(offlineResults, orderBy);
    }

    if (limit) {
      offlineResults = offlineResults.slice(0, limit);
    }

    // Check if online and try to get fresh data
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && netInfo.isInternetReachable) {
      try {
        const onlineResults = await this.queryOnline<T>(queryConfig);
        if (onlineResults.length > 0) {
          // Update offline cache with fresh data
          for (const doc of onlineResults) {
            await this.updateOfflineCache(collection, doc.id, doc.data);
          }
          return onlineResults;
        }
      } catch (error) {
        console.warn('Online query failed, using offline data:', error);
      }
    }

    return offlineResults;
  }

  private async queryOnline<T>(queryConfig: OfflineQuery): Promise<OfflineDocument<T>[]> {
    const { collection, where, orderBy, limit } = queryConfig;
    
    let query: FirebaseFirestoreTypes.Query = this.db.collection(collection);
    
    if (where) {
      for (const [field, op, value] of where) {
        query = query.where(field, op, value);
      }
    }
    
    if (orderBy) {
      for (const [field, direction] of orderBy) {
        query = query.orderBy(field, direction);
      }
    }
    
    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data() as T,
      _metadata: {
        isFromCache: doc.metadata.fromCache,
        hasPendingWrites: doc.metadata.hasPendingWrites,
        lastSyncTime: Date.now(),
      },
    }));
  }

  private applyWhereFilters<T>(
    results: OfflineDocument<T>[],
    filters: Array<[string, FirebaseFirestoreTypes.WhereFilterOp, any]>
  ): OfflineDocument<T>[] {
    return results.filter(doc => {
      return filters.every(([field, op, value]) => {
        const fieldValue = this.getNestedValue(doc.data, field);
        
        switch (op) {
          case '==':
            return fieldValue === value;
          case '!=':
            return fieldValue !== value;
          case '<':
            return fieldValue < value;
          case '<=':
            return fieldValue <= value;
          case '>':
            return fieldValue > value;
          case '>=':
            return fieldValue >= value;
          case 'array-contains':
            return Array.isArray(fieldValue) && fieldValue.includes(value);
          case 'in':
            return Array.isArray(value) && value.includes(fieldValue);
          case 'not-in':
            return Array.isArray(value) && !value.includes(fieldValue);
          case 'array-contains-any':
            return Array.isArray(fieldValue) && 
                   Array.isArray(value) && 
                   value.some(v => fieldValue.includes(v));
          default:
            return true;
        }
      });
    });
  }

  private applyOrderBy<T>(
    results: OfflineDocument<T>[],
    orderBy: Array<[string, 'asc' | 'desc']>
  ): OfflineDocument<T>[] {
    return results.sort((a, b) => {
      for (const [field, direction] of orderBy) {
        const aValue = this.getNestedValue(a.data, field);
        const bValue = this.getNestedValue(b.data, field);
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        if (direction === 'desc') comparison *= -1;
        
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private hasPendingWrites(collection: string, documentId: string): boolean {
    const status = this.syncService.getSyncStatus();
    return status.pendingOperations > 0; // Simplified check
  }

  private async updateOfflineCache<T>(collection: string, documentId: string, data: T): Promise<void> {
    try {
      const key = `@protour/offline_data_${collection}`;
      const existingData = await AsyncStorage.getItem(key);
      let collectionData: Record<string, any> = {};

      if (existingData) {
        collectionData = JSON.parse(existingData);
      }

      collectionData[documentId] = {
        ...data,
        _syncMetadata: {
          lastModified: Date.now(),
          deviceId: 'server',
          operation: 'read',
        },
      };

      await AsyncStorage.setItem(key, JSON.stringify(collectionData));
    } catch (error) {
      console.error('Error updating offline cache:', error);
    }
  }

  // Real-time subscriptions with offline support
  subscribeToDocument<T>(
    collection: string,
    documentId: string,
    callback: (doc: OfflineDocument<T> | null) => void,
    onError?: (error: Error) => void
  ): () => void {
    const listenerKey = `${collection}_${documentId}`;
    
    // Set up offline listener
    const offlineUnsubscribe = this.syncService.subscribe('syncComplete', async () => {
      const doc = await this.read<T>(collection, documentId);
      if (doc) {
        callback({
          id: documentId,
          data: doc,
          _metadata: {
            isFromCache: true,
            hasPendingWrites: this.hasPendingWrites(collection, documentId),
            lastSyncTime: Date.now(),
          },
        });
      } else {
        callback(null);
      }
    });

    // Set up online listener if connected
    let onlineUnsubscribe: (() => void) | null = null;
    
    NetInfo.fetch().then(netInfo => {
      if (netInfo.isConnected && netInfo.isInternetReachable) {
        const docRef = this.db.collection(collection).doc(documentId);
        onlineUnsubscribe = docRef.onSnapshot(
          async (snapshot) => {
            if (snapshot.exists) {
              const data = snapshot.data() as T;
              // Update offline cache
              await this.updateOfflineCache(collection, documentId, data);
              
              callback({
                id: documentId,
                data,
                _metadata: {
                  isFromCache: snapshot.metadata.fromCache,
                  hasPendingWrites: snapshot.metadata.hasPendingWrites,
                  lastSyncTime: Date.now(),
                },
              });
            } else {
              callback(null);
            }
          },
          (error) => {
            console.warn('Online subscription error, falling back to offline:', error);
            onError?.(error);
          }
        );
      }
    });

    // Store unsubscribe function
    const unsubscribe = () => {
      offlineUnsubscribe();
      if (onlineUnsubscribe) {
        onlineUnsubscribe();
      }
      this.realtimeListeners.delete(listenerKey);
    };

    this.realtimeListeners.set(listenerKey, unsubscribe);
    return unsubscribe;
  }

  subscribeToCollection<T>(
    queryConfig: OfflineQuery,
    callback: (docs: OfflineDocument<T>[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const listenerKey = `${queryConfig.collection}_query_${Date.now()}`;
    
    // Set up offline listener
    const offlineUnsubscribe = this.syncService.subscribe('syncComplete', async () => {
      try {
        const docs = await this.query<T>(queryConfig);
        callback(docs);
      } catch (error) {
        onError?.(error as Error);
      }
    });

    // Set up online listener if connected
    let onlineUnsubscribe: (() => void) | null = null;
    
    NetInfo.fetch().then(netInfo => {
      if (netInfo.isConnected && netInfo.isInternetReachable) {
        const { collection, where, orderBy, limit } = queryConfig;
        let query: FirebaseFirestoreTypes.Query = this.db.collection(collection);
        
        if (where) {
          for (const [field, op, value] of where) {
            query = query.where(field, op, value);
          }
        }
        
        if (orderBy) {
          for (const [field, direction] of orderBy) {
            query = query.orderBy(field, direction);
          }
        }
        
        if (limit) {
          query = query.limit(limit);
        }

        onlineUnsubscribe = query.onSnapshot(
          async (snapshot) => {
            const docs = snapshot.docs.map(doc => ({
              id: doc.id,
              data: doc.data() as T,
              _metadata: {
                isFromCache: doc.metadata.fromCache,
                hasPendingWrites: doc.metadata.hasPendingWrites,
                lastSyncTime: Date.now(),
              },
            }));

            // Update offline cache
            for (const doc of docs) {
              await this.updateOfflineCache(collection, doc.id, doc.data);
            }

            callback(docs);
          },
          (error) => {
            console.warn('Online subscription error, falling back to offline:', error);
            onError?.(error);
          }
        );
      }
    });

    // Store unsubscribe function
    const unsubscribe = () => {
      offlineUnsubscribe();
      if (onlineUnsubscribe) {
        onlineUnsubscribe();
      }
      this.realtimeListeners.delete(listenerKey);
    };

    this.realtimeListeners.set(listenerKey, unsubscribe);
    return unsubscribe;
  }

  // Cleanup all listeners
  cleanup(): void {
    this.realtimeListeners.forEach(unsubscribe => unsubscribe());
    this.realtimeListeners.clear();
  }
}

export const offlineDataService = new OfflineDataService();
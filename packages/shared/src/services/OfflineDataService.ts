import SQLite from 'react-native-sqlite-storage';
import * as Keychain from 'react-native-keychain';
import CryptoJS from 'crypto-js';
import NetInfo from '@react-native-community/netinfo';
import uuid from 'react-native-uuid';

// Enable SQLite debugging in dev
SQLite.DEBUG(true);
SQLite.enablePromise(true);

export interface OfflineStatus {
  isOnline: boolean;
  lastSyncTime: number;
  pendingOperations: number;
  syncInProgress: boolean;
  offlineStartTime?: number;
  cacheSize: number;
  storageHealth: 'good' | 'warning' | 'critical';
}

export interface CachedDocument<T = any> {
  id: string;
  collection: string;
  data: T;
  isFromCache: boolean;
  hasPendingWrites: boolean;
  lastModified: number;
  deviceId: string;
  version: number;
  checksum: string;
}

export interface OfflineQuery {
  collection: string;
  where?: Array<[string, '==' | '!=' | '<' | '<=' | '>' | '>=' | 'IN', any]>;
  orderBy?: Array<[string, 'ASC' | 'DESC']>;
  limit?: number;
}

export interface IntegrityReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  repairActions: string[];
  totalDocuments: number;
  corruptedDocuments: number;
}

export interface SyncOperation {
  id: string;
  collection: string;
  documentId: string;
  operation: 'create' | 'update' | 'delete';
  data?: any;
  timestamp: number;
  userId: string;
  retryCount: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export class OfflineDataService {
  private db: SQLite.SQLiteDatabase | null = null;
  private encryptionKey: string | null = null;
  private deviceId: string;
  private isInitialized = false;
  private offlineStartTime: number | null = null;
  private listeners: Map<string, (() => void)[]> = new Map();

  private readonly OFFLINE_LIMIT_MS = 8 * 60 * 60 * 1000; // 8 hours
  private readonly WARNING_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours
  private readonly MAX_CACHE_SIZE_MB = 100; // 100MB cache limit
  private readonly KEYCHAIN_SERVICE = 'ProTourOfflineService';
  private readonly DB_NAME = 'protour_offline.db';

  constructor() {
    this.deviceId = uuid.v4() as string;
  }

  /**
   * AC2B.1.1 & AC2B.1.2: Initialize offline-first architecture with SQLite and encryption
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize encryption key
      await this.initializeEncryption();

      // Initialize SQLite database
      await this.initializeDatabase();

      // Set up connectivity monitoring
      await this.initializeConnectivityMonitoring();

      this.isInitialized = true;
      console.log('OfflineDataService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OfflineDataService:', error);
      throw error;
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      // Try to retrieve existing encryption key
      const credentials = await Keychain.getInternetCredentials(
        this.KEYCHAIN_SERVICE
      );

      if (credentials && credentials.password) {
        this.encryptionKey = credentials.password;
      } else {
        // Generate new AES-256 key
        this.encryptionKey = CryptoJS.lib.WordArray.random(256 / 8).toString();

        // Store securely in keychain
        await Keychain.setInternetCredentials(
          this.KEYCHAIN_SERVICE,
          'offline_encryption',
          this.encryptionKey
        );
      }
    } catch (error) {
      throw new Error(`Encryption initialization failed: ${error}`);
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: this.DB_NAME,
        location: 'default',
        createFromLocation: '~www/protour_offline.db',
      });

      // Create tables
      await this.createTables();

      // Create indexes for performance
      await this.createIndexes();
    } catch (error) {
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      // Documents table with encryption
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        is_from_cache INTEGER DEFAULT 1,
        has_pending_writes INTEGER DEFAULT 0,
        last_modified INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        checksum TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Sync queue table
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        document_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        encrypted_data TEXT,
        timestamp INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'normal',
        created_at INTEGER NOT NULL
      )`,

      // Metadata table for service state
      `CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Conflict resolution table
      `CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        document_id TEXT NOT NULL,
        local_version TEXT NOT NULL,
        remote_version TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        resolved INTEGER DEFAULT 0,
        resolution_strategy TEXT,
        created_at INTEGER NOT NULL
      )`,
    ];

    for (const table of tables) {
      await this.db.executeSql(table);
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection)',
      'CREATE INDEX IF NOT EXISTS idx_documents_collection_modified ON documents(collection, last_modified)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_timestamp ON sync_queue(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority)',
      'CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON conflicts(resolved)',
    ];

    for (const index of indexes) {
      await this.db.executeSql(index);
    }
  }

  private async initializeConnectivityMonitoring(): Promise<void> {
    NetInfo.addEventListener(state => {
      const wasOffline = this.offlineStartTime !== null;
      const isOnline = state.isConnected && state.isInternetReachable;

      if (!isOnline && !wasOffline) {
        // Going offline
        this.offlineStartTime = Date.now();
        this.emit('offline');
      } else if (isOnline && wasOffline) {
        // Coming online
        this.offlineStartTime = null;
        this.emit('online');
        this.processSyncQueue(); // Auto-sync when coming online
      }
    });
  }

  /**
   * AC2B.1.2: Encrypted data storage and retrieval
   */
  private encrypt(data: any): string {
    if (!this.encryptionKey) throw new Error('Encryption key not available');
    return CryptoJS.AES.encrypt(
      JSON.stringify(data),
      this.encryptionKey
    ).toString();
  }

  private decrypt(encryptedData: string): any {
    if (!this.encryptionKey) throw new Error('Encryption key not available');
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }

  private generateChecksum(data: any): string {
    return CryptoJS.MD5(JSON.stringify(data)).toString();
  }

  /**
   * AC2B.1.1: Complete offline operations - Create
   */
  async createOffline<T>(
    collection: string,
    data: Omit<T, 'id'>,
    userId: string
  ): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');

    const documentId = uuid.v4() as string;
    const timestamp = Date.now();
    const enhancedData = {
      ...data,
      id: documentId,
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
    } as T;

    const checksum = this.generateChecksum(enhancedData);
    const encryptedData = this.encrypt(enhancedData);

    // Store in documents table
    await this.db.executeSql(
      `INSERT INTO documents 
       (id, collection, encrypted_data, last_modified, device_id, checksum, created_at, updated_at, has_pending_writes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        documentId,
        collection,
        encryptedData,
        timestamp,
        this.deviceId,
        checksum,
        timestamp,
        timestamp,
        1,
      ]
    );

    // Add to sync queue
    await this.queueSyncOperation({
      id: uuid.v4() as string,
      collection,
      documentId,
      operation: 'create',
      data: enhancedData,
      timestamp,
      userId,
      retryCount: 0,
      priority: 'normal',
    });

    this.emit('documentCreated', {
      collection,
      id: documentId,
      data: enhancedData,
    });
    return enhancedData;
  }

  /**
   * AC2B.1.1: Complete offline operations - Read
   */
  async readOffline<T>(
    collection: string,
    id: string
  ): Promise<CachedDocument<T> | null> {
    if (!this.db) throw new Error('Database not initialized');

    const [result] = await this.db.executeSql(
      'SELECT * FROM documents WHERE id = ? AND collection = ?',
      [id, collection]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows.item(0);
    const data = this.decrypt(row.encrypted_data);

    // Verify checksum for data integrity
    const expectedChecksum = this.generateChecksum(data);
    if (row.checksum !== expectedChecksum) {
      console.warn(
        `Checksum mismatch for document ${id}, data may be corrupted`
      );
      await this.repairDocument(collection, id);
      return null;
    }

    return {
      id: row.id,
      collection: row.collection,
      data,
      isFromCache: true,
      hasPendingWrites: Boolean(row.has_pending_writes),
      lastModified: row.last_modified,
      deviceId: row.device_id,
      version: row.version,
      checksum: row.checksum,
    };
  }

  /**
   * AC2B.1.1: Complete offline operations - Update
   */
  async updateOffline<T>(
    collection: string,
    id: string,
    data: Partial<T>,
    userId: string
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Get existing document
    const existing = await this.readOffline<T>(collection, id);
    if (!existing)
      throw new Error(`Document ${id} not found in collection ${collection}`);

    const timestamp = Date.now();
    const updatedData = {
      ...existing.data,
      ...data,
      updatedAt: new Date(timestamp),
    };

    const checksum = this.generateChecksum(updatedData);
    const encryptedData = this.encrypt(updatedData);

    // Update documents table
    await this.db.executeSql(
      `UPDATE documents 
       SET encrypted_data = ?, last_modified = ?, checksum = ?, updated_at = ?, 
           version = version + 1, has_pending_writes = 1
       WHERE id = ? AND collection = ?`,
      [encryptedData, timestamp, checksum, timestamp, id, collection]
    );

    // Add to sync queue
    await this.queueSyncOperation({
      id: uuid.v4() as string,
      collection,
      documentId: id,
      operation: 'update',
      data: updatedData,
      timestamp,
      userId,
      retryCount: 0,
      priority: 'normal',
    });

    this.emit('documentUpdated', { collection, id, data: updatedData });
  }

  /**
   * AC2B.1.1: Complete offline operations - Delete
   */
  async deleteOffline(
    collection: string,
    id: string,
    userId: string
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const timestamp = Date.now();

    // Remove from documents table
    await this.db.executeSql(
      'DELETE FROM documents WHERE id = ? AND collection = ?',
      [id, collection]
    );

    // Add to sync queue
    await this.queueSyncOperation({
      id: uuid.v4() as string,
      collection,
      documentId: id,
      operation: 'delete',
      timestamp,
      userId,
      retryCount: 0,
      priority: 'normal',
    });

    this.emit('documentDeleted', { collection, id });
  }

  /**
   * AC2B.1.1: Complete offline operations - Query
   */
  async queryOffline<T>(query: OfflineQuery): Promise<CachedDocument<T>[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = `SELECT * FROM documents WHERE collection = ?`;
    const params: any[] = [query.collection];

    // Build WHERE clause (simplified for SQLite)
    if (query.where) {
      for (const [field, op, value] of query.where) {
        // Note: This is a simplified approach. In production, you'd want more sophisticated JSON querying
        if (op === '==') {
          sql += ` AND encrypted_data LIKE ?`;
          params.push(`%"${field}":"${value}"%`);
        }
        // Add more operators as needed
      }
    }

    // Add ORDER BY
    if (query.orderBy) {
      // For simplicity, ordering by last_modified. In production, you'd extract JSON fields
      sql += ` ORDER BY last_modified ${query.orderBy[0][1]}`;
    }

    // Add LIMIT
    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
    }

    const [result] = await this.db.executeSql(sql, params);
    const documents: CachedDocument<T>[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      try {
        const data = this.decrypt(row.encrypted_data);

        // Verify checksum
        const expectedChecksum = this.generateChecksum(data);
        if (row.checksum === expectedChecksum) {
          documents.push({
            id: row.id,
            collection: row.collection,
            data,
            isFromCache: true,
            hasPendingWrites: Boolean(row.has_pending_writes),
            lastModified: row.last_modified,
            deviceId: row.device_id,
            version: row.version,
            checksum: row.checksum,
          });
        } else {
          console.warn(`Skipping corrupted document ${row.id}`);
        }
      } catch (error) {
        console.error(`Failed to decrypt document ${row.id}:`, error);
      }
    }

    return documents;
  }

  /**
   * AC2B.1.3: Sync queue management
   */
  private async queueSyncOperation(operation: SyncOperation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const encryptedData = operation.data ? this.encrypt(operation.data) : null;

    await this.db.executeSql(
      `INSERT INTO sync_queue 
       (id, collection, document_id, operation, encrypted_data, timestamp, user_id, retry_count, priority, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operation.id,
        operation.collection,
        operation.documentId,
        operation.operation,
        encryptedData,
        operation.timestamp,
        operation.userId,
        operation.retryCount,
        operation.priority,
        Date.now(),
      ]
    );
  }

  /**
   * AC2B.1.3: Process sync queue
   */
  async processSyncQueue(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      console.log('No internet connection, skipping sync');
      return;
    }

    const [result] = await this.db.executeSql(
      'SELECT * FROM sync_queue ORDER BY priority DESC, timestamp ASC LIMIT 50'
    );

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      await this.processSyncOperation(row);
    }
  }

  private async processSyncOperation(row: any): Promise<void> {
    try {
      const data = row.encrypted_data ? this.decrypt(row.encrypted_data) : null;

      // Here you would integrate with your actual cloud sync service
      // For now, we'll simulate the sync process
      console.log(
        `Syncing ${row.operation} for ${row.collection}/${row.document_id}`
      );

      // Remove from queue on success
      await this.db!.executeSql('DELETE FROM sync_queue WHERE id = ?', [
        row.id,
      ]);

      // Update document to remove pending writes flag
      if (row.operation !== 'delete') {
        await this.db!.executeSql(
          'UPDATE documents SET has_pending_writes = 0 WHERE id = ? AND collection = ?',
          [row.document_id, row.collection]
        );
      }
    } catch (error) {
      console.error(`Sync failed for operation ${row.id}:`, error);

      // Increment retry count
      const newRetryCount = row.retry_count + 1;
      if (newRetryCount < 5) {
        await this.db!.executeSql(
          'UPDATE sync_queue SET retry_count = ? WHERE id = ?',
          [newRetryCount, row.id]
        );
      } else {
        console.error(
          `Max retries reached for operation ${row.id}, removing from queue`
        );
        await this.db!.executeSql('DELETE FROM sync_queue WHERE id = ?', [
          row.id,
        ]);
      }
    }
  }

  /**
   * AC2B.1.4: Status management
   */
  async getOfflineStatus(): Promise<OfflineStatus> {
    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

    const [queueResult] = await this.db!.executeSql(
      'SELECT COUNT(*) as count FROM sync_queue'
    );
    const pendingOperations = queueResult.rows.item(0).count;

    const [docsResult] = await this.db!.executeSql(
      'SELECT COUNT(*) as count FROM documents'
    );
    const totalDocuments = docsResult.rows.item(0).count;

    // Estimate cache size (rough calculation)
    const cacheSize = totalDocuments * 1024; // Assume 1KB per document average

    let storageHealth: 'good' | 'warning' | 'critical' = 'good';
    if (cacheSize > this.MAX_CACHE_SIZE_MB * 1024 * 1024 * 0.8) {
      storageHealth = 'warning';
    }
    if (cacheSize > this.MAX_CACHE_SIZE_MB * 1024 * 1024) {
      storageHealth = 'critical';
    }

    return {
      isOnline,
      lastSyncTime: await this.getLastSyncTime(),
      pendingOperations,
      syncInProgress: false, // You'd track this with a flag
      offlineStartTime: this.offlineStartTime,
      cacheSize,
      storageHealth,
    };
  }

  private async getLastSyncTime(): Promise<number> {
    try {
      const [result] = await this.db!.executeSql(
        'SELECT value FROM metadata WHERE key = ?',
        ['last_sync_time']
      );

      if (result.rows.length > 0) {
        return parseInt(result.rows.item(0).value);
      }
    } catch (error) {
      console.error('Failed to get last sync time:', error);
    }
    return 0;
  }

  /**
   * AC2B.1.6: Data integrity validation
   */
  async validateDataIntegrity(): Promise<IntegrityReport> {
    if (!this.db) throw new Error('Database not initialized');

    const [result] = await this.db.executeSql('SELECT * FROM documents');
    const errors: string[] = [];
    const warnings: string[] = [];
    const repairActions: string[] = [];
    let corruptedDocuments = 0;

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);

      try {
        const data = this.decrypt(row.encrypted_data);
        const expectedChecksum = this.generateChecksum(data);

        if (row.checksum !== expectedChecksum) {
          errors.push(`Checksum mismatch for document ${row.id}`);
          repairActions.push(`Repair document ${row.id} checksum`);
          corruptedDocuments++;
        }

        // Validate data structure
        if (!data.id || data.id !== row.id) {
          warnings.push(`Document ${row.id} has inconsistent ID`);
        }
      } catch (error) {
        errors.push(`Failed to decrypt document ${row.id}: ${error}`);
        corruptedDocuments++;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      repairActions,
      totalDocuments: result.rows.length,
      corruptedDocuments,
    };
  }

  /**
   * AC2B.1.7: Graceful degradation
   */
  async checkOfflineTimeLimit(): Promise<{
    withinLimit: boolean;
    timeRemaining: number;
    shouldWarn: boolean;
  }> {
    if (!this.offlineStartTime) {
      return {
        withinLimit: true,
        timeRemaining: this.OFFLINE_LIMIT_MS,
        shouldWarn: false,
      };
    }

    const offlineTime = Date.now() - this.offlineStartTime;
    const timeRemaining = this.OFFLINE_LIMIT_MS - offlineTime;
    const withinLimit = timeRemaining > 0;
    const shouldWarn = offlineTime > this.WARNING_THRESHOLD_MS && withinLimit;

    if (!withinLimit) {
      this.emit('offlineLimitExceeded', { offlineTime });
    } else if (shouldWarn) {
      this.emit('offlineWarning', { timeRemaining });
    }

    return { withinLimit, timeRemaining, shouldWarn };
  }

  private async repairDocument(collection: string, id: string): Promise<void> {
    // Implementation for document repair
    console.log(`Repairing document ${collection}/${id}`);
    // In a real implementation, you might try to fetch from server or use backup data
  }

  /**
   * Event system for real-time updates
   */
  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data));
    }
  }

  subscribe(event: string, listener: (data?: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);

    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(listener);
        if (index !== -1) {
          eventListeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
  }

  /**
   * Cache management
   */
  async clearCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.executeSql('DELETE FROM documents');
    await this.db.executeSql('DELETE FROM sync_queue');
    await this.db.executeSql('DELETE FROM conflicts');

    this.emit('cacheCleared');
  }

  async getCacheStats(): Promise<{
    documentCount: number;
    queueSize: number;
    conflictCount: number;
    estimatedSize: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const [docsResult] = await this.db.executeSql(
      'SELECT COUNT(*) as count FROM documents'
    );
    const [queueResult] = await this.db.executeSql(
      'SELECT COUNT(*) as count FROM sync_queue'
    );
    const [conflictsResult] = await this.db.executeSql(
      'SELECT COUNT(*) as count FROM conflicts'
    );

    const documentCount = docsResult.rows.item(0).count;
    const queueSize = queueResult.rows.item(0).count;
    const conflictCount = conflictsResult.rows.item(0).count;
    const estimatedSize = documentCount * 1024; // Rough estimate

    return { documentCount, queueSize, conflictCount, estimatedSize };
  }
}

export const offlineDataService = new OfflineDataService();

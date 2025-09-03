// Sync context for ProTour - Epic 2B Implementation

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import { offlineDataService, OfflineStatus } from '@protour/shared';
import uuid from 'react-native-uuid';

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: number;
  pendingOperations: number;
  syncInProgress: boolean;
  offlineStartTime?: number;
  cacheSize: number;
  storageHealth: 'good' | 'warning' | 'critical';
}

export interface ConflictResolution {
  conflictId: string;
  collection: string;
  documentId: string;
  localVersion: any;
  remoteVersion: any;
  timestamp: number;
  resolved: boolean;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  isOnline: boolean;
  lastSeen: Date;
  role: 'organizer' | 'referee' | 'player' | 'spectator';
  currentTournament?: string;
}

export interface DeviceSession {
  sessionId: string;
  deviceId: string;
  tournamentId: string;
  role: 'organizer' | 'referee' | 'player' | 'spectator';
  permissions: string[];
  matchIds?: string[];
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

interface SyncContextType {
  // Sync status
  syncStatus: SyncStatus;
  lastSyncTime: Date | null;
  
  // Network status
  isOnline: boolean;
  isConnected: boolean;
  networkType: string;
  
  // Conflicts
  conflicts: ConflictResolution[];
  hasConflicts: boolean;
  
  // Device & session management
  currentSession: DeviceSession | null;
  currentDevice: DeviceInfo | null;
  activeDevices: DeviceInfo[];
  
  // Sync operations
  forceSync: () => Promise<void>;
  enableOfflineMode: () => Promise<void>;
  disableOfflineMode: () => Promise<void>;
  
  // Conflict resolution
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'manual', data?: any) => Promise<void>;
  ignoreConflict: (conflictId: string) => Promise<void>;
  resolveAllConflicts: (strategy: 'local' | 'remote') => Promise<void>;
  
  // Multi-device operations
  joinWithAccessCode: (code: string) => Promise<DeviceSession>;
  generateAccessCode: (tournamentId: string, role: 'referee' | 'spectator', options?: {
    expirationMinutes?: number;
    maxUses?: number;
    permissions?: string[];
  }) => Promise<{ code: string }>;
  delegatePermissions: (deviceId: string, tournamentId: string, permissions: string[], matchIds?: string[]) => Promise<void>;
  hasPermission: (permission: string, matchId?: string) => Promise<boolean>;
  endSession: () => Promise<void>;
  
  // Event listeners
  onSyncComplete: (callback: () => void) => () => void;
  onConflictDetected: (callback: (conflict: ConflictResolution) => void) => () => void;
  onOfflineWarning: (callback: (timeRemaining: number) => void) => () => void;
  
  // Utility
  canOperateOffline: boolean;
  offlineTimeRemaining: number | null;
  cacheStats: {
    documentCount: number;
    queueSize: number;
    conflictCount: number;
    estimatedSize: number;
  } | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    lastSyncTime: 0,
    pendingOperations: 0,
    syncInProgress: false,
    cacheSize: 0,
    storageHealth: 'good',
  });
  
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [networkType, setNetworkType] = useState('unknown');
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
  const [offlineTimeRemaining, setOfflineTimeRemaining] = useState<number | null>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  
  // Multi-device state
  const [currentSession, setCurrentSession] = useState<DeviceSession | null>(null);
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo | null>(null);
  const [activeDevices, setActiveDevices] = useState<DeviceInfo[]>([]);
  
  const [eventListeners] = useState({
    syncComplete: [] as (() => void)[],
    conflictDetected: [] as ((conflict: ConflictResolution) => void)[],
    offlineWarning: [] as ((timeRemaining: number) => void)[],
  });

  const deviceId = uuid.v4() as string;
  const canOperateOffline = offlineTimeRemaining === null || offlineTimeRemaining > 0;
  const hasConflicts = conflicts.length > 0;

  // Initialize offline data service and network monitoring
  useEffect(() => {
    let mounted = true;
    
    const initializeSync = async () => {
      try {
        // Initialize offline data service
        await offlineDataService.initialize();
        console.log('OfflineDataService initialized');
        
        // Set up network monitoring
        const unsubscribe = NetInfo.addEventListener(state => {
          if (!mounted) return;
          
          setIsOnline(state.isConnected && state.isInternetReachable);
          setIsConnected(!!state.isConnected);
          setNetworkType(state.type || 'unknown');
        });
        
        // Set up sync status monitoring
        const syncStatusInterval = setInterval(async () => {
          if (!mounted) return;
          
          try {
            const status = await offlineDataService.getOfflineStatus();
            setSyncStatus(status);
            
            if (status.lastSyncTime > 0) {
              setLastSyncTime(new Date(status.lastSyncTime));
            }
            
            // Check offline time limits
            const timeCheck = await offlineDataService.checkOfflineTimeLimit();
            setOfflineTimeRemaining(timeCheck.timeRemaining);
            
            if (timeCheck.shouldWarn) {
              eventListeners.offlineWarning.forEach(listener => 
                listener(timeCheck.timeRemaining)
              );
            }
            
            // Update cache stats
            const stats = await offlineDataService.getCacheStats();
            setCacheStats(stats);
          } catch (error) {
            console.error('Failed to get sync status:', error);
          }
        }, 5000); // Check every 5 seconds
        
        // Set up event listeners from offline service
        const offlineListener = offlineDataService.subscribe('offline', () => {
          console.log('Device went offline');
        });
        
        const onlineListener = offlineDataService.subscribe('online', () => {
          console.log('Device came online, triggering sync');
          eventListeners.syncComplete.forEach(listener => listener());
        });
        
        const offlineLimitListener = offlineDataService.subscribe('offlineLimitExceeded', (data) => {
          console.warn('Offline time limit exceeded:', data);
          setOfflineTimeRemaining(0);
        });

        const cacheListener = offlineDataService.subscribe('cacheCleared', () => {
          console.log('Cache cleared');
          setCacheStats({ documentCount: 0, queueSize: 0, conflictCount: 0, estimatedSize: 0 });
        });
        
        return () => {
          unsubscribe();
          clearInterval(syncStatusInterval);
          offlineListener();
          onlineListener();
          offlineLimitListener();
          cacheListener();
        };
      } catch (error) {
        console.error('Failed to initialize sync:', error);
      }
    };
    
    initializeSync();
    
    return () => {
      mounted = false;
    };
  }, [eventListeners.syncComplete, eventListeners.offlineWarning]);

  const forceSync = useCallback(async () => {
    try {
      setSyncStatus(prev => ({ ...prev, syncInProgress: true }));
      await offlineDataService.processSyncQueue();
      
      // Update sync status after completion
      const status = await offlineDataService.getOfflineStatus();
      setSyncStatus(status);
      setLastSyncTime(new Date());
      
      // Notify listeners
      eventListeners.syncComplete.forEach(callback => callback());
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    } finally {
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
    }
  }, [eventListeners.syncComplete]);

  const enableOfflineMode = useCallback(async () => {
    try {
      // Offline mode is automatically managed by connectivity monitoring
      console.log('Offline mode is automatically enabled when connectivity is lost');
    } catch (error) {
      console.error('Failed to enable offline mode:', error);
      throw error;
    }
  }, []);
  
  const disableOfflineMode = useCallback(async () => {
    try {
      // When connectivity returns, auto-sync will trigger
      if (isOnline) {
        await forceSync(); // Sync any pending changes
      }
    } catch (error) {
      console.error('Failed to disable offline mode:', error);
      throw error;
    }
  }, [forceSync, isOnline]);

  // Conflict resolution methods
  const resolveConflict = useCallback(async (
    conflictId: string, 
    resolution: 'local' | 'remote' | 'manual', 
    data?: any
  ) => {
    try {
      console.log(`Resolving conflict ${conflictId} with strategy: ${resolution}`);
      
      // Remove from conflicts list
      setConflicts(prev => prev.filter(c => c.conflictId !== conflictId));
      
      // In a real implementation, you'd integrate with the actual conflict resolution system
      // This is a placeholder for the resolution logic
      
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  }, []);

  const ignoreConflict = useCallback(async (conflictId: string) => {
    try {
      console.log(`Ignoring conflict ${conflictId}`);
      setConflicts(prev => prev.filter(c => c.conflictId !== conflictId));
    } catch (error) {
      console.error('Failed to ignore conflict:', error);
      throw error;
    }
  }, []);

  const resolveAllConflicts = useCallback(async (strategy: 'local' | 'remote') => {
    try {
      console.log(`Resolving all conflicts with strategy: ${strategy}`);
      
      for (const conflict of conflicts) {
        await resolveConflict(conflict.conflictId, strategy);
      }
      
      setConflicts([]);
    } catch (error) {
      console.error('Failed to resolve all conflicts:', error);
      throw error;
    }
  }, [conflicts, resolveConflict]);

  // Multi-device methods (placeholder implementations)
  const joinWithAccessCode = useCallback(async (code: string): Promise<DeviceSession> => {
    console.log(`Joining with access code: ${code}`);
    // Placeholder implementation
    const session: DeviceSession = {
      sessionId: uuid.v4() as string,
      deviceId,
      tournamentId: 'placeholder',
      role: 'referee',
      permissions: ['score_entry'],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      isActive: true,
    };
    
    setCurrentSession(session);
    return session;
  }, [deviceId]);

  const generateAccessCode = useCallback(async (
    tournamentId: string, 
    role: 'referee' | 'spectator', 
    options = {}
  ) => {
    console.log(`Generating access code for tournament ${tournamentId}, role: ${role}`);
    // Placeholder implementation
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
    return { code };
  }, []);

  const delegatePermissions = useCallback(async (
    deviceId: string, 
    tournamentId: string, 
    permissions: string[], 
    matchIds?: string[]
  ) => {
    console.log(`Delegating permissions to device ${deviceId}: ${permissions.join(', ')}`);
    // Placeholder implementation
  }, []);

  const hasPermission = useCallback(async (permission: string, matchId?: string): Promise<boolean> => {
    if (!currentSession) return false;
    return currentSession.permissions.includes(permission);
  }, [currentSession]);

  const endSession = useCallback(async () => {
    console.log('Ending current session');
    setCurrentSession(null);
    setCurrentDevice(null);
    setActiveDevices([]);
  }, []);

  // Event listener management
  const onSyncComplete = useCallback((callback: () => void) => {
    eventListeners.syncComplete.push(callback);
    return () => {
      const index = eventListeners.syncComplete.indexOf(callback);
      if (index !== -1) {
        eventListeners.syncComplete.splice(index, 1);
      }
    };
  }, [eventListeners.syncComplete]);

  const onConflictDetected = useCallback((callback: (conflict: ConflictResolution) => void) => {
    eventListeners.conflictDetected.push(callback);
    return () => {
      const index = eventListeners.conflictDetected.indexOf(callback);
      if (index !== -1) {
        eventListeners.conflictDetected.splice(index, 1);
      }
    };
  }, [eventListeners.conflictDetected]);

  const onOfflineWarning = useCallback((callback: (timeRemaining: number) => void) => {
    eventListeners.offlineWarning.push(callback);
    return () => {
      const index = eventListeners.offlineWarning.indexOf(callback);
      if (index !== -1) {
        eventListeners.offlineWarning.splice(index, 1);
      }
    };
  }, [eventListeners.offlineWarning]);

  return (
    <SyncContext.Provider value={{
      syncStatus,
      lastSyncTime,
      isOnline,
      isConnected,
      networkType,
      conflicts,
      hasConflicts,
      currentSession,
      currentDevice,
      activeDevices,
      forceSync,
      enableOfflineMode,
      disableOfflineMode,
      resolveConflict,
      ignoreConflict,
      resolveAllConflicts,
      joinWithAccessCode,
      generateAccessCode,
      delegatePermissions,
      hasPermission,
      endSession,
      onSyncComplete,
      onConflictDetected,
      onOfflineWarning,
      canOperateOffline,
      offlineTimeRemaining,
      cacheStats,
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

// Convenience hook for conflict resolution
export const useConflictResolution = () => {
  const { conflicts, hasConflicts, resolveConflict, ignoreConflict, resolveAllConflicts } = useSync();
  return { conflicts, hasConflicts, resolveConflict, ignoreConflict, resolveAllConflicts };
};
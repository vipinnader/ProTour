// Sync context for ProTour - Epic 2B Implementation

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { syncService, SyncStatus, ConflictResolution } from '@protour/shared';
import { multiDeviceService, DeviceSession, DeviceInfo } from '@protour/shared';

interface SyncContextType {
  // Sync status
  syncStatus: SyncStatus;
  conflicts: ConflictResolution[];
  
  // Device & session management
  currentSession: DeviceSession | null;
  currentDevice: DeviceInfo | null;
  activeDevices: DeviceInfo[];
  
  // Actions
  forceSync: () => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'manual', manualData?: any) => Promise<void>;
  joinWithAccessCode: (code: string) => Promise<DeviceSession>;
  generateAccessCode: (tournamentId: string, role: 'referee' | 'spectator', options?: {
    expirationMinutes?: number;
    maxUses?: number;
    permissions?: string[];
  }) => Promise<{ code: string }>;
  delegatePermissions: (deviceId: string, tournamentId: string, permissions: string[], matchIds?: string[]) => Promise<void>;
  hasPermission: (permission: string, matchId?: string) => Promise<boolean>;
  endSession: () => Promise<void>;
  
  // Status indicators
  isOnline: boolean;
  isConnected: boolean;
  lastSyncTime: Date | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    lastSyncTime: 0,
    pendingOperations: 0,
    syncInProgress: false,
  });
  
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
  const [currentSession, setCurrentSession] = useState<DeviceSession | null>(null);
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo | null>(null);
  const [activeDevices, setActiveDevices] = useState<DeviceInfo[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Initialize sync service and device service
  useEffect(() => {
    // Load initial state
    const loadInitialState = async () => {
      const status = syncService.getSyncStatus();
      setSyncStatus(status);
      
      const conflictList = syncService.getConflicts();
      setConflicts(conflictList);
      
      const session = multiDeviceService.getCurrentSession();
      setCurrentSession(session);
      
      const device = multiDeviceService.getCurrentDevice();
      setCurrentDevice(device);
      
      if (session?.tournamentId) {
        const devices = await multiDeviceService.getActiveDevices(session.tournamentId);
        setActiveDevices(devices);
      }
    };

    loadInitialState();

    // Set up listeners
    const unsubscribeConnectivity = syncService.subscribe('connectivity', () => {
      const status = syncService.getSyncStatus();
      setSyncStatus(status);
    });

    const unsubscribeSyncStart = syncService.subscribe('syncStart', () => {
      setSyncStatus(prev => ({ ...prev, syncInProgress: true }));
    });

    const unsubscribeSyncComplete = syncService.subscribe('syncComplete', () => {
      const status = syncService.getSyncStatus();
      setSyncStatus(status);
      setLastSyncTime(new Date());
    });

    const unsubscribeConflict = syncService.subscribe('conflict', () => {
      const conflictList = syncService.getConflicts();
      setConflicts(conflictList);
    });

    const unsubscribeConflictResolved = syncService.subscribe('conflictResolved', () => {
      const conflictList = syncService.getConflicts();
      setConflicts(conflictList);
    });

    const unsubscribeQueue = syncService.subscribe('queue', () => {
      const status = syncService.getSyncStatus();
      setSyncStatus(status);
    });

    // Start connectivity monitoring
    multiDeviceService.startConnectivityMonitoring();

    return () => {
      unsubscribeConnectivity();
      unsubscribeSyncStart();
      unsubscribeSyncComplete();
      unsubscribeConflict();
      unsubscribeConflictResolved();
      unsubscribeQueue();
    };
  }, []);

  // Update active devices when session changes
  useEffect(() => {
    const updateActiveDevices = async () => {
      if (currentSession?.tournamentId) {
        try {
          const devices = await multiDeviceService.getActiveDevices(currentSession.tournamentId);
          setActiveDevices(devices);
        } catch (error) {
          console.error('Error fetching active devices:', error);
        }
      } else {
        setActiveDevices([]);
      }
    };

    updateActiveDevices();
    
    // Update devices every 30 seconds if we have an active session
    if (currentSession) {
      const interval = setInterval(updateActiveDevices, 30000);
      return () => clearInterval(interval);
    }
  }, [currentSession?.tournamentId]);

  const forceSync = async (): Promise<void> => {
    try {
      await syncService.forceSync();
    } catch (error) {
      console.error('Error forcing sync:', error);
      throw error;
    }
  };

  const resolveConflict = async (
    conflictId: string,
    resolution: 'local' | 'remote' | 'manual',
    manualData?: any
  ): Promise<void> => {
    try {
      await syncService.resolveConflict(conflictId, resolution, manualData);
    } catch (error) {
      console.error('Error resolving conflict:', error);
      throw error;
    }
  };

  const joinWithAccessCode = async (code: string): Promise<DeviceSession> => {
    try {
      const session = await multiDeviceService.joinWithAccessCode(code);
      setCurrentSession(session);
      
      // Update current device
      const device = multiDeviceService.getCurrentDevice();
      setCurrentDevice(device);
      
      return session;
    } catch (error) {
      console.error('Error joining with access code:', error);
      throw error;
    }
  };

  const generateAccessCode = async (
    tournamentId: string,
    role: 'referee' | 'spectator',
    options: {
      expirationMinutes?: number;
      maxUses?: number;
      permissions?: string[];
    } = {}
  ): Promise<{ code: string }> => {
    try {
      const accessCode = await multiDeviceService.generateAccessCode(
        tournamentId,
        role,
        options.expirationMinutes,
        options.maxUses,
        options.permissions
      );
      return { code: accessCode.code };
    } catch (error) {
      console.error('Error generating access code:', error);
      throw error;
    }
  };

  const delegatePermissions = async (
    deviceId: string,
    tournamentId: string,
    permissions: string[],
    matchIds?: string[]
  ): Promise<void> => {
    try {
      await multiDeviceService.delegatePermissions(
        deviceId,
        tournamentId,
        permissions,
        matchIds
      );
    } catch (error) {
      console.error('Error delegating permissions:', error);
      throw error;
    }
  };

  const hasPermission = async (permission: string, matchId?: string): Promise<boolean> => {
    try {
      return await multiDeviceService.hasPermission(permission, matchId);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  };

  const endSession = async (): Promise<void> => {
    try {
      await multiDeviceService.endSession();
      setCurrentSession(null);
      setActiveDevices([]);
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  };

  const value: SyncContextType = {
    syncStatus,
    conflicts,
    currentSession,
    currentDevice,
    activeDevices,
    forceSync,
    resolveConflict,
    joinWithAccessCode,
    generateAccessCode,
    delegatePermissions,
    hasPermission,
    endSession,
    isOnline: syncStatus.isOnline,
    isConnected: syncStatus.isOnline && !syncStatus.syncInProgress,
    lastSyncTime,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

// Hook for checking permissions
export const usePermissions = () => {
  const { hasPermission, currentSession } = useSync();
  
  return {
    hasPermission,
    isOrganizer: currentSession?.role === 'organizer',
    isReferee: currentSession?.role === 'referee',
    isSpectator: currentSession?.role === 'spectator',
    tournamentId: currentSession?.tournamentId,
    assignedMatches: currentSession?.assignedMatches || [],
  };
};

// Hook for conflict resolution UI
export const useConflictResolution = () => {
  const { conflicts, resolveConflict } = useSync();
  
  const unresolvedConflicts = conflicts.filter(c => !c.resolved);
  
  const resolveWithLocal = (conflictId: string) => resolveConflict(conflictId, 'local');
  const resolveWithRemote = (conflictId: string) => resolveConflict(conflictId, 'remote');
  const resolveManually = (conflictId: string, data: any) => resolveConflict(conflictId, 'manual', data);
  
  return {
    conflicts: unresolvedConflicts,
    hasConflicts: unresolvedConflicts.length > 0,
    resolveWithLocal,
    resolveWithRemote,
    resolveManually,
  };
};
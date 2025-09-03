// Multi-device coordination service for ProTour - Epic 2B Implementation

import { offlineDataService, OfflineDataService } from './OfflineDataService';
import { syncService, SyncService } from './SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'react-native-uuid';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  userId: string;
  role: 'organizer' | 'referee' | 'spectator';
  capabilities: string[];
  lastSeen: number;
  isActive: boolean;
  tournamentId?: string;
}

export interface AccessCode {
  code: string;
  tournamentId: string;
  role: 'referee' | 'spectator';
  expiresAt: number;
  createdBy: string;
  maxUses: number;
  currentUses: number;
  permissions: string[];
}

export interface DelegatedPermission {
  id: string;
  deviceId: string;
  userId: string;
  tournamentId: string;
  permissions: string[];
  matchIds?: string[];
  expiresAt: number;
  createdBy: string;
  isActive: boolean;
}

export interface DeviceSession {
  sessionId: string;
  deviceId: string;
  userId: string;
  tournamentId: string;
  role: 'organizer' | 'referee' | 'spectator';
  startTime: number;
  lastActivity: number;
  permissions: string[];
  assignedMatches?: string[];
}

export class MultiDeviceService {
  private dataService: OfflineDataService;
  private syncService: SyncService;
  private currentDeviceInfo: DeviceInfo | null = null;
  private activeSession: DeviceSession | null = null;

  private readonly COLLECTIONS = {
    DEVICES: 'devices',
    ACCESS_CODES: 'accessCodes',
    PERMISSIONS: 'delegatedPermissions',
    SESSIONS: 'deviceSessions',
  } as const;

  private readonly STORAGE_KEYS = {
    DEVICE_INFO: '@protour/device_info',
    ACTIVE_SESSION: '@protour/active_session',
  } as const;

  constructor() {
    this.dataService = offlineDataService;
    this.syncService = syncService;
    this.initializeDevice();
  }

  private async initializeDevice(): Promise<void> {
    try {
      // Load or create device info
      const savedDeviceInfo = await AsyncStorage.getItem(this.STORAGE_KEYS.DEVICE_INFO);
      if (savedDeviceInfo) {
        this.currentDeviceInfo = JSON.parse(savedDeviceInfo);
      } else {
        this.currentDeviceInfo = await this.createDeviceInfo();
      }

      // Load active session
      const savedSession = await AsyncStorage.getItem(this.STORAGE_KEYS.ACTIVE_SESSION);
      if (savedSession) {
        this.activeSession = JSON.parse(savedSession);
        // Validate session is still active
        if (this.activeSession && this.activeSession.lastActivity < Date.now() - 24 * 60 * 60 * 1000) {
          await this.endSession();
        }
      }
    } catch (error) {
      console.error('Error initializing device:', error);
    }
  }

  private async createDeviceInfo(): Promise<DeviceInfo> {
    const deviceInfo: DeviceInfo = {
      deviceId: uuidv4() as string,
      deviceName: await this.getDeviceName(),
      userId: '', // Will be set when user logs in
      role: 'spectator',
      capabilities: ['view_tournament', 'view_matches'],
      lastSeen: Date.now(),
      isActive: true,
    };

    await AsyncStorage.setItem(this.STORAGE_KEYS.DEVICE_INFO, JSON.stringify(deviceInfo));
    return deviceInfo;
  }

  private async getDeviceName(): Promise<string> {
    try {
      // Try to get device name from React Native DeviceInfo if available
      // For now, generate a friendly name
      const timestamp = new Date().toISOString().slice(0, 10);
      return `Device ${timestamp}`;
    } catch (error) {
      return `ProTour Device ${Date.now()}`;
    }
  }

  // Update device info when user logs in
  async updateDeviceUser(userId: string, role: 'organizer' | 'referee' | 'spectator' = 'spectator'): Promise<void> {
    if (!this.currentDeviceInfo) {
      await this.initializeDevice();
    }

    if (this.currentDeviceInfo) {
      this.currentDeviceInfo.userId = userId;
      this.currentDeviceInfo.role = role;
      this.currentDeviceInfo.lastSeen = Date.now();

      // Update capabilities based on role
      switch (role) {
        case 'organizer':
          this.currentDeviceInfo.capabilities = [
            'manage_tournament',
            'manage_matches',
            'manage_players',
            'generate_brackets',
            'delegate_permissions',
            'view_all',
          ];
          break;
        case 'referee':
          this.currentDeviceInfo.capabilities = [
            'enter_scores',
            'manage_assigned_matches',
            'view_tournament',
            'view_matches',
          ];
          break;
        case 'spectator':
          this.currentDeviceInfo.capabilities = [
            'view_tournament',
            'view_matches',
            'view_brackets',
          ];
          break;
      }

      await AsyncStorage.setItem(this.STORAGE_KEYS.DEVICE_INFO, JSON.stringify(this.currentDeviceInfo));
      
      // Register device in database
      await this.dataService.create(this.COLLECTIONS.DEVICES, this.currentDeviceInfo, userId);
    }
  }

  // Generate access code for tournament
  async generateAccessCode(
    tournamentId: string,
    role: 'referee' | 'spectator',
    expirationMinutes: number = 60,
    maxUses: number = 10,
    permissions: string[] = []
  ): Promise<AccessCode> {
    if (!this.currentDeviceInfo || this.currentDeviceInfo.role !== 'organizer') {
      throw new Error('Only organizers can generate access codes');
    }

    const code = this.generateRandomCode();
    const accessCode: AccessCode = {
      code,
      tournamentId,
      role,
      expiresAt: Date.now() + (expirationMinutes * 60 * 1000),
      createdBy: this.currentDeviceInfo.userId,
      maxUses,
      currentUses: 0,
      permissions: permissions.length > 0 ? permissions : this.getDefaultPermissions(role),
    };

    await this.dataService.create(this.COLLECTIONS.ACCESS_CODES, accessCode, this.currentDeviceInfo.userId);
    return accessCode;
  }

  private generateRandomCode(): string {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  private getDefaultPermissions(role: 'referee' | 'spectator'): string[] {
    switch (role) {
      case 'referee':
        return ['enter_scores', 'manage_assigned_matches', 'view_tournament'];
      case 'spectator':
        return ['view_tournament', 'view_matches', 'view_brackets'];
      default:
        return ['view_tournament'];
    }
  }

  // Join tournament with access code
  async joinWithAccessCode(code: string): Promise<DeviceSession> {
    if (!this.currentDeviceInfo) {
      throw new Error('Device not initialized');
    }

    // Find valid access code
    const accessCodes = await this.dataService.query<AccessCode>({
      collection: this.COLLECTIONS.ACCESS_CODES,
      where: [
        ['code', '==', code],
        ['expiresAt', '>', Date.now()],
        ['currentUses', '<', 'maxUses'],
      ],
    });

    if (accessCodes.length === 0) {
      throw new Error('Invalid or expired access code');
    }

    const accessCode = accessCodes[0].data;

    // Update access code usage
    await this.dataService.update(
      this.COLLECTIONS.ACCESS_CODES,
      accessCodes[0].id,
      {
        currentUses: accessCode.currentUses + 1,
      },
      this.currentDeviceInfo.userId
    );

    // Create device session
    const session: DeviceSession = {
      sessionId: uuidv4() as string,
      deviceId: this.currentDeviceInfo.deviceId,
      userId: this.currentDeviceInfo.userId,
      tournamentId: accessCode.tournamentId,
      role: accessCode.role,
      startTime: Date.now(),
      lastActivity: Date.now(),
      permissions: accessCode.permissions,
    };

    await this.dataService.create(this.COLLECTIONS.SESSIONS, session, this.currentDeviceInfo.userId);
    
    // Update device role and tournament
    await this.updateDeviceUser(this.currentDeviceInfo.userId, accessCode.role);
    this.currentDeviceInfo.tournamentId = accessCode.tournamentId;
    
    this.activeSession = session;
    await AsyncStorage.setItem(this.STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));

    return session;
  }

  // Delegate specific permissions to a device
  async delegatePermissions(
    deviceId: string,
    tournamentId: string,
    permissions: string[],
    matchIds?: string[],
    expirationHours: number = 8
  ): Promise<DelegatedPermission> {
    if (!this.currentDeviceInfo || this.currentDeviceInfo.role !== 'organizer') {
      throw new Error('Only organizers can delegate permissions');
    }

    // Find target device
    const devices = await this.dataService.query<DeviceInfo>({
      collection: this.COLLECTIONS.DEVICES,
      where: [
        ['deviceId', '==', deviceId],
        ['isActive', '==', true],
      ],
    });

    if (devices.length === 0) {
      throw new Error('Target device not found or inactive');
    }

    const delegatedPermission: DelegatedPermission = {
      id: uuidv4() as string,
      deviceId,
      userId: devices[0].data.userId,
      tournamentId,
      permissions,
      matchIds,
      expiresAt: Date.now() + (expirationHours * 60 * 60 * 1000),
      createdBy: this.currentDeviceInfo.userId,
      isActive: true,
    };

    await this.dataService.create(
      this.COLLECTIONS.PERMISSIONS,
      delegatedPermission,
      this.currentDeviceInfo.userId
    );

    return delegatedPermission;
  }

  // Check if current device has permission
  async hasPermission(permission: string, matchId?: string): Promise<boolean> {
    if (!this.activeSession) {
      return false;
    }

    // Check session permissions
    if (!this.activeSession.permissions.includes(permission)) {
      return false;
    }

    // If match-specific permission is required, check assigned matches
    if (matchId && this.activeSession.assignedMatches) {
      return this.activeSession.assignedMatches.includes(matchId);
    }

    // Check for additional delegated permissions
    const delegatedPermissions = await this.dataService.query<DelegatedPermission>({
      collection: this.COLLECTIONS.PERMISSIONS,
      where: [
        ['deviceId', '==', this.currentDeviceInfo?.deviceId || ''],
        ['tournamentId', '==', this.activeSession.tournamentId],
        ['expiresAt', '>', Date.now()],
        ['isActive', '==', true],
      ],
    });

    for (const delegated of delegatedPermissions) {
      if (delegated.data.permissions.includes(permission)) {
        // Check match-specific permissions
        if (matchId && delegated.data.matchIds) {
          return delegated.data.matchIds.includes(matchId);
        }
        return true;
      }
    }

    return false;
  }

  // Get active devices for a tournament
  async getActiveDevices(tournamentId: string): Promise<DeviceInfo[]> {
    const sessions = await this.dataService.query<DeviceSession>({
      collection: this.COLLECTIONS.SESSIONS,
      where: [
        ['tournamentId', '==', tournamentId],
        ['lastActivity', '>', Date.now() - 5 * 60 * 1000], // Active in last 5 minutes
      ],
    });

    const deviceIds = sessions.map(session => session.data.deviceId);
    if (deviceIds.length === 0) {
      return [];
    }

    const devices = await this.dataService.query<DeviceInfo>({
      collection: this.COLLECTIONS.DEVICES,
      where: [['deviceId', 'in', deviceIds]],
    });

    return devices.map(device => device.data);
  }

  // Update session activity
  async updateActivity(): Promise<void> {
    if (this.activeSession) {
      this.activeSession.lastActivity = Date.now();
      
      await this.dataService.update(
        this.COLLECTIONS.SESSIONS,
        this.activeSession.sessionId,
        { lastActivity: this.activeSession.lastActivity },
        this.currentDeviceInfo?.userId
      );

      await AsyncStorage.setItem(this.STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(this.activeSession));
    }
  }

  // End current session
  async endSession(): Promise<void> {
    if (this.activeSession) {
      await this.dataService.update(
        this.COLLECTIONS.SESSIONS,
        this.activeSession.sessionId,
        { lastActivity: Date.now() },
        this.currentDeviceInfo?.userId
      );

      this.activeSession = null;
      await AsyncStorage.removeItem(this.STORAGE_KEYS.ACTIVE_SESSION);
    }
  }

  // Get current session info
  getCurrentSession(): DeviceSession | null {
    return this.activeSession;
  }

  // Get current device info
  getCurrentDevice(): DeviceInfo | null {
    return this.currentDeviceInfo;
  }

  // Revoke access code
  async revokeAccessCode(code: string): Promise<void> {
    if (!this.currentDeviceInfo || this.currentDeviceInfo.role !== 'organizer') {
      throw new Error('Only organizers can revoke access codes');
    }

    const accessCodes = await this.dataService.query<AccessCode>({
      collection: this.COLLECTIONS.ACCESS_CODES,
      where: [
        ['code', '==', code],
        ['createdBy', '==', this.currentDeviceInfo.userId],
      ],
    });

    for (const accessCode of accessCodes) {
      await this.dataService.update(
        this.COLLECTIONS.ACCESS_CODES,
        accessCode.id,
        { expiresAt: Date.now() }, // Expire immediately
        this.currentDeviceInfo.userId
      );
    }
  }

  // Revoke delegated permissions
  async revokeDelegatedPermissions(permissionId: string): Promise<void> {
    if (!this.currentDeviceInfo || this.currentDeviceInfo.role !== 'organizer') {
      throw new Error('Only organizers can revoke delegated permissions');
    }

    await this.dataService.update(
      this.COLLECTIONS.PERMISSIONS,
      permissionId,
      { isActive: false },
      this.currentDeviceInfo.userId
    );
  }

  // Get all access codes created by current user
  async getMyAccessCodes(tournamentId?: string): Promise<AccessCode[]> {
    if (!this.currentDeviceInfo) {
      return [];
    }

    const where: Array<[string, any, any]> = [
      ['createdBy', '==', this.currentDeviceInfo.userId],
    ];

    if (tournamentId) {
      where.push(['tournamentId', '==', tournamentId]);
    }

    const accessCodes = await this.dataService.query<AccessCode>({
      collection: this.COLLECTIONS.ACCESS_CODES,
      where,
      orderBy: [['expiresAt', 'desc']],
    });

    return accessCodes.map(code => code.data);
  }

  // Monitor device connectivity
  startConnectivityMonitoring(): void {
    // Update activity every 30 seconds when active
    const activityInterval = setInterval(async () => {
      if (this.activeSession) {
        await this.updateActivity();
      }
    }, 30 * 1000);

    // Clean up on app close
    const cleanup = () => {
      clearInterval(activityInterval);
      this.endSession();
    };

    // Register cleanup handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', cleanup);
    }
  }
}

export const multiDeviceService = new MultiDeviceService();
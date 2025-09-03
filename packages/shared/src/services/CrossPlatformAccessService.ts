// Cross-Platform Tournament Access & Notifications Service - Epic 3 Story 3.6
import {
  Tournament,
  NotificationPreference,
  User,
  TournamentAccess,
  Timestamp,
} from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';
import { SyncService } from './SyncService';

export interface DeviceSession {
  deviceId: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'web';
  platform: 'ios' | 'android' | 'web' | 'windows' | 'macos';
  userId: string;
  lastSync: Date;
  isActive: boolean;
  capabilities: {
    offline: boolean;
    pushNotifications: boolean;
    backgroundSync: boolean;
  };
}

export interface TournamentBookmark {
  id: string;
  userId: string;
  tournamentId: string;
  bookmarkedAt: Date;
  quickAccessCode: string; // 4-digit PIN for quick access
  notificationsEnabled: boolean;
}

export interface PWAConfig {
  tournamentId: string;
  enableOfflineViewing: boolean;
  cacheDuration: number; // hours
  allowedFeatures: (
    | 'bracket-view'
    | 'live-scores'
    | 'player-search'
    | 'notifications'
  )[];
}

export interface CrossPlatformSyncStatus {
  lastSync: Date;
  pendingChanges: number;
  syncInProgress: boolean;
  conflicts: number;
  devicesConnected: number;
  networkStatus: 'online' | 'offline' | 'poor';
}

export class CrossPlatformAccessService {
  private db: DatabaseService;
  private notificationService: NotificationService;
  private syncService: SyncService;
  private activeSessions: Map<string, DeviceSession> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.db = new DatabaseService();
    this.notificationService = new NotificationService();
    this.syncService = new SyncService();
  }

  /**
   * Establish cross-platform session for a user
   * AC3.6.1: Account synchronization across mobile, tablet, web
   */
  async establishDeviceSession(
    userId: string,
    deviceInfo: {
      deviceId: string;
      deviceType: 'mobile' | 'tablet' | 'desktop' | 'web';
      platform: 'ios' | 'android' | 'web' | 'windows' | 'macos';
      appVersion: string;
      capabilities: {
        offline: boolean;
        pushNotifications: boolean;
        backgroundSync: boolean;
      };
    }
  ): Promise<DeviceSession> {
    try {
      const session: DeviceSession = {
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,
        userId,
        lastSync: new Date(),
        isActive: true,
        capabilities: deviceInfo.capabilities,
      };

      // Register device session
      await this.db.registerDeviceSession(session);

      // Store in active sessions
      this.activeSessions.set(deviceInfo.deviceId, session);

      // Start sync interval if device supports background sync
      if (session.capabilities.backgroundSync) {
        this.startBackgroundSync(deviceInfo.deviceId);
      }

      // Sync user data to new device
      await this.syncUserDataToDevice(userId, deviceInfo.deviceId);

      return session;
    } catch (error) {
      throw new Error(`Failed to establish device session: ${error.message}`);
    }
  }

  /**
   * Configure push notifications across devices
   * AC3.6.2: Push notification delivery for alerts and updates
   */
  async configurePushNotifications(
    userId: string,
    deviceId: string,
    config: {
      fcmToken?: string; // Firebase Cloud Messaging token
      apnsToken?: string; // Apple Push Notification Service token
      webPushSubscription?: any; // Web Push API subscription
      preferences: NotificationPreference;
    }
  ): Promise<void> {
    try {
      // Update device notification tokens
      await this.db.updateDeviceNotificationTokens(deviceId, {
        fcm: config.fcmToken,
        apns: config.apnsToken,
        webPush: config.webPushSubscription,
      });

      // Save notification preferences
      await this.db.saveNotificationPreferences(userId, config.preferences);

      // Test notification delivery
      await this.notificationService.sendTestNotification(userId, deviceId);
    } catch (error) {
      throw new Error(
        `Failed to configure push notifications: ${error.message}`
      );
    }
  }

  /**
   * Manage customizable notification preferences per tournament
   * AC3.6.3: Customizable notification preferences per tournament
   */
  async updateTournamentNotificationPreferences(
    userId: string,
    tournamentId: string,
    preferences: {
      matchReady: { enabled: boolean; timing: ('30min' | '10min' | 'now')[] };
      matchCompleted: { enabled: boolean; ownMatchesOnly: boolean };
      bracketUpdated: { enabled: boolean; roundCompletionOnly: boolean };
      tournamentAnnouncements: { enabled: boolean; urgentOnly: boolean };
      followedPlayers: { enabled: boolean; playersIds: string[] };
      quietHours: { enabled: boolean; start: string; end: string }; // HH:mm format
    }
  ): Promise<void> {
    try {
      const notificationConfig: NotificationPreference = {
        id: this.generateId(),
        userId,
        tournamentId,
        type: 'tournament-update',
        enabled: true,
        timing: {
          thirtyMinutes: preferences.matchReady.timing.includes('30min'),
          tenMinutes: preferences.matchReady.timing.includes('10min'),
          immediate: preferences.matchReady.timing.includes('now'),
        },
        delivery: ['push'], // Default to push, can be enhanced
      };

      await this.db.saveTournamentNotificationPreferences(
        userId,
        tournamentId,
        {
          ...preferences,
          notificationConfig,
        }
      );

      // Update all registered devices for this user
      const userDevices = await this.db.getUserDevices(userId);
      for (const device of userDevices) {
        await this.syncNotificationPreferencesToDevice(
          device.deviceId,
          tournamentId,
          preferences
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to update notification preferences: ${error.message}`
      );
    }
  }

  /**
   * Enable Progressive Web App for basic tournament viewing
   * AC3.6.4: Progressive Web App basic tournament viewing
   */
  async configurePWA(
    tournamentId: string,
    config: PWAConfig
  ): Promise<{
    pwaUrl: string;
    installInstructions: {
      ios: string[];
      android: string[];
      desktop: string[];
    };
    cacheManifest: {
      resources: string[];
      totalSize: number;
      expiryDate: Date;
    };
  }> {
    try {
      // Generate PWA configuration
      const pwaConfig = {
        tournamentId,
        enableOfflineViewing: config.enableOfflineViewing,
        cacheDuration: config.cacheDuration,
        allowedFeatures: config.allowedFeatures,
      };

      await this.db.savePWAConfig(tournamentId, pwaConfig);

      // Generate PWA URL
      const pwaUrl = `https://protour.app/pwa/tournament/${tournamentId}`;

      // Prepare cache manifest
      const cacheManifest = await this.generatePWACacheManifest(
        tournamentId,
        config
      );

      return {
        pwaUrl,
        installInstructions: {
          ios: [
            'Open tournament link in Safari',
            'Tap the Share button',
            'Tap "Add to Home Screen"',
            'Tap "Add" in the top-right corner',
          ],
          android: [
            'Open tournament link in Chrome',
            'Tap the menu button (three dots)',
            'Tap "Add to Home screen"',
            'Tap "Add" to confirm',
          ],
          desktop: [
            'Open tournament link in Chrome/Edge',
            'Click the install button in address bar',
            'Click "Install" to add to desktop',
          ],
        },
        cacheManifest,
      };
    } catch (error) {
      throw new Error(`Failed to configure PWA: ${error.message}`);
    }
  }

  /**
   * Bookmark tournaments for quick access
   * AC3.6.5: Tournament bookmarking and quick access
   */
  async bookmarkTournament(
    userId: string,
    tournamentId: string
  ): Promise<TournamentBookmark> {
    try {
      // Check if already bookmarked
      const existingBookmark = await this.db.getTournamentBookmark(
        userId,
        tournamentId
      );
      if (existingBookmark) {
        throw new Error('Tournament already bookmarked');
      }

      // Generate unique 4-digit quick access code
      const quickAccessCode = await this.generateUniqueQuickAccessCode(userId);

      const bookmark: TournamentBookmark = {
        id: this.generateId(),
        userId,
        tournamentId,
        bookmarkedAt: new Date(),
        quickAccessCode,
        notificationsEnabled: true,
      };

      await this.db.createTournamentBookmark(bookmark);

      // Sync to all user devices
      await this.syncBookmarksToUserDevices(userId);

      return bookmark;
    } catch (error) {
      throw new Error(`Failed to bookmark tournament: ${error.message}`);
    }
  }

  /**
   * Access tournament via quick access code
   */
  async accessTournamentByQuickCode(
    userId: string,
    quickCode: string
  ): Promise<Tournament> {
    try {
      const bookmark = await this.db.getTournamentBookmarkByCode(
        userId,
        quickCode
      );
      if (!bookmark) {
        throw new Error('Invalid quick access code');
      }

      const tournament = await this.db.getTournament(bookmark.tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Update last accessed timestamp
      await this.db.updateBookmarkLastAccessed(bookmark.id, new Date());

      return tournament;
    } catch (error) {
      throw new Error(`Failed to access tournament: ${error.message}`);
    }
  }

  /**
   * Enable offline tournament viewing with cached data
   * AC3.6.6: Offline tournament viewing with cached data
   */
  async enableOfflineViewing(
    userId: string,
    tournamentId: string,
    deviceId: string
  ): Promise<{
    cacheSize: number;
    expiryDate: Date;
    cachedFeatures: string[];
    syncStatus: 'complete' | 'partial' | 'failed';
  }> {
    try {
      const tournament = await this.db.getTournament(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Cache essential tournament data
      const cacheData = await this.prepareTournamentCacheData(tournamentId);

      // Store cache on device
      await this.db.storeTournamentCache(deviceId, tournamentId, {
        tournament,
        matches: cacheData.matches,
        players: cacheData.players,
        bracket: cacheData.bracket,
        timeline: cacheData.timeline,
        cachedAt: new Date(),
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      const cacheSize = this.calculateCacheSize(cacheData);

      return {
        cacheSize,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        cachedFeatures: [
          'bracket-view',
          'match-results',
          'player-list',
          'tournament-info',
        ],
        syncStatus: 'complete',
      };
    } catch (error) {
      return {
        cacheSize: 0,
        expiryDate: new Date(),
        cachedFeatures: [],
        syncStatus: 'failed',
      };
    }
  }

  /**
   * Get cross-platform sync status
   */
  async getCrossPlatformSyncStatus(
    userId: string
  ): Promise<CrossPlatformSyncStatus> {
    try {
      const userDevices = await this.db.getUserDevices(userId);
      const activeDevices = userDevices.filter(d => d.isActive);

      const syncStatus = await this.syncService.getSyncStatus(userId);
      const networkStatus = await this.checkNetworkStatus();

      return {
        lastSync: syncStatus.lastSync,
        pendingChanges: syncStatus.pendingOperations,
        syncInProgress: syncStatus.inProgress,
        conflicts: syncStatus.conflicts,
        devicesConnected: activeDevices.length,
        networkStatus,
      };
    } catch (error) {
      throw new Error(`Failed to get sync status: ${error.message}`);
    }
  }

  /**
   * Force sync across all user devices
   */
  async forceSyncAllDevices(userId: string): Promise<{
    devicesUpdated: number;
    syncDuration: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    let devicesUpdated = 0;
    const errors: string[] = [];

    try {
      const userDevices = await this.db.getUserDevices(userId);

      for (const device of userDevices) {
        if (device.isActive) {
          try {
            await this.syncService.forceSyncDevice(device.deviceId);
            devicesUpdated++;
          } catch (error) {
            errors.push(`Device ${device.deviceId}: ${error.message}`);
          }
        }
      }

      const syncDuration = Date.now() - startTime;

      return {
        devicesUpdated,
        syncDuration,
        errors,
      };
    } catch (error) {
      throw new Error(`Failed to sync devices: ${error.message}`);
    }
  }

  // Private helper methods

  private startBackgroundSync(deviceId: string): void {
    const interval = setInterval(async () => {
      try {
        const session = this.activeSessions.get(deviceId);
        if (session && session.isActive) {
          await this.syncService.backgroundSync(deviceId);
          session.lastSync = new Date();
        } else {
          this.stopBackgroundSync(deviceId);
        }
      } catch (error) {
        console.error(`Background sync failed for device ${deviceId}:`, error);
      }
    }, 30000); // 30 seconds

    this.syncIntervals.set(deviceId, interval);
  }

  private stopBackgroundSync(deviceId: string): void {
    const interval = this.syncIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(deviceId);
    }
  }

  private async syncUserDataToDevice(
    userId: string,
    deviceId: string
  ): Promise<void> {
    try {
      // Get user's essential data
      const userData = await this.db.getUserEssentialData(userId);

      // Sync to device
      await this.syncService.syncUserDataToDevice(deviceId, userData);
    } catch (error) {
      throw new Error(`Failed to sync user data to device: ${error.message}`);
    }
  }

  private async syncNotificationPreferencesToDevice(
    deviceId: string,
    tournamentId: string,
    preferences: any
  ): Promise<void> {
    try {
      await this.syncService.syncNotificationPreferences(
        deviceId,
        tournamentId,
        preferences
      );
    } catch (error) {
      console.error(
        'Failed to sync notification preferences to device:',
        error
      );
    }
  }

  private async generatePWACacheManifest(
    tournamentId: string,
    config: PWAConfig
  ) {
    const tournament = await this.db.getTournament(tournamentId);
    const resources = [
      `/api/tournaments/${tournamentId}`,
      `/api/tournaments/${tournamentId}/matches`,
      `/api/tournaments/${tournamentId}/players`,
      `/api/tournaments/${tournamentId}/bracket`,
    ];

    // Add feature-specific resources
    if (config.allowedFeatures.includes('bracket-view')) {
      resources.push(`/static/bracket-assets.css`);
    }
    if (config.allowedFeatures.includes('live-scores')) {
      resources.push(`/static/live-score-assets.js`);
    }

    const totalSize = resources.length * 50; // Rough estimate in KB
    const expiryDate = new Date(
      Date.now() + config.cacheDuration * 60 * 60 * 1000
    );

    return {
      resources,
      totalSize,
      expiryDate,
    };
  }

  private async generateUniqueQuickAccessCode(userId: string): Promise<string> {
    let code: string;
    let attempts = 0;

    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      attempts++;

      if (attempts > 10) {
        throw new Error('Unable to generate unique quick access code');
      }
    } while (await this.db.quickAccessCodeExists(userId, code));

    return code;
  }

  private async syncBookmarksToUserDevices(userId: string): Promise<void> {
    try {
      const bookmarks = await this.db.getUserTournamentBookmarks(userId);
      const devices = await this.db.getUserDevices(userId);

      for (const device of devices) {
        if (device.isActive) {
          await this.syncService.syncBookmarksToDevice(
            device.deviceId,
            bookmarks
          );
        }
      }
    } catch (error) {
      console.error('Failed to sync bookmarks to devices:', error);
    }
  }

  private async prepareTournamentCacheData(tournamentId: string) {
    const [tournament, matches, players, bracket] = await Promise.all([
      this.db.getTournament(tournamentId),
      this.db.getTournamentMatches(tournamentId),
      this.db.getTournamentPlayers(tournamentId),
      this.db.getTournamentBracket(tournamentId),
    ]);

    // Get recent timeline events
    const timeline = await this.db.getTournamentTimeline(tournamentId, 50); // Last 50 events

    return {
      tournament,
      matches,
      players,
      bracket,
      timeline,
    };
  }

  private calculateCacheSize(cacheData: any): number {
    // Rough calculation of cache size in KB
    const dataString = JSON.stringify(cacheData);
    return Math.ceil(dataString.length / 1024);
  }

  private async checkNetworkStatus(): Promise<'online' | 'offline' | 'poor'> {
    try {
      // This would integrate with actual network monitoring
      // For now, return a simple check
      return navigator.onLine ? 'online' : 'offline';
    } catch (error) {
      return 'offline';
    }
  }

  private generateId(): string {
    return `xplat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const crossPlatformAccessService = new CrossPlatformAccessService();

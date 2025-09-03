// Real-Time Notification Service for Epic 2B.3 Implementation
// AC2B.3.3, AC2B.3.4: Smart notification delivery with multi-channel reliability

import { realTimeSyncService, TournamentUpdate } from './RealTimeSyncService';
import {
  PushNotificationService,
  PushNotificationFactory,
  PushConfig,
  PushNotificationPayload,
  NotificationTarget,
  NotificationResult,
} from './pushNotifications';
import { offlineDataService } from './OfflineDataService';
import { multiDeviceService } from './MultiDeviceService';

export interface NotificationPreference {
  userId: string;
  type:
    | 'match_completion'
    | 'bracket_advancement'
    | 'tournament_milestone'
    | 'emergency'
    | 'all';
  enabled: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  channels: NotificationChannel[];
  quietHours?: {
    start: string; // "22:00"
    end: string; // "08:00"
    timezone: string;
  };
}

export interface NotificationChannel {
  type: 'push' | 'sms' | 'in_app';
  enabled: boolean;
  address?: string; // phone number for SMS
  fallbackOrder: number; // 1 = primary, 2 = fallback, etc.
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type:
    | 'match_completion'
    | 'bracket_advancement'
    | 'tournament_milestone'
    | 'emergency';
  data?: Record<string, any>;
  read: boolean;
  createdAt: number;
  expiresAt?: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface NotificationDeliveryAttempt {
  id: string;
  notificationId: string;
  channel: 'push' | 'sms' | 'in_app';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'timeout';
  attempts: number;
  maxAttempts: number;
  lastAttempt: number;
  nextAttempt?: number;
  error?: string;
  deliveryConfirmation?: boolean;
}

export interface SMSConfig {
  provider: 'twilio' | 'aws_sns' | 'firebase_messaging';
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  region?: string;
  enabled: boolean;
}

export class RealTimeNotificationService {
  private pushService: PushNotificationService | null = null;
  private smsConfig: SMSConfig | null = null;
  private notificationQueue: Map<string, NotificationDeliveryAttempt> =
    new Map();
  private inAppNotifications: Map<string, InAppNotification[]> = new Map();
  private retryIntervals = [1000, 5000, 15000, 30000, 60000]; // 1s, 5s, 15s, 30s, 1m

  constructor(pushConfig?: PushConfig, smsConfig?: SMSConfig) {
    if (pushConfig) {
      this.pushService = PushNotificationFactory.create(pushConfig);
      this.pushService.initialize();
    }

    if (smsConfig) {
      this.smsConfig = smsConfig;
    }

    this.initializeRealTimeListeners();
    this.startDeliveryProcessor();
  }

  /**
   * AC2B.3.3: Smart notification delivery with priority handling
   */
  private initializeRealTimeListeners(): void {
    // Listen for tournament updates from real-time sync service
    realTimeSyncService.subscribe(
      'tournament_update',
      (update: TournamentUpdate) => {
        this.handleTournamentUpdate(update);
      }
    );

    realTimeSyncService.subscribe(
      'update_score_update',
      (update: TournamentUpdate) => {
        this.handleMatchCompletion(update);
      }
    );

    realTimeSyncService.subscribe(
      'update_bracket_update',
      (update: TournamentUpdate) => {
        this.handleBracketAdvancement(update);
      }
    );

    realTimeSyncService.subscribe(
      'update_tournament_status',
      (update: TournamentUpdate) => {
        this.handleTournamentMilestone(update);
      }
    );
  }

  /**
   * AC2B.3.3: Match completion notifications to relevant players
   */
  private async handleMatchCompletion(update: TournamentUpdate): Promise<void> {
    if (!update.matchId) return;

    try {
      // Get match data to identify players
      const matchData = update.data;
      const players = [matchData.player1Id, matchData.player2Id].filter(
        Boolean
      );
      const winnerId = matchData.winnerId;

      if (!winnerId) return; // Match not completed yet

      // Create notification for players
      const notification = {
        title: '🏆 Match Completed',
        body: `Your match has been completed. ${winnerId === matchData.player1Id ? matchData.player1Name : matchData.player2Name} won!`,
        type: 'match_completion' as const,
        priority: 'high' as const,
        data: {
          matchId: update.matchId,
          tournamentId: update.tournamentId,
          winnerId,
          type: 'match_completion',
        },
      };

      // Send to both players
      for (const playerId of players) {
        await this.sendSmartNotification(playerId, notification);
      }

      // Send to tournament spectators (lower priority)
      await this.sendSpectatorNotification(update.tournamentId, {
        ...notification,
        priority: 'normal',
        body: `${matchData.player1Name} vs ${matchData.player2Name} - ${winnerId === matchData.player1Id ? matchData.player1Name : matchData.player2Name} wins!`,
      });
    } catch (error) {
      console.error('Failed to handle match completion notification:', error);
    }
  }

  /**
   * AC2B.3.3: Bracket advancement notifications to spectators
   */
  private async handleBracketAdvancement(
    update: TournamentUpdate
  ): Promise<void> {
    const notification = {
      title: '📊 Bracket Updated',
      body: 'The tournament bracket has been updated with new match results',
      type: 'bracket_advancement' as const,
      priority: 'normal' as const,
      data: {
        tournamentId: update.tournamentId,
        type: 'bracket_advancement',
      },
    };

    await this.sendSpectatorNotification(update.tournamentId, notification);
  }

  /**
   * AC2B.3.3: Tournament milestone notifications
   */
  private async handleTournamentMilestone(
    update: TournamentUpdate
  ): Promise<void> {
    const tournamentData = update.data;
    let title = '';
    let priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';

    switch (tournamentData.status) {
      case 'semifinals':
        title = '🎾 Semifinals Starting!';
        priority = 'high';
        break;
      case 'finals':
        title = '🏆 Finals Starting!';
        priority = 'high';
        break;
      case 'completed':
        title = '🎉 Tournament Completed!';
        priority = 'high';
        break;
      default:
        return; // Don't notify for other status changes
    }

    const notification = {
      title,
      body: `${tournamentData.name} has reached an important milestone`,
      type: 'tournament_milestone' as const,
      priority,
      data: {
        tournamentId: update.tournamentId,
        status: tournamentData.status,
        type: 'tournament_milestone',
      },
    };

    await this.sendSpectatorNotification(update.tournamentId, notification);
  }

  /**
   * AC2B.3.4: Emergency notifications with high priority delivery
   */
  async sendEmergencyNotification(
    recipients: string[],
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    const notification = {
      title: `⚠️ ${title}`,
      body: message,
      type: 'emergency' as const,
      priority: 'critical' as const,
      data: {
        ...data,
        type: 'emergency',
        timestamp: Date.now(),
      },
    };

    // Send to all recipients with highest priority
    const promises = recipients.map(userId =>
      this.sendSmartNotification(userId, notification)
    );

    await Promise.all(promises);
  }

  /**
   * AC2B.3.4: Multi-channel notification reliability with fallback
   */
  private async sendSmartNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      type:
        | 'match_completion'
        | 'bracket_advancement'
        | 'tournament_milestone'
        | 'emergency';
      priority: 'low' | 'normal' | 'high' | 'critical';
      data?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Get user's notification preferences
      const preferences = await this.getUserNotificationPreferences(userId);
      const typePreference = preferences.find(
        p => p.type === notification.type || p.type === 'all'
      );

      if (!typePreference || !typePreference.enabled) {
        console.log(
          `Notifications disabled for user ${userId} and type ${notification.type}`
        );
        return;
      }

      // Check quiet hours
      if (
        this.isQuietHours(typePreference.quietHours) &&
        notification.priority !== 'critical'
      ) {
        // Queue for later delivery
        await this.queueForLaterDelivery(
          userId,
          notification,
          typePreference.quietHours!
        );
        return;
      }

      // Sort channels by fallback order
      const sortedChannels = typePreference.channels
        .filter(c => c.enabled)
        .sort((a, b) => a.fallbackOrder - b.fallbackOrder);

      // Create delivery attempt record
      const deliveryAttempt: NotificationDeliveryAttempt = {
        id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        channel: sortedChannels[0]?.type || 'push',
        status: 'pending',
        attempts: 0,
        maxAttempts: notification.priority === 'critical' ? 5 : 3,
        lastAttempt: Date.now(),
      };

      this.notificationQueue.set(deliveryAttempt.id, deliveryAttempt);

      // Start delivery process
      await this.attemptDelivery(
        userId,
        notification,
        sortedChannels,
        deliveryAttempt
      );
    } catch (error) {
      console.error('Failed to send smart notification:', error);
    }
  }

  /**
   * Attempt delivery through available channels with fallback
   */
  private async attemptDelivery(
    userId: string,
    notification: any,
    channels: NotificationChannel[],
    deliveryAttempt: NotificationDeliveryAttempt
  ): Promise<void> {
    for (const channel of channels) {
      try {
        let success = false;

        switch (channel.type) {
          case 'push':
            success = await this.sendPushNotification(userId, notification);
            break;
          case 'sms':
            success = await this.sendSMSNotification(
              userId,
              notification,
              channel.address
            );
            break;
          case 'in_app':
            success = await this.sendInAppNotification(userId, notification);
            break;
        }

        if (success) {
          deliveryAttempt.status = 'delivered';
          deliveryAttempt.channel = channel.type;
          deliveryAttempt.deliveryConfirmation = true;
          console.log(
            `Notification delivered to ${userId} via ${channel.type}`
          );
          return;
        }
      } catch (error) {
        console.error(`Failed to deliver via ${channel.type}:`, error);
        deliveryAttempt.error = error.message;
      }
    }

    // All channels failed
    deliveryAttempt.status = 'failed';
    deliveryAttempt.attempts++;

    // Schedule retry for critical notifications
    if (
      notification.priority === 'critical' &&
      deliveryAttempt.attempts < deliveryAttempt.maxAttempts
    ) {
      this.scheduleRetry(userId, notification, channels, deliveryAttempt);
    }
  }

  /**
   * AC2B.3.4: Primary push notification delivery via FCM
   */
  private async sendPushNotification(
    userId: string,
    notification: any
  ): Promise<boolean> {
    if (!this.pushService) return false;

    try {
      // Get user's push tokens
      const userTokens = await this.getUserPushTokens(userId);
      if (userTokens.length === 0) return false;

      const payload: PushNotificationPayload = {
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: notification.priority === 'critical' ? 'high' : 'normal',
        sound: notification.priority === 'critical' ? 'urgent' : 'default',
      };

      const target: NotificationTarget = {
        type: 'token',
        value: userTokens,
      };

      const result = await this.pushService.sendNotification(payload, target);
      return result.success && (result.successCount || 0) > 0;
    } catch (error) {
      console.error('Push notification failed:', error);
      return false;
    }
  }

  /**
   * AC2B.3.4: SMS fallback for critical updates
   */
  private async sendSMSNotification(
    userId: string,
    notification: any,
    phoneNumber?: string
  ): Promise<boolean> {
    if (!this.smsConfig || !this.smsConfig.enabled) return false;

    try {
      // Get user's phone number if not provided
      if (!phoneNumber) {
        phoneNumber = await this.getUserPhoneNumber(userId);
        if (!phoneNumber) return false;
      }

      const message = `${notification.title}\n\n${notification.body}\n\nFrom ProTour Tournament System`;

      switch (this.smsConfig.provider) {
        case 'twilio':
          return await this.sendTwilioSMS(phoneNumber, message);
        case 'aws_sns':
          return await this.sendAWSSMS(phoneNumber, message);
        case 'firebase_messaging':
          return await this.sendFirebaseSMS(phoneNumber, message);
        default:
          return false;
      }
    } catch (error) {
      console.error('SMS notification failed:', error);
      return false;
    }
  }

  /**
   * AC2B.3.4: In-app notification queue for offline users
   */
  private async sendInAppNotification(
    userId: string,
    notification: any
  ): Promise<boolean> {
    try {
      const inAppNotif: InAppNotification = {
        id: `inapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        data: notification.data,
        read: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        priority: notification.priority,
      };

      // Store in offline data service for persistence
      await offlineDataService.createOffline(
        'in_app_notifications',
        inAppNotif,
        userId
      );

      // Add to in-memory cache
      if (!this.inAppNotifications.has(userId)) {
        this.inAppNotifications.set(userId, []);
      }
      this.inAppNotifications.get(userId)!.unshift(inAppNotif);

      // Keep only last 50 notifications per user
      const userNotifications = this.inAppNotifications.get(userId)!;
      if (userNotifications.length > 50) {
        this.inAppNotifications.set(userId, userNotifications.slice(0, 50));
      }

      return true;
    } catch (error) {
      console.error('In-app notification failed:', error);
      return false;
    }
  }

  /**
   * Send notifications to tournament spectators
   */
  private async sendSpectatorNotification(
    tournamentId: string,
    notification: any
  ): Promise<void> {
    try {
      const spectators = await this.getTournamentSpectators(tournamentId);
      const promises = spectators.map(userId =>
        this.sendSmartNotification(userId, notification)
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to send spectator notifications:', error);
    }
  }

  /**
   * Schedule retry with exponential backoff
   */
  private scheduleRetry(
    userId: string,
    notification: any,
    channels: NotificationChannel[],
    deliveryAttempt: NotificationDeliveryAttempt
  ): void {
    const retryDelay =
      this.retryIntervals[
        Math.min(deliveryAttempt.attempts - 1, this.retryIntervals.length - 1)
      ];
    deliveryAttempt.nextAttempt = Date.now() + retryDelay;

    setTimeout(() => {
      this.attemptDelivery(userId, notification, channels, deliveryAttempt);
    }, retryDelay);
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(
    quietHours?: NotificationPreference['quietHours']
  ): boolean {
    if (!quietHours) return false;

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: quietHours.timezone,
    });

    return currentTime >= quietHours.start || currentTime <= quietHours.end;
  }

  /**
   * Queue notification for delivery after quiet hours
   */
  private async queueForLaterDelivery(
    userId: string,
    notification: any,
    quietHours: NotificationPreference['quietHours']
  ): Promise<void> {
    const endTime = new Date();
    const [hours, minutes] = quietHours.end.split(':').map(Number);
    endTime.setHours(hours, minutes, 0, 0);

    // If end time is earlier in the day than now, it means it's the next day
    if (endTime < new Date()) {
      endTime.setDate(endTime.getDate() + 1);
    }

    setTimeout(() => {
      this.sendSmartNotification(userId, notification);
    }, endTime.getTime() - Date.now());
  }

  /**
   * Start the delivery processor for handling queued notifications
   */
  private startDeliveryProcessor(): void {
    setInterval(() => {
      const now = Date.now();

      for (const [id, attempt] of this.notificationQueue.entries()) {
        if (
          attempt.status === 'pending' &&
          attempt.nextAttempt &&
          attempt.nextAttempt <= now
        ) {
          // Retry delivery
          console.log(`Retrying delivery for ${attempt.notificationId}`);
          // Implementation would retry the specific delivery
        }

        // Clean up old completed attempts
        if (attempt.status === 'delivered' || attempt.status === 'failed') {
          if (now - attempt.lastAttempt > 60000) {
            // 1 minute
            this.notificationQueue.delete(id);
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // Public API methods

  /**
   * Get user's in-app notifications
   */
  async getInAppNotifications(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<InAppNotification[]> {
    const cached = this.inAppNotifications.get(userId) || [];
    if (cached.length > offset) {
      return cached.slice(offset, offset + limit);
    }

    // Load from offline storage
    try {
      const stored = await offlineDataService.queryOffline({
        collection: 'in_app_notifications',
        where: [['userId', '==', userId]],
        orderBy: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      return stored.map(item => item.data as InAppNotification);
    } catch (error) {
      console.error('Failed to load in-app notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(
    userId: string,
    notificationId: string
  ): Promise<void> {
    try {
      await offlineDataService.updateOffline(
        'in_app_notifications',
        notificationId,
        { read: true },
        userId
      );

      // Update cache
      const cached = this.inAppNotifications.get(userId);
      if (cached) {
        const notification = cached.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
        }
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const cached = this.inAppNotifications.get(userId) || [];
    const unreadCached = cached.filter(n => !n.read).length;

    if (cached.length > 0) {
      return unreadCached;
    }

    try {
      const stored = await offlineDataService.queryOffline({
        collection: 'in_app_notifications',
        where: [
          ['userId', '==', userId],
          ['read', '==', false],
        ],
      });

      return stored.length;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: NotificationPreference[]
  ): Promise<void> {
    try {
      for (const preference of preferences) {
        await offlineDataService.createOffline(
          'notification_preferences',
          { ...preference, userId },
          userId
        );
      }
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  }

  // Private helper methods

  private async getUserNotificationPreferences(
    userId: string
  ): Promise<NotificationPreference[]> {
    try {
      const stored = await offlineDataService.queryOffline({
        collection: 'notification_preferences',
        where: [['userId', '==', userId]],
      });

      if (stored.length > 0) {
        return stored.map(item => item.data as NotificationPreference);
      }

      // Return default preferences
      return [
        {
          userId,
          type: 'all',
          enabled: true,
          priority: 'normal',
          channels: [
            { type: 'push', enabled: true, fallbackOrder: 1 },
            { type: 'in_app', enabled: true, fallbackOrder: 2 },
            { type: 'sms', enabled: false, fallbackOrder: 3 },
          ],
        },
      ];
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return [];
    }
  }

  private async getUserPushTokens(userId: string): Promise<string[]> {
    try {
      // This would get from user's device registrations
      const devices =
        await multiDeviceService.getActiveDevices('current-tournament');
      const userDevices = devices.filter(d => d.userId === userId);
      return userDevices.map(d => d.deviceId); // In real implementation, these would be FCM tokens
    } catch (error) {
      console.error('Failed to get user push tokens:', error);
      return [];
    }
  }

  private async getUserPhoneNumber(userId: string): Promise<string | null> {
    try {
      const user = await offlineDataService.readOffline('users', userId);
      return user?.phoneNumber || null;
    } catch (error) {
      console.error('Failed to get user phone number:', error);
      return null;
    }
  }

  private async getTournamentSpectators(
    tournamentId: string
  ): Promise<string[]> {
    try {
      // Get all devices connected to this tournament with spectator role
      const devices = await multiDeviceService.getActiveDevices(tournamentId);
      return devices
        .filter(d => d.role === 'spectator' || d.role === 'organizer')
        .map(d => d.userId);
    } catch (error) {
      console.error('Failed to get tournament spectators:', error);
      return [];
    }
  }

  private async handleTournamentUpdate(
    update: TournamentUpdate
  ): Promise<void> {
    // General handler for tournament updates
    console.log('Tournament update received:', update.type, update.id);
  }

  // SMS provider implementations (mocked for now)
  private async sendTwilioSMS(
    phoneNumber: string,
    message: string
  ): Promise<boolean> {
    console.log(`[SMS-Twilio] Sending to ${phoneNumber}: ${message}`);
    return true; // Mock success
  }

  private async sendAWSSMS(
    phoneNumber: string,
    message: string
  ): Promise<boolean> {
    console.log(`[SMS-AWS] Sending to ${phoneNumber}: ${message}`);
    return true; // Mock success
  }

  private async sendFirebaseSMS(
    phoneNumber: string,
    message: string
  ): Promise<boolean> {
    console.log(`[SMS-Firebase] Sending to ${phoneNumber}: ${message}`);
    return true; // Mock success
  }

  // Cleanup
  public cleanup(): void {
    this.notificationQueue.clear();
    this.inAppNotifications.clear();
  }
}

export const realTimeNotificationService = new RealTimeNotificationService(
  // Push configuration would be loaded from environment
  {
    provider: 'firebase',
    environment: 'development',
    enableAnalytics: true,
  },
  // SMS configuration would be loaded from environment
  {
    provider: 'twilio',
    enabled: true,
  }
);

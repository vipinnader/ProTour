// Notification service for ProTour - Epic 3 Implementation

import { DatabaseService } from './DatabaseService';
import {
  NotificationPreference,
  Match,
  Tournament,
  TournamentRegistration,
} from '../types';
import firestore from '@react-native-firebase/firestore';

export interface NotificationConfig {
  type:
    | 'match-ready'
    | 'match-completed'
    | 'bracket-updated'
    | 'tournament-update';
  title: string;
  body: string;
  data?: Record<string, string>;
  recipients: string[]; // User IDs
  scheduledFor?: Date;
}

export interface ScheduledNotification {
  id: string;
  config: NotificationConfig;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  createdAt: firestore.Timestamp;
  sentAt?: firestore.Timestamp;
  error?: string;
}

export class NotificationService extends DatabaseService {
  private readonly PREFERENCES_COLLECTION = 'notification_preferences';
  private readonly SCHEDULED_COLLECTION = 'scheduled_notifications';
  private readonly DELIVERY_LOG_COLLECTION = 'notification_delivery_log';

  // Notification Preferences Management
  async getUserNotificationPreferences(
    userId: string
  ): Promise<NotificationPreference[]> {
    return this.query<NotificationPreference>(this.PREFERENCES_COLLECTION, [
      { fieldPath: 'userId', opStr: '==', value: userId },
    ]);
  }

  async setNotificationPreference(
    preference: Omit<NotificationPreference, 'id'>
  ): Promise<NotificationPreference> {
    // Check if preference already exists
    const existing = await this.query<NotificationPreference>(
      this.PREFERENCES_COLLECTION,
      [
        { fieldPath: 'userId', opStr: '==', value: preference.userId },
        { fieldPath: 'type', opStr: '==', value: preference.type },
        {
          fieldPath: 'tournamentId',
          opStr: '==',
          value: preference.tournamentId || null,
        },
      ]
    );

    if (existing.length > 0) {
      // Update existing preference
      await this.update<NotificationPreference>(
        this.PREFERENCES_COLLECTION,
        existing[0].id,
        preference
      );
      return { ...existing[0], ...preference };
    } else {
      // Create new preference
      return this.create<NotificationPreference>(
        this.PREFERENCES_COLLECTION,
        preference
      );
    }
  }

  async isNotificationEnabled(
    userId: string,
    type: NotificationPreference['type'],
    tournamentId?: string
  ): Promise<boolean> {
    const preferences = await this.query<NotificationPreference>(
      this.PREFERENCES_COLLECTION,
      [
        { fieldPath: 'userId', opStr: '==', value: userId },
        { fieldPath: 'type', opStr: '==', value: type },
        { fieldPath: 'tournamentId', opStr: '==', value: tournamentId || null },
      ]
    );

    if (preferences.length === 0) {
      // Default to enabled for most notification types
      return ['match-ready', 'match-completed', 'tournament-update'].includes(
        type
      );
    }

    return preferences[0].enabled;
  }

  // Tournament-Specific Notifications
  async notifyMatchReady(
    match: Match,
    tournament: Tournament,
    minutesBefore: number = 30
  ): Promise<void> {
    const recipients = [match.player1Id, match.player2Id].filter(Boolean);

    // Filter recipients based on their notification preferences
    const enabledRecipients = await this.filterRecipientsByPreference(
      recipients,
      'match-ready',
      tournament.id
    );

    if (enabledRecipients.length === 0) return;

    // Get player names for notification
    const player1Name = await this.getPlayerName(match.player1Id);
    const player2Name = match.player2Id
      ? await this.getPlayerName(match.player2Id)
      : null;

    const vsText = player2Name ? `vs ${player2Name}` : '(bye)';
    const timeText = minutesBefore > 0 ? `in ${minutesBefore} minutes` : 'now';

    const config: NotificationConfig = {
      type: 'match-ready',
      title: '🎾 Match Starting Soon',
      body: `Your ${tournament.name} match ${vsText} starts ${timeText}!`,
      data: {
        type: 'match-ready',
        matchId: match.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        round: match.round.toString(),
        court: match.court || 'TBD',
      },
      recipients: enabledRecipients,
    };

    await this.scheduleNotification(config);
  }

  async notifyMatchCompleted(
    match: Match,
    tournament: Tournament,
    winnerId: string
  ): Promise<void> {
    // Notify players in the match
    const matchParticipants = [match.player1Id, match.player2Id].filter(
      Boolean
    );

    // Notify tournament followers/spectators
    const tournamentFollowers = await this.getTournamentFollowers(
      tournament.id
    );

    const allRecipients = [...matchParticipants, ...tournamentFollowers];
    const uniqueRecipients = [...new Set(allRecipients)];

    // Filter by preferences
    const enabledRecipients = await this.filterRecipientsByPreference(
      uniqueRecipients,
      'match-completed',
      tournament.id
    );

    if (enabledRecipients.length === 0) return;

    const winnerName = await this.getPlayerName(winnerId);
    const isPlayer1Winner = winnerId === match.player1Id;
    const loserName = await this.getPlayerName(
      isPlayer1Winner ? match.player2Id! : match.player1Id
    );

    const config: NotificationConfig = {
      type: 'match-completed',
      title: '🏆 Match Completed',
      body: `${winnerName} defeated ${loserName} in ${tournament.name}`,
      data: {
        type: 'match-completed',
        matchId: match.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        winnerId,
        winnerName,
        round: match.round.toString(),
      },
      recipients: enabledRecipients,
    };

    await this.scheduleNotification(config);
  }

  async notifyBracketUpdated(tournament: Tournament): Promise<void> {
    const followers = await this.getTournamentFollowers(tournament.id);

    const enabledRecipients = await this.filterRecipientsByPreference(
      followers,
      'bracket-updated',
      tournament.id
    );

    if (enabledRecipients.length === 0) return;

    const config: NotificationConfig = {
      type: 'bracket-updated',
      title: '📊 Bracket Updated',
      body: `${tournament.name} bracket has been updated with new results`,
      data: {
        type: 'bracket-updated',
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        sport: tournament.sport,
      },
      recipients: enabledRecipients,
    };

    await this.scheduleNotification(config);
  }

  async notifyTournamentUpdate(
    tournament: Tournament,
    updateType: 'started' | 'completed' | 'cancelled',
    customMessage?: string
  ): Promise<void> {
    const participants = await this.getTournamentParticipants(tournament.id);

    const enabledRecipients = await this.filterRecipientsByPreference(
      participants,
      'tournament-update',
      tournament.id
    );

    if (enabledRecipients.length === 0) return;

    let title: string;
    let body: string;

    switch (updateType) {
      case 'started':
        title = '🚀 Tournament Started';
        body = customMessage || `${tournament.name} has officially started!`;
        break;
      case 'completed':
        title = '🎉 Tournament Completed';
        body =
          customMessage ||
          `${tournament.name} has been completed. Check out the final results!`;
        break;
      case 'cancelled':
        title = '⚠️ Tournament Cancelled';
        body =
          customMessage ||
          `${tournament.name} has been cancelled. Please check for updates.`;
        break;
    }

    const config: NotificationConfig = {
      type: 'tournament-update',
      title,
      body,
      data: {
        type: 'tournament-update',
        updateType,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        sport: tournament.sport,
      },
      recipients: enabledRecipients,
    };

    await this.scheduleNotification(config);
  }

  // Scheduling and Delivery
  private async scheduleNotification(
    config: NotificationConfig
  ): Promise<ScheduledNotification> {
    const notificationData: Omit<ScheduledNotification, 'id'> = {
      config,
      status: 'pending',
      createdAt: firestore.Timestamp.now(),
    };

    const scheduled = await this.create<ScheduledNotification>(
      this.SCHEDULED_COLLECTION,
      notificationData
    );

    // For immediate notifications, trigger delivery
    if (!config.scheduledFor || config.scheduledFor <= new Date()) {
      await this.deliverNotification(scheduled.id);
    }

    return scheduled;
  }

  async deliverNotification(notificationId: string): Promise<void> {
    try {
      const notification = await this.read<ScheduledNotification>(
        this.SCHEDULED_COLLECTION,
        notificationId
      );

      if (!notification || notification.status !== 'pending') {
        return;
      }

      // Update status to sending
      await this.update<ScheduledNotification>(
        this.SCHEDULED_COLLECTION,
        notificationId,
        { status: 'sent', sentAt: firestore.Timestamp.now() }
      );

      // Log delivery for each recipient
      for (const recipientId of notification.config.recipients) {
        await this.logNotificationDelivery(
          notificationId,
          recipientId,
          'delivered'
        );
      }
    } catch (error: any) {
      // Update status to failed
      await this.update<ScheduledNotification>(
        this.SCHEDULED_COLLECTION,
        notificationId,
        {
          status: 'failed',
          error: error.message,
        }
      );

      console.error('Failed to deliver notification:', error);
    }
  }

  private async logNotificationDelivery(
    notificationId: string,
    recipientId: string,
    status: 'delivered' | 'failed' | 'opened'
  ): Promise<void> {
    const logData = {
      notificationId,
      recipientId,
      status,
      timestamp: firestore.Timestamp.now(),
    };

    await this.create<any>(this.DELIVERY_LOG_COLLECTION, logData);
  }

  // Helper Methods
  private async filterRecipientsByPreference(
    recipients: string[],
    type: NotificationPreference['type'],
    tournamentId?: string
  ): Promise<string[]> {
    const enabled: string[] = [];

    for (const userId of recipients) {
      const isEnabled = await this.isNotificationEnabled(
        userId,
        type,
        tournamentId
      );
      if (isEnabled) {
        enabled.push(userId);
      }
    }

    return enabled;
  }

  private async getTournamentFollowers(
    tournamentId: string
  ): Promise<string[]> {
    // Get users who are following this tournament (registered as players or spectators)
    const registrations = await this.query<TournamentRegistration>(
      'tournament_registrations',
      [
        { fieldPath: 'tournamentId', opStr: '==', value: tournamentId },
        { fieldPath: 'status', opStr: '==', value: 'active' },
      ]
    );

    return registrations.map(reg => reg.userId);
  }

  private async getTournamentParticipants(
    tournamentId: string
  ): Promise<string[]> {
    // Get users who are registered as players in this tournament
    const registrations = await this.query<TournamentRegistration>(
      'tournament_registrations',
      [
        { fieldPath: 'tournamentId', opStr: '==', value: tournamentId },
        { fieldPath: 'role', opStr: '==', value: 'player' },
        { fieldPath: 'status', opStr: '==', value: 'active' },
      ]
    );

    return registrations.map(reg => reg.userId);
  }

  private async getPlayerName(playerId: string): Promise<string> {
    try {
      const player = await this.read<any>('players', playerId);
      return player?.name || 'Unknown Player';
    } catch {
      return 'Unknown Player';
    }
  }

  // Batch Operations
  async scheduleMatchReminders(
    matches: Match[],
    tournament: Tournament,
    reminderTimes: number[] = [30, 10] // minutes before match
  ): Promise<void> {
    for (const match of matches) {
      if (!match.startTime || match.status !== 'pending') continue;

      for (const minutes of reminderTimes) {
        const notificationTime = new Date(
          match.startTime.toDate().getTime() - minutes * 60 * 1000
        );

        // Only schedule if the notification time is in the future
        if (notificationTime > new Date()) {
          const config: NotificationConfig = {
            type: 'match-ready',
            title: '🎾 Match Starting Soon',
            body: `Your ${tournament.name} match starts in ${minutes} minutes!`,
            data: {
              type: 'match-ready',
              matchId: match.id,
              tournamentId: tournament.id,
              tournamentName: tournament.name,
              minutesBefore: minutes.toString(),
              round: match.round.toString(),
              court: match.court || 'TBD',
            },
            recipients: [match.player1Id, match.player2Id].filter(Boolean),
            scheduledFor: notificationTime,
          };

          await this.scheduleNotification(config);
        }
      }
    }
  }

  // Analytics and Reporting
  async getNotificationStats(
    startDate: Date,
    endDate: Date,
    tournamentId?: string
  ): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    byType: Record<string, number>;
  }> {
    // This would typically involve complex queries
    // For now, return mock data
    return {
      totalSent: 150,
      totalDelivered: 145,
      totalOpened: 89,
      byType: {
        'match-ready': 80,
        'match-completed': 35,
        'bracket-updated': 20,
        'tournament-update': 15,
      },
    };
  }
}

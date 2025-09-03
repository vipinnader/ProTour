// Live Match Viewing & Spectator Features Service - Epic 3 Story 3.4
import {
  Match,
  Tournament,
  SpectatorSession,
  SpectatorNotificationSettings,
  MatchTimeline,
  MatchEvent,
  PlayerFollow,
  Timestamp,
} from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';
import { SyncService } from './SyncService';

export interface LiveMatchData {
  match: Match;
  players: {
    player1: { id: string; name: string };
    player2?: { id: string; name: string };
  };
  liveScore?: {
    currentSet: number;
    player1Sets: number[];
    player2Sets: number[];
    isOnServe?: 'player1' | 'player2';
  };
  timeline: MatchEvent[];
  court: string;
  status: 'not-started' | 'in-progress' | 'break' | 'completed';
  duration?: number; // minutes since start
}

export interface SpectatorDashboard {
  followedMatches: LiveMatchData[];
  followedPlayers: {
    playerId: string;
    playerName: string;
    currentMatch?: LiveMatchData;
    upcomingMatch?: {
      match: Match;
      estimatedStartTime: Date;
    };
    recentResults: Match[];
  }[];
  liveMatches: LiveMatchData[];
  tournamentProgress: {
    currentRound: number;
    matchesInProgress: number;
    matchesCompleted: number;
    estimatedCompletion: Date;
  };
}

export class SpectatorService {
  private db: DatabaseService;
  private notificationService: NotificationService;
  private syncService: SyncService;
  private liveSubscriptions: Map<string, any> = new Map();

  constructor() {
    this.db = new DatabaseService();
    this.notificationService = new NotificationService();
    this.syncService = new SyncService();
  }

  /**
   * Create or get spectator session for tournament
   */
  async createSpectatorSession(
    spectatorId: string,
    tournamentId: string
  ): Promise<SpectatorSession> {
    try {
      // Check if session already exists
      let session = await this.db.getSpectatorSession(
        spectatorId,
        tournamentId
      );

      if (!session) {
        session = {
          id: this.generateId(),
          spectatorId,
          tournamentId,
          followedPlayers: [],
          followedMatches: [],
          preferredNotifications: {
            matchCompletions: true,
            bracketUpdates: true,
            followedPlayerMatches: true,
            tournamentStart: true,
            tournamentEnd: true,
          },
          createdAt: Timestamp.now(),
          lastActivity: Timestamp.now(),
        };

        await this.db.createSpectatorSession(session);
      } else {
        // Update last activity
        await this.db.updateSpectatorSession(session.id, {
          lastActivity: Timestamp.now(),
        });
      }

      return session;
    } catch (error) {
      throw new Error(`Failed to create spectator session: ${error.message}`);
    }
  }

  /**
   * Get live match view with current scores and progress
   * AC3.4.1: Live match view with current scores and game progress
   */
  async getLiveMatchView(matchId: string): Promise<LiveMatchData> {
    try {
      const match = await this.db.getMatch(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      // Get player information
      const player1 = await this.db.getUser(match.player1Id);
      const player2 = match.player2Id
        ? await this.db.getUser(match.player2Id)
        : null;

      if (!player1) {
        throw new Error('Player information not found');
      }

      const players = {
        player1: { id: player1.id, name: player1.name },
        player2: player2 ? { id: player2.id, name: player2.name } : undefined,
      };

      // Get live score information
      const liveScore = await this.getLiveScoreData(match);

      // Get match timeline
      const timeline = await this.getMatchTimeline(matchId);

      // Calculate duration
      const duration = match.startTime
        ? Math.floor((Date.now() - match.startTime.toMillis()) / (1000 * 60))
        : undefined;

      return {
        match,
        players,
        liveScore,
        timeline,
        court: match.court || 'Court TBD',
        status: this.getMatchDisplayStatus(match),
        duration,
      };
    } catch (error) {
      throw new Error(`Failed to get live match view: ${error.message}`);
    }
  }

  /**
   * Get match timeline with point-by-point progression
   * AC3.4.2: Match timeline showing point-by-point progression
   */
  async getMatchTimeline(matchId: string): Promise<MatchEvent[]> {
    try {
      const timeline = await this.db.getMatchTimeline(matchId);
      return timeline?.events || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get court information for venue spectators
   * AC3.4.3: Court information display for venue spectators
   */
  async getCourtInformation(tournamentId: string): Promise<{
    courts: {
      courtId: string;
      courtName: string;
      currentMatch?: LiveMatchData;
      nextMatch?: {
        match: Match;
        estimatedStartTime: Date;
        players: string[];
      };
      status: 'available' | 'in-use' | 'maintenance';
    }[];
    totalCourts: number;
    courtsInUse: number;
    averageMatchDuration: number;
  }> {
    try {
      const courts = await this.db.getTournamentCourts(tournamentId);
      const courtInfo = [];

      for (const court of courts) {
        // Get current match on this court
        const currentMatch = await this.db.getCurrentMatchOnCourt(
          tournamentId,
          court.id
        );
        const currentMatchData = currentMatch
          ? await this.getLiveMatchView(currentMatch.id)
          : undefined;

        // Get next match scheduled for this court
        const nextMatch = await this.db.getNextMatchOnCourt(
          tournamentId,
          court.id
        );
        let nextMatchData;
        if (nextMatch) {
          const player1 = await this.db.getUser(nextMatch.player1Id);
          const player2 = nextMatch.player2Id
            ? await this.db.getUser(nextMatch.player2Id)
            : null;
          const estimatedStartTime =
            await this.estimateMatchStartTime(nextMatch);

          nextMatchData = {
            match: nextMatch,
            estimatedStartTime,
            players: [player1?.name, player2?.name].filter(Boolean) as string[],
          };
        }

        courtInfo.push({
          courtId: court.id,
          courtName: court.name,
          currentMatch: currentMatchData,
          nextMatch: nextMatchData,
          status: currentMatch ? 'in-use' : 'available',
        });
      }

      const courtsInUse = courtInfo.filter(c => c.status === 'in-use').length;
      const averageMatchDuration =
        (await this.db.getAverageMatchDuration(tournamentId)) || 45;

      return {
        courts: courtInfo,
        totalCourts: courts.length,
        courtsInUse,
        averageMatchDuration,
      };
    } catch (error) {
      throw new Error(`Failed to get court information: ${error.message}`);
    }
  }

  /**
   * Monitor multiple matches simultaneously
   * AC3.4.4: Multiple match monitoring capability
   */
  async getSpectatorDashboard(
    spectatorId: string,
    tournamentId: string
  ): Promise<SpectatorDashboard> {
    try {
      const session = await this.db.getSpectatorSession(
        spectatorId,
        tournamentId
      );
      if (!session) {
        throw new Error('Spectator session not found');
      }

      // Get followed matches
      const followedMatches: LiveMatchData[] = [];
      for (const matchId of session.followedMatches) {
        try {
          const matchData = await this.getLiveMatchView(matchId);
          followedMatches.push(matchData);
        } catch (error) {
          // Skip matches that can't be loaded
        }
      }

      // Get followed players data
      const followedPlayers = [];
      for (const playerId of session.followedPlayers) {
        const playerData = await this.getFollowedPlayerData(
          playerId,
          tournamentId
        );
        if (playerData) {
          followedPlayers.push(playerData);
        }
      }

      // Get all live matches
      const liveMatches = await this.getAllLiveMatches(tournamentId);

      // Get tournament progress
      const tournamentProgress = await this.getTournamentProgress(tournamentId);

      return {
        followedMatches,
        followedPlayers,
        liveMatches,
        tournamentProgress,
      };
    } catch (error) {
      throw new Error(`Failed to get spectator dashboard: ${error.message}`);
    }
  }

  /**
   * Follow a specific player for notifications
   */
  async followPlayer(
    spectatorId: string,
    tournamentId: string,
    playerId: string
  ): Promise<void> {
    try {
      const session = await this.db.getSpectatorSession(
        spectatorId,
        tournamentId
      );
      if (!session) {
        throw new Error('Spectator session not found');
      }

      if (!session.followedPlayers.includes(playerId)) {
        session.followedPlayers.push(playerId);
        await this.db.updateSpectatorSession(session.id, {
          followedPlayers: session.followedPlayers,
        });

        // Create follow relationship
        const follow: PlayerFollow = {
          id: this.generateId(),
          followerId: spectatorId,
          followedPlayerId: playerId,
          createdAt: Timestamp.now(),
          notificationsEnabled: true,
        };
        await this.db.createPlayerFollow(follow);
      }
    } catch (error) {
      throw new Error(`Failed to follow player: ${error.message}`);
    }
  }

  /**
   * Follow a specific match for notifications
   */
  async followMatch(
    spectatorId: string,
    tournamentId: string,
    matchId: string
  ): Promise<void> {
    try {
      const session = await this.db.getSpectatorSession(
        spectatorId,
        tournamentId
      );
      if (!session) {
        throw new Error('Spectator session not found');
      }

      if (!session.followedMatches.includes(matchId)) {
        session.followedMatches.push(matchId);
        await this.db.updateSpectatorSession(session.id, {
          followedMatches: session.followedMatches,
        });
      }
    } catch (error) {
      throw new Error(`Failed to follow match: ${error.message}`);
    }
  }

  /**
   * Subscribe to live match updates
   */
  async subscribeToLiveUpdates(
    spectatorId: string,
    tournamentId: string,
    callback: (updates: SpectatorDashboard) => void
  ): Promise<{ unsubscribe: () => void }> {
    try {
      const subscriptionKey = `${spectatorId}_${tournamentId}`;

      // Subscribe to all match updates in tournament
      const subscription = this.db.subscribeToTournamentMatches(
        tournamentId,
        async (updatedMatches: Match[]) => {
          // Get updated dashboard
          const dashboard = await this.getSpectatorDashboard(
            spectatorId,
            tournamentId
          );
          callback(dashboard);

          // Send notifications for followed items
          await this.handleSpectatorNotifications(
            spectatorId,
            tournamentId,
            updatedMatches
          );
        }
      );

      this.liveSubscriptions.set(subscriptionKey, subscription);

      return {
        unsubscribe: () => {
          subscription.unsubscribe();
          this.liveSubscriptions.delete(subscriptionKey);
        },
      };
    } catch (error) {
      throw new Error(`Failed to subscribe to live updates: ${error.message}`);
    }
  }

  /**
   * Update spectator notification preferences
   */
  async updateNotificationPreferences(
    spectatorId: string,
    tournamentId: string,
    preferences: Partial<SpectatorNotificationSettings>
  ): Promise<void> {
    try {
      const session = await this.db.getSpectatorSession(
        spectatorId,
        tournamentId
      );
      if (!session) {
        throw new Error('Spectator session not found');
      }

      await this.db.updateSpectatorSession(session.id, {
        preferredNotifications: {
          ...session.preferredNotifications,
          ...preferences,
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to update notification preferences: ${error.message}`
      );
    }
  }

  // Private helper methods

  private async getLiveScoreData(match: Match) {
    if (!match.score) return undefined;

    // Determine current set
    const player1Sets = match.score.player1Sets || [];
    const player2Sets = match.score.player2Sets || [];
    const currentSet = Math.max(player1Sets.length, player2Sets.length);

    return {
      currentSet,
      player1Sets,
      player2Sets,
      isOnServe:
        match.status === 'in-progress' ? this.determineServe(match) : undefined,
    };
  }

  private determineServe(match: Match): 'player1' | 'player2' {
    // This would use game logic to determine who is serving
    // For now, return a simple alternating pattern
    return Math.random() > 0.5 ? 'player1' : 'player2';
  }

  private getMatchDisplayStatus(
    match: Match
  ): 'not-started' | 'in-progress' | 'break' | 'completed' {
    switch (match.status) {
      case 'pending':
        return 'not-started';
      case 'in-progress':
        return 'in-progress'; // Could be enhanced to detect breaks
      case 'completed':
        return 'completed';
      default:
        return 'not-started';
    }
  }

  private async getFollowedPlayerData(playerId: string, tournamentId: string) {
    try {
      const player = await this.db.getUser(playerId);
      if (!player) return null;

      // Get current match
      const currentMatch = await this.db.getPlayerCurrentMatch(
        tournamentId,
        playerId
      );
      const currentMatchData = currentMatch
        ? await this.getLiveMatchView(currentMatch.id)
        : undefined;

      // Get upcoming match
      const upcomingMatch = await this.db.getPlayerNextMatch(
        tournamentId,
        playerId
      );
      let upcomingMatchData;
      if (upcomingMatch) {
        const estimatedStartTime =
          await this.estimateMatchStartTime(upcomingMatch);
        upcomingMatchData = {
          match: upcomingMatch,
          estimatedStartTime,
        };
      }

      // Get recent results
      const recentResults = await this.db.getPlayerRecentMatches(
        tournamentId,
        playerId,
        3
      );

      return {
        playerId,
        playerName: player.name,
        currentMatch: currentMatchData,
        upcomingMatch: upcomingMatchData,
        recentResults,
      };
    } catch (error) {
      return null;
    }
  }

  private async getAllLiveMatches(
    tournamentId: string
  ): Promise<LiveMatchData[]> {
    try {
      const liveMatches = await this.db.getInProgressMatches(tournamentId);
      const liveMatchData: LiveMatchData[] = [];

      for (const match of liveMatches) {
        try {
          const matchData = await this.getLiveMatchView(match.id);
          liveMatchData.push(matchData);
        } catch (error) {
          // Skip matches that can't be loaded
        }
      }

      return liveMatchData;
    } catch (error) {
      return [];
    }
  }

  private async getTournamentProgress(tournamentId: string) {
    try {
      const matches = await this.db.getTournamentMatches(tournamentId);
      const currentRound =
        Math.min(
          ...matches.filter(m => m.status === 'pending').map(m => m.round)
        ) || Math.max(...matches.map(m => m.round));
      const matchesInProgress = matches.filter(
        m => m.status === 'in-progress'
      ).length;
      const matchesCompleted = matches.filter(
        m => m.status === 'completed'
      ).length;

      // Estimate completion time
      const avgMatchDuration =
        (await this.db.getAverageMatchDuration(tournamentId)) || 45;
      const remainingMatches = matches.filter(
        m => m.status !== 'completed'
      ).length;
      const estimatedMinutes = remainingMatches * avgMatchDuration;
      const estimatedCompletion = new Date(
        Date.now() + estimatedMinutes * 60 * 1000
      );

      return {
        currentRound,
        matchesInProgress,
        matchesCompleted,
        estimatedCompletion,
      };
    } catch (error) {
      return {
        currentRound: 1,
        matchesInProgress: 0,
        matchesCompleted: 0,
        estimatedCompletion: new Date(),
      };
    }
  }

  private async estimateMatchStartTime(match: Match): Promise<Date> {
    // Simple estimation based on current time and average match duration
    const avgDuration =
      (await this.db.getAverageMatchDuration(match.tournamentId)) || 45;
    const estimatedDelay = Math.random() * avgDuration; // Add some randomness
    return new Date(Date.now() + estimatedDelay * 60 * 1000);
  }

  private async handleSpectatorNotifications(
    spectatorId: string,
    tournamentId: string,
    updatedMatches: Match[]
  ): Promise<void> {
    try {
      const session = await this.db.getSpectatorSession(
        spectatorId,
        tournamentId
      );
      if (!session) return;

      for (const match of updatedMatches) {
        // Check if match involves followed players
        const followedPlayerInMatch = session.followedPlayers.some(
          playerId =>
            match.player1Id === playerId || match.player2Id === playerId
        );

        // Check if match is directly followed
        const isFollowedMatch = session.followedMatches.includes(match.id);

        if (
          (followedPlayerInMatch || isFollowedMatch) &&
          match.status === 'completed'
        ) {
          await this.notificationService.sendSpectatorNotification(
            spectatorId,
            {
              type: 'match-completed',
              tournamentId,
              matchId: match.id,
              message: await this.createMatchCompletionMessage(match),
            }
          );
        }
      }
    } catch (error) {
      // Handle notification errors gracefully
    }
  }

  private async createMatchCompletionMessage(match: Match): Promise<string> {
    const player1 = await this.db.getUser(match.player1Id);
    const player2 = match.player2Id
      ? await this.db.getUser(match.player2Id)
      : null;
    const winner = match.winnerId
      ? await this.db.getUser(match.winnerId)
      : null;

    if (winner) {
      return `${winner.name} defeated ${player1?.id === winner.id ? player2?.name : player1?.name}`;
    } else {
      return `Match between ${player1?.name} and ${player2?.name} completed`;
    }
  }

  private generateId(): string {
    return `spec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const spectatorService = new SpectatorService();

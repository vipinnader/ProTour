// Personalized Player Schedule & Match Management Service - Epic 3 Story 3.2
import {
  PlayerSchedule,
  Match,
  BracketPosition,
  NotificationPreference,
  Timestamp,
} from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';

export class PlayerScheduleService {
  private db: DatabaseService;
  private notificationService: NotificationService;

  constructor() {
    this.db = new DatabaseService();
    this.notificationService = new NotificationService();
  }

  /**
   * Get personalized schedule for a player in a tournament
   * AC3.2.1: Personalized match schedule with opponent names and estimated times
   */
  async getPlayerSchedule(
    playerId: string,
    tournamentId: string
  ): Promise<PlayerSchedule> {
    try {
      const matches = await this.db.getPlayerMatches(tournamentId, playerId);

      // Categorize matches
      const currentMatch = matches.find(m => m.status === 'in-progress');
      const upcomingMatches = matches
        .filter(m => m.status === 'pending')
        .sort((a, b) => a.round - b.round);
      const completedMatches = matches
        .filter(m => m.status === 'completed')
        .sort((a, b) => b.round - a.round);

      // Get tournament progress
      const tournamentProgress = await this.calculateTournamentProgress(
        tournamentId,
        playerId
      );

      // Estimate next match time
      const estimatedNextMatchTime = await this.estimateNextMatchTime(
        tournamentId,
        upcomingMatches[0]
      );

      // Get notification settings
      const nextMatchNotification = await this.getNextMatchNotificationStatus(
        playerId,
        tournamentId
      );

      return {
        playerId,
        tournamentId,
        currentMatch,
        upcomingMatches:
          await this.enrichMatchesWithOpponentInfo(upcomingMatches),
        completedMatches:
          await this.enrichMatchesWithOpponentInfo(completedMatches),
        tournamentProgress,
        estimatedNextMatchTime,
        nextMatchNotification,
      };
    } catch (error) {
      throw new Error(`Failed to get player schedule: ${error.message}`);
    }
  }

  /**
   * Subscribe to real-time match updates for a player
   * AC3.2.2: Match status indicators (upcoming, current, completed)
   * AC3.2.3: Real-time schedule updates reflecting bracket progression
   */
  async subscribeToMatchUpdates(
    playerId: string,
    tournamentId: string
  ): Promise<{
    subscription: any;
    unsubscribe: () => void;
  }> {
    try {
      // Subscribe to match updates for this player
      const subscription = this.db.subscribeToPlayerMatches(
        tournamentId,
        playerId,
        async (updatedMatches: Match[]) => {
          // Notify player of match status changes
          await this.handleMatchStatusUpdates(
            playerId,
            tournamentId,
            updatedMatches
          );
        }
      );

      return {
        subscription,
        unsubscribe: () => subscription.unsubscribe(),
      };
    } catch (error) {
      throw new Error(`Failed to subscribe to match updates: ${error.message}`);
    }
  }

  /**
   * Send match ready notifications
   * AC3.2.4: Match preparation time estimates and arrival notifications
   * AC3.2.6: Push notifications for match ready (30min, 10min, now)
   */
  async notifyMatchReady(
    matchId: string,
    minutesBeforeStart: number
  ): Promise<void> {
    try {
      const match = await this.db.getMatch(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      const players = await Promise.all([
        this.db.getUser(match.player1Id),
        match.player2Id ? this.db.getUser(match.player2Id) : null,
      ]);

      const tournament = await this.db.getTournament(match.tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Get opponent information for each player
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (!player) continue;

        const opponent = players[1 - i];
        const opponentName = opponent?.name || 'BYE';

        // Check notification preferences
        const preferences = await this.getPlayerNotificationPreferences(
          player.id,
          tournament.id
        );
        if (!this.shouldSendNotification(preferences, minutesBeforeStart)) {
          continue;
        }

        let message = '';
        switch (minutesBeforeStart) {
          case 30:
            message = `Your match against ${opponentName} starts in 30 minutes on ${match.court || 'Court TBD'}`;
            break;
          case 10:
            message = `Your match against ${opponentName} starts in 10 minutes on ${match.court || 'Court TBD'}`;
            break;
          case 0:
            message = `Your match against ${opponentName} is ready to start on ${match.court || 'Court TBD'}`;
            break;
        }

        await this.notificationService.sendMatchNotification(player.id, {
          title: `${tournament.name} - Match Ready`,
          message,
          matchId: match.id,
          urgency: minutesBeforeStart === 0 ? 'high' : 'normal',
        });
      }
    } catch (error) {
      throw new Error(`Failed to notify match ready: ${error.message}`);
    }
  }

  /**
   * Track tournament progress for a player through bracket
   * AC3.2.5: Tournament progress tracking through bracket
   */
  async getPlayerBracketProgress(
    playerId: string,
    tournamentId: string
  ): Promise<{
    currentRound: number;
    totalRounds: number;
    position: BracketPosition;
    nextOpponent?: string;
    pathToFinal: string[];
  }> {
    try {
      const bracket = await this.db.getTournamentBracket(tournamentId);
      const playerMatches = await this.db.getPlayerMatches(
        tournamentId,
        playerId
      );

      // Find current round
      const lastCompletedMatch = playerMatches
        .filter(m => m.status === 'completed')
        .sort((a, b) => b.round - a.round)[0];

      const currentRound = lastCompletedMatch
        ? lastCompletedMatch.round + 1
        : 1;
      const totalRounds = bracket.totalRounds;

      // Calculate position
      const position = await this.calculateTournamentProgress(
        tournamentId,
        playerId
      );

      // Find next opponent
      const nextMatch = playerMatches.find(m => m.status === 'pending');
      let nextOpponent: string | undefined;
      if (nextMatch) {
        const opponentId =
          nextMatch.player1Id === playerId
            ? nextMatch.player2Id
            : nextMatch.player1Id;
        if (opponentId) {
          const opponent = await this.db.getUser(opponentId);
          nextOpponent = opponent?.name;
        }
      }

      // Calculate path to final
      const pathToFinal = await this.calculatePathToFinal(
        tournamentId,
        playerId,
        currentRound
      );

      return {
        currentRound,
        totalRounds,
        position,
        nextOpponent,
        pathToFinal,
      };
    } catch (error) {
      throw new Error(`Failed to get bracket progress: ${error.message}`);
    }
  }

  /**
   * Update player notification preferences
   */
  async updateNotificationPreferences(
    playerId: string,
    tournamentId: string,
    preferences: Partial<NotificationPreference>
  ): Promise<void> {
    try {
      await this.db.updateNotificationPreferences(
        playerId,
        tournamentId,
        preferences
      );
    } catch (error) {
      throw new Error(
        `Failed to update notification preferences: ${error.message}`
      );
    }
  }

  // Private helper methods

  private async enrichMatchesWithOpponentInfo(
    matches: Match[]
  ): Promise<Match[]> {
    const enrichedMatches: Match[] = [];

    for (const match of matches) {
      const enrichedMatch = { ...match };

      // Add opponent names
      if (match.player1Id) {
        const player1 = await this.db.getUser(match.player1Id);
        (enrichedMatch as any).player1Name = player1?.name || 'Unknown';
      }

      if (match.player2Id) {
        const player2 = await this.db.getUser(match.player2Id);
        (enrichedMatch as any).player2Name = player2?.name || 'BYE';
      }

      enrichedMatches.push(enrichedMatch);
    }

    return enrichedMatches;
  }

  private async calculateTournamentProgress(
    tournamentId: string,
    playerId: string
  ): Promise<BracketPosition> {
    try {
      const matches = await this.db.getPlayerMatches(tournamentId, playerId);
      const completedMatches = matches.filter(m => m.status === 'completed');
      const latestRound = Math.max(...completedMatches.map(m => m.round), 0);

      // Check if player was eliminated
      const lastMatch = completedMatches
        .filter(m => m.round === latestRound)
        .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())[0];

      const eliminated = lastMatch && lastMatch.winnerId !== playerId;

      // Calculate position in bracket
      const bracket = await this.db.getTournamentBracket(tournamentId);
      const totalPlayers = bracket.playerCount;
      const position = await this.calculateBracketPosition(
        totalPlayers,
        latestRound,
        eliminated
      );

      return {
        currentRound: eliminated ? latestRound : latestRound + 1,
        position,
        eliminated: !!eliminated,
        advancedToRound: eliminated ? undefined : latestRound + 1,
        canAdvanceToRound: eliminated
          ? undefined
          : Math.min(latestRound + 2, bracket.totalRounds),
      };
    } catch (error) {
      return {
        currentRound: 1,
        position: 1,
        eliminated: false,
      };
    }
  }

  private async calculateBracketPosition(
    totalPlayers: number,
    currentRound: number,
    eliminated: boolean
  ): Promise<number> {
    if (eliminated) {
      // Position based on elimination round
      const playersEliminatedInRound = Math.pow(
        2,
        Math.log2(totalPlayers) - currentRound + 1
      );
      return totalPlayers - playersEliminatedInRound + 1;
    } else {
      // Still active - potential final position
      return Math.pow(2, Math.log2(totalPlayers) - currentRound);
    }
  }

  private async estimateNextMatchTime(
    tournamentId: string,
    nextMatch?: Match
  ): Promise<Date | undefined> {
    if (!nextMatch) return undefined;

    try {
      // Get tournament schedule info
      const tournament = await this.db.getTournament(tournamentId);
      const currentMatches = await this.db.getCurrentRoundMatches(tournamentId);
      const averageMatchDuration =
        (await this.db.getAverageMatchDuration(tournamentId)) || 45; // minutes

      // Calculate estimated start time based on current matches
      const matchesAhead = currentMatches.filter(
        m =>
          m.round < nextMatch.round ||
          (m.round === nextMatch.round && m.matchNumber < nextMatch.matchNumber)
      ).length;

      const estimatedDelay = matchesAhead * averageMatchDuration;
      const baseTime = tournament.date.toDate();

      return new Date(baseTime.getTime() + estimatedDelay * 60 * 1000);
    } catch (error) {
      return undefined;
    }
  }

  private async getNextMatchNotificationStatus(
    playerId: string,
    tournamentId: string
  ) {
    const preferences = await this.getPlayerNotificationPreferences(
      playerId,
      tournamentId
    );

    return {
      thirtyMinutes: preferences?.timing?.thirtyMinutes ?? true,
      tenMinutes: preferences?.timing?.tenMinutes ?? true,
      ready: preferences?.timing?.immediate ?? true,
    };
  }

  private async getPlayerNotificationPreferences(
    playerId: string,
    tournamentId: string
  ): Promise<NotificationPreference | null> {
    try {
      return await this.db.getNotificationPreferences(playerId, tournamentId);
    } catch (error) {
      return null;
    }
  }

  private shouldSendNotification(
    preferences: NotificationPreference | null,
    minutesBeforeStart: number
  ): boolean {
    if (!preferences) return true; // Default to send if no preferences set

    switch (minutesBeforeStart) {
      case 30:
        return preferences.timing?.thirtyMinutes ?? true;
      case 10:
        return preferences.timing?.tenMinutes ?? true;
      case 0:
        return preferences.timing?.immediate ?? true;
      default:
        return false;
    }
  }

  private async handleMatchStatusUpdates(
    playerId: string,
    tournamentId: string,
    updatedMatches: Match[]
  ): Promise<void> {
    // Send notifications for significant match status changes
    for (const match of updatedMatches) {
      if (match.status === 'completed' && match.winnerId) {
        const isWinner = match.winnerId === playerId;
        await this.notificationService.sendMatchResultNotification(playerId, {
          matchId: match.id,
          tournamentId,
          won: isWinner,
          nextRound: isWinner ? match.round + 1 : undefined,
        });
      }
    }
  }

  private async calculatePathToFinal(
    tournamentId: string,
    playerId: string,
    currentRound: number
  ): Promise<string[]> {
    try {
      const bracket = await this.db.getTournamentBracket(tournamentId);
      const pathToFinal: string[] = [];

      // Get potential opponents for each round from current to final
      for (let round = currentRound; round <= bracket.totalRounds; round++) {
        const potentialOpponents = await this.db.getPotentialOpponents(
          tournamentId,
          playerId,
          round
        );
        if (potentialOpponents.length > 0) {
          pathToFinal.push(potentialOpponents.map(p => p.name).join(' or '));
        }
      }

      return pathToFinal;
    } catch (error) {
      return [];
    }
  }
}

export const playerScheduleService = new PlayerScheduleService();

// Player Tournament Discovery & Registration Service - Epic 3 Story 3.1
import {
  Tournament,
  TournamentRegistration,
  Player,
  User,
  ApiResponse,
  TournamentSearchFilters,
  Timestamp,
} from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';

export class PlayerTournamentService {
  private db: DatabaseService;
  private notificationService: NotificationService;

  constructor() {
    this.db = new DatabaseService();
    this.notificationService = new NotificationService();
  }

  /**
   * Join tournament using organizer-provided access code
   * AC3.1.1: Tournament discovery via organizer-provided codes
   */
  async joinTournament(
    accessCode: string,
    userId: string
  ): Promise<TournamentRegistration> {
    try {
      // Find tournament by access code
      const tournament = await this.db.findTournamentByCode(accessCode);
      if (!tournament) {
        throw new Error('Invalid tournament access code');
      }

      // Check tournament status
      if (tournament.status === 'completed') {
        throw new Error('Tournament has already completed');
      }

      // Check if player is already registered
      const existingRegistration = await this.db.findRegistration(
        tournament.id,
        userId
      );
      if (existingRegistration) {
        throw new Error('Already registered for this tournament');
      }

      // Check tournament capacity
      if (tournament.currentPlayerCount >= tournament.maxPlayers) {
        throw new Error('Tournament is full');
      }

      // Create registration
      const registration: TournamentRegistration = {
        id: this.generateId(),
        tournamentId: tournament.id,
        playerId: userId,
        userId: userId,
        role: 'player',
        registeredAt: Timestamp.now(),
        status: 'active',
      };

      // Save registration
      await this.db.createRegistration(registration);

      // Update tournament player count
      await this.db.updateTournament(tournament.id, {
        currentPlayerCount: tournament.currentPlayerCount + 1,
      });

      // Send welcome notification
      await this.notificationService.sendTournamentWelcome(userId, tournament);

      return registration;
    } catch (error) {
      throw new Error(`Failed to join tournament: ${error.message}`);
    }
  }

  /**
   * Get tournaments that user is registered for
   * AC3.1.2: Player tournament dashboard showing registered tournaments
   */
  async getPlayerTournaments(playerId: string): Promise<Tournament[]> {
    try {
      // Get all active registrations for player
      const registrations = await this.db.getPlayerRegistrations(playerId);

      // Get tournament details for each registration
      const tournaments: Tournament[] = [];
      for (const registration of registrations) {
        if (registration.status === 'active') {
          const tournament = await this.db.getTournament(
            registration.tournamentId
          );
          if (tournament) {
            tournaments.push(tournament);
          }
        }
      }

      // Sort by tournament date
      return tournaments.sort((a, b) => a.date.toMillis() - b.date.toMillis());
    } catch (error) {
      throw new Error(`Failed to fetch player tournaments: ${error.message}`);
    }
  }

  /**
   * Get detailed tournament view for players
   * AC3.1.3: Tournament details view with format, schedule, location
   */
  async getTournamentDetails(
    tournamentId: string,
    playerId: string
  ): Promise<{
    tournament: Tournament;
    registration?: TournamentRegistration;
    playerStats: {
      totalPlayers: number;
      playerPosition?: number;
      matches: {
        total: number;
        won: number;
        lost: number;
        upcoming: number;
      };
    };
  }> {
    try {
      const tournament = await this.db.getTournament(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Get player registration
      const registration = await this.db.findRegistration(
        tournamentId,
        playerId
      );

      // Get player statistics for this tournament
      const playerStats = await this.calculatePlayerStats(
        tournamentId,
        playerId
      );

      return {
        tournament,
        registration,
        playerStats,
      };
    } catch (error) {
      throw new Error(`Failed to fetch tournament details: ${error.message}`);
    }
  }

  /**
   * Withdraw from tournament with bracket adjustment
   * AC3.1.4: Player withdrawal functionality with bracket adjustment
   */
  async withdrawFromTournament(
    tournamentId: string,
    playerId: string,
    reason: string
  ): Promise<void> {
    try {
      // Get current registration
      const registration = await this.db.findRegistration(
        tournamentId,
        playerId
      );
      if (!registration || registration.status !== 'active') {
        throw new Error(
          'Player is not actively registered for this tournament'
        );
      }

      // Check tournament status
      const tournament = await this.db.getTournament(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      if (tournament.status === 'completed') {
        throw new Error('Cannot withdraw from completed tournament');
      }

      // Mark registration as withdrawn
      await this.db.updateRegistration(registration.id, {
        status: 'withdrawn',
        withdrawnAt: Timestamp.now(),
        withdrawalReason: reason,
      });

      // Update tournament player count
      await this.db.updateTournament(tournamentId, {
        currentPlayerCount: tournament.currentPlayerCount - 1,
      });

      // Handle bracket adjustment if tournament is active
      if (tournament.status === 'active') {
        await this.handlePlayerWithdrawal(tournamentId, playerId);
      }

      // Notify organizer
      await this.notificationService.notifyPlayerWithdrawal(
        tournament.organizerId,
        {
          playerName:
            (await this.db.getUser(playerId))?.name || 'Unknown Player',
          tournamentName: tournament.name,
          reason,
        }
      );
    } catch (error) {
      throw new Error(`Failed to withdraw from tournament: ${error.message}`);
    }
  }

  /**
   * Get player's tournament history
   * AC3.1.5: Tournament history and past participation tracking
   */
  async getPlayerTournamentHistory(
    playerId: string,
    limit: number = 10
  ): Promise<{
    tournaments: Tournament[];
    statistics: {
      totalTournaments: number;
      wins: number;
      finals: number;
      semifinals: number;
    };
  }> {
    try {
      // Get all historical registrations
      const registrations = await this.db.getPlayerRegistrations(playerId);

      // Get completed tournaments
      const completedTournaments: Tournament[] = [];
      for (const registration of registrations) {
        const tournament = await this.db.getTournament(
          registration.tournamentId
        );
        if (tournament && tournament.status === 'completed') {
          completedTournaments.push(tournament);
        }
      }

      // Sort by date (most recent first) and limit
      const sortedTournaments = completedTournaments
        .sort((a, b) => b.date.toMillis() - a.date.toMillis())
        .slice(0, limit);

      // Calculate statistics
      const statistics = await this.calculatePlayerHistoryStats(
        playerId,
        completedTournaments
      );

      return {
        tournaments: sortedTournaments,
        statistics,
      };
    } catch (error) {
      throw new Error(`Failed to fetch tournament history: ${error.message}`);
    }
  }

  /**
   * Search and discover public tournaments
   */
  async discoverTournaments(
    filters: TournamentSearchFilters
  ): Promise<Tournament[]> {
    try {
      return await this.db.searchTournaments({
        ...filters,
        isPublic: true,
        status: filters.status || 'setup',
      });
    } catch (error) {
      throw new Error(`Failed to discover tournaments: ${error.message}`);
    }
  }

  // Private helper methods

  private async calculatePlayerStats(tournamentId: string, playerId: string) {
    const matches = await this.db.getPlayerMatches(tournamentId, playerId);
    const totalPlayers = await this.db.getTournamentPlayerCount(tournamentId);

    const stats = {
      total: matches.length,
      won: matches.filter(m => m.winnerId === playerId).length,
      lost: matches.filter(
        m => m.status === 'completed' && m.winnerId !== playerId
      ).length,
      upcoming: matches.filter(m => m.status === 'pending').length,
    };

    return {
      totalPlayers,
      matches: stats,
    };
  }

  private async calculatePlayerHistoryStats(
    playerId: string,
    tournaments: Tournament[]
  ) {
    let wins = 0;
    let finals = 0;
    let semifinals = 0;

    for (const tournament of tournaments) {
      const finalPosition = await this.db.getPlayerFinalPosition(
        tournament.id,
        playerId
      );
      if (finalPosition === 1) wins++;
      if (finalPosition <= 2) finals++;
      if (finalPosition <= 4) semifinals++;
    }

    return {
      totalTournaments: tournaments.length,
      wins,
      finals,
      semifinals,
    };
  }

  private async handlePlayerWithdrawal(
    tournamentId: string,
    playerId: string
  ): Promise<void> {
    // Get player's upcoming matches
    const upcomingMatches = await this.db.getPlayerUpcomingMatches(
      tournamentId,
      playerId
    );

    for (const match of upcomingMatches) {
      if (match.status === 'pending') {
        // Award walkover to opponent
        const opponentId =
          match.player1Id === playerId ? match.player2Id : match.player1Id;
        if (opponentId) {
          await this.db.updateMatch(match.id, {
            winnerId: opponentId,
            status: 'completed',
            endTime: Timestamp.now(),
            score: {
              player1Sets: match.player1Id === opponentId ? [1] : [0],
              player2Sets: match.player2Id === opponentId ? [1] : [0],
              winner: match.player1Id === opponentId ? 'player1' : 'player2',
            },
          });

          // Advance winner to next round
          await this.db.advancePlayerToNextRound(
            tournamentId,
            opponentId,
            match.round + 1
          );
        }
      }
    }
  }

  private generateId(): string {
    return `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const playerTournamentService = new PlayerTournamentService();

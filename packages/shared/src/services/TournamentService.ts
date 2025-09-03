// Tournament service for ProTour - Epic 1-3 Implementation

import { DatabaseService } from './DatabaseService';
import {
  Tournament,
  TournamentFormData,
  TournamentRegistration,
  TournamentAccess,
  PlayerSchedule,
  PlayerProfile,
  Match,
  BracketPosition,
} from '../types';
import firestore from '@react-native-firebase/firestore';

export class TournamentService extends DatabaseService {
  private readonly COLLECTION = 'tournaments';
  private readonly REGISTRATIONS_COLLECTION = 'tournament_registrations';
  private readonly ACCESS_COLLECTION = 'tournament_access';
  private readonly MATCHES_COLLECTION = 'matches';
  private readonly PLAYERS_COLLECTION = 'players';

  async createTournament(
    data: TournamentFormData,
    organizerId: string
  ): Promise<Tournament> {
    // Validate required fields
    this.validateRequired(data, [
      'name',
      'date',
      'sport',
      'format',
      'maxPlayers',
    ]);

    // Validate enums
    this.validateEnum(data.sport, ['badminton', 'tennis', 'squash'], 'sport');
    this.validateEnum(
      data.format,
      ['single-elimination', 'double-elimination'],
      'format'
    );
    this.validateEnum(
      data.matchFormat,
      ['best-of-1', 'best-of-3', 'best-of-5'],
      'matchFormat'
    );

    // Validate constraints
    if (data.maxPlayers < 4 || data.maxPlayers > 64) {
      throw new Error('Max players must be between 4 and 64');
    }

    if (data.name.length < 3) {
      throw new Error('Tournament name must be at least 3 characters');
    }

    // Generate unique tournament code
    const tournamentCode = this.generateTournamentCode();

    const tournamentData: Omit<Tournament, 'id'> = {
      name: data.name.trim(),
      date: firestore.Timestamp.fromDate(data.date),
      sport: data.sport,
      format: data.format,
      matchFormat: data.matchFormat,
      description: data.description?.trim(),
      location: data.location?.trim(),
      organizerId,
      status: 'setup' as const,
      isPublic: data.isPublic,
      tournamentCode,
      maxPlayers: data.maxPlayers,
      currentPlayerCount: 0,
      createdAt: firestore.Timestamp.now(),
      updatedAt: firestore.Timestamp.now(),
    };

    return this.create<Tournament>(this.COLLECTION, tournamentData);
  }

  async getTournament(id: string): Promise<Tournament | null> {
    return this.read<Tournament>(this.COLLECTION, id);
  }

  async updateTournament(
    id: string,
    updates: Partial<Tournament>
  ): Promise<void> {
    // Validate status transitions
    if (updates.status) {
      await this.validateStatusTransition(id, updates.status);
    }

    // Prevent format changes after bracket generation
    if (updates.format) {
      const tournament = await this.getTournament(id);
      if (tournament && tournament.currentPlayerCount > 0) {
        throw new Error(
          'Cannot change tournament format after players are added'
        );
      }
    }

    return this.update<Tournament>(this.COLLECTION, id, updates);
  }

  async deleteTournament(id: string, organizerId: string): Promise<void> {
    // Verify ownership
    const tournament = await this.getTournament(id);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.organizerId !== organizerId) {
      throw new Error('Unauthorized: You can only delete your own tournaments');
    }

    // Prevent deletion of active tournaments
    if (tournament.status === 'active') {
      throw new Error(
        'Cannot delete active tournament. Complete or cancel it first.'
      );
    }

    return this.delete(this.COLLECTION, id);
  }

  async getTournamentsByOrganizer(
    organizerId: string,
    filters: {
      status?: Tournament['status'];
      limit?: number;
      orderBy?: 'date' | 'createdAt' | 'name';
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<Tournament[]> {
    const queryConstraints = [
      { fieldPath: 'organizerId', opStr: '==', value: organizerId },
    ];

    if (filters.status) {
      queryConstraints.push({
        fieldPath: 'status',
        opStr: '==',
        value: filters.status,
      });
    }

    return this.query<Tournament>(this.COLLECTION, queryConstraints);
  }

  async findTournamentByCode(code: string): Promise<Tournament | null> {
    const tournaments = await this.query<Tournament>(this.COLLECTION, [
      { fieldPath: 'tournamentCode', opStr: '==', value: code },
    ]);

    return tournaments.length > 0 ? tournaments[0] : null;
  }

  async getPublicTournaments(
    filters: {
      sport?: Tournament['sport'];
      limit?: number;
    } = {}
  ): Promise<Tournament[]> {
    const queryConstraints = [
      { fieldPath: 'isPublic', opStr: '==', value: true },
    ];

    if (filters.sport) {
      queryConstraints.push({
        fieldPath: 'sport',
        opStr: '==',
        value: filters.sport as string,
      });
    }

    // Note: We'll filter status in memory for now since Firestore 'in' operator has issues
    const results = await this.query<Tournament>(
      this.COLLECTION,
      queryConstraints
    );
    return results.filter(t => ['setup', 'active'].includes(t.status));
  }

  // Private helper methods
  private generateTournamentCode(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Excluding O, 0 for clarity
    let code = '';

    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  }

  private async validateStatusTransition(
    tournamentId: string,
    newStatus: Tournament['status']
  ): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const currentStatus = tournament.status;
    const validTransitions: Record<string, string[]> = {
      setup: ['active'],
      active: ['completed'],
      completed: [], // No transitions allowed
    };

    const allowedStatuses = validTransitions[currentStatus];
    if (!allowedStatuses.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }

    // Additional validation for status changes
    if (newStatus === 'active' && tournament.currentPlayerCount < 4) {
      throw new Error('Cannot activate tournament with fewer than 4 players');
    }
  }

  // Utility methods for tournament management
  async incrementPlayerCount(tournamentId: string): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.currentPlayerCount >= tournament.maxPlayers) {
      throw new Error('Tournament is full');
    }

    await this.updateTournament(tournamentId, {
      currentPlayerCount: tournament.currentPlayerCount + 1,
    });
  }

  async decrementPlayerCount(tournamentId: string): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.currentPlayerCount <= 0) {
      throw new Error('Player count cannot be negative');
    }

    await this.updateTournament(tournamentId, {
      currentPlayerCount: tournament.currentPlayerCount - 1,
    });
  }

  async setPlayerCount(tournamentId: string, count: number): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (count < 0 || count > tournament.maxPlayers) {
      throw new Error(
        `Player count must be between 0 and ${tournament.maxPlayers}`
      );
    }

    await this.updateTournament(tournamentId, {
      currentPlayerCount: count,
    });
  }

  // Epic 3 Methods - Multi-Role Tournament Experience

  // Tournament Discovery and Access
  async getTournamentByCode(code: string): Promise<Tournament | null> {
    return this.findTournamentByCode(code);
  }

  async getTournamentById(id: string): Promise<Tournament | null> {
    return this.getTournament(id);
  }

  async joinTournament(
    accessData: Omit<TournamentAccess, 'joinedAt'>
  ): Promise<TournamentAccess> {
    // Verify tournament exists and is accessible
    const tournament = await this.findTournamentByCode(accessData.accessCode);
    if (!tournament) {
      throw new Error('Invalid access code');
    }

    if (tournament.id !== accessData.tournamentId) {
      throw new Error('Access code does not match tournament');
    }

    // Check if user already has access
    const existingAccess = await this.query<TournamentAccess>(
      this.ACCESS_COLLECTION,
      [
        {
          fieldPath: 'tournamentId',
          opStr: '==',
          value: accessData.tournamentId,
        },
        { fieldPath: 'userId', opStr: '==', value: accessData.userId },
      ]
    );

    if (existingAccess.length > 0 && existingAccess[0].active) {
      throw new Error('You are already joined to this tournament');
    }

    // For players, check tournament capacity
    if (
      accessData.role === 'player' &&
      tournament.currentPlayerCount >= tournament.maxPlayers
    ) {
      throw new Error('Tournament is full');
    }

    const tournamentAccess: Omit<TournamentAccess, 'id'> = {
      ...accessData,
      joinedAt: firestore.Timestamp.now(),
    };

    const createdAccess = await this.create<TournamentAccess>(
      this.ACCESS_COLLECTION,
      tournamentAccess
    );

    // Create tournament registration record
    if (accessData.role === 'player') {
      await this.createTournamentRegistration({
        tournamentId: accessData.tournamentId,
        playerId: accessData.userId, // For now, userId serves as playerId
        userId: accessData.userId,
        role: 'player',
        status: 'active',
      });

      // Increment player count
      await this.incrementPlayerCount(accessData.tournamentId);
    } else if (accessData.role === 'spectator') {
      await this.createTournamentRegistration({
        tournamentId: accessData.tournamentId,
        playerId: '', // Spectators don't have a player record
        userId: accessData.userId,
        role: 'spectator',
        status: 'active',
      });
    }

    return createdAccess;
  }

  private async createTournamentRegistration(
    data: Omit<TournamentRegistration, 'id' | 'registeredAt'>
  ): Promise<TournamentRegistration> {
    const registrationData: Omit<TournamentRegistration, 'id'> = {
      ...data,
      registeredAt: firestore.Timestamp.now(),
    };

    return this.create<TournamentRegistration>(
      this.REGISTRATIONS_COLLECTION,
      registrationData
    );
  }

  async getPlayerRegistrations(
    userId: string
  ): Promise<TournamentRegistration[]> {
    return this.query<TournamentRegistration>(this.REGISTRATIONS_COLLECTION, [
      { fieldPath: 'userId', opStr: '==', value: userId },
      { fieldPath: 'status', opStr: '==', value: 'active' },
    ]);
  }

  async withdrawFromTournament(
    tournamentId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const registrations = await this.query<TournamentRegistration>(
      this.REGISTRATIONS_COLLECTION,
      [
        { fieldPath: 'tournamentId', opStr: '==', value: tournamentId },
        { fieldPath: 'userId', opStr: '==', value: userId },
      ]
    );

    if (registrations.length === 0) {
      throw new Error('Not registered for this tournament');
    }

    const registration = registrations[0];

    // Update registration status
    await this.update<TournamentRegistration>(
      this.REGISTRATIONS_COLLECTION,
      registration.id,
      {
        status: 'withdrawn',
        withdrawnAt: firestore.Timestamp.now(),
        withdrawalReason: reason,
      }
    );

    // Update tournament access
    const accessRecords = await this.query<TournamentAccess>(
      this.ACCESS_COLLECTION,
      [
        { fieldPath: 'tournamentId', opStr: '==', value: tournamentId },
        { fieldPath: 'userId', opStr: '==', value: userId },
      ]
    );

    if (accessRecords.length > 0) {
      await this.update<TournamentAccess>(
        this.ACCESS_COLLECTION,
        accessRecords[0].id,
        { active: false }
      );
    }

    // Decrement player count if it was a player
    if (registration.role === 'player') {
      await this.decrementPlayerCount(tournamentId);
    }
  }

  // Player Schedule Methods
  async getPlayerSchedule(
    userId: string,
    tournamentId: string
  ): Promise<PlayerSchedule> {
    // Get player's matches for this tournament
    const allMatches = await this.query<Match>(this.MATCHES_COLLECTION, [
      { fieldPath: 'tournamentId', opStr: '==', value: tournamentId },
    ]);

    // Filter matches where user is a participant
    const playerMatches = allMatches.filter(
      match => match.player1Id === userId || match.player2Id === userId
    );

    // Categorize matches
    const currentMatch = playerMatches.find(
      match => match.status === 'in-progress'
    );
    const upcomingMatches = playerMatches
      .filter(match => match.status === 'pending')
      .sort((a, b) => a.round - b.round);
    const completedMatches = playerMatches
      .filter(match => match.status === 'completed')
      .sort((a, b) => b.round - a.round);

    // Calculate tournament progress
    const tournamentProgress = this.calculateBracketPosition(
      userId,
      playerMatches
    );

    // Estimate next match time (simple estimation)
    const estimatedNextMatchTime =
      upcomingMatches.length > 0 && upcomingMatches[0].startTime
        ? upcomingMatches[0].startTime.toDate()
        : undefined;

    return {
      playerId: userId,
      tournamentId,
      currentMatch,
      upcomingMatches,
      completedMatches,
      tournamentProgress,
      estimatedNextMatchTime,
    };
  }

  private calculateBracketPosition(
    userId: string,
    matches: Match[]
  ): BracketPosition {
    const completedMatches = matches.filter(
      match => match.status === 'completed'
    );
    const currentRound = Math.max(...matches.map(match => match.round), 0);

    // Check if player is eliminated
    const eliminated = completedMatches.some(
      match => match.winnerId && match.winnerId !== userId
    );

    // Simple position calculation
    const position = matches.length > 0 ? matches[0].matchNumber : 1;

    return {
      currentRound: currentRound || 1,
      position,
      eliminated,
      advancedToRound: eliminated ? undefined : currentRound + 1,
      canAdvanceToRound: eliminated ? undefined : currentRound + 2,
    };
  }

  // Tournament Search and Discovery
  async searchPublicTournaments(
    filters: {
      sport?: Tournament['sport'];
      location?: string;
      status?: Tournament['status'];
      limit?: number;
    } = {}
  ): Promise<Tournament[]> {
    const queryConstraints = [
      { fieldPath: 'isPublic', opStr: '==', value: true },
    ];

    if (filters.sport) {
      queryConstraints.push({
        fieldPath: 'sport',
        opStr: '==',
        value: filters.sport,
      });
    }

    if (filters.status) {
      queryConstraints.push({
        fieldPath: 'status',
        opStr: '==',
        value: filters.status,
      });
    }

    const tournaments = await this.query<Tournament>(
      this.COLLECTION,
      queryConstraints
    );

    // Filter by location if provided (simple contains check)
    let filteredTournaments = tournaments;
    if (filters.location) {
      filteredTournaments = tournaments.filter(tournament =>
        tournament.location
          ?.toLowerCase()
          .includes(filters.location!.toLowerCase())
      );
    }

    // Apply limit
    if (filters.limit) {
      filteredTournaments = filteredTournaments.slice(0, filters.limit);
    }

    return filteredTournaments;
  }
}

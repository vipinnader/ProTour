// Tournament service for ProTour - Epic 1 Implementation

import { DatabaseService } from './DatabaseService';
import { Tournament, TournamentFormData } from '../types';
import firestore from '@react-native-firebase/firestore';

export class TournamentService extends DatabaseService {
  private readonly COLLECTION = 'tournaments';

  async createTournament(data: TournamentFormData, organizerId: string): Promise<Tournament> {
    // Validate required fields
    this.validateRequired(data, ['name', 'date', 'sport', 'format', 'maxPlayers']);

    // Validate enums
    this.validateEnum(data.sport, ['badminton', 'tennis', 'squash'], 'sport');
    this.validateEnum(data.format, ['single-elimination', 'double-elimination'], 'format');
    this.validateEnum(data.matchFormat, ['best-of-1', 'best-of-3', 'best-of-5'], 'matchFormat');

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

  async updateTournament(id: string, updates: Partial<Tournament>): Promise<void> {
    // Validate status transitions
    if (updates.status) {
      await this.validateStatusTransition(id, updates.status);
    }

    // Prevent format changes after bracket generation
    if (updates.format) {
      const tournament = await this.getTournament(id);
      if (tournament && tournament.currentPlayerCount > 0) {
        throw new Error('Cannot change tournament format after players are added');
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
      throw new Error('Cannot delete active tournament. Complete or cancel it first.');
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
      { fieldPath: 'organizerId', opStr: '==', value: organizerId }
    ];

    if (filters.status) {
      queryConstraints.push({
        fieldPath: 'status',
        opStr: '==',
        value: filters.status
      });
    }

    return this.query<Tournament>(this.COLLECTION, queryConstraints);
  }

  async findTournamentByCode(code: string): Promise<Tournament | null> {
    const tournaments = await this.query<Tournament>(this.COLLECTION, [
      { fieldPath: 'tournamentCode', opStr: '==', value: code }
    ]);

    return tournaments.length > 0 ? tournaments[0] : null;
  }

  async getPublicTournaments(filters: {
    sport?: Tournament['sport'];
    limit?: number;
  } = {}): Promise<Tournament[]> {
    const queryConstraints = [
      { fieldPath: 'isPublic', opStr: '==', value: true }
    ];

    if (filters.sport) {
      queryConstraints.push({
        fieldPath: 'sport',
        opStr: '==',
        value: filters.sport as string
      });
    }

    // Note: We'll filter status in memory for now since Firestore 'in' operator has issues
    const results = await this.query<Tournament>(this.COLLECTION, queryConstraints);
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

  private async validateStatusTransition(tournamentId: string, newStatus: Tournament['status']): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const currentStatus = tournament.status;
    const validTransitions: Record<string, string[]> = {
      'setup': ['active'],
      'active': ['completed'],
      'completed': [], // No transitions allowed
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
      currentPlayerCount: tournament.currentPlayerCount + 1
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
      currentPlayerCount: tournament.currentPlayerCount - 1
    });
  }

  async setPlayerCount(tournamentId: string, count: number): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (count < 0 || count > tournament.maxPlayers) {
      throw new Error(`Player count must be between 0 and ${tournament.maxPlayers}`);
    }

    await this.updateTournament(tournamentId, {
      currentPlayerCount: count
    });
  }
}
// Match service for ProTour - Epic 1 Implementation

import { DatabaseService } from './DatabaseService';
import { Match, MatchScore } from '../types';
import firestore from '@react-native-firebase/firestore';

export class MatchService extends DatabaseService {
  private readonly COLLECTION = 'matches';

  async createMatch(data: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>): Promise<Match> {
    // Validate required fields
    this.validateRequired(data, ['tournamentId', 'round', 'matchNumber', 'player1Id']);

    // Validate constraints
    if (data.round < 1) {
      throw new Error('Round must be a positive number');
    }

    if (data.matchNumber < 1) {
      throw new Error('Match number must be a positive number');
    }

    // Validate status
    this.validateEnum(
      data.status, 
      ['pending', 'in-progress', 'completed'], 
      'status'
    );

    const matchData = {
      tournamentId: data.tournamentId,
      round: data.round,
      matchNumber: data.matchNumber,
      player1Id: data.player1Id,
      player2Id: data.player2Id,
      winnerId: data.winnerId,
      score: data.score,
      status: data.status,
      startTime: data.startTime,
      endTime: data.endTime,
      court: data.court,
      nextMatchId: data.nextMatchId,
    };

    return this.create<Match>(this.COLLECTION, matchData);
  }

  async getMatch(id: string): Promise<Match | null> {
    return this.read<Match>(this.COLLECTION, id);
  }

  async updateMatch(id: string, updates: Partial<Match>): Promise<void> {
    // Validate status transitions
    if (updates.status) {
      await this.validateMatchStatusTransition(id, updates.status);
    }

    // Validate winner is one of the players
    if (updates.winnerId) {
      await this.validateWinner(id, updates.winnerId);
    }

    // Validate score format
    if (updates.score) {
      this.validateScore(updates.score);
    }

    return this.update<Match>(this.COLLECTION, id, updates);
  }

  async deleteMatch(id: string): Promise<void> {
    return this.delete(this.COLLECTION, id);
  }

  async getMatchesByTournament(
    tournamentId: string,
    filters: {
      round?: number;
      status?: Match['status'];
    } = {}
  ): Promise<Match[]> {
    const queryConstraints = [
      { fieldPath: 'tournamentId', opStr: '==', value: tournamentId }
    ];

    if (filters.round !== undefined) {
      queryConstraints.push({
        fieldPath: 'round',
        opStr: '==',
        value: filters.round
      });
    }

    if (filters.status) {
      queryConstraints.push({
        fieldPath: 'status',
        opStr: '==',
        value: filters.status
      });
    }

    return this.query<Match>(this.COLLECTION, queryConstraints);
  }

  async getMatchesByPlayer(playerId: string, tournamentId?: string): Promise<Match[]> {
    let queryConstraints;
    
    if (tournamentId) {
      queryConstraints = [
        { fieldPath: 'tournamentId', opStr: '==', value: tournamentId },
      ];
    } else {
      queryConstraints = [];
    }

    // Note: Firestore doesn't support OR queries directly, so we need to make two queries
    const player1Matches = await this.query<Match>(this.COLLECTION, [
      ...queryConstraints,
      { fieldPath: 'player1Id', opStr: '==', value: playerId }
    ]);

    const player2Matches = await this.query<Match>(this.COLLECTION, [
      ...queryConstraints,
      { fieldPath: 'player2Id', opStr: '==', value: playerId }
    ]);

    // Combine and deduplicate matches
    const allMatches = [...player1Matches, ...player2Matches];
    const uniqueMatches = allMatches.filter((match, index, array) => 
      array.findIndex(m => m.id === match.id) === index
    );

    return uniqueMatches;
  }

  async deleteMatchesByTournament(tournamentId: string): Promise<void> {
    const matches = await this.getMatchesByTournament(tournamentId);
    
    if (matches.length === 0) {
      return;
    }

    // Use batch delete for efficiency
    const batch = this.db.batch();
    matches.forEach(match => {
      const docRef = this.db.collection(this.COLLECTION).doc(match.id);
      batch.delete(docRef);
    });

    await batch.commit();
  }

  // Match progression functionality
  async startMatch(matchId: string): Promise<void> {
    const match = await this.getMatch(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== 'pending') {
      throw new Error('Can only start pending matches');
    }

    // Check if player2Id is null (bye match)
    if (!match.player2Id) {
      // Automatically complete bye matches
      await this.completeBye(matchId, match.player1Id);
      return;
    }

    await this.updateMatch(matchId, {
      status: 'in-progress',
      startTime: firestore.Timestamp.now(),
    });
  }

  async completeMatch(
    matchId: string, 
    winnerId: string, 
    score?: MatchScore
  ): Promise<void> {
    const match = await this.getMatch(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status === 'completed') {
      throw new Error('Match is already completed');
    }

    // Validate winner
    if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
      throw new Error('Winner must be one of the players in the match');
    }

    // Validate score if provided
    if (score) {
      this.validateScore(score);
      this.validateScoreConsistency(score, winnerId, match.player1Id);
    }

    await this.updateMatch(matchId, {
      status: 'completed',
      winnerId,
      score,
      endTime: firestore.Timestamp.now(),
    });

    // Progress winner to next match if applicable
    if (match.nextMatchId) {
      await this.progressWinner(match.nextMatchId, winnerId);
    }
  }

  async completeBye(matchId: string, winnerId: string): Promise<void> {
    const match = await this.getMatch(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.player2Id) {
      throw new Error('This is not a bye match');
    }

    await this.updateMatch(matchId, {
      status: 'completed',
      winnerId,
      startTime: firestore.Timestamp.now(),
      endTime: firestore.Timestamp.now(),
    });

    // Progress winner to next match
    if (match.nextMatchId) {
      await this.progressWinner(match.nextMatchId, winnerId);
    }
  }

  // Batch operations for bracket generation
  async batchCreateMatches(matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Match[]> {
    return this.batchCreate<Match>(this.COLLECTION, matches);
  }

  // Private helper methods
  private async validateMatchStatusTransition(matchId: string, newStatus: Match['status']): Promise<void> {
    const match = await this.getMatch(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    const currentStatus = match.status;
    const validTransitions: Record<string, string[]> = {
      'pending': ['in-progress'],
      'in-progress': ['completed'],
      'completed': [], // No transitions allowed from completed
    };

    const allowedStatuses = validTransitions[currentStatus];
    if (!allowedStatuses.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private async validateWinner(matchId: string, winnerId: string): Promise<void> {
    const match = await this.getMatch(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
      throw new Error('Winner must be one of the players in the match');
    }
  }

  private validateScore(score: MatchScore): void {
    if (!score.player1Sets || !score.player2Sets) {
      throw new Error('Both player scores are required');
    }

    if (score.player1Sets.length !== score.player2Sets.length) {
      throw new Error('Both players must have the same number of sets');
    }

    if (score.player1Sets.length === 0) {
      throw new Error('At least one set score is required');
    }

    // Validate each set score
    score.player1Sets.forEach((set, index) => {
      if (set < 0 || score.player2Sets[index] < 0) {
        throw new Error('Set scores cannot be negative');
      }
    });
  }

  private validateScoreConsistency(score: MatchScore, winnerId: string, player1Id: string): void {
    const isPlayer1Winner = winnerId === player1Id;
    
    // Count sets won by each player
    let player1Sets = 0;
    let player2Sets = 0;

    score.player1Sets.forEach((set, index) => {
      if (set > score.player2Sets[index]) {
        player1Sets++;
      } else if (set < score.player2Sets[index]) {
        player2Sets++;
      }
    });

    // Verify the winner actually won more sets
    const actualWinner = player1Sets > player2Sets ? 'player1' : 'player2';
    
    if ((isPlayer1Winner && actualWinner !== 'player1') || 
        (!isPlayer1Winner && actualWinner !== 'player2')) {
      throw new Error('Winner does not match the score provided');
    }

    // Update the score's winner field
    score.winner = actualWinner;
  }

  private async progressWinner(nextMatchId: string, winnerId: string): Promise<void> {
    const nextMatch = await this.getMatch(nextMatchId);
    if (!nextMatch) {
      return; // Next match doesn't exist yet
    }

    // Determine which player slot to fill
    if (!nextMatch.player1Id) {
      await this.updateMatch(nextMatchId, { player1Id: winnerId });
    } else if (!nextMatch.player2Id) {
      await this.updateMatch(nextMatchId, { player2Id: winnerId });
    }
  }
}
// Bracket service for ProTour - Epic 1 Implementation

import { DatabaseService } from './DatabaseService';
import { MatchService } from './MatchService';
import { PlayerService } from './PlayerService';
import {
  BracketStructure,
  BracketValidation,
  Match,
  Player,
  Tournament,
} from '../types';
import firestore from '@react-native-firebase/firestore';

export class BracketService extends DatabaseService {
  private matchService: MatchService;
  private playerService: PlayerService;

  constructor() {
    super();
    this.matchService = new MatchService();
    this.playerService = new PlayerService();
  }

  async generateSingleEliminationBracket(
    tournamentId: string,
    players: Player[],
    seedingMethod: 'random' | 'ranking' | 'manual' = 'random'
  ): Promise<BracketStructure> {
    // Validate input
    if (players.length < 4) {
      throw new Error('At least 4 players required for tournament');
    }

    if (players.length > 64) {
      throw new Error('Maximum 64 players supported');
    }

    // Apply seeding
    if (seedingMethod !== 'manual') {
      await this.playerService.assignSeedPositions(tournamentId, seedingMethod);
      // Refetch players with updated seed positions
      players = await this.playerService.getPlayersByTournament(tournamentId);
    }

    // Sort players by seed position
    const seededPlayers = players.sort((a, b) => {
      if (a.seedPosition === undefined && b.seedPosition === undefined)
        return 0;
      if (a.seedPosition === undefined) return 1;
      if (b.seedPosition === undefined) return -1;
      return a.seedPosition - b.seedPosition;
    });

    // Calculate bracket structure
    const totalRounds = Math.ceil(Math.log2(players.length));
    const nextPowerOf2 = Math.pow(2, totalRounds);
    const byeCount = nextPowerOf2 - players.length;

    // Generate matches for all rounds
    const matches = this.generateMatches(
      tournamentId,
      seededPlayers,
      totalRounds,
      byeCount
    );

    // Create matches in database
    const createdMatches = await this.matchService.batchCreateMatches(matches);

    return {
      tournamentId,
      format: 'single-elimination',
      playerCount: players.length,
      byeCount,
      totalRounds,
      matches: createdMatches,
      createdAt: firestore.Timestamp.now(),
      updatedAt: firestore.Timestamp.now(),
    };
  }

  async generateDoubleEliminationBracket(
    tournamentId: string,
    players: Player[]
  ): Promise<BracketStructure> {
    // Double elimination implementation (simplified for Epic 1)
    // For now, we'll implement single elimination and expand later
    throw new Error('Double elimination bracket generation coming in Epic 2A');
  }

  async validateBracket(tournamentId: string): Promise<BracketValidation> {
    const matches =
      await this.matchService.getMatchesByTournament(tournamentId);
    const players =
      await this.playerService.getPlayersByTournament(tournamentId);

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate player count
    if (players.length < 4) {
      errors.push('Tournament must have at least 4 players');
    }

    if (players.length > 64) {
      errors.push('Tournament cannot have more than 64 players');
    }

    // Validate matches exist
    if (matches.length === 0 && players.length >= 4) {
      errors.push('No matches found for tournament with valid player count');
    }

    // Validate round structure
    const roundCounts = this.validateRoundStructure(matches);
    if (roundCounts.errors.length > 0) {
      errors.push(...roundCounts.errors);
    }

    // Validate match progression
    const progressionErrors = this.validateMatchProgression(matches);
    errors.push(...progressionErrors);

    // Check for orphaned matches
    const orphanedMatches = matches.filter(
      match =>
        !players.find(p => p.id === match.player1Id) ||
        (match.player2Id && !players.find(p => p.id === match.player2Id))
    );

    if (orphanedMatches.length > 0) {
      errors.push(
        `${orphanedMatches.length} matches reference non-existent players`
      );
    }

    // Warnings for potential issues
    const completedMatches = matches.filter(m => m.status === 'completed');
    const totalMatches = matches.length;

    if (completedMatches.length === 0 && totalMatches > 0) {
      warnings.push('Tournament has not started - no completed matches');
    }

    if (
      completedMatches.length > 0 &&
      completedMatches.length < totalMatches * 0.5
    ) {
      warnings.push('Tournament appears to be in early stages');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async regenerateBracket(
    tournamentId: string,
    preserveCompletedMatches: boolean = true
  ): Promise<BracketStructure> {
    // Get current state
    const players =
      await this.playerService.getPlayersByTournament(tournamentId);
    const existingMatches =
      await this.matchService.getMatchesByTournament(tournamentId);

    // Check if there are completed matches
    const completedMatches = existingMatches.filter(
      m => m.status === 'completed'
    );

    if (completedMatches.length > 0 && !preserveCompletedMatches) {
      throw new Error(
        'Cannot regenerate bracket with completed matches without preserve option'
      );
    }

    if (preserveCompletedMatches && completedMatches.length > 0) {
      throw new Error(
        'Preserving completed matches during regeneration not yet implemented'
      );
    }

    // Delete existing matches
    await this.matchService.deleteMatchesByTournament(tournamentId);

    // Generate new bracket
    return this.generateSingleEliminationBracket(
      tournamentId,
      players,
      'manual'
    );
  }

  async getBracketStructure(
    tournamentId: string
  ): Promise<BracketStructure | null> {
    const matches =
      await this.matchService.getMatchesByTournament(tournamentId);
    const players =
      await this.playerService.getPlayersByTournament(tournamentId);

    if (matches.length === 0) {
      return null;
    }

    const totalRounds = Math.max(...matches.map(m => m.round));
    const nextPowerOf2 = Math.pow(2, totalRounds);
    const byeCount = nextPowerOf2 - players.length;

    return {
      tournamentId,
      format: 'single-elimination', // TODO: Detect from tournament data
      playerCount: players.length,
      byeCount,
      totalRounds,
      matches,
      createdAt: firestore.Timestamp.now(),
      updatedAt: firestore.Timestamp.now(),
    };
  }

  // Private helper methods
  private generateMatches(
    tournamentId: string,
    players: Player[],
    totalRounds: number,
    byeCount: number
  ): Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] {
    const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const nextPowerOf2 = Math.pow(2, totalRounds);

    // Create all rounds of matches
    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = nextPowerOf2 / Math.pow(2, round);

      for (let matchNum = 1; matchNum <= matchesInRound; matchNum++) {
        const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
          tournamentId,
          round,
          matchNumber: matchNum,
          player1Id: '',
          player2Id: undefined,
          status: 'pending',
        };

        // For first round, assign players directly
        if (round === 1) {
          const player1Index = (matchNum - 1) * 2;
          const player2Index = player1Index + 1;

          if (player1Index < players.length) {
            match.player1Id = players[player1Index].id;
          }

          if (player2Index < players.length) {
            match.player2Id = players[player2Index].id;
          }

          // Handle byes - if player2 doesn't exist, it's a bye
          if (!match.player2Id && match.player1Id) {
            // This is a bye match - player1 automatically advances
          }
        }

        // Set up progression to next round
        if (round < totalRounds) {
          const nextRoundMatch = Math.ceil(matchNum / 2);
          match.nextMatchId = this.generateMatchId(
            tournamentId,
            round + 1,
            nextRoundMatch
          );
        }

        matches.push(match);
      }
    }

    return matches;
  }

  private generateMatchId(
    tournamentId: string,
    round: number,
    matchNumber: number
  ): string {
    // Generate a predictable match ID for linking
    return `${tournamentId}_r${round}_m${matchNumber}`;
  }

  private validateRoundStructure(matches: Match[]): { errors: string[] } {
    const errors: string[] = [];

    if (matches.length === 0) {
      return { errors };
    }

    const roundCounts = new Map<number, number>();
    matches.forEach(match => {
      roundCounts.set(match.round, (roundCounts.get(match.round) || 0) + 1);
    });

    const rounds = Array.from(roundCounts.keys()).sort();

    // Validate rounds are sequential
    for (let i = 0; i < rounds.length - 1; i++) {
      if (rounds[i + 1] - rounds[i] !== 1) {
        errors.push(`Missing round ${rounds[i] + 1} in bracket`);
      }
    }

    // Validate round sizes follow tournament bracket logic
    for (let i = 0; i < rounds.length - 1; i++) {
      const currentRoundMatches = roundCounts.get(rounds[i]) || 0;
      const nextRoundMatches = roundCounts.get(rounds[i + 1]) || 0;

      if (nextRoundMatches !== Math.ceil(currentRoundMatches / 2)) {
        errors.push(`Round ${rounds[i + 1]} has incorrect number of matches`);
      }
    }

    return { errors };
  }

  private validateMatchProgression(matches: Match[]): string[] {
    const errors: string[] = [];

    // Check that completed matches have winners progressed correctly
    const completedMatches = matches.filter(
      m => m.status === 'completed' && m.winnerId
    );

    completedMatches.forEach(match => {
      if (match.nextMatchId) {
        const nextMatch = matches.find(m => m.id === match.nextMatchId);
        if (nextMatch) {
          const winnerInNextMatch =
            nextMatch.player1Id === match.winnerId ||
            nextMatch.player2Id === match.winnerId;

          if (!winnerInNextMatch) {
            errors.push(
              `Winner of round ${match.round} match ${match.matchNumber} not found in next match`
            );
          }
        }
      }
    });

    return errors;
  }

  // Utility methods for bracket operations
  calculateByeCount(playerCount: number): number {
    const totalRounds = Math.ceil(Math.log2(playerCount));
    const nextPowerOf2 = Math.pow(2, totalRounds);
    return nextPowerOf2 - playerCount;
  }

  calculateTotalMatches(playerCount: number): number {
    // In single elimination, total matches = playerCount - 1
    return Math.max(0, playerCount - 1);
  }

  calculateRounds(playerCount: number): number {
    return Math.ceil(Math.log2(playerCount));
  }
}

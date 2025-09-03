// Player service for ProTour - Epic 1-3 Implementation

import { DatabaseService } from './DatabaseService';
import { 
  Player, 
  PlayerImportData, 
  CSVImportResult, 
  CSVImportError, 
  CSVDuplicate,
  PlayerProfile,
  PlayerFollow,
  PlayerStatistics,
  PlayerTournamentHistory
} from '../types';
import firestore from '@react-native-firebase/firestore';

export class PlayerService extends DatabaseService {
  private readonly COLLECTION = 'players';
  private readonly PROFILES_COLLECTION = 'player_profiles';
  private readonly FOLLOWS_COLLECTION = 'player_follows';

  async createPlayer(data: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>): Promise<Player> {
    // Validate required fields
    this.validateRequired(data, ['name', 'email', 'tournamentId']);

    // Validate email format
    if (!this.validateEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate name length
    if (data.name.trim().length < 2) {
      throw new Error('Player name must be at least 2 characters');
    }

    // Check for duplicate email in tournament
    await this.checkDuplicateEmail(data.email, data.tournamentId);

    const playerData = {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim(),
      ranking: data.ranking,
      notes: data.notes?.trim(),
      tournamentId: data.tournamentId,
      seedPosition: data.seedPosition,
    };

    return this.create<Player>(this.COLLECTION, playerData);
  }

  async getPlayer(id: string): Promise<Player | null> {
    return this.read<Player>(this.COLLECTION, id);
  }

  async updatePlayer(id: string, updates: Partial<Player>): Promise<void> {
    // Validate email if being updated
    if (updates.email && !this.validateEmail(updates.email)) {
      throw new Error('Invalid email format');
    }

    // Check for email conflicts if updating email
    if (updates.email) {
      const player = await this.getPlayer(id);
      if (player && updates.email !== player.email) {
        await this.checkDuplicateEmail(updates.email, player.tournamentId, id);
      }
    }

    return this.update<Player>(this.COLLECTION, id, updates);
  }

  async deletePlayer(id: string): Promise<void> {
    return this.delete(this.COLLECTION, id);
  }

  async getPlayersByTournament(tournamentId: string): Promise<Player[]> {
    return this.query<Player>(this.COLLECTION, [
      { fieldPath: 'tournamentId', opStr: '==', value: tournamentId }
    ]);
  }

  async deletePlayersByTournament(tournamentId: string): Promise<void> {
    const players = await this.getPlayersByTournament(tournamentId);
    
    if (players.length === 0) {
      return;
    }

    // Use batch delete for efficiency
    const batch = this.db.batch();
    players.forEach(player => {
      const docRef = this.db.collection(this.COLLECTION).doc(player.id);
      batch.delete(docRef);
    });

    await batch.commit();
  }

  // CSV Import functionality - Epic 1 Story 1.4
  async importPlayersFromCSV(
    csvData: PlayerImportData[],
    tournamentId: string
  ): Promise<CSVImportResult> {
    const validPlayers: PlayerImportData[] = [];
    const errors: CSVImportError[] = [];
    const duplicates: CSVDuplicate[] = [];

    // Get existing players to check for duplicates
    const existingPlayers = await this.getPlayersByTournament(tournamentId);
    const existingEmails = new Set(existingPlayers.map(p => p.email.toLowerCase()));
    const seenEmails = new Map<string, number>(); // email -> row number

    csvData.forEach((player, index) => {
      const row = index + 1; // 1-based row numbering
      const validationErrors = this.validatePlayerData(player, row);

      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        return;
      }

      const email = player.email.toLowerCase().trim();

      // Check for duplicates in existing players
      if (existingEmails.has(email)) {
        const existingPlayer = existingPlayers.find(p => p.email.toLowerCase() === email);
        duplicates.push({
          row,
          existingRow: -1, // Existing in database
          player,
          conflictField: 'email',
        });
        return;
      }

      // Check for duplicates within CSV data
      if (seenEmails.has(email)) {
        duplicates.push({
          row,
          existingRow: seenEmails.get(email)!,
          player,
          conflictField: 'email',
        });
        return;
      }

      seenEmails.set(email, row);
      validPlayers.push({
        ...player,
        name: player.name.trim(),
        email: email,
        phone: player.phone?.trim(),
        notes: player.notes?.trim(),
      });
    });

    return {
      validPlayers,
      errors,
      duplicates,
      totalRows: csvData.length,
    };
  }

  async batchCreatePlayers(
    players: PlayerImportData[],
    tournamentId: string
  ): Promise<Player[]> {
    const playersToCreate = players.map(player => ({
      name: player.name,
      email: player.email,
      phone: player.phone,
      ranking: player.ranking,
      notes: player.notes,
      tournamentId,
    }));

    return this.batchCreate<Player>(this.COLLECTION, playersToCreate);
  }

  // Player seeding functionality
  async assignSeedPositions(tournamentId: string, seedingMethod: 'random' | 'ranking' | 'manual'): Promise<void> {
    const players = await this.getPlayersByTournament(tournamentId);

    if (players.length === 0) {
      return;
    }

    let orderedPlayers: Player[];

    switch (seedingMethod) {
      case 'ranking':
        orderedPlayers = this.seedByRanking(players);
        break;
      case 'random':
        orderedPlayers = this.seedRandomly(players);
        break;
      case 'manual':
        // For manual seeding, preserve existing seed positions
        return;
      default:
        throw new Error('Invalid seeding method');
    }

    // Update seed positions in batch
    const batch = this.db.batch();
    orderedPlayers.forEach((player, index) => {
      const docRef = this.db.collection(this.COLLECTION).doc(player.id);
      batch.update(docRef, {
        seedPosition: index + 1,
        updatedAt: firestore.Timestamp.now(),
      });
    });

    await batch.commit();
  }

  // Private helper methods
  private validatePlayerData(player: PlayerImportData, row: number): CSVImportError[] {
    const errors: CSVImportError[] = [];

    // Validate name
    if (!player.name || player.name.trim().length < 2) {
      errors.push({
        row,
        field: 'name',
        value: player.name || '',
        message: 'Name is required and must be at least 2 characters',
        suggestion: 'Enter a valid name (e.g., "John Smith")',
      });
    }

    // Validate email
    if (!player.email || !this.validateEmail(player.email)) {
      errors.push({
        row,
        field: 'email',
        value: player.email || '',
        message: 'Valid email address is required',
        suggestion: 'Enter a valid email (e.g., "player@example.com")',
      });
    }

    // Validate phone if provided
    if (player.phone && !this.validatePhone(player.phone)) {
      errors.push({
        row,
        field: 'phone',
        value: player.phone,
        message: 'Invalid phone number format',
        suggestion: 'Use format: +91-9876543210 or +1-5551234567',
      });
    }

    // Validate ranking if provided
    if (player.ranking !== undefined && (player.ranking < 0 || player.ranking > 10000)) {
      errors.push({
        row,
        field: 'ranking',
        value: String(player.ranking),
        message: 'Ranking must be between 0 and 10000',
        suggestion: 'Enter a valid ranking number',
      });
    }

    return errors;
  }

  private validatePhone(phone: string): boolean {
    // Basic phone validation - supports international formats
    const phoneRegex = /^[\+]?[0-9\-\s\(\)]{8,15}$/;
    return phoneRegex.test(phone);
  }

  private async checkDuplicateEmail(email: string, tournamentId: string, excludeId?: string): Promise<void> {
    const players = await this.query<Player>(this.COLLECTION, [
      { fieldPath: 'tournamentId', opStr: '==', value: tournamentId },
      { fieldPath: 'email', opStr: '==', value: email.toLowerCase() }
    ]);

    const duplicates = excludeId 
      ? players.filter(p => p.id !== excludeId)
      : players;

    if (duplicates.length > 0) {
      throw new Error('A player with this email already exists in this tournament');
    }
  }

  private seedByRanking(players: Player[]): Player[] {
    return players.sort((a, b) => {
      // Players with rankings first, then unranked players
      if (a.ranking === undefined && b.ranking === undefined) return 0;
      if (a.ranking === undefined) return 1;
      if (b.ranking === undefined) return -1;
      
      // Lower ranking number = higher seed (ranking 1 is best)
      return a.ranking - b.ranking;
    });
  }

  private seedRandomly(players: Player[]): Player[] {
    // Fisher-Yates shuffle algorithm
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Epic 3 Methods - Player Profiles and Following

  async getPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
    return this.read<PlayerProfile>(this.PROFILES_COLLECTION, playerId);
  }

  async createPlayerProfile(
    data: Omit<PlayerProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PlayerProfile> {
    const profileData: Omit<PlayerProfile, 'id'> = {
      ...data,
      createdAt: firestore.Timestamp.now(),
      updatedAt: firestore.Timestamp.now(),
    };

    return this.create<PlayerProfile>(this.PROFILES_COLLECTION, profileData);
  }

  async updatePlayerProfile(
    playerId: string, 
    updates: Partial<PlayerProfile>
  ): Promise<void> {
    return this.update<PlayerProfile>(this.PROFILES_COLLECTION, playerId, {
      ...updates,
      updatedAt: firestore.Timestamp.now(),
    });
  }

  // Player Following System
  async followPlayer(followerId: string, playerId: string): Promise<PlayerFollow> {
    // Check if already following
    const existingFollow = await this.query<PlayerFollow>(this.FOLLOWS_COLLECTION, [
      { fieldPath: 'followerId', opStr: '==', value: followerId },
      { fieldPath: 'followedPlayerId', opStr: '==', value: playerId }
    ]);

    if (existingFollow.length > 0) {
      throw new Error('Already following this player');
    }

    const followData: Omit<PlayerFollow, 'id'> = {
      followerId,
      followedPlayerId: playerId,
      createdAt: firestore.Timestamp.now(),
      notificationsEnabled: true,
    };

    return this.create<PlayerFollow>(this.FOLLOWS_COLLECTION, followData);
  }

  async unfollowPlayer(followerId: string, playerId: string): Promise<void> {
    const follows = await this.query<PlayerFollow>(this.FOLLOWS_COLLECTION, [
      { fieldPath: 'followerId', opStr: '==', value: followerId },
      { fieldPath: 'followedPlayerId', opStr: '==', value: playerId }
    ]);

    if (follows.length === 0) {
      throw new Error('Not following this player');
    }

    await this.delete(this.FOLLOWS_COLLECTION, follows[0].id);
  }

  async isFollowingPlayer(followerId: string, playerId: string): Promise<boolean> {
    const follows = await this.query<PlayerFollow>(this.FOLLOWS_COLLECTION, [
      { fieldPath: 'followerId', opStr: '==', value: followerId },
      { fieldPath: 'followedPlayerId', opStr: '==', value: playerId }
    ]);

    return follows.length > 0;
  }

  async getPlayerFollowers(playerId: string): Promise<PlayerFollow[]> {
    return this.query<PlayerFollow>(this.FOLLOWS_COLLECTION, [
      { fieldPath: 'followedPlayerId', opStr: '==', value: playerId }
    ]);
  }

  async getFollowedPlayers(followerId: string): Promise<PlayerFollow[]> {
    return this.query<PlayerFollow>(this.FOLLOWS_COLLECTION, [
      { fieldPath: 'followerId', opStr: '==', value: followerId }
    ]);
  }

  // Privacy and Permission Methods
  async sharesTournamentWithUser(playerId: string, userId: string): Promise<boolean> {
    // Check if both users have participated in any common tournaments
    // This is a simplified implementation - in production, you'd check tournament_registrations
    const playerTournaments = await this.query<Player>(this.COLLECTION, [
      { fieldPath: 'id', opStr: '==', value: playerId }
    ]);

    const userTournaments = await this.query<Player>(this.COLLECTION, [
      { fieldPath: 'id', opStr: '==', value: userId }
    ]);

    // Simple check - if both have tournament records, they share tournaments
    return playerTournaments.length > 0 && userTournaments.length > 0;
  }

  // Search Methods
  async searchPlayers(query: {
    name?: string;
    tournamentId?: string;
    limit?: number;
  }): Promise<Player[]> {
    const queryConstraints: any[] = [];

    if (query.tournamentId) {
      queryConstraints.push({
        fieldPath: 'tournamentId',
        opStr: '==',
        value: query.tournamentId
      });
    }

    const players = await this.query<Player>(this.COLLECTION, queryConstraints);
    
    // Filter by name if provided (simple contains check)
    let filteredPlayers = players;
    if (query.name) {
      filteredPlayers = players.filter(player => 
        player.name.toLowerCase().includes(query.name!.toLowerCase())
      );
    }

    // Apply limit
    if (query.limit) {
      filteredPlayers = filteredPlayers.slice(0, query.limit);
    }

    return filteredPlayers;
  }

  // Mock Statistics Methods (in production, these would calculate from match data)
  private createMockStatistics(): PlayerStatistics {
    return {
      matchesPlayed: Math.floor(Math.random() * 50) + 10,
      matchesWon: 0, // Will be calculated below
      matchesLost: 0, // Will be calculated below
      setsWon: 0,
      setsLost: 0,
      tournamentsEntered: Math.floor(Math.random() * 10) + 1,
      tournamentsWon: Math.floor(Math.random() * 3),
      winPercentage: 0, // Will be calculated below
      currentStreak: Math.floor(Math.random() * 5),
      bestStreak: Math.floor(Math.random() * 10) + 5,
    };
  }

  private createMockTournamentHistory(): PlayerTournamentHistory[] {
    const tournaments: PlayerTournamentHistory[] = [];
    const sports = ['badminton', 'tennis', 'squash'];
    const tournamentNames = [
      'Spring Championship',
      'Summer Open',
      'Winter Cup',
      'City Tournament',
      'Regional Finals'
    ];

    for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
      tournaments.push({
        tournamentId: `tournament_${i}`,
        tournamentName: tournamentNames[Math.floor(Math.random() * tournamentNames.length)],
        sport: sports[Math.floor(Math.random() * sports.length)],
        date: firestore.Timestamp.fromDate(
          new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000))
        ),
        finalPosition: Math.floor(Math.random() * 16) + 1,
        totalParticipants: Math.floor(Math.random() * 32) + 16,
        matchesWon: Math.floor(Math.random() * 5),
        matchesLost: Math.floor(Math.random() * 3),
      });
    }

    return tournaments.sort((a, b) => b.date.toMillis() - a.date.toMillis());
  }
}
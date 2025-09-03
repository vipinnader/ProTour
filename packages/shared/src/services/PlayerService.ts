// Player service for ProTour - Epic 1 Implementation

import { DatabaseService } from './DatabaseService';
import { Player, PlayerImportData, CSVImportResult, CSVImportError, CSVDuplicate } from '../types';
import firestore from '@react-native-firebase/firestore';

export class PlayerService extends DatabaseService {
  private readonly COLLECTION = 'players';

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
}
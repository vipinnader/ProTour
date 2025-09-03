// Player Service Tests - Epic 1 Story 1.1 Implementation

import { PlayerService } from '../../src/services/PlayerService';
import { Player, PlayerImportData, CSVImportResult } from '../../src/types';

// Firebase Firestore is mocked in setup.ts

describe('PlayerService', () => {
  let playerService: PlayerService;
  let mockDb: any;
  let mockCollection: any;
  let mockDoc: any;
  let mockBatch: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDoc = {
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      set: jest.fn(),
    };

    mockCollection = {
      add: jest.fn(),
      doc: jest.fn(() => mockDoc),
      where: jest.fn(() => ({
        get: jest.fn(),
        where: jest.fn(() => ({
          get: jest.fn(),
        })),
      })),
      get: jest.fn(),
    };

    mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(),
    };

    mockDb = {
      collection: jest.fn(() => mockCollection),
      batch: jest.fn(() => mockBatch),
    };

    playerService = new PlayerService();
    (playerService as any).db = mockDb;
  });

  describe('createPlayer', () => {
    const validPlayerData = {
      name: 'John Smith',
      email: 'john@example.com',
      phone: '+1-555-0123',
      ranking: 1500,
      notes: 'Previous champion',
      tournamentId: 'tournament-123',
    };

    it('should create a player with valid data', async () => {
      const mockPlayerId = 'player-123';
      mockCollection.add.mockResolvedValue({ id: mockPlayerId });
      
      // Mock duplicate check query
      mockCollection.where.mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      });

      const result = await playerService.createPlayer(validPlayerData);

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Smith',
          email: 'john@example.com',
          phone: '+1-555-0123',
          ranking: 1500,
          notes: 'Previous champion',
          tournamentId: 'tournament-123',
        })
      );

      expect(result.id).toBe(mockPlayerId);
      expect(result.name).toBe('John Smith');
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validPlayerData, name: '' };

      await expect(
        playerService.createPlayer(invalidData)
      ).rejects.toThrow('Missing required fields');
    });

    it('should validate email format', async () => {
      const invalidData = { ...validPlayerData, email: 'invalid-email' };

      await expect(
        playerService.createPlayer(invalidData)
      ).rejects.toThrow('Invalid email format');
    });

    it('should validate name length', async () => {
      const invalidData = { ...validPlayerData, name: 'A' };

      await expect(
        playerService.createPlayer(invalidData)
      ).rejects.toThrow('Player name must be at least 2 characters');
    });

    it('should check for duplicate emails', async () => {
      // Mock existing player with same email
      mockCollection.where.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          docs: [{ id: 'existing-player', data: () => ({ email: validPlayerData.email }) }],
        }),
      });

      await expect(
        playerService.createPlayer(validPlayerData)
      ).rejects.toThrow('A player with this email already exists in this tournament');
    });

    it('should trim and normalize data', async () => {
      const dataWithWhitespace = {
        ...validPlayerData,
        name: '  John Smith  ',
        email: '  JOHN@EXAMPLE.COM  ',
        phone: '  +1-555-0123  ',
        notes: '  Previous champion  ',
      };

      mockCollection.add.mockResolvedValue({ id: 'player-123' });
      mockCollection.where.mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      });

      await playerService.createPlayer(dataWithWhitespace);

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Smith',
          email: 'john@example.com',
          phone: '+1-555-0123',
          notes: 'Previous champion',
        })
      );
    });
  });

  describe('getPlayer', () => {
    const playerId = 'player-123';

    it('should retrieve existing player', async () => {
      const mockPlayerData = {
        id: playerId,
        name: 'John Smith',
        email: 'john@example.com',
        tournamentId: 'tournament-123',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: playerId,
        data: () => mockPlayerData,
      });

      const result = await playerService.getPlayer(playerId);

      expect(result).toEqual({ ...mockPlayerData, id: playerId });
    });

    it('should return null for non-existent player', async () => {
      mockDoc.get.mockResolvedValue({ exists: false });

      const result = await playerService.getPlayer(playerId);

      expect(result).toBeNull();
    });
  });

  describe('updatePlayer', () => {
    const playerId = 'player-123';

    it('should update player with valid data', async () => {
      const updates = { name: 'Jane Smith' };
      mockDoc.update.mockResolvedValue({});

      await playerService.updatePlayer(playerId, updates);

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updatedAt: expect.any(Object),
        })
      );
    });

    it('should validate email format on update', async () => {
      const updates = { email: 'invalid-email' };

      await expect(
        playerService.updatePlayer(playerId, updates)
      ).rejects.toThrow('Invalid email format');
    });

    it('should check for email conflicts on email update', async () => {
      const mockPlayer = {
        id: playerId,
        email: 'old@example.com',
        tournamentId: 'tournament-123',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: playerId,
        data: () => mockPlayer,
      });

      // Mock existing player with new email
      mockCollection.where.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          docs: [{ id: 'other-player', data: () => ({ email: 'new@example.com' }) }],
        }),
      });

      const updates = { email: 'new@example.com' };

      await expect(
        playerService.updatePlayer(playerId, updates)
      ).rejects.toThrow('A player with this email already exists in this tournament');
    });
  });

  describe('getPlayersByTournament', () => {
    const tournamentId = 'tournament-123';

    it('should retrieve all players for a tournament', async () => {
      const mockPlayers = [
        { id: 'player-1', name: 'John Smith', tournamentId },
        { id: 'player-2', name: 'Jane Doe', tournamentId },
      ];

      const mockQuery = {
        get: jest.fn().mockResolvedValue({
          docs: mockPlayers.map(p => ({
            id: p.id,
            data: () => p,
          })),
        }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      const result = await playerService.getPlayersByTournament(tournamentId);

      expect(result).toHaveLength(2);
      expect(result[0].tournamentId).toBe(tournamentId);
      expect(result[1].tournamentId).toBe(tournamentId);
    });
  });

  describe('CSV Import functionality', () => {
    const tournamentId = 'tournament-123';

    describe('importPlayersFromCSV', () => {
      it('should process valid CSV data', async () => {
        const csvData: PlayerImportData[] = [
          {
            name: 'John Smith',
            email: 'john@example.com',
            phone: '+1-555-0123',
            ranking: 1500,
            notes: 'Previous champion',
          },
          {
            name: 'Jane Doe',
            email: 'jane@example.com',
            ranking: 1200,
          },
        ];

        // Mock empty existing players
        const mockQuery = {
          get: jest.fn().mockResolvedValue({ docs: [] }),
        };
        mockCollection.where.mockReturnValue(mockQuery);

        const result = await playerService.importPlayersFromCSV(csvData, tournamentId);

        expect(result.validPlayers).toHaveLength(2);
        expect(result.errors).toHaveLength(0);
        expect(result.duplicates).toHaveLength(0);
        expect(result.totalRows).toBe(2);
      });

      it('should detect validation errors', async () => {
        const csvData: PlayerImportData[] = [
          {
            name: '', // Invalid: empty name
            email: 'john@example.com',
          },
          {
            name: 'Jane Doe',
            email: 'invalid-email', // Invalid: bad email format
          },
        ];

        const mockQuery = {
          get: jest.fn().mockResolvedValue({ docs: [] }),
        };
        mockCollection.where.mockReturnValue(mockQuery);

        const result = await playerService.importPlayersFromCSV(csvData, tournamentId);

        expect(result.validPlayers).toHaveLength(0);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].field).toBe('name');
        expect(result.errors[1].field).toBe('email');
      });

      it('should detect duplicates within CSV', async () => {
        const csvData: PlayerImportData[] = [
          {
            name: 'John Smith',
            email: 'john@example.com',
          },
          {
            name: 'John Smith Jr',
            email: 'john@example.com', // Duplicate email
          },
        ];

        const mockQuery = {
          get: jest.fn().mockResolvedValue({ docs: [] }),
        };
        mockCollection.where.mockReturnValue(mockQuery);

        const result = await playerService.importPlayersFromCSV(csvData, tournamentId);

        expect(result.validPlayers).toHaveLength(1);
        expect(result.duplicates).toHaveLength(1);
        expect(result.duplicates[0].conflictField).toBe('email');
      });

      it('should detect duplicates with existing players', async () => {
        const csvData: PlayerImportData[] = [
          {
            name: 'John Smith',
            email: 'existing@example.com',
          },
        ];

        // Mock existing player with same email
        const mockQuery = {
          get: jest.fn().mockResolvedValue({
            docs: [{
              id: 'existing-player',
              data: () => ({ email: 'existing@example.com' }),
            }],
          }),
        };
        mockCollection.where.mockReturnValue(mockQuery);

        const result = await playerService.importPlayersFromCSV(csvData, tournamentId);

        expect(result.validPlayers).toHaveLength(0);
        expect(result.duplicates).toHaveLength(1);
        expect(result.duplicates[0].existingRow).toBe(-1); // Indicates existing in database
      });

      it('should validate phone numbers', async () => {
        const csvData: PlayerImportData[] = [
          {
            name: 'John Smith',
            email: 'john@example.com',
            phone: 'invalid-phone',
          },
        ];

        const mockQuery = {
          get: jest.fn().mockResolvedValue({ docs: [] }),
        };
        mockCollection.where.mockReturnValue(mockQuery);

        const result = await playerService.importPlayersFromCSV(csvData, tournamentId);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('phone');
        expect(result.errors[0].suggestion).toContain('+91-9876543210');
      });

      it('should validate ranking range', async () => {
        const csvData: PlayerImportData[] = [
          {
            name: 'John Smith',
            email: 'john@example.com',
            ranking: -100, // Invalid: negative ranking
          },
          {
            name: 'Jane Doe',
            email: 'jane@example.com',
            ranking: 20000, // Invalid: too high
          },
        ];

        const mockQuery = {
          get: jest.fn().mockResolvedValue({ docs: [] }),
        };
        mockCollection.where.mockReturnValue(mockQuery);

        const result = await playerService.importPlayersFromCSV(csvData, tournamentId);

        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].field).toBe('ranking');
        expect(result.errors[1].field).toBe('ranking');
      });
    });

    describe('batchCreatePlayers', () => {
      it('should create multiple players in batch', async () => {
        const playersData: PlayerImportData[] = [
          { name: 'John Smith', email: 'john@example.com' },
          { name: 'Jane Doe', email: 'jane@example.com' },
        ];

        const expectedPlayers = [
          { id: 'player-1', name: 'John Smith', email: 'john@example.com', tournamentId },
          { id: 'player-2', name: 'Jane Doe', email: 'jane@example.com', tournamentId },
        ];

        // Mock the batchCreate method from DatabaseService
        const mockBatchCreate = jest.spyOn(playerService as any, 'batchCreate');
        mockBatchCreate.mockResolvedValue(expectedPlayers);

        const result = await playerService.batchCreatePlayers(playersData, tournamentId);

        expect(result).toHaveLength(2);
        expect(mockBatchCreate).toHaveBeenCalledWith('players', expect.any(Array));
        expect(result[0].tournamentId).toBe(tournamentId);
      });
    });
  });

  describe('Player seeding functionality', () => {
    const tournamentId = 'tournament-123';

    describe('assignSeedPositions', () => {
      const mockPlayers = [
        { id: 'player-1', name: 'John Smith', ranking: 1000, tournamentId },
        { id: 'player-2', name: 'Jane Doe', ranking: 1500, tournamentId },
        { id: 'player-3', name: 'Bob Wilson', ranking: undefined, tournamentId },
      ];

      beforeEach(() => {
        const mockQuery = {
          get: jest.fn().mockResolvedValue({
            docs: mockPlayers.map(p => ({ id: p.id, data: () => p })),
          }),
        };
        mockCollection.where.mockReturnValue(mockQuery);
      });

      it('should assign seed positions by ranking', async () => {
        mockBatch.commit.mockResolvedValue({});

        await playerService.assignSeedPositions(tournamentId, 'ranking');

        expect(mockBatch.update).toHaveBeenCalledTimes(3);
        // Lower ranking number gets higher seed (position 1)
        expect(mockBatch.update).toHaveBeenNthCalledWith(1, 
          expect.anything(), 
          expect.objectContaining({ seedPosition: 1 })
        );
      });

      it('should assign random seed positions', async () => {
        // Mock Math.random for predictable results
        const originalRandom = Math.random;
        Math.random = jest.fn()
          .mockReturnValueOnce(0.1)
          .mockReturnValueOnce(0.9)
          .mockReturnValueOnce(0.5);

        mockBatch.commit.mockResolvedValue({});

        await playerService.assignSeedPositions(tournamentId, 'random');

        expect(mockBatch.update).toHaveBeenCalledTimes(3);
        expect(mockBatch.commit).toHaveBeenCalled();

        // Restore original Math.random
        Math.random = originalRandom;
      });

      it('should skip manual seeding without changes', async () => {
        await playerService.assignSeedPositions(tournamentId, 'manual');

        expect(mockBatch.update).not.toHaveBeenCalled();
        expect(mockBatch.commit).not.toHaveBeenCalled();
      });

      it('should handle empty player list', async () => {
        const mockEmptyQuery = {
          get: jest.fn().mockResolvedValue({ docs: [] }),
        };
        mockCollection.where.mockReturnValue(mockEmptyQuery);

        await playerService.assignSeedPositions(tournamentId, 'ranking');

        expect(mockBatch.update).not.toHaveBeenCalled();
      });

      it('should throw error for invalid seeding method', async () => {
        await expect(
          playerService.assignSeedPositions(tournamentId, 'invalid' as any)
        ).rejects.toThrow('Invalid seeding method');
      });
    });
  });

  describe('deletePlayersByTournament', () => {
    const tournamentId = 'tournament-123';

    it('should delete all players for a tournament', async () => {
      const mockPlayers = [
        { id: 'player-1', tournamentId },
        { id: 'player-2', tournamentId },
      ];

      // Mock getPlayersByTournament
      const mockQuery = {
        get: jest.fn().mockResolvedValue({
          docs: mockPlayers.map(p => ({ id: p.id, data: () => p })),
        }),
      };
      mockCollection.where.mockReturnValue(mockQuery);

      mockBatch.commit.mockResolvedValue({});

      await playerService.deletePlayersByTournament(tournamentId);

      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle empty player list', async () => {
      const mockEmptyQuery = {
        get: jest.fn().mockResolvedValue({ docs: [] }),
      };
      mockCollection.where.mockReturnValue(mockEmptyQuery);

      await playerService.deletePlayersByTournament(tournamentId);

      expect(mockBatch.delete).not.toHaveBeenCalled();
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });
  });
});
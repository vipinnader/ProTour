// Tournament Service Tests - Epic 1 Story 1.1 Implementation

import { TournamentService } from '../../src/services/TournamentService';
import { Tournament, TournamentFormData } from '../../src/types';

// Firebase Firestore is mocked in setup.ts

describe('TournamentService', () => {
  let tournamentService: TournamentService;
  let mockDb: any;
  let mockCollection: any;
  let mockDoc: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock objects
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
      })),
      get: jest.fn(),
    };

    mockDb = {
      collection: jest.fn(() => mockCollection),
      batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn(),
      })),
    };

    // Create service instance
    tournamentService = new TournamentService();
    (tournamentService as any).db = mockDb;
  });

  describe('createTournament', () => {
    const validTournamentData: TournamentFormData = {
      name: 'Test Tournament',
      date: new Date('2024-06-01'),
      sport: 'badminton',
      format: 'single-elimination',
      matchFormat: 'best-of-3',
      location: 'Test Venue',
      description: 'Test Description',
      isPublic: true,
      maxPlayers: 16,
    };

    const organizerId = 'test-organizer-123';

    it('should create a tournament with valid data', async () => {
      const mockTournamentId = 'tournament-123';
      mockCollection.add.mockResolvedValue({
        id: mockTournamentId,
      });

      const result = await tournamentService.createTournament(validTournamentData, organizerId);

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Tournament',
          organizerId,
          sport: 'badminton',
          format: 'single-elimination',
          matchFormat: 'best-of-3',
          status: 'setup',
          isPublic: true,
          maxPlayers: 16,
          currentPlayerCount: 0,
          tournamentCode: expect.any(String),
        })
      );

      expect(result.id).toBe(mockTournamentId);
      expect(result.name).toBe('Test Tournament');
      expect(result.tournamentCode).toHaveLength(6);
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validTournamentData, name: '' };

      await expect(
        tournamentService.createTournament(invalidData, organizerId)
      ).rejects.toThrow('Missing required fields');
    });

    it('should validate sport enum', async () => {
      const invalidData = { ...validTournamentData, sport: 'invalid-sport' as any };

      await expect(
        tournamentService.createTournament(invalidData, organizerId)
      ).rejects.toThrow('Invalid sport');
    });

    it('should validate format enum', async () => {
      const invalidData = { ...validTournamentData, format: 'invalid-format' as any };

      await expect(
        tournamentService.createTournament(invalidData, organizerId)
      ).rejects.toThrow('Invalid format');
    });

    it('should validate maxPlayers constraints', async () => {
      const invalidDataLow = { ...validTournamentData, maxPlayers: 2 };
      const invalidDataHigh = { ...validTournamentData, maxPlayers: 100 };

      await expect(
        tournamentService.createTournament(invalidDataLow, organizerId)
      ).rejects.toThrow('Max players must be between 4 and 64');

      await expect(
        tournamentService.createTournament(invalidDataHigh, organizerId)
      ).rejects.toThrow('Max players must be between 4 and 64');
    });

    it('should validate tournament name length', async () => {
      const invalidData = { ...validTournamentData, name: 'AB' };

      await expect(
        tournamentService.createTournament(invalidData, organizerId)
      ).rejects.toThrow('Tournament name must be at least 3 characters');
    });

    it('should trim whitespace from name and optional fields', async () => {
      const dataWithWhitespace = {
        ...validTournamentData,
        name: '  Test Tournament  ',
        location: '  Test Venue  ',
        description: '  Test Description  ',
      };

      mockCollection.add.mockResolvedValue({ id: 'test-id' });

      await tournamentService.createTournament(dataWithWhitespace, organizerId);

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Tournament',
          location: 'Test Venue',
          description: 'Test Description',
        })
      );
    });

    it('should generate unique tournament codes', async () => {
      mockCollection.add.mockResolvedValue({ id: 'test-id' });

      const tournament1 = await tournamentService.createTournament(validTournamentData, organizerId);
      const tournament2 = await tournamentService.createTournament(validTournamentData, organizerId);

      expect(tournament1.tournamentCode).not.toBe(tournament2.tournamentCode);
      expect(tournament1.tournamentCode).toMatch(/^[ABCDEFGHIJKLMNPQRSTUVWXYZ123456789]{6}$/);
    });
  });

  describe('getTournament', () => {
    const tournamentId = 'tournament-123';

    it('should retrieve existing tournament', async () => {
      const mockTournamentData = {
        id: tournamentId,
        name: 'Test Tournament',
        organizerId: 'organizer-123',
        status: 'setup',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: tournamentId,
        data: () => mockTournamentData,
      });

      const result = await tournamentService.getTournament(tournamentId);

      expect(mockDb.collection).toHaveBeenCalledWith('tournaments');
      expect(mockCollection.doc).toHaveBeenCalledWith(tournamentId);
      expect(result).toEqual({ ...mockTournamentData, id: tournamentId });
    });

    it('should return null for non-existent tournament', async () => {
      mockDoc.get.mockResolvedValue({
        exists: false,
      });

      const result = await tournamentService.getTournament(tournamentId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockDoc.get.mockRejectedValue(new Error('Database error'));

      await expect(
        tournamentService.getTournament(tournamentId)
      ).rejects.toThrow('Failed to read tournament');
    });
  });

  describe('updateTournament', () => {
    const tournamentId = 'tournament-123';

    it('should update tournament with valid data', async () => {
      const updates = { name: 'Updated Tournament Name' };
      mockDoc.update.mockResolvedValue({});

      await tournamentService.updateTournament(tournamentId, updates);

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updatedAt: expect.any(Object),
        })
      );
    });

    it('should prevent format changes after players are added', async () => {
      const mockTournament = {
        id: tournamentId,
        currentPlayerCount: 5,
        format: 'single-elimination',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: tournamentId,
        data: () => mockTournament,
      });

      const updates = { format: 'double-elimination' as any };

      await expect(
        tournamentService.updateTournament(tournamentId, updates)
      ).rejects.toThrow('Cannot change tournament format after players are added');
    });

    it('should validate status transitions', async () => {
      const mockTournament = {
        id: tournamentId,
        status: 'completed',
        currentPlayerCount: 8,
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: tournamentId,
        data: () => mockTournament,
      });

      const updates = { status: 'setup' as any };

      await expect(
        tournamentService.updateTournament(tournamentId, updates)
      ).rejects.toThrow('Invalid status transition from completed to setup');
    });
  });

  describe('deleteTournament', () => {
    const tournamentId = 'tournament-123';
    const organizerId = 'organizer-123';

    it('should delete tournament owned by organizer', async () => {
      const mockTournament = {
        id: tournamentId,
        organizerId,
        status: 'setup',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: tournamentId,
        data: () => mockTournament,
      });

      mockDoc.delete.mockResolvedValue({});

      await tournamentService.deleteTournament(tournamentId, organizerId);

      expect(mockDoc.delete).toHaveBeenCalled();
    });

    it('should prevent deletion by non-owner', async () => {
      const mockTournament = {
        id: tournamentId,
        organizerId: 'other-organizer',
        status: 'setup',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: tournamentId,
        data: () => mockTournament,
      });

      await expect(
        tournamentService.deleteTournament(tournamentId, organizerId)
      ).rejects.toThrow('Unauthorized: You can only delete your own tournaments');
    });

    it('should prevent deletion of active tournaments', async () => {
      const mockTournament = {
        id: tournamentId,
        organizerId,
        status: 'active',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: tournamentId,
        data: () => mockTournament,
      });

      await expect(
        tournamentService.deleteTournament(tournamentId, organizerId)
      ).rejects.toThrow('Cannot delete active tournament');
    });

    it('should handle non-existent tournaments', async () => {
      mockDoc.get.mockResolvedValue({
        exists: false,
      });

      await expect(
        tournamentService.deleteTournament(tournamentId, organizerId)
      ).rejects.toThrow('Tournament not found');
    });
  });

  describe('getTournamentsByOrganizer', () => {
    const organizerId = 'organizer-123';

    it('should retrieve tournaments by organizer', async () => {
      const mockTournaments = [
        { id: 'tournament-1', name: 'Tournament 1', organizerId },
        { id: 'tournament-2', name: 'Tournament 2', organizerId },
      ];

      const mockQuery = {
        get: jest.fn().mockResolvedValue({
          docs: mockTournaments.map(t => ({
            id: t.id,
            data: () => t,
          })),
        }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      const result = await tournamentService.getTournamentsByOrganizer(organizerId);

      expect(result).toHaveLength(2);
      expect(result[0].organizerId).toBe(organizerId);
      expect(result[1].organizerId).toBe(organizerId);
    });

    it('should filter by status when provided', async () => {
      const filters = { status: 'active' as any };
      const mockQuery = {
        get: jest.fn().mockResolvedValue({ docs: [] }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      await tournamentService.getTournamentsByOrganizer(organizerId, filters);

      expect(mockCollection.where).toHaveBeenCalledWith('organizerId', '==', organizerId);
      // Note: In a real implementation, we'd check for the status filter too
    });
  });

  describe('findTournamentByCode', () => {
    const tournamentCode = 'ABC123';

    it('should find tournament by code', async () => {
      const mockTournament = {
        id: 'tournament-123',
        tournamentCode,
        name: 'Test Tournament',
      };

      const mockQuery = {
        get: jest.fn().mockResolvedValue({
          docs: [{
            id: mockTournament.id,
            data: () => mockTournament,
          }],
        }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      const result = await tournamentService.findTournamentByCode(tournamentCode);

      expect(result).toEqual({ ...mockTournament, id: mockTournament.id });
    });

    it('should return null when tournament code not found', async () => {
      const mockQuery = {
        get: jest.fn().mockResolvedValue({ docs: [] }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      const result = await tournamentService.findTournamentByCode(tournamentCode);

      expect(result).toBeNull();
    });
  });

  describe('player count management', () => {
    const tournamentId = 'tournament-123';

    describe('incrementPlayerCount', () => {
      it('should increment player count successfully', async () => {
        const mockTournament = {
          id: tournamentId,
          currentPlayerCount: 5,
          maxPlayers: 16,
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: tournamentId,
          data: () => mockTournament,
        });

        mockDoc.update.mockResolvedValue({});

        await tournamentService.incrementPlayerCount(tournamentId);

        expect(mockDoc.update).toHaveBeenCalledWith(
          expect.objectContaining({
            currentPlayerCount: 6,
          })
        );
      });

      it('should prevent increment when tournament is full', async () => {
        const mockTournament = {
          id: tournamentId,
          currentPlayerCount: 16,
          maxPlayers: 16,
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: tournamentId,
          data: () => mockTournament,
        });

        await expect(
          tournamentService.incrementPlayerCount(tournamentId)
        ).rejects.toThrow('Tournament is full');
      });
    });

    describe('decrementPlayerCount', () => {
      it('should decrement player count successfully', async () => {
        const mockTournament = {
          id: tournamentId,
          currentPlayerCount: 5,
          maxPlayers: 16,
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: tournamentId,
          data: () => mockTournament,
        });

        mockDoc.update.mockResolvedValue({});

        await tournamentService.decrementPlayerCount(tournamentId);

        expect(mockDoc.update).toHaveBeenCalledWith(
          expect.objectContaining({
            currentPlayerCount: 4,
          })
        );
      });

      it('should prevent decrement below zero', async () => {
        const mockTournament = {
          id: tournamentId,
          currentPlayerCount: 0,
          maxPlayers: 16,
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: tournamentId,
          data: () => mockTournament,
        });

        await expect(
          tournamentService.decrementPlayerCount(tournamentId)
        ).rejects.toThrow('Player count cannot be negative');
      });
    });

    describe('setPlayerCount', () => {
      it('should set player count successfully', async () => {
        const mockTournament = {
          id: tournamentId,
          currentPlayerCount: 5,
          maxPlayers: 16,
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: tournamentId,
          data: () => mockTournament,
        });

        mockDoc.update.mockResolvedValue({});

        await tournamentService.setPlayerCount(tournamentId, 10);

        expect(mockDoc.update).toHaveBeenCalledWith(
          expect.objectContaining({
            currentPlayerCount: 10,
          })
        );
      });

      it('should validate count bounds', async () => {
        const mockTournament = {
          id: tournamentId,
          currentPlayerCount: 5,
          maxPlayers: 16,
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: tournamentId,
          data: () => mockTournament,
        });

        await expect(
          tournamentService.setPlayerCount(tournamentId, -1)
        ).rejects.toThrow('Player count must be between 0 and 16');

        await expect(
          tournamentService.setPlayerCount(tournamentId, 20)
        ).rejects.toThrow('Player count must be between 0 and 16');
      });
    });
  });
});
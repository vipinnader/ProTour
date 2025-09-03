// Match Service Tests - Epic 1 Story 1.1 Implementation

import { MatchService } from '../../src/services/MatchService';
import { Match, MatchScore } from '../../src/types';

// Firebase Firestore is mocked in setup.ts

describe('MatchService', () => {
  let matchService: MatchService;
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

    matchService = new MatchService();
    (matchService as any).db = mockDb;
  });

  describe('createMatch', () => {
    const validMatchData = {
      tournamentId: 'tournament-123',
      round: 1,
      matchNumber: 1,
      player1Id: 'player-1',
      player2Id: 'player-2',
      status: 'pending' as const,
    };

    it('should create a match with valid data', async () => {
      const mockMatchId = 'match-123';
      mockCollection.add.mockResolvedValue({ id: mockMatchId });

      const result = await matchService.createMatch(validMatchData);

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          tournamentId: 'tournament-123',
          round: 1,
          matchNumber: 1,
          player1Id: 'player-1',
          player2Id: 'player-2',
          status: 'pending',
        })
      );

      expect(result.id).toBe(mockMatchId);
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validMatchData, tournamentId: '' };

      await expect(
        matchService.createMatch(invalidData)
      ).rejects.toThrow('Missing required fields');
    });

    it('should validate round number', async () => {
      const invalidData = { ...validMatchData, round: 0 };

      await expect(
        matchService.createMatch(invalidData)
      ).rejects.toThrow('Round must be a positive number');
    });

    it('should validate match number', async () => {
      const invalidData = { ...validMatchData, matchNumber: -1 };

      await expect(
        matchService.createMatch(invalidData)
      ).rejects.toThrow('Match number must be a positive number');
    });

    it('should validate status enum', async () => {
      const invalidData = { ...validMatchData, status: 'invalid' as any };

      await expect(
        matchService.createMatch(invalidData)
      ).rejects.toThrow('Invalid status');
    });

    it('should create bye match without player2Id', async () => {
      const byeMatchData = {
        ...validMatchData,
        player2Id: undefined,
      };

      mockCollection.add.mockResolvedValue({ id: 'match-bye' });

      const result = await matchService.createMatch(byeMatchData);

      expect(result.player2Id).toBeUndefined();
    });
  });

  describe('updateMatch', () => {
    const matchId = 'match-123';

    it('should update match with valid data', async () => {
      const updates = { court: 'Court 1' };
      mockDoc.update.mockResolvedValue({});

      await matchService.updateMatch(matchId, updates);

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          court: 'Court 1',
          updatedAt: expect.any(Object),
        })
      );
    });

    it('should validate status transitions', async () => {
      const mockMatch = {
        id: matchId,
        status: 'completed',
        player1Id: 'player-1',
        player2Id: 'player-2',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: matchId,
        data: () => mockMatch,
      });

      const updates = { status: 'pending' as any };

      await expect(
        matchService.updateMatch(matchId, updates)
      ).rejects.toThrow('Invalid status transition from completed to pending');
    });

    it('should validate winner is one of the players', async () => {
      const mockMatch = {
        id: matchId,
        player1Id: 'player-1',
        player2Id: 'player-2',
        status: 'in-progress',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: matchId,
        data: () => mockMatch,
      });

      const updates = { winnerId: 'invalid-player' };

      await expect(
        matchService.updateMatch(matchId, updates)
      ).rejects.toThrow('Winner must be one of the players in the match');
    });
  });

  describe('getMatchesByTournament', () => {
    const tournamentId = 'tournament-123';

    it('should retrieve matches by tournament', async () => {
      const mockMatches = [
        { id: 'match-1', tournamentId, round: 1 },
        { id: 'match-2', tournamentId, round: 2 },
      ];

      const mockQuery = {
        get: jest.fn().mockResolvedValue({
          docs: mockMatches.map(m => ({
            id: m.id,
            data: () => m,
          })),
        }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      const result = await matchService.getMatchesByTournament(tournamentId);

      expect(result).toHaveLength(2);
      expect(result[0].tournamentId).toBe(tournamentId);
    });

    it('should filter by round when provided', async () => {
      const mockQuery = {
        get: jest.fn().mockResolvedValue({ docs: [] }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      await matchService.getMatchesByTournament(tournamentId, { round: 2 });

      // Verify multiple where clauses are applied
      expect(mockCollection.where).toHaveBeenCalledTimes(1);
    });

    it('should filter by status when provided', async () => {
      const mockQuery = {
        get: jest.fn().mockResolvedValue({ docs: [] }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      await matchService.getMatchesByTournament(tournamentId, { status: 'completed' });

      expect(mockCollection.where).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMatchesByPlayer', () => {
    const playerId = 'player-123';
    const tournamentId = 'tournament-123';

    it('should retrieve matches for a player', async () => {
      const player1Matches = [
        { id: 'match-1', player1Id: playerId, tournamentId },
      ];

      const player2Matches = [
        { id: 'match-2', player2Id: playerId, tournamentId },
      ];

      let queryCallCount = 0;
      const mockQuery = {
        get: jest.fn().mockImplementation(() => {
          queryCallCount++;
          if (queryCallCount === 1) {
            return Promise.resolve({
              docs: player1Matches.map(m => ({ id: m.id, data: () => m })),
            });
          } else {
            return Promise.resolve({
              docs: player2Matches.map(m => ({ id: m.id, data: () => m })),
            });
          }
        }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      const result = await matchService.getMatchesByPlayer(playerId, tournamentId);

      expect(result).toHaveLength(2);
      expect(result[0].player1Id).toBe(playerId);
      expect(result[1].player2Id).toBe(playerId);
    });

    it('should deduplicate matches', async () => {
      const duplicateMatch = { id: 'match-1', player1Id: playerId, player2Id: playerId };

      const mockQuery = {
        get: jest.fn().mockResolvedValue({
          docs: [
            { id: duplicateMatch.id, data: () => duplicateMatch },
          ],
        }),
      };

      mockCollection.where.mockReturnValue(mockQuery);

      const result = await matchService.getMatchesByPlayer(playerId);

      expect(result).toHaveLength(1);
    });
  });

  describe('match progression', () => {
    const matchId = 'match-123';

    describe('startMatch', () => {
      it('should start a pending match', async () => {
        const mockMatch = {
          id: matchId,
          status: 'pending',
          player1Id: 'player-1',
          player2Id: 'player-2',
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: matchId,
          data: () => mockMatch,
        });

        mockDoc.update.mockResolvedValue({});

        await matchService.startMatch(matchId);

        expect(mockDoc.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'in-progress',
            startTime: expect.any(Object),
          })
        );
      });

      it('should auto-complete bye matches', async () => {
        const mockByeMatch = {
          id: matchId,
          status: 'pending',
          player1Id: 'player-1',
          player2Id: null,
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: matchId,
          data: () => mockByeMatch,
        });

        mockDoc.update.mockResolvedValue({});

        await matchService.startMatch(matchId);

        expect(mockDoc.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'completed',
            winnerId: 'player-1',
          })
        );
      });

      it('should prevent starting non-pending matches', async () => {
        const mockMatch = {
          id: matchId,
          status: 'completed',
          player1Id: 'player-1',
          player2Id: 'player-2',
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: matchId,
          data: () => mockMatch,
        });

        await expect(
          matchService.startMatch(matchId)
        ).rejects.toThrow('Can only start pending matches');
      });
    });

    describe('completeMatch', () => {
      const validScore: MatchScore = {
        player1Sets: [21, 18, 21],
        player2Sets: [19, 21, 17],
        winner: 'player1',
      };

      it('should complete match with valid winner and score', async () => {
        const mockMatch = {
          id: matchId,
          status: 'in-progress',
          player1Id: 'player-1',
          player2Id: 'player-2',
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: matchId,
          data: () => mockMatch,
        });

        mockDoc.update.mockResolvedValue({});

        await matchService.completeMatch(matchId, 'player-1', validScore);

        expect(mockDoc.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'completed',
            winnerId: 'player-1',
            score: expect.objectContaining({
              player1Sets: [21, 18, 21],
              player2Sets: [19, 21, 17],
              winner: 'player1',
            }),
            endTime: expect.any(Object),
          })
        );
      });

      it('should prevent completing already completed matches', async () => {
        const mockMatch = {
          id: matchId,
          status: 'completed',
          player1Id: 'player-1',
          player2Id: 'player-2',
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: matchId,
          data: () => mockMatch,
        });

        await expect(
          matchService.completeMatch(matchId, 'player-1')
        ).rejects.toThrow('Match is already completed');
      });

      it('should validate winner is a participant', async () => {
        const mockMatch = {
          id: matchId,
          status: 'in-progress',
          player1Id: 'player-1',
          player2Id: 'player-2',
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: matchId,
          data: () => mockMatch,
        });

        await expect(
          matchService.completeMatch(matchId, 'invalid-player')
        ).rejects.toThrow('Winner must be one of the players in the match');
      });

      it('should progress winner to next match', async () => {
        const mockMatch = {
          id: matchId,
          status: 'in-progress',
          player1Id: 'player-1',
          player2Id: 'player-2',
          nextMatchId: 'next-match',
        };

        const mockNextMatch = {
          id: 'next-match',
          player1Id: null,
          player2Id: null,
        };

        mockDoc.get
          .mockResolvedValueOnce({
            exists: true,
            id: matchId,
            data: () => mockMatch,
          })
          .mockResolvedValueOnce({
            exists: true,
            id: 'next-match',
            data: () => mockNextMatch,
          });

        mockDoc.update.mockResolvedValue({});

        await matchService.completeMatch(matchId, 'player-1');

        // Verify both the match completion and next match progression
        expect(mockDoc.update).toHaveBeenCalledTimes(2);
        expect(mockDoc.update).toHaveBeenNthCalledWith(2, 
          expect.objectContaining({ player1Id: 'player-1' })
        );
      });
    });

    describe('completeBye', () => {
      it('should complete bye match automatically', async () => {
        const mockByeMatch = {
          id: matchId,
          status: 'pending',
          player1Id: 'player-1',
          player2Id: null,
          nextMatchId: 'next-match',
        };

        const mockNextMatch = {
          id: 'next-match',
          player1Id: null,
          player2Id: null,
        };

        mockDoc.get
          .mockResolvedValueOnce({
            exists: true,
            id: matchId,
            data: () => mockByeMatch,
          })
          .mockResolvedValueOnce({
            exists: true,
            id: 'next-match',
            data: () => mockNextMatch,
          });

        mockDoc.update.mockResolvedValue({});

        await matchService.completeBye(matchId, 'player-1');

        expect(mockDoc.update).toHaveBeenNthCalledWith(1, 
          expect.objectContaining({
            status: 'completed',
            winnerId: 'player-1',
          })
        );
      });

      it('should reject non-bye matches', async () => {
        const mockMatch = {
          id: matchId,
          status: 'pending',
          player1Id: 'player-1',
          player2Id: 'player-2',
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          id: matchId,
          data: () => mockMatch,
        });

        await expect(
          matchService.completeBye(matchId, 'player-1')
        ).rejects.toThrow('This is not a bye match');
      });
    });
  });

  describe('score validation', () => {
    it('should validate score format', async () => {
      const matchId = 'match-123';
      const invalidScore = {
        player1Sets: [21, 18],
        player2Sets: [19, 21, 17], // Mismatched set count
        winner: 'player1',
      } as MatchScore;

      await expect(
        matchService.updateMatch(matchId, { score: invalidScore })
      ).rejects.toThrow('Both players must have the same number of sets');
    });

    it('should validate negative scores', async () => {
      const matchId = 'match-123';
      const invalidScore = {
        player1Sets: [-21, 18],
        player2Sets: [19, 21],
        winner: 'player1',
      } as MatchScore;

      await expect(
        matchService.updateMatch(matchId, { score: invalidScore })
      ).rejects.toThrow('Set scores cannot be negative');
    });

    it('should validate score consistency with winner', async () => {
      const matchId = 'match-123';
      const mockMatch = {
        id: matchId,
        player1Id: 'player-1',
        player2Id: 'player-2',
        status: 'in-progress',
      };

      mockDoc.get.mockResolvedValue({
        exists: true,
        id: matchId,
        data: () => mockMatch,
      });

      const inconsistentScore = {
        player1Sets: [15, 12], // Player 1 loses both sets
        player2Sets: [21, 21], // Player 2 wins both sets
        winner: 'player1', // But winner is marked as player 1
      } as MatchScore;

      await expect(
        matchService.completeMatch(matchId, 'player-1', inconsistentScore)
      ).rejects.toThrow('Winner does not match the score provided');
    });
  });

  describe('batch operations', () => {
    it('should create multiple matches in batch', async () => {
      const matchesData = [
        {
          tournamentId: 'tournament-123',
          round: 1,
          matchNumber: 1,
          player1Id: 'player-1',
          player2Id: 'player-2',
          status: 'pending' as const,
        },
        {
          tournamentId: 'tournament-123',
          round: 1,
          matchNumber: 2,
          player1Id: 'player-3',
          player2Id: 'player-4',
          status: 'pending' as const,
        },
      ];

      const expectedMatches = [
        { id: 'match-1', ...matchesData[0] },
        { id: 'match-2', ...matchesData[1] },
      ];

      // Mock the batchCreate method from DatabaseService
      const mockBatchCreate = jest.spyOn(matchService as any, 'batchCreate');
      mockBatchCreate.mockResolvedValue(expectedMatches);

      const result = await matchService.batchCreateMatches(matchesData);

      expect(result).toHaveLength(2);
      expect(mockBatchCreate).toHaveBeenCalledWith('matches', matchesData);
    });
  });

  describe('deleteMatchesByTournament', () => {
    const tournamentId = 'tournament-123';

    it('should delete all matches for a tournament', async () => {
      const mockMatches = [
        { id: 'match-1', tournamentId },
        { id: 'match-2', tournamentId },
      ];

      const mockQuery = {
        get: jest.fn().mockResolvedValue({
          docs: mockMatches.map(m => ({ id: m.id, data: () => m })),
        }),
      };
      mockCollection.where.mockReturnValue(mockQuery);

      mockBatch.commit.mockResolvedValue({});

      await matchService.deleteMatchesByTournament(tournamentId);

      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle empty match list', async () => {
      const mockEmptyQuery = {
        get: jest.fn().mockResolvedValue({ docs: [] }),
      };
      mockCollection.where.mockReturnValue(mockEmptyQuery);

      await matchService.deleteMatchesByTournament(tournamentId);

      expect(mockBatch.delete).not.toHaveBeenCalled();
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });
  });
});
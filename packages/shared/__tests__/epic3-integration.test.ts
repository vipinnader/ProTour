// Epic 3 Integration Tests - Multi-Role Tournament Experience

import {
  TournamentService,
  PlayerService,
  MatchService,
  NotificationService,
} from '../src/services';
import {
  Tournament,
  TournamentAccess,
  PlayerSchedule,
  PlayerProfile,
  Match,
  TournamentRegistration,
} from '../src/types';

// Mock Firebase Firestore
jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: () => ({
    collection: jest.fn(() => ({
      add: jest.fn(),
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })),
      where: jest.fn(() => ({
        get: jest.fn(),
      })),
    })),
  }),
  Timestamp: {
    now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
    fromDate: (date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    }),
  },
}));

describe('Epic 3: Multi-Role Tournament Experience', () => {
  let tournamentService: TournamentService;
  let playerService: PlayerService;
  let matchService: MatchService;
  let notificationService: NotificationService;

  beforeEach(() => {
    tournamentService = new TournamentService();
    playerService = new PlayerService();
    matchService = new MatchService();
    notificationService = new NotificationService();
  });

  describe('Story 3.1: Tournament Discovery & Registration', () => {
    it('should allow players to join tournament via access code', async () => {
      // Mock tournament data
      const mockTournament: Tournament = {
        id: 'tournament-123',
        name: 'Spring Championship',
        date: {
          toDate: () => new Date('2024-04-15'),
          toMillis: () => Date.now(),
        } as any,
        sport: 'badminton',
        format: 'single-elimination',
        matchFormat: 'best-of-3',
        organizerId: 'organizer-1',
        status: 'setup',
        isPublic: false,
        tournamentCode: 'ABC123',
        maxPlayers: 16,
        currentPlayerCount: 5,
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      };

      // Mock the database query to return our tournament
      jest
        .spyOn(tournamentService, 'findTournamentByCode')
        .mockResolvedValue(mockTournament);

      jest.spyOn(tournamentService, 'query').mockResolvedValue([]); // No existing access

      jest.spyOn(tournamentService, 'create').mockResolvedValue({
        id: 'access-123',
        tournamentId: mockTournament.id,
        accessCode: 'ABC123',
        userId: 'player-1',
        role: 'player',
        active: true,
        joinedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      });

      jest.spyOn(tournamentService, 'incrementPlayerCount').mockResolvedValue();

      // Test joining tournament
      const accessData: Omit<TournamentAccess, 'joinedAt'> = {
        tournamentId: mockTournament.id,
        accessCode: 'ABC123',
        userId: 'player-1',
        role: 'player',
        active: true,
      };

      const result = await tournamentService.joinTournament(accessData);

      expect(result.tournamentId).toBe(mockTournament.id);
      expect(result.userId).toBe('player-1');
      expect(result.role).toBe('player');
      expect(tournamentService.incrementPlayerCount).toHaveBeenCalledWith(
        mockTournament.id
      );
    });

    it('should reject joining when tournament is full', async () => {
      const mockTournament: Tournament = {
        id: 'tournament-123',
        name: 'Full Tournament',
        date: {
          toDate: () => new Date('2024-04-15'),
          toMillis: () => Date.now(),
        } as any,
        sport: 'badminton',
        format: 'single-elimination',
        matchFormat: 'best-of-3',
        organizerId: 'organizer-1',
        status: 'setup',
        isPublic: false,
        tournamentCode: 'FULL01',
        maxPlayers: 16,
        currentPlayerCount: 16, // Full tournament
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      };

      jest
        .spyOn(tournamentService, 'findTournamentByCode')
        .mockResolvedValue(mockTournament);

      jest.spyOn(tournamentService, 'query').mockResolvedValue([]);

      const accessData: Omit<TournamentAccess, 'joinedAt'> = {
        tournamentId: mockTournament.id,
        accessCode: 'FULL01',
        userId: 'player-1',
        role: 'player',
        active: true,
      };

      await expect(
        tournamentService.joinTournament(accessData)
      ).rejects.toThrow('Tournament is full');
    });
  });

  describe('Story 3.2: Player Schedule Management', () => {
    it('should generate personalized player schedule', async () => {
      const mockMatches: Match[] = [
        {
          id: 'match-1',
          tournamentId: 'tournament-123',
          round: 1,
          matchNumber: 1,
          player1Id: 'player-1',
          player2Id: 'player-2',
          status: 'pending',
          createdAt: {
            toDate: () => new Date(),
            toMillis: () => Date.now(),
          } as any,
          updatedAt: {
            toDate: () => new Date(),
            toMillis: () => Date.now(),
          } as any,
        },
        {
          id: 'match-2',
          tournamentId: 'tournament-123',
          round: 2,
          matchNumber: 1,
          player1Id: 'player-1',
          player2Id: 'player-3',
          winnerId: 'player-1',
          status: 'completed',
          createdAt: {
            toDate: () => new Date(),
            toMillis: () => Date.now(),
          } as any,
          updatedAt: {
            toDate: () => new Date(),
            toMillis: () => Date.now(),
          } as any,
        },
      ];

      jest.spyOn(tournamentService, 'query').mockResolvedValue(mockMatches);

      const schedule = await tournamentService.getPlayerSchedule(
        'player-1',
        'tournament-123'
      );

      expect(schedule.playerId).toBe('player-1');
      expect(schedule.tournamentId).toBe('tournament-123');
      expect(schedule.upcomingMatches).toHaveLength(1);
      expect(schedule.completedMatches).toHaveLength(1);
      expect(schedule.tournamentProgress.currentRound).toBe(2);
    });
  });

  describe('Story 3.4: Live Match Viewing', () => {
    it('should allow spectators to follow matches', async () => {
      const mockMatch: Match = {
        id: 'match-123',
        tournamentId: 'tournament-123',
        round: 1,
        matchNumber: 1,
        player1Id: 'player-1',
        player2Id: 'player-2',
        status: 'in-progress',
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      };

      jest.spyOn(matchService, 'query').mockResolvedValue([]);

      jest.spyOn(matchService, 'create').mockResolvedValue({
        id: 'follow-123',
        userId: 'spectator-1',
        matchId: 'match-123',
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      });

      await matchService.followMatch('spectator-1', 'match-123');

      expect(matchService.create).toHaveBeenCalled();
    });

    it('should create match timeline events', async () => {
      jest.spyOn(matchService, 'read').mockResolvedValue(null); // No existing timeline

      jest.spyOn(matchService, 'create').mockResolvedValue({
        id: 'timeline-123',
        matchId: 'match-123',
        events: [],
        duration: 0,
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      });

      jest.spyOn(matchService, 'update').mockResolvedValue();

      await matchService.addMatchEvent('match-123', {
        timestamp: new Date(),
        type: 'point-scored',
        details: {
          score: { player1Sets: [5], player2Sets: [3], winner: 'player1' },
        },
      });

      expect(matchService.create).toHaveBeenCalled();
      expect(matchService.update).toHaveBeenCalled();
    });
  });

  describe('Story 3.5: Player Profiles', () => {
    it('should create and retrieve player profiles', async () => {
      const mockProfile: PlayerProfile = {
        id: 'profile-123',
        userId: 'player-1',
        name: 'John Player',
        email: 'john@example.com',
        statistics: {
          matchesPlayed: 15,
          matchesWon: 12,
          matchesLost: 3,
          setsWon: 28,
          setsLost: 12,
          tournamentsEntered: 5,
          tournamentsWon: 2,
          winPercentage: 80,
          currentStreak: 3,
          bestStreak: 5,
        },
        tournaments: [],
        privacySettings: {
          showProfile: 'everyone',
          showStatistics: 'tournament-participants',
          showTournamentHistory: 'everyone',
          allowFollowing: true,
          allowNotifications: true,
        },
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      };

      jest.spyOn(playerService, 'read').mockResolvedValue(mockProfile);

      const profile = await playerService.getPlayerProfile('player-1');

      expect(profile).toBeDefined();
      expect(profile?.name).toBe('John Player');
      expect(profile?.statistics.winPercentage).toBe(80);
    });

    it('should allow players to follow other players', async () => {
      jest.spyOn(playerService, 'query').mockResolvedValue([]); // No existing follow

      jest.spyOn(playerService, 'create').mockResolvedValue({
        id: 'follow-123',
        followerId: 'player-1',
        followedPlayerId: 'player-2',
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        notificationsEnabled: true,
      });

      const result = await playerService.followPlayer('player-1', 'player-2');

      expect(result.followerId).toBe('player-1');
      expect(result.followedPlayerId).toBe('player-2');
      expect(result.notificationsEnabled).toBe(true);
    });
  });

  describe('Story 3.6: Push Notifications', () => {
    it('should schedule match ready notifications', async () => {
      const mockMatch: Match = {
        id: 'match-123',
        tournamentId: 'tournament-123',
        round: 1,
        matchNumber: 1,
        player1Id: 'player-1',
        player2Id: 'player-2',
        status: 'pending',
        startTime: {
          toDate: () => new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
          toMillis: () => Date.now() + 30 * 60 * 1000,
        } as any,
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      };

      const mockTournament: Tournament = {
        id: 'tournament-123',
        name: 'Test Tournament',
        date: {
          toDate: () => new Date('2024-04-15'),
          toMillis: () => Date.now(),
        } as any,
        sport: 'badminton',
        format: 'single-elimination',
        matchFormat: 'best-of-3',
        organizerId: 'organizer-1',
        status: 'active',
        isPublic: false,
        tournamentCode: 'TEST01',
        maxPlayers: 16,
        currentPlayerCount: 8,
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      };

      jest.spyOn(notificationService, 'query').mockResolvedValue([]); // No existing preferences, use defaults

      jest.spyOn(notificationService, 'create').mockResolvedValue({
        id: 'notification-123',
        config: {
          type: 'match-ready',
          title: '🎾 Match Starting Soon',
          body: 'Your Test Tournament match vs Player 2 starts in 30 minutes!',
          recipients: ['player-1', 'player-2'],
        },
        status: 'pending',
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      });

      await notificationService.notifyMatchReady(mockMatch, mockTournament, 30);

      expect(notificationService.create).toHaveBeenCalled();
    });

    it('should notify followers when match is completed', async () => {
      const mockMatch: Match = {
        id: 'match-123',
        tournamentId: 'tournament-123',
        round: 1,
        matchNumber: 1,
        player1Id: 'player-1',
        player2Id: 'player-2',
        winnerId: 'player-1',
        status: 'completed',
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      };

      const mockTournament: Tournament = {
        id: 'tournament-123',
        name: 'Test Tournament',
        date: {
          toDate: () => new Date('2024-04-15'),
          toMillis: () => Date.now(),
        } as any,
        sport: 'badminton',
        format: 'single-elimination',
        matchFormat: 'best-of-3',
        organizerId: 'organizer-1',
        status: 'active',
        isPublic: false,
        tournamentCode: 'TEST01',
        maxPlayers: 16,
        currentPlayerCount: 8,
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      };

      // Mock followers
      jest
        .spyOn(notificationService, 'query')
        .mockResolvedValueOnce([
          { userId: 'spectator-1', tournamentId: 'tournament-123' } as any,
        ])
        .mockResolvedValueOnce([]); // No notification preferences

      jest.spyOn(notificationService, 'create').mockResolvedValue({
        id: 'notification-124',
        config: {
          type: 'match-completed',
          title: '🏆 Match Completed',
          body: 'Player 1 defeated Player 2 in Test Tournament',
          recipients: ['player-1', 'player-2', 'spectator-1'],
        },
        status: 'pending',
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      });

      await notificationService.notifyMatchCompleted(
        mockMatch,
        mockTournament,
        'player-1'
      );

      expect(notificationService.create).toHaveBeenCalled();
    });
  });

  describe('Integration: Complete Tournament Flow', () => {
    it('should support end-to-end player experience', async () => {
      // 1. Player joins tournament
      const mockTournament: Tournament = {
        id: 'tournament-123',
        name: 'Integration Test Tournament',
        date: {
          toDate: () => new Date('2024-04-15'),
          toMillis: () => Date.now(),
        } as any,
        sport: 'badminton',
        format: 'single-elimination',
        matchFormat: 'best-of-3',
        organizerId: 'organizer-1',
        status: 'setup',
        isPublic: false,
        tournamentCode: 'INT123',
        maxPlayers: 16,
        currentPlayerCount: 7,
        createdAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
        updatedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      };

      // Mock tournament joining
      jest
        .spyOn(tournamentService, 'findTournamentByCode')
        .mockResolvedValue(mockTournament);
      jest.spyOn(tournamentService, 'query').mockResolvedValue([]);
      jest.spyOn(tournamentService, 'create').mockResolvedValue({
        id: 'access-123',
        tournamentId: mockTournament.id,
        accessCode: 'INT123',
        userId: 'player-1',
        role: 'player',
        active: true,
        joinedAt: {
          toDate: () => new Date(),
          toMillis: () => Date.now(),
        } as any,
      });
      jest.spyOn(tournamentService, 'incrementPlayerCount').mockResolvedValue();

      // Player joins
      await tournamentService.joinTournament({
        tournamentId: mockTournament.id,
        accessCode: 'INT123',
        userId: 'player-1',
        role: 'player',
        active: true,
      });

      // 2. Player views schedule
      const mockMatches: Match[] = [
        {
          id: 'match-1',
          tournamentId: 'tournament-123',
          round: 1,
          matchNumber: 1,
          player1Id: 'player-1',
          player2Id: 'player-2',
          status: 'pending',
          createdAt: {
            toDate: () => new Date(),
            toMillis: () => Date.now(),
          } as any,
          updatedAt: {
            toDate: () => new Date(),
            toMillis: () => Date.now(),
          } as any,
        },
      ];

      jest.spyOn(tournamentService, 'query').mockResolvedValue(mockMatches);

      const schedule = await tournamentService.getPlayerSchedule(
        'player-1',
        'tournament-123'
      );

      // Assertions
      expect(schedule.upcomingMatches).toHaveLength(1);
      expect(schedule.upcomingMatches[0].player1Id).toBe('player-1');
      expect(tournamentService.incrementPlayerCount).toHaveBeenCalledWith(
        mockTournament.id
      );
    });
  });
});

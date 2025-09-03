// Basic Player Profiles & Tournament Context Service - Epic 3 Story 3.5
import {
  PlayerProfile,
  PlayerStatistics,
  PlayerTournamentHistory,
  PlayerPrivacySettings,
  PlayerFollow,
  Tournament,
  Match,
  Timestamp,
} from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';

export interface PlayerSearchResult {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  statistics: {
    tournamentsPlayed: number;
    winPercentage: number;
    recentForm: 'excellent' | 'good' | 'average' | 'poor';
  };
  canViewProfile: boolean;
}

export interface PlayerComparison {
  player1: PlayerProfile;
  player2: PlayerProfile;
  headToHead: {
    totalMatches: number;
    player1Wins: number;
    player2Wins: number;
    lastMeeting?: {
      date: Date;
      tournament: string;
      winner: string;
      score?: string;
    };
  };
  comparison: {
    winPercentage: {
      player1: number;
      player2: number;
      advantage: 'player1' | 'player2' | 'equal';
    };
    tournamentsWon: {
      player1: number;
      player2: number;
      advantage: 'player1' | 'player2' | 'equal';
    };
    recentForm: {
      player1: number;
      player2: number;
      advantage: 'player1' | 'player2' | 'equal';
    };
  };
}

export class PlayerProfileService {
  private db: DatabaseService;
  private notificationService: NotificationService;

  constructor() {
    this.db = new DatabaseService();
    this.notificationService = new NotificationService();
  }

  /**
   * Get or create basic player profile
   * AC3.5.1: Basic player profiles (name, tournament history, statistics)
   */
  async getPlayerProfile(
    playerId: string,
    viewerId?: string
  ): Promise<PlayerProfile> {
    try {
      let profile = await this.db.getPlayerProfile(playerId);

      if (!profile) {
        // Create basic profile from user data
        const user = await this.db.getUser(playerId);
        if (!user) {
          throw new Error('User not found');
        }

        const statistics = await this.calculatePlayerStatistics(playerId);
        const tournaments = await this.getPlayerTournamentHistory(playerId);

        profile = {
          id: playerId,
          userId: playerId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profileImage: user.profileImage,
          statistics,
          tournaments,
          privacySettings: this.getDefaultPrivacySettings(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        await this.db.createPlayerProfile(profile);
      }

      // Check privacy settings if viewer is different from profile owner
      if (viewerId && viewerId !== playerId) {
        profile = await this.applyPrivacySettings(profile, viewerId);
      }

      return profile;
    } catch (error) {
      throw new Error(`Failed to get player profile: ${error.message}`);
    }
  }

  /**
   * Search for players
   * AC3.5.2: Player search functionality
   */
  async searchPlayers(
    query: string,
    filters?: {
      tournamentId?: string;
      sport?: string;
      minWinPercentage?: number;
      maxResults?: number;
    }
  ): Promise<PlayerSearchResult[]> {
    try {
      const searchResults = await this.db.searchPlayers(query, filters);
      const playerResults: PlayerSearchResult[] = [];

      for (const player of searchResults) {
        const profile = await this.getPlayerProfile(player.id);
        const recentForm = await this.calculateRecentForm(player.id);

        playerResults.push({
          id: player.id,
          name: player.name,
          email: player.email,
          profileImage: player.profileImage,
          statistics: {
            tournamentsPlayed: profile.statistics.tournamentsEntered,
            winPercentage: profile.statistics.winPercentage,
            recentForm,
          },
          canViewProfile: profile.privacySettings.showProfile === 'everyone',
        });
      }

      // Sort by relevance (name match, then win percentage)
      return playerResults
        .sort((a, b) => {
          const aNameMatch = a.name.toLowerCase().includes(query.toLowerCase())
            ? 1
            : 0;
          const bNameMatch = b.name.toLowerCase().includes(query.toLowerCase())
            ? 1
            : 0;

          if (aNameMatch !== bNameMatch) {
            return bNameMatch - aNameMatch; // Name matches first
          }

          return b.statistics.winPercentage - a.statistics.winPercentage; // Then by win percentage
        })
        .slice(0, filters?.maxResults || 20);
    } catch (error) {
      throw new Error(`Failed to search players: ${error.message}`);
    }
  }

  /**
   * Get tournament-specific player progress and results
   * AC3.5.3: Tournament-specific player progress and results
   */
  async getPlayerTournamentProgress(
    playerId: string,
    tournamentId: string
  ): Promise<{
    tournament: Tournament;
    progress: {
      currentRound: number;
      finalPosition?: number;
      matchesPlayed: number;
      matchesWon: number;
      matchesLost: number;
      setsWon: number;
      setsLost: number;
      pointsWon: number;
      pointsLost: number;
    };
    matches: Match[];
    ranking: {
      entryRanking?: number;
      seed?: number;
      finalRanking?: number;
    };
  }> {
    try {
      const tournament = await this.db.getTournament(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const matches = await this.db.getPlayerMatches(tournamentId, playerId);
      const playerTournamentData = await this.db.getPlayerTournamentData(
        tournamentId,
        playerId
      );

      // Calculate progress statistics
      const matchesWon = matches.filter(m => m.winnerId === playerId).length;
      const matchesLost = matches.filter(
        m => m.status === 'completed' && m.winnerId !== playerId
      ).length;

      let setsWon = 0,
        setsLost = 0,
        pointsWon = 0,
        pointsLost = 0;

      matches.forEach(match => {
        if (match.score) {
          const isPlayer1 = match.player1Id === playerId;
          const playerSets = isPlayer1
            ? match.score.player1Sets
            : match.score.player2Sets;
          const opponentSets = isPlayer1
            ? match.score.player2Sets
            : match.score.player1Sets;

          setsWon += playerSets.length;
          setsLost += opponentSets.length;
          pointsWon += playerSets.reduce((sum, set) => sum + set, 0);
          pointsLost += opponentSets.reduce((sum, set) => sum + set, 0);
        }
      });

      // Determine current round and final position
      const currentRound = await this.calculateCurrentRound(matches);
      const finalPosition =
        tournament.status === 'completed'
          ? await this.db.getPlayerFinalPosition(tournamentId, playerId)
          : undefined;

      return {
        tournament,
        progress: {
          currentRound,
          finalPosition,
          matchesPlayed: matches.length,
          matchesWon,
          matchesLost,
          setsWon,
          setsLost,
          pointsWon,
          pointsLost,
        },
        matches,
        ranking: {
          entryRanking: playerTournamentData?.ranking,
          seed: playerTournamentData?.seedPosition,
          finalRanking: finalPosition,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get tournament progress: ${error.message}`);
    }
  }

  /**
   * Compare two players and their head-to-head records
   * AC3.5.4: Player comparison and head-to-head records
   */
  async comparePlayersHeadToHead(
    player1Id: string,
    player2Id: string
  ): Promise<PlayerComparison> {
    try {
      const [player1Profile, player2Profile] = await Promise.all([
        this.getPlayerProfile(player1Id),
        this.getPlayerProfile(player2Id),
      ]);

      // Get head-to-head matches
      const headToHeadMatches = await this.db.getHeadToHeadMatches(
        player1Id,
        player2Id
      );

      const player1Wins = headToHeadMatches.filter(
        m => m.winnerId === player1Id
      ).length;
      const player2Wins = headToHeadMatches.filter(
        m => m.winnerId === player2Id
      ).length;

      // Get last meeting
      let lastMeeting;
      if (headToHeadMatches.length > 0) {
        const lastMatch = headToHeadMatches.sort(
          (a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()
        )[0];

        const tournament = await this.db.getTournament(lastMatch.tournamentId);
        const winner = await this.db.getUser(lastMatch.winnerId!);

        lastMeeting = {
          date: lastMatch.updatedAt.toDate(),
          tournament: tournament?.name || 'Unknown Tournament',
          winner: winner?.name || 'Unknown',
          score: this.formatMatchScore(lastMatch),
        };
      }

      // Calculate comparisons
      const comparison = {
        winPercentage: this.compareValues(
          player1Profile.statistics.winPercentage,
          player2Profile.statistics.winPercentage
        ),
        tournamentsWon: this.compareValues(
          player1Profile.statistics.tournamentsWon,
          player2Profile.statistics.tournamentsWon
        ),
        recentForm: this.compareValues(
          await this.getRecentFormScore(player1Id),
          await this.getRecentFormScore(player2Id)
        ),
      };

      return {
        player1: player1Profile,
        player2: player2Profile,
        headToHead: {
          totalMatches: headToHeadMatches.length,
          player1Wins,
          player2Wins,
          lastMeeting,
        },
        comparison,
      };
    } catch (error) {
      throw new Error(`Failed to compare players: ${error.message}`);
    }
  }

  /**
   * Follow a player for match notifications
   * AC3.5.5: Player follow functionality for match notifications
   */
  async followPlayer(
    followerId: string,
    followedPlayerId: string
  ): Promise<void> {
    try {
      // Check if already following
      const existingFollow = await this.db.getPlayerFollow(
        followerId,
        followedPlayerId
      );
      if (existingFollow) {
        throw new Error('Already following this player');
      }

      // Check privacy settings
      const followedProfile = await this.getPlayerProfile(followedPlayerId);
      if (!followedProfile.privacySettings.allowFollowing) {
        throw new Error('Player does not allow followers');
      }

      const follow: PlayerFollow = {
        id: this.generateId(),
        followerId,
        followedPlayerId,
        createdAt: Timestamp.now(),
        notificationsEnabled: true,
      };

      await this.db.createPlayerFollow(follow);

      // Send notification to followed player
      await this.notificationService.sendFollowNotification(followedPlayerId, {
        followerId,
        followerName: (await this.db.getUser(followerId))?.name || 'Unknown',
      });
    } catch (error) {
      throw new Error(`Failed to follow player: ${error.message}`);
    }
  }

  /**
   * Update player privacy settings
   * AC3.5.6: Privacy controls for profile visibility
   */
  async updatePrivacySettings(
    playerId: string,
    settings: Partial<PlayerPrivacySettings>
  ): Promise<void> {
    try {
      const profile = await this.getPlayerProfile(playerId);
      const updatedSettings = { ...profile.privacySettings, ...settings };

      await this.db.updatePlayerProfile(playerId, {
        privacySettings: updatedSettings,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      throw new Error(`Failed to update privacy settings: ${error.message}`);
    }
  }

  /**
   * Get player followers and following lists
   */
  async getPlayerConnections(playerId: string): Promise<{
    followers: { id: string; name: string; followedAt: Date }[];
    following: { id: string; name: string; followedAt: Date }[];
    stats: {
      followerCount: number;
      followingCount: number;
    };
  }> {
    try {
      const [followers, following] = await Promise.all([
        this.db.getPlayerFollowers(playerId),
        this.db.getPlayerFollowing(playerId),
      ]);

      const followerDetails = await Promise.all(
        followers.map(async follow => {
          const user = await this.db.getUser(follow.followerId);
          return {
            id: follow.followerId,
            name: user?.name || 'Unknown',
            followedAt: follow.createdAt.toDate(),
          };
        })
      );

      const followingDetails = await Promise.all(
        following.map(async follow => {
          const user = await this.db.getUser(follow.followedPlayerId);
          return {
            id: follow.followedPlayerId,
            name: user?.name || 'Unknown',
            followedAt: follow.createdAt.toDate(),
          };
        })
      );

      return {
        followers: followerDetails,
        following: followingDetails,
        stats: {
          followerCount: followers.length,
          followingCount: following.length,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get player connections: ${error.message}`);
    }
  }

  // Private helper methods

  private async calculatePlayerStatistics(
    playerId: string
  ): Promise<PlayerStatistics> {
    try {
      const matches = await this.db.getAllPlayerMatches(playerId);
      const completedMatches = matches.filter(m => m.status === 'completed');

      const matchesWon = completedMatches.filter(
        m => m.winnerId === playerId
      ).length;
      const matchesLost = completedMatches.length - matchesWon;

      let setsWon = 0,
        setsLost = 0;
      completedMatches.forEach(match => {
        if (match.score) {
          const isPlayer1 = match.player1Id === playerId;
          const playerSets = isPlayer1
            ? match.score.player1Sets
            : match.score.player2Sets;
          const opponentSets = isPlayer1
            ? match.score.player2Sets
            : match.score.player1Sets;

          setsWon += playerSets.length;
          setsLost += opponentSets.length;
        }
      });

      const tournaments = await this.db.getPlayerTournaments(playerId);
      const tournamentsWon = await this.db.getPlayerTournamentWins(playerId);

      const winPercentage =
        completedMatches.length > 0
          ? Math.round((matchesWon / completedMatches.length) * 100)
          : 0;

      // Calculate current streak
      const currentStreak = this.calculateCurrentStreak(
        completedMatches,
        playerId
      );
      const bestStreak = await this.calculateBestStreak(playerId);

      return {
        matchesPlayed: completedMatches.length,
        matchesWon,
        matchesLost,
        setsWon,
        setsLost,
        tournamentsEntered: tournaments.length,
        tournamentsWon: tournamentsWon.length,
        winPercentage,
        currentStreak,
        bestStreak,
      };
    } catch (error) {
      return {
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        setsWon: 0,
        setsLost: 0,
        tournamentsEntered: 0,
        tournamentsWon: 0,
        winPercentage: 0,
        currentStreak: 0,
        bestStreak: 0,
      };
    }
  }

  private async getPlayerTournamentHistory(
    playerId: string
  ): Promise<PlayerTournamentHistory[]> {
    try {
      const tournaments = await this.db.getPlayerCompletedTournaments(playerId);
      const history: PlayerTournamentHistory[] = [];

      for (const tournament of tournaments) {
        const matches = await this.db.getPlayerMatches(tournament.id, playerId);
        const finalPosition = await this.db.getPlayerFinalPosition(
          tournament.id,
          playerId
        );
        const totalParticipants = await this.db.getTournamentPlayerCount(
          tournament.id
        );

        const matchesWon = matches.filter(m => m.winnerId === playerId).length;
        const matchesLost = matches.filter(
          m => m.status === 'completed' && m.winnerId !== playerId
        ).length;

        history.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          sport: tournament.sport,
          date: tournament.date,
          finalPosition,
          totalParticipants,
          matchesWon,
          matchesLost,
        });
      }

      return history.sort((a, b) => b.date.toMillis() - a.date.toMillis());
    } catch (error) {
      return [];
    }
  }

  private getDefaultPrivacySettings(): PlayerPrivacySettings {
    return {
      showProfile: 'everyone',
      showStatistics: 'everyone',
      showTournamentHistory: 'everyone',
      allowFollowing: true,
      allowNotifications: true,
    };
  }

  private async applyPrivacySettings(
    profile: PlayerProfile,
    viewerId: string
  ): Promise<PlayerProfile> {
    const settings = profile.privacySettings;

    // Check if viewer can see the profile
    const canViewProfile = await this.checkPrivacyAccess(
      profile.id,
      viewerId,
      settings.showProfile
    );
    const canViewStats = await this.checkPrivacyAccess(
      profile.id,
      viewerId,
      settings.showStatistics
    );
    const canViewHistory = await this.checkPrivacyAccess(
      profile.id,
      viewerId,
      settings.showTournamentHistory
    );

    if (!canViewProfile) {
      throw new Error('Profile is private');
    }

    const filteredProfile = { ...profile };

    if (!canViewStats) {
      filteredProfile.statistics = {
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        setsWon: 0,
        setsLost: 0,
        tournamentsEntered: 0,
        tournamentsWon: 0,
        winPercentage: 0,
        currentStreak: 0,
        bestStreak: 0,
      };
    }

    if (!canViewHistory) {
      filteredProfile.tournaments = [];
    }

    return filteredProfile;
  }

  private async checkPrivacyAccess(
    profileId: string,
    viewerId: string,
    setting: 'everyone' | 'tournament-participants' | 'private'
  ): Promise<boolean> {
    switch (setting) {
      case 'everyone':
        return true;
      case 'private':
        return false;
      case 'tournament-participants':
        // Check if viewer has participated in tournaments with this player
        return await this.db.haveSharedTournaments(profileId, viewerId);
      default:
        return false;
    }
  }

  private async calculateRecentForm(
    playerId: string
  ): Promise<'excellent' | 'good' | 'average' | 'poor'> {
    const recentMatches = await this.db.getPlayerRecentMatches(playerId, 10);
    if (recentMatches.length === 0) return 'average';

    const wins = recentMatches.filter(m => m.winnerId === playerId).length;
    const winRate = wins / recentMatches.length;

    if (winRate >= 0.8) return 'excellent';
    if (winRate >= 0.6) return 'good';
    if (winRate >= 0.4) return 'average';
    return 'poor';
  }

  private async calculateCurrentRound(matches: Match[]): Promise<number> {
    const completedMatches = matches.filter(m => m.status === 'completed');
    if (completedMatches.length === 0) return 1;

    const lastCompletedMatch = completedMatches.sort(
      (a, b) => b.round - a.round
    )[0];

    return lastCompletedMatch.round + 1;
  }

  private calculateCurrentStreak(matches: Match[], playerId: string): number {
    const sortedMatches = matches.sort(
      (a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()
    );

    let streak = 0;
    let lastResult: 'win' | 'loss' | null = null;

    for (const match of sortedMatches) {
      const isWin = match.winnerId === playerId;
      const currentResult = isWin ? 'win' : 'loss';

      if (lastResult === null) {
        lastResult = currentResult;
        streak = 1;
      } else if (lastResult === currentResult) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private async calculateBestStreak(playerId: string): Promise<number> {
    const matches = await this.db.getAllPlayerMatches(playerId);
    const completedMatches = matches
      .filter(m => m.status === 'completed')
      .sort((a, b) => a.updatedAt.toMillis() - b.updatedAt.toMillis());

    let bestStreak = 0;
    let currentStreak = 0;

    for (const match of completedMatches) {
      if (match.winnerId === playerId) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return bestStreak;
  }

  private compareValues(
    value1: number,
    value2: number
  ): {
    player1: number;
    player2: number;
    advantage: 'player1' | 'player2' | 'equal';
  } {
    return {
      player1: value1,
      player2: value2,
      advantage:
        value1 > value2 ? 'player1' : value1 < value2 ? 'player2' : 'equal',
    };
  }

  private formatMatchScore(match: Match): string | undefined {
    if (!match.score) return undefined;

    return `${match.score.player1Sets.join('-')} : ${match.score.player2Sets.join('-')}`;
  }

  private async getRecentFormScore(playerId: string): Promise<number> {
    const recentMatches = await this.db.getPlayerRecentMatches(playerId, 10);
    if (recentMatches.length === 0) return 0;

    const wins = recentMatches.filter(m => m.winnerId === playerId).length;
    return Math.round((wins / recentMatches.length) * 100);
  }

  private generateId(): string {
    return `follow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const playerProfileService = new PlayerProfileService();

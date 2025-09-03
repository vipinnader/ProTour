// Interactive Tournament Bracket Viewing Service - Epic 3 Story 3.3
import {
  Tournament,
  Match,
  BracketStructure,
  Player,
  Timestamp,
} from '../types';
import { DatabaseService } from './DatabaseService';
import { SyncService } from './SyncService';

export interface BracketViewConfig {
  tournamentId: string;
  viewMode: 'full' | 'current-round' | 'player-focused';
  highlightedPlayerId?: string;
  showScores: boolean;
  showTimestamps: boolean;
  zoomLevel: number; // 1-5 scale
  panPosition: { x: number; y: number };
}

export interface BracketNode {
  matchId: string;
  round: number;
  position: number;
  player1?: {
    id: string;
    name: string;
    seed?: number;
  };
  player2?: {
    id: string;
    name: string;
    seed?: number;
  };
  winner?: {
    id: string;
    name: string;
  };
  score?: {
    player1Score: number[];
    player2Score: number[];
  };
  status: 'pending' | 'in-progress' | 'completed';
  startTime?: Date;
  endTime?: Date;
  court?: string;
  isHighlighted?: boolean;
}

export interface InteractiveBracket {
  tournamentId: string;
  structure: BracketStructure;
  nodes: BracketNode[][];
  metadata: {
    totalRounds: number;
    totalMatches: number;
    completedMatches: number;
    currentRound: number;
    lastUpdated: Date;
  };
  navigation: {
    canZoomIn: boolean;
    canZoomOut: boolean;
    canPanLeft: boolean;
    canPanRight: boolean;
    canPanUp: boolean;
    canPanDown: boolean;
  };
}

export class InteractiveBracketService {
  private db: DatabaseService;
  private syncService: SyncService;
  private subscriptions: Map<string, any> = new Map();

  constructor() {
    this.db = new DatabaseService();
    this.syncService = new SyncService();
  }

  /**
   * Get interactive bracket data for viewing
   * AC3.3.1: Responsive bracket supporting zoom/pan for up to 64 players
   * AC3.3.2: Live score updates with timestamp information
   */
  async getInteractiveBracket(
    config: BracketViewConfig
  ): Promise<InteractiveBracket> {
    try {
      const tournament = await this.db.getTournament(config.tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const structure = await this.db.getTournamentBracket(config.tournamentId);
      const matches = await this.db.getTournamentMatches(config.tournamentId);

      // Build bracket nodes organized by rounds
      const nodes = await this.buildBracketNodes(matches, config);

      // Calculate metadata
      const metadata = this.calculateBracketMetadata(matches, structure);

      // Calculate navigation capabilities
      const navigation = this.calculateNavigationCapabilities(
        config,
        structure
      );

      return {
        tournamentId: config.tournamentId,
        structure,
        nodes,
        metadata,
        navigation,
      };
    } catch (error) {
      throw new Error(`Failed to get interactive bracket: ${error.message}`);
    }
  }

  /**
   * Subscribe to live bracket updates
   * AC3.3.2: Live score updates with timestamp information
   */
  async subscribeToBracketUpdates(
    tournamentId: string,
    callback: (bracket: InteractiveBracket) => void
  ): Promise<{ unsubscribe: () => void }> {
    try {
      // Subscribe to match updates
      const subscription = this.db.subscribeToTournamentMatches(
        tournamentId,
        async (updatedMatches: Match[]) => {
          // Rebuild bracket with updated data
          const config: BracketViewConfig = {
            tournamentId,
            viewMode: 'full',
            showScores: true,
            showTimestamps: true,
            zoomLevel: 1,
            panPosition: { x: 0, y: 0 },
          };

          const updatedBracket = await this.getInteractiveBracket(config);
          callback(updatedBracket);
        }
      );

      // Store subscription for cleanup
      this.subscriptions.set(tournamentId, subscription);

      return {
        unsubscribe: () => {
          subscription.unsubscribe();
          this.subscriptions.delete(tournamentId);
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to subscribe to bracket updates: ${error.message}`
      );
    }
  }

  /**
   * Highlight specific player path through bracket
   * AC3.3.3: Player highlighting to follow specific players through bracket
   */
  async highlightPlayerPath(
    tournamentId: string,
    playerId: string
  ): Promise<{
    playerMatches: Match[];
    highlightedNodes: string[];
    playerProgress: {
      currentRound: number;
      wins: number;
      losses: number;
      isActive: boolean;
    };
  }> {
    try {
      const playerMatches = await this.db.getPlayerMatches(
        tournamentId,
        playerId
      );
      const highlightedNodes = playerMatches.map(m => m.id);

      const wins = playerMatches.filter(m => m.winnerId === playerId).length;
      const losses = playerMatches.filter(
        m => m.status === 'completed' && m.winnerId !== playerId
      ).length;
      const currentRound = Math.max(...playerMatches.map(m => m.round), 1);
      const isActive = playerMatches.some(m => m.status === 'pending');

      return {
        playerMatches,
        highlightedNodes,
        playerProgress: {
          currentRound,
          wins,
          losses,
          isActive,
        },
      };
    } catch (error) {
      throw new Error(`Failed to highlight player path: ${error.message}`);
    }
  }

  /**
   * Get detailed match information for popups
   * AC3.3.4: Match detail popups with full information on tap
   */
  async getMatchDetails(matchId: string): Promise<{
    match: Match;
    players: {
      player1?: { name: string; seed?: number; ranking?: number };
      player2?: { name: string; seed?: number; ranking?: number };
    };
    statistics?: {
      duration?: number;
      totalPoints?: number;
      longestSet?: number;
    };
    timeline?: {
      timestamp: Date;
      event: string;
      score?: string;
    }[];
  }> {
    try {
      const match = await this.db.getMatch(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      // Get player information
      const player1 = match.player1Id
        ? await this.db.getUser(match.player1Id)
        : null;
      const player2 = match.player2Id
        ? await this.db.getUser(match.player2Id)
        : null;

      // Get player tournament-specific data
      const player1Data = match.player1Id
        ? await this.db.getPlayerTournamentData(
            match.tournamentId,
            match.player1Id
          )
        : null;
      const player2Data = match.player2Id
        ? await this.db.getPlayerTournamentData(
            match.tournamentId,
            match.player2Id
          )
        : null;

      const players = {
        player1: player1
          ? {
              name: player1.name,
              seed: player1Data?.seedPosition,
              ranking: player1Data?.ranking,
            }
          : undefined,
        player2: player2
          ? {
              name: player2.name,
              seed: player2Data?.seedPosition,
              ranking: player2Data?.ranking,
            }
          : undefined,
      };

      // Calculate statistics if match is completed
      let statistics;
      if (match.status === 'completed' && match.startTime && match.endTime) {
        statistics = await this.calculateMatchStatistics(match);
      }

      // Get match timeline if available
      const timeline = await this.getMatchTimeline(matchId);

      return {
        match,
        players,
        statistics,
        timeline,
      };
    } catch (error) {
      throw new Error(`Failed to get match details: ${error.message}`);
    }
  }

  /**
   * Navigate bracket view
   * AC3.3.5: Bracket navigation (current round, next round, historical rounds)
   * AC3.3.6: Mobile/tablet/desktop responsive layout optimization
   */
  async navigateBracket(
    config: BracketViewConfig,
    navigation: {
      action:
        | 'zoom-in'
        | 'zoom-out'
        | 'pan'
        | 'go-to-round'
        | 'center-on-player';
      parameters?: {
        zoomLevel?: number;
        panDelta?: { x: number; y: number };
        targetRound?: number;
        playerId?: string;
      };
    }
  ): Promise<BracketViewConfig> {
    const newConfig = { ...config };

    switch (navigation.action) {
      case 'zoom-in':
        newConfig.zoomLevel = Math.min(5, config.zoomLevel + 1);
        break;

      case 'zoom-out':
        newConfig.zoomLevel = Math.max(1, config.zoomLevel - 1);
        break;

      case 'pan':
        if (navigation.parameters?.panDelta) {
          newConfig.panPosition = {
            x: config.panPosition.x + navigation.parameters.panDelta.x,
            y: config.panPosition.y + navigation.parameters.panDelta.y,
          };
        }
        break;

      case 'go-to-round':
        if (navigation.parameters?.targetRound) {
          // Calculate pan position to center on target round
          newConfig.panPosition = await this.calculateRoundCenterPosition(
            config.tournamentId,
            navigation.parameters.targetRound
          );
        }
        break;

      case 'center-on-player':
        if (navigation.parameters?.playerId) {
          // Calculate position to center on player's current/next match
          newConfig.panPosition = await this.calculatePlayerCenterPosition(
            config.tournamentId,
            navigation.parameters.playerId
          );
          newConfig.highlightedPlayerId = navigation.parameters.playerId;
        }
        break;
    }

    return newConfig;
  }

  /**
   * Export bracket for sharing
   */
  async exportBracket(
    tournamentId: string,
    format: 'png' | 'pdf' | 'svg'
  ): Promise<Buffer> {
    try {
      const bracket = await this.getInteractiveBracket({
        tournamentId,
        viewMode: 'full',
        showScores: true,
        showTimestamps: false,
        zoomLevel: 1,
        panPosition: { x: 0, y: 0 },
      });

      // Generate bracket visualization
      return await this.generateBracketExport(bracket, format);
    } catch (error) {
      throw new Error(`Failed to export bracket: ${error.message}`);
    }
  }

  // Private helper methods

  private async buildBracketNodes(
    matches: Match[],
    config: BracketViewConfig
  ): Promise<BracketNode[][]> {
    const nodesByRound: BracketNode[][] = [];
    const maxRound = Math.max(...matches.map(m => m.round));

    for (let round = 1; round <= maxRound; round++) {
      const roundMatches = matches
        .filter(m => m.round === round)
        .sort((a, b) => a.matchNumber - b.matchNumber);

      const roundNodes: BracketNode[] = [];

      for (const match of roundMatches) {
        const node = await this.buildBracketNode(match, config);
        roundNodes.push(node);
      }

      nodesByRound.push(roundNodes);
    }

    return nodesByRound;
  }

  private async buildBracketNode(
    match: Match,
    config: BracketViewConfig
  ): Promise<BracketNode> {
    // Get player information
    const player1 = match.player1Id
      ? await this.db.getUser(match.player1Id)
      : null;
    const player2 = match.player2Id
      ? await this.db.getUser(match.player2Id)
      : null;
    const winner = match.winnerId
      ? await this.db.getUser(match.winnerId)
      : null;

    // Get seed information
    const player1Seed = match.player1Id
      ? await this.db.getPlayerSeed(match.tournamentId, match.player1Id)
      : undefined;
    const player2Seed = match.player2Id
      ? await this.db.getPlayerSeed(match.tournamentId, match.player2Id)
      : undefined;

    const isHighlighted =
      config.highlightedPlayerId &&
      (match.player1Id === config.highlightedPlayerId ||
        match.player2Id === config.highlightedPlayerId);

    return {
      matchId: match.id,
      round: match.round,
      position: match.matchNumber,
      player1: player1
        ? {
            id: player1.id,
            name: player1.name,
            seed: player1Seed,
          }
        : undefined,
      player2: player2
        ? {
            id: player2.id,
            name: player2.name,
            seed: player2Seed,
          }
        : undefined,
      winner: winner
        ? {
            id: winner.id,
            name: winner.name,
          }
        : undefined,
      score:
        config.showScores && match.score
          ? {
              player1Score: match.score.player1Sets,
              player2Score: match.score.player2Sets,
            }
          : undefined,
      status: match.status,
      startTime:
        config.showTimestamps && match.startTime
          ? match.startTime.toDate()
          : undefined,
      endTime:
        config.showTimestamps && match.endTime
          ? match.endTime.toDate()
          : undefined,
      court: match.court,
      isHighlighted,
    };
  }

  private calculateBracketMetadata(
    matches: Match[],
    structure: BracketStructure
  ) {
    const completedMatches = matches.filter(
      m => m.status === 'completed'
    ).length;
    const currentRound = this.calculateCurrentRound(matches);

    return {
      totalRounds: structure.totalRounds,
      totalMatches: matches.length,
      completedMatches,
      currentRound,
      lastUpdated: new Date(),
    };
  }

  private calculateCurrentRound(matches: Match[]): number {
    // Find the lowest round with pending matches, or highest round + 1 if all complete
    const pendingMatches = matches.filter(m => m.status === 'pending');
    if (pendingMatches.length === 0) {
      return Math.max(...matches.map(m => m.round)) + 1;
    }
    return Math.min(...pendingMatches.map(m => m.round));
  }

  private calculateNavigationCapabilities(
    config: BracketViewConfig,
    structure: BracketStructure
  ) {
    return {
      canZoomIn: config.zoomLevel < 5,
      canZoomOut: config.zoomLevel > 1,
      canPanLeft: config.panPosition.x > -100,
      canPanRight: config.panPosition.x < 100,
      canPanUp: config.panPosition.y > -100,
      canPanDown: config.panPosition.y < 100,
    };
  }

  private async calculateRoundCenterPosition(
    tournamentId: string,
    targetRound: number
  ): Promise<{ x: number; y: number }> {
    // Calculate optimal pan position to center the target round
    // This would depend on the specific bracket layout algorithm
    return { x: targetRound * 200 - 400, y: 0 };
  }

  private async calculatePlayerCenterPosition(
    tournamentId: string,
    playerId: string
  ): Promise<{ x: number; y: number }> {
    // Find player's next match and calculate position to center on it
    const upcomingMatch = await this.db.getPlayerNextMatch(
      tournamentId,
      playerId
    );
    if (upcomingMatch) {
      return {
        x: upcomingMatch.round * 200 - 400,
        y: upcomingMatch.matchNumber * 100 - 200,
      };
    }
    return { x: 0, y: 0 };
  }

  private async calculateMatchStatistics(match: Match) {
    if (!match.startTime || !match.endTime) return undefined;

    const duration =
      (match.endTime.toMillis() - match.startTime.toMillis()) / (1000 * 60); // minutes

    let totalPoints = 0;
    let longestSet = 0;

    if (match.score) {
      totalPoints =
        match.score.player1Sets.reduce((sum, set) => sum + set, 0) +
        match.score.player2Sets.reduce((sum, set) => sum + set, 0);
      longestSet = Math.max(
        ...match.score.player1Sets,
        ...match.score.player2Sets
      );
    }

    return {
      duration,
      totalPoints,
      longestSet,
    };
  }

  private async getMatchTimeline(matchId: string) {
    try {
      const timeline = await this.db.getMatchTimeline(matchId);
      return (
        timeline?.events.map(event => ({
          timestamp: event.timestamp,
          event: event.type,
          score: event.details.score
            ? `${event.details.score.player1Sets.join('-')} : ${event.details.score.player2Sets.join('-')}`
            : undefined,
        })) || []
      );
    } catch (error) {
      return [];
    }
  }

  private async generateBracketExport(
    bracket: InteractiveBracket,
    format: 'png' | 'pdf' | 'svg'
  ): Promise<Buffer> {
    // This would integrate with a graphics library to generate the bracket visualization
    // For now, return a placeholder
    return Buffer.from(
      `Bracket export for tournament ${bracket.tournamentId} in ${format} format`
    );
  }
}

export const interactiveBracketService = new InteractiveBracketService();

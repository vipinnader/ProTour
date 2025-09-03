// Enhanced Offline Service for Story 2B.1 - Offline-First Data Architecture
// Extends OfflineDataService with tournament-specific offline capabilities

import { OfflineDataService, OfflineQuery, CachedDocument, OfflineStatus } from './OfflineDataService';
import { realTimeSyncService } from './RealTimeSyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Tournament, Match, Player, BracketData } from '../types';

export interface TournamentCache {
  tournamentId: string;
  tournament: Tournament;
  matches: Match[];
  players: Player[];
  bracket: BracketData;
  images: { [key: string]: string }; // URL -> local file path mapping
  lastUpdated: number;
  expiresAt: number;
  sizeBytes: number;
}

export interface SearchIndex {
  collection: string;
  documentId: string;
  searchableFields: { [field: string]: string };
  lastIndexed: number;
}

export interface PrefetchSettings {
  enabled: boolean;
  upcomingMatchesHours: number; // Hours ahead to prefetch
  mediaQuality: 'low' | 'medium' | 'high';
  maxCacheSize: number; // MB
  autoCleanup: boolean;
}

export interface OfflineOperationLimits {
  currentOfflineTime: number;
  maxOfflineTime: number;
  warningThreshold: number;
  degradationLevel: 'full' | 'limited' | 'emergency';
  featuresDisabled: string[];
  storageUsed: number;
  maxStorage: number;
}

export interface EmergencyExport {
  tournamentId: string;
  exportedAt: number;
  data: {
    tournament: Tournament;
    matches: Match[];
    players: Player[];
    scores: any[];
    audit: any[];
  };
  fileSize: number;
  filePath: string;
}

export class EnhancedOfflineService extends OfflineDataService {
  private tournamentCaches: Map<string, TournamentCache> = new Map();
  private searchIndex: Map<string, SearchIndex[]> = new Map();
  private prefetchSettings: PrefetchSettings;
  private mediaCache: Map<string, string> = new Map(); // URL -> local path
  private readonly CACHE_DIR = `${RNFS.DocumentDirectoryPath}/tournament_cache`;
  private readonly MEDIA_CACHE_DIR = `${CACHE_DIR}/media`;
  private readonly SEARCH_INDEX_KEY = '@protour/search_index';
  private readonly PREFETCH_SETTINGS_KEY = '@protour/prefetch_settings';

  constructor() {
    super();
    this.prefetchSettings = {
      enabled: true,
      upcomingMatchesHours: 24,
      mediaQuality: 'medium',
      maxCacheSize: 50, // 50MB default
      autoCleanup: true,
    };
    this.initializeEnhancedFeatures();
  }

  private async initializeEnhancedFeatures(): Promise<void> {
    try {
      // Create cache directories
      await this.ensureCacheDirectories();
      
      // Load prefetch settings
      await this.loadPrefetchSettings();
      
      // Initialize search index
      await this.loadSearchIndex();
      
      // Set up automatic cleanup
      this.scheduleAutomaticCleanup();
      
      console.log('Enhanced offline features initialized');
    } catch (error) {
      console.error('Failed to initialize enhanced offline features:', error);
    }
  }

  private async ensureCacheDirectories(): Promise<void> {
    const directories = [this.CACHE_DIR, this.MEDIA_CACHE_DIR];
    
    for (const dir of directories) {
      if (!(await RNFS.exists(dir))) {
        await RNFS.mkdir(dir, { NSURLIsExcludedFromBackupKey: true });
      }
    }
  }

  /**
   * AC2B.1.2: Intelligent data prefetching for upcoming matches
   */
  async cacheEssentialData(tournamentId: string): Promise<void> {
    try {
      console.log(`Starting essential data cache for tournament ${tournamentId}`);

      // Fetch tournament data
      const tournament = await this.readOffline<Tournament>('tournaments', tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found for caching');
      }

      // Fetch related data
      const [matches, players, bracket] = await Promise.all([
        this.queryOffline<Match>({ 
          collection: 'matches',
          where: [['tournamentId', '==', tournamentId]],
          orderBy: [['startTime', 'ASC']]
        }),
        this.queryOffline<Player>({ 
          collection: 'players',
          where: [['tournamentIds', 'IN', [tournamentId]]]
        }),
        this.readOffline<BracketData>('brackets', `bracket_${tournamentId}`)
      ]);

      // Prefetch upcoming matches (next 24 hours by default)
      const upcomingMatches = this.filterUpcomingMatches(
        matches.map(m => m.data), 
        this.prefetchSettings.upcomingMatchesHours
      );

      // Cache images and media for the bracket
      const imagePaths = await this.cacheMatchImages(upcomingMatches);

      // Create tournament cache
      const cache: TournamentCache = {
        tournamentId,
        tournament: tournament.data,
        matches: matches.map(m => m.data),
        players: players.map(p => p.data),
        bracket: bracket?.data || { rounds: [], participants: [] },
        images: imagePaths,
        lastUpdated: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        sizeBytes: await this.calculateCacheSize(tournamentId),
      };

      this.tournamentCaches.set(tournamentId, cache);
      
      // Update search index for the cached data
      await this.updateSearchIndex(tournamentId, cache);

      console.log(`Essential data cached for tournament ${tournamentId}: ${cache.sizeBytes} bytes`);
    } catch (error) {
      console.error('Failed to cache essential data:', error);
      throw error;
    }
  }

  private filterUpcomingMatches(matches: Match[], hoursAhead: number): Match[] {
    const now = Date.now();
    const cutoff = now + (hoursAhead * 60 * 60 * 1000);
    
    return matches.filter(match => {
      if (!match.startTime) return false;
      const startTime = typeof match.startTime === 'number' ? match.startTime : match.startTime.toMillis();
      return startTime >= now && startTime <= cutoff;
    });
  }

  /**
   * AC2B.1.2: Image and media caching for offline bracket viewing
   */
  private async cacheMatchImages(matches: Match[]): Promise<{ [key: string]: string }> {
    const imagePaths: { [key: string]: string } = {};
    
    for (const match of matches) {
      try {
        // Cache player photos
        if (match.player1Id && match.player1Photo) {
          const localPath = await this.cacheImage(match.player1Photo, `player_${match.player1Id}`);
          if (localPath) imagePaths[match.player1Photo] = localPath;
        }
        
        if (match.player2Id && match.player2Photo) {
          const localPath = await this.cacheImage(match.player2Photo, `player_${match.player2Id}`);
          if (localPath) imagePaths[match.player2Photo] = localPath;
        }

        // Cache court images or tournament logos
        if (match.courtImage) {
          const localPath = await this.cacheImage(match.courtImage, `court_${match.court}`);
          if (localPath) imagePaths[match.courtImage] = localPath;
        }
      } catch (error) {
        console.warn(`Failed to cache images for match ${match.id}:`, error);
      }
    }
    
    return imagePaths;
  }

  private async cacheImage(url: string, identifier: string): Promise<string | null> {
    try {
      // Check if already cached
      if (this.mediaCache.has(url)) {
        return this.mediaCache.get(url)!;
      }

      const fileExtension = url.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${identifier}.${fileExtension}`;
      const localPath = `${this.MEDIA_CACHE_DIR}/${fileName}`;

      // Check if file already exists
      if (await RNFS.exists(localPath)) {
        this.mediaCache.set(url, localPath);
        return localPath;
      }

      // Download and cache the image
      const downloadResult = await RNFS.downloadFile({
        fromUrl: url,
        toFile: localPath,
        background: true,
        discretionary: true,
      }).promise;

      if (downloadResult.statusCode === 200) {
        this.mediaCache.set(url, localPath);
        return localPath;
      }

      return null;
    } catch (error) {
      console.warn(`Failed to cache image ${url}:`, error);
      return null;
    }
  }

  /**
   * AC2B.1.2: Local search functionality for players and matches
   */
  async searchOffline(query: string, collections: string[] = ['players', 'matches']): Promise<any[]> {
    const results: any[] = [];
    const searchTerm = query.toLowerCase().trim();
    
    if (searchTerm.length < 2) return results;

    for (const collection of collections) {
      const indexes = this.searchIndex.get(collection) || [];
      
      for (const index of indexes) {
        const document = await this.readOffline(collection, index.documentId);
        if (!document) continue;

        // Search through indexed fields
        const matchScore = this.calculateSearchScore(index.searchableFields, searchTerm);
        
        if (matchScore > 0) {
          results.push({
            ...document,
            searchScore: matchScore,
            matchedFields: this.getMatchedFields(index.searchableFields, searchTerm),
          });
        }
      }
    }

    // Sort by search score (relevance)
    return results.sort((a, b) => b.searchScore - a.searchScore);
  }

  private calculateSearchScore(fields: { [field: string]: string }, searchTerm: string): number {
    let score = 0;
    
    Object.entries(fields).forEach(([field, value]) => {
      const lowerValue = value.toLowerCase();
      
      // Exact match gets highest score
      if (lowerValue === searchTerm) {
        score += field === 'name' ? 100 : 50;
      }
      // Starts with search term
      else if (lowerValue.startsWith(searchTerm)) {
        score += field === 'name' ? 75 : 35;
      }
      // Contains search term
      else if (lowerValue.includes(searchTerm)) {
        score += field === 'name' ? 50 : 20;
      }
      // Fuzzy match (simple character similarity)
      else {
        const similarity = this.calculateStringSimilarity(lowerValue, searchTerm);
        if (similarity > 0.6) {
          score += Math.floor(similarity * 30);
        }
      }
    });

    return score;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private getMatchedFields(fields: { [field: string]: string }, searchTerm: string): string[] {
    const matched: string[] = [];
    
    Object.entries(fields).forEach(([field, value]) => {
      if (value.toLowerCase().includes(searchTerm.toLowerCase())) {
        matched.push(field);
      }
    });

    return matched;
  }

  private async updateSearchIndex(tournamentId: string, cache: TournamentCache): Promise<void> {
    // Index players
    const playerIndexes = cache.players.map(player => ({
      collection: 'players',
      documentId: player.id,
      searchableFields: {
        name: player.name || '',
        email: player.email || '',
        phone: player.phone || '',
        organization: player.organization || '',
        ranking: player.ranking?.toString() || '',
      },
      lastIndexed: Date.now(),
    }));

    // Index matches
    const matchIndexes = cache.matches.map(match => ({
      collection: 'matches',
      documentId: match.id,
      searchableFields: {
        player1Name: match.player1Name || '',
        player2Name: match.player2Name || '',
        court: match.court || '',
        round: match.round?.toString() || '',
        status: match.status || '',
      },
      lastIndexed: Date.now(),
    }));

    this.searchIndex.set('players', playerIndexes);
    this.searchIndex.set('matches', matchIndexes);

    // Persist search index
    await AsyncStorage.setItem(this.SEARCH_INDEX_KEY, JSON.stringify({
      players: playerIndexes,
      matches: matchIndexes,
      lastUpdated: Date.now(),
    }));
  }

  /**
   * AC2B.1.7: Enhanced offline operation limits with graceful degradation
   */
  async getOfflineOperationLimits(): Promise<OfflineOperationLimits> {
    const baseStatus = await this.getOfflineStatus();
    const currentOfflineTime = baseStatus.offlineStartTime ? 
      Date.now() - baseStatus.offlineStartTime : 0;
    
    const maxOfflineTime = 8 * 60 * 60 * 1000; // 8 hours
    const warningThreshold = 6 * 60 * 60 * 1000; // 6 hours
    
    let degradationLevel: 'full' | 'limited' | 'emergency' = 'full';
    const featuresDisabled: string[] = [];

    if (currentOfflineTime > maxOfflineTime) {
      degradationLevel = 'emergency';
      featuresDisabled.push('image_caching', 'search', 'prefetch');
    } else if (currentOfflineTime > warningThreshold) {
      degradationLevel = 'limited';
      featuresDisabled.push('image_caching', 'prefetch');
    }

    const storageInfo = await this.getStorageInfo();

    return {
      currentOfflineTime,
      maxOfflineTime,
      warningThreshold,
      degradationLevel,
      featuresDisabled,
      storageUsed: storageInfo.used,
      maxStorage: storageInfo.total,
    };
  }

  /**
   * AC2B.1.7: Emergency data export capability
   */
  async createEmergencyExport(tournamentId: string): Promise<EmergencyExport> {
    try {
      console.log(`Creating emergency export for tournament ${tournamentId}`);

      // Gather all tournament data
      const tournament = await this.readOffline<Tournament>('tournaments', tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found for export');
      }

      const [matches, players, scores, auditLogs] = await Promise.all([
        this.queryOffline<Match>({ 
          collection: 'matches',
          where: [['tournamentId', '==', tournamentId]]
        }),
        this.queryOffline<Player>({ 
          collection: 'players',
          where: [['tournamentIds', 'IN', [tournamentId]]]
        }),
        this.queryOffline({ 
          collection: 'score_entries',
          where: [['tournamentId', '==', tournamentId]]
        }),
        this.queryOffline({ 
          collection: 'audit_logs',
          where: [['tournamentId', '==', tournamentId]]
        }),
      ]);

      const exportData = {
        tournament: tournament.data,
        matches: matches.map(m => m.data),
        players: players.map(p => p.data),
        scores: scores.map(s => s.data),
        audit: auditLogs.map(a => a.data),
      };

      // Create export file
      const fileName = `emergency_export_${tournamentId}_${Date.now()}.json`;
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      
      await RNFS.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
      
      const fileStats = await RNFS.stat(filePath);

      const emergencyExport: EmergencyExport = {
        tournamentId,
        exportedAt: Date.now(),
        data: exportData,
        fileSize: fileStats.size,
        filePath,
      };

      console.log(`Emergency export created: ${fileName} (${fileStats.size} bytes)`);
      return emergencyExport;

    } catch (error) {
      console.error('Failed to create emergency export:', error);
      throw error;
    }
  }

  /**
   * Storage and cache management
   */
  private async getStorageInfo(): Promise<{ used: number; total: number; available: number }> {
    try {
      const freeSpace = await RNFS.getFSInfo();
      const cacheStats = await this.getCacheStats();
      
      return {
        used: cacheStats.totalSize,
        total: this.prefetchSettings.maxCacheSize * 1024 * 1024, // Convert MB to bytes
        available: freeSpace.freeSpace,
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { used: 0, total: 0, available: 0 };
    }
  }

  private async getCacheStats(): Promise<{ totalSize: number; fileCount: number }> {
    try {
      let totalSize = 0;
      let fileCount = 0;
      
      // Check cache directory
      if (await RNFS.exists(this.CACHE_DIR)) {
        const files = await RNFS.readDir(this.CACHE_DIR);
        for (const file of files) {
          totalSize += file.size;
          fileCount++;
        }
      }

      return { totalSize, fileCount };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { totalSize: 0, fileCount: 0 };
    }
  }

  private async calculateCacheSize(tournamentId: string): Promise<number> {
    const cache = this.tournamentCaches.get(tournamentId);
    if (!cache) return 0;

    // Rough calculation based on data size
    const dataSize = JSON.stringify(cache).length;
    
    // Add image sizes
    let imageSize = 0;
    for (const imagePath of Object.values(cache.images)) {
      try {
        if (await RNFS.exists(imagePath)) {
          const stats = await RNFS.stat(imagePath);
          imageSize += stats.size;
        }
      } catch (error) {
        // Ignore errors for individual files
      }
    }

    return dataSize + imageSize;
  }

  private scheduleAutomaticCleanup(): void {
    // Clean up expired caches every hour
    setInterval(async () => {
      if (this.prefetchSettings.autoCleanup) {
        await this.cleanupExpiredCaches();
      }
    }, 60 * 60 * 1000); // 1 hour

    // Check offline time limits every 30 minutes
    setInterval(async () => {
      const limits = await this.getOfflineOperationLimits();
      if (limits.degradationLevel !== 'full') {
        this.emit('degradationMode', limits);
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  private async cleanupExpiredCaches(): Promise<void> {
    try {
      const now = Date.now();
      const expiredCaches: string[] = [];

      for (const [tournamentId, cache] of this.tournamentCaches) {
        if (cache.expiresAt < now) {
          expiredCaches.push(tournamentId);
        }
      }

      for (const tournamentId of expiredCaches) {
        await this.removeTournamentCache(tournamentId);
      }

      console.log(`Cleaned up ${expiredCaches.length} expired tournament caches`);
    } catch (error) {
      console.error('Failed to cleanup expired caches:', error);
    }
  }

  private async removeTournamentCache(tournamentId: string): Promise<void> {
    const cache = this.tournamentCaches.get(tournamentId);
    if (!cache) return;

    // Remove cached images
    for (const imagePath of Object.values(cache.images)) {
      try {
        if (await RNFS.exists(imagePath)) {
          await RNFS.unlink(imagePath);
        }
      } catch (error) {
        // Ignore individual file errors
      }
    }

    this.tournamentCaches.delete(tournamentId);
  }

  // Settings management
  private async loadPrefetchSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.PREFETCH_SETTINGS_KEY);
      if (stored) {
        this.prefetchSettings = { ...this.prefetchSettings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load prefetch settings:', error);
    }
  }

  async updatePrefetchSettings(settings: Partial<PrefetchSettings>): Promise<void> {
    this.prefetchSettings = { ...this.prefetchSettings, ...settings };
    await AsyncStorage.setItem(this.PREFETCH_SETTINGS_KEY, JSON.stringify(this.prefetchSettings));
  }

  private async loadSearchIndex(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.SEARCH_INDEX_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.searchIndex.set('players', data.players || []);
        this.searchIndex.set('matches', data.matches || []);
      }
    } catch (error) {
      console.error('Failed to load search index:', error);
    }
  }

  // Public API methods for tournament-specific operations
  getCachedTournament(tournamentId: string): TournamentCache | undefined {
    return this.tournamentCaches.get(tournamentId);
  }

  async isTournamentCached(tournamentId: string): Promise<boolean> {
    const cache = this.tournamentCaches.get(tournamentId);
    return cache !== undefined && cache.expiresAt > Date.now();
  }

  async refreshTournamentCache(tournamentId: string): Promise<void> {
    await this.cacheEssentialData(tournamentId);
  }

  getPrefetchSettings(): PrefetchSettings {
    return { ...this.prefetchSettings };
  }

  getSearchIndex(collection: string): SearchIndex[] {
    return this.searchIndex.get(collection) || [];
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      // Clear in-memory caches
      this.tournamentCaches.clear();
      this.searchIndex.clear();
      this.mediaCache.clear();

      // Optional: Remove cache directories (uncomment if needed)
      // if (await RNFS.exists(this.CACHE_DIR)) {
      //   await RNFS.unlink(this.CACHE_DIR);
      // }

      console.log('Enhanced offline service cleaned up');
    } catch (error) {
      console.error('Failed to cleanup enhanced offline service:', error);
    }
  }
}

export const enhancedOfflineService = new EnhancedOfflineService();
// Offline Tournament Dashboard for Story 2B.1 - AC2B.1.1 & AC2B.1.4
// Complete offline tournament functionality with status indicators

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  enhancedOfflineService,
  OfflineOperationLimits,
  TournamentCache,
} from '@protour/shared';
import { useSync } from '../../contexts/SyncContext';
import { Tournament, Match, Player } from '@protour/shared/types';

interface OfflineTournamentDashboardProps {
  tournamentId: string;
  tournament?: Tournament;
}

interface ConnectionStatus {
  isOnline: boolean;
  lastSyncTime: number;
  pendingOperations: number;
  syncInProgress: boolean;
  networkQuality: 'poor' | 'good' | 'excellent' | 'offline';
}

const OfflineTournamentDashboard: React.FC<OfflineTournamentDashboardProps> = ({
  tournamentId,
  tournament: propTournament,
}) => {
  const { currentSession } = useSync();
  const [tournament, setTournament] = useState<Tournament | null>(
    propTournament || null
  );
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isOnline: true,
    lastSyncTime: Date.now(),
    pendingOperations: 0,
    syncInProgress: false,
    networkQuality: 'good',
  });
  const [operationLimits, setOperationLimits] =
    useState<OfflineOperationLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cachedData, setCachedData] = useState<TournamentCache | null>(null);

  useEffect(() => {
    initializeDashboard();
    setupStatusListeners();

    return () => {
      cleanupListeners();
    };
  }, [tournamentId]);

  const initializeDashboard = async () => {
    try {
      setIsLoading(true);

      // Initialize enhanced offline service
      await enhancedOfflineService.initialize();

      // Check if tournament is cached
      const isCached =
        await enhancedOfflineService.isTournamentCached(tournamentId);

      if (isCached) {
        // Load from cache
        const cache = enhancedOfflineService.getCachedTournament(tournamentId);
        if (cache) {
          setTournament(cache.tournament);
          setMatches(cache.matches);
          setPlayers(cache.players);
          setCachedData(cache);
        }
      } else {
        // Cache essential data
        await enhancedOfflineService.cacheEssentialData(tournamentId);
        const cache = enhancedOfflineService.getCachedTournament(tournamentId);
        if (cache) {
          setTournament(cache.tournament);
          setMatches(cache.matches);
          setPlayers(cache.players);
          setCachedData(cache);
        }
      }

      // Update status
      await updateStatus();
    } catch (error) {
      console.error('Failed to initialize offline dashboard:', error);
      Alert.alert(
        'Initialization Error',
        'Failed to load tournament data offline'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const setupStatusListeners = () => {
    // Listen for connectivity changes
    enhancedOfflineService.subscribe('online', () => {
      setConnectionStatus(prev => ({
        ...prev,
        isOnline: true,
        networkQuality: 'good',
      }));
      updateStatus();
    });

    enhancedOfflineService.subscribe('offline', () => {
      setConnectionStatus(prev => ({
        ...prev,
        isOnline: false,
        networkQuality: 'offline',
      }));
      updateStatus();
    });

    enhancedOfflineService.subscribe('offlineWarning', data => {
      Alert.alert(
        'Offline Time Warning',
        `You've been offline for over 6 hours. ${Math.round(data.timeRemaining / (60 * 60 * 1000))} hours remaining before limited functionality.`,
        [{ text: 'OK' }]
      );
    });

    enhancedOfflineService.subscribe('offlineLimitExceeded', () => {
      Alert.alert(
        'Offline Limit Exceeded',
        "You've exceeded the 8-hour offline limit. Some features have been disabled. Please connect to internet to restore full functionality.",
        [{ text: 'OK' }]
      );
    });

    enhancedOfflineService.subscribe(
      'degradationMode',
      (limits: OfflineOperationLimits) => {
        setOperationLimits(limits);
      }
    );
  };

  const cleanupListeners = () => {
    // In a real implementation, you'd store the unsubscribe functions and call them here
  };

  const updateStatus = async () => {
    try {
      const status = await enhancedOfflineService.getOfflineStatus();
      const limits = await enhancedOfflineService.getOfflineOperationLimits();

      setConnectionStatus({
        isOnline: status.isOnline,
        lastSyncTime: status.lastSyncTime,
        pendingOperations: status.pendingOperations,
        syncInProgress: status.syncInProgress,
        networkQuality: status.isOnline ? 'good' : 'offline',
      });

      setOperationLimits(limits);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (connectionStatus.isOnline) {
        // Refresh from server if online
        await enhancedOfflineService.refreshTournamentCache(tournamentId);
        const cache = enhancedOfflineService.getCachedTournament(tournamentId);
        if (cache) {
          setTournament(cache.tournament);
          setMatches(cache.matches);
          setPlayers(cache.players);
          setCachedData(cache);
        }
      }
      await updateStatus();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [tournamentId, connectionStatus.isOnline]);

  const handleEmergencyExport = async () => {
    try {
      Alert.alert(
        'Emergency Export',
        'This will create a backup file of all tournament data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Export',
            onPress: async () => {
              try {
                const exportData =
                  await enhancedOfflineService.createEmergencyExport(
                    tournamentId
                  );
                Alert.alert(
                  'Export Complete',
                  `Tournament data exported to:\n${exportData.filePath}\n\nSize: ${Math.round(exportData.fileSize / 1024)} KB`,
                  [{ text: 'OK' }]
                );
              } catch (error) {
                Alert.alert(
                  'Export Failed',
                  'Could not create emergency export'
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Emergency export failed:', error);
    }
  };

  const handleMatchUpdate = async (
    matchId: string,
    updates: Partial<Match>
  ) => {
    try {
      // Update match offline
      await enhancedOfflineService.updateOffline(
        'matches',
        matchId,
        updates,
        currentSession?.userId || 'offline'
      );

      // Update local state
      setMatches(prev =>
        prev.map(match =>
          match.id === matchId ? { ...match, ...updates } : match
        )
      );

      await updateStatus();
    } catch (error) {
      console.error('Failed to update match:', error);
      Alert.alert(
        'Update Failed',
        'Could not update match. Changes will be retried when online.'
      );
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online':
        return '#28a745';
      case 'offline':
        return '#ffc107';
      case 'error':
        return '#dc3545';
      case 'syncing':
        return '#17a2b8';
      default:
        return '#6c757d';
    }
  };

  const getNetworkQualityIcon = (quality: string): string => {
    switch (quality) {
      case 'excellent':
        return '📶';
      case 'good':
        return '📶';
      case 'poor':
        return '📶';
      case 'offline':
        return '📵';
      default:
        return '📶';
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatOfflineTime = (ms: number): string => {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading tournament data...</Text>
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Tournament not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Connection Status Header */}
      <View style={styles.statusHeader}>
        <View style={styles.connectionStatus}>
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: getStatusColor(
                  connectionStatus.isOnline ? 'online' : 'offline'
                ),
              },
            ]}
          />
          <Text style={styles.statusText}>
            {connectionStatus.isOnline ? 'Online' : 'Offline'}{' '}
            {getNetworkQualityIcon(connectionStatus.networkQuality)}
          </Text>
        </View>

        <Text style={styles.lastSync}>
          Last sync: {formatTimeAgo(connectionStatus.lastSyncTime)}
        </Text>

        {connectionStatus.pendingOperations > 0 && (
          <View style={styles.pendingOperations}>
            <Text style={styles.pendingText}>
              {connectionStatus.pendingOperations} pending changes
            </Text>
            {connectionStatus.syncInProgress && (
              <ActivityIndicator size="small" color="#007bff" />
            )}
          </View>
        )}
      </View>

      {/* Offline Operation Limits Warning */}
      {operationLimits && operationLimits.degradationLevel !== 'full' && (
        <View
          style={[
            styles.warningBanner,
            {
              backgroundColor:
                operationLimits.degradationLevel === 'emergency'
                  ? '#dc3545'
                  : '#ffc107',
            },
          ]}
        >
          <Text
            style={[
              styles.warningText,
              {
                color:
                  operationLimits.degradationLevel === 'emergency'
                    ? '#fff'
                    : '#000',
              },
            ]}
          >
            {operationLimits.degradationLevel === 'emergency'
              ? '⚠️ Emergency Mode: Limited functionality active'
              : '⚠️ Limited Mode: Some features disabled'}
          </Text>
          <Text
            style={[
              styles.warningSubText,
              {
                color:
                  operationLimits.degradationLevel === 'emergency'
                    ? '#fff'
                    : '#000',
              },
            ]}
          >
            Offline: {formatOfflineTime(operationLimits.currentOfflineTime)}
          </Text>
        </View>
      )}

      {/* Tournament Info */}
      <View style={styles.tournamentHeader}>
        <Text style={styles.tournamentName}>{tournament.name}</Text>
        <Text style={styles.tournamentStatus}>
          Status: {tournament.status} • {players.length} players •{' '}
          {matches.length} matches
        </Text>

        {cachedData && (
          <Text style={styles.cacheInfo}>
            Cached: {formatTimeAgo(cachedData.lastUpdated)} • Size:{' '}
            {Math.round(cachedData.sizeBytes / 1024)} KB
          </Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            handleMatchUpdate('example', { status: 'in_progress' })
          }
        >
          <Text style={styles.actionButtonText}>Start Match</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={handleEmergencyExport}
        >
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            Emergency Export
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Matches */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Matches</Text>
        {matches.slice(0, 5).map(match => (
          <View key={match.id} style={styles.matchCard}>
            <View style={styles.matchInfo}>
              <Text style={styles.matchPlayers}>
                {match.player1Name} vs {match.player2Name || 'TBD'}
              </Text>
              <Text style={styles.matchDetails}>
                {match.court && `Court ${match.court} • `}
                Round {match.round} • {match.status}
              </Text>
            </View>

            {match.score && (
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreText}>
                  {Array.isArray(match.score)
                    ? match.score.join('-')
                    : 'In Progress'}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Storage Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storage & Performance</Text>
        <View style={styles.storageInfo}>
          <Text style={styles.storageText}>
            Cache Usage:{' '}
            {Math.round((operationLimits?.storageUsed || 0) / 1024)} KB /
            {Math.round((operationLimits?.maxStorage || 0) / (1024 * 1024))} MB
          </Text>

          {operationLimits?.featuresDisabled.length > 0 && (
            <Text style={styles.disabledFeatures}>
              Disabled: {operationLimits.featuresDisabled.join(', ')}
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
  },
  statusHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  lastSync: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  pendingOperations: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  pendingText: {
    fontSize: 14,
    color: '#007bff',
    marginRight: 8,
  },
  warningBanner: {
    padding: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  warningSubText: {
    fontSize: 12,
  },
  tournamentHeader: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  tournamentName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tournamentStatus: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  cacheInfo: {
    fontSize: 12,
    color: '#999',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  matchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  matchInfo: {
    flex: 1,
  },
  matchPlayers: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  matchDetails: {
    fontSize: 14,
    color: '#666',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007bff',
  },
  storageInfo: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  storageText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  disabledFeatures: {
    fontSize: 12,
    color: '#dc3545',
  },
});

export default OfflineTournamentDashboard;

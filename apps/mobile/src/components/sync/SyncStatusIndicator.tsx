// Sync status indicator for ProTour - Epic 2B Implementation

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSync, useConflictResolution } from '../../contexts/SyncContext';
import ConflictResolutionModal from './ConflictResolutionModal';

interface SyncStatusIndicatorProps {
  style?: any;
  showDetails?: boolean;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  style,
  showDetails = true,
}) => {
  const {
    syncStatus,
    lastSyncTime,
    forceSync,
    isOnline,
    isConnected,
  } = useSync();
  
  const { hasConflicts, conflicts } = useConflictResolution();
  
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [showSyncDetails, setShowSyncDetails] = useState(false);

  // Pulse animation for offline status
  useEffect(() => {
    if (!isOnline) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      
      return () => pulseAnimation.stop();
    }
  }, [isOnline, pulseAnim]);

  const getStatusColor = (): string => {
    if (hasConflicts) return '#dc3545'; // Red for conflicts
    if (!isOnline) return '#ffc107'; // Yellow for offline
    if (syncStatus.syncInProgress) return '#17a2b8'; // Blue for syncing
    if (syncStatus.pendingOperations > 0) return '#fd7e14'; // Orange for pending
    return '#28a745'; // Green for all good
  };

  const getStatusText = (): string => {
    if (hasConflicts) return `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}`;
    if (!isOnline) return 'Offline';
    if (syncStatus.syncInProgress) return 'Syncing...';
    if (syncStatus.pendingOperations > 0) return `${syncStatus.pendingOperations} pending`;
    return 'Synced';
  };

  const getStatusIcon = (): string => {
    if (hasConflicts) return '⚠️';
    if (!isOnline) return '📴';
    if (syncStatus.syncInProgress) return '🔄';
    if (syncStatus.pendingOperations > 0) return '⏳';
    return '✅';
  };

  const handleStatusPress = () => {
    if (hasConflicts) {
      setShowConflictModal(true);
    } else if (showDetails) {
      setShowSyncDetails(!showSyncDetails);
    }
  };

  const handleForceSync = async () => {
    try {
      await forceSync();
    } catch (error) {
      console.error('Force sync failed:', error);
    }
  };

  const formatLastSyncTime = (): string => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return lastSyncTime.toLocaleDateString();
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.statusButton,
          { backgroundColor: getStatusColor() },
          !isOnline && { opacity: pulseAnim },
        ]}
        onPress={handleStatusPress}
        activeOpacity={0.7}
      >
        <View style={styles.statusContent}>
          <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {syncStatus.syncInProgress && (
            <ActivityIndicator
              size="small"
              color="#fff"
              style={styles.spinner}
            />
          )}
        </View>
      </TouchableOpacity>

      {showSyncDetails && (
        <View style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>Sync Status</Text>
            <TouchableOpacity
              onPress={() => setShowSyncDetails(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailsContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Connection:</Text>
              <Text style={[
                styles.detailValue,
                { color: isOnline ? '#28a745' : '#dc3545' }
              ]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last Sync:</Text>
              <Text style={styles.detailValue}>
                {formatLastSyncTime()}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pending:</Text>
              <Text style={styles.detailValue}>
                {syncStatus.pendingOperations} operations
              </Text>
            </View>

            {hasConflicts && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Conflicts:</Text>
                <Text style={[styles.detailValue, { color: '#dc3545' }]}>
                  {conflicts.length} unresolved
                </Text>
              </View>
            )}
          </View>

          <View style={styles.detailsActions}>
            {hasConflicts && (
              <TouchableOpacity
                style={[styles.actionButton, styles.conflictButton]}
                onPress={() => setShowConflictModal(true)}
              >
                <Text style={styles.actionButtonText}>Resolve Conflicts</Text>
              </TouchableOpacity>
            )}
            
            {isOnline && (
              <TouchableOpacity
                style={[styles.actionButton, styles.syncButton]}
                onPress={handleForceSync}
                disabled={syncStatus.syncInProgress}
              >
                <Text style={styles.actionButtonText}>
                  {syncStatus.syncInProgress ? 'Syncing...' : 'Force Sync'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <ConflictResolutionModal
        visible={showConflictModal}
        onClose={() => setShowConflictModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 4,
  },
  detailsCard: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 12,
    color: '#666',
  },
  detailsContent: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  detailsActions: {
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  conflictButton: {
    backgroundColor: '#dc3545',
  },
  syncButton: {
    backgroundColor: '#007bff',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SyncStatusIndicator;
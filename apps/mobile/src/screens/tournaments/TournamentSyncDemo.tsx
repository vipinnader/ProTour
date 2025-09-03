// Tournament sync demo screen for ProTour - Epic 2B Implementation

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {
  useSync,
  usePermissions,
  useConflictResolution,
} from '../../contexts/SyncContext';
import SyncStatusIndicator from '../../components/sync/SyncStatusIndicator';
import ConflictResolutionModal from '../../components/sync/ConflictResolutionModal';
import MultiDeviceManager from '../../components/tournament/MultiDeviceManager';
import AccessCodeJoin from '../../components/tournament/AccessCodeJoin';

const TournamentSyncDemo: React.FC = () => {
  const {
    syncStatus,
    currentSession,
    currentDevice,
    activeDevices,
    forceSync,
    isOnline,
    lastSyncTime,
  } = useSync();

  const { isOrganizer, isReferee, isSpectator, hasPermission, tournamentId } =
    usePermissions();

  const { hasConflicts, conflicts } = useConflictResolution();

  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [showAccessCodeJoin, setShowAccessCodeJoin] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Check permissions when component mounts
    checkPermissions();
  }, [currentSession]);

  const checkPermissions = async () => {
    const permissionList = [
      'manage_tournament',
      'manage_matches',
      'enter_scores',
      'view_tournament',
      'view_matches',
      'view_brackets',
      'delegate_permissions',
    ];

    const permissionResults: Record<string, boolean> = {};

    for (const permission of permissionList) {
      try {
        permissionResults[permission] = await hasPermission(permission);
      } catch {
        permissionResults[permission] = false;
      }
    }

    setPermissions(permissionResults);
  };

  const handleForceSync = async () => {
    try {
      await forceSync();
      Alert.alert('Success', 'Sync completed successfully');
    } catch (error) {
      Alert.alert('Error', 'Sync failed. Please try again.');
    }
  };

  const renderSyncStatus = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sync Status</Text>
      <View style={styles.statusGrid}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Connection</Text>
          <Text
            style={[
              styles.statusValue,
              { color: isOnline ? '#28a745' : '#dc3545' },
            ]}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Pending Operations</Text>
          <Text style={styles.statusValue}>{syncStatus.pendingOperations}</Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Last Sync</Text>
          <Text style={styles.statusValue}>
            {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Conflicts</Text>
          <Text
            style={[
              styles.statusValue,
              { color: hasConflicts ? '#dc3545' : '#28a745' },
            ]}
          >
            {conflicts.length}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            !isOnline && styles.actionButtonDisabled,
          ]}
          onPress={handleForceSync}
          disabled={!isOnline || syncStatus.syncInProgress}
        >
          <Text style={styles.actionButtonText}>
            {syncStatus.syncInProgress ? 'Syncing...' : 'Force Sync'}
          </Text>
        </TouchableOpacity>

        {hasConflicts && (
          <TouchableOpacity
            style={[styles.actionButton, styles.conflictButton]}
            onPress={() => setShowConflictModal(true)}
          >
            <Text style={styles.actionButtonText}>
              Resolve Conflicts ({conflicts.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderDeviceInfo = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Device Information</Text>

      {currentDevice && (
        <View style={styles.deviceCard}>
          <Text style={styles.deviceName}>{currentDevice.deviceName}</Text>
          <Text style={styles.deviceRole}>Role: {currentDevice.role}</Text>
          <Text style={styles.deviceUser}>User: {currentDevice.userId}</Text>

          {currentSession && (
            <>
              <Text style={styles.deviceTournament}>
                Tournament: {currentSession.tournamentId}
              </Text>
              <Text style={styles.deviceSession}>
                Session: {currentSession.sessionId.substring(0, 8)}...
              </Text>
            </>
          )}
        </View>
      )}

      {!currentSession ? (
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => setShowAccessCodeJoin(true)}
        >
          <Text style={styles.joinButtonText}>Join Tournament</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.manageButton}
          onPress={() => setShowDeviceManager(true)}
        >
          <Text style={styles.manageButtonText}>
            Manage Devices ({activeDevices.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPermissions = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Permissions</Text>
      <View style={styles.permissionsGrid}>
        {Object.entries(permissions).map(([permission, hasAccess]) => (
          <View key={permission} style={styles.permissionItem}>
            <Text style={styles.permissionName}>
              {permission
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
            <Text
              style={[
                styles.permissionStatus,
                { color: hasAccess ? '#28a745' : '#dc3545' },
              ]}
            >
              {hasAccess ? '✓' : '✗'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderActiveDevices = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Active Devices ({activeDevices.length})
      </Text>

      {activeDevices.length === 0 ? (
        <Text style={styles.emptyText}>
          No other devices are currently active
        </Text>
      ) : (
        activeDevices.slice(0, 3).map(device => (
          <View key={device.deviceId} style={styles.deviceListItem}>
            <Text style={styles.deviceListName}>{device.deviceName}</Text>
            <Text style={styles.deviceListRole}>{device.role}</Text>
          </View>
        ))
      )}

      {activeDevices.length > 3 && (
        <Text style={styles.moreDevicesText}>
          +{activeDevices.length - 3} more devices
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Epic 2B: Sync & Multi-Device Demo</Text>
        <SyncStatusIndicator style={styles.syncIndicator} />
      </View>

      {renderSyncStatus()}
      {renderDeviceInfo()}
      {renderPermissions()}
      {renderActiveDevices()}

      <View style={styles.demoInfo}>
        <Text style={styles.demoInfoTitle}>Epic 2B Features Demonstrated:</Text>
        <Text style={styles.demoInfoItem}>
          • Offline-first data architecture
        </Text>
        <Text style={styles.demoInfoItem}>
          • Real-time sync with conflict resolution
        </Text>
        <Text style={styles.demoInfoItem}>• Multi-device coordination</Text>
        <Text style={styles.demoInfoItem}>• Role-based access control</Text>
        <Text style={styles.demoInfoItem}>• Device session management</Text>
        <Text style={styles.demoInfoItem}>• Network connectivity handling</Text>
      </View>

      <MultiDeviceManager
        tournamentId={tournamentId || 'demo-tournament'}
        visible={showDeviceManager}
        onClose={() => setShowDeviceManager(false)}
      />

      <AccessCodeJoin
        visible={showAccessCodeJoin}
        onClose={() => setShowAccessCodeJoin(false)}
        onSuccess={session => {
          console.log('Joined tournament:', session);
        }}
      />

      <ConflictResolutionModal
        visible={showConflictModal}
        onClose={() => setShowConflictModal(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  syncIndicator: {
    marginLeft: 12,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  statusItem: {
    flex: 1,
    minWidth: '45%',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#ccc',
  },
  conflictButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deviceRole: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  deviceUser: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  deviceTournament: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  deviceSession: {
    fontSize: 12,
    color: '#999',
  },
  joinButton: {
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  manageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionsGrid: {
    gap: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  permissionName: {
    fontSize: 14,
    color: '#333',
  },
  permissionStatus: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  deviceListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 8,
  },
  deviceListName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  deviceListRole: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  moreDevicesText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  demoInfo: {
    backgroundColor: '#e7f5e7',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  demoInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#155724',
    marginBottom: 12,
  },
  demoInfoItem: {
    fontSize: 14,
    color: '#155724',
    marginBottom: 6,
    paddingLeft: 8,
  },
});

export default TournamentSyncDemo;

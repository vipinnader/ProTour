// AC2B.2.5: Device management dashboard for organizer oversight - Epic 2B Implementation

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useSync } from '../../contexts/SyncContext';
import { multiDeviceService, DeviceInfo } from '@protour/shared';

interface DeviceManagementDashboardProps {
  tournamentId: string;
  visible: boolean;
  onClose: () => void;
}

interface ActivityItem {
  id: string;
  type: 'score_entry' | 'match_start' | 'match_complete' | 'connection' | 'error';
  deviceId: string;
  deviceName: string;
  userId: string;
  matchId?: string;
  timestamp: number;
  details: string;
  timeAgo: string;
}

interface ConnectionStats {
  totalDevices: number;
  refereeDevices: number;
  spectatorDevices: number;
  averageResponseTime: number;
  lastSyncTime: number;
}

const DeviceManagementDashboard: React.FC<DeviceManagementDashboardProps> = ({
  tournamentId,
  visible,
  onClose,
}) => {
  const { currentSession } = useSync();
  const [activeDevices, setActiveDevices] = useState<DeviceInfo[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    totalDevices: 0,
    refereeDevices: 0,
    spectatorDevices: 0,
    averageResponseTime: 0,
    lastSyncTime: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [showDeviceDetails, setShowDeviceDetails] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, tournamentId]);

  const loadData = async () => {
    try {
      const data = await multiDeviceService.getDeviceManagementData(tournamentId);
      setActiveDevices(data.activeDevices);
      setRecentActivity(data.recentActivity);
      setConnectionStats(data.connectionStats);
    } catch (error) {
      console.error('Failed to load device management data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDisconnectDevice = async (deviceId: string, reason = 'Disconnected by organizer') => {
    try {
      await multiDeviceService.disconnectDevice(deviceId, reason);
      Alert.alert('Success', 'Device has been disconnected');
      setShowDisconnectModal(false);
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to disconnect device');
    }
  };

  const handleAssignMatches = async (deviceId: string) => {
    // This would open a modal to select matches to assign
    Alert.alert(
      'Assign Matches',
      'Match assignment feature coming soon',
      [{ text: 'OK' }]
    );
  };

  const getDeviceStatusColor = (device: DeviceInfo): string => {
    const timeSinceLastSeen = Date.now() - device.lastSeen;
    if (timeSinceLastSeen < 30000) return '#28a745'; // Green - very recent
    if (timeSinceLastSeen < 300000) return '#ffc107'; // Yellow - within 5 minutes
    return '#dc3545'; // Red - more than 5 minutes
  };

  const getActivityTypeIcon = (type: string): string => {
    switch (type) {
      case 'score_entry': return '🏓';
      case 'match_start': return '▶️';
      case 'match_complete': return '✅';
      case 'connection': return '🔗';
      case 'error': return '⚠️';
      default: return '📱';
    }
  };

  const getActivityTypeColor = (type: string): string => {
    switch (type) {
      case 'score_entry': return '#007bff';
      case 'match_start': return '#28a745';
      case 'match_complete': return '#6c757d';
      case 'connection': return '#17a2b8';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const formatConnectionTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  const renderDeviceCard = (device: DeviceInfo) => (
    <TouchableOpacity
      key={device.deviceId}
      style={styles.deviceCard}
      onPress={() => {
        setSelectedDevice(device);
        setShowDeviceDetails(true);
      }}
    >
      <View style={styles.deviceCardHeader}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{device.deviceName}</Text>
          <Text style={styles.deviceUser}>{device.userId}</Text>
        </View>
        <View style={styles.deviceStatus}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: getDeviceStatusColor(device) }
          ]} />
          <Text style={styles.deviceRole}>{device.role}</Text>
        </View>
      </View>
      
      <View style={styles.deviceDetails}>
        <Text style={styles.deviceDetail}>
          Last seen: {formatConnectionTime(device.lastSeen)}
        </Text>
        <Text style={styles.deviceDetail}>
          {device.capabilities.length} permissions
        </Text>
      </View>

      <View style={styles.deviceActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.assignButton]}
          onPress={() => handleAssignMatches(device.deviceId)}
        >
          <Text style={styles.actionButtonText}>Assign</Text>
        </TouchableOpacity>
        
        {device.role !== 'organizer' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.disconnectButton]}
            onPress={() => {
              setSelectedDevice(device);
              setShowDisconnectModal(true);
            }}
          >
            <Text style={styles.actionButtonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderActivityItem = ({ item }: { item: ActivityItem }) => (
    <View style={styles.activityItem}>
      <View style={styles.activityIcon}>
        <Text style={styles.activityIconText}>
          {getActivityTypeIcon(item.type)}
        </Text>
      </View>
      
      <View style={styles.activityContent}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>{item.details}</Text>
          <Text style={styles.activityTime}>{item.timeAgo}</Text>
        </View>
        
        <Text style={styles.activitySubtitle}>
          {item.deviceName} • {item.userId}
        </Text>
      </View>
      
      <View style={[
        styles.activityTypeBadge,
        { backgroundColor: getActivityTypeColor(item.type) }
      ]}>
        <Text style={styles.activityTypeText}>
          {item.type.replace('_', ' ')}
        </Text>
      </View>
    </View>
  );

  if (!currentSession || currentSession.role !== 'organizer') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Access Denied</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Only tournament organizers can access device management.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Device Management</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Connection Statistics */}
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Connection Statistics</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{connectionStats.totalDevices}</Text>
                <Text style={styles.statLabel}>Total Devices</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{connectionStats.refereeDevices}</Text>
                <Text style={styles.statLabel}>Referees</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{connectionStats.spectatorDevices}</Text>
                <Text style={styles.statLabel}>Spectators</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>
                  {connectionStats.averageResponseTime.toFixed(1)}s
                </Text>
                <Text style={styles.statLabel}>Avg Response</Text>
              </View>
            </View>
          </View>

          {/* Active Devices */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Active Devices ({activeDevices.length})
            </Text>
            
            {activeDevices.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>
                  No active devices connected.
                </Text>
              </View>
            ) : (
              <View style={styles.devicesContainer}>
                {activeDevices.map(renderDeviceCard)}
              </View>
            )}
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            
            {recentActivity.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>
                  No recent activity.
                </Text>
              </View>
            ) : (
              <FlatList
                data={recentActivity}
                renderItem={renderActivityItem}
                keyExtractor={(item) => item.id}
                style={styles.activityList}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>

        {/* Device Details Modal */}
        <Modal
          visible={showDeviceDetails}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowDeviceDetails(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Device Details</Text>
              <TouchableOpacity
                onPress={() => setShowDeviceDetails(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedDevice && (
              <View style={styles.deviceDetailsContainer}>
                <View style={styles.deviceDetailRow}>
                  <Text style={styles.deviceDetailLabel}>Device Name:</Text>
                  <Text style={styles.deviceDetailValue}>{selectedDevice.deviceName}</Text>
                </View>
                
                <View style={styles.deviceDetailRow}>
                  <Text style={styles.deviceDetailLabel}>User ID:</Text>
                  <Text style={styles.deviceDetailValue}>{selectedDevice.userId}</Text>
                </View>
                
                <View style={styles.deviceDetailRow}>
                  <Text style={styles.deviceDetailLabel}>Role:</Text>
                  <Text style={styles.deviceDetailValue}>{selectedDevice.role}</Text>
                </View>
                
                <View style={styles.deviceDetailRow}>
                  <Text style={styles.deviceDetailLabel}>Last Seen:</Text>
                  <Text style={styles.deviceDetailValue}>
                    {formatConnectionTime(selectedDevice.lastSeen)}
                  </Text>
                </View>
                
                <View style={styles.deviceDetailRow}>
                  <Text style={styles.deviceDetailLabel}>Status:</Text>
                  <View style={[
                    styles.statusIndicator,
                    { backgroundColor: getDeviceStatusColor(selectedDevice) }
                  ]} />
                </View>
                
                <Text style={styles.permissionsTitle}>Permissions:</Text>
                <View style={styles.permissionsList}>
                  {selectedDevice.capabilities.map((permission, index) => (
                    <Text key={index} style={styles.permissionItem}>
                      • {permission.replace(/_/g, ' ')}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        </Modal>

        {/* Disconnect Confirmation Modal */}
        <Modal
          visible={showDisconnectModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowDisconnectModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmationModal}>
              <Text style={styles.confirmationTitle}>Disconnect Device</Text>
              <Text style={styles.confirmationText}>
                Are you sure you want to disconnect{' '}
                {selectedDevice?.deviceName}? This will end their current session.
              </Text>
              
              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={[styles.confirmationButton, styles.cancelButton]}
                  onPress={() => setShowDisconnectModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.confirmationButton, styles.confirmDisconnectButton]}
                  onPress={() => selectedDevice && 
                    handleDisconnectDevice(selectedDevice.deviceId)
                  }
                >
                  <Text style={styles.confirmButtonText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalContainer: {
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 20,
  },
  devicesContainer: {
    gap: 12,
  },
  deviceCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  deviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deviceUser: {
    fontSize: 14,
    color: '#666',
  },
  deviceStatus: {
    alignItems: 'flex-end',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  deviceRole: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    textTransform: 'capitalize',
  },
  deviceDetails: {
    marginBottom: 12,
  },
  deviceDetail: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  assignButton: {
    backgroundColor: '#007bff',
  },
  disconnectButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  activityList: {
    maxHeight: 300,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconText: {
    fontSize: 16,
  },
  activityContent: {
    flex: 1,
    marginRight: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#666',
  },
  activityTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activityTypeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptySection: {
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  deviceDetailsContainer: {
    flex: 1,
    padding: 20,
  },
  deviceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deviceDetailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  deviceDetailValue: {
    fontSize: 14,
    color: '#333',
  },
  permissionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  permissionsList: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  permissionItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  confirmDisconnectButton: {
    backgroundColor: '#dc3545',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default DeviceManagementDashboard;
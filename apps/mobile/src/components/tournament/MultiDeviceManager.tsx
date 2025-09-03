// Multi-device manager for ProTour - Epic 2B Implementation

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Alert,
  Share,
} from 'react-native';
import { useSync, usePermissions } from '../../contexts/SyncContext';
import { DeviceInfo } from '@protour/shared';

interface MultiDeviceManagerProps {
  tournamentId: string;
  visible: boolean;
  onClose: () => void;
}

const MultiDeviceManager: React.FC<MultiDeviceManagerProps> = ({
  tournamentId,
  visible,
  onClose,
}) => {
  const {
    activeDevices,
    generateAccessCode,
    delegatePermissions,
  } = useSync();
  
  const { isOrganizer } = usePermissions();
  
  const [showGenerateCode, setShowGenerateCode] = useState(false);
  const [showDelegatePermissions, setShowDelegatePermissions] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [codeRole, setCodeRole] = useState<'referee' | 'spectator'>('spectator');
  const [expirationMinutes, setExpirationMinutes] = useState('60');
  const [maxUses, setMaxUses] = useState('10');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const availablePermissions = [
    { id: 'enter_scores', label: 'Enter Scores', description: 'Can enter match scores' },
    { id: 'manage_matches', label: 'Manage Matches', description: 'Can start/end matches' },
    { id: 'view_tournament', label: 'View Tournament', description: 'Can view tournament details' },
    { id: 'view_matches', label: 'View Matches', description: 'Can view match details' },
    { id: 'view_brackets', label: 'View Brackets', description: 'Can view tournament brackets' },
    { id: 'referee_tools', label: 'Referee Tools', description: 'Access to referee-specific tools' },
  ];

  const rolePermissions = {
    referee: ['enter_scores', 'manage_matches', 'view_tournament', 'view_matches', 'referee_tools'],
    spectator: ['view_tournament', 'view_matches', 'view_brackets'],
  };

  useEffect(() => {
    // Set default permissions based on role
    setSelectedPermissions(rolePermissions[codeRole]);
  }, [codeRole]);

  const handleGenerateCode = async () => {
    if (!isOrganizer) {
      Alert.alert('Error', 'Only organizers can generate access codes');
      return;
    }

    try {
      const result = await generateAccessCode(tournamentId, codeRole, {
        expirationMinutes: parseInt(expirationMinutes),
        maxUses: parseInt(maxUses),
        permissions: selectedPermissions,
      });

      setGeneratedCode(result.code);
      setShowGenerateCode(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate access code');
    }
  };

  const handleShareCode = async () => {
    if (!generatedCode) return;

    try {
      await Share.share({
        message: `Join ProTour tournament with code: ${generatedCode}`,
        title: 'Tournament Access Code',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleDelegatePermissions = async () => {
    if (!selectedDevice || !isOrganizer) {
      Alert.alert('Error', 'Cannot delegate permissions');
      return;
    }

    try {
      await delegatePermissions(
        selectedDevice.deviceId,
        tournamentId,
        selectedPermissions
      );

      Alert.alert('Success', 'Permissions delegated successfully');
      setShowDelegatePermissions(false);
      setSelectedDevice(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to delegate permissions');
    }
  };

  const formatLastSeen = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'organizer': return '#28a745';
      case 'referee': return '#007bff';
      case 'spectator': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const renderDeviceItem = ({ item }: { item: DeviceInfo }) => (
    <View style={styles.deviceItem}>
      <View style={styles.deviceInfo}>
        <View style={styles.deviceHeader}>
          <Text style={styles.deviceName}>{item.deviceName}</Text>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
            <Text style={styles.roleBadgeText}>{item.role}</Text>
          </View>
        </View>
        
        <Text style={styles.deviceUser}>User: {item.userId}</Text>
        <Text style={styles.deviceLastSeen}>
          Last seen: {formatLastSeen(item.lastSeen)}
        </Text>
        
        <View style={styles.deviceCapabilities}>
          {item.capabilities.slice(0, 3).map((capability, index) => (
            <Text key={index} style={styles.capabilityTag}>
              {capability.replace(/_/g, ' ')}
            </Text>
          ))}
          {item.capabilities.length > 3 && (
            <Text style={styles.capabilityTag}>
              +{item.capabilities.length - 3} more
            </Text>
          )}
        </View>
      </View>

      {isOrganizer && item.role !== 'organizer' && (
        <TouchableOpacity
          style={styles.delegateButton}
          onPress={() => {
            setSelectedDevice(item);
            setShowDelegatePermissions(true);
          }}
        >
          <Text style={styles.delegateButtonText}>Delegate</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPermissionItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.permissionItem,
        selectedPermissions.includes(item.id) && styles.permissionItemSelected
      ]}
      onPress={() => {
        if (selectedPermissions.includes(item.id)) {
          setSelectedPermissions(prev => prev.filter(p => p !== item.id));
        } else {
          setSelectedPermissions(prev => [...prev, item.id]);
        }
      }}
    >
      <View style={styles.permissionInfo}>
        <Text style={styles.permissionLabel}>{item.label}</Text>
        <Text style={styles.permissionDescription}>{item.description}</Text>
      </View>
      <View style={[
        styles.permissionCheckbox,
        selectedPermissions.includes(item.id) && styles.permissionCheckboxSelected
      ]}>
        {selectedPermissions.includes(item.id) && (
          <Text style={styles.permissionCheckmark}>✓</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!isOrganizer && activeDevices.length === 0) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Tournament Devices</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No other devices are currently connected to this tournament.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Tournament Devices ({activeDevices.length})
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {isOrganizer && (
          <View style={styles.organizerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowGenerateCode(true)}
            >
              <Text style={styles.actionButtonText}>Generate Access Code</Text>
            </TouchableOpacity>
          </View>
        )}

        {generatedCode && (
          <View style={styles.generatedCodeCard}>
            <Text style={styles.generatedCodeTitle}>Generated Access Code</Text>
            <Text style={styles.generatedCode}>{generatedCode}</Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareCode}
            >
              <Text style={styles.shareButtonText}>Share Code</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={activeDevices}
          renderItem={renderDeviceItem}
          keyExtractor={(item) => item.deviceId}
          style={styles.devicesList}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No devices are currently connected.
              </Text>
            </View>
          )}
        />

        {/* Generate Code Modal */}
        <Modal
          visible={showGenerateCode}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowGenerateCode(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Generate Access Code</Text>
              <TouchableOpacity
                onPress={() => setShowGenerateCode(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.sectionTitle}>Role</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    codeRole === 'referee' && styles.roleOptionSelected
                  ]}
                  onPress={() => setCodeRole('referee')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    codeRole === 'referee' && styles.roleOptionTextSelected
                  ]}>
                    Referee
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    codeRole === 'spectator' && styles.roleOptionSelected
                  ]}
                  onPress={() => setCodeRole('spectator')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    codeRole === 'spectator' && styles.roleOptionTextSelected
                  ]}>
                    Spectator
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Expiration (minutes)</Text>
              <TextInput
                style={styles.textInput}
                value={expirationMinutes}
                onChangeText={setExpirationMinutes}
                keyboardType="numeric"
                placeholder="60"
              />

              <Text style={styles.sectionTitle}>Max Uses</Text>
              <TextInput
                style={styles.textInput}
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="numeric"
                placeholder="10"
              />

              <Text style={styles.sectionTitle}>Permissions</Text>
              <FlatList
                data={availablePermissions}
                renderItem={renderPermissionItem}
                keyExtractor={(item) => item.id}
                style={styles.permissionsList}
              />

              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleGenerateCode}
              >
                <Text style={styles.generateButtonText}>Generate Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Delegate Permissions Modal */}
        <Modal
          visible={showDelegatePermissions}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowDelegatePermissions(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Delegate Permissions</Text>
              <TouchableOpacity
                onPress={() => setShowDelegatePermissions(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedDevice && (
              <View style={styles.formContainer}>
                <Text style={styles.sectionTitle}>
                  Device: {selectedDevice.deviceName}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  User: {selectedDevice.userId}
                </Text>

                <Text style={styles.sectionTitle}>Additional Permissions</Text>
                <FlatList
                  data={availablePermissions}
                  renderItem={renderPermissionItem}
                  keyExtractor={(item) => item.id}
                  style={styles.permissionsList}
                />

                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={handleDelegatePermissions}
                >
                  <Text style={styles.generateButtonText}>Delegate Permissions</Text>
                </TouchableOpacity>
              </View>
            )}
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
  organizerActions: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  actionButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  generatedCodeCard: {
    margin: 20,
    padding: 16,
    backgroundColor: '#e7f5e7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  generatedCodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#155724',
    marginBottom: 8,
  },
  generatedCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#155724',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  shareButton: {
    backgroundColor: '#28a745',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  devicesList: {
    flex: 1,
  },
  deviceItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  deviceUser: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  deviceLastSeen: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  deviceCapabilities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  capabilityTag: {
    fontSize: 10,
    color: '#666',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    textTransform: 'capitalize',
  },
  delegateButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
  },
  delegateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  roleOptionSelected: {
    borderColor: '#007bff',
    backgroundColor: '#e7f3ff',
  },
  roleOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  roleOptionTextSelected: {
    color: '#007bff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  permissionsList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  permissionItemSelected: {
    borderColor: '#007bff',
    backgroundColor: '#e7f3ff',
  },
  permissionInfo: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  permissionDescription: {
    fontSize: 12,
    color: '#666',
  },
  permissionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionCheckboxSelected: {
    borderColor: '#007bff',
    backgroundColor: '#007bff',
  },
  permissionCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  generateButton: {
    backgroundColor: '#28a745',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MultiDeviceManager;
// Conflict resolution modal for ProTour - Epic 2B Implementation

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { ConflictResolution } from '@protour/shared';
import { useConflictResolution } from '../../contexts/SyncContext';

interface ConflictResolutionModalProps {
  visible: boolean;
  onClose: () => void;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  onClose,
}) => {
  const { conflicts, resolveWithLocal, resolveWithRemote, resolveManually } =
    useConflictResolution();

  const [selectedConflict, setSelectedConflict] =
    useState<ConflictResolution | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleResolveLocal = async (conflictId: string) => {
    try {
      await resolveWithLocal(conflictId);
      Alert.alert('Success', 'Conflict resolved with your version');
      if (conflicts.length === 1) {
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve conflict');
    }
  };

  const handleResolveRemote = async (conflictId: string) => {
    try {
      await resolveWithRemote(conflictId);
      Alert.alert('Success', 'Conflict resolved with server version');
      if (conflicts.length === 1) {
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve conflict');
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatData = (data: any): string => {
    if (!data) return 'No data';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const getConflictSummary = (conflict: ConflictResolution): string => {
    const { collection, documentId } = conflict;
    return `${collection}/${documentId}`;
  };

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Resolve Data Conflicts ({conflicts.length})
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Multiple devices modified the same data. Please choose which version
          to keep.
        </Text>

        <ScrollView style={styles.conflictsList}>
          {conflicts.map(conflict => (
            <View key={conflict.conflictId} style={styles.conflictItem}>
              <View style={styles.conflictHeader}>
                <Text style={styles.conflictTitle}>
                  {getConflictSummary(conflict)}
                </Text>
                <Text style={styles.conflictTime}>
                  {formatTimestamp(conflict.timestamp)}
                </Text>
              </View>

              <View style={styles.versionsContainer}>
                <View style={styles.versionCard}>
                  <Text style={styles.versionTitle}>Your Version (Local)</Text>
                  <Text style={styles.versionPreview}>
                    {formatData(conflict.localVersion).substring(0, 100)}
                    {formatData(conflict.localVersion).length > 100
                      ? '...'
                      : ''}
                  </Text>
                  <TouchableOpacity
                    style={[styles.resolveButton, styles.localButton]}
                    onPress={() => handleResolveLocal(conflict.conflictId)}
                  >
                    <Text style={styles.resolveButtonText}>
                      Use This Version
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.versionCard}>
                  <Text style={styles.versionTitle}>
                    Server Version (Remote)
                  </Text>
                  <Text style={styles.versionPreview}>
                    {formatData(conflict.remoteVersion).substring(0, 100)}
                    {formatData(conflict.remoteVersion).length > 100
                      ? '...'
                      : ''}
                  </Text>
                  <TouchableOpacity
                    style={[styles.resolveButton, styles.remoteButton]}
                    onPress={() => handleResolveRemote(conflict.conflictId)}
                  >
                    <Text style={styles.resolveButtonText}>
                      Use This Version
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => {
                  setSelectedConflict(conflict);
                  setShowDetails(true);
                }}
              >
                <Text style={styles.detailsButtonText}>View Full Details</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Details Modal */}
        <Modal
          visible={showDetails}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowDetails(false)}
        >
          {selectedConflict && (
            <View style={styles.detailsContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Conflict Details</Text>
                <TouchableOpacity
                  onPress={() => setShowDetails(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.detailsContent}>
                <Text style={styles.detailsTitle}>Document:</Text>
                <Text style={styles.detailsValue}>
                  {getConflictSummary(selectedConflict)}
                </Text>

                <Text style={styles.detailsTitle}>Conflict Time:</Text>
                <Text style={styles.detailsValue}>
                  {formatTimestamp(selectedConflict.timestamp)}
                </Text>

                <Text style={styles.detailsTitle}>Your Version (Local):</Text>
                <View style={styles.codeBlock}>
                  <Text style={styles.codeText}>
                    {formatData(selectedConflict.localVersion)}
                  </Text>
                </View>

                <Text style={styles.detailsTitle}>
                  Server Version (Remote):
                </Text>
                <View style={styles.codeBlock}>
                  <Text style={styles.codeText}>
                    {formatData(selectedConflict.remoteVersion)}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.detailsActions}>
                <TouchableOpacity
                  style={[styles.resolveButton, styles.localButton]}
                  onPress={() => {
                    handleResolveLocal(selectedConflict.conflictId);
                    setShowDetails(false);
                  }}
                >
                  <Text style={styles.resolveButtonText}>
                    Use Local Version
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.resolveButton, styles.remoteButton]}
                  onPress={() => {
                    handleResolveRemote(selectedConflict.conflictId);
                    setShowDetails(false);
                  }}
                >
                  <Text style={styles.resolveButtonText}>
                    Use Remote Version
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#fff3cd',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  conflictsList: {
    flex: 1,
    padding: 20,
  },
  conflictItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  conflictHeader: {
    marginBottom: 12,
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  conflictTime: {
    fontSize: 12,
    color: '#999',
  },
  versionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  versionCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  versionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  versionPreview: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace',
    marginBottom: 8,
    lineHeight: 16,
  },
  resolveButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  localButton: {
    backgroundColor: '#28a745',
  },
  remoteButton: {
    backgroundColor: '#007bff',
  },
  resolveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  detailsButtonText: {
    color: '#6c757d',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  detailsContent: {
    flex: 1,
    padding: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  detailsValue: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  codeBlock: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#495057',
    lineHeight: 18,
  },
  detailsActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});

export default ConflictResolutionModal;

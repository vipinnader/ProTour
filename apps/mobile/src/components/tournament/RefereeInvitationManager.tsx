// Referee Invitation Manager for Story 2B.2 - AC2B.2.1 & AC2B.2.2
// Organizer interface for creating and managing referee invitations

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { refereeAccessService, RefereeInvitation, RefereePermissions } from '@protour/shared';
import { useSync } from '../../contexts/SyncContext';

interface RefereeInvitationManagerProps {
  tournamentId: string;
  tournamentName: string;
  matches: Array<{ id: string; player1Name: string; player2Name?: string; round: number; court?: string }>;
  onInvitationCreated?: (invitation: RefereeInvitation) => void;
}

interface InvitationFormData {
  email: string;
  phone: string;
  assignedMatches: string[];
  canStartMatches: boolean;
  canCompleteMatches: boolean;
  canEditScores: boolean;
  canViewAllMatches: boolean;
  maxConcurrentMatches: number;
  validityHours: number;
  customMessage: string;
}

const RefereeInvitationManager: React.FC<RefereeInvitationManagerProps> = ({
  tournamentId,
  tournamentName,
  matches,
  onInvitationCreated,
}) => {
  const { currentSession } = useSync();
  const [invitations, setInvitations] = useState<RefereeInvitation[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<RefereeInvitation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<InvitationFormData>({
    email: '',
    phone: '',
    assignedMatches: [],
    canStartMatches: true,
    canCompleteMatches: true,
    canEditScores: true,
    canViewAllMatches: false,
    maxConcurrentMatches: 3,
    validityHours: 24,
    customMessage: '',
  });

  useEffect(() => {
    loadInvitations();
  }, [tournamentId]);

  const loadInvitations = async () => {
    try {
      const tournamentInvitations = refereeAccessService.getTournamentInvitations(tournamentId);
      setInvitations(tournamentInvitations);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const handleCreateInvitation = async () => {
    if (formData.assignedMatches.length === 0) {
      Alert.alert('Error', 'Please assign at least one match to the referee');
      return;
    }

    try {
      setIsLoading(true);

      const permissions: RefereePermissions = {
        assignedMatches: formData.assignedMatches,
        canStartMatches: formData.canStartMatches,
        canCompleteMatches: formData.canCompleteMatches,
        canEditScores: formData.canEditScores,
        canViewAllMatches: formData.canViewAllMatches,
        canAccessPlayerInfo: true,
        maxConcurrentMatches: formData.maxConcurrentMatches,
        restrictions: {},
      };

      const invitation = await refereeAccessService.createRefereeInvitation(
        tournamentId,
        currentSession?.userId || 'organizer',
        permissions,
        {
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          validityHours: formData.validityHours,
          customMessage: formData.customMessage || undefined,
        }
      );

      await loadInvitations();

      // Reset form
      setFormData({
        email: '',
        phone: '',
        assignedMatches: [],
        canStartMatches: true,
        canCompleteMatches: true,
        canEditScores: true,
        canViewAllMatches: false,
        maxConcurrentMatches: 3,
        validityHours: 24,
        customMessage: '',
      });

      setShowCreateForm(false);

      Alert.alert(
        'Invitation Created',
        `Access code: ${invitation.accessCode}\n\nWould you like to share this invitation?`,
        [
          { text: 'Later', style: 'cancel' },
          { 
            text: 'Share',
            onPress: () => shareInvitation(invitation)
          },
          {
            text: 'QR Code',
            onPress: () => showQRCode(invitation)
          }
        ]
      );

      if (onInvitationCreated) {
        onInvitationCreated(invitation);
      }

    } catch (error) {
      console.error('Failed to create invitation:', error);
      Alert.alert('Error', 'Failed to create referee invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const shareInvitation = async (invitation: RefereeInvitation) => {
    try {
      const message = `You're invited to referee matches in "${tournamentName}". 

Access code: ${invitation.accessCode}
Expires: ${new Date(invitation.expiresAt).toLocaleString()}

Download the ProTour app and use this code to join.`;

      await Share.share({
        message,
        title: 'Tournament Referee Invitation',
      });
    } catch (error) {
      console.error('Failed to share invitation:', error);
    }
  };

  const showQRCode = (invitation: RefereeInvitation) => {
    setSelectedInvitation(invitation);
    setShowQRModal(true);
  };

  const handleRevokeInvitation = async (invitation: RefereeInvitation) => {
    Alert.alert(
      'Revoke Invitation',
      `Are you sure you want to revoke the invitation for ${invitation.refereeEmail || invitation.accessCode}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              // If invitation has been accepted, revoke referee access
              if (invitation.status === 'accepted') {
                await refereeAccessService.revokeRefereeAccess(
                  invitation.id,
                  'Invitation revoked by organizer'
                );
              }
              
              await loadInvitations();
              Alert.alert('Success', 'Invitation has been revoked');
            } catch (error) {
              Alert.alert('Error', 'Failed to revoke invitation');
            }
          }
        }
      ]
    );
  };

  const toggleMatchAssignment = (matchId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedMatches: prev.assignedMatches.includes(matchId)
        ? prev.assignedMatches.filter(id => id !== matchId)
        : [...prev.assignedMatches, matchId]
    }));
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'accepted': return '#28a745';
      case 'expired': return '#6c757d';
      case 'revoked': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Active';
      case 'expired': return 'Expired';
      case 'revoked': return 'Revoked';
      default: return status;
    }
  };

  const renderInvitation = ({ item }: { item: RefereeInvitation }) => (
    <View style={styles.invitationCard}>
      <View style={styles.invitationHeader}>
        <View style={styles.invitationInfo}>
          <Text style={styles.invitationCode}>Code: {item.accessCode}</Text>
          <Text style={styles.invitationContact}>
            {item.refereeEmail || item.refereePhone || 'No contact info'}
          </Text>
          <Text style={styles.invitationExpiry}>
            Expires: {new Date(item.expiresAt).toLocaleString()}
          </Text>
        </View>
        
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) }
        ]}>
          <Text style={styles.statusBadgeText}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.invitationDetails}>
        <Text style={styles.assignedMatchesText}>
          Assigned matches: {item.permissions.assignedMatches.length}
        </Text>
        <Text style={styles.permissionsText}>
          Permissions: {[
            item.permissions.canStartMatches && 'Start',
            item.permissions.canCompleteMatches && 'Complete',
            item.permissions.canEditScores && 'Edit Scores',
            item.permissions.canViewAllMatches && 'View All',
          ].filter(Boolean).join(', ')}
        </Text>
      </View>
      
      <View style={styles.invitationActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => shareInvitation(item)}
        >
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => showQRCode(item)}
        >
          <Text style={styles.actionButtonText}>QR Code</Text>
        </TouchableOpacity>
        
        {item.status !== 'revoked' && item.status !== 'expired' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.revokeButton]}
            onPress={() => handleRevokeInvitation(item)}
          >
            <Text style={styles.actionButtonText}>Revoke</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderMatchSelector = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.matchItem,
        formData.assignedMatches.includes(item.id) && styles.matchItemSelected
      ]}
      onPress={() => toggleMatchAssignment(item.id)}
    >
      <View style={styles.matchInfo}>
        <Text style={styles.matchText}>
          {item.player1Name} vs {item.player2Name || 'TBD'}
        </Text>
        <Text style={styles.matchDetails}>
          Round {item.round} {item.court && `• Court ${item.court}`}
        </Text>
      </View>
      
      <View style={[
        styles.checkbox,
        formData.assignedMatches.includes(item.id) && styles.checkboxSelected
      ]}>
        {formData.assignedMatches.includes(item.id) && (
          <Text style={styles.checkboxText}>✓</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!currentSession || currentSession.role !== 'organizer') {
    return (
      <View style={styles.accessDenied}>
        <Text style={styles.accessDeniedText}>
          Only tournament organizers can manage referee invitations
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Referee Invitations</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateForm(true)}
        >
          <Text style={styles.createButtonText}>+ Create Invitation</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={invitations}
        renderItem={renderInvitation}
        keyExtractor={(item) => item.id}
        style={styles.invitationsList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No referee invitations created yet
            </Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => setShowCreateForm(true)}
            >
              <Text style={styles.createFirstButtonText}>Create First Invitation</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Create Invitation Form Modal */}
      <Modal
        visible={showCreateForm}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowCreateForm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Referee Invitation</Text>
            <TouchableOpacity
              onPress={() => setShowCreateForm(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            {/* Contact Information */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Contact Information (Optional)</Text>
              
              <TextInput
                style={styles.textInput}
                placeholder="Email address"
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <TextInput
                style={styles.textInput}
                placeholder="Phone number"
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />
            </View>

            {/* Match Assignment */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>
                Assigned Matches ({formData.assignedMatches.length} selected)
              </Text>
              
              <FlatList
                data={matches}
                renderItem={renderMatchSelector}
                keyExtractor={(item) => item.id}
                style={styles.matchSelectorList}
                scrollEnabled={false}
              />
            </View>

            {/* Permissions */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Permissions</Text>
              
              <View style={styles.permissionsList}>
                {[
                  { key: 'canStartMatches', label: 'Can start matches' },
                  { key: 'canCompleteMatches', label: 'Can complete matches' },
                  { key: 'canEditScores', label: 'Can edit scores' },
                  { key: 'canViewAllMatches', label: 'Can view all matches (spectate)' },
                ].map((permission) => (
                  <TouchableOpacity
                    key={permission.key}
                    style={styles.permissionItem}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      [permission.key]: !prev[permission.key as keyof InvitationFormData]
                    }))}
                  >
                    <View style={[
                      styles.checkbox,
                      formData[permission.key as keyof InvitationFormData] && styles.checkboxSelected
                    ]}>
                      {formData[permission.key as keyof InvitationFormData] && (
                        <Text style={styles.checkboxText}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.permissionLabel}>{permission.label}</Text>
                  </TouchableOpacity>
                ))}
              </div>
            </View>

            {/* Settings */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Settings</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Max concurrent matches:</Text>
                <View style={styles.numberInput}>
                  <TouchableOpacity
                    style={styles.numberButton}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      maxConcurrentMatches: Math.max(1, prev.maxConcurrentMatches - 1)
                    }))}
                  >
                    <Text style={styles.numberButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.numberValue}>{formData.maxConcurrentMatches}</Text>
                  <TouchableOpacity
                    style={styles.numberButton}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      maxConcurrentMatches: Math.min(10, prev.maxConcurrentMatches + 1)
                    }))}
                  >
                    <Text style={styles.numberButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Validity (hours):</Text>
                <View style={styles.numberInput}>
                  <TouchableOpacity
                    style={styles.numberButton}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      validityHours: Math.max(1, prev.validityHours - 1)
                    }))}
                  >
                    <Text style={styles.numberButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.numberValue}>{formData.validityHours}</Text>
                  <TouchableOpacity
                    style={styles.numberButton}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      validityHours: Math.min(72, prev.validityHours + 1)
                    }))}
                  >
                    <Text style={styles.numberButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Custom Message */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Custom Message (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Add a custom message to the invitation..."
                value={formData.customMessage}
                onChangeText={(text) => setFormData(prev => ({ ...prev, customMessage: text }))}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleCreateInvitation}
              disabled={isLoading || formData.assignedMatches.length === 0}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Creating...' : 'Create Invitation'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContainer}>
            <Text style={styles.qrModalTitle}>Referee Access QR Code</Text>
            
            {selectedInvitation && (
              <>
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={selectedInvitation.qrCodeData}
                    size={200}
                    backgroundColor="white"
                    color="black"
                  />
                </View>
                
                <Text style={styles.qrCodeText}>
                  Access Code: {selectedInvitation.accessCode}
                </Text>
                <Text style={styles.qrExpiryText}>
                  Expires: {new Date(selectedInvitation.expiresAt).toLocaleString()}
                </Text>
                
                <View style={styles.qrModalButtons}>
                  <TouchableOpacity
                    style={styles.qrModalButton}
                    onPress={() => shareInvitation(selectedInvitation)}
                  >
                    <Text style={styles.qrModalButtonText}>Share</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.qrModalButton, styles.qrCloseButton]}
                    onPress={() => setShowQRModal(false)}
                  >
                    <Text style={styles.qrModalButtonText}>Close</Text>
                  </TouchableOpacity>
                </div>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
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
  createButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  invitationsList: {
    flex: 1,
    padding: 20,
  },
  invitationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  invitationContact: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  invitationExpiry: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  invitationDetails: {
    marginBottom: 12,
  },
  assignedMatchesText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  permissionsText: {
    fontSize: 12,
    color: '#666',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  revokeButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  createFirstButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
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
  formContainer: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  matchSelectorList: {
    maxHeight: 200,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 8,
  },
  matchItemSelected: {
    borderColor: '#007bff',
    backgroundColor: '#f8f9ff',
  },
  matchInfo: {
    flex: 1,
  },
  matchText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  matchDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  checkboxText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  permissionsList: {
    gap: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionLabel: {
    fontSize: 14,
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 14,
    color: '#333',
  },
  numberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  numberValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#007bff',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    width: '90%',
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  qrCodeContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
  },
  qrCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  qrExpiryText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  qrModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  qrModalButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  qrCloseButton: {
    backgroundColor: '#6c757d',
  },
  qrModalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RefereeInvitationManager;
// Conflict Resolution Interface for Story 2B.4 - AC2B.4.4
// User-friendly interface for manual conflict resolution

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  advancedConflictResolutionService,
  ConflictMetadata,
  ConflictAnalysis,
  ConflictResolutionOption,
} from '@protour/shared';
import { useSync } from '../../contexts/SyncContext';

interface ConflictResolutionInterfaceProps {
  visible: boolean;
  conflict: ConflictMetadata | null;
  analysis: ConflictAnalysis | null;
  resolutionOptions: ConflictResolutionOption[];
  onResolve: (conflictId: string, option: ConflictResolutionOption) => void;
  onClose: () => void;
}

const ConflictResolutionInterface: React.FC<ConflictResolutionInterfaceProps> = ({
  visible,
  conflict,
  analysis,
  resolutionOptions,
  onResolve,
  onClose,
}) => {
  const { currentSession } = useSync();
  const [selectedOption, setSelectedOption] = useState<ConflictResolutionOption | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (resolutionOptions.length > 0) {
      setSelectedOption(resolutionOptions[0]); // Select recommended option by default
    }
  }, [resolutionOptions]);

  const handleResolve = async () => {
    if (!conflict || !selectedOption || !currentSession) return;

    Alert.alert(
      'Confirm Resolution',
      `Are you sure you want to resolve this conflict using "${selectedOption.label}"?\n\nConsequences:\n${selectedOption.consequences.join('\n')}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            setIsResolving(true);
            try {
              await advancedConflictResolutionService.resolveConflictManually(
                conflict.conflictId,
                selectedOption,
                currentSession.userId
              );
              onResolve(conflict.conflictId, selectedOption);
            } catch (error) {
              Alert.alert('Resolution Failed', 'Unable to resolve conflict. Please try again.');
            } finally {
              setIsResolving(false);
            }
          }
        }
      ]
    );
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'simultaneous_edit': return '⚡';
      case 'permission_override': return '🔒';
      case 'network_partition': return '🌐';
      case 'clock_skew': return '⏰';
      case 'data_corruption': return '🔧';
      default: return '⚠️';
    }
  };

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'high': return '#dc3545';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const renderConflictDetails = () => {
    if (!conflict || !analysis) return null;

    return (
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>Conflict Details</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type:</Text>
          <Text style={styles.detailValue}>
            {getTypeIcon(conflict.type)} {conflict.type.replace('_', ' ')}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Detected:</Text>
          <Text style={styles.detailValue}>
            {formatTimestamp(conflict.detectedAt)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Involved Users:</Text>
          <Text style={styles.detailValue}>
            {conflict.involvedUsers.join(', ')}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Affected Document:</Text>
          <Text style={styles.detailValue}>
            {conflict.collection}/{conflict.documentId}
          </Text>
        </View>

        {/* Risk Assessment */}
        <View style={styles.riskAssessment}>
          <Text style={styles.riskTitle}>Risk Assessment</Text>
          
          <View style={styles.riskRow}>
            <Text style={styles.riskLabel}>Data Loss Risk:</Text>
            <View style={[
              styles.riskBadge,
              { backgroundColor: getRiskColor(analysis.riskAssessment.dataLossRisk) }
            ]}>
              <Text style={styles.riskBadgeText}>
                {analysis.riskAssessment.dataLossRisk.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <View style={styles.riskRow}>
            <Text style={styles.riskLabel}>Tournament Impact:</Text>
            <Text style={[
              styles.riskValue,
              { color: analysis.riskAssessment.tournamentImpact === 'severe' ? '#dc3545' : '#666' }
            ]}>
              {analysis.riskAssessment.tournamentImpact}
            </Text>
          </View>
          
          <View style={styles.riskRow}>
            <Text style={styles.riskLabel}>Urgency:</Text>
            <Text style={[
              styles.riskValue,
              { color: analysis.riskAssessment.urgency === 'critical' ? '#dc3545' : '#666' }
            ]}>
              {analysis.riskAssessment.urgency}
            </Text>
          </View>
        </View>

        {/* Clock Sync Status */}
        {!analysis.clockSyncStatus.isInSync && (
          <View style={styles.clockSyncWarning}>
            <Text style={styles.warningText}>
              ⚠️ Device clocks are not synchronized (max deviation: {analysis.clockSyncStatus.maxDeviation}ms)
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderResolutionOption = (option: ConflictResolutionOption, isRecommended: boolean) => (
    <TouchableOpacity
      key={option.id}
      style={[
        styles.optionCard,
        selectedOption?.id === option.id && styles.optionCardSelected,
        isRecommended && styles.recommendedOption,
      ]}
      onPress={() => setSelectedOption(option)}
      activeOpacity={0.7}
    >
      <View style={styles.optionHeader}>
        <View style={styles.optionTitleContainer}>
          <Text style={[
            styles.optionTitle,
            selectedOption?.id === option.id && styles.optionTitleSelected
          ]}>
            {option.label}
            {isRecommended && (
              <Text style={styles.recommendedLabel}> (Recommended)</Text>
            )}
          </Text>
        </View>
        
        <View style={styles.optionMeta}>
          <View style={[
            styles.confidenceBadge,
            { backgroundColor: option.confidence > 80 ? '#28a745' : option.confidence > 60 ? '#ffc107' : '#dc3545' }
          ]}>
            <Text style={styles.confidenceBadgeText}>
              {option.confidence}%
            </Text>
          </View>
          
          <View style={[
            styles.riskBadge,
            { backgroundColor: getRiskColor(option.riskLevel) }
          ]}>
            <Text style={styles.riskBadgeText}>
              {option.riskLevel.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      
      <Text style={styles.optionDescription}>
        {option.description}
      </Text>
      
      {option.consequences.length > 0 && (
        <View style={styles.consequencesContainer}>
          <Text style={styles.consequencesTitle}>Consequences:</Text>
          {option.consequences.map((consequence, index) => (
            <Text key={index} style={styles.consequenceItem}>
              • {consequence}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  if (!conflict || !analysis) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Resolve Conflict</Text>
            <View style={[
              styles.severityBadge,
              { backgroundColor: getSeverityColor(conflict.severity) }
            ]}>
              <Text style={styles.severityBadgeText}>
                {conflict.severity.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Conflict Overview */}
          <View style={styles.overviewContainer}>
            <Text style={styles.overviewTitle}>
              {getTypeIcon(conflict.type)} Conflict Detected
            </Text>
            <Text style={styles.overviewDescription}>
              Multiple users have made conflicting changes to the same data. 
              Please select how you would like to resolve this conflict.
            </Text>
          </View>

          {/* Resolution Options */}
          <View style={styles.optionsContainer}>
            <Text style={styles.sectionTitle}>Resolution Options</Text>
            {resolutionOptions.map((option, index) => 
              renderResolutionOption(option, index === 0)
            )}
          </View>

          {/* Details Toggle */}
          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => setShowDetails(!showDetails)}
          >
            <Text style={styles.detailsToggleText}>
              {showDetails ? 'Hide Details' : 'Show Details'} {showDetails ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>

          {showDetails && renderConflictDetails()}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionButton, 
              styles.resolveButton,
              (!selectedOption || isResolving) && styles.actionButtonDisabled
            ]}
            onPress={handleResolve}
            disabled={!selectedOption || isResolving}
          >
            {isResolving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.resolveButtonText}>
                Resolve Conflict
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
    padding: 20,
  },
  overviewContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  overviewDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  optionCardSelected: {
    borderColor: '#007bff',
    backgroundColor: '#f8f9ff',
  },
  recommendedOption: {
    borderColor: '#28a745',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  optionTitleContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  optionTitleSelected: {
    color: '#007bff',
  },
  recommendedLabel: {
    color: '#28a745',
    fontSize: 12,
  },
  optionMeta: {
    flexDirection: 'row',
    gap: 6,
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confidenceBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  riskBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  consequencesContainer: {
    marginTop: 8,
  },
  consequencesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  consequenceItem: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  detailsToggle: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  detailsToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007bff',
  },
  detailsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  riskAssessment: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  riskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  riskLabel: {
    fontSize: 14,
    color: '#666',
  },
  riskValue: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  clockSyncWarning: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  resolveButton: {
    backgroundColor: '#007bff',
  },
  actionButtonDisabled: {
    backgroundColor: '#6c757d',
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  resolveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ConflictResolutionInterface;
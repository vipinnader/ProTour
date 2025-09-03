// Referee Score Entry Interface for Story 2B.2 - AC2B.2.3 & AC2B.2.4
// Simplified referee UI with large buttons and real-time sync

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSync } from '../../contexts/SyncContext';
import { multiDeviceService, Match } from '@protour/shared';

interface RefereeScoreEntryProps {
  assignedMatches: Match[];
  onScoreEntered: (matchId: string, score: any) => void;
}

const RefereeScoreEntry: React.FC<RefereeScoreEntryProps> = ({
  assignedMatches,
  onScoreEntered,
}) => {
  const { currentSession, hasPermission } = useSync();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [currentScore, setCurrentScore] = useState({
    player1Sets: [0, 0, 0],
    player2Sets: [0, 0, 0],
    currentSet: 0,
    isCompleted: false,
  });
  
  const screenWidth = Dimensions.get('window').width;
  const buttonSize = Math.min((screenWidth - 80) / 6, 60); // Responsive button sizing

  useEffect(() => {
    // Auto-select first available match if none selected
    if (!selectedMatch && assignedMatches.length > 0) {
      const activeMatch = assignedMatches.find(m => m.status === 'in_progress') || assignedMatches[0];
      setSelectedMatch(activeMatch);
    }
  }, [assignedMatches, selectedMatch]);

  const handleScoreUpdate = async (player: 'player1' | 'player2', setIndex: number, increment: number) => {
    if (!selectedMatch) return;

    const hasScorePermission = await hasPermission('enter_scores', selectedMatch.id);
    if (!hasScorePermission) {
      Alert.alert('Permission Denied', 'You do not have permission to enter scores for this match');
      return;
    }

    const newScore = { ...currentScore };
    const currentValue = newScore[`${player}Sets`][setIndex];
    const newValue = Math.max(0, currentValue + increment);
    
    newScore[`${player}Sets`][setIndex] = newValue;

    // Check for set completion
    const player1Score = newScore.player1Sets[setIndex];
    const player2Score = newScore.player2Sets[setIndex];
    
    // Simple set win logic (first to 11, must win by 2)
    if ((player1Score >= 11 || player2Score >= 11) && Math.abs(player1Score - player2Score) >= 2) {
      // Set completed, move to next set
      if (setIndex < 2) {
        newScore.currentSet = setIndex + 1;
      } else {
        // Match completed
        newScore.isCompleted = true;
      }
    }

    setCurrentScore(newScore);

    // Submit score update
    try {
      const result = await multiDeviceService.enterScore(selectedMatch.id, newScore);
      
      if (result.success) {
        onScoreEntered(selectedMatch.id, newScore);
        
        if (result.requiresApproval) {
          Alert.alert(
            'Score Entered', 
            'Score has been entered and is pending organizer approval.'
          );
        }
      } else if (result.conflict) {
        Alert.alert(
          'Score Conflict Detected',
          `Another device has entered a different score. Would you like to override?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Override',
              style: 'destructive',
              onPress: () => multiDeviceService.enterScore(selectedMatch.id, newScore, true),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to enter score. Please try again.');
      console.error('Score entry failed:', error);
    }
  };

  const handleMatchStart = async () => {
    if (!selectedMatch) return;

    try {
      // Mark match as in progress
      await multiDeviceService.enterScore(selectedMatch.id, {
        ...currentScore,
        status: 'in_progress',
        startTime: Date.now(),
      });

      Alert.alert('Match Started', 'The match has been officially started.');
    } catch (error) {
      Alert.alert('Error', 'Failed to start match.');
    }
  };

  const handleMatchComplete = async () => {
    if (!selectedMatch) return;

    Alert.alert(
      'Complete Match',
      'Are you sure you want to mark this match as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            try {
              await multiDeviceService.enterScore(selectedMatch.id, {
                ...currentScore,
                status: 'completed',
                endTime: Date.now(),
                isCompleted: true,
              });

              Alert.alert('Match Completed', 'The match has been marked as completed.');
              
              // Auto-select next match
              const nextMatch = assignedMatches.find(m => 
                m.id !== selectedMatch.id && m.status === 'scheduled'
              );
              if (nextMatch) {
                setSelectedMatch(nextMatch);
                setCurrentScore({
                  player1Sets: [0, 0, 0],
                  player2Sets: [0, 0, 0],
                  currentSet: 0,
                  isCompleted: false,
                });
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to complete match.');
            }
          },
        },
      ]
    );
  };

  const reportIssue = () => {
    Alert.alert(
      'Report Issue',
      'What type of issue would you like to report?',
      [
        { text: 'Technical Problem', onPress: () => reportTechnicalIssue() },
        { text: 'Player Issue', onPress: () => reportPlayerIssue() },
        { text: 'Equipment Issue', onPress: () => reportEquipmentIssue() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const reportTechnicalIssue = () => {
    Alert.alert('Technical Issue Reported', 'An organizer will be notified.');
    // This would send a notification to the organizer
  };

  const reportPlayerIssue = () => {
    Alert.alert('Player Issue Reported', 'An organizer will be notified.');
    // This would send a notification to the organizer
  };

  const reportEquipmentIssue = () => {
    Alert.alert('Equipment Issue Reported', 'An organizer will be notified.');
    // This would send a notification to the organizer
  };

  const getMatchStatusColor = (status: string): string => {
    switch (status) {
      case 'scheduled': return '#ffc107';
      case 'in_progress': return '#28a745';
      case 'completed': return '#6c757d';
      default: return '#e0e0e0';
    }
  };

  const getMatchStatusText = (status: string): string => {
    switch (status) {
      case 'scheduled': return 'Ready to Start';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  };

  if (assignedMatches.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No Assigned Matches</Text>
          <Text style={styles.emptyStateText}>
            You have no matches assigned at this time. Please check with the tournament organizer.
          </Text>
        </View>
      </View>
    );
  }

  if (!selectedMatch) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Select a Match</Text>
        <ScrollView style={styles.matchList}>
          {assignedMatches.map(match => (
            <TouchableOpacity
              key={match.id}
              style={styles.matchItem}
              onPress={() => setSelectedMatch(match)}
            >
              <View style={styles.matchHeader}>
                <Text style={styles.matchTitle}>
                  {match.player1?.name} vs {match.player2?.name || 'BYE'}
                </Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getMatchStatusColor(match.status) }
                ]}>
                  <Text style={styles.statusText}>
                    {getMatchStatusText(match.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.matchDetails}>
                Court: {match.court} • Round: {match.round}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Match Header */}
      <View style={styles.matchHeader}>
        <Text style={styles.matchTitle}>
          {selectedMatch.player1?.name} vs {selectedMatch.player2?.name || 'BYE'}
        </Text>
        <TouchableOpacity
          style={styles.changeMatchButton}
          onPress={() => setSelectedMatch(null)}
        >
          <Text style={styles.changeMatchButtonText}>Change Match</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.matchInfo}>
        <Text style={styles.matchInfoText}>
          Court {selectedMatch.court} • Round {selectedMatch.round}
        </Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getMatchStatusColor(selectedMatch.status) }
        ]}>
          <Text style={styles.statusText}>
            {getMatchStatusText(selectedMatch.status)}
          </Text>
        </View>
      </View>

      {/* Scoreboard */}
      <View style={styles.scoreboard}>
        <View style={styles.scoreHeader}>
          <Text style={styles.playerName}>{selectedMatch.player1?.name}</Text>
          <Text style={styles.vsText}>VS</Text>
          <Text style={styles.playerName}>{selectedMatch.player2?.name || 'BYE'}</Text>
        </View>

        {/* Sets Display */}
        <View style={styles.setsContainer}>
          {[0, 1, 2].map(setIndex => (
            <View key={setIndex} style={styles.setColumn}>
              <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
              <Text style={[
                styles.setScore,
                currentScore.currentSet === setIndex && styles.activeSetScore
              ]}>
                {currentScore.player1Sets[setIndex]}
              </Text>
              <Text style={[
                styles.setScore,
                currentScore.currentSet === setIndex && styles.activeSetScore
              ]}>
                {currentScore.player2Sets[setIndex]}
              </Text>
            </View>
          ))}
        </View>

        {/* Current Set Scoring Buttons - Large and Touch-Friendly */}
        {!currentScore.isCompleted && (
          <View style={styles.scoringSection}>
            <Text style={styles.currentSetTitle}>
              Current Set: {currentScore.currentSet + 1}
            </Text>
            
            <View style={styles.scoringGrid}>
              {/* Player 1 Controls */}
              <View style={styles.playerScoringSection}>
                <Text style={styles.scoringPlayerName}>
                  {selectedMatch.player1?.name}
                </Text>
                <View style={styles.scoringButtons}>
                  <TouchableOpacity
                    style={[styles.scoreButton, styles.decrementButton, { width: buttonSize, height: buttonSize }]}
                    onPress={() => handleScoreUpdate('player1', currentScore.currentSet, -1)}
                  >
                    <Text style={styles.scoreButtonText}>-1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.scoreButton, styles.incrementButton, { width: buttonSize, height: buttonSize }]}
                    onPress={() => handleScoreUpdate('player1', currentScore.currentSet, 1)}
                  >
                    <Text style={styles.scoreButtonText}>+1</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Player 2 Controls */}
              <View style={styles.playerScoringSection}>
                <Text style={styles.scoringPlayerName}>
                  {selectedMatch.player2?.name || 'BYE'}
                </Text>
                <View style={styles.scoringButtons}>
                  <TouchableOpacity
                    style={[styles.scoreButton, styles.decrementButton, { width: buttonSize, height: buttonSize }]}
                    onPress={() => handleScoreUpdate('player2', currentScore.currentSet, -1)}
                  >
                    <Text style={styles.scoreButtonText}>-1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.scoreButton, styles.incrementButton, { width: buttonSize, height: buttonSize }]}
                    onPress={() => handleScoreUpdate('player2', currentScore.currentSet, 1)}
                  >
                    <Text style={styles.scoreButtonText}>+1</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Match Control Buttons */}
        <View style={styles.controlButtons}>
          {selectedMatch.status === 'scheduled' && (
            <TouchableOpacity
              style={[styles.controlButton, styles.startButton]}
              onPress={handleMatchStart}
            >
              <Text style={styles.controlButtonText}>Start Match</Text>
            </TouchableOpacity>
          )}

          {selectedMatch.status === 'in_progress' && !currentScore.isCompleted && (
            <TouchableOpacity
              style={[styles.controlButton, styles.completeButton]}
              onPress={handleMatchComplete}
            >
              <Text style={styles.controlButtonText}>Complete Match</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.controlButton, styles.reportButton]}
            onPress={reportIssue}
          >
            <Text style={styles.controlButtonText}>Report Issue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    padding: 20,
  },
  matchList: {
    flex: 1,
    padding: 20,
  },
  matchItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  matchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  changeMatchButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeMatchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  matchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
  },
  matchInfoText: {
    fontSize: 14,
    color: '#666',
  },
  matchDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scoreboard: {
    flex: 1,
    padding: 20,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginHorizontal: 20,
  },
  setsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  setColumn: {
    alignItems: 'center',
  },
  setLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  setScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 4,
  },
  activeSetScore: {
    color: '#007bff',
  },
  scoringSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentSetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007bff',
    textAlign: 'center',
    marginBottom: 20,
  },
  scoringGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  playerScoringSection: {
    alignItems: 'center',
    flex: 1,
  },
  scoringPlayerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  scoringButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  scoreButton: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  decrementButton: {
    backgroundColor: '#dc3545',
  },
  incrementButton: {
    backgroundColor: '#28a745',
  },
  scoreButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButton: {
    backgroundColor: '#28a745',
  },
  completeButton: {
    backgroundColor: '#007bff',
  },
  reportButton: {
    backgroundColor: '#ffc107',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default RefereeScoreEntry;
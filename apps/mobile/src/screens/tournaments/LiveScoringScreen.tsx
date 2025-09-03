import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Card,
  Icon,
  Badge,
  useToast,
  Spinner,
  Center,
  Divider,
  Pressable,
  Modal,
  Alert,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Match, Player, MatchScore } from '@protour/shared';
import { MatchService, PlayerService } from '@protour/shared';
import { LiveScoringScreenProps } from '../../navigation/types';

interface MatchWithPlayers extends Match {
  player1: Player | null;
  player2: Player | null;
}

interface ScoreHistory {
  timestamp: Date;
  player1Sets: number[];
  player2Sets: number[];
  action: string;
}

const LiveScoringScreen: React.FC<LiveScoringScreenProps> = ({
  route,
  navigation,
}) => {
  const { matchId, tournamentId } = route.params;
  const toast = useToast();

  // Services
  const [matchService] = useState(() => new MatchService());
  const [playerService] = useState(() => new PlayerService());

  // State
  const [match, setMatch] = useState<MatchWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Score state
  const [currentScore, setCurrentScore] = useState<MatchScore>({
    player1Sets: [0],
    player2Sets: [0],
    winner: 'player1',
  });

  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [currentSet, setCurrentSet] = useState(0);
  const [matchFormat, setMatchFormat] = useState<
    'best-of-1' | 'best-of-3' | 'best-of-5'
  >('best-of-3');

  // Modals
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);

  useEffect(() => {
    loadMatchData();
  }, []);

  const loadMatchData = async () => {
    try {
      setLoading(true);

      // Load match
      const matchData = await matchService.getMatch(matchId);
      if (!matchData) {
        throw new Error('Match not found');
      }

      if (matchData.status !== 'in-progress') {
        toast.show({
          title: 'Match is not in progress',
          description: 'Only active matches can be scored',
        });
        navigation.goBack();
        return;
      }

      // Load players
      const player1 = await playerService.getPlayer(matchData.player1Id);
      const player2 = matchData.player2Id
        ? await playerService.getPlayer(matchData.player2Id)
        : null;

      const matchWithPlayers: MatchWithPlayers = {
        ...matchData,
        player1,
        player2,
      };

      setMatch(matchWithPlayers);

      // Initialize score if match already has one
      if (matchData.score) {
        setCurrentScore(matchData.score);
        setCurrentSet(matchData.score.player1Sets.length - 1);
      } else {
        // Initialize with empty score
        const initialScore: MatchScore = {
          player1Sets: [0],
          player2Sets: [0],
          winner: 'player1',
        };
        setCurrentScore(initialScore);
      }
    } catch (error) {
      toast.show({
        title: 'Error loading match',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const addPoint = async (player: 'player1' | 'player2') => {
    if (!match || updating) return;

    try {
      setUpdating(true);

      const newScore = { ...currentScore };
      const setsKey = `${player}Sets` as 'player1Sets' | 'player2Sets';
      const currentSetsArray = [...newScore[setsKey]] as number[];
      currentSetsArray[currentSet]++;
      newScore[setsKey] = currentSetsArray;

      // Add to history
      const historyEntry: ScoreHistory = {
        timestamp: new Date(),
        player1Sets: [...currentScore.player1Sets],
        player2Sets: [...currentScore.player2Sets],
        action: `Point to ${player === 'player1' ? match.player1?.name : match.player2?.name}`,
      };
      setScoreHistory(prev => [...prev, historyEntry]);

      // Check if set is won
      const player1Score = newScore.player1Sets[currentSet];
      const player2Score = newScore.player2Sets[currentSet];

      if (isSetWon(player1Score, player2Score)) {
        // Set is won, start new set if needed
        if (!isMatchComplete(newScore)) {
          newScore.player1Sets.push(0);
          newScore.player2Sets.push(0);
          setCurrentSet(prev => prev + 1);
        } else {
          // Match is complete
          newScore.winner = getMatchWinner(newScore);
          setShowCompleteModal(true);
        }
      }

      setCurrentScore(newScore);

      // Save to database
      await matchService.updateMatch(matchId, { score: newScore });
    } catch (error) {
      toast.show({
        title: 'Error updating score',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setUpdating(false);
    }
  };

  const undoLastPoint = () => {
    if (scoreHistory.length === 0) return;

    const lastState = scoreHistory[scoreHistory.length - 1];

    setCurrentScore({
      player1Sets: [...lastState.player1Sets],
      player2Sets: [...lastState.player2Sets],
      winner: 'player1',
    });

    // Adjust current set if needed
    setCurrentSet(lastState.player1Sets.length - 1);

    // Remove from history
    setScoreHistory(prev => prev.slice(0, -1));

    setShowUndoModal(false);

    toast.show({
      title: 'Last point undone',
    });
  };

  const completeMatch = async () => {
    if (!match) return;

    try {
      setUpdating(true);

      const winnerId =
        currentScore.winner === 'player1'
          ? match.player1?.id || ''
          : match.player2?.id || '';

      await matchService.completeMatch(matchId, winnerId, currentScore);

      toast.show({
        title: 'Match completed successfully',
      });

      navigation.navigate('MatchManagement', { tournamentId });
    } catch (error) {
      toast.show({
        title: 'Error completing match',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setUpdating(false);
    }
  };

  // Scoring logic helpers
  const isSetWon = (score1: number, score2: number): boolean => {
    // Basic badminton rules: first to 21, win by 2, cap at 30
    const minWinScore = 21;
    const winByMargin = 2;
    const capScore = 30;

    const maxScore = Math.max(score1, score2);
    const minScore = Math.min(score1, score2);

    if (maxScore >= capScore) {
      return true; // Cap reached
    }

    return maxScore >= minWinScore && maxScore - minScore >= winByMargin;
  };

  const isMatchComplete = (score: MatchScore): boolean => {
    const setsToWin =
      matchFormat === 'best-of-1' ? 1 : matchFormat === 'best-of-3' ? 2 : 3;

    let player1Sets = 0;
    let player2Sets = 0;

    for (let i = 0; i < score.player1Sets.length; i++) {
      if (isSetWon(score.player1Sets[i], score.player2Sets[i])) {
        if (score.player1Sets[i] > score.player2Sets[i]) {
          player1Sets++;
        } else {
          player2Sets++;
        }
      }
    }

    return Math.max(player1Sets, player2Sets) >= setsToWin;
  };

  const getMatchWinner = (score: MatchScore): 'player1' | 'player2' => {
    let player1Sets = 0;
    let player2Sets = 0;

    for (let i = 0; i < score.player1Sets.length; i++) {
      if (isSetWon(score.player1Sets[i], score.player2Sets[i])) {
        if (score.player1Sets[i] > score.player2Sets[i]) {
          player1Sets++;
        } else {
          player2Sets++;
        }
      }
    }

    return player1Sets > player2Sets ? 'player1' : 'player2';
  };

  const getSetsWon = (player: 'player1' | 'player2'): number => {
    let sets = 0;
    const isPlayer1 = player === 'player1';

    for (let i = 0; i < currentScore.player1Sets.length; i++) {
      if (isSetWon(currentScore.player1Sets[i], currentScore.player2Sets[i])) {
        const player1Won =
          currentScore.player1Sets[i] > currentScore.player2Sets[i];
        if ((isPlayer1 && player1Won) || (!isPlayer1 && !player1Won)) {
          sets++;
        }
      }
    }

    return sets;
  };

  if (loading) {
    return (
      <Center flex={1}>
        <Spinner size="lg" color="primary.600" />
        <Text mt={4} color="gray.600">
          Loading match...
        </Text>
      </Center>
    );
  }

  if (!match) {
    return (
      <Center flex={1}>
        <Text color="gray.600">Match not found</Text>
      </Center>
    );
  }

  return (
    <Box flex={1} bg="gray.900">
      {/* Header */}
      <Box bg="gray.800" safeAreaTop>
        <VStack space={3} p={4}>
          <HStack justifyContent="space-between" alignItems="center">
            <Button
              variant="ghost"
              onPress={() => navigation.goBack()}
              startIcon={
                <Icon as={MaterialIcons} name="arrow-back" color="white" />
              }
              _text={{ color: 'white' }}
            >
              Back
            </Button>
            <Badge colorScheme="green" variant="solid">
              LIVE
            </Badge>
          </HStack>

          <VStack alignItems="center" space={1}>
            <Text fontSize="lg" fontWeight="bold" color="white">
              Round {match.round} - Match {match.matchNumber}
            </Text>
            {match.court && (
              <Badge colorScheme="blue" variant="outline">
                {match.court}
              </Badge>
            )}
          </VStack>
        </VStack>
      </Box>

      {/* Score Display */}
      <VStack flex={1} space={4} p={4}>
        {/* Current Set Score */}
        <Card bg="white" size="lg">
          <Box>
            <VStack space={4}>
              <Text
                fontSize="md"
                fontWeight="bold"
                textAlign="center"
                color="gray.600"
              >
                Set {currentSet + 1}
              </Text>

              <HStack justifyContent="space-between" alignItems="center">
                {/* Player 1 */}
                <VStack alignItems="center" flex={1}>
                  <Text fontSize="lg" fontWeight="bold" numberOfLines={1}>
                    {match.player1?.name || 'Player 1'}
                  </Text>
                  <Text fontSize="6xl" fontWeight="bold" color="blue.600">
                    {currentScore.player1Sets[currentSet] || 0}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Sets: {getSetsWon('player1')}
                  </Text>
                </VStack>

                <Divider orientation="vertical" />

                {/* Player 2 */}
                <VStack alignItems="center" flex={1}>
                  <Text fontSize="lg" fontWeight="bold" numberOfLines={1}>
                    {match.player2?.name || 'Player 2'}
                  </Text>
                  <Text fontSize="6xl" fontWeight="bold" color="red.600">
                    {currentScore.player2Sets[currentSet] || 0}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Sets: {getSetsWon('player2')}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          </Box>
        </Card>

        {/* Set History */}
        {currentScore.player1Sets.length > 1 && (
          <Card>
            <Box>
              <Text fontSize="sm" fontWeight="bold" mb={2}>
                Previous Sets
              </Text>
              <HStack space={4} justifyContent="center">
                {currentScore.player1Sets.slice(0, -1).map((score, index) => (
                  <VStack key={index} alignItems="center">
                    <Text fontSize="xs" color="gray.600">
                      Set {index + 1}
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      {score} - {currentScore.player2Sets[index]}
                    </Text>
                  </VStack>
                ))}
              </HStack>
            </Box>
          </Card>
        )}

        {/* Action Buttons */}
        <VStack space={3} flex={1} justifyContent="flex-end">
          {/* Score Buttons */}
          <HStack space={4}>
            <Button
              flex={1}
              size="lg"
              colorScheme="blue"
              onPress={() => addPoint('player1')}
              isLoading={updating}
              _text={{ fontSize: 'lg', fontWeight: 'bold' }}
              py={6}
            >
              +1 {match.player1?.name}
            </Button>

            <Button
              flex={1}
              size="lg"
              colorScheme="red"
              onPress={() => addPoint('player2')}
              isLoading={updating}
              isDisabled={!match.player2}
              _text={{ fontSize: 'lg', fontWeight: 'bold' }}
              py={6}
            >
              +1 {match.player2?.name || 'BYE'}
            </Button>
          </HStack>

          {/* Control Buttons */}
          <HStack space={2}>
            <Button
              flex={1}
              variant="outline"
              onPress={() => setShowUndoModal(true)}
              isDisabled={scoreHistory.length === 0}
              startIcon={<Icon as={MaterialIcons} name="undo" />}
            >
              Undo
            </Button>

            <Button
              flex={1}
              variant="outline"
              onPress={() =>
                navigation.navigate('MatchDetail', { matchId, tournamentId })
              }
              startIcon={<Icon as={MaterialIcons} name="info" />}
            >
              Details
            </Button>
          </HStack>
        </VStack>
      </VStack>

      {/* Complete Match Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
      >
        <Modal.Content>
          <Modal.Header>Match Complete!</Modal.Header>
          <Modal.Body>
            <VStack space={3}>
              <Alert status="success">
                <Alert.Icon />
                <Text>
                  {currentScore.winner === 'player1'
                    ? match.player1?.name
                    : match.player2?.name}{' '}
                  wins!
                </Text>
              </Alert>

              <Text>Final Score:</Text>
              <VStack space={1}>
                {currentScore.player1Sets.map((score, index) => (
                  <HStack key={index} justifyContent="space-between">
                    <Text>Set {index + 1}:</Text>
                    <Text fontWeight="bold">
                      {score} - {currentScore.player2Sets[index]}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </VStack>
          </Modal.Body>
          <Modal.Footer>
            <Button.Group space={2}>
              <Button
                variant="ghost"
                onPress={() => setShowCompleteModal(false)}
              >
                Continue Scoring
              </Button>
              <Button onPress={completeMatch} isLoading={updating}>
                Complete Match
              </Button>
            </Button.Group>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      {/* Undo Modal */}
      <Modal isOpen={showUndoModal} onClose={() => setShowUndoModal(false)}>
        <Modal.Content>
          <Modal.Header>Undo Last Point</Modal.Header>
          <Modal.Body>
            {scoreHistory.length > 0 && (
              <Text>Undo: {scoreHistory[scoreHistory.length - 1]?.action}</Text>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button.Group space={2}>
              <Button variant="ghost" onPress={() => setShowUndoModal(false)}>
                Cancel
              </Button>
              <Button colorScheme="orange" onPress={undoLastPoint}>
                Undo
              </Button>
            </Button.Group>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </Box>
  );
};

export default LiveScoringScreen;

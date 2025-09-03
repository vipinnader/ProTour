import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  ScrollView,
  Text,
  Button,
  Card,
  Icon,
  Badge,
  useToast,
  Spinner,
  Center,
  Modal,
  Input,
  Switch,
  Divider,
  Alert,
  Pressable,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Match, Player, MatchScore } from '@protour/shared';
import { MatchService, PlayerService } from '@protour/shared';
import { RefereeToolsScreenProps } from '../../navigation/types';

interface MatchWithPlayers extends Match {
  player1: Player | null;
  player2: Player | null;
}

interface QuickScorePreset {
  name: string;
  player1Sets: number[];
  player2Sets: number[];
  description: string;
}

const RefereeToolsScreen: React.FC<RefereeToolsScreenProps> = ({
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

  // Referee Tools State
  const [currentScore, setCurrentScore] = useState<MatchScore>({
    player1Sets: [0],
    player2Sets: [0],
    winner: 'player1',
  });

  const [quickMode, setQuickMode] = useState(true);
  const [currentSet, setCurrentSet] = useState(0);
  const [violations, setViolations] = useState<{
    player1: string[];
    player2: string[];
  }>({
    player1: [],
    player2: [],
  });

  // Modals
  const [showQuickScoreModal, setShowQuickScoreModal] = useState(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<
    'player1' | 'player2' | null
  >(null);

  // Timer state
  const [matchTime, setMatchTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeouts, setTimeouts] = useState<{
    player1: number;
    player2: number;
  }>({
    player1: 0,
    player2: 0,
  });

  // Quick score presets
  const quickScorePresets: QuickScorePreset[] = [
    {
      name: '21-0',
      player1Sets: [21],
      player2Sets: [0],
      description: 'Dominant win',
    },
    {
      name: '21-19',
      player1Sets: [21],
      player2Sets: [19],
      description: 'Close game',
    },
    {
      name: '21-15',
      player1Sets: [21],
      player2Sets: [15],
      description: 'Comfortable win',
    },
    {
      name: '30-29',
      player1Sets: [30],
      player2Sets: [29],
      description: 'Extended game',
    },
  ];

  useEffect(() => {
    loadMatchData();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setMatchTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const loadMatchData = async () => {
    try {
      setLoading(true);

      const matchData = await matchService.getMatch(matchId);
      if (!matchData) {
        throw new Error('Match not found');
      }

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

      if (matchData.score) {
        setCurrentScore(matchData.score);
        setCurrentSet(matchData.score.player1Sets.length - 1);
      }

      // Start timer if match is in progress
      if (matchData.status === 'in-progress') {
        setIsTimerRunning(true);
        if (matchData.startTime) {
          const elapsed = Math.floor(
            (Date.now() - matchData.startTime.toMillis()) / 1000
          );
          setMatchTime(elapsed);
        }
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

  const quickAddPoint = async (
    player: 'player1' | 'player2',
    points: number = 1
  ) => {
    if (!match || updating) return;

    try {
      setUpdating(true);
      const newScore = { ...currentScore };
      const setsKey = `${player}Sets` as 'player1Sets' | 'player2Sets';
      const currentSetsArray = [...newScore[setsKey]] as number[];
      currentSetsArray[currentSet] += points;
      newScore[setsKey] = currentSetsArray;

      setCurrentScore(newScore);
      await matchService.updateMatch(matchId, { score: newScore });

      // Haptic feedback would be nice here
      toast.show({
        title: `+${points} point${points > 1 ? 's' : ''} to ${
          player === 'player1' ? match.player1?.name : match.player2?.name
        }`,
        duration: 1000,
      });
    } catch (error) {
      toast.show({
        title: 'Error updating score',
      });
    } finally {
      setUpdating(false);
    }
  };

  const undoLastPoint = async (player: 'player1' | 'player2') => {
    if (!match || updating) return;

    try {
      setUpdating(true);
      const newScore = { ...currentScore };
      const setsKey = `${player}Sets` as 'player1Sets' | 'player2Sets';
      const currentSetsArray = [...newScore[setsKey]] as number[];

      if (currentSetsArray[currentSet] > 0) {
        currentSetsArray[currentSet]--;
        newScore[setsKey] = currentSetsArray;
        setCurrentScore(newScore);
        await matchService.updateMatch(matchId, { score: newScore });

        toast.show({
          title: 'Point removed',
          duration: 1000,
        });
      }
    } catch (error) {
      toast.show({
        title: 'Error removing point',
      });
    } finally {
      setUpdating(false);
    }
  };

  const applyQuickScore = async (
    preset: QuickScorePreset,
    winner: 'player1' | 'player2'
  ) => {
    if (!match || updating) return;

    try {
      setUpdating(true);
      const newScore: MatchScore = {
        player1Sets:
          winner === 'player1' ? preset.player1Sets : preset.player2Sets,
        player2Sets:
          winner === 'player1' ? preset.player2Sets : preset.player1Sets,
        winner,
      };

      setCurrentScore(newScore);
      await matchService.updateMatch(matchId, { score: newScore });
      setShowQuickScoreModal(false);

      toast.show({
        title: 'Quick score applied',
      });
    } catch (error) {
      toast.show({
        title: 'Error applying quick score',
      });
    } finally {
      setUpdating(false);
    }
  };

  const addViolation = (player: 'player1' | 'player2', violation: string) => {
    setViolations(prev => ({
      ...prev,
      [player]: [...prev[player], violation],
    }));

    toast.show({
      title: `Violation recorded for ${
        player === 'player1' ? match?.player1?.name : match?.player2?.name
      }`,
      description: violation,
    });

    setShowViolationModal(false);
  };

  const takeTimeout = (player: 'player1' | 'player2') => {
    const maxTimeouts = 3; // Usually 3 timeouts per player
    if (timeouts[player] >= maxTimeouts) {
      toast.show({
        title: 'Maximum timeouts exceeded',
      });
      return;
    }

    setTimeouts(prev => ({
      ...prev,
      [player]: prev[player] + 1,
    }));

    // Pause timer temporarily
    setIsTimerRunning(false);
    setTimeout(() => setIsTimerRunning(true), 60000); // Resume after 1 minute

    toast.show({
      title: 'Timeout called',
      description: `${
        player === 'player1' ? match?.player1?.name : match?.player2?.name
      } - ${timeouts[player] + 1}/3 timeouts used`,
    });

    setShowTimeoutModal(false);
  };

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const resetTimer = () => {
    setMatchTime(0);
    setIsTimerRunning(false);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const commonViolations = [
    'Delay of game',
    'Unsporting conduct',
    'Coaching violation',
    'Equipment violation',
    'Foot fault',
    'Let abuse',
    'Racquet throw',
    'Verbal abuse',
  ];

  if (loading) {
    return (
      <Center flex={1}>
        <Spinner size="lg" color="primary.600" />
        <Text mt={4} color="gray.600">
          Loading referee tools...
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
            <Badge colorScheme="orange" variant="solid">
              REFEREE MODE
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

          {/* Timer */}
          <HStack justifyContent="center" alignItems="center" space={4}>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color="white"
              fontFamily="mono"
            >
              {formatTime(matchTime)}
            </Text>
            <Button
              size="sm"
              onPress={toggleTimer}
              colorScheme={isTimerRunning ? 'red' : 'green'}
              startIcon={
                <Icon
                  as={MaterialIcons}
                  name={isTimerRunning ? 'pause' : 'play-arrow'}
                  size="xs"
                />
              }
            >
              {isTimerRunning ? 'Pause' : 'Start'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={resetTimer}
              startIcon={<Icon as={MaterialIcons} name="replay" size="xs" />}
            >
              Reset
            </Button>
          </HStack>
        </VStack>
      </Box>

      <ScrollView flex={1} p={4}>
        <VStack space={4}>
          {/* Quick Mode Toggle */}
          <Card>
            <Box>
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text fontSize="md" fontWeight="bold" color="white">
                    Quick Mode
                  </Text>
                  <Text fontSize="sm" color="gray.300">
                    Large buttons for easy scoring
                  </Text>
                </VStack>
                <Switch
                  isChecked={quickMode}
                  onToggle={setQuickMode}
                  colorScheme="primary"
                />
              </HStack>
            </Box>
          </Card>

          {/* Score Display */}
          <Card bg="white">
            <Box>
              <VStack space={4}>
                <Text
                  fontSize="md"
                  fontWeight="bold"
                  textAlign="center"
                  color="gray.700"
                >
                  Current Score - Set {currentSet + 1}
                </Text>

                <HStack justifyContent="space-between" alignItems="center">
                  <VStack alignItems="center" flex={1}>
                    <Text fontSize="lg" fontWeight="bold" numberOfLines={1}>
                      {match.player1?.name || 'Player 1'}
                    </Text>
                    <Text fontSize="6xl" fontWeight="bold" color="blue.600">
                      {currentScore.player1Sets[currentSet] || 0}
                    </Text>
                    {violations.player1.length > 0 && (
                      <Badge colorScheme="red" variant="subtle" size="sm">
                        {violations.player1.length} violation
                        {violations.player1.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </VStack>

                  <Divider orientation="vertical" />

                  <VStack alignItems="center" flex={1}>
                    <Text fontSize="lg" fontWeight="bold" numberOfLines={1}>
                      {match.player2?.name || 'Player 2'}
                    </Text>
                    <Text fontSize="6xl" fontWeight="bold" color="red.600">
                      {currentScore.player2Sets[currentSet] || 0}
                    </Text>
                    {violations.player2.length > 0 && (
                      <Badge colorScheme="red" variant="subtle" size="sm">
                        {violations.player2.length} violation
                        {violations.player2.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </VStack>
                </HStack>
              </VStack>
            </Box>
          </Card>

          {/* Quick Scoring Buttons */}
          <Card>
            <Box>
              <VStack space={4}>
                <Text
                  fontSize="md"
                  fontWeight="bold"
                  color="white"
                  textAlign="center"
                >
                  Quick Scoring
                </Text>

                {quickMode ? (
                  <VStack space={3}>
                    {/* Large Point Buttons */}
                    <HStack space={4}>
                      <Button
                        flex={1}
                        size="lg"
                        colorScheme="blue"
                        onPress={() => quickAddPoint('player1')}
                        py={8}
                        _text={{ fontSize: '2xl', fontWeight: 'bold' }}
                      >
                        +1
                      </Button>
                      <Button
                        flex={1}
                        size="lg"
                        colorScheme="red"
                        onPress={() => quickAddPoint('player2')}
                        isDisabled={!match.player2}
                        py={8}
                        _text={{ fontSize: '2xl', fontWeight: 'bold' }}
                      >
                        +1
                      </Button>
                    </HStack>

                    {/* Multi-point buttons */}
                    <HStack space={2}>
                      <Button
                        flex={1}
                        size="md"
                        variant="outline"
                        onPress={() => quickAddPoint('player1', 2)}
                        _text={{ color: 'blue.400' }}
                      >
                        +2
                      </Button>
                      <Button
                        flex={1}
                        size="md"
                        variant="outline"
                        onPress={() => quickAddPoint('player1', 5)}
                        _text={{ color: 'blue.400' }}
                      >
                        +5
                      </Button>
                      <Button
                        flex={1}
                        size="md"
                        variant="outline"
                        onPress={() => quickAddPoint('player2', 2)}
                        isDisabled={!match.player2}
                        _text={{ color: 'red.400' }}
                      >
                        +2
                      </Button>
                      <Button
                        flex={1}
                        size="md"
                        variant="outline"
                        onPress={() => quickAddPoint('player2', 5)}
                        isDisabled={!match.player2}
                        _text={{ color: 'red.400' }}
                      >
                        +5
                      </Button>
                    </HStack>
                  </VStack>
                ) : (
                  <HStack space={4}>
                    <Button
                      flex={1}
                      onPress={() => quickAddPoint('player1')}
                      colorScheme="blue"
                      startIcon={<Icon as={MaterialIcons} name="add" />}
                    >
                      {match.player1?.name}
                    </Button>
                    <Button
                      flex={1}
                      onPress={() => quickAddPoint('player2')}
                      colorScheme="red"
                      isDisabled={!match.player2}
                      startIcon={<Icon as={MaterialIcons} name="add" />}
                    >
                      {match.player2?.name || 'BYE'}
                    </Button>
                  </HStack>
                )}
              </VStack>
            </Box>
          </Card>

          {/* Referee Tools */}
          <Card>
            <Box>
              <VStack space={3}>
                <Text fontSize="md" fontWeight="bold" color="white">
                  Referee Tools
                </Text>

                <HStack space={2}>
                  <Button
                    flex={1}
                    size="sm"
                    variant="outline"
                    onPress={() => setShowQuickScoreModal(true)}
                    startIcon={<Icon as={MaterialIcons} name="speed" />}
                  >
                    Quick Score
                  </Button>
                  <Button
                    flex={1}
                    size="sm"
                    variant="outline"
                    onPress={() => setShowViolationModal(true)}
                    startIcon={<Icon as={MaterialIcons} name="warning" />}
                  >
                    Violation
                  </Button>
                </HStack>

                <HStack space={2}>
                  <Button
                    flex={1}
                    size="sm"
                    variant="outline"
                    onPress={() => setShowTimeoutModal(true)}
                    startIcon={<Icon as={MaterialIcons} name="pause" />}
                  >
                    Timeout
                  </Button>
                  <Button
                    flex={1}
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      navigation.navigate('LiveScoring', {
                        matchId,
                        tournamentId,
                      })
                    }
                    startIcon={<Icon as={MaterialIcons} name="sports" />}
                  >
                    Full Scoring
                  </Button>
                </HStack>
              </VStack>
            </Box>
          </Card>

          {/* Undo Controls */}
          <Card>
            <Box>
              <VStack space={3}>
                <Text fontSize="md" fontWeight="bold" color="white">
                  Undo Last Point
                </Text>

                <HStack space={4}>
                  <Button
                    flex={1}
                    size="sm"
                    colorScheme="orange"
                    variant="outline"
                    onPress={() => undoLastPoint('player1')}
                    startIcon={<Icon as={MaterialIcons} name="undo" />}
                  >
                    {match.player1?.name}
                  </Button>
                  <Button
                    flex={1}
                    size="sm"
                    colorScheme="orange"
                    variant="outline"
                    onPress={() => undoLastPoint('player2')}
                    isDisabled={!match.player2}
                    startIcon={<Icon as={MaterialIcons} name="undo" />}
                  >
                    {match.player2?.name || 'BYE'}
                  </Button>
                </HStack>
              </VStack>
            </Box>
          </Card>

          {/* Timeouts Display */}
          <Card>
            <Box>
              <VStack space={3}>
                <Text fontSize="md" fontWeight="bold" color="white">
                  Timeouts Used
                </Text>

                <HStack justifyContent="space-between">
                  <VStack alignItems="center">
                    <Text color="white">{match.player1?.name}</Text>
                    <Text fontSize="xl" fontWeight="bold" color="blue.400">
                      {timeouts.player1}/3
                    </Text>
                  </VStack>
                  <VStack alignItems="center">
                    <Text color="white">
                      {match.player2?.name || 'Player 2'}
                    </Text>
                    <Text fontSize="xl" fontWeight="bold" color="red.400">
                      {timeouts.player2}/3
                    </Text>
                  </VStack>
                </HStack>
              </VStack>
            </Box>
          </Card>
        </VStack>
      </ScrollView>

      {/* Quick Score Modal */}
      <Modal
        isOpen={showQuickScoreModal}
        onClose={() => setShowQuickScoreModal(false)}
      >
        <Modal.Content>
          <Modal.Header>Apply Quick Score</Modal.Header>
          <Modal.Body>
            <VStack space={4}>
              <Text>Select a preset and winner:</Text>
              {quickScorePresets.map(preset => (
                <VStack key={preset.name} space={2}>
                  <Text fontWeight="bold">
                    {preset.name} - {preset.description}
                  </Text>
                  <HStack space={2}>
                    <Button
                      flex={1}
                      size="sm"
                      onPress={() => applyQuickScore(preset, 'player1')}
                    >
                      {match.player1?.name} wins
                    </Button>
                    <Button
                      flex={1}
                      size="sm"
                      onPress={() => applyQuickScore(preset, 'player2')}
                      isDisabled={!match.player2}
                    >
                      {match.player2?.name || 'Player 2'} wins
                    </Button>
                  </HStack>
                </VStack>
              ))}
            </VStack>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="ghost"
              onPress={() => setShowQuickScoreModal(false)}
            >
              Cancel
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      {/* Violation Modal */}
      <Modal
        isOpen={showViolationModal}
        onClose={() => setShowViolationModal(false)}
      >
        <Modal.Content>
          <Modal.Header>Record Violation</Modal.Header>
          <Modal.Body>
            <VStack space={4}>
              <Text>Select player:</Text>
              <HStack space={2}>
                <Button
                  flex={1}
                  size="sm"
                  variant={selectedPlayer === 'player1' ? 'solid' : 'outline'}
                  onPress={() => setSelectedPlayer('player1')}
                >
                  {match.player1?.name}
                </Button>
                <Button
                  flex={1}
                  size="sm"
                  variant={selectedPlayer === 'player2' ? 'solid' : 'outline'}
                  onPress={() => setSelectedPlayer('player2')}
                  isDisabled={!match.player2}
                >
                  {match.player2?.name || 'Player 2'}
                </Button>
              </HStack>

              {selectedPlayer && (
                <VStack space={2}>
                  <Text>Select violation:</Text>
                  {commonViolations.map(violation => (
                    <Button
                      key={violation}
                      size="sm"
                      variant="outline"
                      onPress={() => addViolation(selectedPlayer, violation)}
                    >
                      {violation}
                    </Button>
                  ))}
                </VStack>
              )}
            </VStack>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="ghost"
              onPress={() => setShowViolationModal(false)}
            >
              Cancel
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      {/* Timeout Modal */}
      <Modal
        isOpen={showTimeoutModal}
        onClose={() => setShowTimeoutModal(false)}
      >
        <Modal.Content>
          <Modal.Header>Call Timeout</Modal.Header>
          <Modal.Body>
            <VStack space={4}>
              <Text>Which player is calling timeout?</Text>
              <VStack space={2}>
                <Button
                  onPress={() => takeTimeout('player1')}
                  isDisabled={timeouts.player1 >= 3}
                >
                  {match.player1?.name} ({timeouts.player1}/3 used)
                </Button>
                <Button
                  onPress={() => takeTimeout('player2')}
                  isDisabled={!match.player2 || timeouts.player2 >= 3}
                >
                  {match.player2?.name || 'Player 2'} ({timeouts.player2}/3
                  used)
                </Button>
              </VStack>

              <Alert status="info">
                <Alert.Icon />
                <Text fontSize="sm">
                  Timeout will pause the match timer for 60 seconds
                </Text>
              </Alert>
            </VStack>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={() => setShowTimeoutModal(false)}>
              Cancel
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </Box>
  );
};

export default RefereeToolsScreen;

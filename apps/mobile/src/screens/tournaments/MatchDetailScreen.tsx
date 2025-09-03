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
  Alert,
  useToast,
  Spinner,
  Center,
  Divider,
  Modal,
  Input,
  Select,
  Pressable,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Match, Player, MatchScore } from '@protour/shared';
import { MatchService, PlayerService } from '@protour/shared';
import { MatchDetailScreenProps } from '../../navigation/types';

interface MatchWithPlayers extends Match {
  player1: Player | null;
  player2: Player | null;
}

const MatchDetailScreen: React.FC<MatchDetailScreenProps> = ({
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

  // Modals
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Form states
  const [selectedCourt, setSelectedCourt] = useState('');
  const [winnerId, setWinnerId] = useState('');
  const [scoreInput, setScoreInput] = useState({
    player1Sets: [0],
    player2Sets: [0],
    currentSet: 0,
  });

  const availableCourts = [
    'Court 1',
    'Court 2',
    'Court 3',
    'Court 4',
    'Court 5',
    'Court 6',
  ];

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

      // Load players
      const player1 = await playerService.getPlayer(matchData.player1Id);
      const player2 = matchData.player2Id
        ? await playerService.getPlayer(matchData.player2Id)
        : null;

      setMatch({
        ...matchData,
        player1,
        player2,
      });

      // Initialize score input if match has a score
      if (matchData.score) {
        setScoreInput({
          player1Sets: [...matchData.score.player1Sets],
          player2Sets: [...matchData.score.player2Sets],
          currentSet: matchData.score.player1Sets.length - 1,
        });
      }

      setSelectedCourt(matchData.court || '');
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

  const handleStartMatch = async () => {
    if (!match) return;

    try {
      setUpdating(true);
      await matchService.startMatch(matchId);
      await loadMatchData();

      toast.show({
        title: 'Match started successfully',
      });
    } catch (error) {
      toast.show({
        title: 'Error starting match',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignCourt = async () => {
    if (!selectedCourt) return;

    try {
      setUpdating(true);
      await matchService.updateMatch(matchId, { court: selectedCourt });
      await loadMatchData();
      setShowCourtModal(false);

      toast.show({
        title: 'Court assigned successfully',
      });
    } catch (error) {
      toast.show({
        title: 'Error assigning court',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteMatch = async () => {
    if (!winnerId) return;

    try {
      setUpdating(true);

      // Create score object if we have score data
      let score: MatchScore | undefined;
      if (
        scoreInput.player1Sets.some(s => s > 0) ||
        scoreInput.player2Sets.some(s => s > 0)
      ) {
        score = {
          player1Sets: scoreInput.player1Sets,
          player2Sets: scoreInput.player2Sets,
          winner: winnerId === match?.player1?.id ? 'player1' : 'player2',
        };
      }

      await matchService.completeMatch(matchId, winnerId, score);
      await loadMatchData();
      setShowCompleteModal(false);

      toast.show({
        title: 'Match completed successfully',
      });
    } catch (error) {
      toast.show({
        title: 'Error completing match',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setUpdating(false);
    }
  };

  const addSet = () => {
    setScoreInput(prev => ({
      ...prev,
      player1Sets: [...prev.player1Sets, 0],
      player2Sets: [...prev.player2Sets, 0],
      currentSet: prev.currentSet + 1,
    }));
  };

  const updateSetScore = (
    player: 'player1' | 'player2',
    setIndex: number,
    score: number
  ) => {
    setScoreInput(prev => ({
      ...prev,
      [`${player}Sets`]: prev[`${player}Sets`].map((s, i) =>
        i === setIndex ? score : s
      ),
    }));
  };

  const getStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'in-progress':
        return 'blue';
      case 'pending':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: Match['status']) => {
    switch (status) {
      case 'completed':
        return 'check-circle';
      case 'in-progress':
        return 'play-circle-filled';
      case 'pending':
        return 'schedule';
      default:
        return 'schedule';
    }
  };

  if (loading) {
    return (
      <Center flex={1}>
        <Spinner size="lg" color="primary.600" />
        <Text mt={4} color="gray.600">
          Loading match details...
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
    <Box flex={1} bg="gray.50">
      {/* Header */}
      <Box bg="white" shadow={1}>
        <VStack space={4} p={4}>
          <HStack justifyContent="space-between" alignItems="center">
            <Button
              variant="ghost"
              onPress={() => navigation.goBack()}
              startIcon={<Icon as={MaterialIcons} name="arrow-back" />}
            >
              Back
            </Button>
            <Badge
              size="lg"
              colorScheme={getStatusColor(match.status)}
              variant="subtle"
              startIcon={
                <Icon
                  as={MaterialIcons}
                  name={getStatusIcon(match.status)}
                  size="sm"
                />
              }
            >
              {match.status}
            </Badge>
          </HStack>

          <VStack alignItems="center" space={2}>
            <Text fontSize="lg" fontWeight="bold">
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

      <ScrollView flex={1} p={4}>
        <VStack space={4}>
          {/* Players Card */}
          <Card>
            <Box>
              <VStack space={4}>
                <Text fontSize="md" fontWeight="bold" textAlign="center">
                  Match Players
                </Text>

                {/* Player 1 */}
                <Box
                  bg={
                    match.winnerId === match.player1?.id
                      ? 'green.50'
                      : 'gray.50'
                  }
                  p={4}
                  rounded="md"
                  borderWidth={match.winnerId === match.player1?.id ? 2 : 1}
                  borderColor={
                    match.winnerId === match.player1?.id
                      ? 'green.500'
                      : 'gray.200'
                  }
                >
                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack>
                      <Text fontSize="lg" fontWeight="bold">
                        {match.player1?.name || 'Unknown Player'}
                      </Text>
                      {match.player1?.seedPosition && (
                        <Text fontSize="sm" color="gray.600">
                          Seed #{match.player1.seedPosition}
                        </Text>
                      )}
                    </VStack>
                    {match.winnerId === match.player1?.id && (
                      <Icon
                        as={MaterialIcons}
                        name="emoji-events"
                        size="lg"
                        color="gold"
                      />
                    )}
                  </HStack>
                </Box>

                <Center>
                  <Text fontSize="lg" fontWeight="bold" color="gray.500">
                    VS
                  </Text>
                </Center>

                {/* Player 2 */}
                <Box
                  bg={
                    match.player2 && match.winnerId === match.player2.id
                      ? 'green.50'
                      : match.player2
                        ? 'gray.50'
                        : 'orange.50'
                  }
                  p={4}
                  rounded="md"
                  borderWidth={
                    match.player2 && match.winnerId === match.player2.id ? 2 : 1
                  }
                  borderColor={
                    match.player2 && match.winnerId === match.player2.id
                      ? 'green.500'
                      : match.player2
                        ? 'gray.200'
                        : 'orange.300'
                  }
                >
                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack>
                      <Text
                        fontSize="lg"
                        fontWeight="bold"
                        color={match.player2 ? 'gray.700' : 'orange.600'}
                        italic={!match.player2}
                      >
                        {match.player2?.name || 'BYE'}
                      </Text>
                      {match.player2?.seedPosition && (
                        <Text fontSize="sm" color="gray.600">
                          Seed #{match.player2.seedPosition}
                        </Text>
                      )}
                    </VStack>
                    {match.player2 && match.winnerId === match.player2.id && (
                      <Icon
                        as={MaterialIcons}
                        name="emoji-events"
                        size="lg"
                        color="gold"
                      />
                    )}
                  </HStack>
                </Box>
              </VStack>
            </Box>
          </Card>

          {/* Current Score */}
          {match.score && (
            <Card>
              <Box>
                <VStack space={3}>
                  <Text fontSize="md" fontWeight="bold" textAlign="center">
                    Current Score
                  </Text>

                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack alignItems="center" flex={1}>
                      <Text fontSize="sm" color="gray.600">
                        {match.player1?.name}
                      </Text>
                      <HStack space={2}>
                        {match.score.player1Sets.map((score, index) => (
                          <Text key={index} fontSize="lg" fontWeight="bold">
                            {score}
                          </Text>
                        ))}
                      </HStack>
                    </VStack>

                    <Divider orientation="vertical" />

                    <VStack alignItems="center" flex={1}>
                      <Text fontSize="sm" color="gray.600">
                        {match.player2?.name || 'BYE'}
                      </Text>
                      <HStack space={2}>
                        {match.score.player2Sets.map((score, index) => (
                          <Text key={index} fontSize="lg" fontWeight="bold">
                            {score}
                          </Text>
                        ))}
                      </HStack>
                    </VStack>
                  </HStack>
                </VStack>
              </Box>
            </Card>
          )}

          {/* Match Times */}
          {(match.startTime || match.endTime) && (
            <Card>
              <Box>
                <VStack space={3}>
                  <Text fontSize="md" fontWeight="bold" textAlign="center">
                    Match Times
                  </Text>

                  {match.startTime && (
                    <HStack justifyContent="space-between">
                      <Text color="gray.600">Started:</Text>
                      <Text fontWeight="medium">
                        {new Date(match.startTime.toMillis()).toLocaleString()}
                      </Text>
                    </HStack>
                  )}

                  {match.endTime && (
                    <HStack justifyContent="space-between">
                      <Text color="gray.600">Ended:</Text>
                      <Text fontWeight="medium">
                        {new Date(match.endTime.toMillis()).toLocaleString()}
                      </Text>
                    </HStack>
                  )}
                </VStack>
              </Box>
            </Card>
          )}

          {/* Action Buttons */}
          <VStack space={3}>
            {/* Assign Court */}
            {!match.court && match.status === 'pending' && (
              <Button
                onPress={() => setShowCourtModal(true)}
                colorScheme="blue"
                variant="outline"
                startIcon={<Icon as={MaterialIcons} name="place" />}
                isLoading={updating}
              >
                Assign Court
              </Button>
            )}

            {/* Start Match */}
            {match.status === 'pending' && match.court && (
              <Button
                onPress={handleStartMatch}
                colorScheme="green"
                startIcon={<Icon as={MaterialIcons} name="play-arrow" />}
                isLoading={updating}
              >
                Start Match
              </Button>
            )}

            {/* Live Scoring */}
            {match.status === 'in-progress' && (
              <VStack space={2}>
                <Button
                  onPress={() =>
                    navigation.navigate('LiveScoring', {
                      matchId,
                      tournamentId,
                    })
                  }
                  colorScheme="blue"
                  startIcon={<Icon as={MaterialIcons} name="sports" />}
                >
                  Live Scoring
                </Button>
                <Button
                  onPress={() =>
                    navigation.navigate('RefereeTools', {
                      matchId,
                      tournamentId,
                    })
                  }
                  colorScheme="orange"
                  variant="outline"
                  startIcon={<Icon as={MaterialIcons} name="gavel" />}
                >
                  Referee Tools
                </Button>
              </VStack>
            )}

            {/* Complete Match */}
            {match.status === 'in-progress' && (
              <Button
                onPress={() => setShowCompleteModal(true)}
                colorScheme="orange"
                startIcon={<Icon as={MaterialIcons} name="flag" />}
                isLoading={updating}
              >
                Complete Match
              </Button>
            )}
          </VStack>
        </VStack>
      </ScrollView>

      {/* Court Assignment Modal */}
      <Modal isOpen={showCourtModal} onClose={() => setShowCourtModal(false)}>
        <Modal.Content>
          <Modal.CloseButton />
          <Modal.Header>Assign Court</Modal.Header>
          <Modal.Body>
            <VStack space={3}>
              <Text>Select a court for this match:</Text>
              <Select
                selectedValue={selectedCourt}
                onValueChange={setSelectedCourt}
                placeholder="Choose court"
              >
                {availableCourts.map(court => (
                  <Select.Item key={court} label={court} value={court} />
                ))}
              </Select>
            </VStack>
          </Modal.Body>
          <Modal.Footer>
            <Button.Group space={2}>
              <Button variant="ghost" onPress={() => setShowCourtModal(false)}>
                Cancel
              </Button>
              <Button
                onPress={handleAssignCourt}
                isDisabled={!selectedCourt}
                isLoading={updating}
              >
                Assign
              </Button>
            </Button.Group>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      {/* Complete Match Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        size="full"
      >
        <Modal.Content>
          <Modal.CloseButton />
          <Modal.Header>Complete Match</Modal.Header>
          <Modal.Body>
            <VStack space={4}>
              <Text>Select the winner:</Text>
              <VStack space={2}>
                <Pressable onPress={() => setWinnerId(match.player1?.id || '')}>
                  <Box
                    p={4}
                    rounded="md"
                    borderWidth={2}
                    borderColor={
                      winnerId === match.player1?.id ? 'green.500' : 'gray.200'
                    }
                    bg={winnerId === match.player1?.id ? 'green.50' : 'white'}
                  >
                    <Text fontWeight="bold">
                      {match.player1?.name || 'Unknown Player'}
                    </Text>
                  </Box>
                </Pressable>

                {match.player2 && (
                  <Pressable
                    onPress={() => setWinnerId(match.player2?.id || '')}
                  >
                    <Box
                      p={4}
                      rounded="md"
                      borderWidth={2}
                      borderColor={
                        winnerId === match.player2?.id
                          ? 'green.500'
                          : 'gray.200'
                      }
                      bg={winnerId === match.player2?.id ? 'green.50' : 'white'}
                    >
                      <Text fontWeight="bold">{match.player2.name}</Text>
                    </Box>
                  </Pressable>
                )}
              </VStack>

              <Divider />

              <Text>Score (Optional):</Text>
              {scoreInput.player1Sets.map((_, setIndex) => (
                <HStack key={setIndex} space={4} alignItems="center">
                  <Text>Set {setIndex + 1}:</Text>
                  <Input
                    flex={1}
                    value={scoreInput.player1Sets[setIndex].toString()}
                    onChangeText={text =>
                      updateSetScore(
                        'player1',
                        setIndex,
                        parseInt(text, 10) || 0
                      )
                    }
                    keyboardType="numeric"
                    placeholder={match.player1?.name}
                  />
                  <Text>-</Text>
                  <Input
                    flex={1}
                    value={scoreInput.player2Sets[setIndex].toString()}
                    onChangeText={text =>
                      updateSetScore(
                        'player2',
                        setIndex,
                        parseInt(text, 10) || 0
                      )
                    }
                    keyboardType="numeric"
                    placeholder={match.player2?.name || 'BYE'}
                    isDisabled={!match.player2}
                  />
                </HStack>
              ))}

              <Button variant="ghost" onPress={addSet} size="sm">
                Add Set
              </Button>
            </VStack>
          </Modal.Body>
          <Modal.Footer>
            <Button.Group space={2}>
              <Button
                variant="ghost"
                onPress={() => setShowCompleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                onPress={handleCompleteMatch}
                isDisabled={!winnerId}
                isLoading={updating}
              >
                Complete Match
              </Button>
            </Button.Group>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </Box>
  );
};

export default MatchDetailScreen;

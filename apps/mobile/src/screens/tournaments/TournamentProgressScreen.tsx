import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  ScrollView,
  Text,
  Card,
  Icon,
  Badge,
  Progress,
  useToast,
  Spinner,
  Center,
  Button,
  Modal,
  Alert,
  Divider,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Tournament,
  Match,
  Player,
  TournamentStage,
  TournamentProgressStats,
} from '@protour/shared';
import {
  TournamentService,
  MatchService,
  PlayerService,
} from '@protour/shared';
import { TournamentProgressScreenProps } from '../../navigation/types';

interface ProgressData {
  tournament: Tournament;
  matches: Match[];
  players: Player[];
  stats: TournamentProgressStats;
  currentStage: TournamentStage;
}

interface RoundProgress {
  round: number;
  totalMatches: number;
  completedMatches: number;
  inProgressMatches: number;
  pendingMatches: number;
  estimatedCompletion?: Date;
}

const TournamentProgressScreen: React.FC<TournamentProgressScreenProps> = ({
  route,
  navigation,
}) => {
  const { tournamentId } = route.params;
  const toast = useToast();

  // Services
  const [tournamentService] = useState(() => new TournamentService());
  const [matchService] = useState(() => new MatchService());
  const [playerService] = useState(() => new PlayerService());

  // State
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roundProgress, setRoundProgress] = useState<RoundProgress[]>([]);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Real-time updates
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadProgressData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshProgress();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadProgressData = async () => {
    try {
      setLoading(true);

      // Load tournament data
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Load matches and players
      const [matches, players] = await Promise.all([
        matchService.getMatchesByTournament(tournamentId),
        playerService.getPlayersByTournament(tournamentId),
      ]);

      // Calculate progress statistics
      const stats = calculateProgressStats(matches, players);
      const currentStage = determineCurrentStage(tournament, matches);
      const roundProgressData = calculateRoundProgress(matches);

      setProgressData({
        tournament,
        matches,
        players,
        stats,
        currentStage,
      });
      setRoundProgress(roundProgressData);
      setLastUpdate(new Date());
    } catch (error) {
      toast.show({
        title: 'Error loading tournament progress',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshProgress = async () => {
    try {
      setRefreshing(true);
      await loadProgressData();
    } catch (error) {
      console.error('Error refreshing progress:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const calculateProgressStats = (
    matches: Match[],
    players: Player[]
  ): TournamentProgressStats => {
    const totalMatches = matches.length;
    const completedMatches = matches.filter(
      m => m.status === 'completed'
    ).length;
    const inProgressMatches = matches.filter(
      m => m.status === 'in-progress'
    ).length;
    const pendingMatches = matches.filter(m => m.status === 'pending').length;

    const activePlayers = players.filter(p => !p.eliminated).length;
    const eliminatedPlayers = players.filter(p => p.eliminated).length;

    const overallProgress =
      totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

    // Calculate estimated time remaining
    const avgMatchDuration = 45; // minutes
    const remainingMatches = pendingMatches + inProgressMatches;
    const estimatedMinutesRemaining = remainingMatches * avgMatchDuration;
    const estimatedCompletion = new Date(
      Date.now() + estimatedMinutesRemaining * 60 * 1000
    );

    return {
      totalMatches,
      completedMatches,
      inProgressMatches,
      pendingMatches,
      activePlayers,
      eliminatedPlayers,
      overallProgress,
      estimatedCompletion,
    };
  };

  const calculateRoundProgress = (matches: Match[]): RoundProgress[] => {
    const roundMap = new Map<number, RoundProgress>();

    matches.forEach(match => {
      if (!roundMap.has(match.round)) {
        roundMap.set(match.round, {
          round: match.round,
          totalMatches: 0,
          completedMatches: 0,
          inProgressMatches: 0,
          pendingMatches: 0,
        });
      }

      const progress = roundMap.get(match.round)!;
      progress.totalMatches++;

      switch (match.status) {
        case 'completed':
          progress.completedMatches++;
          break;
        case 'in-progress':
          progress.inProgressMatches++;
          break;
        case 'pending':
          progress.pendingMatches++;
          break;
      }
    });

    return Array.from(roundMap.values()).sort((a, b) => a.round - b.round);
  };

  const determineCurrentStage = (
    tournament: Tournament,
    matches: Match[]
  ): TournamentStage => {
    if (tournament.status === 'completed') {
      return 'completed';
    }

    if (tournament.status === 'active') {
      const hasActiveMatches = matches.some(m => m.status === 'in-progress');
      if (hasActiveMatches) {
        return 'active-play';
      }

      const hasPendingMatches = matches.some(m => m.status === 'pending');
      if (hasPendingMatches) {
        return 'match-scheduling';
      }
    }

    return 'setup';
  };

  const getStageColor = (stage: TournamentStage) => {
    switch (stage) {
      case 'setup':
        return 'orange';
      case 'match-scheduling':
        return 'blue';
      case 'active-play':
        return 'green';
      case 'completed':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getStageIcon = (stage: TournamentStage) => {
    switch (stage) {
      case 'setup':
        return 'settings';
      case 'match-scheduling':
        return 'schedule';
      case 'active-play':
        return 'play-circle-filled';
      case 'completed':
        return 'check-circle';
      default:
        return 'help';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <Center flex={1}>
        <Spinner size="lg" color="primary.600" />
        <Text mt={4} color="gray.600">
          Loading tournament progress...
        </Text>
      </Center>
    );
  }

  if (!progressData) {
    return (
      <Center flex={1}>
        <Text color="gray.600">Tournament data not available</Text>
      </Center>
    );
  }

  const { tournament, stats, currentStage } = progressData;

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
            <HStack space={2} alignItems="center">
              <Button
                size="sm"
                variant="outline"
                onPress={refreshProgress}
                isLoading={refreshing}
                startIcon={<Icon as={MaterialIcons} name="refresh" size="xs" />}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                variant={autoRefresh ? 'solid' : 'outline'}
                onPress={() => setAutoRefresh(!autoRefresh)}
                startIcon={
                  <Icon
                    as={MaterialIcons}
                    name={autoRefresh ? 'pause' : 'play-arrow'}
                    size="xs"
                  />
                }
              >
                Auto
              </Button>
            </HStack>
          </HStack>

          <VStack alignItems="center" space={2}>
            <Text fontSize="lg" fontWeight="bold">
              {tournament.name}
            </Text>
            <Badge
              size="lg"
              colorScheme={getStageColor(currentStage)}
              variant="subtle"
              startIcon={
                <Icon
                  as={MaterialIcons}
                  name={getStageIcon(currentStage)}
                  size="sm"
                />
              }
            >
              {currentStage.replace('-', ' ').toUpperCase()}
            </Badge>
            <Text fontSize="xs" color="gray.500">
              Last updated: {formatTime(lastUpdate)}
            </Text>
          </VStack>
        </VStack>
      </Box>

      <ScrollView flex={1} p={4}>
        <VStack space={4}>
          {/* Overall Progress */}
          <Card>
            <Box>
              <VStack space={4}>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="md" fontWeight="bold">
                    Overall Progress
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color="primary.600">
                    {Math.round(stats.overallProgress)}%
                  </Text>
                </HStack>

                <Progress
                  value={stats.overallProgress}
                  colorScheme="primary"
                  size="lg"
                  rounded="full"
                />

                <HStack justifyContent="space-between">
                  <VStack alignItems="center">
                    <Text fontSize="xl" fontWeight="bold" color="green.600">
                      {stats.completedMatches}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      Completed
                    </Text>
                  </VStack>
                  <VStack alignItems="center">
                    <Text fontSize="xl" fontWeight="bold" color="blue.600">
                      {stats.inProgressMatches}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      In Progress
                    </Text>
                  </VStack>
                  <VStack alignItems="center">
                    <Text fontSize="xl" fontWeight="bold" color="gray.600">
                      {stats.pendingMatches}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      Pending
                    </Text>
                  </VStack>
                  <VStack alignItems="center">
                    <Text fontSize="xl" fontWeight="bold" color="purple.600">
                      {stats.totalMatches}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      Total
                    </Text>
                  </VStack>
                </HStack>
              </VStack>
            </Box>
          </Card>

          {/* Time Estimates */}
          <Card>
            <Box>
              <VStack space={3}>
                <Text fontSize="md" fontWeight="bold">
                  Time Estimates
                </Text>

                <HStack justifyContent="space-between">
                  <Text color="gray.600">Estimated Completion:</Text>
                  <Text fontWeight="medium">
                    {formatTime(stats.estimatedCompletion)}
                  </Text>
                </HStack>

                <HStack justifyContent="space-between">
                  <Text color="gray.600">Remaining Time:</Text>
                  <Text fontWeight="medium">
                    {formatDuration(
                      Math.max(
                        0,
                        Math.floor(
                          (stats.estimatedCompletion.getTime() - Date.now()) /
                            (1000 * 60)
                        )
                      )
                    )}
                  </Text>
                </HStack>

                <HStack justifyContent="space-between">
                  <Text color="gray.600">Active Players:</Text>
                  <Text fontWeight="medium">
                    {stats.activePlayers} of{' '}
                    {stats.activePlayers + stats.eliminatedPlayers}
                  </Text>
                </HStack>
              </VStack>
            </Box>
          </Card>

          {/* Round Progress */}
          <Card>
            <Box>
              <VStack space={4}>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="md" fontWeight="bold">
                    Round Progress
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => setShowStatsModal(true)}
                    startIcon={
                      <Icon as={MaterialIcons} name="analytics" size="xs" />
                    }
                  >
                    Details
                  </Button>
                </HStack>

                {roundProgress.map(round => {
                  const progress =
                    round.totalMatches > 0
                      ? (round.completedMatches / round.totalMatches) * 100
                      : 0;

                  return (
                    <VStack key={round.round} space={2}>
                      <HStack
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Text fontSize="sm" fontWeight="medium">
                          Round {round.round}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {round.completedMatches}/{round.totalMatches}
                        </Text>
                      </HStack>

                      <Progress
                        value={progress}
                        colorScheme={progress === 100 ? 'green' : 'blue'}
                        size="sm"
                        rounded="full"
                      />

                      <HStack space={4} justifyContent="flex-start">
                        {round.completedMatches > 0 && (
                          <Badge size="xs" colorScheme="green" variant="subtle">
                            {round.completedMatches} done
                          </Badge>
                        )}
                        {round.inProgressMatches > 0 && (
                          <Badge size="xs" colorScheme="blue" variant="subtle">
                            {round.inProgressMatches} active
                          </Badge>
                        )}
                        {round.pendingMatches > 0 && (
                          <Badge size="xs" colorScheme="gray" variant="subtle">
                            {round.pendingMatches} pending
                          </Badge>
                        )}
                      </HStack>
                    </VStack>
                  );
                })}
              </VStack>
            </Box>
          </Card>

          {/* Quick Actions */}
          <Card>
            <Box>
              <VStack space={3}>
                <Text fontSize="md" fontWeight="bold">
                  Quick Actions
                </Text>

                <HStack space={2}>
                  <Button
                    flex={1}
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      navigation.navigate('MatchManagement', { tournamentId })
                    }
                    startIcon={
                      <Icon as={MaterialIcons} name="sports" size="xs" />
                    }
                  >
                    Matches
                  </Button>
                  <Button
                    flex={1}
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      navigation.navigate('BracketView', { tournamentId })
                    }
                    startIcon={
                      <Icon as={MaterialIcons} name="account-tree" size="xs" />
                    }
                  >
                    Bracket
                  </Button>
                </HStack>
              </VStack>
            </Box>
          </Card>

          {/* Status Alerts */}
          {stats.inProgressMatches === 0 && stats.pendingMatches > 0 && (
            <Alert status="info">
              <Alert.Icon />
              <VStack flex={1}>
                <Text fontWeight="bold">No Active Matches</Text>
                <Text fontSize="sm">
                  {stats.pendingMatches} matches are waiting to be started
                </Text>
              </VStack>
            </Alert>
          )}

          {currentStage === 'completed' && (
            <Alert status="success">
              <Alert.Icon />
              <VStack flex={1}>
                <Text fontWeight="bold">Tournament Complete!</Text>
                <Text fontSize="sm">All matches have been finished</Text>
              </VStack>
            </Alert>
          )}
        </VStack>
      </ScrollView>

      {/* Detailed Stats Modal */}
      <Modal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        size="full"
      >
        <Modal.Content>
          <Modal.CloseButton />
          <Modal.Header>Tournament Statistics</Modal.Header>
          <Modal.Body>
            <VStack space={4}>
              <Text fontSize="md" fontWeight="bold">
                Match Statistics
              </Text>
              <VStack space={2}>
                <HStack justifyContent="space-between">
                  <Text>Total Matches:</Text>
                  <Text fontWeight="bold">{stats.totalMatches}</Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text>Completed:</Text>
                  <Text fontWeight="bold" color="green.600">
                    {stats.completedMatches}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text>In Progress:</Text>
                  <Text fontWeight="bold" color="blue.600">
                    {stats.inProgressMatches}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text>Pending:</Text>
                  <Text fontWeight="bold" color="gray.600">
                    {stats.pendingMatches}
                  </Text>
                </HStack>
              </VStack>

              <Divider />

              <Text fontSize="md" fontWeight="bold">
                Player Statistics
              </Text>
              <VStack space={2}>
                <HStack justifyContent="space-between">
                  <Text>Total Players:</Text>
                  <Text fontWeight="bold">
                    {stats.activePlayers + stats.eliminatedPlayers}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text>Still Active:</Text>
                  <Text fontWeight="bold" color="green.600">
                    {stats.activePlayers}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text>Eliminated:</Text>
                  <Text fontWeight="bold" color="red.600">
                    {stats.eliminatedPlayers}
                  </Text>
                </HStack>
              </VStack>

              <Divider />

              <Text fontSize="md" fontWeight="bold">
                Time Analysis
              </Text>
              <VStack space={2}>
                <HStack justifyContent="space-between">
                  <Text>Tournament Started:</Text>
                  <Text fontWeight="bold">
                    {tournament.createdAt
                      ? new Date(
                          tournament.createdAt.toMillis()
                        ).toLocaleDateString()
                      : 'N/A'}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text>Est. Completion:</Text>
                  <Text fontWeight="bold">
                    {stats.estimatedCompletion.toLocaleString()}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text>Progress Rate:</Text>
                  <Text fontWeight="bold">
                    {Math.round(stats.overallProgress)}%
                  </Text>
                </HStack>
              </VStack>
            </VStack>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={() => setShowStatsModal(false)}>Close</Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </Box>
  );
};

export default TournamentProgressScreen;

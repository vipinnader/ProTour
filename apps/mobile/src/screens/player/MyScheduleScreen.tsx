import React, { useState, useEffect } from 'react';
import {
  Box,
  ScrollView,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Card,
  Pressable,
  useToast,
  Badge,
  Progress,
  Divider,
  Select,
  CheckIcon,
  Center,
  Spinner,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { MyScheduleScreenProps } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import {
  Tournament,
  Match,
  PlayerSchedule,
  BracketPosition,
  TournamentService,
} from '@protour/shared';
import { RefreshControl } from 'react-native';

const MyScheduleScreen: React.FC<MyScheduleScreenProps> = ({
  navigation,
  route,
}) => {
  const { tournamentId } = route.params;

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    tournamentId || ''
  );
  const [schedule, setSchedule] = useState<PlayerSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuth();
  const toast = useToast();
  const tournamentService = new TournamentService();

  useEffect(() => {
    loadPlayerTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournamentId) {
      loadPlayerSchedule(selectedTournamentId);
    }
  }, [selectedTournamentId]);

  const loadPlayerTournaments = async () => {
    if (!user) return;

    try {
      const registrations = await tournamentService.getPlayerRegistrations(
        user.id
      );
      const playerRegistrations = registrations.filter(
        reg => reg.role === 'player' && reg.status === 'active'
      );

      const tournamentPromises = playerRegistrations.map(reg =>
        tournamentService.getTournamentById(reg.tournamentId)
      );
      const tournamentsData = await Promise.all(tournamentPromises);
      const validTournaments = tournamentsData.filter(Boolean) as Tournament[];

      setTournaments(validTournaments);

      // Set first tournament as selected if none specified
      if (!selectedTournamentId && validTournaments.length > 0) {
        setSelectedTournamentId(validTournaments[0].id);
      }
    } catch (error: any) {
      console.error('Error loading tournaments:', error);
      toast.show({
        title: 'Error Loading Tournaments',
        description: error.message || 'Failed to load your tournaments',
        status: 'error',
      });
    }
  };

  const loadPlayerSchedule = async (tournamentId: string) => {
    if (!user || !tournamentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const playerSchedule = await tournamentService.getPlayerSchedule(
        user.id,
        tournamentId
      );
      setSchedule(playerSchedule);
    } catch (error: any) {
      console.error('Error loading schedule:', error);
      toast.show({
        title: 'Error Loading Schedule',
        description: error.message || 'Failed to load your match schedule',
        status: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (selectedTournamentId) {
      setRefreshing(true);
      loadPlayerSchedule(selectedTournamentId);
    }
  };

  const formatMatchTime = (timestamp: any) => {
    if (!timestamp) return 'TBD';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatEstimatedTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMatchStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'pending':
        return 'orange';
      case 'in-progress':
        return 'blue';
      case 'completed':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getMatchStatusText = (status: Match['status']) => {
    switch (status) {
      case 'pending':
        return 'Upcoming';
      case 'in-progress':
        return 'Live';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const getBracketProgressPercentage = (position: BracketPosition) => {
    if (position.eliminated) return 100;
    const progress =
      ((position.currentRound || 1) / (position.canAdvanceToRound || 1)) * 100;
    return Math.min(progress, 100);
  };

  const selectedTournament = tournaments.find(
    t => t.id === selectedTournamentId
  );

  if (tournaments.length === 0 && !loading) {
    return (
      <Box flex={1} bg="gray.50">
        <Box bg="primary.600" safeAreaTop>
          <HStack justifyContent="space-between" alignItems="center" p={4}>
            <HStack space={3} alignItems="center">
              <Pressable onPress={() => navigation.goBack()}>
                <Icon
                  as={<MaterialIcons name="arrow-back" />}
                  size={6}
                  color="white"
                />
              </Pressable>
              <Text color="white" fontSize="xl" fontWeight="bold">
                My Schedule
              </Text>
            </HStack>
          </HStack>
        </Box>

        <Center flex={1} p={8}>
          <VStack space={4} alignItems="center">
            <Icon
              as={<MaterialIcons name="schedule" />}
              size={16}
              color="gray.400"
            />
            <VStack space={2} alignItems="center">
              <Text fontSize="lg" fontWeight="medium" color="gray.600">
                No Active Tournaments
              </Text>
              <Text fontSize="sm" color="gray.500" textAlign="center">
                Join a tournament as a player to see your match schedule
              </Text>
            </VStack>
            <Button
              colorScheme="primary"
              onPress={() => navigation.navigate('JoinTournament')}
              leftIcon={<Icon as={<MaterialIcons name="add" />} size={5} />}
            >
              Join Tournament
            </Button>
          </VStack>
        </Center>
      </Box>
    );
  }

  return (
    <Box flex={1} bg="gray.50">
      {/* Header */}
      <Box bg="primary.600" safeAreaTop>
        <VStack space={3} p={4}>
          <HStack justifyContent="space-between" alignItems="center">
            <HStack space={3} alignItems="center">
              <Pressable onPress={() => navigation.goBack()}>
                <Icon
                  as={<MaterialIcons name="arrow-back" />}
                  size={6}
                  color="white"
                />
              </Pressable>
              <Text color="white" fontSize="xl" fontWeight="bold">
                My Schedule
              </Text>
            </HStack>
            <Pressable onPress={() => navigation.navigate('PlayerDashboard')}>
              <Icon
                as={<MaterialIcons name="dashboard" />}
                size={6}
                color="white"
              />
            </Pressable>
          </HStack>

          {/* Tournament Selector */}
          {tournaments.length > 1 && (
            <Select
              selectedValue={selectedTournamentId}
              onValueChange={setSelectedTournamentId}
              bg="white"
              color="gray.800"
              _selectedItem={{
                bg: 'primary.50',
                endIcon: <CheckIcon size="5" />,
              }}
            >
              {tournaments.map(tournament => (
                <Select.Item
                  key={tournament.id}
                  label={tournament.name}
                  value={tournament.id}
                />
              ))}
            </Select>
          )}

          {selectedTournament && (
            <HStack space={2} alignItems="center">
              <Icon
                as={<MaterialIcons name="emoji-events" />}
                size={5}
                color="primary.100"
              />
              <Text color="primary.100" fontSize="sm">
                {selectedTournament.name}
              </Text>
              <Badge
                bg={
                  selectedTournament.status === 'active'
                    ? 'green.500'
                    : 'orange.500'
                }
                _text={{ color: 'white', fontSize: 'xs' }}
              >
                {selectedTournament.status}
              </Badge>
            </HStack>
          )}
        </VStack>
      </Box>

      {loading ? (
        <Center flex={1}>
          <VStack space={3} alignItems="center">
            <Spinner size="lg" color="primary.600" />
            <Text color="gray.600">Loading your schedule...</Text>
          </VStack>
        </Center>
      ) : (
        <ScrollView
          flex={1}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <VStack space={6} p={4}>
            {/* Tournament Progress */}
            {schedule?.tournamentProgress && (
              <Card>
                <VStack space={4}>
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="lg" fontWeight="bold" color="gray.800">
                      Tournament Progress
                    </Text>
                    <Badge
                      colorScheme={
                        schedule.tournamentProgress.eliminated ? 'red' : 'blue'
                      }
                      rounded="full"
                    >
                      {schedule.tournamentProgress.eliminated
                        ? 'Eliminated'
                        : 'Active'}
                    </Badge>
                  </HStack>

                  <VStack space={3}>
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontSize="sm" color="gray.600">
                        Current Round
                      </Text>
                      <Text fontSize="sm" fontWeight="medium" color="gray.800">
                        Round {schedule.tournamentProgress.currentRound}
                      </Text>
                    </HStack>

                    {!schedule.tournamentProgress.eliminated && (
                      <>
                        <VStack space={2}>
                          <HStack justifyContent="space-between">
                            <Text fontSize="sm" color="gray.600">
                              Progress to Finals
                            </Text>
                            <Text fontSize="sm" color="gray.600">
                              {getBracketProgressPercentage(
                                schedule.tournamentProgress
                              ).toFixed(0)}
                              %
                            </Text>
                          </HStack>
                          <Progress
                            value={getBracketProgressPercentage(
                              schedule.tournamentProgress
                            )}
                            colorScheme="primary"
                            size="md"
                          />
                        </VStack>

                        {schedule.estimatedNextMatchTime && (
                          <Box bg="blue.50" p={3} rounded="lg">
                            <HStack space={2} alignItems="center">
                              <Icon
                                as={<MaterialIcons name="schedule" />}
                                size={5}
                                color="blue.500"
                              />
                              <VStack flex={1}>
                                <Text
                                  fontSize="sm"
                                  fontWeight="medium"
                                  color="blue.700"
                                >
                                  Next Match Estimated
                                </Text>
                                <Text fontSize="sm" color="blue.600">
                                  {formatEstimatedTime(
                                    schedule.estimatedNextMatchTime
                                  )}
                                </Text>
                              </VStack>
                            </HStack>
                          </Box>
                        )}
                      </>
                    )}
                  </VStack>
                </VStack>
              </Card>
            )}

            {/* Current Match */}
            {schedule?.currentMatch && (
              <Card>
                <VStack space={4}>
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="lg" fontWeight="bold" color="gray.800">
                      Current Match
                    </Text>
                    <Badge colorScheme="green" variant="solid">
                      Live
                    </Badge>
                  </HStack>

                  <Pressable
                    onPress={() =>
                      navigation.navigate('LiveMatch', {
                        matchId: schedule.currentMatch!.id,
                        tournamentId: schedule.currentMatch!.tournamentId,
                      })
                    }
                  >
                    <Box
                      bg="green.50"
                      p={4}
                      rounded="lg"
                      borderWidth={2}
                      borderColor="green.200"
                    >
                      <VStack space={3}>
                        <HStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <VStack space={1}>
                            <Text
                              fontSize="md"
                              fontWeight="bold"
                              color="green.800"
                            >
                              Round {schedule.currentMatch.round}
                            </Text>
                            <Text fontSize="sm" color="green.700">
                              vs Opponent Name
                            </Text>
                          </VStack>
                          {schedule.currentMatch.court && (
                            <Badge colorScheme="green" rounded="full">
                              Court {schedule.currentMatch.court}
                            </Badge>
                          )}
                        </HStack>

                        <HStack space={2} alignItems="center">
                          <Icon
                            as={<MaterialIcons name="play-circle-filled" />}
                            size={5}
                            color="green.600"
                          />
                          <Text
                            fontSize="sm"
                            fontWeight="medium"
                            color="green.700"
                          >
                            Match in progress - Tap to view live score
                          </Text>
                        </HStack>
                      </VStack>
                    </Box>
                  </Pressable>
                </VStack>
              </Card>
            )}

            {/* Upcoming Matches */}
            {schedule?.upcomingMatches &&
              schedule.upcomingMatches.length > 0 && (
                <VStack space={4}>
                  <Text fontSize="lg" fontWeight="bold" color="gray.800">
                    Upcoming Matches
                  </Text>

                  <VStack space={3}>
                    {schedule.upcomingMatches.map((match, index) => (
                      <Pressable
                        key={match.id}
                        onPress={() =>
                          navigation.navigate('MatchDetail', {
                            matchId: match.id,
                            tournamentId: match.tournamentId,
                          })
                        }
                      >
                        <Card>
                          <HStack
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <VStack flex={1} space={2}>
                              <HStack space={3} alignItems="center">
                                <Badge colorScheme="blue" rounded="full">
                                  Round {match.round}
                                </Badge>
                                {match.court && (
                                  <Badge colorScheme="gray" rounded="full">
                                    Court {match.court}
                                  </Badge>
                                )}
                                {index === 0 && (
                                  <Badge colorScheme="orange" rounded="full">
                                    Next
                                  </Badge>
                                )}
                              </HStack>

                              <Text
                                fontSize="md"
                                fontWeight="medium"
                                color="gray.800"
                              >
                                vs Opponent Name
                              </Text>

                              <HStack space={2} alignItems="center">
                                <Icon
                                  as={<MaterialIcons name="schedule" />}
                                  size={4}
                                  color="gray.500"
                                />
                                <Text fontSize="sm" color="gray.600">
                                  {formatMatchTime(match.startTime)}
                                </Text>
                              </HStack>
                            </VStack>

                            <VStack alignItems="flex-end" space={2}>
                              <Badge
                                colorScheme={getMatchStatusColor(match.status)}
                                variant="solid"
                              >
                                {getMatchStatusText(match.status)}
                              </Badge>
                              <Icon
                                as={<MaterialIcons name="chevron-right" />}
                                size={6}
                                color="gray.400"
                              />
                            </VStack>
                          </HStack>
                        </Card>
                      </Pressable>
                    ))}
                  </VStack>
                </VStack>
              )}

            {/* Completed Matches */}
            {schedule?.completedMatches &&
              schedule.completedMatches.length > 0 && (
                <VStack space={4}>
                  <Text fontSize="lg" fontWeight="bold" color="gray.800">
                    Completed Matches
                  </Text>

                  <VStack space={3}>
                    {schedule.completedMatches.slice(0, 5).map(match => (
                      <Pressable
                        key={match.id}
                        onPress={() =>
                          navigation.navigate('MatchDetail', {
                            matchId: match.id,
                            tournamentId: match.tournamentId,
                          })
                        }
                      >
                        <Card opacity={0.8}>
                          <HStack
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <VStack flex={1} space={2}>
                              <HStack space={3} alignItems="center">
                                <Badge colorScheme="gray" rounded="full">
                                  Round {match.round}
                                </Badge>
                                {match.winnerId === user?.id ? (
                                  <Badge colorScheme="green" rounded="full">
                                    Won
                                  </Badge>
                                ) : (
                                  <Badge colorScheme="red" rounded="full">
                                    Lost
                                  </Badge>
                                )}
                              </HStack>

                              <Text fontSize="md" color="gray.700">
                                vs Opponent Name
                              </Text>

                              {match.score && (
                                <Text fontSize="sm" color="gray.600">
                                  {match.score.player1Sets.join('-')} vs{' '}
                                  {match.score.player2Sets.join('-')}
                                </Text>
                              )}
                            </VStack>

                            <Icon
                              as={<MaterialIcons name="chevron-right" />}
                              size={6}
                              color="gray.400"
                            />
                          </HStack>
                        </Card>
                      </Pressable>
                    ))}
                  </VStack>

                  {schedule.completedMatches.length > 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        // Navigate to full match history
                        toast.show({
                          title: 'Coming Soon',
                          description:
                            'Full match history will be available soon',
                        });
                      }}
                    >
                      View All Matches ({schedule.completedMatches.length})
                    </Button>
                  )}
                </VStack>
              )}

            {/* Empty State */}
            {!schedule && !loading && (
              <Center py={8}>
                <VStack space={4} alignItems="center">
                  <Icon
                    as={<MaterialIcons name="schedule" />}
                    size={16}
                    color="gray.400"
                  />
                  <VStack space={2} alignItems="center">
                    <Text fontSize="lg" fontWeight="medium" color="gray.600">
                      No Schedule Available
                    </Text>
                    <Text fontSize="sm" color="gray.500" textAlign="center">
                      Your match schedule will appear once the tournament
                      bracket is generated
                    </Text>
                  </VStack>
                </VStack>
              </Center>
            )}
          </VStack>
        </ScrollView>
      )}
    </Box>
  );
};

export default MyScheduleScreen;

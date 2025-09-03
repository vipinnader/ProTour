import React, { useState, useEffect } from 'react';
import {
  Box,
  ScrollView,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Avatar,
  Card,
  Pressable,
  useToast,
  Fab,
  Badge,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { PlayerDashboardScreenProps } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import {
  Tournament,
  TournamentRegistration,
  Match,
  TournamentService,
  PlayerSchedule,
} from '@protour/shared';
import { RefreshControl } from 'react-native';

const PlayerDashboardScreen: React.FC<PlayerDashboardScreenProps> = ({
  navigation,
}) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>(
    []
  );
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { user, logout } = useAuth();
  const toast = useToast();
  const tournamentService = new TournamentService();

  useEffect(() => {
    loadPlayerData();
  }, []);

  const loadPlayerData = async () => {
    if (!user) return;

    try {
      // Load tournaments the user is registered for
      const playerRegistrations =
        await tournamentService.getPlayerRegistrations(user.id);
      setRegistrations(playerRegistrations);

      // Load tournament details
      const tournamentIds = playerRegistrations.map(reg => reg.tournamentId);
      const tournamentPromises = tournamentIds.map(id =>
        tournamentService.getTournamentById(id)
      );
      const tournamentsData = await Promise.all(tournamentPromises);
      setTournaments(tournamentsData.filter(Boolean) as Tournament[]);

      // Load upcoming matches for active tournaments
      const activeRegistrations = playerRegistrations.filter(
        reg => reg.role === 'player' && reg.status === 'active'
      );

      const matchPromises = activeRegistrations.map(async reg => {
        const schedule = await tournamentService.getPlayerSchedule(
          user.id,
          reg.tournamentId
        );
        return schedule.upcomingMatches.slice(0, 2); // Get next 2 matches
      });

      const matchResults = await Promise.all(matchPromises);
      const allUpcomingMatches = matchResults.flat();
      setUpcomingMatches(allUpcomingMatches);
    } catch (error: any) {
      console.error('Error loading player data:', error);
      toast.show({
        title: 'Error Loading Data',
        description: error.message || 'Failed to load your tournament data',
        status: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlayerData();
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.show({
        title: 'Logged Out',
        description: 'You have been successfully logged out',
        status: 'success',
      });
    } catch (error: any) {
      toast.show({
        title: 'Logout Error',
        description: error.message || 'Error during logout',
        status: 'error',
      });
    }
  };

  const getTournamentStatusColor = (status: Tournament['status']) => {
    switch (status) {
      case 'setup':
        return 'orange.500';
      case 'active':
        return 'green.500';
      case 'completed':
        return 'blue.500';
      default:
        return 'gray.500';
    }
  };

  const formatDate = (timestamp: any) => {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatMatchTime = (timestamp: any) => {
    if (!timestamp) return 'TBD';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPlayerRole = (tournamentId: string) => {
    const registration = registrations.find(
      reg => reg.tournamentId === tournamentId
    );
    return registration?.role || 'spectator';
  };

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const upcomingTournaments = tournaments.filter(t => t.status === 'setup');
  const completedTournaments = tournaments.filter(
    t => t.status === 'completed'
  );

  return (
    <Box flex={1} bg="gray.50">
      {/* Header */}
      <Box bg="primary.600" safeAreaTop>
        <HStack justifyContent="space-between" alignItems="center" p={4}>
          <VStack>
            <Text color="white" fontSize="2xl" fontWeight="bold">
              🏆 My Tournaments
            </Text>
            <Text color="primary.100" fontSize="sm">
              Welcome back, {user?.name}!
            </Text>
          </VStack>

          <HStack space={3} alignItems="center">
            <Pressable
              onPress={() =>
                navigation.navigate('PlayerProfile', {
                  playerId: user?.id || '',
                })
              }
            >
              <Avatar
                size="sm"
                bg="primary.100"
                _text={{ color: 'primary.600', fontWeight: 'bold' }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
            </Pressable>

            <Pressable onPress={handleLogout}>
              <Icon
                as={<MaterialIcons name="logout" />}
                size={6}
                color="white"
              />
            </Pressable>
          </HStack>
        </HStack>
      </Box>

      {/* Content */}
      <ScrollView
        flex={1}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack space={6} p={4}>
          {/* Quick Stats */}
          <HStack space={3}>
            <Box bg="white" p={4} rounded="lg" shadow={1} flex={1}>
              <VStack alignItems="center" space={2}>
                <Icon
                  as={<MaterialIcons name="emoji-events" />}
                  size={8}
                  color="primary.600"
                />
                <Text fontSize="2xl" fontWeight="bold" color="gray.800">
                  {tournaments.length}
                </Text>
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  Total Tournaments
                </Text>
              </VStack>
            </Box>

            <Box bg="white" p={4} rounded="lg" shadow={1} flex={1}>
              <VStack alignItems="center" space={2}>
                <Icon
                  as={<MaterialIcons name="sports" />}
                  size={8}
                  color="green.500"
                />
                <Text fontSize="2xl" fontWeight="bold" color="gray.800">
                  {activeTournaments.length}
                </Text>
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  Active Now
                </Text>
              </VStack>
            </Box>

            <Box bg="white" p={4} rounded="lg" shadow={1} flex={1}>
              <VStack alignItems="center" space={2}>
                <Icon
                  as={<MaterialIcons name="schedule" />}
                  size={8}
                  color="orange.500"
                />
                <Text fontSize="2xl" fontWeight="bold" color="gray.800">
                  {upcomingMatches.length}
                </Text>
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  Next Matches
                </Text>
              </VStack>
            </Box>
          </HStack>

          {/* Upcoming Matches */}
          {upcomingMatches.length > 0 && (
            <VStack space={4}>
              <HStack justifyContent="space-between" alignItems="center">
                <Text fontSize="xl" fontWeight="bold" color="gray.800">
                  Next Matches
                </Text>
                <Button
                  size="sm"
                  variant="ghost"
                  colorScheme="primary"
                  onPress={() => navigation.navigate('MySchedule')}
                >
                  View Schedule
                </Button>
              </HStack>

              <VStack space={3}>
                {upcomingMatches.slice(0, 2).map(match => (
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
                          <HStack space={2} alignItems="center">
                            <Badge colorScheme="blue" rounded="full">
                              Round {match.round}
                            </Badge>
                            {match.court && (
                              <Badge colorScheme="gray" rounded="full">
                                Court {match.court}
                              </Badge>
                            )}
                          </HStack>
                          <Text
                            fontSize="md"
                            fontWeight="medium"
                            color="gray.800"
                          >
                            vs Opponent
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            {formatMatchTime(match.startTime)}
                          </Text>
                        </VStack>

                        <VStack alignItems="flex-end" space={2}>
                          <Badge
                            colorScheme={
                              match.status === 'pending' ? 'orange' : 'blue'
                            }
                            variant="solid"
                          >
                            {match.status === 'pending'
                              ? 'Upcoming'
                              : match.status}
                          </Badge>
                          <Button
                            size="xs"
                            colorScheme="primary"
                            variant="outline"
                            onPress={e => {
                              e.stopPropagation();
                              navigation.navigate('LiveMatch', {
                                matchId: match.id,
                                tournamentId: match.tournamentId,
                              });
                            }}
                          >
                            View
                          </Button>
                        </VStack>
                      </HStack>
                    </Card>
                  </Pressable>
                ))}
              </VStack>
            </VStack>
          )}

          {/* Active Tournaments */}
          {activeTournaments.length > 0 && (
            <VStack space={4}>
              <Text fontSize="xl" fontWeight="bold" color="gray.800">
                Active Tournaments
              </Text>

              <VStack space={3}>
                {activeTournaments.map(tournament => (
                  <Pressable
                    key={tournament.id}
                    onPress={() =>
                      navigation.navigate('BracketView', {
                        tournamentId: tournament.id,
                      })
                    }
                  >
                    <Card>
                      <HStack
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <VStack flex={1} space={2}>
                          <HStack space={2} alignItems="center">
                            <Text
                              fontSize="lg"
                              fontWeight="bold"
                              color="gray.800"
                            >
                              {tournament.name}
                            </Text>
                            <Badge
                              colorScheme={
                                getPlayerRole(tournament.id) === 'player'
                                  ? 'green'
                                  : 'blue'
                              }
                              rounded="full"
                            >
                              {getPlayerRole(tournament.id)}
                            </Badge>
                          </HStack>
                          <HStack space={4} alignItems="center">
                            <HStack space={1} alignItems="center">
                              <Icon
                                as={<MaterialIcons name="calendar-today" />}
                                size={4}
                                color="gray.500"
                              />
                              <Text fontSize="sm" color="gray.600">
                                {formatDate(tournament.date)}
                              </Text>
                            </HStack>
                            {tournament.location && (
                              <HStack space={1} alignItems="center">
                                <Icon
                                  as={<MaterialIcons name="location-on" />}
                                  size={4}
                                  color="gray.500"
                                />
                                <Text fontSize="sm" color="gray.600">
                                  {tournament.location}
                                </Text>
                              </HStack>
                            )}
                          </HStack>
                        </VStack>

                        <VStack alignItems="flex-end" space={2}>
                          <Badge
                            bg={getTournamentStatusColor(tournament.status)}
                            _text={{ color: 'white', fontWeight: 'bold' }}
                            rounded="full"
                          >
                            Live
                          </Badge>
                          <HStack space={2}>
                            {getPlayerRole(tournament.id) === 'player' && (
                              <Button
                                size="xs"
                                colorScheme="green"
                                variant="outline"
                                onPress={e => {
                                  e.stopPropagation();
                                  navigation.navigate('MySchedule', {
                                    tournamentId: tournament.id,
                                  });
                                }}
                              >
                                Schedule
                              </Button>
                            )}
                            <Button
                              size="xs"
                              colorScheme="blue"
                              variant="outline"
                              onPress={e => {
                                e.stopPropagation();
                                navigation.navigate('BracketView', {
                                  tournamentId: tournament.id,
                                });
                              }}
                            >
                              Bracket
                            </Button>
                          </HStack>
                        </VStack>
                      </HStack>
                    </Card>
                  </Pressable>
                ))}
              </VStack>
            </VStack>
          )}

          {/* Upcoming Tournaments */}
          {upcomingTournaments.length > 0 && (
            <VStack space={4}>
              <Text fontSize="xl" fontWeight="bold" color="gray.800">
                Upcoming Tournaments
              </Text>

              <VStack space={3}>
                {upcomingTournaments.map(tournament => (
                  <Card key={tournament.id}>
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1} space={2}>
                        <Text fontSize="lg" fontWeight="bold" color="gray.800">
                          {tournament.name}
                        </Text>
                        <HStack space={4} alignItems="center">
                          <HStack space={1} alignItems="center">
                            <Icon
                              as={<MaterialIcons name="calendar-today" />}
                              size={4}
                              color="gray.500"
                            />
                            <Text fontSize="sm" color="gray.600">
                              {formatDate(tournament.date)}
                            </Text>
                          </HStack>
                          <HStack space={1} alignItems="center">
                            <Icon
                              as={<MaterialIcons name="people" />}
                              size={4}
                              color="gray.500"
                            />
                            <Text fontSize="sm" color="gray.600">
                              {tournament.currentPlayerCount} /{' '}
                              {tournament.maxPlayers}
                            </Text>
                          </HStack>
                        </HStack>
                      </VStack>

                      <Badge
                        bg={getTournamentStatusColor(tournament.status)}
                        _text={{ color: 'white', fontWeight: 'bold' }}
                        rounded="full"
                      >
                        Setup
                      </Badge>
                    </HStack>
                  </Card>
                ))}
              </VStack>
            </VStack>
          )}

          {/* Empty State */}
          {tournaments.length === 0 && !loading && (
            <Box bg="white" p={8} rounded="lg" shadow={1}>
              <VStack space={4} alignItems="center">
                <Icon
                  as={<MaterialIcons name="emoji-events" />}
                  size={16}
                  color="gray.400"
                />
                <VStack space={2} alignItems="center">
                  <Text fontSize="lg" fontWeight="medium" color="gray.600">
                    No Tournaments Yet
                  </Text>
                  <Text fontSize="sm" color="gray.500" textAlign="center">
                    Join your first tournament using an access code from the
                    organizer
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
            </Box>
          )}
        </VStack>
      </ScrollView>

      {/* Floating Action Button */}
      <Fab
        renderInPortal={false}
        shadow={2}
        size="lg"
        colorScheme="primary"
        icon={<Icon color="white" as={<MaterialIcons name="add" />} size={6} />}
        onPress={() => navigation.navigate('JoinTournament')}
      />
    </Box>
  );
};

export default PlayerDashboardScreen;

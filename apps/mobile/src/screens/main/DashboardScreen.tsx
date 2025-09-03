// Dashboard screen for ProTour - Epic 1 Implementation

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Tournament, TournamentService } from '@protour/shared';
import { RefreshControl } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DashboardScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { user, logout } = useAuth();
  const toast = useToast();
  const tournamentService = new TournamentService();

  const loadTournaments = useCallback(async () => {
    if (!user) return;

    try {
      const userTournaments = await tournamentService.getTournamentsByOrganizer(
        user.id
      );
      setTournaments(userTournaments);
    } catch (error: unknown) {
      console.error('Error loading tournaments:', error);
      toast.show({
        title: 'Error Loading Tournaments',
        description: error.message || 'Failed to load your tournaments',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, tournamentService, toast]);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTournaments();
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.show({
        title: 'Logged Out',
        description: 'You have been successfully logged out',
      });
    } catch (error: unknown) {
      toast.show({
        title: 'Logout Error',
        description: error.message || 'Error during logout',
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

  const getTournamentStatusText = (status: Tournament['status']) => {
    switch (status) {
      case 'setup':
        return 'Setup';
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const formatDate = (timestamp: any) => {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Box flex={1} bg="gray.50">
      {/* Header */}
      <Box bg="primary.600" safeAreaTop>
        <HStack justifyContent="space-between" alignItems="center" p={4}>
          <VStack>
            <Text color="white" fontSize="2xl" fontWeight="bold">
              🏆 ProTour
            </Text>
            <Text color="primary.100" fontSize="sm">
              Welcome back, {user?.name}!
            </Text>
          </VStack>

          <HStack space={3} alignItems="center">
            <Pressable onPress={() => navigation.navigate('Profile')}>
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
                  {tournaments.filter(t => t.status === 'active').length}
                </Text>
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  Active Now
                </Text>
              </VStack>
            </Box>
          </HStack>

          {/* Tournaments Section */}
          <VStack space={4}>
            <HStack justifyContent="space-between" alignItems="center">
              <Text fontSize="xl" fontWeight="bold" color="gray.800">
                Your Tournaments
              </Text>
              {tournaments.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  colorScheme="primary"
                  onPress={() => navigation.navigate('TournamentsList')}
                >
                  View All
                </Button>
              )}
            </HStack>

            {loading ? (
              <Box bg="white" p={6} rounded="lg" shadow={1}>
                <Text textAlign="center" color="gray.500">
                  Loading tournaments...
                </Text>
              </Box>
            ) : tournaments.length === 0 ? (
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
                      Create your first tournament to get started with
                      organizing competitions
                    </Text>
                  </VStack>
                  <Button
                    colorScheme="primary"
                    onPress={() => navigation.navigate('CreateTournament')}
                    leftIcon={
                      <Icon as={<MaterialIcons name="add" />} size={5} />
                    }
                  >
                    Create Tournament
                  </Button>
                </VStack>
              </Box>
            ) : (
              <VStack space={3}>
                {tournaments.slice(0, 3).map(tournament => (
                  <Pressable
                    key={tournament.id}
                    onPress={() =>
                      navigation.navigate('TournamentDetail', {
                        tournamentId: tournament.id,
                      })
                    }
                  >
                    <Card>
                      <Box>
                        <HStack
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
                          <VStack flex={1} space={2}>
                            <Text
                              fontSize="lg"
                              fontWeight="bold"
                              color="gray.800"
                            >
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
                              {tournament.location && (
                                <HStack space={1} alignItems="center">
                                  <Icon
                                    as={<MaterialIcons name="location-on" />}
                                    size={4}
                                    color="gray.500"
                                  />
                                  <Text
                                    fontSize="sm"
                                    color="gray.600"
                                    numberOfLines={1}
                                  >
                                    {tournament.location}
                                  </Text>
                                </HStack>
                              )}
                            </HStack>
                            <HStack space={1} alignItems="center">
                              <Icon
                                as={<MaterialIcons name="people" />}
                                size={4}
                                color="gray.500"
                              />
                              <Text fontSize="sm" color="gray.600">
                                {tournament.currentPlayerCount} /{' '}
                                {tournament.maxPlayers} players
                              </Text>
                            </HStack>
                          </VStack>

                          <VStack alignItems="flex-end" space={2}>
                            <Box
                              bg={getTournamentStatusColor(tournament.status)}
                              px={3}
                              py={1}
                              rounded="full"
                            >
                              <Text
                                fontSize="xs"
                                fontWeight="bold"
                                color="white"
                              >
                                {getTournamentStatusText(tournament.status)}
                              </Text>
                            </Box>

                            {tournament.status === 'active' && (
                              <VStack space={1}>
                                <Button
                                  size="xs"
                                  colorScheme="blue"
                                  variant="outline"
                                  onPress={e => {
                                    e.stopPropagation();
                                    navigation.navigate('MatchManagement', {
                                      tournamentId: tournament.id,
                                    });
                                  }}
                                >
                                  Manage
                                </Button>
                                <Button
                                  size="xs"
                                  colorScheme="green"
                                  variant="outline"
                                  onPress={e => {
                                    e.stopPropagation();
                                    navigation.navigate('TournamentProgress', {
                                      tournamentId: tournament.id,
                                    });
                                  }}
                                >
                                  Progress
                                </Button>
                              </VStack>
                            )}
                          </VStack>
                        </HStack>
                      </Box>
                    </Card>
                  </Pressable>
                ))}
              </VStack>
            )}
          </VStack>

          {/* Quick Actions */}
          <VStack space={4}>
            <Text fontSize="xl" fontWeight="bold" color="gray.800">
              Quick Actions
            </Text>

            <VStack space={3}>
              <Pressable
                onPress={() => navigation.navigate('CreateTournament')}
              >
                <Box bg="white" p={4} rounded="lg" shadow={1}>
                  <HStack space={3} alignItems="center">
                    <Icon
                      as={<MaterialIcons name="add-circle" />}
                      size={8}
                      color="primary.600"
                    />
                    <VStack flex={1}>
                      <Text fontSize="md" fontWeight="medium" color="gray.800">
                        Create Tournament
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        Set up a new tournament from scratch
                      </Text>
                    </VStack>
                    <Icon
                      as={<MaterialIcons name="chevron-right" />}
                      size={6}
                      color="gray.400"
                    />
                  </HStack>
                </Box>
              </Pressable>

              {/* Match Management Quick Action */}
              {tournaments.some(t => t.status === 'active') && (
                <Pressable
                  onPress={() => {
                    const activeTournament = tournaments.find(
                      t => t.status === 'active'
                    );
                    if (activeTournament) {
                      navigation.navigate('MatchManagement', {
                        tournamentId: activeTournament.id,
                      });
                    }
                  }}
                >
                  <Box bg="white" p={4} rounded="lg" shadow={1}>
                    <HStack space={3} alignItems="center">
                      <Icon
                        as={<MaterialIcons name="sports" />}
                        size={8}
                        color="blue.600"
                      />
                      <VStack flex={1}>
                        <Text
                          fontSize="md"
                          fontWeight="medium"
                          color="gray.800"
                        >
                          Manage Active Matches
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          Control live matches and track scores
                        </Text>
                      </VStack>
                      <Icon
                        as={<MaterialIcons name="chevron-right" />}
                        size={6}
                        color="gray.400"
                      />
                    </HStack>
                  </Box>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  toast.show({
                    title: 'Create Tournament First',
                    description:
                      'You need to create a tournament before importing players',
                  });
                }}
              >
                <Box
                  bg="white"
                  p={4}
                  rounded="lg"
                  shadow={1}
                  opacity={tournaments.length === 0 ? 0.6 : 1}
                >
                  <HStack space={3} alignItems="center">
                    <Icon
                      as={<MaterialIcons name="upload-file" />}
                      size={8}
                      color="green.600"
                    />
                    <VStack flex={1}>
                      <Text fontSize="md" fontWeight="medium" color="gray.800">
                        Import Players
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {tournaments.length === 0
                          ? 'Create a tournament first to import players'
                          : 'Upload player data from CSV file'}
                      </Text>
                    </VStack>
                    <Icon
                      as={<MaterialIcons name="chevron-right" />}
                      size={6}
                      color="gray.400"
                    />
                  </HStack>
                </Box>
              </Pressable>
            </VStack>
          </VStack>
        </VStack>
      </ScrollView>

      {/* Floating Action Button */}
      <Fab
        renderInPortal={false}
        shadow={2}
        size="lg"
        colorScheme="primary"
        icon={<Icon color="white" as={<MaterialIcons name="add" />} size={6} />}
        onPress={() => navigation.navigate('CreateTournament')}
      />
    </Box>
  );
};

export default DashboardScreen;

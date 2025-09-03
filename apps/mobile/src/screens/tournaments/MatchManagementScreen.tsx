import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  ScrollView,
  Text,
  Button,
  Input,
  Select,
  Badge,
  Card,
  Icon,
  Pressable,
  useToast,
  Spinner,
  Center,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Match, Player, Tournament } from '@protour/shared';
import {
  MatchService,
  PlayerService,
  TournamentService,
} from '@protour/shared';
import { MatchManagementScreenProps } from '../../navigation/types';

interface MatchWithPlayers extends Match {
  player1Name: string;
  player2Name?: string;
  courtStatus?: 'available' | 'occupied' | 'maintenance';
}

const MatchManagementScreen: React.FC<MatchManagementScreenProps> = ({
  route,
  navigation,
}) => {
  const { tournamentId } = route.params;
  const toast = useToast();

  // Services
  const [matchService] = useState(() => new MatchService());
  const [playerService] = useState(() => new PlayerService());
  const [tournamentService] = useState(() => new TournamentService());

  // State
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<Match['status'] | ''>(
    ''
  );
  const [selectedCourt, setSelectedCourt] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Court management
  const [availableCourts] = useState<string[]>([
    'Court 1',
    'Court 2',
    'Court 3',
    'Court 4',
    'Court 5',
    'Court 6',
  ]);

  useEffect(() => {
    loadTournamentData();
  }, []);

  const loadTournamentData = async () => {
    try {
      setLoading(true);

      // Load tournament info
      const tournamentData =
        await tournamentService.getTournament(tournamentId);
      if (!tournamentData) {
        throw new Error('Tournament not found');
      }
      setTournament(tournamentData);

      // Load players
      const playersData =
        await playerService.getPlayersByTournament(tournamentId);
      setPlayers(playersData);

      // Load matches
      await loadMatches();
    } catch (error) {
      toast.show({
        title: 'Error loading tournament data',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    try {
      const matchesData =
        await matchService.getMatchesByTournament(tournamentId);

      // Create player name lookup
      const playerMap = new Map(
        players.map(player => [player.id, player.name])
      );

      // Enhance matches with player names
      const matchesWithPlayers: MatchWithPlayers[] = matchesData.map(match => ({
        ...match,
        player1Name: playerMap.get(match.player1Id) || 'Unknown Player',
        player2Name: match.player2Id
          ? playerMap.get(match.player2Id) || 'Unknown Player'
          : undefined,
        courtStatus: getCourtStatus(match.court),
      }));

      setMatches(matchesWithPlayers);
    } catch (error) {
      toast.show({
        title: 'Error loading matches',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const getCourtStatus = (
    court?: string
  ): 'available' | 'occupied' | 'maintenance' => {
    if (!court) return 'available';

    const matchesOnCourt = matches.filter(
      m => m.court === court && m.status === 'in-progress'
    );

    return matchesOnCourt.length > 0 ? 'occupied' : 'available';
  };

  const getFilteredMatches = () => {
    return matches.filter(match => {
      // Round filter
      if (selectedRound !== null && match.round !== selectedRound) {
        return false;
      }

      // Status filter
      if (selectedStatus && match.status !== selectedStatus) {
        return false;
      }

      // Court filter
      if (selectedCourt && match.court !== selectedCourt) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          match.player1Name.toLowerCase().includes(query) ||
          (match.player2Name &&
            match.player2Name.toLowerCase().includes(query)) ||
          match.matchNumber.toString().includes(query)
        );
      }

      return true;
    });
  };

  const handleMatchPress = (match: MatchWithPlayers) => {
    navigation.navigate('MatchDetail', {
      matchId: match.id,
      tournamentId,
    });
  };

  const handleStartMatch = async (matchId: string) => {
    try {
      await matchService.startMatch(matchId);
      await loadMatches();

      toast.show({
        title: 'Match started successfully',
      });
    } catch (error) {
      toast.show({
        title: 'Error starting match',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const assignCourt = async (matchId: string, court: string) => {
    try {
      await matchService.updateMatch(matchId, { court });
      await loadMatches();

      toast.show({
        title: 'Court assigned successfully',
      });
    } catch (error) {
      toast.show({
        title: 'Error assigning court',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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

  const getCourtStatusColor = (status: string) => {
    switch (status) {
      case 'occupied':
        return 'red';
      case 'available':
        return 'green';
      case 'maintenance':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const renderMatchCard = (match: MatchWithPlayers) => (
    <Pressable key={match.id} onPress={() => handleMatchPress(match)}>
      <Card size="sm" mb={3}>
        <Box>
          <VStack space={3}>
            {/* Match Header */}
            <HStack justifyContent="space-between" alignItems="center">
              <HStack alignItems="center" space={2}>
                <Text fontSize="md" fontWeight="bold" color="gray.700">
                  Round {match.round} - Match {match.matchNumber}
                </Text>
                <Badge
                  size="sm"
                  colorScheme={getStatusColor(match.status)}
                  variant="subtle"
                  startIcon={
                    <Icon
                      as={MaterialIcons}
                      name={getStatusIcon(match.status)}
                      size="xs"
                    />
                  }
                >
                  {match.status}
                </Badge>
              </HStack>

              {match.court && (
                <Badge
                  size="sm"
                  colorScheme={getCourtStatusColor(
                    match.courtStatus || 'available'
                  )}
                  variant="outline"
                >
                  {match.court}
                </Badge>
              )}
            </HStack>

            {/* Players */}
            <VStack space={2}>
              <HStack justifyContent="space-between" alignItems="center">
                <Text fontSize="sm" fontWeight="medium" flex={1}>
                  {match.player1Name}
                </Text>
                {match.winnerId === match.player1Id && (
                  <Icon
                    as={MaterialIcons}
                    name="emoji-events"
                    size="sm"
                    color="gold"
                  />
                )}
              </HStack>

              <Center>
                <Text fontSize="xs" color="gray.500" fontWeight="bold">
                  VS
                </Text>
              </Center>

              <HStack justifyContent="space-between" alignItems="center">
                <Text
                  fontSize="sm"
                  fontWeight="medium"
                  flex={1}
                  color={!match.player2Name ? 'orange.600' : 'gray.700'}
                  italic={!match.player2Name}
                >
                  {match.player2Name || 'BYE'}
                </Text>
                {match.player2Id && match.winnerId === match.player2Id && (
                  <Icon
                    as={MaterialIcons}
                    name="emoji-events"
                    size="sm"
                    color="gold"
                  />
                )}
              </HStack>
            </VStack>

            {/* Action Buttons */}
            <HStack space={2} justifyContent="flex-end">
              {!match.court && match.status === 'pending' && (
                <Select
                  placeholder="Assign Court"
                  size="sm"
                  minW="120px"
                  onValueChange={court => assignCourt(match.id, court)}
                >
                  {availableCourts.map(court => (
                    <Select.Item key={court} label={court} value={court} />
                  ))}
                </Select>
              )}

              {match.status === 'pending' && match.court && (
                <Button
                  size="sm"
                  colorScheme="green"
                  onPress={() => handleStartMatch(match.id)}
                  startIcon={
                    <Icon as={MaterialIcons} name="play-arrow" size="xs" />
                  }
                >
                  Start
                </Button>
              )}

              {match.status === 'in-progress' && (
                <Button
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  onPress={() => handleMatchPress(match)}
                  startIcon={<Icon as={MaterialIcons} name="edit" size="xs" />}
                >
                  Score
                </Button>
              )}
            </HStack>
          </VStack>
        </Box>
      </Card>
    </Pressable>
  );

  const filteredMatches = getFilteredMatches();
  const totalRounds = tournament ? Math.max(...matches.map(m => m.round)) : 0;

  if (loading) {
    return (
      <Center flex={1}>
        <Spinner size="lg" color="primary.600" />
        <Text mt={4} color="gray.600">
          Loading matches...
        </Text>
      </Center>
    );
  }

  return (
    <Box flex={1} bg="gray.50">
      {/* Header */}
      <Box bg="white" shadow={1}>
        <VStack space={4} p={4}>
          <HStack justifyContent="space-between" alignItems="center">
            <VStack>
              <Text fontSize="lg" fontWeight="bold">
                {tournament?.name}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Match Management
              </Text>
            </VStack>
            <Button
              size="sm"
              variant="outline"
              onPress={loadMatches}
              startIcon={<Icon as={MaterialIcons} name="refresh" size="xs" />}
            >
              Refresh
            </Button>
          </HStack>

          {/* Stats */}
          <HStack space={4} justifyContent="space-around">
            <VStack alignItems="center">
              <Text fontSize="xl" fontWeight="bold" color="blue.600">
                {matches.filter(m => m.status === 'completed').length}
              </Text>
              <Text fontSize="xs" color="gray.600">
                Completed
              </Text>
            </VStack>
            <VStack alignItems="center">
              <Text fontSize="xl" fontWeight="bold" color="green.600">
                {matches.filter(m => m.status === 'in-progress').length}
              </Text>
              <Text fontSize="xs" color="gray.600">
                In Progress
              </Text>
            </VStack>
            <VStack alignItems="center">
              <Text fontSize="xl" fontWeight="bold" color="gray.600">
                {matches.filter(m => m.status === 'pending').length}
              </Text>
              <Text fontSize="xs" color="gray.600">
                Pending
              </Text>
            </VStack>
            <VStack alignItems="center">
              <Text fontSize="xl" fontWeight="bold" color="purple.600">
                {totalRounds}
              </Text>
              <Text fontSize="xs" color="gray.600">
                Rounds
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </Box>

      {/* Filters */}
      <Box bg="white" mt={2} p={4}>
        <VStack space={3}>
          <Input
            placeholder="Search by player name or match number..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            InputLeftElement={
              <Icon
                as={MaterialIcons}
                name="search"
                size="sm"
                ml={2}
                color="gray.400"
              />
            }
          />

          <HStack space={2}>
            <Select
              flex={1}
              placeholder="All Rounds"
              selectedValue={selectedRound?.toString() || ''}
              onValueChange={value =>
                setSelectedRound(value ? parseInt(value) : null)
              }
            >
              {Array.from({ length: totalRounds }, (_, i) => i + 1).map(
                round => (
                  <Select.Item
                    key={round}
                    label={`Round ${round}`}
                    value={round.toString()}
                  />
                )
              )}
            </Select>

            <Select
              flex={1}
              placeholder="All Status"
              selectedValue={selectedStatus}
              onValueChange={(value: string) =>
                setSelectedStatus(
                  value as '' | 'pending' | 'completed' | 'in-progress'
                )
              }
            >
              <Select.Item label="Pending" value="pending" />
              <Select.Item label="In Progress" value="in-progress" />
              <Select.Item label="Completed" value="completed" />
            </Select>

            <Select
              flex={1}
              placeholder="All Courts"
              selectedValue={selectedCourt}
              onValueChange={setSelectedCourt}
            >
              {availableCourts.map(court => (
                <Select.Item key={court} label={court} value={court} />
              ))}
            </Select>
          </HStack>
        </VStack>
      </Box>

      {/* Matches List */}
      <ScrollView flex={1} p={4}>
        {filteredMatches.length === 0 ? (
          <Center py={8}>
            <Icon
              as={MaterialIcons}
              name="search-off"
              size="xl"
              color="gray.400"
            />
            <Text mt={2} color="gray.600">
              No matches found matching your filters
            </Text>
          </Center>
        ) : (
          <VStack space={2}>{filteredMatches.map(renderMatchCard)}</VStack>
        )}
      </ScrollView>
    </Box>
  );
};

export default MatchManagementScreen;

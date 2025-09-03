import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  useToast,
  Center,
  Spinner,
  Modal,
  FlatList,
  Pressable,
  Badge,
  Alert,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import {
  BracketStructure,
  BracketService,
  PlayerService,
  TournamentService,
  Player,
  Tournament,
} from '@protour/shared';
import { BracketEditScreenProps } from '../../navigation/types';

const BracketEditScreen: React.FC<BracketEditScreenProps> = ({
  navigation,
  route,
}) => {
  const { tournamentId } = route.params;
  const [bracket, setBracket] = useState<BracketStructure | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSeedingModal, setShowSeedingModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [seedPositions, setSeedPositions] = useState<Map<string, number>>(
    new Map()
  );

  const toast = useToast();
  const bracketService = new BracketService();
  const playerService = new PlayerService();
  const tournamentService = new TournamentService();

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [tournamentData, playersData] = await Promise.all([
        tournamentService.getTournament(tournamentId),
        playerService.getPlayersByTournament(tournamentId),
      ]);

      setTournament(tournamentData);
      setPlayers(playersData);

      // Initialize seed positions
      const initialSeeds = new Map();
      playersData.forEach(player => {
        if (player.seedPosition) {
          initialSeeds.set(player.id, player.seedPosition);
        }
      });
      setSeedPositions(initialSeeds);

      // Load bracket if exists
      try {
        const existingBracket =
          await bracketService.getBracketStructure(tournamentId);
        setBracket(existingBracket);
      } catch (error) {
        setBracket(null);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.show({
        title: 'Error',
        description: error.message || 'Failed to load tournament data',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSeedPosition = (playerId: string, newPosition: number) => {
    const newSeeds = new Map(seedPositions);

    // If position is already taken, swap with existing player
    const existingPlayerWithPosition = Array.from(newSeeds.entries()).find(
      ([_, position]) => position === newPosition
    );

    if (existingPlayerWithPosition) {
      const [existingPlayerId] = existingPlayerWithPosition;
      const currentPlayerPosition = newSeeds.get(playerId);

      if (currentPlayerPosition) {
        newSeeds.set(existingPlayerId, currentPlayerPosition);
      } else {
        newSeeds.delete(existingPlayerId);
      }
    }

    newSeeds.set(playerId, newPosition);
    setSeedPositions(newSeeds);
  };

  const saveSeedPositions = async () => {
    setSaving(true);
    try {
      // Update each player's seed position
      const updatePromises = players.map(player => {
        const newSeedPosition = seedPositions.get(player.id);
        if (newSeedPosition !== player.seedPosition) {
          return playerService.updatePlayer(player.id, {
            seedPosition: newSeedPosition,
          });
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);

      toast.show({
        title: 'Seeding Updated',
        description: 'Player seed positions have been saved successfully',
      });

      // Reload data to reflect changes
      await loadData();
    } catch (error: any) {
      console.error('Error saving seed positions:', error);
      toast.show({
        title: 'Save Failed',
        description: error.message || 'Failed to save seed positions',
      });
    } finally {
      setSaving(false);
    }
  };

  const regenerateBracket = async () => {
    if (players.length < 4) {
      toast.show({
        title: 'Not Enough Players',
        description: 'At least 4 players are required to generate a bracket.',
      });
      return;
    }

    setSaving(true);
    try {
      // Save current seed positions first
      await saveSeedPositions();

      // Generate new bracket with manual seeding (using current positions)
      const newBracket = await bracketService.generateSingleEliminationBracket(
        tournamentId,
        players,
        'manual'
      );

      setBracket(newBracket);

      toast.show({
        title: 'Bracket Regenerated',
        description: 'Bracket updated with your custom seeding',
      });
    } catch (error: any) {
      console.error('Error regenerating bracket:', error);
      toast.show({
        title: 'Regeneration Failed',
        description: error.message || 'Failed to regenerate bracket',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderSeedingModal = () => (
    <Modal
      isOpen={showSeedingModal}
      onClose={() => setShowSeedingModal(false)}
      size="full"
    >
      <Modal.Content>
        <Modal.CloseButton />
        <Modal.Header>Edit Player Seeding</Modal.Header>
        <Modal.Body>
          <VStack space={4}>
            <Alert status="info">
              <VStack space={2} w="100%">
                <Text fontWeight="medium">Manual Seeding Instructions:</Text>
                <Text fontSize="sm">
                  • Tap on a player to assign their seed position
                </Text>
                <Text fontSize="sm">
                  • Lower seed numbers = higher priority in bracket
                </Text>
                <Text fontSize="sm">
                  • Seed 1 is the top player, Seed 2 is second best, etc.
                </Text>
              </VStack>
            </Alert>

            <FlatList
              data={players.sort((a, b) => {
                const seedA = seedPositions.get(a.id) || 999;
                const seedB = seedPositions.get(b.id) || 999;
                return seedA - seedB;
              })}
              keyExtractor={item => item.id}
              renderItem={({ item: player }) => (
                <Pressable onPress={() => setSelectedPlayer(player)} mb={2}>
                  <Box
                    bg="white"
                    p={4}
                    rounded="lg"
                    borderWidth={selectedPlayer?.id === player.id ? 2 : 1}
                    borderColor={
                      selectedPlayer?.id === player.id
                        ? 'primary.500'
                        : 'gray.200'
                    }
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1}>
                        <Text fontWeight="medium">{player.name}</Text>
                        <Text fontSize="sm" color="gray.600">
                          {player.email}
                        </Text>
                        {player.ranking && (
                          <Text fontSize="xs" color="gray.500">
                            Ranking: {player.ranking}
                          </Text>
                        )}
                      </VStack>

                      <VStack alignItems="center" space={1}>
                        <Text fontSize="xs" color="gray.500">
                          Seed
                        </Text>
                        <Badge
                          colorScheme={
                            seedPositions.get(player.id) ? 'primary' : 'gray'
                          }
                          variant={
                            seedPositions.get(player.id) ? 'solid' : 'outline'
                          }
                          rounded="full"
                          px={3}
                          py={1}
                        >
                          {seedPositions.get(player.id) || 'None'}
                        </Badge>
                      </VStack>
                    </HStack>
                  </Box>
                </Pressable>
              )}
            />

            {selectedPlayer && (
              <Box bg="gray.50" p={4} rounded="lg">
                <VStack space={3}>
                  <Text fontWeight="medium">
                    Assign seed position for {selectedPlayer.name}:
                  </Text>

                  <HStack space={2} flexWrap="wrap">
                    {Array.from(
                      { length: Math.min(players.length, 16) },
                      (_, i) => i + 1
                    ).map(position => {
                      const isAssigned = Array.from(
                        seedPositions.values()
                      ).includes(position);
                      const isCurrentPlayer =
                        seedPositions.get(selectedPlayer.id) === position;

                      return (
                        <Pressable
                          key={position}
                          onPress={() =>
                            updateSeedPosition(selectedPlayer.id, position)
                          }
                          mb={2}
                        >
                          <Box
                            bg={
                              isCurrentPlayer
                                ? 'primary.500'
                                : isAssigned
                                  ? 'gray.300'
                                  : 'white'
                            }
                            px={3}
                            py={2}
                            rounded="full"
                            borderWidth={1}
                            borderColor={
                              isCurrentPlayer ? 'primary.500' : 'gray.300'
                            }
                            minW="12"
                            alignItems="center"
                          >
                            <Text
                              color={
                                isCurrentPlayer
                                  ? 'white'
                                  : isAssigned
                                    ? 'gray.600'
                                    : 'gray.800'
                              }
                              fontWeight={isCurrentPlayer ? 'bold' : 'medium'}
                            >
                              {position}
                            </Text>
                          </Box>
                        </Pressable>
                      );
                    })}
                  </HStack>

                  <Button
                    size="sm"
                    variant="outline"
                    colorScheme="red"
                    onPress={() => {
                      const newSeeds = new Map(seedPositions);
                      newSeeds.delete(selectedPlayer.id);
                      setSeedPositions(newSeeds);
                      setSelectedPlayer(null);
                    }}
                  >
                    Remove Seed
                  </Button>
                </VStack>
              </Box>
            )}
          </VStack>
        </Modal.Body>
        <Modal.Footer>
          <HStack space={2}>
            <Button
              variant="ghost"
              onPress={() => {
                setShowSeedingModal(false);
                setSelectedPlayer(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onPress={async () => {
                await saveSeedPositions();
                setShowSeedingModal(false);
                setSelectedPlayer(null);
              }}
              isLoading={saving}
            >
              Save Changes
            </Button>
          </HStack>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );

  if (loading) {
    return (
      <Center flex={1}>
        <VStack space={3} alignItems="center">
          <Spinner size="lg" color="primary.600" />
          <Text color="gray.600">Loading tournament data...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box flex={1} bg="white" safeArea>
      {/* Header */}
      <HStack
        alignItems="center"
        px={4}
        py={3}
        borderBottomWidth={1}
        borderBottomColor="gray.200"
      >
        <Button
          variant="ghost"
          onPress={() => navigation.goBack()}
          leftIcon={<Icon as={MaterialIcons} name="arrow-back" />}
        >
          Back
        </Button>
        <VStack flex={1} alignItems="center" mx={4}>
          <Text fontSize="lg" fontWeight="semibold">
            Edit Bracket
          </Text>
          <Text fontSize="sm" color="gray.600">
            {tournament?.name}
          </Text>
        </VStack>
        <Box w={16} />
      </HStack>

      <VStack flex={1} space={6} p={6}>
        {/* Player Summary */}
        <Box bg="gray.50" p={4} rounded="lg">
          <VStack space={3}>
            <Text fontSize="lg" fontWeight="bold">
              Tournament Summary
            </Text>
            <HStack space={6}>
              <VStack alignItems="center">
                <Text fontSize="2xl" fontWeight="bold" color="blue.600">
                  {players.length}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Total Players
                </Text>
              </VStack>
              <VStack alignItems="center">
                <Text fontSize="2xl" fontWeight="bold" color="green.600">
                  {Array.from(seedPositions.values()).length}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Seeded Players
                </Text>
              </VStack>
              <VStack alignItems="center">
                <Text fontSize="2xl" fontWeight="bold" color="orange.600">
                  {bracket ? bracket.totalRounds : '?'}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Tournament Rounds
                </Text>
              </VStack>
            </HStack>
          </VStack>
        </Box>

        {/* Seeding Controls */}
        <VStack space={4}>
          <Text fontSize="lg" fontWeight="bold">
            Seeding Management
          </Text>

          <VStack space={3}>
            <Button
              leftIcon={<Icon as={MaterialIcons} name="edit" />}
              onPress={() => setShowSeedingModal(true)}
              variant="outline"
            >
              Edit Player Seeding
            </Button>

            <HStack space={3}>
              <Button
                flex={1}
                leftIcon={<Icon as={MaterialIcons} name="shuffle" />}
                onPress={() => {
                  // Reset all seed positions
                  setSeedPositions(new Map());
                  toast.show({
                    title: 'Seeding Cleared',
                    description: 'All seed positions have been cleared',
                  });
                }}
                variant="outline"
                colorScheme="orange"
              >
                Clear Seeding
              </Button>

              <Button
                flex={1}
                leftIcon={<Icon as={MaterialIcons} name="sort" />}
                onPress={() => {
                  // Auto-seed by ranking
                  const rankedPlayers = players
                    .filter(p => p.ranking)
                    .sort((a, b) => (a.ranking || 0) - (b.ranking || 0));

                  const newSeeds = new Map();
                  rankedPlayers.forEach((player, index) => {
                    newSeeds.set(player.id, index + 1);
                  });

                  setSeedPositions(newSeeds);
                  toast.show({
                    title: 'Auto-Seeding Applied',
                    description: `${rankedPlayers.length} players seeded by ranking`,
                  });
                }}
                variant="outline"
                colorScheme="blue"
                isDisabled={players.filter(p => p.ranking).length === 0}
              >
                Auto-Seed by Ranking
              </Button>
            </HStack>
          </VStack>
        </VStack>

        {/* Bracket Actions */}
        <VStack space={4}>
          <Text fontSize="lg" fontWeight="bold">
            Bracket Actions
          </Text>

          <VStack space={3}>
            <Button
              leftIcon={<Icon as={MaterialIcons} name="account-tree" />}
              onPress={regenerateBracket}
              isLoading={saving}
              isLoadingText="Regenerating..."
              colorScheme="primary"
            >
              {bracket
                ? 'Regenerate Bracket with Current Seeding'
                : 'Generate Bracket'}
            </Button>

            {bracket && (
              <Button
                leftIcon={<Icon as={MaterialIcons} name="visibility" />}
                onPress={() =>
                  navigation.navigate('BracketView', { tournamentId })
                }
                variant="outline"
              >
                View Current Bracket
              </Button>
            )}
          </VStack>
        </VStack>

        {/* Current Seeding Preview */}
        {Array.from(seedPositions.entries()).length > 0 && (
          <VStack space={4}>
            <Text fontSize="lg" fontWeight="bold">
              Current Seeding
            </Text>

            <VStack space={2}>
              {Array.from(seedPositions.entries())
                .sort(([, a], [, b]) => a - b)
                .slice(0, 8)
                .map(([playerId, position]) => {
                  const player = players.find(p => p.id === playerId);
                  return (
                    <HStack
                      key={playerId}
                      justifyContent="space-between"
                      alignItems="center"
                      p={2}
                      bg="gray.50"
                      rounded="md"
                    >
                      <HStack space={3} alignItems="center">
                        <Badge
                          colorScheme="primary"
                          rounded="full"
                          w="8"
                          h="8"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Text color="white" fontSize="sm" fontWeight="bold">
                            {position}
                          </Text>
                        </Badge>
                        <VStack>
                          <Text fontWeight="medium">{player?.name}</Text>
                          {player?.ranking && (
                            <Text fontSize="xs" color="gray.600">
                              Ranking: {player.ranking}
                            </Text>
                          )}
                        </VStack>
                      </HStack>
                    </HStack>
                  );
                })}
              {Array.from(seedPositions.entries()).length > 8 && (
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  ... and {Array.from(seedPositions.entries()).length - 8} more
                  seeded players
                </Text>
              )}
            </VStack>
          </VStack>
        )}
      </VStack>

      {/* Seeding Modal */}
      {renderSeedingModal()}
    </Box>
  );
};

export default BracketEditScreen;

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
  Alert,
  Modal,
  ScrollView,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import {
  BracketStructure,
  BracketService,
  PlayerService,
  TournamentService,
  Player,
  Tournament,
  Match,
} from '@protour/shared';
import BracketVisualization from '../../components/tournament/BracketVisualization';
import WorkflowStepper from '../../components/tournament/WorkflowStepper';
import { BracketViewScreenProps } from '../../navigation/types';

const BracketViewScreen: React.FC<BracketViewScreenProps> = ({
  navigation,
  route,
}) => {
  const { tournamentId } = route.params;
  const [bracket, setBracket] = useState<BracketStructure | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

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

      // Load tournament and players in parallel
      const [tournamentData, playersData] = await Promise.all([
        tournamentService.getTournament(tournamentId),
        playerService.getPlayersByTournament(tournamentId),
      ]);

      setTournament(tournamentData);
      setPlayers(playersData);

      // Try to load existing bracket
      try {
        const existingBracket =
          await bracketService.getBracketStructure(tournamentId);
        setBracket(existingBracket);
      } catch (error) {
        // No bracket exists yet - this is normal
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

  const generateBracket = async (
    seedingMethod: 'random' | 'ranking' | 'manual' = 'random'
  ) => {
    if (players.length < 4) {
      toast.show({
        title: 'Not Enough Players',
        description: 'At least 4 players are required to generate a bracket.',
      });
      return;
    }

    setGenerating(true);
    try {
      const newBracket = await bracketService.generateSingleEliminationBracket(
        tournamentId,
        players,
        seedingMethod
      );

      setBracket(newBracket);

      toast.show({
        title: 'Bracket Generated!',
        description: `Successfully created bracket with ${players.length} players`,
      });
    } catch (error: any) {
      console.error('Error generating bracket:', error);
      toast.show({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate bracket',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleMatchPress = (match: Match) => {
    setSelectedMatch(match);
    setShowMatchModal(true);
  };

  const renderGenerationOptions = () => (
    <VStack space={4} p={6}>
      <VStack space={2} alignItems="center">
        <Icon
          as={MaterialIcons}
          name="account-tree"
          size="16"
          color="gray.400"
        />
        <Text fontSize="lg" fontWeight="bold" color="gray.600">
          No Bracket Generated
        </Text>
        <Text fontSize="sm" color="gray.500" textAlign="center">
          Generate a tournament bracket to organize matches for your{' '}
          {players.length} players
        </Text>
      </VStack>

      <Alert status="info" variant="left-accent">
        <VStack space={2} w="100%">
          <Text fontWeight="medium">Seeding Options:</Text>
          <VStack space={1} ml={4}>
            <Text fontSize="sm">
              • <Text fontWeight="medium">Random:</Text> Players placed randomly
            </Text>
            <Text fontSize="sm">
              • <Text fontWeight="medium">Ranking:</Text> Based on player
              rankings
            </Text>
            <Text fontSize="sm">
              • <Text fontWeight="medium">Manual:</Text> Keep current seed
              positions
            </Text>
          </VStack>
        </VStack>
      </Alert>

      <VStack space={3}>
        <Button
          colorScheme="primary"
          leftIcon={<Icon as={MaterialIcons} name="shuffle" />}
          onPress={() => generateBracket('random')}
          isLoading={generating}
          isLoadingText="Generating..."
        >
          Generate with Random Seeding
        </Button>

        <Button
          variant="outline"
          colorScheme="primary"
          leftIcon={<Icon as={MaterialIcons} name="sort" />}
          onPress={() => generateBracket('ranking')}
          isLoading={generating}
          isDisabled={players.filter(p => p.ranking).length === 0}
        >
          Generate with Ranking Seeding
          {players.filter(p => p.ranking).length === 0 && (
            <Text fontSize="xs" color="gray.500" ml={2}>
              (No rankings available)
            </Text>
          )}
        </Button>

        <Button
          variant="ghost"
          colorScheme="primary"
          leftIcon={<Icon as={MaterialIcons} name="edit" />}
          onPress={() => generateBracket('manual')}
          isLoading={generating}
        >
          Generate with Manual Seeding
        </Button>
      </VStack>

      <Box bg="yellow.50" p={4} rounded="lg">
        <HStack space={2} alignItems="flex-start">
          <Icon as={MaterialIcons} name="lightbulb" color="yellow.600" />
          <VStack flex={1}>
            <Text fontSize="sm" fontWeight="medium" color="yellow.800">
              Pro Tip
            </Text>
            <Text fontSize="sm" color="yellow.700">
              For competitive tournaments, use ranking-based seeding to ensure
              fair matchups. Random seeding works well for casual events.
            </Text>
          </VStack>
        </HStack>
      </Box>
    </VStack>
  );

  const renderMatchModal = () => (
    <Modal isOpen={showMatchModal} onClose={() => setShowMatchModal(false)}>
      <Modal.Content>
        <Modal.CloseButton />
        <Modal.Header>Match Details</Modal.Header>
        <Modal.Body>
          {selectedMatch && (
            <VStack space={3}>
              <HStack justifyContent="space-between">
                <Text fontWeight="bold">
                  Match #{selectedMatch.matchNumber}
                </Text>
                <Text color="gray.600">Round {selectedMatch.round}</Text>
              </HStack>

              <VStack space={2}>
                <Text fontWeight="medium">Players:</Text>
                <Text>
                  •{' '}
                  {players.find(p => p.id === selectedMatch.player1Id)?.name ||
                    'TBD'}
                </Text>
                <Text>
                  •{' '}
                  {selectedMatch.player2Id
                    ? players.find(p => p.id === selectedMatch.player2Id)
                        ?.name || 'TBD'
                    : 'BYE'}
                </Text>
              </VStack>

              {selectedMatch.winnerId && (
                <VStack space={1}>
                  <Text fontWeight="medium">Winner:</Text>
                  <Text color="green.600">
                    {players.find(p => p.id === selectedMatch.winnerId)?.name}
                  </Text>
                </VStack>
              )}

              <HStack justifyContent="space-between">
                <Text fontWeight="medium">Status:</Text>
                <Text
                  color={
                    selectedMatch.status === 'completed'
                      ? 'green.600'
                      : 'gray.600'
                  }
                >
                  {selectedMatch.status.charAt(0).toUpperCase() +
                    selectedMatch.status.slice(1)}
                </Text>
              </HStack>

              {selectedMatch.court && (
                <HStack justifyContent="space-between">
                  <Text fontWeight="medium">Court:</Text>
                  <Text>{selectedMatch.court}</Text>
                </HStack>
              )}
            </VStack>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onPress={() => setShowMatchModal(false)}>
            Close
          </Button>
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
            Tournament Bracket
          </Text>
          <Text fontSize="sm" color="gray.600">
            {tournament?.name}
          </Text>
        </VStack>
        <Box w={16}>
          {bracket && (
            <Button
              variant="ghost"
              onPress={() => {
                // TODO: Add export functionality
                toast.show({
                  title: 'Export Feature',
                  description: 'Bracket export coming soon!',
                });
              }}
            >
              <Icon as={MaterialIcons} name="share" />
            </Button>
          )}
        </Box>
      </HStack>

      {/* Content */}
      {!bracket ? (
        <ScrollView flex={1} contentContainerStyle={{ padding: 16 }}>
          <WorkflowStepper
            currentStep="bracket"
            tournamentId={tournamentId}
            playerCount={players.length}
            hasValidation={true}
          />
          {renderGenerationOptions()}
        </ScrollView>
      ) : (
        <VStack flex={1}>
          {/* Action Buttons */}
          <HStack space={2} p={4} bg="gray.50">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Icon as={MaterialIcons} name="refresh" />}
              onPress={() => generateBracket('random')}
              isLoading={generating}
            >
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Icon as={MaterialIcons} name="edit" />}
              onPress={() =>
                navigation.navigate('BracketEdit', { tournamentId })
              }
            >
              Edit
            </Button>
          </HStack>

          {/* Bracket Display */}
          <BracketVisualization
            bracket={bracket}
            players={players}
            onMatchPress={handleMatchPress}
          />
        </VStack>
      )}

      {/* Match Details Modal */}
      {renderMatchModal()}
    </Box>
  );
};

export default BracketViewScreen;

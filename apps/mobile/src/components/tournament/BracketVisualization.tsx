import React from 'react';
import {
  Box,
  ScrollView,
  VStack,
  HStack,
  Text,
  Card,
  Badge,
  Icon,
  Pressable,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { Match, Player, BracketStructure } from '@protour/shared';

interface BracketVisualizationProps {
  bracket: BracketStructure;
  players: Player[];
  onMatchPress?: (match: Match) => void;
  editable?: boolean;
}

interface BracketMatch extends Match {
  player1Name?: string;
  player2Name?: string;
}

const BracketVisualization: React.FC<BracketVisualizationProps> = ({
  bracket,
  players,
  onMatchPress,
  editable = false,
}) => {
  // Create a map for quick player lookup
  const playerMap = new Map(players.map(player => [player.id, player]));

  // Group matches by round
  const matchesByRound = bracket.matches.reduce(
    (acc, match) => {
      if (!acc[match.round]) {
        acc[match.round] = [];
      }
      acc[match.round].push({
        ...match,
        player1Name: playerMap.get(match.player1Id)?.name || 'TBD',
        player2Name: match.player2Id
          ? playerMap.get(match.player2Id)?.name || 'TBD'
          : 'BYE',
      });
      return acc;
    },
    {} as Record<number, BracketMatch[]>
  );

  // Sort rounds
  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b);

  const getRoundName = (round: number) => {
    const totalRounds = bracket.totalRounds;
    if (round === totalRounds) return 'Final';
    if (round === totalRounds - 1) return 'Semi-Final';
    if (round === totalRounds - 2) return 'Quarter-Final';
    return `Round ${round}`;
  };

  const getMatchStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'completed':
        return 'green.500';
      case 'in-progress':
        return 'blue.500';
      case 'pending':
        return 'gray.400';
      default:
        return 'gray.400';
    }
  };

  const getMatchStatusIcon = (status: Match['status']) => {
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

  const renderMatch = (match: BracketMatch, _roundIndex: number) => {
    const isWinner = (playerId: string) => match.winnerId === playerId;
    const hasScore = match.score && match.winnerId;

    return (
      <Pressable
        key={match.id}
        onPress={() => onMatchPress?.(match)}
        disabled={!onMatchPress}
      >
        <Card
          size="sm"
          variant={editable ? 'outline' : 'filled'}
          bg={match.status === 'completed' ? 'green.50' : 'white'}
          borderColor={match.status === 'in-progress' ? 'blue.500' : 'gray.200'}
          borderWidth={match.status === 'in-progress' ? 2 : 1}
          mb={4}
          minW="180px"
          maxW="220px"
        >
          <Box p={3}>
            <VStack space={2}>
              {/* Match Header */}
              <HStack justifyContent="space-between" alignItems="center">
                <Text fontSize="xs" fontWeight="bold" color="gray.600">
                  M{match.matchNumber}
                </Text>
                <HStack alignItems="center" space={1}>
                  <Icon
                    as={MaterialIcons}
                    name={getMatchStatusIcon(match.status)}
                    size="xs"
                    color={getMatchStatusColor(match.status)}
                  />
                  <Badge
                    size="sm"
                    colorScheme={
                      match.status === 'completed'
                        ? 'green'
                        : match.status === 'in-progress'
                          ? 'blue'
                          : 'gray'
                    }
                    variant="subtle"
                  >
                    {match.status}
                  </Badge>
                </HStack>
              </HStack>

              {/* Player 1 */}
              <Box
                bg={isWinner(match.player1Id) ? 'green.100' : 'gray.50'}
                p={2}
                rounded="md"
                borderWidth={isWinner(match.player1Id) ? 2 : 1}
                borderColor={
                  isWinner(match.player1Id) ? 'green.500' : 'gray.200'
                }
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <VStack flex={1}>
                    <Text
                      fontSize="sm"
                      fontWeight={isWinner(match.player1Id) ? 'bold' : 'medium'}
                      numberOfLines={1}
                      color={
                        isWinner(match.player1Id) ? 'green.700' : 'gray.700'
                      }
                    >
                      {match.player1Name}
                    </Text>
                    {playerMap.get(match.player1Id)?.seedPosition && (
                      <Text fontSize="xs" color="gray.500">
                        Seed #{playerMap.get(match.player1Id)?.seedPosition}
                      </Text>
                    )}
                  </VStack>
                  {hasScore && (
                    <VStack alignItems="center" minW="30px">
                      <Text
                        fontSize="sm"
                        fontWeight="bold"
                        color={
                          isWinner(match.player1Id) ? 'green.700' : 'gray.600'
                        }
                      >
                        {match.score?.player1Sets.reduce((a, b) => a + b, 0) ||
                          0}
                      </Text>
                    </VStack>
                  )}
                  {isWinner(match.player1Id) && (
                    <Icon
                      as={MaterialIcons}
                      name="emoji-events"
                      size="sm"
                      color="green.600"
                    />
                  )}
                </HStack>
              </Box>

              {/* VS Divider */}
              <HStack alignItems="center" justifyContent="center">
                <Box bg="gray.300" h="1px" flex={1} />
                <Text fontSize="xs" color="gray.500" mx={2} fontWeight="bold">
                  VS
                </Text>
                <Box bg="gray.300" h="1px" flex={1} />
              </HStack>

              {/* Player 2 */}
              <Box
                bg={
                  match.player2Id && isWinner(match.player2Id)
                    ? 'green.100'
                    : match.player2Id
                      ? 'gray.50'
                      : 'orange.50'
                }
                p={2}
                rounded="md"
                borderWidth={
                  match.player2Id && isWinner(match.player2Id) ? 2 : 1
                }
                borderColor={
                  match.player2Id && isWinner(match.player2Id)
                    ? 'green.500'
                    : match.player2Id
                      ? 'gray.200'
                      : 'orange.300'
                }
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <VStack flex={1}>
                    <Text
                      fontSize="sm"
                      fontWeight={
                        match.player2Id && isWinner(match.player2Id)
                          ? 'bold'
                          : 'medium'
                      }
                      numberOfLines={1}
                      color={
                        match.player2Id
                          ? isWinner(match.player2Id)
                            ? 'green.700'
                            : 'gray.700'
                          : 'orange.600'
                      }
                      italic={!match.player2Id}
                    >
                      {match.player2Name}
                    </Text>
                    {match.player2Id &&
                      playerMap.get(match.player2Id)?.seedPosition && (
                        <Text fontSize="xs" color="gray.500">
                          Seed #{playerMap.get(match.player2Id)?.seedPosition}
                        </Text>
                      )}
                  </VStack>
                  {hasScore && match.player2Id && (
                    <VStack alignItems="center" minW="30px">
                      <Text
                        fontSize="sm"
                        fontWeight="bold"
                        color={
                          isWinner(match.player2Id) ? 'green.700' : 'gray.600'
                        }
                      >
                        {match.score?.player2Sets.reduce((a, b) => a + b, 0) ||
                          0}
                      </Text>
                    </VStack>
                  )}
                  {match.player2Id && isWinner(match.player2Id) && (
                    <Icon
                      as={MaterialIcons}
                      name="emoji-events"
                      size="sm"
                      color="green.600"
                    />
                  )}
                </HStack>
              </Box>

              {/* Match Details */}
              {(match.court || match.startTime) && (
                <HStack space={2} mt={1}>
                  {match.court && (
                    <Badge size="sm" colorScheme="blue" variant="outline">
                      Court {match.court}
                    </Badge>
                  )}
                  {match.startTime && (
                    <Badge size="sm" colorScheme="purple" variant="outline">
                      {new Date(match.startTime.toMillis()).toLocaleTimeString(
                        [],
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </Badge>
                  )}
                </HStack>
              )}
            </VStack>
          </Box>
        </Card>
      </Pressable>
    );
  };

  const renderRound = (roundNumber: number, matches: BracketMatch[]) => {
    const sortedMatches = matches.sort((a, b) => a.matchNumber - b.matchNumber);

    return (
      <VStack key={roundNumber} space={4} alignItems="center" minW="220px">
        {/* Round Header */}
        <Box bg="primary.600" px={4} py={2} rounded="full">
          <Text color="white" fontSize="sm" fontWeight="bold">
            {getRoundName(roundNumber)}
          </Text>
        </Box>

        {/* Matches */}
        <VStack space={4} alignItems="center">
          {sortedMatches.map((match, _index) =>
            renderMatch(match, roundNumber)
          )}
        </VStack>
      </VStack>
    );
  };

  const renderBracketConnectors = () => {
    // This would be complex SVG/drawing logic for connecting lines
    // For MVP, we'll skip the connecting lines and focus on the matches
    return null;
  };

  return (
    <Box flex={1}>
      {/* Bracket Header */}
      <VStack space={3} p={4} bg="gray.50">
        <HStack justifyContent="space-between" alignItems="center">
          <VStack>
            <Text fontSize="lg" fontWeight="bold">
              Tournament Bracket
            </Text>
            <Text fontSize="sm" color="gray.600">
              {bracket.format === 'single-elimination'
                ? 'Single Elimination'
                : 'Double Elimination'}
            </Text>
          </VStack>
          <VStack alignItems="flex-end">
            <HStack space={4}>
              <VStack alignItems="center">
                <Text fontSize="lg" fontWeight="bold" color="blue.600">
                  {bracket.playerCount}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  Players
                </Text>
              </VStack>
              <VStack alignItems="center">
                <Text fontSize="lg" fontWeight="bold" color="orange.600">
                  {bracket.totalRounds}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  Rounds
                </Text>
              </VStack>
              <VStack alignItems="center">
                <Text fontSize="lg" fontWeight="bold" color="green.600">
                  {bracket.matches.filter(m => m.status === 'completed').length}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  Complete
                </Text>
              </VStack>
            </HStack>
          </VStack>
        </HStack>

        {/* Progress Bar */}
        <Box>
          <HStack justifyContent="space-between" mb={1}>
            <Text fontSize="xs" color="gray.600">
              Tournament Progress
            </Text>
            <Text fontSize="xs" color="gray.600">
              {Math.round(
                (bracket.matches.filter(m => m.status === 'completed').length /
                  bracket.matches.length) *
                  100
              )}
              %
            </Text>
          </HStack>
          <Box bg="gray.200" h="2" rounded="full">
            <Box
              bg="green.500"
              h="2"
              rounded="full"
              width={`${(bracket.matches.filter(m => m.status === 'completed').length / bracket.matches.length) * 100}%`}
            />
          </Box>
        </Box>
      </VStack>

      {/* Bracket Visualization */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} flex={1}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <HStack space={6} p={6} alignItems="flex-start" minHeight="full">
            {rounds.map(roundNumber =>
              renderRound(roundNumber, matchesByRound[roundNumber])
            )}
          </HStack>

          {/* Connector lines would go here */}
          {renderBracketConnectors()}
        </ScrollView>
      </ScrollView>
    </Box>
  );
};

export default BracketVisualization;

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
  Center,
  Spinner,
  Switch,
  Alert,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { LiveMatchScreenProps } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Match,
  MatchTimeline,
  MatchEvent,
  Tournament,
  Player,
  TournamentService,
  MatchService
} from '@protour/shared';
import { RefreshControl } from 'react-native';

const LiveMatchScreen: React.FC<LiveMatchScreenProps> = ({ 
  navigation,
  route 
}) => {
  const { matchId, tournamentId } = route.params;
  
  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [timeline, setTimeline] = useState<MatchTimeline | null>(null);
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [following, setFollowing] = useState(false);

  const { user } = useAuth();
  const toast = useToast();
  const tournamentService = new TournamentService();
  const matchService = new MatchService();

  useEffect(() => {
    loadMatchData();
    
    // Set up auto-refresh for live matches
    let intervalId: NodeJS.Timeout;
    if (autoRefresh && match?.status === 'in-progress') {
      intervalId = setInterval(loadMatchData, 10000); // Refresh every 10 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [matchId, autoRefresh, match?.status]);

  const loadMatchData = async () => {
    try {
      // Load match details
      const matchData = await matchService.getMatch(matchId);
      if (!matchData) {
        toast.show({
          title: 'Match Not Found',
          description: 'The requested match could not be found',
          status: 'error',
        });
        navigation.goBack();
        return;
      }
      setMatch(matchData);

      // Load tournament details
      const tournamentData = await tournamentService.getTournamentById(tournamentId);
      setTournament(tournamentData);

      // Load player details
      if (matchData.player1Id) {
        const player1Data = await matchService.getPlayerById(matchData.player1Id);
        setPlayer1(player1Data);
      }

      if (matchData.player2Id) {
        const player2Data = await matchService.getPlayerById(matchData.player2Id);
        setPlayer2(player2Data);
      }

      // Load match timeline if available
      if (matchData.status !== 'pending') {
        const timelineData = await matchService.getMatchTimeline(matchId);
        setTimeline(timelineData);
      }

    } catch (error: any) {
      console.error('Error loading match data:', error);
      toast.show({
        title: 'Error Loading Match',
        description: error.message || 'Failed to load match details',
        status: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMatchData();
  };

  const handleFollowMatch = async () => {
    // Toggle following state
    const newFollowing = !following;
    setFollowing(newFollowing);

    try {
      if (newFollowing) {
        await matchService.followMatch(user?.id || '', matchId);
        toast.show({
          title: 'Following Match',
          description: 'You will receive notifications for this match',
          status: 'success',
        });
      } else {
        await matchService.unfollowMatch(user?.id || '', matchId);
        toast.show({
          title: 'Unfollowed Match',
          description: 'You will no longer receive notifications for this match',
        });
      }
    } catch (error: any) {
      // Revert state on error
      setFollowing(!newFollowing);
      toast.show({
        title: 'Error',
        description: error.message || 'Failed to update follow status',
        status: 'error',
      });
    }
  };

  const formatScore = (score: any) => {
    if (!score) return '0-0';
    return `${score.player1Sets.join('-')} vs ${score.player2Sets.join('-')}`;
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

  const formatDuration = (startTime: any, endTime: any) => {
    if (!startTime) return 'Not started';
    if (!endTime && match?.status === 'in-progress') {
      const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
      const now = new Date();
      const duration = Math.floor((now.getTime() - start.getTime()) / 60000);
      return `${duration} minutes`;
    }
    if (endTime) {
      const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
      const end = endTime.toDate ? endTime.toDate() : new Date(endTime);
      const duration = Math.floor((end.getTime() - start.getTime()) / 60000);
      return `${duration} minutes`;
    }
    return 'Scheduled';
  };

  const getMatchStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'pending':
        return 'orange';
      case 'in-progress':
        return 'green';
      case 'completed':
        return 'blue';
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

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'match-start':
        return 'play-circle-filled';
      case 'point-scored':
        return 'sports-tennis';
      case 'set-completed':
        return 'flag';
      case 'match-end':
        return 'stop-circle';
      case 'timeout':
        return 'pause-circle';
      case 'injury':
        return 'medical-services';
      default:
        return 'fiber-manual-record';
    }
  };

  if (loading) {
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
                Live Match
              </Text>
            </HStack>
          </HStack>
        </Box>
        
        <Center flex={1}>
          <VStack space={3} alignItems="center">
            <Spinner size="lg" color="primary.600" />
            <Text color="gray.600">Loading match details...</Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  if (!match) {
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
                Match Not Found
              </Text>
            </HStack>
          </HStack>
        </Box>
        
        <Center flex={1}>
          <VStack space={4} alignItems="center">
            <Icon
              as={<MaterialIcons name="error" />}
              size={16}
              color="gray.400"
            />
            <Text fontSize="lg" color="gray.600">
              Match not found
            </Text>
            <Button onPress={() => navigation.goBack()}>
              Go Back
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
              <VStack>
                <Text color="white" fontSize="xl" fontWeight="bold">
                  Round {match.round}
                </Text>
                <Text color="primary.100" fontSize="sm">
                  {tournament?.name}
                </Text>
              </VStack>
            </HStack>
            
            <Badge
              bg={getMatchStatusColor(match.status) + '.500'}
              _text={{ color: 'white', fontWeight: 'bold' }}
              rounded="full"
            >
              {getMatchStatusText(match.status)}
            </Badge>
          </HStack>

          {/* Match Info */}
          <HStack justifyContent="space-between" alignItems="center">
            <VStack>
              <Text color="primary.100" fontSize="sm">
                {formatMatchTime(match.startTime)}
              </Text>
              <Text color="primary.100" fontSize="xs">
                Duration: {formatDuration(match.startTime, match.endTime)}
              </Text>
            </VStack>
            
            {match.court && (
              <Badge bg="primary.100" _text={{ color: 'primary.800' }} rounded="full">
                Court {match.court}
              </Badge>
            )}
          </HStack>
        </VStack>
      </Box>

      <ScrollView
        flex={1}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack space={6} p={4}>
          {/* Live Score Card */}
          <Card>
            <VStack space={4}>
              <HStack justifyContent="space-between" alignItems="center">
                <Text fontSize="lg" fontWeight="bold" color="gray.800">
                  {match.status === 'in-progress' ? 'Live Score' : 'Final Score'}
                </Text>
                {match.status === 'in-progress' && (
                  <HStack space={2} alignItems="center">
                    <Text fontSize="sm" color="green.600">Live</Text>
                    <Box w={2} h={2} bg="green.500" rounded="full" />
                  </HStack>
                )}
              </HStack>

              {/* Players and Score */}
              <VStack space={4}>
                {/* Player 1 */}
                <HStack justifyContent="space-between" alignItems="center">
                  <HStack space={3} alignItems="center" flex={1}>
                    <Pressable
                      onPress={() => player1 && navigation.navigate('PlayerProfile', { playerId: player1.id })}
                    >
                      <VStack>
                        <Text fontSize="md" fontWeight="bold" color="gray.800">
                          {player1?.name || 'Player 1'}
                        </Text>
                        {match.winnerId === match.player1Id && (
                          <Badge colorScheme="green" size="sm">
                            Winner
                          </Badge>
                        )}
                      </VStack>
                    </Pressable>
                  </HStack>
                  
                  <HStack space={2}>
                    {match.score?.player1Sets.map((setScore, index) => (
                      <Box
                        key={index}
                        bg={setScore > (match.score?.player2Sets[index] || 0) ? 'green.100' : 'gray.100'}
                        px={3}
                        py={1}
                        rounded="md"
                        minW={8}
                      >
                        <Text
                          fontSize="sm"
                          fontWeight="bold"
                          textAlign="center"
                          color={setScore > (match.score?.player2Sets[index] || 0) ? 'green.700' : 'gray.700'}
                        >
                          {setScore}
                        </Text>
                      </Box>
                    )) || (
                      <Text fontSize="lg" fontWeight="bold" color="gray.400">
                        0
                      </Text>
                    )}
                  </HStack>
                </HStack>

                <Divider />

                {/* Player 2 */}
                <HStack justifyContent="space-between" alignItems="center">
                  <HStack space={3} alignItems="center" flex={1}>
                    <Pressable
                      onPress={() => player2 && navigation.navigate('PlayerProfile', { playerId: player2.id })}
                    >
                      <VStack>
                        <Text fontSize="md" fontWeight="bold" color="gray.800">
                          {player2?.name || 'Player 2'}
                        </Text>
                        {match.winnerId === match.player2Id && (
                          <Badge colorScheme="green" size="sm">
                            Winner
                          </Badge>
                        )}
                      </VStack>
                    </Pressable>
                  </HStack>
                  
                  <HStack space={2}>
                    {match.score?.player2Sets.map((setScore, index) => (
                      <Box
                        key={index}
                        bg={setScore > (match.score?.player1Sets[index] || 0) ? 'green.100' : 'gray.100'}
                        px={3}
                        py={1}
                        rounded="md"
                        minW={8}
                      >
                        <Text
                          fontSize="sm"
                          fontWeight="bold"
                          textAlign="center"
                          color={setScore > (match.score?.player1Sets[index] || 0) ? 'green.700' : 'gray.700'}
                        >
                          {setScore}
                        </Text>
                      </Box>
                    )) || (
                      <Text fontSize="lg" fontWeight="bold" color="gray.400">
                        0
                      </Text>
                    )}
                  </HStack>
                </HStack>
              </VStack>
            </VStack>
          </Card>

          {/* Match Controls */}
          <Card>
            <VStack space={4}>
              <Text fontSize="lg" fontWeight="bold" color="gray.800">
                Match Options
              </Text>
              
              <HStack justifyContent="space-between" alignItems="center">
                <VStack flex={1}>
                  <Text fontSize="md" fontWeight="medium" color="gray.800">
                    Follow Match
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Get notified of score updates
                  </Text>
                </VStack>
                <Switch
                  isChecked={following}
                  onToggle={handleFollowMatch}
                  colorScheme="primary"
                />
              </HStack>

              {match.status === 'in-progress' && (
                <HStack justifyContent="space-between" alignItems="center">
                  <VStack flex={1}>
                    <Text fontSize="md" fontWeight="medium" color="gray.800">
                      Auto Refresh
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Updates every 10 seconds
                    </Text>
                  </VStack>
                  <Switch
                    isChecked={autoRefresh}
                    onToggle={setAutoRefresh}
                    colorScheme="green"
                  />
                </HStack>
              )}

              <Divider />

              <HStack space={3}>
                <Button
                  flex={1}
                  variant="outline"
                  onPress={() => navigation.navigate('BracketView', { tournamentId })}
                  leftIcon={<Icon as={<MaterialIcons name="account-tree" />} size={5} />}
                >
                  View Bracket
                </Button>
                
                {tournament && (
                  <Button
                    flex={1}
                    variant="outline"
                    onPress={() => navigation.navigate('SpectatorView', { tournamentId })}
                    leftIcon={<Icon as={<MaterialIcons name="visibility" />} size={5} />}
                  >
                    Tournament View
                  </Button>
                )}
              </HStack>
            </VStack>
          </Card>

          {/* Match Timeline */}
          {timeline && timeline.events.length > 0 && (
            <Card>
              <VStack space={4}>
                <Text fontSize="lg" fontWeight="bold" color="gray.800">
                  Match Timeline
                </Text>
                
                <VStack space={3}>
                  {timeline.events.slice().reverse().map((event, index) => (
                    <HStack key={event.id} space={3} alignItems="center">
                      <Icon
                        as={<MaterialIcons name={getEventIcon(event.type)} />}
                        size={5}
                        color="primary.500"
                      />
                      <VStack flex={1}>
                        <Text fontSize="sm" fontWeight="medium" color="gray.800">
                          {event.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          {event.timestamp.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </VStack>
                      {event.details.score && (
                        <Text fontSize="sm" color="gray.600">
                          {formatScore(event.details.score)}
                        </Text>
                      )}
                    </HStack>
                  ))}
                </VStack>
                
                {timeline.events.length > 10 && (
                  <Button variant="ghost" size="sm">
                    View Full Timeline
                  </Button>
                )}
              </VStack>
            </Card>
          )}

          {/* Empty Timeline State */}
          {(!timeline || timeline.events.length === 0) && match.status !== 'pending' && (
            <Card>
              <Center py={8}>
                <VStack space={3} alignItems="center">
                  <Icon
                    as={<MaterialIcons name="timeline" />}
                    size={12}
                    color="gray.400"
                  />
                  <Text fontSize="md" color="gray.600">
                    Match timeline will appear here
                  </Text>
                </VStack>
              </Center>
            </Card>
          )}
        </VStack>
      </ScrollView>
    </Box>
  );
};

export default LiveMatchScreen;
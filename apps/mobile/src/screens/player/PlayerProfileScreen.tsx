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
  Badge,
  Progress,
  Divider,
  Center,
  Spinner,
  Switch,
  Alert,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { PlayerProfileScreenProps } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { 
  PlayerProfile,
  PlayerStatistics,
  PlayerTournamentHistory,
  PlayerFollow,
  TournamentService,
  PlayerService
} from '@protour/shared';
import { RefreshControl } from 'react-native';

const PlayerProfileScreen: React.FC<PlayerProfileScreenProps> = ({ 
  navigation,
  route 
}) => {
  const { playerId } = route.params;
  
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

  const { user } = useAuth();
  const toast = useToast();
  const playerService = new PlayerService();
  const tournamentService = new TournamentService();

  const isOwnProfile = user?.id === playerId;

  useEffect(() => {
    loadPlayerProfile();
  }, [playerId]);

  const loadPlayerProfile = async () => {
    try {
      // Load player profile
      const profileData = await playerService.getPlayerProfile(playerId);
      if (!profileData) {
        toast.show({
          title: 'Player Not Found',
          description: 'The requested player profile could not be found',
          status: 'error',
        });
        navigation.goBack();
        return;
      }

      // Check privacy settings and user permissions
      const canViewProfile = await checkProfileVisibility(profileData);
      if (!canViewProfile) {
        toast.show({
          title: 'Profile Private',
          description: 'This player has set their profile to private',
          status: 'warning',
        });
        navigation.goBack();
        return;
      }

      setProfile(profileData);
      setShowStats(canViewStatistics(profileData));
      setShowHistory(canViewTournamentHistory(profileData));

      // Check if current user is following this player
      if (user && !isOwnProfile) {
        const isFollowing = await playerService.isFollowingPlayer(user.id, playerId);
        setFollowing(isFollowing);
      }

      // Get followers count
      const followers = await playerService.getPlayerFollowers(playerId);
      setFollowersCount(followers.length);

    } catch (error: any) {
      console.error('Error loading player profile:', error);
      toast.show({
        title: 'Error Loading Profile',
        description: error.message || 'Failed to load player profile',
        status: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkProfileVisibility = async (playerProfile: PlayerProfile): Promise<boolean> => {
    if (isOwnProfile) return true;
    if (playerProfile.privacySettings.showProfile === 'everyone') return true;
    if (playerProfile.privacySettings.showProfile === 'private') return false;
    
    // For 'tournament-participants', check if they share any tournaments
    if (playerProfile.privacySettings.showProfile === 'tournament-participants') {
      return await playerService.sharesTournamentWithUser(playerId, user?.id || '');
    }

    return false;
  };

  const canViewStatistics = (playerProfile: PlayerProfile): boolean => {
    if (isOwnProfile) return true;
    return playerProfile.privacySettings.showStatistics !== 'private';
  };

  const canViewTournamentHistory = (playerProfile: PlayerProfile): boolean => {
    if (isOwnProfile) return true;
    return playerProfile.privacySettings.showTournamentHistory !== 'private';
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlayerProfile();
  };

  const handleFollowPlayer = async () => {
    if (!user || isOwnProfile) return;

    const newFollowing = !following;
    setFollowing(newFollowing);

    try {
      if (newFollowing) {
        await playerService.followPlayer(user.id, playerId);
        setFollowersCount(prev => prev + 1);
        toast.show({
          title: 'Following Player',
          description: `You are now following ${profile?.name}`,
          status: 'success',
        });
      } else {
        await playerService.unfollowPlayer(user.id, playerId);
        setFollowersCount(prev => Math.max(0, prev - 1));
        toast.show({
          title: 'Unfollowed Player',
          description: `You are no longer following ${profile?.name}`,
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

  const calculateWinPercentage = (stats: PlayerStatistics): number => {
    if (stats.matchesPlayed === 0) return 0;
    return Math.round((stats.matchesWon / stats.matchesPlayed) * 100);
  };

  const formatDate = (timestamp: any) => {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'badminton':
        return 'sports-tennis';
      case 'tennis':
        return 'sports-tennis';
      case 'squash':
        return 'sports';
      default:
        return 'emoji-events';
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
                Player Profile
              </Text>
            </HStack>
          </HStack>
        </Box>
        
        <Center flex={1}>
          <VStack space={3} alignItems="center">
            <Spinner size="lg" color="primary.600" />
            <Text color="gray.600">Loading player profile...</Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  if (!profile) {
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
                Profile Not Found
              </Text>
            </HStack>
          </HStack>
        </Box>
        
        <Center flex={1}>
          <VStack space={4} alignItems="center">
            <Icon
              as={<MaterialIcons name="person-off" />}
              size={16}
              color="gray.400"
            />
            <Text fontSize="lg" color="gray.600">
              Player profile not found
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
              Player Profile
            </Text>
          </HStack>
          
          {isOwnProfile && (
            <Pressable onPress={() => {
              toast.show({
                title: 'Coming Soon',
                description: 'Profile editing will be available soon',
              });
            }}>
              <Icon
                as={<MaterialIcons name="edit" />}
                size={6}
                color="white"
              />
            </Pressable>
          )}
        </HStack>
      </Box>

      <ScrollView
        flex={1}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack space={6} p={4}>
          {/* Profile Header */}
          <Card>
            <VStack space={4}>
              <HStack space={4} alignItems="center">
                <Avatar
                  size="xl"
                  bg="primary.600"
                  source={profile.profileImage ? { uri: profile.profileImage } : undefined}
                  _text={{
                    fontSize: 'xl',
                    fontWeight: 'bold',
                    color: 'white'
                  }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </Avatar>
                
                <VStack flex={1} space={2}>
                  <Text fontSize="2xl" fontWeight="bold" color="gray.800">
                    {profile.name}
                  </Text>
                  
                  <HStack space={4} alignItems="center">
                    <HStack space={1} alignItems="center">
                      <Icon
                        as={<MaterialIcons name="emoji-events" />}
                        size={4}
                        color="gray.500"
                      />
                      <Text fontSize="sm" color="gray.600">
                        {profile.statistics.tournamentsEntered} tournaments
                      </Text>
                    </HStack>
                    
                    <HStack space={1} alignItems="center">
                      <Icon
                        as={<MaterialIcons name="people" />}
                        size={4}
                        color="gray.500"
                      />
                      <Text fontSize="sm" color="gray.600">
                        {followersCount} followers
                      </Text>
                    </HStack>
                  </HStack>
                  
                  {profile.phone && (
                    <HStack space={1} alignItems="center">
                      <Icon
                        as={<MaterialIcons name="phone" />}
                        size={4}
                        color="gray.500"
                      />
                      <Text fontSize="sm" color="gray.600">
                        {profile.phone}
                      </Text>
                    </HStack>
                  )}
                </VStack>
              </HStack>

              {!isOwnProfile && profile.privacySettings.allowFollowing && (
                <Divider />
              )}

              {!isOwnProfile && profile.privacySettings.allowFollowing && (
                <Button
                  onPress={handleFollowPlayer}
                  colorScheme={following ? 'gray' : 'primary'}
                  variant={following ? 'outline' : 'solid'}
                  leftIcon={
                    <Icon
                      as={<MaterialIcons name={following ? 'person-remove' : 'person-add'} />}
                      size={5}
                    />
                  }
                >
                  {following ? 'Unfollow' : 'Follow'}
                </Button>
              )}
            </VStack>
          </Card>

          {/* Player Statistics */}
          {showStats && (
            <Card>
              <VStack space={4}>
                <Text fontSize="lg" fontWeight="bold" color="gray.800">
                  Performance Statistics
                </Text>
                
                <VStack space={4}>
                  {/* Win Rate */}
                  <VStack space={2}>
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontSize="sm" fontWeight="medium" color="gray.700">
                        Win Rate
                      </Text>
                      <Text fontSize="sm" fontWeight="bold" color="primary.600">
                        {calculateWinPercentage(profile.statistics)}%
                      </Text>
                    </HStack>
                    <Progress
                      value={calculateWinPercentage(profile.statistics)}
                      colorScheme="primary"
                      size="md"
                    />
                  </VStack>

                  {/* Stats Grid */}
                  <VStack space={3}>
                    <HStack space={3}>
                      <Box bg="blue.50" p={4} rounded="lg" flex={1}>
                        <VStack alignItems="center" space={1}>
                          <Text fontSize="2xl" fontWeight="bold" color="blue.600">
                            {profile.statistics.matchesPlayed}
                          </Text>
                          <Text fontSize="xs" color="blue.700" textAlign="center">
                            Matches Played
                          </Text>
                        </VStack>
                      </Box>
                      
                      <Box bg="green.50" p={4} rounded="lg" flex={1}>
                        <VStack alignItems="center" space={1}>
                          <Text fontSize="2xl" fontWeight="bold" color="green.600">
                            {profile.statistics.matchesWon}
                          </Text>
                          <Text fontSize="xs" color="green.700" textAlign="center">
                            Matches Won
                          </Text>
                        </VStack>
                      </Box>
                    </HStack>

                    <HStack space={3}>
                      <Box bg="orange.50" p={4} rounded="lg" flex={1}>
                        <VStack alignItems="center" space={1}>
                          <Text fontSize="2xl" fontWeight="bold" color="orange.600">
                            {profile.statistics.tournamentsWon}
                          </Text>
                          <Text fontSize="xs" color="orange.700" textAlign="center">
                            Tournaments Won
                          </Text>
                        </VStack>
                      </Box>
                      
                      <Box bg="purple.50" p={4} rounded="lg" flex={1}>
                        <VStack alignItems="center" space={1}>
                          <Text fontSize="2xl" fontWeight="bold" color="purple.600">
                            {profile.statistics.currentStreak}
                          </Text>
                          <Text fontSize="xs" color="purple.700" textAlign="center">
                            Current Streak
                          </Text>
                        </VStack>
                      </Box>
                    </HStack>
                  </VStack>
                </VStack>
              </VStack>
            </Card>
          )}

          {/* Tournament History */}
          {showHistory && profile.tournaments.length > 0 && (
            <Card>
              <VStack space={4}>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="lg" fontWeight="bold" color="gray.800">
                    Tournament History
                  </Text>
                  {profile.tournaments.length > 5 && (
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  )}
                </HStack>
                
                <VStack space={3}>
                  {profile.tournaments.slice(0, 5).map((tournament, index) => (
                    <HStack key={index} space={3} alignItems="center">
                      <Icon
                        as={<MaterialIcons name={getSportIcon(tournament.sport)} />}
                        size={6}
                        color="primary.500"
                      />
                      
                      <VStack flex={1} space={1}>
                        <Text fontSize="md" fontWeight="medium" color="gray.800">
                          {tournament.tournamentName}
                        </Text>
                        <HStack space={4} alignItems="center">
                          <Text fontSize="sm" color="gray.600">
                            {formatDate(tournament.date)}
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            {tournament.sport}
                          </Text>
                        </HStack>
                      </VStack>
                      
                      <VStack alignItems="flex-end" space={1}>
                        <Badge
                          colorScheme={tournament.finalPosition <= 3 ? 'green' : 'gray'}
                          rounded="full"
                        >
                          #{tournament.finalPosition}
                        </Badge>
                        <Text fontSize="xs" color="gray.500">
                          of {tournament.totalParticipants}
                        </Text>
                      </VStack>
                    </HStack>
                  ))}
                </VStack>
              </VStack>
            </Card>
          )}

          {/* Privacy Notice */}
          {!isOwnProfile && (
            <Alert status="info" variant="left-accent">
              <VStack space={2} flexShrink={1} w="100%">
                <HStack flexShrink={1} space={2} alignItems="center">
                  <Alert.Icon />
                  <Text fontSize="sm" color="coolGray.800">
                    Some information may be limited based on privacy settings
                  </Text>
                </HStack>
              </VStack>
            </Alert>
          )}
        </VStack>
      </ScrollView>
    </Box>
  );
};

export default PlayerProfileScreen;
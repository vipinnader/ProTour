import React, { useState } from 'react';
import {
  Box,
  ScrollView,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Icon,
  useToast,
  Card,
  FormControl,
  Select,
  CheckIcon,
  Divider,
  Pressable,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { JoinTournamentScreenProps } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import {
  Tournament,
  TournamentAccess,
  TournamentService,
} from '@protour/shared';

const JoinTournamentScreen: React.FC<JoinTournamentScreenProps> = ({
  navigation,
}) => {
  const [accessCode, setAccessCode] = useState('');
  const [role, setRole] = useState<'player' | 'spectator'>('player');
  const [loading, setLoading] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [searchMode, setSearchMode] = useState<'code' | 'search'>('code');

  const { user } = useAuth();
  const toast = useToast();
  const tournamentService = new TournamentService();

  const handleLookupTournament = async () => {
    if (!accessCode.trim()) {
      toast.show({
        title: 'Invalid Code',
        description: 'Please enter a tournament access code',
        status: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      const foundTournament = await tournamentService.getTournamentByCode(
        accessCode.trim().toUpperCase()
      );

      if (!foundTournament) {
        toast.show({
          title: 'Tournament Not Found',
          description: 'No tournament found with that access code',
          status: 'error',
        });
        return;
      }

      setTournament(foundTournament);
    } catch (error: any) {
      console.error('Error looking up tournament:', error);
      toast.show({
        title: 'Lookup Error',
        description: error.message || 'Failed to lookup tournament',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async () => {
    if (!tournament || !user) return;

    setLoading(true);
    try {
      const tournamentAccess: Omit<TournamentAccess, 'joinedAt'> = {
        tournamentId: tournament.id,
        accessCode: accessCode.trim().toUpperCase(),
        userId: user.id,
        role,
        active: true,
      };

      await tournamentService.joinTournament(tournamentAccess);

      toast.show({
        title: 'Successfully Joined!',
        description: `You've joined ${tournament.name} as a ${role}`,
        status: 'success',
      });

      // Navigate based on role
      if (role === 'player') {
        navigation.navigate('PlayerDashboard');
      } else {
        navigation.navigate('SpectatorView', { tournamentId: tournament.id });
      }
    } catch (error: any) {
      console.error('Error joining tournament:', error);
      toast.show({
        title: 'Join Failed',
        description: error.message || 'Failed to join tournament',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSportIcon = (sport: string) => {
    switch (sport) {
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
            <VStack>
              <Text color="white" fontSize="xl" fontWeight="bold">
                Join Tournament
              </Text>
              <Text color="primary.100" fontSize="sm">
                Enter tournament code to join
              </Text>
            </VStack>
          </HStack>
        </HStack>
      </Box>

      <ScrollView flex={1} p={4}>
        <VStack space={6}>
          {/* Access Method Selection */}
          <Card>
            <VStack space={4}>
              <Text fontSize="lg" fontWeight="bold" color="gray.800">
                How would you like to join?
              </Text>

              <HStack space={4} justifyContent="center">
                <Pressable flex={1} onPress={() => setSearchMode('code')}>
                  <Box
                    bg={searchMode === 'code' ? 'primary.50' : 'gray.50'}
                    borderWidth={2}
                    borderColor={
                      searchMode === 'code' ? 'primary.500' : 'gray.200'
                    }
                    p={4}
                    rounded="lg"
                    alignItems="center"
                  >
                    <Icon
                      as={<MaterialIcons name="qr-code-scanner" />}
                      size={8}
                      color={searchMode === 'code' ? 'primary.500' : 'gray.400'}
                      mb={2}
                    />
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      color={searchMode === 'code' ? 'primary.700' : 'gray.600'}
                      textAlign="center"
                    >
                      Access Code
                    </Text>
                    <Text
                      fontSize="xs"
                      color="gray.500"
                      textAlign="center"
                      mt={1}
                    >
                      Use organizer's code
                    </Text>
                  </Box>
                </Pressable>

                <Pressable flex={1} onPress={() => setSearchMode('search')}>
                  <Box
                    bg={searchMode === 'search' ? 'primary.50' : 'gray.50'}
                    borderWidth={2}
                    borderColor={
                      searchMode === 'search' ? 'primary.500' : 'gray.200'
                    }
                    p={4}
                    rounded="lg"
                    alignItems="center"
                  >
                    <Icon
                      as={<MaterialIcons name="search" />}
                      size={8}
                      color={
                        searchMode === 'search' ? 'primary.500' : 'gray.400'
                      }
                      mb={2}
                    />
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      color={
                        searchMode === 'search' ? 'primary.700' : 'gray.600'
                      }
                      textAlign="center"
                    >
                      Browse Public
                    </Text>
                    <Text
                      fontSize="xs"
                      color="gray.500"
                      textAlign="center"
                      mt={1}
                    >
                      Find public tournaments
                    </Text>
                  </Box>
                </Pressable>
              </HStack>
            </VStack>
          </Card>

          {searchMode === 'code' ? (
            <Card>
              <VStack space={4}>
                <Text fontSize="lg" fontWeight="bold" color="gray.800">
                  Tournament Access Code
                </Text>

                <FormControl>
                  <FormControl.Label>
                    <Text fontSize="sm" fontWeight="medium" color="gray.700">
                      Enter 6-digit code
                    </Text>
                  </FormControl.Label>
                  <Input
                    placeholder="ABC123"
                    value={accessCode}
                    onChangeText={text => setAccessCode(text.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={6}
                    fontSize="lg"
                    textAlign="center"
                    letterSpacing={2}
                  />
                  <FormControl.HelperText>
                    Get this code from the tournament organizer
                  </FormControl.HelperText>
                </FormControl>

                <Button
                  onPress={handleLookupTournament}
                  isLoading={loading}
                  isDisabled={accessCode.length !== 6}
                  leftIcon={
                    <Icon as={<MaterialIcons name="search" />} size={5} />
                  }
                >
                  Find Tournament
                </Button>
              </VStack>
            </Card>
          ) : (
            <Card>
              <VStack space={4}>
                <Text fontSize="lg" fontWeight="bold" color="gray.800">
                  Public Tournaments
                </Text>

                <Box bg="blue.50" p={4} rounded="lg">
                  <HStack space={2} alignItems="center">
                    <Icon
                      as={<MaterialIcons name="info" />}
                      size={5}
                      color="blue.500"
                    />
                    <Text fontSize="sm" color="blue.700" flex={1}>
                      Public tournament browsing will be available soon. For
                      now, use access codes from organizers.
                    </Text>
                  </HStack>
                </Box>

                <Button
                  variant="outline"
                  onPress={() => setSearchMode('code')}
                  leftIcon={
                    <Icon as={<MaterialIcons name="qr-code" />} size={5} />
                  }
                >
                  Use Access Code Instead
                </Button>
              </VStack>
            </Card>
          )}

          {tournament && (
            <Card>
              <VStack space={4}>
                <HStack justifyContent="space-between" alignItems="flex-start">
                  <VStack flex={1} space={2}>
                    <HStack space={2} alignItems="center">
                      <Icon
                        as={
                          <MaterialIcons
                            name={getSportIcon(tournament.sport)}
                          />
                        }
                        size={6}
                        color="primary.500"
                      />
                      <Text fontSize="xl" fontWeight="bold" color="gray.800">
                        {tournament.name}
                      </Text>
                    </HStack>

                    <VStack space={1}>
                      <HStack space={2} alignItems="center">
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
                        <HStack space={2} alignItems="center">
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

                      <HStack space={2} alignItems="center">
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

                      <HStack space={2} alignItems="center">
                        <Icon
                          as={<MaterialIcons name="category" />}
                          size={4}
                          color="gray.500"
                        />
                        <Text fontSize="sm" color="gray.600">
                          {tournament.format} • {tournament.matchFormat}
                        </Text>
                      </HStack>
                    </VStack>

                    {tournament.description && (
                      <>
                        <Divider my={2} />
                        <Text fontSize="sm" color="gray.700">
                          {tournament.description}
                        </Text>
                      </>
                    )}
                  </VStack>

                  <Box
                    bg={
                      tournament.status === 'active'
                        ? 'green.100'
                        : tournament.status === 'setup'
                          ? 'orange.100'
                          : 'blue.100'
                    }
                    px={3}
                    py={1}
                    rounded="full"
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color={
                        tournament.status === 'active'
                          ? 'green.700'
                          : tournament.status === 'setup'
                            ? 'orange.700'
                            : 'blue.700'
                      }
                      textTransform="capitalize"
                    >
                      {tournament.status}
                    </Text>
                  </Box>
                </HStack>

                <Divider />

                <VStack space={4}>
                  <Text fontSize="md" fontWeight="bold" color="gray.800">
                    Join as:
                  </Text>

                  <FormControl>
                    <Select
                      selectedValue={role}
                      onValueChange={value =>
                        setRole(value as 'player' | 'spectator')
                      }
                      _selectedItem={{
                        bg: 'primary.50',
                        endIcon: <CheckIcon size="5" />,
                      }}
                    >
                      <Select.Item label="Player" value="player" />
                      <Select.Item label="Spectator" value="spectator" />
                    </Select>
                    <FormControl.HelperText>
                      {role === 'player'
                        ? 'Join as a competitor in this tournament'
                        : 'Join to watch and follow matches'}
                    </FormControl.HelperText>
                  </FormControl>

                  <Button
                    onPress={handleJoinTournament}
                    isLoading={loading}
                    colorScheme="green"
                    size="lg"
                    leftIcon={
                      <Icon as={<MaterialIcons name="add-circle" />} size={5} />
                    }
                  >
                    Join Tournament as{' '}
                    {role === 'player' ? 'Player' : 'Spectator'}
                  </Button>
                </VStack>
              </VStack>
            </Card>
          )}
        </VStack>
      </ScrollView>
    </Box>
  );
};

export default JoinTournamentScreen;

// Create tournament screen for ProTour - Epic 1 Implementation

import React, { useState } from 'react';
import { Platform } from 'react-native';
import {
  Box,
  ScrollView,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Select,
  TextArea,
  Switch,
  Icon,
  useToast,
  KeyboardAvoidingView,
  FormControl,
  Card,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
// import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../contexts/AuthContext';
import {
  TournamentFormData,
  TournamentService,
  validateTournament,
  SPORTS,
  TOURNAMENT_FORMATS,
  MATCH_FORMATS,
} from '@protour/shared';
import firestore from '@react-native-firebase/firestore';

interface CreateTournamentScreenProps {
  navigation: any;
}

const CreateTournamentScreen: React.FC<CreateTournamentScreenProps> = ({
  navigation,
}) => {
  const [formData, setFormData] = useState<TournamentFormData>({
    name: '',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
    sport: 'badminton',
    format: 'single-elimination',
    matchFormat: 'best-of-3',
    location: '',
    description: '',
    isPublic: false,
    maxPlayers: 16,
  });

  const [loading, setLoading] = useState(false);
  const [_showDatePicker, _setShowDatePicker] = useState(false);

  const { user } = useAuth();
  const toast = useToast();
  const tournamentService = new TournamentService();

  const handleInputChange = (field: keyof TournamentFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || formData.date;
    _setShowDatePicker(Platform.OS === 'ios');

    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        date: currentDate,
      }));
    }
  };

  const validateForm = (): boolean => {
    try {
      const tournamentData = {
        ...formData,
        date: firestore.Timestamp.fromDate(formData.date),
      };
      validateTournament(tournamentData);

      // Additional Epic 1 specific validation
      if (formData.name.trim().length < 3) {
        toast.show({
          title: 'Tournament Name Required',
          description: 'Tournament name must be at least 3 characters long',
        });
        return false;
      }

      if (formData.maxPlayers < 4 || formData.maxPlayers > 64) {
        toast.show({
          title: 'Invalid Player Count',
          description: 'Tournament must have between 4 and 64 players',
        });
        return false;
      }

      return true;
    } catch (error: any) {
      toast.show({
        title: 'Validation Error',
        description: error.message,
      });
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user) {
      toast.show({
        title: 'Authentication Error',
        description: 'You must be logged in to create a tournament',
      });
      return;
    }

    setLoading(true);
    try {
      const tournament = await tournamentService.createTournament(
        formData,
        user.id
      );

      toast.show({
        title: 'Tournament Created!',
        description: `Tournament "${tournament.name}" has been created successfully`,
      });

      // Navigate to player import screen
      navigation.navigate('ImportPlayers', {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
      });
    } catch (error: any) {
      toast.show({
        title: 'Creation Failed',
        description: error.message || 'Failed to create tournament',
      });
    } finally {
      setLoading(false);
    }
  };

  const playerCountOptions = [4, 8, 16, 32, 64];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  return (
    <Box flex={1} bg="gray.50" safeAreaTop>
      {/* Header */}
      <HStack
        bg="primary.600"
        px={4}
        py={3}
        justifyContent="space-between"
        alignItems="center"
      >
        <HStack space={3} alignItems="center">
          <Button
            variant="unstyled"
            onPress={() => navigation.goBack()}
            _pressed={{ opacity: 0.5 }}
          >
            <Icon
              as={<MaterialIcons name="arrow-back" />}
              size={6}
              color="white"
            />
          </Button>
          <Text color="white" fontSize="xl" fontWeight="bold">
            Create Tournament
          </Text>
        </HStack>

        <Button
          variant="outline"
          size="sm"
          borderColor="white"
          _text={{ color: 'white', fontSize: 'xs' }}
          onPress={handleSubmit}
          isLoading={loading}
          isLoadingText="Creating..."
        >
          Create
        </Button>
      </HStack>

      <KeyboardAvoidingView
        flex={1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <VStack space={6} p={4}>
            {/* Basic Information */}
            <Card>
              <Box>
                <VStack space={4}>
                  <Text fontSize="lg" fontWeight="bold" color="gray.800">
                    Basic Information
                  </Text>

                  <FormControl isRequired>
                    <FormControl.Label>Tournament Name</FormControl.Label>
                    <Input
                      placeholder="Enter tournament name"
                      value={formData.name}
                      onChangeText={value => handleInputChange('name', value)}
                      InputLeftElement={
                        <Icon
                          as={<MaterialIcons name="emoji-events" />}
                          size={5}
                          ml="2"
                          color="muted.400"
                        />
                      }
                    />
                  </FormControl>

                  <FormControl>
                    <FormControl.Label>Description</FormControl.Label>
                    <TextArea
                      placeholder="Brief description of the tournament"
                      value={formData.description}
                      onChangeText={value =>
                        handleInputChange('description', value)
                      }
                      h={20}
                      maxLength={500}
                      autoCompleteType="off"
                    />
                  </FormControl>

                  <FormControl>
                    <FormControl.Label>Location</FormControl.Label>
                    <Input
                      placeholder="Tournament venue"
                      value={formData.location}
                      onChangeText={value =>
                        handleInputChange('location', value)
                      }
                      InputLeftElement={
                        <Icon
                          as={<MaterialIcons name="location-on" />}
                          size={5}
                          ml="2"
                          color="muted.400"
                        />
                      }
                    />
                  </FormControl>
                </VStack>
              </Box>
            </Card>

            {/* Tournament Configuration */}
            <Card>
              <Box>
                <VStack space={4}>
                  <Text fontSize="lg" fontWeight="bold" color="gray.800">
                    Tournament Configuration
                  </Text>

                  <FormControl isRequired>
                    <FormControl.Label>Sport</FormControl.Label>
                    <Select
                      selectedValue={formData.sport}
                      onValueChange={value => handleInputChange('sport', value)}
                      placeholder="Select sport"
                      accessibilityLabel="Select sport"
                    >
                      <Select.Item label="Badminton" value={SPORTS.BADMINTON} />
                      <Select.Item label="Tennis" value={SPORTS.TENNIS} />
                      <Select.Item label="Squash" value={SPORTS.SQUASH} />
                    </Select>
                  </FormControl>

                  <FormControl isRequired>
                    <FormControl.Label>Tournament Format</FormControl.Label>
                    <Select
                      selectedValue={formData.format}
                      onValueChange={value =>
                        handleInputChange('format', value)
                      }
                      placeholder="Select format"
                      accessibilityLabel="Select tournament format"
                    >
                      <Select.Item
                        label="Single Elimination"
                        value={TOURNAMENT_FORMATS.SINGLE_ELIMINATION}
                      />
                      <Select.Item
                        label="Double Elimination (Coming Soon)"
                        value={TOURNAMENT_FORMATS.DOUBLE_ELIMINATION}
                        isDisabled
                      />
                    </Select>
                  </FormControl>

                  <FormControl isRequired>
                    <FormControl.Label>Match Format</FormControl.Label>
                    <Select
                      selectedValue={formData.matchFormat}
                      onValueChange={value =>
                        handleInputChange('matchFormat', value)
                      }
                      placeholder="Select match format"
                      accessibilityLabel="Select match format"
                    >
                      <Select.Item
                        label="Best of 1"
                        value={MATCH_FORMATS.BEST_OF_1}
                      />
                      <Select.Item
                        label="Best of 3"
                        value={MATCH_FORMATS.BEST_OF_3}
                      />
                      <Select.Item
                        label="Best of 5"
                        value={MATCH_FORMATS.BEST_OF_5}
                      />
                    </Select>
                  </FormControl>

                  <FormControl isRequired>
                    <FormControl.Label>Maximum Players</FormControl.Label>
                    <Select
                      selectedValue={formData.maxPlayers.toString()}
                      onValueChange={value =>
                        handleInputChange('maxPlayers', parseInt(value))
                      }
                      placeholder="Select max players"
                      accessibilityLabel="Select maximum players"
                    >
                      {playerCountOptions.map(count => (
                        <Select.Item
                          key={count}
                          label={`${count} players`}
                          value={count.toString()}
                        />
                      ))}
                    </Select>
                  </FormControl>
                </VStack>
              </Box>
            </Card>

            {/* Schedule */}
            <Card>
              <Box>
                <VStack space={4}>
                  <Text fontSize="lg" fontWeight="bold" color="gray.800">
                    Schedule
                  </Text>

                  <FormControl isRequired>
                    <FormControl.Label>Tournament Date</FormControl.Label>
                    <Button
                      variant="outline"
                      onPress={() => _setShowDatePicker(true)}
                      justifyContent="flex-start"
                      leftIcon={
                        <Icon
                          as={<MaterialIcons name="calendar-today" />}
                          size={5}
                        />
                      }
                      _text={{ color: 'gray.700' }}
                    >
                      {formData.date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </Button>
                  </FormControl>

                  {/* {showDatePicker && (
                    <DateTimePicker
                      value={formData.date}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      onChange={handleDateChange}
                    />
                  )} */}
                </VStack>
              </Box>
            </Card>

            {/* Privacy Settings */}
            <Card>
              <Box>
                <VStack space={4}>
                  <Text fontSize="lg" fontWeight="bold" color="gray.800">
                    Privacy & Access
                  </Text>

                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack flex={1} pr={4}>
                      <Text fontSize="md" fontWeight="medium" color="gray.800">
                        Public Tournament
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        Allow anyone to discover and join this tournament
                      </Text>
                    </VStack>
                    <Switch
                      isChecked={formData.isPublic}
                      onToggle={value => handleInputChange('isPublic', value)}
                      colorScheme="primary"
                    />
                  </HStack>

                  {!formData.isPublic && (
                    <Box bg="blue.50" p={3} rounded="md">
                      <HStack space={2} alignItems="flex-start">
                        <Icon
                          as={<MaterialIcons name="info" />}
                          size={5}
                          color="blue.600"
                          mt={0.5}
                        />
                        <VStack flex={1}>
                          <Text
                            fontSize="sm"
                            fontWeight="medium"
                            color="blue.800"
                          >
                            Private Tournament
                          </Text>
                          <Text fontSize="sm" color="blue.700">
                            Players will need your tournament code to join
                          </Text>
                        </VStack>
                      </HStack>
                    </Box>
                  )}
                </VStack>
              </Box>
            </Card>
          </VStack>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Action Bar */}
      <Box bg="white" p={4} shadow={3}>
        <HStack space={3}>
          <Button
            flex={1}
            variant="outline"
            onPress={() => navigation.goBack()}
            _text={{ fontWeight: 'medium' }}
          >
            Cancel
          </Button>
          <Button
            flex={2}
            colorScheme="primary"
            onPress={handleSubmit}
            isLoading={loading}
            isLoadingText="Creating Tournament..."
            leftIcon={
              <Icon as={<MaterialIcons name="emoji-events" />} size={5} />
            }
          >
            Create Tournament
          </Button>
        </HStack>
      </Box>
    </Box>
  );
};

export default CreateTournamentScreen;

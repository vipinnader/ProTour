/**
 * Main app navigator for ProTour
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Box, Text, Center } from 'native-base';

// Placeholder screens
const HomeScreen = () => (
  <Center flex={1} bg="gray.50">
    <Box bg="white" p={8} rounded="lg" shadow={2}>
      <Text fontSize="2xl" fontWeight="bold" color="primary.600" textAlign="center">
        🏆 ProTour
      </Text>
      <Text fontSize="md" color="gray.600" textAlign="center" mt={2}>
        Tournament Management Platform
      </Text>
      <Text fontSize="sm" color="gray.500" textAlign="center" mt={4}>
        Mobile app is ready for development!
      </Text>
    </Box>
  </Center>
);

// Stack navigator
const Stack = createNativeStackNavigator();

const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2196f3', // Primary color
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          title: 'ProTour',
          headerTitle: '🏆 ProTour',
        }} 
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
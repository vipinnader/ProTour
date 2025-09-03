/**
 * Main app navigator for ProTour - Epic 1 Implementation
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Box, Center, Spinner } from 'native-base';
import { AuthStackParamList, MainStackParamList } from './types';

// Context
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';

// Main Screens
import DashboardScreen from '../screens/main/DashboardScreen';

// Tournament Screens
import CreateTournamentScreen from '../screens/tournaments/CreateTournamentScreen';
import ImportPlayersScreen from '../screens/tournaments/ImportPlayersScreen';
import BracketViewScreen from '../screens/tournaments/BracketViewScreen';
import BracketEditScreen from '../screens/tournaments/BracketEditScreen';
import MatchManagementScreen from '../screens/tournaments/MatchManagementScreen';
import MatchDetailScreen from '../screens/tournaments/MatchDetailScreen';
import LiveScoringScreen from '../screens/tournaments/LiveScoringScreen';
import TournamentProgressScreen from '../screens/tournaments/TournamentProgressScreen';
import RefereeToolsScreen from '../screens/tournaments/RefereeToolsScreen';

// Stack navigators
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

// Loading Screen
const LoadingScreen = () => (
  <Center flex={1} bg="gray.50">
    <Box alignItems="center">
      <Spinner size="lg" color="primary.600" />
    </Box>
  </Center>
);

// Auth Navigator
const AuthNavigator = () => (
  <AuthStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
    <AuthStack.Screen
      name="EmailVerification"
      component={EmailVerificationScreen}
    />
  </AuthStack.Navigator>
);

// Main App Navigator
const MainNavigator = () => (
  <MainStack.Navigator
    screenOptions={{
      headerShown: false, // We'll use custom headers in screens
    }}
  >
    <MainStack.Screen name="Dashboard" component={DashboardScreen} />
    <MainStack.Screen
      name="CreateTournament"
      component={CreateTournamentScreen}
    />
    <MainStack.Screen name="ImportPlayers" component={ImportPlayersScreen} />
    <MainStack.Screen name="BracketView" component={BracketViewScreen} />
    <MainStack.Screen name="BracketEdit" component={BracketEditScreen} />
    <MainStack.Screen
      name="MatchManagement"
      component={MatchManagementScreen}
    />
    <MainStack.Screen name="MatchDetail" component={MatchDetailScreen} />
    <MainStack.Screen name="LiveScoring" component={LiveScoringScreen} />
    <MainStack.Screen
      name="TournamentProgress"
      component={TournamentProgressScreen}
    />
    <MainStack.Screen name="RefereeTools" component={RefereeToolsScreen} />
    {/* More screens will be added in upcoming stories */}
  </MainStack.Navigator>
);

// Root Navigator with Auth Logic
const RootNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  // For Epic 1, we'll allow unverified users to continue
  // In production, you might want to enforce email verification
  return <MainNavigator />;
};

const AppNavigator: React.FC = () => {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
};

export default AppNavigator;

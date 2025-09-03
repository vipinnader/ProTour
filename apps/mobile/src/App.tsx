import React, { useEffect } from 'react';
import { StatusBar, Platform, Alert } from 'react-native';
import { NativeBaseProvider } from 'native-base';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Firebase configuration
import './config/firebase';

// Navigation
import AppNavigator from './navigation/AppNavigator';

// Context providers
import { AuthProvider } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';

// Theme
import { theme } from './theme';

// Utils
import { setupNotifications } from './utils/notifications';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize app services
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Setup push notifications
      await setupNotifications();

      // Additional initialization can be added here
      console.log('ProTour app initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);

      if (__DEV__) {
        Alert.alert(
          'Initialization Error',
          'There was an error initializing the app. Please check the console for details.'
        );
      }
    }
  };

  return (
    <SafeAreaProvider>
      <NativeBaseProvider theme={theme}>
        <AuthProvider>
          <SyncProvider>
            <StatusBar
              barStyle={
                Platform.OS === 'ios' ? 'dark-content' : 'light-content'
              }
              backgroundColor={theme.colors.primary[600]}
            />
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </SyncProvider>
        </AuthProvider>
      </NativeBaseProvider>
    </SafeAreaProvider>
  );
};

export default App;

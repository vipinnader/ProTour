/**
 * Push notifications configuration and utilities for ProTour
 */

import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: string;
  sound?: string;
  badge?: number;
}

export interface NotificationHandlers {
  onForegroundMessage?: (message: FirebaseMessagingTypes.RemoteMessage) => void;
  onBackgroundMessage?: (message: FirebaseMessagingTypes.RemoteMessage) => Promise<void>;
  onNotificationPress?: (message: FirebaseMessagingTypes.RemoteMessage) => void;
  onTokenRefresh?: (token: string) => void;
}

let notificationHandlers: NotificationHandlers = {};

/**
 * Setup push notifications for the app
 */
export const setupNotifications = async (): Promise<string | null> => {
  try {
    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      logger.warn('Notification permissions not granted');
      return null;
    }

    // Register background message handler (must be called outside of app lifecycle)
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      logger.info('Background message received:', remoteMessage);
      
      if (notificationHandlers.onBackgroundMessage) {
        await notificationHandlers.onBackgroundMessage(remoteMessage);
      }
    });

    // Get FCM token
    const fcmToken = await getFCMToken();
    if (fcmToken) {
      logger.info('FCM Token obtained successfully');
      
      // Store token locally
      await AsyncStorage.setItem('fcm_token', fcmToken);
      
      // Handle token refresh
      messaging().onTokenRefresh((token) => {
        logger.info('FCM Token refreshed:', token);
        AsyncStorage.setItem('fcm_token', token);
        
        if (notificationHandlers.onTokenRefresh) {
          notificationHandlers.onTokenRefresh(token);
        }
      });
    }

    // Handle foreground messages
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      logger.info('Foreground message received:', remoteMessage);
      
      if (notificationHandlers.onForegroundMessage) {
        notificationHandlers.onForegroundMessage(remoteMessage);
      } else {
        // Default behavior: show alert
        showForegroundNotification(remoteMessage);
      }
    });

    // Handle notification press (when app is opened from notification)
    const unsubscribeNotificationPress = messaging().onNotificationOpenedApp((remoteMessage) => {
      logger.info('Notification pressed (background):', remoteMessage);
      
      if (notificationHandlers.onNotificationPress) {
        notificationHandlers.onNotificationPress(remoteMessage);
      } else {
        handleNotificationPress(remoteMessage);
      }
    });

    // Handle notification press (when app was quit)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          logger.info('Notification pressed (quit):', remoteMessage);
          
          if (notificationHandlers.onNotificationPress) {
            notificationHandlers.onNotificationPress(remoteMessage);
          } else {
            handleNotificationPress(remoteMessage);
          }
        }
      });

    logger.info('Push notifications setup completed successfully');
    return fcmToken;
  } catch (error) {
    logger.error('Failed to setup push notifications:', error);
    return null;
  }
};

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      
      return (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      );
    } else {
      // Android - check if permissions are needed (Android 13+)
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'ProTour Notification Permission',
            message: 'ProTour needs notification permissions to keep you updated about your tournaments and matches.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      
      // For older Android versions, notifications are enabled by default
      return true;
    }
  } catch (error) {
    logger.error('Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Get FCM token
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const token = await messaging().getToken();
    return token;
  } catch (error) {
    logger.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Get stored FCM token
 */
export const getStoredFCMToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('fcm_token');
  } catch (error) {
    logger.error('Error getting stored FCM token:', error);
    return null;
  }
};

/**
 * Register notification handlers
 */
export const registerNotificationHandlers = (handlers: NotificationHandlers): void => {
  notificationHandlers = { ...notificationHandlers, ...handlers };
};

/**
 * Show foreground notification as alert
 */
const showForegroundNotification = (message: FirebaseMessagingTypes.RemoteMessage): void => {
  const { notification, data } = message;
  
  if (notification) {
    Alert.alert(
      notification.title || 'ProTour',
      notification.body || '',
      [
        { text: 'Dismiss', style: 'cancel' },
        { 
          text: 'View', 
          onPress: () => handleNotificationPress(message) 
        },
      ]
    );
  }
};

/**
 * Handle notification press
 */
const handleNotificationPress = (message: FirebaseMessagingTypes.RemoteMessage): void => {
  const { data } = message;
  
  if (data) {
    logger.info('Handling notification press with data:', data);
    
    // Handle different types of notifications based on data
    switch (data.type) {
      case 'tournament_update':
        // Navigate to tournament screen
        // navigation.navigate('Tournament', { tournamentId: data.tournamentId });
        break;
        
      case 'match_scheduled':
      case 'match_completed':
        // Navigate to match screen
        // navigation.navigate('Match', { matchId: data.matchId });
        break;
        
      case 'registration_confirmed':
        // Navigate to registrations screen
        // navigation.navigate('MyRegistrations');
        break;
        
      default:
        // Default action - go to home screen
        // navigation.navigate('Home');
        break;
    }
  }
};

/**
 * Create local notification
 */
export const createLocalNotification = (payload: NotificationPayload): void => {
  // This would typically use a local notification library
  // For now, we'll just show an alert in development
  if (__DEV__) {
    Alert.alert(payload.title, payload.body);
  }
  
  logger.info('Local notification created:', payload);
};

/**
 * Cancel all notifications
 */
export const cancelAllNotifications = (): void => {
  // This would typically cancel all scheduled local notifications
  logger.info('All notifications cancelled');
};

/**
 * Get notification settings
 */
export const getNotificationSettings = async (): Promise<FirebaseMessagingTypes.NotificationSettings> => {
  return messaging().getNotificationSettings();
};

/**
 * Check if notifications are enabled
 */
export const areNotificationsEnabled = async (): Promise<boolean> => {
  try {
    const settings = await getNotificationSettings();
    
    return (
      settings.authorizationStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    logger.error('Error checking notification settings:', error);
    return false;
  }
};

/**
 * Open notification settings
 */
export const openNotificationSettings = (): void => {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
};

/**
 * Subscribe to topic
 */
export const subscribeToTopic = async (topic: string): Promise<void> => {
  try {
    await messaging().subscribeToTopic(topic);
    logger.info(`Subscribed to topic: ${topic}`);
  } catch (error) {
    logger.error(`Failed to subscribe to topic ${topic}:`, error);
  }
};

/**
 * Unsubscribe from topic
 */
export const unsubscribeFromTopic = async (topic: string): Promise<void> => {
  try {
    await messaging().unsubscribeFromTopic(topic);
    logger.info(`Unsubscribed from topic: ${topic}`);
  } catch (error) {
    logger.error(`Failed to unsubscribe from topic ${topic}:`, error);
  }
};

export default {
  setup: setupNotifications,
  requestPermissions: requestNotificationPermissions,
  getFCMToken,
  getStoredFCMToken,
  registerHandlers: registerNotificationHandlers,
  createLocalNotification,
  cancelAllNotifications,
  areNotificationsEnabled,
  openNotificationSettings,
  subscribeToTopic,
  unsubscribeFromTopic,
};
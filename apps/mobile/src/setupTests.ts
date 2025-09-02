/**
 * Jest setup file - runs before all tests
 * This file sets up the testing environment and global mocks
 */

import 'react-native-gesture-handler/jestSetup';

// Mock react-native modules
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Firebase
jest.mock('@react-native-firebase/app', () => ({
  utils: () => ({
    FilePath: {
      PICTURES_DIRECTORY: '/tmp/pictures',
    },
  }),
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({
    currentUser: null,
    signInWithEmailAndPassword: jest.fn(() => Promise.resolve()),
    createUserWithEmailAndPassword: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => Promise.resolve()),
    onAuthStateChanged: jest.fn(),
    sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: () => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(() => Promise.resolve()),
        get: jest.fn(() => Promise.resolve({ exists: true, data: () => ({}) })),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve()),
        onSnapshot: jest.fn(),
      })),
      add: jest.fn(() => Promise.resolve({ id: 'test-id' })),
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ docs: [] })),
        onSnapshot: jest.fn(),
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ docs: [] })),
        onSnapshot: jest.fn(),
      })),
      limit: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ docs: [] })),
        onSnapshot: jest.fn(),
      })),
    })),
  }),
}));

jest.mock('@react-native-firebase/functions', () => ({
  __esModule: true,
  default: () => ({
    httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
  }),
}));

jest.mock('@react-native-firebase/storage', () => ({
  __esModule: true,
  default: () => ({
    ref: jest.fn(() => ({
      putFile: jest.fn(() => Promise.resolve()),
      getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/file.jpg')),
    })),
  }),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: () => ({
    getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
    requestPermission: jest.fn(() => Promise.resolve(1)),
    onMessage: jest.fn(),
    onNotificationOpenedApp: jest.fn(),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    setBackgroundMessageHandler: jest.fn(),
    onTokenRefresh: jest.fn(),
    subscribeToTopic: jest.fn(() => Promise.resolve()),
    unsubscribeFromTopic: jest.fn(() => Promise.resolve()),
    getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
  }),
  AuthorizationStatus: {
    AUTHORIZED: 1,
    DENIED: 0,
    NOT_DETERMINED: -1,
    PROVISIONAL: 2,
  },
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {},
  })),
  useFocusEffect: jest.fn(),
  NavigationContainer: ({ children }: any) => children,
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => children,
  }),
}));

// Mock React Native Vector Icons
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

// Mock NativeBase components
jest.mock('native-base', () => {
  const React = require('react');
  return {
    NativeBaseProvider: ({ children }: any) => children,
    extendTheme: jest.fn(),
    Box: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    Button: ({ children, onPress, ...props }: any) =>
      React.createElement('TouchableOpacity', { onPress, ...props }, children),
    Input: (props: any) => React.createElement('TextInput', props),
    VStack: ({ children, ...props }: any) => React.createElement('View', props, children),
    HStack: ({ children, ...props }: any) => React.createElement('View', props, children),
    Center: ({ children, ...props }: any) => React.createElement('View', props, children),
    Spinner: (props: any) => React.createElement('ActivityIndicator', props),
    Alert: ({ children, ...props }: any) => React.createElement('View', props, children),
    Toast: {
      show: jest.fn(),
      close: jest.fn(),
      closeAll: jest.fn(),
    },
    useToast: jest.fn(() => ({
      show: jest.fn(),
      close: jest.fn(),
      closeAll: jest.fn(),
    })),
    useColorMode: jest.fn(() => ({
      colorMode: 'light',
      toggleColorMode: jest.fn(),
    })),
    useTheme: jest.fn(() => ({
      colors: {
        primary: { 500: '#2196f3' },
        secondary: { 500: '#e91e63' },
      },
    })),
  };
});

// Mock React Native Safe Area Context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

// Mock Flipper
jest.mock('react-native-flipper', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  networker: jest.fn(() => ({
    logRequest: jest.fn(),
    logResponse: jest.fn(),
  })),
}));

// Global test utilities
global.__DEV__ = true;

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers
jest.useFakeTimers();

// Set up global fetch mock
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
) as jest.Mock;
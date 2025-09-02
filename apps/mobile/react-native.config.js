/**
 * React Native configuration for ProTour
 * This file configures various aspects of React Native for optimal development experience
 */

module.exports = {
  // Metro configuration
  resolver: {
    // Enable resolving React Native Web for potential web support
    alias: {
      'react-native$': 'react-native-web',
    },
  },

  // Asset configuration
  assets: [
    './src/assets/fonts/', // Custom fonts
    './src/assets/images/', // Images
  ],

  // Dependencies configuration
  dependencies: {
    // Disable auto-linking for specific packages if needed
    // 'react-native-vector-icons': {
    //   platforms: {
    //     android: {
    //       sourceDir: '../node_modules/react-native-vector-icons/android',
    //       packageImportPath: 'import io.github.oblador.vectoricons.VectorIconsPackage;',
    //       projectName: 'VectorIcons',
    //     },
    //   },
    // },
  },

  // Platform-specific configurations
  platforms: {
    ios: {
      // iOS specific configurations
      linkConfig: {},
    },
    android: {
      // Android specific configurations
      linkConfig: {},
    },
  },

  // Auto-linking configuration
  autolink: {
    // Platforms to auto-link for
    platforms: ['ios', 'android'],
    
    // Dependencies to exclude from auto-linking
    exclude: [],
  },

  // Commands configuration for React Native CLI
  commands: [
    // Custom commands can be added here
  ],
};
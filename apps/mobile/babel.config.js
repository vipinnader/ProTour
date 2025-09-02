module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // React Native Reanimated plugin (must be last)
    'react-native-reanimated/plugin',
    
    // Module resolver for path mapping
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@protour/shared': '../../packages/shared/src',
        },
        extensions: [
          '.ios.js',
          '.android.js',
          '.native.js',
          '.js',
          '.ios.jsx',
          '.android.jsx',
          '.native.jsx',
          '.jsx',
          '.ios.ts',
          '.android.ts',
          '.native.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.native.tsx',
          '.tsx',
          '.json',
        ],
      },
    ],
    
    // React Native Vector Icons
    [
      'react-native-vector-icons/lib/build/babel',
      {
        platforms: {
          ios: {
            iconSet: 'Ionicons',
            iconSetPath: 'react-native-vector-icons/Fonts/Ionicons.ttf',
          },
          android: {
            iconSet: 'Ionicons',
            iconSetPath: 'react-native-vector-icons/Fonts/Ionicons.ttf',
          },
        },
      },
    ],
  ],
  env: {
    production: {
      plugins: [
        // Remove console statements in production
        'transform-remove-console',
        
        // Optimize React Native components
        'react-native-paper/babel',
      ],
    },
  },
};
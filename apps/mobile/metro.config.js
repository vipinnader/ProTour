const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = {
  // Watch for changes in the monorepo
  watchFolders: [monorepoRoot],

  resolver: {
    // Support for monorepo structure
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],

    // Resolve shared packages
    alias: {
      '@protour/shared': path.resolve(monorepoRoot, 'packages/shared/src'),
    },

    // Platform-specific extensions
    platforms: ['ios', 'android', 'native', 'web'],

    // Asset extensions
    assetExts: [
      'bmp',
      'gif',
      'jpg',
      'jpeg',
      'png',
      'psd',
      'svg',
      'webp',
      'ttf',
      'otf',
      'woff',
      'woff2',
      'eot',
      'mp4',
      'webm',
      'wav',
      'mp3',
      'm4a',
      'aac',
      'oga',
    ],

    // Source extensions
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'cjs'],
  },

  // Transformer configuration
  transformer: {
    // Use default transformer from React Native
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },

  // Maximum number of workers
  maxWorkers: require('os').cpus().length,
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);

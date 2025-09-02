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
    // Enable Hermes for better performance
    hermesCommand: 'hermes',
    
    // Babel transformer path
    babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
    
    // Asset transformer
    assetPlugins: ['expo-asset/tools/hashAssetFiles'],
  },
  
  // Server configuration
  server: {
    // Enhanced logging for development
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        if (__DEV__) {
          console.log(`[Metro] ${req.method} ${req.url}`);
        }
        return middleware(req, res, next);
      };
    },
  },
  
  // Cache configuration for faster builds
  cacheStores: [
    {
      name: 'metro-cache',
      get: async (key) => {
        // Custom cache implementation if needed
        return undefined;
      },
      set: async (key, value) => {
        // Custom cache implementation if needed
      },
    },
  ],
  
  // Reset cache configuration
  resetCache: false,
  
  // Maximum number of workers
  maxWorkers: require('os').cpus().length,
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
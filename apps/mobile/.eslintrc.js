module.exports = {
  root: true,
  extends: ['@react-native', 'prettier'],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    'prettier/prettier': 'warn',
    'react-native/no-inline-styles': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off',
  },
  env: {
    'react-native/react-native': true,
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    'e2e/',
    '*.config.js',
    'metro.config.js',
    'babel.config.js',
  ],
};

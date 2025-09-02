module.exports = {
  extends: [
    '../../.eslintrc.js',
    '@react-native',
  ],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    'react-native/no-inline-styles': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  env: {
    'react-native/react-native': true,
  },
};
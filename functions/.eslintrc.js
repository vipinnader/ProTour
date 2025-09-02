module.exports = {
  extends: [
    '../.eslintrc.js',
  ],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    'no-console': 'off', // Allow console.log in Cloud Functions for logging
  },
  env: {
    node: true,
  },
};
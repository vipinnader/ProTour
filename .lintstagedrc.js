module.exports = {
  '*.{js,jsx,ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    'git add',
  ],
  '*.{json,md,yml,yaml}': [
    'prettier --write',
    'git add',
  ],
  'apps/mobile/**/*.{ts,tsx}': [
    'cd apps/mobile && npm run type-check',
    'cd apps/mobile && npm run test:unit -- --bail --findRelatedTests',
  ],
  'functions/**/*.ts': [
    'cd functions && npm run type-check',
    'cd functions && npm run test -- --bail --findRelatedTests',
  ],
  'packages/shared/**/*.ts': [
    'cd packages/shared && npm run type-check',
    'cd packages/shared && npm run test -- --bail --findRelatedTests',
  ],
};
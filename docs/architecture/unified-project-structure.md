# Unified Project Structure

Monorepo structure accommodating React Native mobile apps, web admin interface, and Firebase Functions backend with shared tournament business logic using Nx for optimal development workflow.

```plaintext
protour/
├── .github/                          # CI/CD workflows and templates
│   └── workflows/
│       ├── ci.yml                    # PR validation, testing, linting
│       ├── deploy-staging.yml        # Staging environment deployment  
│       ├── deploy-production.yml     # Production deployment with approvals
│       └── security-scan.yml         # Dependency and security scanning
├── apps/                             # Application packages
│   ├── mobile/                       # React Native tournament management app
│   │   ├── src/
│   │   │   ├── components/           # Reusable UI components
│   │   │   │   ├── tournament/       # Tournament-specific components
│   │   │   │   │   ├── BracketView.tsx
│   │   │   │   │   ├── MatchCard.tsx
│   │   │   │   │   ├── PlayerList.tsx
│   │   │   │   │   └── ScoreEntry.tsx
│   │   │   │   ├── forms/            # Form components
│   │   │   │   └── ui/               # Base UI components (Button, Card, etc.)
│   │   │   ├── screens/              # Screen-level components
│   │   │   │   ├── auth/             # Authentication screens
│   │   │   │   ├── organizer/        # Organizer workflow screens
│   │   │   │   │   ├── TournamentDashboard.tsx
│   │   │   │   │   ├── PlayerImport.tsx
│   │   │   │   │   └── LiveTournament.tsx
│   │   │   │   ├── player/           # Player experience screens
│   │   │   │   │   ├── PlayerSchedule.tsx
│   │   │   │   │   └── TournamentBrowser.tsx
│   │   │   │   └── spectator/        # Spectator viewing screens
│   │   │   │       └── LiveBracket.tsx
│   │   │   ├── navigation/           # Navigation configuration
│   │   │   │   ├── AppNavigator.tsx
│   │   │   │   ├── AuthNavigator.tsx
│   │   │   │   └── RoleBasedNavigator.tsx
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   │   ├── useOfflineSync.ts
│   │   │   │   ├── useRealTimeSubscription.ts
│   │   │   │   └── useTournament.ts
│   │   │   ├── services/             # API client services
│   │   │   │   ├── ApiClient.ts      # HTTP client with offline support
│   │   │   │   ├── FirebaseService.ts # Firestore direct access
│   │   │   │   ├── TournamentService.ts
│   │   │   │   └── NotificationService.ts
│   │   │   ├── stores/               # Zustand state management
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── tournamentStore.ts
│   │   │   │   └── offlineSyncStore.ts
│   │   │   ├── styles/               # Global styles and themes
│   │   │   │   ├── colors.ts
│   │   │   │   ├── typography.ts
│   │   │   │   └── spacing.ts
│   │   │   └── utils/                # Utility functions
│   │   │       ├── validation.ts
│   │   │       ├── dateHelpers.ts
│   │   │       └── bracketAlgorithms.ts
│   │   ├── assets/                   # Images, fonts, static files
│   │   ├── __tests__/                # Mobile app tests
│   │   │   ├── components/
│   │   │   ├── screens/
│   │   │   └── services/
│   │   ├── android/                  # Android-specific code
│   │   ├── ios/                      # iOS-specific code
│   │   ├── package.json
│   │   ├── metro.config.js           # React Native bundler config
│   │   └── babel.config.js
│   ├── web-admin/                    # Next.js admin dashboard (future)
│   │   ├── src/
│   │   │   ├── pages/                # Next.js pages
│   │   │   ├── components/           # Web-specific components
│   │   │   └── styles/               # Web styles
│   │   ├── public/                   # Static web assets
│   │   ├── __tests__/
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── tailwind.config.js
│   └── functions/                    # Firebase Functions backend
│       ├── src/
│       │   ├── api/                  # HTTP endpoints
│       │   │   ├── tournaments/      # Tournament management endpoints
│       │   │   │   ├── create.ts
│       │   │   │   ├── generateBracket.ts
│       │   │   │   └── importPlayers.ts
│       │   │   ├── matches/          # Match scoring endpoints
│       │   │   │   ├── updateScore.ts
│       │   │   │   └── progressBracket.ts
│       │   │   └── delegation/       # Multi-device access endpoints
│       │   │       ├── createToken.ts
│       │   │       └── validateAccess.ts
│       │   ├── triggers/             # Firestore/Auth triggers
│       │   │   ├── onMatchUpdate.ts  # Automatic bracket progression
│       │   │   ├── onTournamentComplete.ts # Completion notifications
│       │   │   └── onPlayerImport.ts # Post-import processing
│       │   ├── scheduled/            # Cron jobs and scheduled functions
│       │   │   ├── tournamentReminders.ts
│       │   │   └── dataCleanup.ts
│       │   ├── middleware/           # Express middleware
│       │   │   ├── auth.ts           # Firebase Auth validation
│       │   │   ├── validation.ts     # Request validation
│       │   │   ├── rateLimit.ts      # Rate limiting
│       │   │   └── cors.ts           # CORS configuration
│       │   └── utils/                # Backend utilities
│       │       ├── constants.ts
│       │       └── errorHandling.ts
│       ├── __tests__/                # Backend tests
│       │   ├── api/
│       │   ├── triggers/
│       │   └── utils/
│       ├── package.json
│       ├── firebase.json             # Firebase configuration
│       └── firestore.rules           # Database security rules
├── libs/                             # Shared packages and libraries
│   ├── shared-types/                 # TypeScript interfaces and types
│   │   ├── src/
│   │   │   ├── tournament.ts         # Tournament data models
│   │   │   ├── match.ts              # Match data models  
│   │   │   ├── player.ts             # Player data models
│   │   │   ├── user.ts               # User and auth models
│   │   │   ├── api.ts                # API request/response types
│   │   │   └── index.ts              # Barrel exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── tournament-engine/            # Core tournament business logic
│   │   ├── src/
│   │   │   ├── BracketGenerator.ts   # Bracket creation algorithms
│   │   │   ├── MatchProgression.ts   # Tournament advancement logic
│   │   │   ├── TournamentValidator.ts # Data validation
│   │   │   ├── ScoringEngine.ts      # Match scoring logic
│   │   │   └── index.ts
│   │   ├── __tests__/                # Tournament engine tests
│   │   │   ├── BracketGenerator.test.ts
│   │   │   └── MatchProgression.test.ts
│   │   ├── package.json
│   │   └── jest.config.js
│   ├── offline-sync/                 # Offline-first synchronization logic
│   │   ├── src/
│   │   │   ├── SyncManager.ts        # Sync coordination
│   │   │   ├── ConflictResolver.ts   # Data conflict resolution
│   │   │   ├── QueueProcessor.ts     # Operation queue management
│   │   │   └── StorageAdapter.ts     # Local storage abstraction
│   │   ├── __tests__/
│   │   └── package.json
│   ├── ui-components/                # Shared UI component library
│   │   ├── src/
│   │   │   ├── components/           # Cross-platform components
│   │   │   ├── tokens/               # Design system tokens
│   │   │   └── themes/               # Theme configuration
│   │   ├── __tests__/
│   │   └── package.json
│   └── config/                       # Shared configuration packages
│       ├── eslint/                   # ESLint configurations
│       │   ├── base.js               # Base ESLint config
│       │   ├── react-native.js       # React Native specific rules
│       │   └── node.js               # Node.js/Firebase Functions rules
│       ├── typescript/               # TypeScript configurations
│       │   ├── base.json             # Base TypeScript config
│       │   ├── react-native.json     # React Native tsconfig
│       │   └── node.json             # Node.js tsconfig
│       └── jest/                     # Jest testing configurations
│           ├── base.js               # Base Jest config
│           └── react-native.js       # React Native Jest setup
├── tools/                            # Development and build tools
│   ├── scripts/                      # Build and deployment scripts
│   │   ├── deploy.sh                 # Deployment automation
│   │   ├── test-coverage.sh          # Coverage reporting
│   │   └── database-backup.sh        # Data backup scripts
│   └── generators/                   # Nx generators for scaffolding
│       ├── component/
│       └── api-endpoint/
├── docs/                             # Project documentation
│   ├── architecture/                 # Architecture documentation
│   │   ├── fullstack-architecture.md # This document
│   │   ├── coding-standards.md       # Development standards
│   │   ├── tech-stack.md             # Technology decisions
│   │   └── source-tree.md            # Project structure guide
│   ├── deployment/                   # Deployment guides
│   │   ├── staging.md
│   │   └── production.md
│   ├── api/                          # API documentation
│   │   ├── tournaments.md
│   │   ├── matches.md
│   │   └── authentication.md
│   └── prd/                          # Product requirements
│       ├── prd.md                    # Main PRD document
│       └── epics/                    # Epic breakdowns
├── .env.example                      # Environment variable template
├── .env.local.example                # Local development environment
├── package.json                      # Root package.json with workspace configuration
├── nx.json                           # Nx workspace configuration
├── workspace.json                    # Nx project configuration
├── tsconfig.base.json                # Base TypeScript configuration
├── .gitignore                        # Git ignore rules
├── .eslintrc.json                    # Root ESLint configuration
├── jest.config.js                    # Root Jest configuration
└── README.md                         # Project setup and development guide
```

# Development Workflow

Development setup and workflow optimized for the ProTour monorepo structure with React Native cross-platform development and Firebase Functions backend integration.

## Local Development Setup

### Prerequisites
```bash
# Install Node.js (18+ required for Firebase Functions v2)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install React Native development tools
npm install -g @react-native-community/cli
npm install -g react-native-debugger

# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Install Nx CLI globally
npm install -g nx@latest

# Install platform-specific tools
# iOS (macOS only)
sudo gem install cocoapods
xcode-select --install

# Android
# Download and install Android Studio
# Set ANDROID_HOME environment variable
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Initial Setup
```bash
# Clone repository
git clone https://github.com/your-org/protour.git
cd protour

# Install all dependencies (root + all apps/libs)
npm install

# Copy environment configuration
cp .env.example .env.local
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/functions/.env.example apps/functions/.env

# Setup Firebase configuration
firebase init
firebase use --add # Select staging project
firebase use staging

# Initialize React Native dependencies
cd apps/mobile
npx pod-install ios  # iOS only
cd ../..

# Build shared libraries
nx build shared-types
nx build tournament-engine
nx build offline-sync

# Start Firebase emulator suite
firebase emulators:start --only firestore,functions,auth

# Verify setup
nx test shared-types
nx lint mobile
```

### Development Commands
```bash
# Start all development services
npm run dev
# This runs:
# - Firebase emulators (Firestore, Functions, Auth)
# - React Native Metro bundler  
# - Next.js web admin (if applicable)
# - TypeScript compilation in watch mode for shared libs

# Start mobile app only
nx start mobile
# Opens Metro bundler for React Native development

# Start backend functions only  
nx serve functions
# Runs Firebase Functions emulator with hot reload

# Build and test commands
nx build mobile                    # Build React Native for release
nx test tournament-engine --watch  # Run tests in watch mode
nx lint --all                      # Lint entire codebase
nx format --all                    # Format code with prettier

# Database operations
npm run db:seed                    # Seed local database with test data
npm run db:reset                   # Reset local Firestore database
npm run db:export                  # Export local data for backup
npm run db:import                  # Import data from backup

# Deployment commands
npm run deploy:staging             # Deploy to staging environment
npm run deploy:production          # Deploy to production (with approval gates)
npm run deploy:functions           # Deploy only Firebase Functions
npm run deploy:mobile              # Build and upload mobile app binaries
```

## Environment Configuration

### Required Environment Variables

#### Frontend (.env.local in apps/mobile/)
```bash
# Firebase configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef

# Environment specific settings
NODE_ENV=development
API_BASE_URL=http://localhost:5001/your_project/us-central1/api

# Development flags
ENABLE_FLIPPER=true
ENABLE_MOCK_DATA=true
SKIP_AUTH_FOR_TESTING=false

# Performance monitoring
ENABLE_PERFORMANCE_MONITORING=false
LOG_LEVEL=debug
```

#### Backend (.env in apps/functions/)
```bash
# Firebase configuration
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_REGION=asia-south1

# External service configuration
MSG91_API_KEY=your_msg91_api_key
MSG91_SENDER_ID=your_sender_id
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Security configuration
JWT_SECRET=your_jwt_secret_for_delegation_tokens
CORS_ORIGINS=http://localhost:3000,http://localhost:8081

# Performance and monitoring
LOG_LEVEL=info
ENABLE_FUNCTION_WARMING=true
SENTRY_DSN=your_sentry_dsn

# Database configuration  
FIRESTORE_EMULATOR_HOST=localhost:8080  # For local development only
```

#### Shared Environment Variables
```bash
# Timezone configuration
DEFAULT_TIMEZONE=Asia/Kolkata

# Feature flags
ENABLE_TOURNAMENT_ANALYTICS=false
ENABLE_ADVANCED_BRACKET_FEATURES=true
ENABLE_SMS_NOTIFICATIONS=true

# Rate limiting
API_RATE_LIMIT_REQUESTS_PER_MINUTE=100
SMS_RATE_LIMIT_PER_HOUR=50

# File upload limits
MAX_CSV_FILE_SIZE_MB=2
MAX_PLAYER_IMPORT_COUNT=64

# Cache configuration  
CACHE_TTL_SECONDS=300
ENABLE_OFFLINE_CACHE=true
```

## Development Workflow Best Practices

### Feature Development Process
1. **Create Feature Branch:** `git checkout -b feature/epic-2a-match-scoring`
2. **Update Shared Types:** Modify `libs/shared-types/src/` if needed
3. **Implement Business Logic:** Add logic to `libs/tournament-engine/src/`
4. **Create Backend API:** Add functions to `apps/functions/src/api/`
5. **Build Frontend UI:** Implement screens in `apps/mobile/src/screens/`
6. **Add Tests:** Write tests at each layer with >80% coverage requirement
7. **Update Documentation:** Update relevant docs in `docs/` directory
8. **Create PR:** Use PR template with architecture review checklist

### Testing Strategy Integration
```bash
# Run full test suite
nx run-many --target=test --all

# Test specific areas
nx test tournament-engine     # Unit tests for business logic
nx test mobile               # Mobile app component tests  
nx test functions            # Backend API integration tests
nx e2e mobile-e2e            # End-to-end tournament scenarios

# Test coverage requirements
nx test tournament-engine --coverage  # Requires >90% for shared logic
nx test mobile --coverage             # Requires >80% for UI components
nx test functions --coverage          # Requires >85% for API endpoints

# Integration testing with Firebase emulators
npm run test:integration     # Runs full stack tests against emulators
```

### Code Quality Gates
```bash
# Pre-commit hooks (automatic)
nx lint --fix                          # Auto-fix linting issues
nx format                              # Prettier code formatting  
nx test --passWithNoTests              # Run affected tests
nx build --parallel                    # Verify build success

# Pre-push validation
nx run-many --target=lint --all        # Full codebase linting
nx run-many --target=test --all        # Complete test suite
nx run-many --target=build --all       # Build all applications

# Architecture validation
npm run validate:dependencies          # Check for circular dependencies
npm run validate:types                 # TypeScript strict checking
npm run validate:security             # Security vulnerability scan
```

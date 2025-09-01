# 🏆 ProTour - Mobile Tournament Manager

A mobile-first tournament management platform designed specifically for the Indian racket sports market. ProTour enables organizers to run professional tournaments from their mobile devices while providing real-time updates to players and spectators.

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites Checklist
- [ ] Node.js 18+ installed ([download here](https://nodejs.org/))
- [ ] Git installed and configured
- [ ] React Native development environment ([setup guide](https://reactnative.dev/docs/environment-setup))
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)

### Lightning Setup
```bash
# 1. Clone and setup
git clone https://github.com/your-org/protour.git
cd protour
npm install

# 2. Start development environment
npm run dev:setup    # Sets up Firebase emulators + mobile app
npm run ios          # iOS simulator (macOS only)
npm run android      # Android emulator
```

**Expected result:** ProTour app running on your simulator with mock tournament data loaded.

**Stuck?** Check the [Detailed Setup Guide](#detailed-development-setup) below.

---

## 📱 What is ProTour?

### The Problem We're Solving
Tournament organizers in India currently rely on outdated Windows desktop software, spreadsheets, and manual communication. This creates:
- **Organizer Bottlenecks:** Single-person tethered to a desk
- **Poor Player Experience:** Constant interruptions asking "When is my match?"  
- **Spectator Frustration:** Stale information and no live updates
- **Club Reputation Damage:** Chaotic, unprofessional tournaments

### Our Solution
**Mobile-first tournament management** that unifies organizers, players, and spectators:

| User Type | Key Features |
|-----------|-------------|
| **Organizers** | Mobile dashboard, CSV player import, delegated score entry, real-time bracket updates |
| **Players** | Personal match schedule, bracket viewing, live score updates, match notifications |
| **Spectators** | Live tournament following, player profiles, match tracking, bracket visualization |

### Market Focus
- **Primary Market:** Indian local racket sports clubs (badminton, tennis, squash)
- **MVP Goal:** 50% reduction in organizer administrative time
- **Success Metric:** 4.5+ star rating on Indian App Store/Google Play

---

## 🏗️ Architecture Overview

```
┌─── 📱 Mobile Apps (React Native) ───┐    ┌─── ☁️  Backend Services ───┐
│                                     │    │                           │
│  ┌─ Organizer Dashboard ─┐          │    │  ┌─ Firebase Functions ─┐  │
│  ├─ Player Schedule View ─┤   ←──────┼────→  ├─ Tournament API ────┤  │
│  ├─ Spectator Live View ──┤          │    │  ├─ Real-time Sync ────┤  │
│  └─ Bracket Visualization ┘          │    │  └─ CSV Import Logic ──┘  │
│                                     │    │                           │
└─────────────────────────────────────┘    │  ┌─ Firestore Database ─┐  │
                                           │  ├─ Tournament Data ────┤  │
┌─── 🔌 External Services ────────────┐    │  ├─ Match Results ──────┤  │
│                                     │    │  └─ Player Profiles ────┘  │
│  ┌─ SMS Notifications (Twilio) ─┐   │    │                           │
│  ├─ Push Notifications (FCM) ──┤   │    │  ┌─ External APIs ───────┐  │
│  ├─ App Store Distribution ────┤   │    │  ├─ SMS Gateway (India) ─┤  │
│  └─ Analytics (Firebase) ──────┘   │    │  └─ Future: Razorpay ────┘  │
│                                     │    │                           │
└─────────────────────────────────────┘    └───────────────────────────┘
```

**Key Technical Decisions:**
- **Offline-First:** Tournaments continue without internet
- **Real-Time Sync:** Bracket updates across all devices within 3 seconds  
- **Multi-Device:** Organizer tablet + referee mobile phones
- **Indian Optimized:** 2G network support, SMS fallbacks, local data centers

---

## 🛠️ Detailed Development Setup

### 1. Environment Setup (15 minutes)

**Node.js and Package Managers:**
```bash
# Verify Node.js version (must be 18+)
node --version  # Should be v18.x.x or higher

# Install global dependencies
npm install -g firebase-tools
npm install -g @react-native-community/cli
npm install -g detox-cli  # For E2E testing
```

**React Native Development Environment:**

<details>
<summary>🍎 macOS Setup (iOS + Android)</summary>

```bash
# Install Xcode (via App Store) - Required for iOS
# Install Android Studio - https://developer.android.com/studio

# iOS Dependencies
brew install cocoapods
brew install ios-deploy

# Android Dependencies (add to ~/.bashrc or ~/.zshrc)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Verify setup
npx react-native doctor
```
</details>

<details>
<summary>🪟 Windows Setup (Android Only)</summary>

```bash
# Install Android Studio
# Install JDK 11 or newer

# Set environment variables
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
setx PATH "%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools"

# Verify setup
npx react-native doctor
```
</details>

<details>
<summary>🐧 Linux Setup (Android Only)</summary>

```bash
# Install Android Studio
# Install JDK 11+
sudo apt update
sudo apt install openjdk-11-jdk

# Set environment variables
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Install required libraries
sudo apt install libc6:i386 libncurses5:i386 libstdc++6:i386 lib32z1 libbz2-1.0:i386
```
</details>

### 2. Project Setup (5 minutes)

```bash
# Clone repository
git clone https://github.com/your-org/protour.git
cd protour

# Install dependencies
npm install

# Install iOS dependencies (macOS only)
cd ios && pod install && cd ..

# Setup environment variables
cp .env.example .env.development
# Edit .env.development with your Firebase config (see External Services Guide)
```

### 3. Firebase Setup (10 minutes)

```bash
# Login to Firebase
firebase login

# Select your Firebase project
firebase use your-project-id

# Start Firebase emulators (required for development)
npm run emulators:start
# This should open Firebase Emulator UI at http://localhost:4000
```

**Verify Firebase Setup:**
- Visit http://localhost:4000 
- You should see Firestore, Authentication, and Functions emulators running
- Test data should be loaded automatically

### 4. Start Development (2 minutes)

```bash
# Terminal 1: Start Metro bundler
npm start

# Terminal 2: Start iOS (macOS only)
npm run ios

# Terminal 3: Start Android
npm run android
```

**Expected Result:**
- Mobile app opens on simulator/emulator
- You can create a test tournament and import players
- Firebase emulators show data being created

### 5. Verify Everything Works

**Quick Verification Checklist:**
- [ ] App loads without errors on iOS/Android
- [ ] Can create a test tournament
- [ ] Firebase emulator shows tournament data
- [ ] Tests pass: `npm test`
- [ ] Can import CSV with sample data
- [ ] Bracket generation works for 8 players

---

## 🧪 Testing Setup

### Running Tests
```bash
# Unit tests (fast)
npm run test:unit

# Integration tests (requires Firebase emulators)
npm run test:integration

# E2E tests (slow, requires simulators)
npm run test:e2e:ios     # macOS only
npm run test:e2e:android

# All tests with coverage
npm run test:all
```

### Test Structure
```
tests/
├── unit/              # Component and function tests
│   ├── components/    # React Native component tests
│   ├── services/      # Business logic tests
│   └── utils/         # Utility function tests
├── integration/       # Database and API tests
│   ├── tournament/    # Tournament workflow tests
│   └── auth/          # Authentication tests
└── e2e/              # End-to-end user scenarios
    ├── organizer/     # Organizer workflow tests
    └── player/        # Player experience tests
```

### Writing Tests
```typescript
// Example: Unit test for bracket generation
describe('BracketGenerator', () => {
  it('should generate correct single-elimination bracket for 8 players', () => {
    const players = createMockPlayers(8);
    const bracket = generateSingleElimination(players);
    
    expect(bracket.rounds).toBe(3);
    expect(bracket.matches).toHaveLength(7);
    expect(bracket.matches[0].player1).toBeDefined();
    expect(bracket.matches[0].player2).toBeDefined();
  });
});
```

---

## 📁 Project Structure

```
protour/
├── 📱 apps/
│   └── mobile/                 # React Native mobile app
│       ├── src/
│       │   ├── components/     # Reusable UI components
│       │   ├── screens/        # Screen-level components
│       │   ├── services/       # API and business logic
│       │   ├── stores/         # State management (Zustand)
│       │   ├── navigation/     # React Navigation setup
│       │   └── utils/          # Helper functions
│       ├── ios/               # iOS-specific files
│       └── android/           # Android-specific files
│
├── ⚡ functions/               # Firebase Cloud Functions
│   ├── src/
│   │   ├── tournament/        # Tournament management APIs
│   │   ├── notifications/     # Push notification logic
│   │   └── csv/              # CSV import processing
│
├── 📦 packages/
│   └── shared/                # Shared TypeScript types and utilities
│       ├── types/             # Tournament, Player, Match interfaces
│       └── utils/             # Cross-platform utilities
│
├── 📚 docs/                   # Documentation
│   ├── architecture/          # Technical architecture docs
│   ├── stories/              # Epic and story definitions
│   └── api/                  # API documentation
│
├── 🧪 tests/                  # Test utilities and global config
│   ├── fixtures/             # Test data and mocks
│   └── utils/                # Test helper functions
│
└── 🛠️ tools/                  # Development tools and scripts
    ├── scripts/              # Build and deployment scripts
    └── generators/           # Code generators
```

---

## 🔄 Development Workflow

### Daily Development
```bash
# 1. Start your day
git pull origin main
npm run dev:start  # Starts all services (Firebase emulators + Metro)

# 2. Create feature branch
git checkout -b feature/player-schedule-view

# 3. Develop with hot reload
# Make changes, app reloads automatically

# 4. Test your changes
npm run test:unit
npm run test:integration

# 5. Commit following conventions
git add .
git commit -m "feat: add player schedule view with live updates"
git push origin feature/player-schedule-view

# 6. Create PR via GitHub
```

### Commit Message Convention
```
feat: new feature
fix: bug fix
docs: documentation update
test: adding or updating tests
refactor: code refactoring
style: formatting changes
ci: CI/CD changes
```

### Code Quality Standards
- **TypeScript:** Strict mode enabled, no `any` types
- **Linting:** ESLint with React Native and TypeScript rules
- **Formatting:** Prettier with consistent configuration
- **Testing:** Minimum 85% code coverage
- **Performance:** Bundle size monitored, 60fps maintained

### Git Hooks (Automatic)
```bash
# Pre-commit (automatic)
- Runs ESLint and Prettier
- Runs unit tests for changed files
- Validates TypeScript compilation

# Pre-push (automatic) 
- Runs full test suite
- Checks for TODOs in committed code
- Validates commit message format
```

---

## 🚀 Deployment Guide

### Staging Deployment (Automatic)
```bash
# Push to main branch triggers staging deployment
git push origin main

# This automatically:
# 1. Runs full test suite
# 2. Builds mobile apps
# 3. Deploys Firebase functions
# 4. Distributes to TestFlight/Play Console Internal Testing
```

### Production Deployment (Manual)
```bash
# Create release tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# This triggers:
# 1. Production Firebase deployment
# 2. App Store/Play Store submission
# 3. Production monitoring setup
```

---

## 📊 Monitoring & Debugging

### Development Debugging
```bash
# React Native debugging
npm run debug        # Opens Chrome DevTools
npm run flipper      # Opens Flipper debugger

# Firebase debugging
npm run firebase:debug  # Firebase emulator logs
npm run firestore:log   # Firestore operation logs
```

### Production Monitoring
- **Crashlytics:** Automatic crash reporting
- **Analytics:** User behavior tracking
- **Performance:** App startup and render times
- **Alerts:** Critical error notifications

### Log Analysis
```typescript
// Use structured logging for better debugging
import { Logger } from '@/utils/Logger';

Logger.info('Tournament created', {
  tournamentId: tournament.id,
  playerCount: players.length,
  userId: user.id
});

Logger.error('CSV import failed', {
  error: error.message,
  fileName: csvFile.name,
  rowCount: csvData.length
});
```

---

## 🤝 Contributing Guidelines

### Before Contributing
1. **Read the [PRD](docs/prd.md)** to understand business requirements
2. **Review [Architecture Docs](docs/architecture/)** for technical context
3. **Check [Open Issues](https://github.com/your-org/protour/issues)** for current priorities
4. **Join Discord/Slack** for team communication

### Epic and Story Development
1. **Epic Planning:** Follow [Epic 0](docs/stories/epic-0-foundation-setup.md) → [Epic 1](docs/stories/epic-1-foundation-tournament-setup.md) sequence
2. **Story Implementation:** Each story has clear acceptance criteria and definition of done
3. **Testing Requirements:** Every story includes unit, integration, and E2E tests
4. **Documentation:** Update relevant docs with your changes

### Code Review Process
- **All code must be reviewed** by at least one team member
- **Focus areas:** Business logic correctness, tournament scenarios, mobile performance
- **Testing:** Reviewer must verify tests pass and cover new functionality
- **UI/UX:** Mobile-first design principles and accessibility

---

## 🔧 Troubleshooting

<details>
<summary>🚨 Common Setup Issues</summary>

**Metro bundler not starting:**
```bash
npx react-native start --reset-cache
```

**iOS build fails:**
```bash
cd ios && pod install && cd ..
npx react-native run-ios --simulator="iPhone 14"
```

**Android emulator not found:**
```bash
# List available AVDs
emulator -list-avds

# Start specific AVD
emulator -avd Pixel_4_API_30
```

**Firebase emulator connection issues:**
```bash
# Check if ports are available
lsof -ti:8080,9099,5001,5000,4000

# Restart emulators with different ports
firebase emulators:start --only firestore --port 8081
```
</details>

<details>
<summary>⚡ Performance Issues</summary>

**App running slowly in development:**
```bash
# Enable Hermes for better performance
# Already enabled in React Native 0.70+
# Check metro.config.js for Hermes configuration
```

**Bundle size too large:**
```bash
# Analyze bundle size
npm run analyze-bundle

# Check for large dependencies
npm run bundle-size-check
```
</details>

<details>
<summary>🐛 Common Runtime Errors</summary>

**"Network request failed" during development:**
- Check if Firebase emulators are running
- Verify .env.development has correct Firebase config
- Clear Metro cache: `npm start -- --reset-cache`

**"Unable to resolve module" errors:**
```bash
# Clear all caches
npm start -- --reset-cache
cd ios && pod install && cd ..
npm run clean-cache
```

**TypeScript errors after pulling latest:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```
</details>

---

## 📞 Support & Community

### Getting Help
- **🐛 Bugs:** [Create GitHub Issue](https://github.com/your-org/protour/issues/new?template=bug_report.md)
- **💡 Feature Requests:** [Create GitHub Issue](https://github.com/your-org/protour/issues/new?template=feature_request.md) 
- **❓ Questions:** [GitHub Discussions](https://github.com/your-org/protour/discussions)
- **💬 Chat:** [Discord Server](https://discord.gg/protour) or Slack

### Documentation
- **📋 Project Brief:** [docs/projectBrief.md](docs/projectBrief.md)
- **📝 PRD:** [docs/prd.md](docs/prd.md) 
- **🏗️ Architecture:** [docs/architecture/](docs/architecture/)
- **📖 API Docs:** [docs/api/](docs/api/)
- **🧪 Testing:** [docs/architecture/testing-strategy.md](docs/architecture/testing-strategy.md)

### Development Resources
- **🔗 External Services:** [docs/external-service-integration-guide.md](docs/external-service-integration-guide.md)
- **📱 React Native:** [React Native Docs](https://reactnative.dev/docs/getting-started)
- **🔥 Firebase:** [Firebase Docs](https://firebase.google.com/docs)
- **🏆 Tournament Rules:** [Indian Tournament Standards](docs/tournament-rules-india.md)

---

## 📈 Project Status

**Current Phase:** Epic 0 (Foundation Setup)  
**Next Milestone:** Epic 1 (Tournament Creation) - Target: 2 weeks  
**MVP Target:** 3 months  
**Pilot Tournaments:** 3-5 Indian clubs in Month 4  

**Epic Progress:**
- [x] Epic 0: Foundation Setup (Complete)
- [ ] Epic 1: Tournament Creation (In Progress)
- [ ] Epic 2A: Core Tournament Management (Planned)
- [ ] Epic 2B: Multi-Device Sync (Planned)
- [ ] Epic 3: Multi-Role Experience (Planned)
- [ ] Epic 4: Indian Market Optimization (Planned)

---

**🎯 Ready to contribute? Start with [Epic 0 Story 0.1](docs/stories/epic-0-foundation-setup.md#story-01-development-environment--repository-setup) and help us revolutionize tournament management in India!** 

---

*Last Updated: September 2024*  
*ProTour Team - Building the future of tournament management* 🏆
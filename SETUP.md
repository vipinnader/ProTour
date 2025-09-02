# ProTour Development Setup

This guide will help you set up the ProTour development environment on macOS, Windows, or Linux.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ProTour
   ```

2. **Run the setup script**
   ```bash
   npm run setup
   ```

3. **Configure environment variables**
   - Copy `.env.example` files in `apps/mobile/` and `functions/`
   - Fill in your Firebase configuration values

4. **Start development**
   ```bash
   npm run dev
   ```

## Prerequisites

### All Platforms
- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Git**: Latest version

### macOS (for iOS development)
- **Xcode**: Latest version from App Store
- **Xcode Command Line Tools**: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods`

### Windows/Linux (for Android development)
- **Android Studio**: Latest version
- **Android SDK**: Set `ANDROID_HOME` environment variable
- **Java Development Kit**: JDK 11 or higher

## Manual Setup (Alternative)

If the automatic setup script doesn't work, follow these manual steps:

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up Git Hooks
```bash
npx husky install
```

### 3. Install iOS Dependencies (macOS only)
```bash
cd apps/mobile/ios
pod install
cd ../../..
```

### 4. Create Environment Files
Copy and configure environment files:
```bash
cp apps/mobile/.env.example apps/mobile/.env
cp functions/.env.example functions/.env
```

### 5. Build Shared Packages
```bash
cd packages/shared
npm run build
cd ../..
```

## Development Commands

### Start All Services
```bash
npm run dev                 # Mobile + Functions
```

### Individual Services
```bash
npm run dev:mobile          # React Native Metro bundler
npm run dev:functions       # Firebase Functions emulator
npm run firebase:emulator   # All Firebase emulators
```

### Testing
```bash
npm test                    # Run all tests
npm run test:mobile         # Mobile app tests
npm run test:functions      # Firebase Functions tests
npm run test:shared         # Shared package tests
```

### Code Quality
```bash
npm run lint                # Run ESLint on all packages
npm run format              # Format code with Prettier
npm run type-check          # TypeScript type checking
```

## Project Structure

```
ProTour/
├── apps/
│   ├── mobile/             # React Native mobile app
│   └── web/               # Web dashboard (future)
├── packages/
│   └── shared/            # Shared types and utilities
├── functions/             # Firebase Cloud Functions
├── docs/                  # Documentation
├── scripts/               # Development scripts
└── ProTour.code-workspace # VS Code workspace
```

## IDE Setup

### VS Code (Recommended)
1. Open `ProTour.code-workspace` in VS Code
2. Install recommended extensions when prompted
3. Use built-in tasks and debug configurations

### Other IDEs
- Ensure TypeScript and ESLint support is enabled
- Configure path mapping for `@protour/shared` imports

## Troubleshooting

### Common Issues

**Metro bundler port conflict**
```bash
npx react-native start --reset-cache --port 8082
```

**iOS build fails**
```bash
cd apps/mobile/ios
pod install --repo-update
```

**TypeScript path resolution issues**
```bash
npm run build:shared
```

**Git hooks not working**
```bash
npx husky install
chmod +x .husky/pre-commit
```

### Getting Help

1. Check the [docs/](docs/) folder for detailed documentation
2. Review error logs in VS Code Problems panel
3. Ensure all prerequisites are installed correctly
4. Try cleaning and reinstalling dependencies:
   ```bash
   npm run clean
   npm install
   ```

## Platform-Specific Notes

### macOS
- Simulator and device testing available for both iOS and Android
- Xcode required for iOS development
- Use Homebrew for easy tool installation

### Windows
- Android development fully supported
- iOS development requires additional tooling (not recommended)
- Use chocolatey or winget for tool installation

### Linux
- Android development fully supported
- iOS development not possible
- Use your distribution's package manager for tools

## Next Steps

After successful setup:
1. Read the [Project Documentation](docs/)
2. Review [Coding Standards](docs/architecture/coding-standards.md)
3. Check the [Tech Stack](docs/architecture/tech-stack.md)
4. Start with [Epic 1 Stories](docs/stories/)
# Mobile Development Setup Guide

This guide walks you through setting up the React Native mobile development environment for ProTour.

## Overview

ProTour's mobile app is built with:
- **React Native 0.73+** - Cross-platform mobile framework
- **TypeScript** - Type safety and better development experience  
- **NativeBase** - Mobile-first UI component library
- **Firebase SDK** - Backend integration
- **Metro** - JavaScript bundler with optimizations
- **Flipper** - Advanced debugging and profiling

## Quick Setup

### 1. Automatic Setup (Recommended)
```bash
npm run mobile:setup
```

This script will:
- Check all prerequisites
- Install mobile app dependencies
- Set up iOS dependencies (macOS only)
- Create Android debug keystore
- Set up environment files
- Validate the setup

### 2. Manual Setup (Advanced)

If you prefer manual setup or the script fails, follow these steps:

#### Install Dependencies
```bash
cd apps/mobile
npm install
```

#### iOS Setup (macOS only)
```bash
cd ios
pod install
cd ..
```

#### Android Debug Keystore
```bash
keytool -genkey -v -keystore android/app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000
```

## Prerequisites

### All Platforms
- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Java Development Kit**: JDK 11 or higher
- **Git**: Latest version

### macOS (for iOS development)
- **Xcode**: Latest version from App Store
- **Xcode Command Line Tools**: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods`
- **iOS Simulator**: Included with Xcode

### Windows/Linux/macOS (for Android development)
- **Android Studio**: Latest version
- **Android SDK**: Installed via Android Studio
- **Android SDK Build-Tools**: Version 34.0.0
- **Android SDK Platform**: API 34
- **Android Virtual Device (AVD)**: Create at least one emulator

### Environment Variables

Set these environment variables:

**macOS/Linux (add to ~/.bash_profile or ~/.zshrc)**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Windows (System Environment Variables)**
```
ANDROID_HOME = C:\Users\USERNAME\AppData\Local\Android\Sdk
PATH += %ANDROID_HOME%\emulator
PATH += %ANDROID_HOME%\tools
PATH += %ANDROID_HOME%\tools\bin
PATH += %ANDROID_HOME%\platform-tools
```

## Project Configuration

### App Bundle Identifiers

The app is configured with different bundle IDs for each environment:

- **Development**: `com.protour.app.dev`
- **Staging**: `com.protour.app.staging`  
- **Production**: `com.protour.app`

### Build Variants

#### iOS (Xcode Schemes)
- `ProTour` - Production build
- `ProTour-Staging` - Staging build
- `ProTour-Debug` - Development build

#### Android (Build Types & Flavors)
- `devDebug` - Development debug build
- `productionDebug` - Production debug build
- `productionStaging` - Staging build
- `productionRelease` - Production release build

### Environment Configuration

Copy and configure environment files:
```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Update `.env` with your Firebase configuration:
```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase config
```

## Development Workflow

### 1. Start Metro Bundler
```bash
npm run mobile:start
# or
cd apps/mobile && npm run start
```

### 2. Run on iOS Simulator (macOS only)
```bash
npm run mobile:ios
# or
cd apps/mobile && npm run ios
```

### 3. Run on Android Emulator
```bash
npm run mobile:android
# or  
cd apps/mobile && npm run android
```

### 4. Development Commands

```bash
# Start Metro bundler
npm run start

# Run on specific iOS simulator
npm run ios -- --simulator="iPhone 15 Pro"

# Run on specific Android device
npm run android -- --deviceId=emulator-5554

# Clean build cache
npm run clean

# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm run test
```

## Debugging

### 1. React DevTools

Install React DevTools for component inspection:
```bash
npm install -g react-devtools
react-devtools
```

### 2. Flipper Debugging

Flipper provides advanced debugging capabilities:

1. **Download Flipper**: https://fbflipper.com/
2. **Connect device**: USB debugging enabled
3. **Install plugins**: React Native, Hermes Debugger, Network

Available Flipper plugins in ProTour:
- **React DevTools** - Component tree inspection
- **Network Inspector** - API request/response logging
- **Hermes Debugger** - JavaScript debugging with breakpoints
- **Crashlytics** - Crash reporting and analysis

### 3. Chrome DevTools

Enable remote debugging:
1. In the app, press `Cmd+D` (iOS) or `Cmd+M` (Android)
2. Select "Debug JS Remotely"
3. Chrome DevTools will open automatically

### 4. VS Code Debugging

The project includes VS Code debug configurations:
- **Debug React Native - iOS**
- **Debug React Native - Android**
- **Debug Jest Tests - Mobile**

## Performance Optimization

### 1. Metro Bundler Optimization

The project includes optimized Metro configuration:
- **Hermes engine** enabled for better performance
- **RAM bundles** for faster app startup
- **Inline requires** for reduced bundle size
- **Tree shaking** to remove unused code

### 2. Build Optimization

#### iOS Release Build
```bash
cd apps/mobile
npm run build:ios
```

#### Android Release Build
```bash
cd apps/mobile
npm run build:android
```

### 3. Bundle Analysis

Analyze bundle size and dependencies:
```bash
npx react-native bundle-analyzer
```

## Testing

### 1. Unit Tests
```bash
cd apps/mobile
npm run test
```

### 2. Test Coverage
```bash
npm run test:coverage
```

### 3. End-to-End Testing

ProTour uses Detox for E2E testing:
```bash
# Build app for testing
npm run build:e2e

# Run E2E tests  
npm run test:e2e
```

## Troubleshooting

### Common Issues

**Metro bundler won't start**
```bash
cd apps/mobile
npm run clean
npm start -- --reset-cache
```

**iOS build fails**
```bash
cd ios
pod deintegrate && pod install
cd ..
npm run ios
```

**Android build fails**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

**Module resolution errors**
```bash
# Clear all caches
npm run clean
npm start -- --reset-cache
```

**CocoaPods issues (iOS)**
```bash
cd ios
pod install --repo-update
cd ..
```

**Gradle issues (Android)**
```bash
cd android
./gradlew clean
./gradlew --stop
cd ..
```

### Debug Commands

```bash
# Check React Native environment
npx react-native doctor

# List iOS simulators
xcrun simctl list devices

# List Android devices/emulators
adb devices

# View Metro logs
npm start -- --verbose

# View device logs
# iOS
xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "ProTour"'

# Android  
adb logcat -s ReactNative:V ReactNativeJS:V
```

### Device-Specific Issues

**Android Emulator Performance**
- Enable hardware acceleration (HAXM/WHPX)
- Allocate sufficient RAM (4GB+)
- Use x86_64 system images

**iOS Simulator Performance**
- Use Release scheme for performance testing
- Enable Metal Performance HUD for GPU debugging
- Monitor memory usage with Instruments

## Release Preparation

### 1. iOS App Store

1. **Update version numbers** in `ios/ProTour/Info.plist`
2. **Archive build** in Xcode
3. **Upload to App Store Connect**
4. **Submit for review**

### 2. Google Play Store

1. **Generate signed APK/AAB**:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```

2. **Upload to Google Play Console**
3. **Submit for review**

### 3. Release Checklist

- [ ] Version numbers updated
- [ ] Release notes prepared  
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Privacy policy updated
- [ ] App store screenshots updated

## Best Practices

### Development
- Use TypeScript for all new code
- Follow the established folder structure
- Write unit tests for business logic
- Use React Hooks and functional components
- Implement proper error boundaries

### Performance  
- Use React.memo for expensive components
- Implement lazy loading where appropriate
- Optimize images and assets
- Monitor bundle size regularly
- Use Flipper for performance profiling

### Security
- Never commit sensitive configuration
- Use Keychain/Keystore for secure storage
- Validate all user inputs
- Implement proper authentication flows
- Use HTTPS for all network requests

## Support

For React Native specific issues:
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Native Community](https://github.com/react-native-community)
- [Flipper Documentation](https://fbflipper.com/docs)

For ProTour specific issues:
- Check project documentation in `docs/`
- Review mobile setup in `MOBILE-SETUP.md`
- Test with emulators before deploying to devices
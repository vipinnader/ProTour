#!/usr/bin/env node

/**
 * Mobile development environment setup script for ProTour
 * This script helps set up React Native development environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    log(`Running: ${command}`, colors.cyan);
    const output = execSync(command, {
      stdio: 'inherit',
      encoding: 'utf8',
      ...options,
    });
    return output;
  } catch (error) {
    log(`Error running: ${command}`, colors.red);
    throw error;
  }
}

async function checkPrerequisites() {
  log('\n🔍 Checking mobile development prerequisites...', colors.blue);

  const platform = os.platform();
  let allGood = true;

  // Check Node.js
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    log(`✅ Node.js: ${nodeVersion}`, colors.green);
  } catch (error) {
    log('❌ Node.js: Not found', colors.red);
    allGood = false;
  }

  // Check npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    log(`✅ npm: ${npmVersion}`, colors.green);
  } catch (error) {
    log('❌ npm: Not found', colors.red);
    allGood = false;
  }

  // Check React Native CLI
  try {
    execSync('npx react-native --version', { encoding: 'utf8' });
    log('✅ React Native CLI: Available', colors.green);
  } catch (error) {
    log(
      '⚠️  React Native CLI: Not installed globally (will use npx)',
      colors.yellow
    );
  }

  // Platform-specific checks
  if (platform === 'darwin') {
    log('\n📱 macOS detected - checking iOS development tools...', colors.blue);

    // Check Xcode
    try {
      const xcodePath = execSync('xcode-select -p', {
        encoding: 'utf8',
      }).trim();
      log(`✅ Xcode Command Line Tools: ${xcodePath}`, colors.green);
    } catch (error) {
      log('❌ Xcode Command Line Tools: Not installed', colors.red);
      log('   Run: xcode-select --install', colors.yellow);
      allGood = false;
    }

    // Check CocoaPods
    try {
      const podVersion = execSync('pod --version', { encoding: 'utf8' }).trim();
      log(`✅ CocoaPods: ${podVersion}`, colors.green);
    } catch (error) {
      log('❌ CocoaPods: Not installed', colors.red);
      log('   Run: sudo gem install cocoapods', colors.yellow);
      allGood = false;
    }

    // Check iOS Simulator
    try {
      execSync('xcrun simctl list devices available', { encoding: 'utf8' });
      log('✅ iOS Simulator: Available', colors.green);
    } catch (error) {
      log('⚠️  iOS Simulator: Issues detected', colors.yellow);
    }
  }

  // Check Android SDK
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome && fs.existsSync(androidHome)) {
    log('✅ Android SDK: Found', colors.green);

    // Check Android tools
    try {
      const adbPath = path.join(androidHome, 'platform-tools', 'adb');
      if (fs.existsSync(adbPath) || fs.existsSync(adbPath + '.exe')) {
        log('✅ Android Debug Bridge (ADB): Available', colors.green);
      } else {
        log('⚠️  Android Debug Bridge (ADB): Not found', colors.yellow);
      }
    } catch (error) {
      log('⚠️  Android tools: Issues detected', colors.yellow);
    }
  } else {
    log('⚠️  Android SDK: Not found (set ANDROID_HOME)', colors.yellow);
    log(
      '   Install Android Studio and set environment variable',
      colors.yellow
    );
  }

  // Check Java
  try {
    const javaVersion = execSync('java -version 2>&1 | head -1', {
      encoding: 'utf8',
    }).trim();
    log(`✅ Java: ${javaVersion}`, colors.green);
  } catch (error) {
    log('⚠️  Java: Not found', colors.yellow);
    log('   Install JDK 11 or higher', colors.yellow);
  }

  return allGood;
}

async function setupMobileDependencies() {
  log('\n📦 Setting up mobile app dependencies...', colors.blue);

  const mobileDir = path.join(process.cwd(), 'apps', 'mobile');

  if (!fs.existsSync(mobileDir)) {
    log('❌ Mobile app directory not found', colors.red);
    return false;
  }

  try {
    // Install mobile app dependencies
    log('Installing React Native dependencies...', colors.cyan);
    execCommand('npm install', { cwd: mobileDir });

    // Install iOS dependencies (if on macOS)
    if (os.platform() === 'darwin') {
      log('Installing iOS dependencies...', colors.cyan);
      const iosDir = path.join(mobileDir, 'ios');
      if (fs.existsSync(iosDir)) {
        execCommand('pod install', { cwd: iosDir });
      }
    }

    log('✅ Mobile dependencies installed successfully', colors.green);
    return true;
  } catch (error) {
    log('❌ Failed to install mobile dependencies', colors.red);
    return false;
  }
}

async function createDebugKeystore() {
  log('\n🔑 Setting up Android debug keystore...', colors.blue);

  const androidDir = path.join(
    process.cwd(),
    'apps',
    'mobile',
    'android',
    'app'
  );
  const keystorePath = path.join(androidDir, 'debug.keystore');

  if (fs.existsSync(keystorePath)) {
    log('⚠️  Debug keystore already exists', colors.yellow);
    return true;
  }

  try {
    if (!fs.existsSync(androidDir)) {
      fs.mkdirSync(androidDir, { recursive: true });
    }

    const command = `keytool -genkey -v -keystore ${keystorePath} -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`;

    execCommand(command);
    log('✅ Debug keystore created successfully', colors.green);
    return true;
  } catch (error) {
    log(
      '⚠️  Could not create debug keystore (may need manual setup)',
      colors.yellow
    );
    return false;
  }
}

async function setupEnvironmentFiles() {
  log('\n🌍 Setting up environment files...', colors.blue);

  const mobileDir = path.join(process.cwd(), 'apps', 'mobile');
  const envExample = path.join(mobileDir, '.env.example');
  const envFile = path.join(mobileDir, '.env');

  if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envFile);
    log('✅ Created .env file from .env.example', colors.green);
    log(
      '⚠️  Please update .env with your Firebase configuration',
      colors.yellow
    );
  } else if (fs.existsSync(envFile)) {
    log('⚠️  .env file already exists', colors.yellow);
  } else {
    log('❌ .env.example not found', colors.red);
  }
}

async function validateSetup() {
  log('\n✅ Validating mobile setup...', colors.blue);

  const mobileDir = path.join(process.cwd(), 'apps', 'mobile');

  // Check key files exist
  const requiredFiles = [
    'package.json',
    'metro.config.js',
    'babel.config.js',
    'react-native.config.js',
    'src/App.tsx',
    'index.js',
  ];

  const missingFiles = requiredFiles.filter(
    file => !fs.existsSync(path.join(mobileDir, file))
  );

  if (missingFiles.length > 0) {
    log('❌ Missing required files:', colors.red);
    missingFiles.forEach(file => log(`   - ${file}`, colors.red));
    return false;
  }

  // Check iOS setup (on macOS)
  if (os.platform() === 'darwin') {
    const iosFiles = ['ios/Podfile'];
    const missingIosFiles = iosFiles.filter(
      file => !fs.existsSync(path.join(mobileDir, file))
    );

    if (missingIosFiles.length > 0) {
      log('⚠️  Missing iOS files:', colors.yellow);
      missingIosFiles.forEach(file => log(`   - ${file}`, colors.yellow));
    }
  }

  // Check Android setup
  const androidFiles = ['android/build.gradle', 'android/app/build.gradle'];

  const missingAndroidFiles = androidFiles.filter(
    file => !fs.existsSync(path.join(mobileDir, file))
  );

  if (missingAndroidFiles.length > 0) {
    log('⚠️  Missing Android files:', colors.yellow);
    missingAndroidFiles.forEach(file => log(`   - ${file}`, colors.yellow));
  }

  log('✅ Mobile setup validation completed', colors.green);
  return true;
}

async function displayNextSteps() {
  log('\n🎉 Mobile development environment setup completed!', colors.green);
  log('\n📋 Next steps:', colors.blue);

  log('1. Install platform-specific tools if needed:', colors.cyan);
  if (os.platform() === 'darwin') {
    log('   • iOS: Install Xcode from App Store', colors.cyan);
  }
  log('   • Android: Install Android Studio and set ANDROID_HOME', colors.cyan);

  log('2. Configure environment variables:', colors.cyan);
  log('   • Update apps/mobile/.env with Firebase configuration', colors.cyan);

  log('3. Start development:', colors.cyan);
  log('   • cd apps/mobile', colors.cyan);
  log('   • npm run start (Metro bundler)', colors.cyan);
  log('   • npm run ios (iOS simulator)', colors.cyan);
  log('   • npm run android (Android emulator)', colors.cyan);

  log('4. Enable debugging:', colors.cyan);
  log('   • Install Flipper for advanced debugging', colors.cyan);
  log('   • Use React DevTools for component inspection', colors.cyan);

  log(
    '\n💡 Pro tip: Use the VS Code workspace for the best development experience!',
    colors.yellow
  );
}

async function main() {
  log('📱 ProTour Mobile Development Environment Setup', colors.cyan);
  log('==============================================', colors.cyan);

  try {
    const hasPrereqs = await checkPrerequisites();

    if (!hasPrereqs) {
      log(
        '\n⚠️  Some prerequisites are missing. Please install them and try again.',
        colors.yellow
      );
      log(
        'The setup will continue, but you may encounter issues.',
        colors.yellow
      );
    }

    await setupMobileDependencies();
    await createDebugKeystore();
    await setupEnvironmentFiles();
    await validateSetup();
    await displayNextSteps();

    log('\n✅ Mobile setup completed successfully!', colors.green);
  } catch (error) {
    log(`\n❌ Mobile setup failed: ${error.message}`, colors.red);
    log('Please check the error messages above and try again.', colors.red);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

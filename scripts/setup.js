#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    log(`Running: ${command}`, colors.cyan);
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    log(`Error running: ${command}`, colors.red);
    log(error.message, colors.red);
    return false;
  }
}

function checkPrerequisites() {
  log('\n🔍 Checking prerequisites...', colors.blue);

  const checks = [
    { name: 'Node.js', command: 'node --version', minVersion: '18.0.0' },
    { name: 'npm', command: 'npm --version', minVersion: '9.0.0' },
    { name: 'Git', command: 'git --version' },
  ];

  let allGood = true;

  checks.forEach(check => {
    try {
      const output = execSync(check.command, { encoding: 'utf8' }).trim();
      log(`✅ ${check.name}: ${output}`, colors.green);
    } catch (error) {
      log(`❌ ${check.name}: Not found`, colors.red);
      allGood = false;
    }
  });

  // Platform-specific checks
  const platform = os.platform();

  if (platform === 'darwin') {
    log('\n📱 macOS detected - checking iOS development tools...', colors.blue);
    try {
      execSync('xcode-select -p', { encoding: 'utf8' });
      log('✅ Xcode Command Line Tools: Installed', colors.green);
    } catch (error) {
      log('⚠️  Xcode Command Line Tools: Not installed', colors.yellow);
      log('   Run: xcode-select --install', colors.yellow);
    }

    try {
      execSync('which pod', { encoding: 'utf8' });
      log('✅ CocoaPods: Installed', colors.green);
    } catch (error) {
      log('⚠️  CocoaPods: Not installed', colors.yellow);
      log('   Run: sudo gem install cocoapods', colors.yellow);
    }
  }

  // Check for Android development (optional)
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome && fs.existsSync(androidHome)) {
    log('✅ Android SDK: Found', colors.green);
  } else {
    log('⚠️  Android SDK: Not found (optional)', colors.yellow);
    log('   Install Android Studio and set ANDROID_HOME', colors.yellow);
  }

  return allGood;
}

function installDependencies() {
  log('\n📦 Installing dependencies...', colors.blue);

  // Install root dependencies
  if (!execCommand('npm install')) {
    return false;
  }

  // Install workspace dependencies
  log('\nInstalling workspace dependencies...', colors.cyan);
  if (!execCommand('npm run postinstall')) {
    // If workspace install fails, install each package individually
    log(
      'Workspace install failed, installing packages individually...',
      colors.yellow
    );

    const packages = [
      'apps/mobile',
      'apps/web',
      'packages/shared',
      'functions',
    ];

    for (const pkg of packages) {
      const pkgPath = path.join(process.cwd(), pkg);
      if (fs.existsSync(path.join(pkgPath, 'package.json'))) {
        if (!execCommand('npm install', { cwd: pkgPath })) {
          log(`Failed to install dependencies for ${pkg}`, colors.red);
          return false;
        }
      }
    }
  }

  return true;
}

function setupGitHooks() {
  log('\n🪝 Setting up Git hooks...', colors.blue);

  // Initialize husky
  if (!execCommand('npx husky install')) {
    return false;
  }

  return true;
}

function createEnvironmentFiles() {
  log('\n🌍 Creating environment files...', colors.blue);

  const envExamples = [
    {
      path: 'apps/mobile/.env.example',
      content: `# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Environment
NODE_ENV=development

# API Configuration  
API_BASE_URL=http://localhost:5001/your_project/us-central1
`,
    },
    {
      path: 'functions/.env.example',
      content: `# Firebase Configuration
FIREBASE_PROJECT_ID=your_project_id

# Environment
NODE_ENV=development

# External Services
SMS_API_KEY=your_sms_api_key
SMS_SENDER_ID=your_sender_id
`,
    },
  ];

  envExamples.forEach(({ path: filePath, content }) => {
    const fullPath = path.join(process.cwd(), filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content);
      log(`✅ Created: ${filePath}`, colors.green);
    } else {
      log(`⚠️  Already exists: ${filePath}`, colors.yellow);
    }
  });

  return true;
}

function createBasicFiles() {
  log('\n📄 Creating basic source files...', colors.blue);

  // Create basic index files for packages
  const basicFiles = [
    {
      path: 'packages/shared/src/index.ts',
      content: `export * from './types';
export * from './utils';
`,
    },
    {
      path: 'packages/shared/src/types/index.ts',
      content: `// Shared TypeScript types for ProTour
export interface Tournament {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Match {
  id: string;
  tournamentId: string;
  player1Id: string;
  player2Id: string;
  score?: {
    player1: number;
    player2: number;
  };
  status: 'pending' | 'in-progress' | 'completed';
}
`,
    },
    {
      path: 'packages/shared/src/utils/index.ts',
      content: `// Shared utilities for ProTour
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-IN');
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};
`,
    },
    {
      path: 'functions/src/index.ts',
      content: `import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Example Cloud Function
export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info('Hello logs!', { structuredData: true });
  response.send('Hello from Firebase!');
});
`,
    },
  ];

  basicFiles.forEach(({ path: filePath, content }) => {
    const fullPath = path.join(process.cwd(), filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content);
      log(`✅ Created: ${filePath}`, colors.green);
    } else {
      log(`⚠️  Already exists: ${filePath}`, colors.yellow);
    }
  });

  return true;
}

function displayNextSteps() {
  log('\n🎉 Setup complete!', colors.green);
  log('\n📋 Next steps:', colors.blue);
  log(
    '1. Copy .env.example files and fill in your Firebase configuration',
    colors.cyan
  );
  log('2. Install mobile development tools if needed:', colors.cyan);
  log(
    '   • iOS: Install Xcode and run: cd apps/mobile/ios && pod install',
    colors.cyan
  );
  log('   • Android: Install Android Studio and set ANDROID_HOME', colors.cyan);
  log('3. Start development servers:', colors.cyan);
  log('   • npm run dev (starts mobile + functions)', colors.cyan);
  log('   • npm run firebase:emulator (Firebase emulators)', colors.cyan);
  log('4. Open ProTour.code-workspace in VS Code', colors.cyan);
  log(
    '\n💡 Pro tip: Use the VS Code workspace for the best development experience!',
    colors.yellow
  );
}

function main() {
  log('🚀 ProTour Development Environment Setup', colors.bright);
  log('=====================================', colors.bright);

  if (!checkPrerequisites()) {
    log(
      '\n❌ Prerequisites check failed. Please install missing tools and try again.',
      colors.red
    );
    process.exit(1);
  }

  if (!installDependencies()) {
    log('\n❌ Failed to install dependencies.', colors.red);
    process.exit(1);
  }

  if (!setupGitHooks()) {
    log('\n❌ Failed to setup Git hooks.', colors.red);
    process.exit(1);
  }

  if (!createEnvironmentFiles()) {
    log('\n❌ Failed to create environment files.', colors.red);
    process.exit(1);
  }

  if (!createBasicFiles()) {
    log('\n❌ Failed to create basic files.', colors.red);
    process.exit(1);
  }

  displayNextSteps();
}

main();

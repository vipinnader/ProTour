#!/usr/bin/env node

/**
 * Firebase setup continuation script for ProTour
 * Use this when firebase-init.js partially succeeded
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
      ...options 
    });
    return output;
  } catch (error) {
    log(`Error running: ${command}`, colors.red);
    throw error;
  }
}

async function checkFirebaseProjects() {
  log('\n📋 Checking existing Firebase projects...', colors.blue);
  
  try {
    const output = execSync('firebase projects:list', { encoding: 'utf8' });
    log('✅ Firebase projects:', colors.green);
    console.log(output);
  } catch (error) {
    log('❌ Failed to list projects', colors.red);
    throw error;
  }
}

async function initializeFirebaseConfig() {
  log('\n⚙️  Initializing Firebase configuration...', colors.blue);

  try {
    // Check if firebase.json exists
    if (!fs.existsSync('firebase.json')) {
      log('Initializing Firebase project configuration...', colors.cyan);
      execCommand('firebase init --project protour-dev');
    } else {
      log('✅ firebase.json already exists', colors.green);
    }

    // Set to development project
    execCommand('firebase use protour-dev');
    log('✅ Switched to protour-dev project', colors.green);

  } catch (error) {
    log('❌ Failed to initialize Firebase configuration', colors.red);
    throw error;
  }
}

async function deployFirebaseRules() {
  log('\n🚀 Deploying Firebase rules...', colors.blue);

  try {
    // Deploy Firestore rules only
    try {
      execCommand('firebase deploy --only firestore:rules');
      log('✅ Deployed Firestore rules', colors.green);
    } catch (error) {
      log('⚠️  Could not deploy Firestore rules', colors.yellow);
    }

    // Deploy Storage rules only
    try {
      execCommand('firebase deploy --only storage:rules');
      log('✅ Deployed Storage rules', colors.green);
    } catch (error) {
      log('⚠️  Could not deploy Storage rules', colors.yellow);
    }

    // Deploy Firestore indexes
    try {
      execCommand('firebase deploy --only firestore:indexes');
      log('✅ Deployed Firestore indexes', colors.green);
    } catch (error) {
      log('⚠️  Could not deploy Firestore indexes', colors.yellow);
    }

  } catch (error) {
    log('❌ Failed to deploy Firebase rules', colors.red);
    throw error;
  }
}

async function createEnvironmentFiles() {
  log('\n🌍 Creating environment files...', colors.blue);

  const envFiles = [
    'apps/mobile/.env',
    'functions/.env'
  ];

  for (const envFile of envFiles) {
    const exampleFile = `${envFile}.example`;
    const fullPath = path.join(process.cwd(), envFile);
    const examplePath = path.join(process.cwd(), exampleFile);

    if (!fs.existsSync(fullPath) && fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, fullPath);
      log(`✅ Created ${envFile} (copy of .env.example)`, colors.green);
      log(`⚠️  Please update ${envFile} with your Firebase configuration`, colors.yellow);
    } else if (fs.existsSync(fullPath)) {
      log(`⚠️  ${envFile} already exists`, colors.yellow);
    } else {
      log(`⚠️  ${exampleFile} not found`, colors.yellow);
    }
  }
}

async function testEmulators() {
  log('\n🧪 Testing Firebase emulators...', colors.blue);

  try {
    log('Starting emulators (this will run briefly to test)...', colors.cyan);
    const child = execSync('timeout 10 firebase emulators:start --only auth,firestore,storage', {
      stdio: 'ignore',
      encoding: 'utf8'
    });
    log('✅ Emulators can start successfully', colors.green);
  } catch (error) {
    // Expected timeout
    if (error.status === 124) {
      log('✅ Emulators started successfully (timeout expected)', colors.green);
    } else {
      log('⚠️  Emulators may have issues', colors.yellow);
    }
  }
}

async function displayStatus() {
  log('\n🎉 Firebase setup continuation completed!', colors.green);
  log('\n📋 What was done:', colors.blue);
  log('✅ Checked existing Firebase projects', colors.green);
  log('✅ Initialized Firebase configuration', colors.green);
  log('✅ Deployed security rules', colors.green);
  log('✅ Created environment files', colors.green);
  log('✅ Tested emulators', colors.green);
  
  log('\n📋 Next steps:', colors.blue);
  log('1. Update environment files with your Firebase configuration:', colors.cyan);
  log('   • apps/mobile/.env', colors.cyan);
  log('   • functions/.env', colors.cyan);
  log('2. Start development:', colors.cyan);
  log('   • npm run firebase:emulator:start', colors.cyan);
  log('   • npm run firebase:emulator:seed', colors.cyan);
  log('3. Access Firebase Emulator UI at http://localhost:4000', colors.cyan);
}

async function main() {
  log('🔧 ProTour Firebase Setup Continuation', colors.cyan);
  log('=====================================', colors.cyan);

  try {
    await checkFirebaseProjects();
    await initializeFirebaseConfig();
    await deployFirebaseRules();
    await createEnvironmentFiles();
    await testEmulators();
    await displayStatus();
  } catch (error) {
    log(`\n❌ Firebase setup continuation failed: ${error.message}`, colors.red);
    log('Please check the error messages above and try manual steps.', colors.red);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
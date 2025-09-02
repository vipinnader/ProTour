#!/usr/bin/env node

/**
 * Firebase initialization script for ProTour
 * This script helps set up Firebase projects and deploy initial configuration
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

async function checkFirebaseCLI() {
  log('\n🔥 Checking Firebase CLI...', colors.blue);
  
  try {
    execCommand('firebase --version');
    log('✅ Firebase CLI is installed', colors.green);
  } catch (error) {
    log('❌ Firebase CLI not found. Installing...', colors.red);
    execCommand('npm install -g firebase-tools');
    log('✅ Firebase CLI installed', colors.green);
  }
}

async function loginToFirebase() {
  log('\n🔐 Firebase Authentication...', colors.blue);
  
  try {
    execCommand('firebase login --no-localhost');
    log('✅ Successfully authenticated with Firebase', colors.green);
  } catch (error) {
    log('❌ Failed to authenticate with Firebase', colors.red);
    throw error;
  }
}

async function createFirebaseProjects() {
  log('\n🏗️  Creating Firebase projects...', colors.blue);
  
  const projects = [
    { id: 'protour-dev', name: 'ProTour Development' },
    { id: 'protour-staging', name: 'ProTour Staging' },
    { id: 'protour-prod', name: 'ProTour Production' }
  ];

  for (const project of projects) {
    try {
      log(`Creating project: ${project.id}`, colors.cyan);
      execCommand(`firebase projects:create ${project.id} --display-name "${project.name}"`);
      log(`✅ Created project: ${project.id}`, colors.green);
    } catch (error) {
      if (error.message.includes('already exists')) {
        log(`⚠️  Project ${project.id} already exists`, colors.yellow);
      } else {
        log(`❌ Failed to create project ${project.id}`, colors.red);
        throw error;
      }
    }
  }
}

async function enableFirebaseServices() {
  log('\n⚙️  Enabling Firebase services...', colors.blue);

  const services = [
    'firestore.googleapis.com',
    'firebase.googleapis.com',
    'cloudfunctions.googleapis.com',
    'storage-component.googleapis.com'
  ];

  const projects = ['protour-dev', 'protour-staging', 'protour-prod'];

  for (const project of projects) {
    log(`Enabling services for ${project}...`, colors.cyan);
    
    try {
      execCommand(`firebase use ${project}`);
      
      for (const service of services) {
        try {
          execCommand(`gcloud services enable ${service} --project=${project}`);
        } catch (error) {
          // Service may already be enabled or gcloud not available
          log(`⚠️  Could not enable ${service} for ${project}`, colors.yellow);
        }
      }
      
      log(`✅ Services enabled for ${project}`, colors.green);
    } catch (error) {
      log(`❌ Failed to enable services for ${project}`, colors.red);
    }
  }
}

async function deployFirebaseConfig() {
  log('\n🚀 Deploying Firebase configuration...', colors.blue);

  try {
    // Set to development project
    execCommand('firebase use protour-dev');
    
    // Deploy Firestore rules and indexes
    execCommand('firebase deploy --only firestore');
    log('✅ Deployed Firestore rules and indexes', colors.green);

    // Deploy Storage rules
    execCommand('firebase deploy --only storage');
    log('✅ Deployed Storage rules', colors.green);

    // Build and deploy Functions
    execCommand('npm run build:functions');
    execCommand('firebase deploy --only functions');
    log('✅ Deployed Cloud Functions', colors.green);

  } catch (error) {
    log('❌ Failed to deploy Firebase configuration', colors.red);
    throw error;
  }
}

async function setupEmulators() {
  log('\n🧪 Setting up Firebase emulators...', colors.blue);

  try {
    // Start emulators in the background to initialize
    log('Starting emulators to initialize...', colors.cyan);
    execCommand('firebase emulators:start --only auth,firestore,functions,storage --import=./emulator-data', {
      timeout: 10000,
      killSignal: 'SIGTERM'
    });
  } catch (error) {
    // Expected to fail when we kill the process
    log('✅ Emulators initialized', colors.green);
  }

  // Seed emulators with test data
  try {
    log('Seeding emulators with test data...', colors.cyan);
    execCommand('npm run firebase:emulator:seed');
    log('✅ Emulators seeded with test data', colors.green);
  } catch (error) {
    log('⚠️  Could not seed emulators (they may not be running)', colors.yellow);
  }
}

async function generateServiceAccountKeys() {
  log('\n🔑 Setting up service account keys...', colors.blue);
  
  log('⚠️  Service account keys should be generated manually for security:', colors.yellow);
  log('1. Go to Firebase Console → Project Settings → Service Accounts', colors.cyan);
  log('2. Click "Generate new private key" for each project', colors.cyan);
  log('3. Store keys securely (DO NOT commit to version control)', colors.cyan);
  log('4. Set GOOGLE_APPLICATION_CREDENTIALS environment variable', colors.cyan);
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

async function displayNextSteps() {
  log('\n🎉 Firebase setup completed!', colors.green);
  log('\n📋 Next steps:', colors.blue);
  log('1. Update environment files with your Firebase configuration:', colors.cyan);
  log('   • apps/mobile/.env', colors.cyan);
  log('   • functions/.env', colors.cyan);
  log('2. Generate and configure service account keys (see instructions above)', colors.cyan);
  log('3. Test the setup:', colors.cyan);
  log('   • npm run firebase:emulator:start (start emulators)', colors.cyan);
  log('   • npm run firebase:emulator:seed (seed test data)', colors.cyan);
  log('4. Access Firebase Emulator UI at http://localhost:4000', colors.cyan);
  log('\n💡 Pro tip: Use different Firebase projects for dev/staging/prod!', colors.yellow);
}

async function main() {
  log('🚀 ProTour Firebase Setup', colors.cyan);
  log('=========================', colors.cyan);

  try {
    await checkFirebaseCLI();
    await loginToFirebase();
    await createFirebaseProjects();
    await enableFirebaseServices();
    await deployFirebaseConfig();
    await setupEmulators();
    await generateServiceAccountKeys();
    await createEnvironmentFiles();
    await displayNextSteps();
  } catch (error) {
    log(`\n❌ Firebase setup failed: ${error.message}`, colors.red);
    log('Please check the error messages above and try again.', colors.red);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
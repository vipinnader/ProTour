#!/usr/bin/env node

/**
 * Seed script for Firebase emulator with test data
 * Run with: npm run seed-emulator
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'protour-dev',
});

const db = admin.firestore();
const auth = admin.auth();

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

// Test users data
const testUsers = [
  {
    uid: 'test-admin',
    email: 'admin@protour.app',
    password: 'admin123',
    displayName: 'Admin User',
    claims: { admin: true, role: 'admin' },
    profile: { role: 'admin', isActive: true },
  },
  {
    uid: 'test-organizer',
    email: 'organizer@protour.app',
    password: 'organizer123',
    displayName: 'Tournament Organizer',
    claims: { role: 'organizer' },
    profile: { role: 'organizer', isActive: true },
  },
  {
    uid: 'test-player1',
    email: 'player1@protour.app',
    password: 'player123',
    displayName: 'Player One',
    claims: { role: 'player' },
    profile: { role: 'player', isActive: true },
  },
  {
    uid: 'test-player2',
    email: 'player2@protour.app',
    password: 'player123',
    displayName: 'Player Two',
    claims: { role: 'player' },
    profile: { role: 'player', isActive: true },
  },
];

// Test tournaments data
const testTournaments = [
  {
    id: 'tournament-1',
    name: 'Summer Championship 2024',
    description: 'Annual summer tournament for all skill levels',
    ownerId: 'test-organizer',
    organizerIds: ['test-organizer'],
    refereeIds: [],
    status: 'draft',
    isPublic: true,
    maxParticipants: 32,
    participantCount: 2,
    startDate: new Date('2024-07-15'),
    endDate: new Date('2024-07-16'),
    registrationDeadline: new Date('2024-07-10'),
    venue: 'Community Sports Center',
    rules: 'Standard tournament rules apply',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

// Test registrations
const testRegistrations = [
  {
    tournamentId: 'tournament-1',
    userId: 'test-player1',
    status: 'confirmed',
    registeredAt: admin.firestore.FieldValue.serverTimestamp(),
    playerInfo: {
      displayName: 'Player One',
      email: 'player1@protour.app',
    },
  },
  {
    tournamentId: 'tournament-1',
    userId: 'test-player2',
    status: 'confirmed',
    registeredAt: admin.firestore.FieldValue.serverTimestamp(),
    playerInfo: {
      displayName: 'Player Two',
      email: 'player2@protour.app',
    },
  },
];

// Test matches
const testMatches = [
  {
    tournamentId: 'tournament-1',
    player1Id: 'test-player1',
    player2Id: 'test-player2',
    status: 'scheduled',
    round: 1,
    scheduledTime: new Date('2024-07-15T10:00:00Z'),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

async function createTestUsers() {
  log('\n👤 Creating test users...', colors.blue);

  for (const userData of testUsers) {
    try {
      // Create auth user
      await auth.createUser({
        uid: userData.uid,
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
      });

      // Set custom claims
      if (userData.claims) {
        await auth.setCustomUserClaims(userData.uid, userData.claims);
      }

      // Create user profile document
      const profile = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        ...userData.profile,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        preferences: {
          notifications: { email: true, sms: false, push: true },
          privacy: { showProfile: true, showStats: true },
        },
      };

      await db.collection('users').doc(userData.uid).set(profile);

      log(`✅ Created user: ${userData.email}`, colors.green);
    } catch (error) {
      if (error.code === 'auth/uid-already-exists') {
        log(`⚠️  User already exists: ${userData.email}`, colors.yellow);
      } else {
        log(
          `❌ Error creating user ${userData.email}: ${error.message}`,
          colors.red
        );
      }
    }
  }
}

async function createTestTournaments() {
  log('\n🏆 Creating test tournaments...', colors.blue);

  for (const tournament of testTournaments) {
    try {
      await db.collection('tournaments').doc(tournament.id).set(tournament);
      log(`✅ Created tournament: ${tournament.name}`, colors.green);
    } catch (error) {
      log(`❌ Error creating tournament: ${error.message}`, colors.red);
    }
  }
}

async function createTestRegistrations() {
  log('\n📝 Creating test registrations...', colors.blue);

  for (const registration of testRegistrations) {
    try {
      await db
        .collection('tournaments')
        .doc(registration.tournamentId)
        .collection('registrations')
        .add(registration);

      log(
        `✅ Created registration for ${registration.playerInfo.displayName}`,
        colors.green
      );
    } catch (error) {
      log(`❌ Error creating registration: ${error.message}`, colors.red);
    }
  }
}

async function createTestMatches() {
  log('\n⚽ Creating test matches...', colors.blue);

  for (const match of testMatches) {
    try {
      await db
        .collection('tournaments')
        .doc(match.tournamentId)
        .collection('matches')
        .add(match);

      log(`✅ Created match between players`, colors.green);
    } catch (error) {
      log(`❌ Error creating match: ${error.message}`, colors.red);
    }
  }
}

async function createTestSettings() {
  log('\n⚙️  Creating test settings...', colors.blue);

  const settings = {
    app: {
      name: 'ProTour',
      version: '1.0.0',
      maintainanceMode: false,
    },
    features: {
      registrationEnabled: true,
      smsNotifications: true,
      emailNotifications: true,
      pushNotifications: true,
    },
    limits: {
      maxTournamentsPerUser: 10,
      maxParticipantsPerTournament: 128,
      maxMatchesPerDay: 50,
    },
  };

  try {
    await db.collection('settings').doc('app').set(settings);
    log('✅ Created app settings', colors.green);
  } catch (error) {
    log(`❌ Error creating settings: ${error.message}`, colors.red);
  }
}

async function seedEmulator() {
  log('🌱 Seeding Firebase Emulator with test data...', colors.cyan);
  log('===============================================', colors.cyan);

  try {
    await createTestUsers();
    await createTestTournaments();
    await createTestRegistrations();
    await createTestMatches();
    await createTestSettings();

    log('\n🎉 Emulator seeding completed successfully!', colors.green);
    log('\n📋 Test accounts:', colors.blue);
    log('Admin: admin@protour.app / admin123', colors.cyan);
    log('Organizer: organizer@protour.app / organizer123', colors.cyan);
    log('Player 1: player1@protour.app / player123', colors.cyan);
    log('Player 2: player2@protour.app / player123', colors.cyan);
  } catch (error) {
    log(`\n❌ Error seeding emulator: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Run the seeder
if (require.main === module) {
  seedEmulator()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedEmulator };

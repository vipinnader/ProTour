#!/usr/bin/env node

/**
 * Database migration automation script for ProTour
 * Handles Firestore data migrations and schema updates
 */

const admin = require('firebase-admin');
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

// Migration configuration
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATION_COLLECTION = 'system_migrations';

class DatabaseMigrator {
  constructor(projectId, serviceAccountKey = null) {
    this.projectId = projectId;
    
    // Initialize Firebase Admin
    const config = { projectId };
    if (serviceAccountKey) {
      config.credential = admin.credential.cert(serviceAccountKey);
    }
    
    if (!admin.apps.length) {
      admin.initializeApp(config);
    }
    
    this.db = admin.firestore();
  }

  /**
   * Get list of migration files
   */
  getMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      log('No migrations directory found', colors.yellow);
      return [];
    }

    return fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.js'))
      .sort()
      .map(file => ({
        filename: file,
        path: path.join(MIGRATIONS_DIR, file),
        version: file.split('-')[0],
      }));
  }

  /**
   * Get completed migrations from Firestore
   */
  async getCompletedMigrations() {
    try {
      const snapshot = await this.db.collection(MIGRATION_COLLECTION).get();
      return snapshot.docs.map(doc => ({
        version: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      log(`Error getting completed migrations: ${error.message}`, colors.red);
      return [];
    }
  }

  /**
   * Record migration as completed
   */
  async recordMigration(migration, result) {
    try {
      await this.db.collection(MIGRATION_COLLECTION).doc(migration.version).set({
        filename: migration.filename,
        executedAt: admin.firestore.FieldValue.serverTimestamp(),
        success: result.success,
        error: result.error || null,
        documentsProcessed: result.documentsProcessed || 0,
        duration: result.duration || 0,
      });
      
      log(`✅ Recorded migration ${migration.version} as completed`, colors.green);
    } catch (error) {
      log(`❌ Failed to record migration: ${error.message}`, colors.red);
    }
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration) {
    log(`\n🔄 Executing migration: ${migration.filename}`, colors.blue);
    
    const startTime = Date.now();
    let result = {
      success: false,
      error: null,
      documentsProcessed: 0,
      duration: 0,
    };

    try {
      // Load migration module
      const migrationModule = require(migration.path);
      
      if (typeof migrationModule.up !== 'function') {
        throw new Error('Migration must export an "up" function');
      }

      // Execute migration
      const migrationResult = await migrationModule.up(this.db, admin);
      
      result.success = true;
      result.documentsProcessed = migrationResult?.documentsProcessed || 0;
      result.duration = Date.now() - startTime;
      
      log(`✅ Migration completed successfully in ${result.duration}ms`, colors.green);
      if (result.documentsProcessed > 0) {
        log(`   Processed ${result.documentsProcessed} documents`, colors.cyan);
      }
      
    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.duration = Date.now() - startTime;
      
      log(`❌ Migration failed: ${error.message}`, colors.red);
      log(`   Duration: ${result.duration}ms`, colors.cyan);
    }

    return result;
  }

  /**
   * Run pending migrations
   */
  async runMigrations() {
    log('🚀 Starting database migrations...', colors.cyan);
    
    const migrationFiles = this.getMigrationFiles();
    if (migrationFiles.length === 0) {
      log('No migration files found', colors.yellow);
      return;
    }

    const completedMigrations = await this.getCompletedMigrations();
    const completedVersions = new Set(completedMigrations.map(m => m.version));

    const pendingMigrations = migrationFiles.filter(m => !completedVersions.has(m.version));
    
    if (pendingMigrations.length === 0) {
      log('✅ All migrations are up to date', colors.green);
      return;
    }

    log(`📋 Found ${pendingMigrations.length} pending migrations:`, colors.blue);
    pendingMigrations.forEach(m => log(`   - ${m.filename}`, colors.cyan));

    let successCount = 0;
    let failureCount = 0;

    for (const migration of pendingMigrations) {
      const result = await this.executeMigration(migration);
      await this.recordMigration(migration, result);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        
        // Stop on first failure
        log('⏹️  Stopping migrations due to failure', colors.red);
        break;
      }
    }

    log(`\n📊 Migration Summary:`, colors.blue);
    log(`✅ Successful: ${successCount}`, colors.green);
    log(`❌ Failed: ${failureCount}`, colors.red);

    if (failureCount > 0) {
      process.exit(1);
    }
  }

  /**
   * Create a new migration file
   */
  createMigration(name) {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const version = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${version}-${name.toLowerCase().replace(/\s+/g, '-')}.js`;
    const filepath = path.join(MIGRATIONS_DIR, filename);

    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
  /**
   * Apply migration
   * @param {FirebaseFirestore.Firestore} db - Firestore instance
   * @param {*} admin - Firebase Admin SDK
   */
  async up(db, admin) {
    console.log('Running migration: ${name}');
    
    let documentsProcessed = 0;
    
    try {
      // TODO: Implement migration logic
      // Example:
      // const batch = db.batch();
      // const snapshot = await db.collection('tournaments').get();
      // 
      // snapshot.docs.forEach(doc => {
      //   const ref = doc.ref;
      //   batch.update(ref, {
      //     newField: 'defaultValue',
      //     updatedAt: admin.firestore.FieldValue.serverTimestamp()
      //   });
      //   documentsProcessed++;
      // });
      // 
      // await batch.commit();
      
      console.log(\`Migration completed. Processed \${documentsProcessed} documents.\`);
      
      return {
        success: true,
        documentsProcessed,
      };
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  /**
   * Rollback migration (optional)
   * @param {FirebaseFirestore.Firestore} db - Firestore instance
   * @param {*} admin - Firebase Admin SDK
   */
  async down(db, admin) {
    console.log('Rolling back migration: ${name}');
    
    // TODO: Implement rollback logic if needed
    
    throw new Error('Rollback not implemented');
  }
};
`;

    fs.writeFileSync(filepath, template);
    log(`✅ Created migration file: ${filename}`, colors.green);
    log(`📁 Location: ${filepath}`, colors.cyan);
  }

  /**
   * Show migration status
   */
  async showStatus() {
    log('📊 Migration Status', colors.blue);
    log('================', colors.blue);

    const migrationFiles = this.getMigrationFiles();
    const completedMigrations = await this.getCompletedMigrations();
    const completedMap = new Map(completedMigrations.map(m => [m.version, m]));

    if (migrationFiles.length === 0) {
      log('No migration files found', colors.yellow);
      return;
    }

    migrationFiles.forEach(file => {
      const completed = completedMap.get(file.version);
      const status = completed ? '✅ Completed' : '⏸️  Pending';
      const timestamp = completed ? new Date(completed.executedAt._seconds * 1000).toISOString() : '';
      
      log(`${status} ${file.filename}`, completed ? colors.green : colors.yellow);
      if (timestamp) {
        log(`   Executed: ${timestamp}`, colors.cyan);
      }
    });
  }
}

/**
 * CLI interface
 */
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  // Get project ID from environment or command line
  const projectId = process.env.FIREBASE_PROJECT_ID || 
                   process.env.GCLOUD_PROJECT || 
                   'protour-dev';

  // Get service account key if provided
  let serviceAccountKey = null;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    serviceAccountKey = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  const migrator = new DatabaseMigrator(projectId, serviceAccountKey);

  try {
    switch (command) {
      case 'migrate':
      case 'up':
        await migrator.runMigrations();
        break;

      case 'create':
        if (!arg) {
          log('❌ Migration name required', colors.red);
          log('Usage: npm run migrate:create "Migration Name"', colors.cyan);
          process.exit(1);
        }
        migrator.createMigration(arg);
        break;

      case 'status':
        await migrator.showStatus();
        break;

      default:
        log('ProTour Database Migration Tool', colors.cyan);
        log('==============================', colors.cyan);
        log('');
        log('Commands:', colors.blue);
        log('  migrate, up    Run pending migrations', colors.cyan);
        log('  create <name>  Create new migration file', colors.cyan);
        log('  status         Show migration status', colors.cyan);
        log('');
        log('Environment Variables:', colors.blue);
        log('  FIREBASE_PROJECT_ID           Firebase project ID', colors.cyan);
        log('  GOOGLE_APPLICATION_CREDENTIALS Service account key file', colors.cyan);
        break;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DatabaseMigrator };
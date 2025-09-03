// Database Migration Service for ProTour - Epic 1 Implementation
// Provides version tracking and automated schema migration capabilities

import { DatabaseService } from './DatabaseService';
import firestore from '@react-native-firebase/firestore';

export interface Migration {
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
  createdAt: Date;
}

export interface MigrationRecord {
  version: string;
  description: string;
  executedAt: firestore.Timestamp;
  status: 'pending' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
}

export class MigrationService extends DatabaseService {
  private readonly MIGRATIONS_COLLECTION = 'migrations';
  private migrations: Map<string, Migration> = new Map();

  constructor() {
    super();
    this.registerCoreMigrations();
  }

  // Register a migration for execution
  registerMigration(migration: Migration): void {
    if (this.migrations.has(migration.version)) {
      throw new Error(`Migration version ${migration.version} already exists`);
    }
    this.migrations.set(migration.version, migration);
  }

  // Execute all pending migrations
  async runMigrations(): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();
    const executedVersions = new Set(
      executedMigrations
        .filter(m => m.status === 'completed')
        .map(m => m.version)
    );

    // Get pending migrations in version order
    const pendingMigrations = Array.from(this.migrations.values())
      .filter(m => !executedVersions.has(m.version))
      .sort((a, b) => a.version.localeCompare(b.version));

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to execute');
      return;
    }

    console.log(`Executing ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('All migrations completed successfully');
  }

  // Execute a single migration with error handling
  private async executeMigration(migration: Migration): Promise<void> {
    const migrationRecord: Omit<MigrationRecord, 'id'> = {
      version: migration.version,
      description: migration.description,
      executedAt: firestore.Timestamp.now(),
      status: 'running',
    };

    try {
      // Record migration start
      const recordId = await this.recordMigration(migrationRecord);
      
      console.log(`Running migration ${migration.version}: ${migration.description}`);
      
      // Execute migration
      await migration.up();

      // Mark as completed
      await this.updateMigrationRecord(recordId, { status: 'completed' });
      
      console.log(`Migration ${migration.version} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Migration ${migration.version} failed:`, errorMessage);

      // Record the failure
      await this.updateMigrationRecord(migration.version, {
        status: 'failed',
        errorMessage,
      });

      throw new Error(`Migration ${migration.version} failed: ${errorMessage}`);
    }
  }

  // Rollback a specific migration
  async rollbackMigration(version: string): Promise<void> {
    const migration = this.migrations.get(version);
    if (!migration) {
      throw new Error(`Migration version ${version} not found`);
    }

    const migrationRecord = await this.getMigrationRecord(version);
    if (!migrationRecord || migrationRecord.status !== 'completed') {
      throw new Error(`Migration ${version} is not in completed state`);
    }

    console.log(`Rolling back migration ${version}: ${migration.description}`);

    try {
      await migration.down();
      await this.removeMigrationRecord(version);
      console.log(`Migration ${version} rolled back successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Rollback of migration ${version} failed:`, errorMessage);
      throw new Error(`Rollback failed: ${errorMessage}`);
    }
  }

  // Get migration history
  async getMigrationHistory(): Promise<MigrationRecord[]> {
    return this.getExecutedMigrations();
  }

  // Get current database version (latest completed migration)
  async getCurrentVersion(): Promise<string | null> {
    const migrations = await this.getExecutedMigrations();
    const completed = migrations
      .filter(m => m.status === 'completed')
      .sort((a, b) => b.version.localeCompare(a.version));

    return completed.length > 0 ? completed[0].version : null;
  }

  // Private helper methods
  private async recordMigration(migration: Omit<MigrationRecord, 'id'>): Promise<string> {
    const doc = await this.create<MigrationRecord>(this.MIGRATIONS_COLLECTION, migration);
    return doc.id;
  }

  private async updateMigrationRecord(versionOrId: string, updates: Partial<MigrationRecord>): Promise<void> {
    // Try to find by version first, then by ID
    const migrations = await this.query<MigrationRecord>(this.MIGRATIONS_COLLECTION, [
      { fieldPath: 'version', opStr: '==', value: versionOrId }
    ]);

    if (migrations.length > 0) {
      await this.update<MigrationRecord>(this.MIGRATIONS_COLLECTION, migrations[0].id, updates);
    } else {
      // Assume it's an ID
      await this.update<MigrationRecord>(this.MIGRATIONS_COLLECTION, versionOrId, updates);
    }
  }

  private async getMigrationRecord(version: string): Promise<MigrationRecord | null> {
    const migrations = await this.query<MigrationRecord>(this.MIGRATIONS_COLLECTION, [
      { fieldPath: 'version', opStr: '==', value: version }
    ]);

    return migrations.length > 0 ? migrations[0] : null;
  }

  private async removeMigrationRecord(version: string): Promise<void> {
    const migration = await this.getMigrationRecord(version);
    if (migration) {
      await this.delete(this.MIGRATIONS_COLLECTION, migration.id);
    }
  }

  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    try {
      return this.query<MigrationRecord>(this.MIGRATIONS_COLLECTION);
    } catch (error) {
      // If migrations collection doesn't exist, return empty array
      return [];
    }
  }

  // Register core Epic 1 migrations
  private registerCoreMigrations(): void {
    // Epic 1 Initial Schema Migration
    this.registerMigration({
      version: '1.0.0',
      description: 'Epic 1: Create initial tournament, player, and match collections with indexes',
      createdAt: new Date('2024-01-01'),
      up: async () => {
        console.log('Creating initial collection structure for Epic 1');
        
        // Create sample documents to establish collections
        // This ensures Firestore creates the collections and applies security rules
        
        // Create tournaments collection structure
        const tempTournament = await this.db.collection('tournaments').add({
          name: 'TEMP_MIGRATION_TOURNAMENT',
          organizerId: 'TEMP_USER',
          status: 'setup',
          createdAt: firestore.Timestamp.now(),
          updatedAt: firestore.Timestamp.now(),
        });
        
        // Create players collection structure  
        const tempPlayer = await this.db.collection('players').add({
          name: 'TEMP_MIGRATION_PLAYER',
          email: 'temp@migration.com',
          tournamentId: tempTournament.id,
          createdAt: firestore.Timestamp.now(),
          updatedAt: firestore.Timestamp.now(),
        });
        
        // Create matches collection structure
        const tempMatch = await this.db.collection('matches').add({
          tournamentId: tempTournament.id,
          player1Id: tempPlayer.id,
          round: 1,
          matchNumber: 1,
          status: 'pending',
          createdAt: firestore.Timestamp.now(),
          updatedAt: firestore.Timestamp.now(),
        });

        // Clean up temp documents
        await tempTournament.delete();
        await tempPlayer.delete();
        await tempMatch.delete();

        console.log('Epic 1 collections created successfully');
      },
      down: async () => {
        console.log('Epic 1 rollback: Collections will remain but can be manually cleaned');
        // Note: Firestore doesn't support dropping collections via client SDK
        // This would need to be done via Admin SDK or console
      }
    });

    // Future migration example
    this.registerMigration({
      version: '1.1.0',
      description: 'Epic 1.1: Add tournament codes and maxPlayers fields',
      createdAt: new Date('2024-01-15'),
      up: async () => {
        console.log('Updating tournaments with new fields');
        
        // Get all tournaments without the new fields
        const tournaments = await this.db.collection('tournaments').get();
        
        const batch = this.db.batch();
        tournaments.docs.forEach(doc => {
          const data = doc.data();
          const updates: any = {
            updatedAt: firestore.Timestamp.now()
          };
          
          // Add tournamentCode if missing
          if (!data.tournamentCode) {
            updates.tournamentCode = this.generateTournamentCode();
          }
          
          // Add maxPlayers if missing
          if (!data.maxPlayers) {
            updates.maxPlayers = 32; // Default value
          }
          
          // Add currentPlayerCount if missing
          if (data.currentPlayerCount === undefined) {
            updates.currentPlayerCount = 0;
          }

          batch.update(doc.ref, updates);
        });
        
        await batch.commit();
        console.log(`Updated ${tournaments.docs.length} tournaments with new fields`);
      },
      down: async () => {
        console.log('Removing tournamentCode and maxPlayers fields');
        
        const tournaments = await this.db.collection('tournaments').get();
        const batch = this.db.batch();
        
        tournaments.docs.forEach(doc => {
          batch.update(doc.ref, {
            tournamentCode: firestore.FieldValue.delete(),
            maxPlayers: firestore.FieldValue.delete(),
            currentPlayerCount: firestore.FieldValue.delete(),
            updatedAt: firestore.Timestamp.now()
          });
        });
        
        await batch.commit();
        console.log(`Removed new fields from ${tournaments.docs.length} tournaments`);
      }
    });
  }

  private generateTournamentCode(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
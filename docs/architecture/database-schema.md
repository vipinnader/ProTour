# Database Schema

Transforming the conceptual data models into concrete Firestore schema optimized for offline-first operation, real-time synchronization, and query performance for ProTour's tournament management requirements.

## Firestore Collection Structure

```javascript
// Tournaments Collection
tournaments/{tournamentId}
{
  id: string,                    // Document ID
  name: string,                  // "City Badminton Championship" 
  sport: string,                 // "badminton" | "tennis" | "squash"
  format: string,                // "single_elimination" | "double_elimination"
  status: string,                // "setup" | "active" | "paused" | "completed"
  organizerId: string,           // Reference to users/{userId}
  accessCode: string,            // "ABC123" - 6 char code for joining
  isPublic: boolean,             // Public visibility
  createdAt: timestamp,
  updatedAt: timestamp,
  settings: {
    maxPlayers: number,          // 64
    matchFormat: string,         // "best_of_3" | "best_of_5"
    courtCount: number,          // 4
    allowSpectators: boolean     // true
  },
  // Denormalized for offline queries
  playerCount: number,           // 32 (updated via cloud function)
  currentRound: number,          // 3 (calculated field)
  winnerPlayerId?: string,       // Set when tournament completes
  
  // Optional fields
  location?: string,
  description?: string,
  scheduledDate?: timestamp
}

// Players Subcollection 
tournaments/{tournamentId}/players/{playerId}
{
  id: string,                    // Document ID
  name: string,                  // "John Smith"
  email: string,                 // "john@email.com"
  phone: string,                 // "+919876543210"
  status: string,                // "active" | "withdrawn" | "disqualified"
  tournamentId: string,          // Parent tournament reference
  userId?: string,               // Link to registered user (optional)
  ranking?: number,              // 1-100 seeding rank
  notes?: string,                // Organizer notes
  
  // Bracket position info (denormalized)
  bracketPosition: number,       // 1-64 position in bracket
  currentRound?: number,         // Last active round
  eliminatedInRound?: number,    // Round of elimination
  
  createdAt: timestamp,
  updatedAt: timestamp,
  importedFromCSV: boolean       // Track import source
}

// Matches Subcollection
tournaments/{tournamentId}/matches/{matchId}  
{
  id: string,                    // Document ID
  tournamentId: string,          // Parent reference
  roundNumber: number,           // 1, 2, 3, 4 (1=first round)
  matchNumber: number,           // Position within round
  
  // Player references
  player1Id: string,
  player2Id?: string,            // null for bye matches
  winnerId?: string,             // Set when match completes
  
  // Match status and timing
  status: string,                // "pending" | "in_progress" | "completed" | "walkover"
  startTime?: timestamp,
  completedAt?: timestamp,
  
  // Scoring data
  scores: [                      // Array of games
    {
      game: number,              // 1, 2, 3
      player1Score: number,      // 21
      player2Score: number       // 19
    }
  ],
  
  // Court and delegation info  
  courtAssignment?: string,      // "Court 1"
  lastUpdatedBy: string,         // userId of last editor
  delegatedTo?: string,          // referee userId if delegated
  
  // Offline sync metadata
  syncStatus: string,            // "synced" | "pending" | "conflict"
  lastSyncAttempt?: timestamp,
  conflictData?: object,         // Conflict resolution data
  
  createdAt: timestamp,
  updatedAt: timestamp
}

// Users Collection (separate from tournaments for global access)
users/{userId}
{
  id: string,                    // Firebase Auth UID
  email: string,
  displayName: string,
  role: string,                  // "organizer" | "player" | "spectator"
  createdAt: timestamp,
  lastActiveAt: timestamp,
  
  preferences: {
    notifications: {
      push: boolean,             // true
      sms: boolean,              // true
      email: boolean             // false
    },
    language: string,            // "en" | "hi" 
    timezone: string             // "Asia/Kolkata"
  },
  
  profile?: {
    phone?: string,
    location?: string,
    preferredSports: string[]    // ["badminton", "tennis"]
  }
}

// Device Tokens Collection (for push notifications)
deviceTokens/{tokenId}
{
  userId: string,                // Owner reference
  token: string,                 // FCM token
  platform: string,              // "ios" | "android"
  active: boolean,               // true
  createdAt: timestamp,
  lastUsed: timestamp
}

// Delegation Tokens Collection (for referee access)
delegationTokens/{tokenId}
{
  tournamentId: string,          // Tournament reference
  organizerId: string,           // Creator reference
  refereeUserId?: string,        // Assigned referee (optional)
  accessCode: string,            // "REF789" - 6 char code
  permissions: string[],         // ["score_entry", "match_management"]
  expiresAt: timestamp,          // 24 hour expiration
  isActive: boolean,             // true
  createdAt: timestamp,
  usedAt?: timestamp
}
```

## Firestore Indexes for Performance

```javascript
// Composite Indexes (defined in firestore.indexes.json)
{
  "indexes": [
    {
      "collectionGroup": "matches",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "tournamentId", "order": "ASCENDING"},
        {"fieldPath": "roundNumber", "order": "ASCENDING"},
        {"fieldPath": "matchNumber", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "matches", 
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "tournamentId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "updatedAt", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "players",
      "queryScope": "COLLECTION", 
      "fields": [
        {"fieldPath": "tournamentId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "bracketPosition", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "tournaments",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "organizerId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "updatedAt", "order": "DESCENDING"}
      ]
    }
  ]
}
```

## SQLite Schema for Offline Storage

```sql
-- Local SQLite schema for offline-first operation
-- Mirrors Firestore structure with sync metadata

CREATE TABLE tournaments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sport TEXT NOT NULL,
    format TEXT NOT NULL,
    status TEXT NOT NULL,
    organizer_id TEXT NOT NULL,
    access_code TEXT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    settings TEXT, -- JSON blob
    player_count INTEGER DEFAULT 0,
    current_round INTEGER DEFAULT 0,
    winner_player_id TEXT,
    
    -- Offline sync metadata
    sync_status TEXT DEFAULT 'synced', -- 'synced' | 'pending' | 'conflict'
    last_sync INTEGER,
    dirty BOOLEAN DEFAULT 0,
    
    location TEXT,
    description TEXT,
    scheduled_date INTEGER
);

CREATE TABLE players (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    user_id TEXT,
    ranking INTEGER,
    notes TEXT,
    bracket_position INTEGER,
    current_round INTEGER,
    eliminated_in_round INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    imported_from_csv BOOLEAN DEFAULT 0,
    
    -- Sync metadata
    sync_status TEXT DEFAULT 'synced',
    last_sync INTEGER,
    dirty BOOLEAN DEFAULT 0,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    player1_id TEXT NOT NULL,
    player2_id TEXT,
    winner_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    start_time INTEGER,
    completed_at INTEGER,
    scores TEXT, -- JSON array
    court_assignment TEXT,
    last_updated_by TEXT NOT NULL,
    delegated_to TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Sync metadata  
    sync_status TEXT DEFAULT 'synced',
    last_sync INTEGER,
    dirty BOOLEAN DEFAULT 0,
    conflict_data TEXT, -- JSON blob
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
    FOREIGN KEY (player1_id) REFERENCES players(id),
    FOREIGN KEY (player2_id) REFERENCES players(id)
);

-- Indexes for common queries
CREATE INDEX idx_tournaments_organizer ON tournaments(organizer_id, status, updated_at);
CREATE INDEX idx_players_tournament ON players(tournament_id, status, bracket_position);
CREATE INDEX idx_matches_tournament_round ON matches(tournament_id, round_number, match_number);
CREATE INDEX idx_matches_status ON matches(tournament_id, status, updated_at);
CREATE INDEX idx_sync_pending ON tournaments(sync_status) WHERE sync_status != 'synced';
```

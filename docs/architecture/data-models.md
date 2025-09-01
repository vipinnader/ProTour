# Data Models

Based on the PRD requirements and tournament management workflows, here are the core data models that will be shared between frontend and backend to enable offline-first synchronization and real-time tournament operations.

## Tournament

**Purpose:** Central entity representing a complete tournament event with all configuration and state management

**Key Attributes:**
- id: string - Unique tournament identifier for multi-device sync
- name: string - Tournament display name for organizers and participants  
- sport: SportType - Enum (badminton, tennis, squash, etc.) for sport-specific rules
- format: TournamentFormat - Single/double elimination with match scoring rules
- status: TournamentStatus - Enum (setup, active, paused, completed) for workflow management
- organizerId: string - Foreign key to organizer account for access control
- createdAt: timestamp - Creation time for audit and sorting
- updatedAt: timestamp - Last modification for sync conflict resolution
- settings: TournamentSettings - Nested object for match formats, court assignments
- isPublic: boolean - Visibility control for spectator access
- accessCode: string - Shareable code for participant joining

```typescript
interface Tournament {
  id: string;
  name: string;
  sport: SportType;
  format: TournamentFormat;
  status: TournamentStatus;
  organizerId: string;
  createdAt: Date;
  updatedAt: Date;
  settings: TournamentSettings;
  isPublic: boolean;
  accessCode: string;
  location?: string;
  description?: string;
  scheduledDate?: Date;
}
```

**Relationships:**
- One-to-many with Players (tournament participants)
- One-to-many with Matches (all tournament matches)
- One-to-many with Rounds (bracket structure)
- Belongs-to User (organizer)

## Player

**Purpose:** Participant entity supporting CSV import, profile management, and tournament participation tracking

**Key Attributes:**
- id: string - Unique player identifier across tournaments
- name: string - Display name for brackets and schedules
- email: string - Primary contact and account linking
- phone: string - SMS notifications and emergency contact
- ranking: number - Optional seeding data for bracket generation
- notes: string - Organizer notes for player management
- userId: string - Optional link to registered user account
- tournamentId: string - Tournament participation reference
- status: PlayerStatus - Active, withdrawn, disqualified for bracket management

```typescript
interface Player {
  id: string;
  name: string;
  email: string;
  phone: string;
  tournamentId: string;
  userId?: string;
  ranking?: number;
  notes?: string;
  status: PlayerStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**
- Belongs-to Tournament (participation)
- Many-to-many with Matches (as participant)
- Optional belongs-to User (if registered account)

## Match

**Purpose:** Individual match entity supporting real-time scoring, multi-device updates, and tournament progression

**Key Attributes:**
- id: string - Unique match identifier for scoring synchronization
- tournamentId: string - Parent tournament reference
- roundNumber: number - Bracket position for progression logic
- matchNumber: number - Display order within round
- player1Id: string - First participant reference
- player2Id: string - Second participant reference (null for bye)
- winnerId: string - Result for bracket progression (null if incomplete)
- scores: MatchScore[] - Game-by-game scoring data
- status: MatchStatus - Pending, in-progress, completed, walkover
- courtAssignment: string - Physical location for organizer coordination
- startTime: timestamp - Actual match start for scheduling
- completedAt: timestamp - Completion time for tournament timeline
- lastUpdatedBy: string - Device/user tracking for conflict resolution

```typescript
interface Match {
  id: string;
  tournamentId: string;
  roundNumber: number;
  matchNumber: number;
  player1Id: string;
  player2Id?: string;
  winnerId?: string;
  scores: MatchScore[];
  status: MatchStatus;
  courtAssignment?: string;
  startTime?: Date;
  completedAt?: Date;
  lastUpdatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**
- Belongs-to Tournament (tournament context)
- Belongs-to two Players (participants)
- Has-many MatchScores (detailed scoring)

## User

**Purpose:** Account management entity supporting multi-role authentication and tournament access control

**Key Attributes:**
- id: string - Firebase Auth UID for authentication
- email: string - Login credential and primary contact
- displayName: string - User-friendly identification
- role: UserRole - Organizer, player, spectator for permission management
- createdAt: timestamp - Account creation for audit
- lastActiveAt: timestamp - Session tracking for security
- preferences: UserPreferences - Notification and display settings
- profile: UserProfile - Optional extended information

```typescript
interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
  lastActiveAt: Date;
  preferences: UserPreferences;
  profile?: UserProfile;
}
```

**Relationships:**
- One-to-many with Tournaments (as organizer)
- One-to-many with Players (if registered participant)
- One-to-many with DeviceTokens (for push notifications)

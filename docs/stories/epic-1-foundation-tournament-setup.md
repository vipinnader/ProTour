# Epic 1: Foundation & Tournament Setup

**Epic Goal:** Establish core project infrastructure, authentication, and basic tournament creation capabilities. Delivers deployable foundation with CSV player import and tournament bracket generation.

**Pilot Readiness:** 30% - Setup workflow testing only  
**Dependencies:** Epic 0 (Foundation Setup) must be completed  
**Estimated Duration:** 3-4 weeks

---

## Story 1.1: Core Data Models & Database Schema

**As a** development team,  
**I want** well-defined data models and database relationships,  
**So that** all features can consistently store and retrieve tournament data.

### Prerequisites
- Epic 0 completed (Firebase configured and accessible)
- Database emulator running locally

### Acceptance Criteria

**Data Model Implementation:**
- **AC1.1.1:** Tournament entity created with required fields:
  - `name` (string, required)
  - `date` (timestamp, required) 
  - `sport` (enum: badminton, tennis, squash, required)
  - `format` (enum: single-elimination, double-elimination, required)
  - `description` (string, optional)
  - `location` (string, optional)
  - `organizerId` (string, required, foreign key)
  - `status` (enum: setup, active, completed, required)

- **AC1.1.2:** Player entity created with required fields:
  - `name` (string, required)
  - `email` (string, required, unique per tournament)
  - `phone` (string, optional)
  - `ranking` (number, optional)
  - `notes` (string, optional)
  - `tournamentId` (string, required, foreign key)

- **AC1.1.3:** Match entity linking tournaments, players, and results:
  - `tournamentId` (string, required, foreign key)
  - `round` (number, required)
  - `matchNumber` (number, required)
  - `player1Id` (string, required, foreign key)
  - `player2Id` (string, optional, null for bye)
  - `winnerId` (string, optional)
  - `score` (object, optional)
  - `status` (enum: pending, in-progress, completed)
  - `startTime` (timestamp, optional)
  - `endTime` (timestamp, optional)

**Database Implementation:**
- **AC1.1.4:** Firestore collections created with proper indexing:
  - `/tournaments` with indexes on organizerId, date, status
  - `/players` with indexes on tournamentId, name, email
  - `/matches` with indexes on tournamentId, round, status

- **AC1.1.5:** Data access layer providing CRUD operations:
  - TournamentService class with create, read, update, delete methods
  - PlayerService class with batch import capabilities
  - MatchService class with bracket management methods

- **AC1.1.6:** Input validation for all entities:
  - Required field validation with clear error messages
  - Email format validation for players
  - Enum value validation for tournaments and matches
  - Foreign key constraint validation

**Database Migration System:**
- **AC1.1.7:** Migration system enabling schema updates:
  - Version tracking for database schema changes
  - Automated migration scripts for development/staging/production
  - Rollback capability for failed migrations

### Technical Implementation Notes
```typescript
// Tournament data model
interface Tournament {
  id: string;
  name: string;
  date: Timestamp;
  sport: 'badminton' | 'tennis' | 'squash';
  format: 'single-elimination' | 'double-elimination';
  description?: string;
  location?: string;
  organizerId: string;
  status: 'setup' | 'active' | 'completed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Definition of Done
- [ ] All data models pass validation tests
- [ ] Database operations work in Firebase emulator
- [ ] Migration system tested with sample data
- [ ] TypeScript interfaces exported and available
- [ ] Unit tests cover all CRUD operations with 90%+ coverage

---

## Story 1.2: User Authentication & Authorization

**As an** organizer,  
**I want** secure account creation and login with session management,  
**So that** I can manage my tournaments privately with confidence in data security.

### Prerequisites
- Story 1.1 completed (User data model available)
- Firebase Authentication configured in Epic 0

### Acceptance Criteria

**Registration System:**
- **AC1.2.1:** Email/password registration implemented:
  - Registration form with email, password, confirm password, name fields
  - Email verification link sent automatically upon registration
  - Account activation required within 24 hours
  - Clear error messages for duplicate emails or invalid data

- **AC1.2.2:** Password security requirements enforced:
  - Minimum 8 characters with mixed case, number, special character
  - Real-time validation feedback during password entry
  - Secure password storage using Firebase Auth
  - Account lockout after 5 failed login attempts within 15 minutes

**Authentication Flow:**
- **AC1.2.3:** Secure login implementation:
  - Email/password login form
  - Remember me functionality with secure session persistence
  - Loading states and error handling for network issues
  - Automatic redirect to dashboard upon successful login

- **AC1.2.4:** Session management:
  - 24-hour session timeout with automatic renewal on activity
  - Seamless re-authentication across mobile app restart
  - Secure logout clearing all local authentication data
  - Cross-device session management (login on new device prompts)

**Authorization System:**
- **AC1.2.5:** Role-based access control:
  - User roles: organizer, player, spectator (stored in user profile)
  - Role assignment during registration (default: organizer)
  - Tournament-specific permissions (organizer can only edit own tournaments)
  - API endpoint protection with role validation

- **AC1.2.6:** Account management features:
  - Profile editing (name, email, contact information)
  - Password change with current password verification
  - Account deletion with data retention warning
  - Email change with re-verification requirement

**Password Recovery:**
- **AC1.2.7:** Password reset functionality:
  - "Forgot Password" link sends secure reset email
  - Reset token valid for 1 hour only
  - Password reset form with new password confirmation
  - Notification to user when password is successfully changed

### Technical Implementation
```typescript
// Authentication service implementation
class AuthService {
  async register(email: string, password: string, name: string): Promise<User>
  async login(email: string, password: string): Promise<User>
  async logout(): Promise<void>
  async resetPassword(email: string): Promise<void>
  async updateProfile(updates: Partial<UserProfile>): Promise<void>
  getCurrentUser(): User | null
  onAuthStateChanged(callback: (user: User | null) => void): void
}
```

### Definition of Done
- [ ] Registration, login, logout work on both iOS and Android
- [ ] Email verification system working with test emails
- [ ] Password reset functionality tested end-to-end
- [ ] Role-based access control prevents unauthorized actions
- [ ] Authentication state persists across app restarts
- [ ] All authentication flows tested with network interruptions

---

## Story 1.3: Tournament Creation & Basic Management

**As an** organizer,  
**I want** to create and configure tournaments with comprehensive settings,  
**So that** I can set up tournaments matching my specific requirements.

### Prerequisites
- Story 1.2 completed (Authentication working)
- User must be logged in with organizer role

### Acceptance Criteria

**Tournament Creation Form:**
- **AC1.3.1:** Tournament creation interface implemented:
  - Form fields: tournament name (required), date picker (required)
  - Sport selection dropdown: Badminton, Tennis, Squash
  - Optional fields: location, description
  - Form validation with real-time error feedback
  - Save as draft functionality for incomplete tournaments

- **AC1.3.2:** Tournament format configuration:
  - Format selection: Single Elimination, Double Elimination
  - Match format options: Best of 1, Best of 3, Best of 5
  - Number of players constraint (4 minimum, 64 maximum)
  - Tournament rules and scoring system selection

**Tournament Management:**
- **AC1.3.3:** Tournament visibility and access controls:
  - Public/Private tournament toggle
  - Tournament code generation for participant access (6-digit alphanumeric)
  - QR code generation for easy sharing
  - Tournament URL sharing functionality

- **AC1.3.4:** Tournament editing capabilities:
  - Edit tournament details (name, date, location, description)
  - Format changes only allowed before bracket generation
  - Audit trail logging all tournament modifications
  - Version history showing what changed and when

**Tournament Dashboard:**
- **AC1.3.5:** Organizer tournament list view:
  - Grid/list view of tournaments with status indicators
  - Filter by status: Setup (red), Active (green), Completed (blue)
  - Sort by: Date created, Tournament date, Name, Status
  - Last modified timestamps and quick actions (edit, view, delete)
  - Search functionality by tournament name or location

- **AC1.3.6:** Tournament deletion with safeguards:
  - Confirmation dialog explaining data loss implications
  - Cannot delete tournaments with active matches
  - Soft delete with 30-day recovery period
  - Archive completed tournaments instead of deletion

### UI/UX Implementation
```typescript
// Tournament creation form component
interface TournamentFormData {
  name: string;
  date: Date;
  sport: 'badminton' | 'tennis' | 'squash';
  format: 'single-elimination' | 'double-elimination';
  matchFormat: 'best-of-1' | 'best-of-3' | 'best-of-5';
  location?: string;
  description?: string;
  isPublic: boolean;
}
```

### Definition of Done
- [ ] Tournament creation form works smoothly on mobile devices
- [ ] Tournament list loads quickly with proper pagination
- [ ] Tournament editing preserves data integrity
- [ ] Tournament codes and QR codes generate correctly
- [ ] Search and filtering work with large tournament lists
- [ ] Deletion safeguards prevent accidental data loss

---

## Story 1.4: CSV Player Import & Validation

**As an** organizer,  
**I want** to upload and validate player registration data via CSV with robust error handling,  
**So that** I can efficiently import up to 100 participants with confidence in data quality.

### Prerequisites
- Story 1.3 completed (Tournament creation working)
- Tournament must exist and be in 'setup' status

### Acceptance Criteria

**CSV Upload Interface:**
- **AC1.4.1:** File upload functionality:
  - Drag-and-drop file upload area with visual feedback
  - File browser fallback for devices without drag-and-drop
  - File type validation (only .csv, .txt files accepted)
  - File size limit of 2MB with clear error message
  - Progress indicator during file processing

- **AC1.4.2:** CSV processing and validation:
  - Parse CSV data within 5 seconds for files up to 100 players
  - Support for common CSV formats (comma, semicolon, tab delimited)
  - Header row detection and field mapping
  - Encoding detection (UTF-8, ISO-8859-1) for international names
  - Error reporting with specific row numbers and correction suggestions

**Data Validation System:**
- **AC1.4.3:** Required field validation:
  - Player name (required, minimum 2 characters)
  - Contact information (email OR phone required)
  - Clear marking of optional fields (ranking, notes, emergency contact)
  - Validation error messages: "Row 15: Email format invalid, expected user@domain.com"

- **AC1.4.4:** Duplicate detection and resolution:
  - Detect duplicates using name + email combination
  - Three resolution options for each duplicate:
    * Merge: Combine information from both entries
    * Skip: Ignore the duplicate entry
    * Rename: Add suffix like "John Smith (2)"
  - Batch duplicate resolution for multiple conflicts

**Import Preview & Confirmation:**
- **AC1.4.5:** Data preview interface:
  - Table showing all imported player data
  - Inline editing capability for correcting errors
  - Column sorting and basic filtering
  - Import statistics: X valid players, Y errors, Z duplicates
  - Ability to remove players before final import

- **AC1.4.6:** Template and guidance system:
  - CSV template download with example data
  - Field descriptions and formatting guidelines
  - Sample tournament data for testing
  - Help documentation with common import issues

**Import Process Management:**
- **AC1.4.7:** Robust import execution:
  - Progress indicator showing import status
  - Ability to cancel import operation mid-process
  - Network interruption recovery (resume from last successful row)
  - Final confirmation before committing data to database
  - Success summary with player count and any warnings

### CSV Template Format
```csv
Name,Email,Phone,Ranking,Notes
John Smith,john@email.com,+91-9876543210,1500,Previous champion
Jane Doe,jane@email.com,+91-8765432109,,First time player
```

### Definition of Done
- [ ] CSV import handles 100+ players within 5 seconds
- [ ] All validation errors provide clear correction guidance
- [ ] Duplicate resolution works for complex scenarios
- [ ] Import process recovers gracefully from network issues
- [ ] Template download works and provides good guidance
- [ ] Import statistics are accurate and helpful

---

## Story 1.5: Tournament Bracket Generation & Visualization

**As an** organizer,  
**I want** automatic bracket generation with intelligent bye placement and manual editing capabilities,  
**So that** I can create fair tournament structures for any number of players.

### Prerequisites
- Story 1.4 completed (Players imported into tournament)
- Tournament must have at least 4 players

### Acceptance Criteria

**Basic Bracket Generation:**
- **AC1.5.1:** Single-elimination bracket algorithm:
  - Support for 4, 8, 16, 32, 64 players (power of 2)
  - Generation completes within 5 seconds for any supported size
  - Proper bracket tree structure with correct match progression
  - Match numbering system that makes sense to organizers

- **AC1.5.2:** Intelligent bye placement:
  - Automatic calculation for non-power-of-2 player counts
  - Optimal bye distribution (e.g., 15 players = 1 bye in round 1)
  - Byes placed to minimize impact on bracket balance
  - Clear visual indication of bye matches in bracket display

**Seeding and Player Placement:**
- **AC1.5.3:** Seeding options:
  - Random seeding as default (reproducible with tournament seed)
  - Ranked seeding using imported player ranking data
  - Manual seeding with drag-and-drop player positioning
  - Tie-breaking rules for players with same ranking

- **AC1.5.4:** Bracket editing capabilities:
  - Drag-and-drop player position changes before tournament starts
  - Position swap interface for mobile-friendly editing
  - Manual bye assignment with bracket structure validation
  - Undo/redo functionality for bracket modifications

**Bracket Visualization:**
- **AC1.5.5:** Interactive bracket display:
  - Complete tournament tree showing all rounds and matches
  - Responsive design working on mobile, tablet, and desktop
  - Zoom and pan functionality for large tournaments
  - Clear visual indicators for completed/pending matches

- **AC1.5.6:** Bracket export and sharing:
  - PDF export suitable for printing and sharing
  - PNG/JPG image export for social media
  - Shareable bracket URL for spectators
  - Print-optimized layout with proper scaling

**Advanced Bracket Features:**
- **AC1.5.7:** Bracket validation and error handling:
  - Prevent impossible match configurations
  - Validation before bracket finalization
  - Warning for potential bracket issues
  - Edge case handling (0 players, 1 player, >64 players)

- **AC1.5.8:** Bracket regeneration safeguards:
  - Confirmation dialog warning about existing matches
  - Option to preserve completed matches during regeneration
  - Backup bracket configuration before changes
  - Audit trail of bracket modifications

### Bracket Algorithm Implementation
```typescript
interface BracketGenerator {
  generateSingleElimination(players: Player[]): Match[];
  calculateByes(playerCount: number): number;
  assignByes(matches: Match[], byeCount: number): Match[];
  validateBracket(matches: Match[]): BracketValidation;
  exportBracket(tournament: Tournament, format: 'pdf' | 'png'): Promise<Buffer>;
}
```

### Definition of Done
- [ ] Bracket generation works for all supported player counts
- [ ] Bye placement creates balanced, fair brackets  
- [ ] Manual editing preserves bracket structure integrity
- [ ] Bracket visualization is clear and easy to understand
- [ ] Export functionality creates high-quality outputs
- [ ] Edge cases are handled gracefully with helpful messages

---

## Epic 1 Integration Story: End-to-End Tournament Setup Flow

**As an** organizer,  
**I want** to complete the entire tournament setup process seamlessly,  
**So that** I can go from account creation to ready-to-run tournament in under 30 minutes.

### Prerequisites
- All Epic 1 stories completed and individually tested

### Acceptance Criteria

**Complete Flow Integration:**
- **AC1.I.1:** End-to-end tournament setup workflow:
  1. Account registration with email verification
  2. Tournament creation with proper configuration
  3. CSV player import with validation and error correction
  4. Bracket generation with optional manual adjustments
  5. Tournament ready for match management (Epic 2A)

**Flow Testing:**
- **AC1.I.2:** User experience optimization:
  - Average setup time under 30 minutes for experienced user
  - Clear progress indicators throughout the process
  - Ability to save and resume setup at any stage
  - Helpful guidance and tips at each step

**Data Integrity:**
- **AC1.I.3:** Cross-story data consistency:
  - Tournament data persists correctly across all operations
  - Player data maintains integrity through import and bracket generation
  - User session maintained throughout entire setup process
  - All audit trails and logs working correctly

### Definition of Done
- [ ] Complete tournament setup tested with real tournament data
- [ ] Setup process is intuitive for first-time users
- [ ] Data integrity maintained under various error conditions
- [ ] Performance acceptable on mid-range mobile devices
- [ ] Ready for Epic 2A development (tournament management features)

---

## Epic 1 Success Criteria

**Epic 1 is complete when:**
1. ✅ Organizers can create accounts and log in securely
2. ✅ Tournament creation and management works smoothly
3. ✅ CSV import handles real player data without issues
4. ✅ Bracket generation creates fair, balanced tournaments
5. ✅ Complete setup flow tested end-to-end
6. ✅ All data models support future epic requirements
7. ✅ 30% pilot readiness achieved (tournament setup workflow)

**Ready for Epic 2A when:**
- Tournament creation and bracket generation work reliably
- Data models support match management and scoring
- Authentication and authorization ready for multiple user roles
- Performance acceptable for tournament-day usage
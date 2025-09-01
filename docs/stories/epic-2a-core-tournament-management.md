# Epic 2A: Core Tournament Management

**Epic Goal:** Enable organizers to manage active tournaments through intuitive score entry and bracket updates, delivering the essential single-device workflow for running tournaments from start to completion.

**Pilot Readiness:** 60% - Basic organizer efficiency testing  
**Dependencies:** Epic 1 (Tournament Setup) must be completed  
**Estimated Duration:** 4-5 weeks

---

## Story 2A.1: Match Management & Scoring Interface

**As an** organizer,  
**I want** an intuitive mobile interface for entering match scores and updating results,  
**So that** I can efficiently manage tournament progress during active events.

### Prerequisites
- Epic 1 completed (Tournament creation and bracket generation working)
- Tournament must be in 'active' status with generated bracket
- Matches must exist in database with proper player assignments

### Acceptance Criteria

**Match List Interface:**
- **AC2A.1.1:** Match list view implemented with filtering and status display:
  - Current round matches prominently displayed at top
  - Match status indicators: Pending (gray), In Progress (yellow), Completed (green)
  - Player names, court assignments, and estimated start times
  - Quick filter buttons: All Matches, Current Round, In Progress, Completed
  - Refresh-to-update functionality with loading indicators

- **AC2A.1.2:** Court assignment system:
  - Drag-and-drop match assignment to available courts
  - Court status tracking (available, occupied, maintenance)
  - Time-based court scheduling with conflict detection
  - Court capacity management and queue system

**Score Entry Interface:**
- **AC2A.1.3:** Mobile-optimized score entry with large touch targets:
  - Minimum 48px button size for accessibility
  - Score increment/decrement buttons with +1, +5 quick options
  - Game-by-game score tracking for best-of-3/best-of-5 formats
  - Serve indicator and current game highlighting
  - Confirmation dialog before saving final results

- **AC2A.1.4:** Score validation and business rule enforcement:
  - Impossible score detection (e.g., 22-20 in badminton without deuce continuation)
  - Sport-specific scoring rules (21 points badminton, tennis scoring, etc.)
  - Match format validation ensuring proper game completion
  - Walkover and forfeit handling with reason codes

**Data Persistence & Performance:**
- **AC2A.1.5:** Real-time score updates with optimistic UI:
  - UI updates immediately on score entry (optimistic update)
  - Background sync to database within 2 seconds
  - Network failure handling with retry mechanism
  - Conflict resolution for simultaneous score entries

- **AC2A.1.6:** Score correction and audit trail:
  - Score editing available for 15 minutes after completion
  - Correction reason required for audit purposes
  - Change history showing original and corrected scores
  - Organizer authentication required for score modifications

### Technical Implementation
```typescript
// Match scoring service
interface MatchScoreService {
  updateScore(matchId: string, gameScore: GameScore): Promise<Match>
  validateScore(score: GameScore, format: MatchFormat): ValidationResult
  correctScore(matchId: string, correction: ScoreCorrection): Promise<Match>
  getMatchHistory(matchId: string): Promise<ScoreHistory[]>
}

interface GameScore {
  player1Score: number
  player2Score: number
  gameNumber: number
  isComplete: boolean
  winnerPlayerId?: string
}
```

### Definition of Done
- [ ] Score entry works reliably on both iOS and Android
- [ ] All sport-specific scoring rules properly enforced
- [ ] Score corrections work with proper audit trail
- [ ] Interface remains responsive during peak tournament usage
- [ ] Offline score entry queues properly for sync when online
- [ ] Score validation prevents impossible game states

---

## Story 2A.2: Live Bracket Updates & Progression

**As an** organizer,  
**I want** automatic bracket progression when matches complete,  
**So that** players immediately know their next matches and tournament flow continues smoothly.

### Prerequisites
- Story 2A.1 completed (Score entry working)
- Bracket visualization component from Epic 1 available
- Real-time data sync infrastructure functional

### Acceptance Criteria

**Automatic Bracket Progression:**
- **AC2A.2.1:** Winner advancement algorithm:
  - Automatic winner determination upon match completion
  - Winner advancement to next round within 3 seconds
  - Bye handling in subsequent rounds
  - Error handling for incomplete bracket scenarios

- **AC2A.2.2:** Round progression logic:
  - Next round generation when all current round matches complete
  - Proper opponent pairing following bracket structure
  - Semi-final and final match scheduling
  - Tournament completion detection and winner announcement

**Visual Bracket Updates:**
- **AC2A.2.3:** Real-time bracket visualization:
  - Live score updates appearing in bracket view
  - Color-coded match status (pending, active, completed)
  - Winner highlighting with smooth animations
  - Current round emphasis with visual indicators

- **AC2A.2.4:** Bracket navigation and interaction:
  - Zoom and pan for large tournaments (32+ players)
  - Match detail overlay on tap/click
  - Player path highlighting through tournament
  - Print-friendly bracket view option

**Edge Case Handling:**
- **AC2A.2.5:** Special match situations:
  - Walkover handling with automatic advancement
  - Player withdrawal with bracket adjustment
  - Disqualification processing and opponent advancement
  - Medical timeout and match postponement

- **AC2A.2.6:** Tournament state recovery:
  - Bracket state persistence across app restarts
  - Recovery from network interruptions during updates
  - Consistency checks on bracket state loading
  - Emergency bracket reset with confirmation dialogs

### Algorithm Implementation
```typescript
// Bracket progression service
class BracketProgressionService {
  async advanceWinner(matchId: string, winnerId: string): Promise<void> {
    const match = await this.getMatch(matchId)
    const nextMatch = await this.findNextMatch(match.tournamentId, match.round + 1)
    
    if (nextMatch) {
      await this.assignPlayerToMatch(nextMatch.id, winnerId, match.position)
    }
    
    await this.checkRoundCompletion(match.tournamentId, match.round)
  }
  
  private async checkRoundCompletion(tournamentId: string, round: number): Promise<void> {
    const roundMatches = await this.getRoundMatches(tournamentId, round)
    const allComplete = roundMatches.every(m => m.status === 'completed')
    
    if (allComplete) {
      await this.generateNextRound(tournamentId, round + 1)
    }
  }
}
```

### Definition of Done
- [ ] Bracket progression works correctly for all tournament sizes (4-64 players)
- [ ] Visual updates appear within 3 seconds of score completion
- [ ] Edge cases (walkovers, withdrawals) handled gracefully
- [ ] Bracket state remains consistent across app restarts
- [ ] Tournament winners properly identified and announced
- [ ] Large bracket navigation (32+ players) performs smoothly

---

## Story 2A.3: Tournament Dashboard & Overview

**As an** organizer,  
**I want** a comprehensive tournament dashboard showing real-time status and progress,  
**So that** I can monitor multiple aspects of the tournament at a glance and take appropriate actions.

### Prerequisites
- Stories 2A.1 and 2A.2 completed (Scoring and bracket progression)
- Tournament analytics data being collected
- Push notification system from Epic 0 functional

### Acceptance Criteria

**Dashboard Overview:**
- **AC2A.3.1:** Real-time tournament metrics:
  - Current round progress (e.g., "Round 2: 6/8 matches completed")
  - Estimated tournament completion time based on average match duration
  - Active courts status and utilization
  - Players waiting for next matches count
  - Tournament timeline with milestone indicators

- **AC2A.3.2:** Quick action interface:
  - Single-tap actions: "Start Next Round", "Record Walkover", "Pause Tournament"
  - Emergency actions: "Tournament Delay", "Court Issue", "Medical Emergency"
  - Bulk operations: "Notify All Players", "Print Updated Brackets"
  - Settings access: "Tournament Rules", "Court Management", "Export Data"

**Player Management Dashboard:**
- **AC2A.3.3:** Player status tracking:
  - Active players list with current match assignments
  - Eliminated players with elimination round information
  - Player withdrawals with timestamp and reason
  - Late arrivals and check-in status management
  - Player contact information quick access

- **AC2A.3.4:** Match scheduling overview:
  - Current matches in progress with live timers
  - Next matches queue with estimated start times
  - Court availability and scheduling conflicts
  - Break periods and tournament pause status

**Tournament Timeline & History:**
- **AC2A.3.5:** Progress tracking:
  - Visual timeline showing completed rounds and matches
  - Average match duration tracking and predictions
  - Delay incidents and resolution times
  - Tournament milestones (quarterfinals, semifinals, finals)

- **AC2A.3.6:** Alert and notification system:
  - Critical issue alerts (scoring errors, system problems)
  - Performance warnings (slow matches, court delays)
  - Celebration notifications (tournament milestones)
  - Auto-refresh every 30 seconds with manual refresh option

### Dashboard Components
```typescript
// Tournament dashboard data interface
interface TournamentDashboard {
  overview: {
    currentRound: number
    totalRounds: number
    matchesCompleted: number
    totalMatches: number
    estimatedCompletion: Date
    tournamentStatus: 'setup' | 'active' | 'paused' | 'completed'
  }
  
  courts: {
    id: string
    name: string
    status: 'available' | 'occupied' | 'maintenance'
    currentMatch?: Match
    nextMatch?: Match
  }[]
  
  recentActivity: {
    timestamp: Date
    type: 'match_completed' | 'round_advanced' | 'player_withdrew'
    description: string
    matchId?: string
  }[]
  
  alerts: {
    id: string
    level: 'info' | 'warning' | 'error'
    message: string
    timestamp: Date
    acknowledged: boolean
  }[]
}
```

### Definition of Done
- [ ] Dashboard loads within 2 seconds and updates automatically
- [ ] All quick actions work reliably without UI freezing
- [ ] Player status tracking accurate and real-time
- [ ] Tournament timeline provides useful progress insights
- [ ] Alert system notifies of issues without being overwhelming
- [ ] Dashboard remains functional during network connectivity issues

---

## Story 2A.4: Basic Tournament Communication

**As an** organizer,  
**I want** simple communication tools to update participants about tournament progress,  
**So that** players stay informed about their match schedules and tournament status.

### Prerequisites
- Push notification system from Epic 0 configured
- Player contact information collected during registration
- SMS fallback system from external services guide set up

### Acceptance Criteria

**Announcement System:**
- **AC2A.4.1:** Tournament-wide communications:
  - Broadcast announcement interface with rich text support
  - Pre-defined message templates (delay, break, schedule change)
  - Immediate delivery via push notifications
  - SMS fallback for users without app or connectivity issues
  - Announcement delivery confirmation and read receipts

- **AC2A.4.2:** Match-specific notifications:
  - "Match Ready" notifications to specific players
  - Court assignment notifications with directions
  - Match delay notifications with updated timing
  - Audio/vibration alerts for urgent match calls
  - Customizable notification timing (15min, 5min, now)

**Tournament Information Display:**
- **AC2A.4.3:** Public information board:
  - Current round status and next round timing
  - Court assignments for upcoming matches
  - Break schedules and tournament timeline
  - Organizer contact information for issues
  - Emergency contact numbers and procedures

- **AC2A.4.4:** Status update system:
  - Tournament delay announcements with reason and new timing
  - Schedule changes with affected players highlighted
  - Weather or venue-related updates
  - Prize ceremony and closing announcements
  - Automatic timestamp and organizer identification

**Communication History & Management:**
- **AC2A.4.5:** Message tracking:
  - Complete history of all tournament announcements
  - Search functionality for finding specific communications
  - Message delivery status tracking
  - Failed delivery retry mechanism
  - Communication analytics (open rates, response times)

- **AC2A.4.6:** Emergency communication:
  - Priority notification system bypassing normal settings
  - Emergency broadcast for urgent situations
  - Medical emergency communication protocols
  - Evacuation or safety announcements
  - Direct contact with local emergency services integration

### Communication Service Implementation
```typescript
// Tournament communication service
interface TournamentCommService {
  sendBroadcast(tournamentId: string, message: AnnouncementMessage): Promise<DeliveryReport>
  notifyMatch(matchId: string, notificationType: MatchNotification): Promise<void>
  sendEmergency(tournamentId: string, emergency: EmergencyMessage): Promise<void>
  getCommHistory(tournamentId: string, limit?: number): Promise<CommunicationLog[]>
}

interface AnnouncementMessage {
  title: string
  body: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  channels: ('push' | 'sms' | 'email')[]
  recipients?: 'all' | 'players' | 'spectators' | string[]
}
```

### Definition of Done
- [ ] Broadcast messages reach all tournament participants within 30 seconds
- [ ] Match notifications successfully reduce organizer interruptions by 50%
- [ ] SMS fallback works for users without app connectivity
- [ ] Emergency communications take priority over regular notifications
- [ ] Message history provides complete audit trail
- [ ] Communication delivery rates exceed 95% for critical messages

---

## Story 2A.5: Tournament Data Management & Recovery

**As an** organizer,  
**I want** reliable data persistence and recovery capabilities,  
**So that** tournament progress is never lost due to technical issues or device problems.

### Prerequisites
- Firebase offline persistence from Epic 0 configured
- Backup and recovery systems established
- Tournament state management implemented

### Acceptance Criteria

**Data Persistence & Backup:**
- **AC2A.5.1:** Automatic tournament state backup:
  - Real-time backup after every score entry and bracket update
  - Local device backup with encryption
  - Cloud backup with multi-region redundancy
  - Backup frequency: Every 30 seconds during active tournament
  - Backup retention: 30 days for completed tournaments

- **AC2A.5.2:** Tournament data export:
  - Complete tournament export in multiple formats (CSV, JSON, PDF)
  - Player statistics and match results compilation
  - Bracket progression history and timeline
  - Communication log and announcement history
  - Export scheduling and automated report generation

**Recovery & Restoration:**
- **AC2A.5.3:** Tournament state recovery:
  - Automatic recovery on app restart with last known good state
  - Cross-device recovery (organizer switches devices mid-tournament)
  - Network interruption recovery without data loss
  - Partial tournament recovery from any backup point
  - Recovery validation ensuring data integrity

- **AC2A.5.4:** Data consistency checks:
  - Startup validation detecting bracket inconsistencies
  - Score validation ensuring mathematical correctness
  - Player status consistency across all tournament data
  - Match progression validation against tournament rules
  - Automatic repair of minor inconsistencies

**Archival & Historical Data:**
- **AC2A.5.5:** Tournament archival system:
  - Completed tournament archival with full data preservation
  - Historical tournament search and retrieval
  - Player performance tracking across multiple tournaments
  - Club statistics and trends analysis
  - Data privacy compliance for archived tournaments

- **AC2A.5.6:** Emergency recovery procedures:
  - Manual backup file import for disaster recovery
  - Tournament recreation from partial data
  - Emergency contact procedures for data recovery assistance
  - Cloud restore from any point-in-time backup
  - Tournament rollback to previous stable state

### Data Management Architecture
```typescript
// Tournament data management service
class TournamentDataManager {
  async createBackup(tournamentId: string): Promise<BackupInfo> {
    const tournament = await this.exportTournamentData(tournamentId)
    const backup = await this.encryptAndStore(tournament)
    return this.saveBackupMetadata(backup)
  }
  
  async recoverFromBackup(backupId: string): Promise<Tournament> {
    const backup = await this.retrieveBackup(backupId)
    const tournament = await this.decryptAndValidate(backup)
    return this.restoreTournamentState(tournament)
  }
  
  async validateTournamentIntegrity(tournamentId: string): Promise<ValidationReport> {
    const tournament = await this.getTournament(tournamentId)
    return this.runIntegrityChecks(tournament)
  }
}
```

### Definition of Done
- [ ] Tournament data never lost even during app crashes or device failures
- [ ] Recovery from backup completes within 60 seconds
- [ ] Data export generates complete tournament records
- [ ] Cross-device recovery works seamlessly
- [ ] Data integrity checks prevent corrupted tournament states
- [ ] Emergency recovery procedures tested and documented

---

## Epic 2A Integration Story: Complete Tournament Management Workflow

**As an** organizer,  
**I want** to manage an entire tournament from start to finish using only my mobile device,  
**So that** I can deliver a professional tournament experience while reducing my administrative burden by 50%.

### Prerequisites
- All Epic 2A stories completed and individually tested
- Epic 1 tournament setup functionality working
- Test tournament data prepared for realistic workflow testing

### Acceptance Criteria

**Complete Tournament Flow:**
- **AC2A.I.1:** End-to-end tournament execution:
  1. Start tournament from completed setup (Epic 1)
  2. Open matches for score entry and court assignment
  3. Record match results with automatic bracket progression
  4. Manage player communications and announcements
  5. Handle tournament issues (delays, withdrawals, protests)
  6. Complete tournament with winner announcement and data export

**Organizer Efficiency Measurement:**
- **AC2A.I.2:** Administrative burden reduction:
  - Pre-Epic 2A baseline: Measure typical tournament admin time
  - Post-Epic 2A measurement: Track actual time savings
  - Target: 50% reduction in organizer administrative tasks
  - Specific time savings: Player questions, bracket updates, score tracking
  - Efficiency metrics: Matches per hour, error rate reduction

**Tournament Quality Assurance:**
- **AC2A.I.3:** Professional tournament delivery:
  - Zero data loss during complete tournament execution
  - Match results accuracy verified by participants
  - Tournament timeline adherence within 15% of estimates
  - Player satisfaction survey results (NPS >0)
  - Tournament completion without requiring desktop backup tools

### Definition of Done
- [ ] Complete tournament tested with 32 players end-to-end
- [ ] Organizer administrative time reduced by 50% measured against baseline
- [ ] Tournament quality maintains professional standards throughout
- [ ] All Epic 2A features integrate seamlessly without conflicts
- [ ] Ready for Epic 2B development (multi-device functionality)
- [ ] 60% pilot readiness achieved (basic organizer workflow)

---

## Epic 2A Success Criteria

**Epic 2A is complete when:**
1. ✅ Organizers can manage live tournaments entirely from mobile devices
2. ✅ Score entry and bracket progression work reliably during tournament stress
3. ✅ Tournament communication reduces player interruptions significantly
4. ✅ Data persistence ensures no tournament information is lost
5. ✅ Complete tournament workflow tested with realistic player counts
6. ✅ Administrative efficiency improved by measurable amount
7. ✅ 60% pilot readiness achieved (single-device tournament management)

**Ready for Epic 2B when:**
- Single-device tournament management works flawlessly
- Data models support multi-device access and conflict resolution
- Real-time updates architecture ready for expansion
- Performance acceptable for tournament-day stress conditions
# Epic 2A: Match Management & Live Scoring

**Epic Goal:** Enable tournament organizers and referees to manage live matches with real-time scoring, court assignments, and automatic bracket progression. Delivers complete tournament execution capabilities.

**Pilot Readiness:** 60% - Live tournament management ready for testing  
**Dependencies:** Epic 1 (Foundation & Tournament Setup) must be completed  
**Estimated Duration:** 2-3 weeks

---

## Story 2A.1: Match Management Interface

**As a** tournament organizer,  
**I want** intuitive match management tools with court assignment and scheduling,  
**So that** I can efficiently run tournament day operations with clear visibility of all matches.

### Prerequisites
- Epic 1 completed (Tournament bracket generated)
- Tournament must be in 'active' status
- Matches exist from bracket generation

### Acceptance Criteria

**Match Dashboard:**
- **AC2A.1.1:** Tournament match overview screen implemented:
  - Grid view showing all matches organized by round
  - Match status indicators (pending, in-progress, completed)
  - Quick filtering by round, court, or status
  - Search functionality by player names
  - Real-time updates when match status changes

- **AC2A.1.2:** Match detail view with comprehensive information:
  - Player names with seed positions and photos
  - Match number, round, and bracket position
  - Court assignment and estimated start time
  - Current score display (if match is active)
  - Match history and previous encounter records
  - Referee assignment (if applicable)

**Court Management:**
- **AC2A.1.3:** Court assignment system:
  - Visual court layout showing availability status
  - Drag-and-drop match assignment to courts
  - Court conflict detection and warnings
  - Estimated match duration tracking
  - Queue system for upcoming matches per court

- **AC2A.1.4:** Schedule optimization features:
  - Automatic court assignment recommendations
  - Match time estimates based on format and player history
  - Rest time validation between player matches
  - Parallel match scheduling to minimize tournament duration

**Match Control:**
- **AC2A.1.5:** Match lifecycle management:
  - Start match button with validation checks
  - Pause/resume match functionality
  - Match cancellation with bracket impact warning
  - Walkover handling with automatic progression
  - Match result entry and validation

### Technical Implementation
```typescript
interface MatchManagement {
  getMatchOverview(tournamentId: string): Promise<MatchOverview>;
  assignCourt(matchId: string, court: string): Promise<void>;
  startMatch(matchId: string): Promise<void>;
  pauseMatch(matchId: string): Promise<void>;
  cancelMatch(matchId: string, reason: string): Promise<void>;
  processWalkover(matchId: string, winnerId: string): Promise<void>;
}
```

### Definition of Done
- [ ] Match dashboard loads and updates in real-time
- [ ] Court assignment works smoothly with conflict detection
- [ ] Match start/pause/complete flows work correctly
- [ ] Schedule optimization provides helpful recommendations
- [ ] All match state changes properly update the bracket
- [ ] Performance acceptable with 30+ concurrent matches

---

## Story 2A.2: Real-time Score Entry & Display

**As a** tournament referee or organizer,  
**I want** an intuitive scoring interface with real-time updates,  
**So that** players, spectators, and officials can follow match progress instantly.

### Prerequisites
- Story 2A.1 completed (Match management working)
- Match must be in 'in-progress' status

### Acceptance Criteria

**Score Entry Interface:**
- **AC2A.2.1:** Responsive scoring interface implemented:
  - Large, touch-friendly buttons for score adjustment
  - Support for best-of-1, best-of-3, and best-of-5 formats
  - Undo/redo functionality for score corrections
  - Rapid score entry mode for quick updates
  - Score validation preventing impossible scores

- **AC2A.2.2:** Sport-specific scoring rules:
  - Badminton: Rally point system to 21 (win by 2, cap at 30)
  - Tennis: Traditional scoring (15, 30, 40, game) with tiebreaks
  - Squash: Point-a-rally to 11 (win by 2, cap at 15)
  - Deuce and advantage handling for applicable sports
  - Set/game win conditions automatically calculated

**Real-time Score Display:**
- **AC2A.2.3:** Live scoreboard implementation:
  - Large, readable score display optimized for mobile
  - Current set/game scores with set history
  - Serve indicator (for applicable sports)
  - Match timer and set duration tracking
  - Player statistics (aces, errors, winners where applicable)

- **AC2A.2.4:** Spectator score viewing:
  - Public score display accessible via tournament code
  - Auto-refresh score updates every 5 seconds
  - Match timeline showing key moments
  - QR code generation for easy score sharing
  - Previous set scores and match statistics

**Score Synchronization:**
- **AC2A.2.5:** Real-time data synchronization:
  - Score updates propagate to all connected devices within 3 seconds
  - Offline score entry with sync when connection restored
  - Conflict resolution for simultaneous score updates
  - Score history preservation and audit trail
  - Automatic bracket updates when match completes

### Technical Implementation
```typescript
interface ScoreEntry {
  updateScore(matchId: string, player: 'player1' | 'player2', points: number): Promise<void>;
  undoLastUpdate(matchId: string): Promise<void>;
  getScoreHistory(matchId: string): Promise<ScoreUpdate[]>;
  subscribeToScoreUpdates(matchId: string, callback: (score: MatchScore) => void): void;
}
```

### Definition of Done
- [ ] Score entry works smoothly on mobile and tablet
- [ ] All sport-specific scoring rules implemented correctly
- [ ] Real-time updates work reliably across multiple devices
- [ ] Score display is clear and readable from distance
- [ ] Offline functionality handles network interruptions
- [ ] Score audit trail maintains complete match history

---

## Story 2A.3: Tournament Progress Monitoring

**As a** tournament organizer,  
**I want** comprehensive tournament progress tracking with analytics,  
**So that** I can monitor tournament health, identify bottlenecks, and communicate status to participants.

### Prerequisites
- Story 2A.2 completed (Score entry working)
- Multiple matches in progress or completed

### Acceptance Criteria

**Progress Dashboard:**
- **AC2A.3.1:** Tournament overview dashboard implemented:
  - Overall tournament completion percentage
  - Round-by-round progress visualization
  - Active matches count and court utilization
  - Estimated tournament completion time
  - Player advancement tracking through bracket

- **AC2A.3.2:** Performance analytics:
  - Average match duration by sport and round
  - Court efficiency and utilization statistics
  - Peak activity periods and bottleneck identification
  - Player rest time between matches
  - Tournament timeline with key milestones

**Communication Tools:**
- **AC2A.3.3:** Participant communication system:
  - Automated notifications for upcoming matches
  - SMS/email alerts for match start times
  - Player check-in system with arrival tracking
  - Public announcements and updates broadcast
  - Tournament bracket sharing and embedding

- **AC2A.3.4:** Real-time tournament feed:
  - Live activity stream showing recent results
  - Notable matches and upset highlights
  - Tournament statistics and records
  - Social sharing integration for results
  - Participant testimonials and photos

**Data Export & Reporting:**
- **AC2A.3.5:** Tournament reporting system:
  - Complete tournament results export (PDF, CSV, JSON)
  - Player performance reports and statistics
  - Tournament operations report with insights
  - Certificate generation for winners and participants
  - Tournament archive with searchable history

### Technical Implementation
```typescript
interface TournamentProgress {
  getTournamentOverview(tournamentId: string): Promise<TournamentOverview>;
  getPerformanceAnalytics(tournamentId: string): Promise<PerformanceMetrics>;
  sendParticipantNotifications(tournamentId: string, message: string): Promise<void>;
  exportTournamentResults(tournamentId: string, format: 'pdf' | 'csv' | 'json'): Promise<Buffer>;
}
```

### Definition of Done
- [ ] Progress dashboard provides clear tournament status
- [ ] Analytics help organizers identify and resolve bottlenecks
- [ ] Communication tools keep participants informed
- [ ] Export functionality generates professional reports
- [ ] Real-time feed engages spectators and participants
- [ ] Data accuracy maintained throughout tournament lifecycle

---

## Story 2A.4: Mobile-Optimized Referee Tools

**As a** tournament referee or court official,  
**I want** dedicated mobile tools for match officiation,  
**So that** I can efficiently manage matches courtside with all necessary information at my fingertips.

### Prerequisites
- Story 2A.3 completed (Tournament monitoring working)
- User must have referee role assignment

### Acceptance Criteria

**Referee Match Interface:**
- **AC2A.4.1:** Streamlined referee dashboard implemented:
  - Assigned matches queue with priorities
  - Quick access to player information and match history
  - One-tap match start/pause/complete actions
  - Score entry optimized for single-handed operation
  - Emergency contact and tournament official information

- **AC2A.4.2:** Match officiation tools:
  - Player warm-up timer with alerts
  - Time violation tracking and warnings
  - Conduct warning system with escalation
  - Medical timeout management
  - Equipment malfunction reporting

**Score Management:**
- **AC2A.4.3:** Advanced scoring features:
  - Voice-activated score entry (optional)
  - Gesture-based score adjustments
  - Quick correction tools for common errors
  - Set point and match point notifications
  - Automatic score announcement preparation

- **AC2A.4.4:** Match incident reporting:
  - Timestamped incident logs
  - Photo capture for disputed calls
  - Player behavior notes and warnings
  - Injury reporting with medical staff alerts
  - Equipment issue documentation

**Integration Features:**
- **AC2A.4.5:** Tournament system integration:
  - Real-time sync with main tournament system
  - Backup score entry in case of connectivity issues
  - Referee performance tracking and feedback
  - Court condition reporting
  - End-of-match summary and signatures

### Technical Implementation
```typescript
interface RefereeTools {
  getAssignedMatches(refereeId: string): Promise<Match[]>;
  startMatchTimer(matchId: string, timerType: 'warmup' | 'match' | 'medical'): Promise<void>;
  recordIncident(matchId: string, incident: MatchIncident): Promise<void>;
  submitMatchResult(matchId: string, result: MatchResult): Promise<void>;
}
```

### Definition of Done
- [ ] Referee interface is intuitive and requires minimal training
- [ ] All scoring functions work reliably in courtside conditions
- [ ] Incident reporting captures necessary information
- [ ] Offline functionality handles network issues
- [ ] Integration with main system maintains data consistency
- [ ] Performance optimized for older mobile devices

---

## Epic 2A Integration Story: End-to-End Tournament Execution

**As a** tournament organizer,  
**I want** seamless tournament day operations from match scheduling to results publication,  
**So that** I can deliver a professional tournament experience for all participants.

### Prerequisites
- All Epic 2A stories completed and individually tested

### Acceptance Criteria

**Complete Tournament Day Flow:**
- **AC2A.I.1:** Full tournament execution workflow:
  1. Tournament activation with bracket finalization
  2. Court assignment and match scheduling
  3. Live scoring with real-time updates
  4. Progress monitoring and communication
  5. Results publication and certificate generation

**Multi-User Coordination:**
- **AC2A.I.2:** Role-based collaboration:
  - Organizer: Overall tournament management and coordination
  - Referee: Court-side match officiation and scoring
  - Spectator: Live score viewing and tournament following
  - Player: Match scheduling and personal tournament progress

**Data Integrity:**
- **AC2A.I.3:** System reliability under load:
  - 50+ concurrent users supported smoothly
  - Score synchronization accuracy maintained
  - Bracket progression logic always correct
  - No data loss during network interruptions
  - Complete audit trail for all tournament actions

### Definition of Done
- [ ] Complete tournament executed successfully end-to-end
- [ ] All user roles can perform their functions simultaneously
- [ ] Real-time features work reliably under tournament conditions
- [ ] Data integrity maintained throughout tournament lifecycle
- [ ] Performance acceptable on typical tournament hardware
- [ ] Ready for Epic 2B development (Advanced tournament features)

---

## Epic 2A Success Criteria

**Epic 2A is complete when:**
1. ✅ Tournament organizers can manage live matches efficiently
2. ✅ Real-time scoring works reliably across devices
3. ✅ Tournament progress is clearly visible and trackable
4. ✅ Referees have dedicated tools for match officiation
5. ✅ Complete tournament execution tested end-to-end
6. ✅ Multi-user coordination works smoothly
7. ✅ 60% pilot readiness achieved (live tournament management)

**Ready for Epic 2B when:**
- Live tournament execution works reliably
- Real-time features perform well under load
- Multi-role user coordination is seamless
- Tournament data integrity is maintained
- Advanced tournament features are ready for development
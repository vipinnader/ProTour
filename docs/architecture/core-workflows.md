# Core Workflows

These sequence diagrams illustrate key system workflows that clarify architecture decisions and demonstrate complex multi-device interactions for ProTour's tournament management system.

## Tournament Creation and Player Import Workflow

```mermaid
sequenceDiagram
    participant O as Organizer
    participant RN as React Native App
    participant TE as TournamentEngine
    participant CSV as CSVImportProcessor
    participant FS as Firebase Storage
    participant FB as Firestore
    participant NS as NotificationService

    Note over O,NS: Tournament Setup Workflow
    
    O->>RN: Create new tournament
    RN->>TE: Validate tournament config
    TE->>FB: Create tournament record
    FB->>RN: Tournament ID + access code
    RN->>O: Display tournament created
    
    Note over O,CSV: Player Import Phase
    O->>RN: Upload CSV file
    RN->>FS: Upload to secure storage
    FS->>CSV: Process file (server-side)
    CSV->>CSV: Validate player data
    CSV->>FB: Batch create player records
    CSV->>RN: Import results + errors
    
    alt Import has errors
        RN->>O: Show validation errors
        O->>RN: Fix and re-upload
    else Import successful  
        CSV->>TE: Generate tournament bracket
        TE->>FB: Create match records
        FB->>RN: Bracket generated
        RN->>O: Tournament ready to start
    end
```

## Multi-Device Score Entry and Real-Time Sync Workflow

```mermaid
sequenceDiagram
    participant O as Organizer Device
    participant R as Referee Device
    participant SM_O as SyncManager (Organizer)
    participant SM_R as SyncManager (Referee)
    participant FS as Firestore
    participant TE as TournamentEngine
    participant NS as NotificationService

    Note over O,NS: Delegation Setup
    O->>SM_O: Create referee delegation
    SM_O->>FS: Store delegation token
    O->>R: Share access code
    R->>SM_R: Join tournament with code
    SM_R->>FS: Validate delegation
    FS->>R: Referee access granted

    Note over R,NS: Score Entry (Offline Scenario)
    Note over R: Venue loses internet connectivity
    R->>SM_R: Enter match score
    SM_R->>SM_R: Store locally (offline)
    SM_R->>R: Confirm score saved locally
    
    Note over SM_R,NS: Connectivity Returns
    SM_R->>FS: Sync pending score updates
    FS->>TE: Process score + bracket logic
    TE->>FS: Update tournament state
    
    Note over FS,NS: Real-Time Propagation
    FS->>SM_O: Real-time bracket update
    SM_O->>O: Update organizer dashboard
    FS->>NS: Trigger notifications
    NS->>O: Match completion alert
    NS->>R: Score confirmation
    
    Note over O,NS: Conflict Resolution Scenario
    alt Simultaneous edits detected
        FS->>SM_O: Conflict notification
        SM_O->>O: Show conflict resolution UI
        O->>SM_O: Resolve conflict (organizer priority)
        SM_O->>FS: Apply resolution
        FS->>SM_R: Sync conflict resolution
        SM_R->>R: Update with resolved data
    end
```

## Live Tournament Spectator Experience Workflow

```mermaid
sequenceDiagram
    participant S as Spectator
    participant RN as React Native App
    participant FS as Firestore
    participant BV as BracketVisualization
    participant NS as NotificationService
    participant SM as OfflineSyncManager

    Note over S,SM: Tournament Discovery
    S->>RN: Enter tournament access code
    RN->>FS: Validate public access
    FS->>RN: Tournament data + permissions
    RN->>BV: Render live bracket
    BV->>S: Interactive tournament view
    
    Note over S,SM: Real-Time Updates
    S->>RN: Follow specific player
    RN->>NS: Subscribe to player notifications
    NS->>FS: Set up filtered subscriptions
    
    loop Live Tournament Updates
        FS->>RN: Real-time match updates
        RN->>BV: Update bracket visualization  
        BV->>S: Smooth animation of changes
        
        alt Player being followed
            FS->>NS: Player match event
            NS->>S: Push notification
        end
    end
    
    Note over S,SM: Connectivity Resilience
    Note over S: Network becomes unstable
    RN->>SM: Switch to cached data
    SM->>BV: Render last known state
    BV->>S: Show "last updated" indicator
    
    Note over S: Network restored
    SM->>FS: Resume real-time subscriptions
    FS->>SM: Catch-up sync
    SM->>BV: Update with latest data
    BV->>S: Remove offline indicators
```

## Tournament Completion and Notification Cascade Workflow

```mermaid
sequenceDiagram
    participant R as Referee Device
    participant O as Organizer Device  
    participant TE as TournamentEngine
    participant FS as Firestore
    participant NS as NotificationService
    participant SMS as SMS Gateway
    participant FCM as Firebase Messaging

    Note over R,FCM: Final Match Completion
    R->>TE: Enter final match score
    TE->>TE: Validate tournament winner
    TE->>FS: Mark tournament completed
    FS->>O: Real-time completion update
    
    Note over TE,FCM: Notification Cascade
    TE->>NS: Tournament completion event
    NS->>NS: Generate notification templates
    
    par Push Notifications
        NS->>FCM: Send winner announcement
        FCM->>O: Organizer success notification
        FCM->>R: Thank you message
    and SMS Fallback
        NS->>SMS: Send SMS to participants
        SMS->>NS: Delivery confirmation
    and In-App Updates
        NS->>FS: Update tournament status
        FS->>O: Update organizer dashboard
        FS->>R: Update referee interface
    end
    
    Note over O,FCM: Post-Tournament Actions  
    O->>TE: Export tournament results
    TE->>FS: Generate export data
    FS->>O: Tournament report ready
    
    NS->>NS: Schedule follow-up surveys
    NS->>FCM: Send feedback requests (24h delay)
    FCM->>O: Tournament feedback survey
```

# API Specification

Based on the chosen API style (REST + Firestore SDK hybrid), here's the complete API specification for ProTour's tournament management system. This hybrid approach uses direct Firestore SDK for real-time operations and REST endpoints for complex business logic.

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: ProTour Tournament Management API
  version: 1.0.0
  description: REST API for tournament management operations requiring server-side business logic
servers:
  - url: https://asia-south1-protour-prod.cloudfunctions.net/api
    description: Production API (Mumbai region)
  - url: https://asia-south1-protour-staging.cloudfunctions.net/api
    description: Staging API

paths:
  /tournaments:
    post:
      summary: Create new tournament
      description: Creates tournament with bracket generation and validation
      tags: [Tournaments]
      security:
        - firebaseAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTournamentRequest'
      responses:
        '201':
          description: Tournament created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Tournament'
        '400':
          description: Invalid tournament configuration
        '401':
          description: Authentication required

  /tournaments/{tournamentId}/players/import:
    post:
      summary: Import players from CSV
      description: Bulk import with validation and duplicate detection
      tags: [Players]
      security:
        - firebaseAuth: []
      parameters:
        - name: tournamentId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                csvFile:
                  type: string
                  format: binary
                options:
                  $ref: '#/components/schemas/ImportOptions'
      responses:
        '200':
          description: Import completed with results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ImportResult'

  /tournaments/{tournamentId}/bracket/generate:
    post:
      summary: Generate tournament bracket
      description: Creates bracket structure with seeding and bye placement
      tags: [Brackets]
      security:
        - firebaseAuth: []
      parameters:
        - name: tournamentId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BracketGenerationRequest'
      responses:
        '200':
          description: Bracket generated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BracketResult'

  /tournaments/{tournamentId}/matches/{matchId}/score:
    put:
      summary: Update match score
      description: Records score with validation and bracket progression
      tags: [Matches]
      security:
        - firebaseAuth: []
      parameters:
        - name: tournamentId
          in: path
          required: true
          schema:
            type: string
        - name: matchId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ScoreUpdateRequest'
      responses:
        '200':
          description: Score updated and bracket progressed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ScoreUpdateResult'

  /tournaments/{tournamentId}/delegation/invite:
    post:
      summary: Create referee delegation invite
      description: Generates secure access code for score entry delegation
      tags: [Delegation]
      security:
        - firebaseAuth: []
      parameters:
        - name: tournamentId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DelegationInviteRequest'
      responses:
        '201':
          description: Delegation invite created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DelegationInvite'

components:
  schemas:
    CreateTournamentRequest:
      type: object
      required: [name, sport, format]
      properties:
        name:
          type: string
          example: "City Badminton Championship"
        sport:
          type: string
          enum: [badminton, tennis, squash, tabletennis]
        format:
          type: string
          enum: [single_elimination, double_elimination]
        isPublic:
          type: boolean
          default: false
        location:
          type: string
        description:
          type: string
        scheduledDate:
          type: string
          format: date-time

    Tournament:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        sport:
          type: string
        format:
          type: string
        status:
          type: string
          enum: [setup, active, paused, completed]
        organizerId:
          type: string
        accessCode:
          type: string
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    ImportResult:
      type: object
      properties:
        totalRows:
          type: integer
        successfulImports:
          type: integer
        errors:
          type: array
          items:
            $ref: '#/components/schemas/ImportError'
        duplicates:
          type: array
          items:
            $ref: '#/components/schemas/DuplicatePlayer'

    ImportError:
      type: object
      properties:
        row:
          type: integer
        field:
          type: string
        message:
          type: string
        value:
          type: string

    BracketGenerationRequest:
      type: object
      required: [seedingMethod]
      properties:
        seedingMethod:
          type: string
          enum: [random, ranked, manual]
        manualSeeds:
          type: array
          items:
            type: object
            properties:
              playerId:
                type: string
              position:
                type: integer

    ScoreUpdateRequest:
      type: object
      required: [scores, winnerId]
      properties:
        scores:
          type: array
          items:
            type: object
            properties:
              game:
                type: integer
              player1Score:
                type: integer
              player2Score:
                type: integer
        winnerId:
          type: string
        status:
          type: string
          enum: [completed, walkover, disqualified]

  securitySchemes:
    firebaseAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Firebase Auth JWT token
```

## Firestore Real-Time Operations

**Direct SDK Operations (No REST API):**
- **Tournament Subscriptions:** Real-time tournament status and bracket updates
- **Match Score Streaming:** Live score updates across all connected devices  
- **Player Status Changes:** Real-time participant status for organizer dashboard
- **Notifications:** Push notification triggers via Firestore triggers

**Firestore Security Rules:**
```javascript
// Tournament access control
match /tournaments/{tournamentId} {
  allow read: if resource.data.isPublic || 
                 request.auth.uid == resource.data.organizerId ||
                 isPlayerInTournament(tournamentId, request.auth.uid);
  allow write: if request.auth.uid == resource.data.organizerId;
}

// Match scoring permissions  
match /matches/{matchId} {
  allow read: if canAccessTournament(resource.data.tournamentId);
  allow write: if isOrganizerOrDelegate(resource.data.tournamentId, request.auth.uid);
}
```

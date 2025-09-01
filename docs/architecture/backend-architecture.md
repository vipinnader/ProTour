# Backend Architecture

Backend-specific architecture details for Firebase Functions serverless approach optimized for tournament management business logic and multi-device coordination.

## Service Architecture

### Function Organization Structure
```
apps/api/src/
├── functions/                 # Cloud Functions
│   ├── tournaments/          # Tournament management
│   │   ├── createTournament.ts
│   │   ├── generateBracket.ts
│   │   └── importPlayers.ts
│   ├── matches/              # Match scoring and progression
│   │   ├── updateScore.ts
│   │   ├── progressBracket.ts
│   │   └── validateMatch.ts
│   ├── notifications/        # Push and SMS notifications
│   │   ├── sendMatchAlert.ts
│   │   ├── broadcastUpdate.ts
│   │   └── smsFailover.ts
│   └── delegation/           # Multi-device access control
│       ├── createToken.ts
│       ├── validateAccess.ts
│       └── revokeAccess.ts
├── shared/                   # Shared business logic
│   ├── models/              # Data models and validation
│   ├── services/            # Business logic services
│   └── utils/               # Utility functions
├── middleware/              # Express middleware
│   ├── auth.ts              # Firebase Auth validation
│   ├── validation.ts        # Request validation
│   └── rateLimit.ts         # Rate limiting
└── types/                   # TypeScript definitions
```

### Serverless Function Template
```typescript
// functions/tournaments/createTournament.ts
import { onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { validateFirebaseAuth } from '../middleware/auth';
import { TournamentEngine } from '../shared/services/TournamentEngine';
import { CreateTournamentRequest, Tournament } from '../types';

const region = defineString('FIREBASE_REGION', { default: 'asia-south1' });

export const createTournament = onRequest({
  region: region.value,
  memory: '512MiB',
  timeoutSeconds: 60,
  cors: true
}, async (req, res) => {
  try {
    // Validate authentication
    const user = await validateFirebaseAuth(req);
    if (user.role !== 'organizer') {
      return res.status(403).json({ error: 'Organizer role required' });
    }

    // Validate request body
    const tournamentData = req.body as CreateTournamentRequest;
    const validation = TournamentEngine.validateTournamentData(tournamentData);
    if (!validation.isValid) {
      return res.status(400).json({ errors: validation.errors });
    }

    // Create tournament
    const db = getFirestore();
    const tournament: Tournament = {
      id: db.collection('tournaments').doc().id,
      ...tournamentData,
      organizerId: user.uid,
      status: 'setup',
      accessCode: TournamentEngine.generateAccessCode(),
      createdAt: new Date(),
      updatedAt: new Date(),
      playerCount: 0,
      currentRound: 0
    };

    // Atomic write with error handling
    await db.collection('tournaments').doc(tournament.id).set(tournament);

    // Log for monitoring
    console.log(`Tournament created: ${tournament.id} by ${user.uid}`);

    res.status(201).json(tournament);
  } catch (error) {
    console.error('Tournament creation error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      requestId: req.headers['x-request-id'] 
    });
  }
});
```

## Database Architecture

### Firestore Schema Implementation
```typescript
// shared/models/Tournament.ts
import { Firestore, Timestamp } from 'firebase-admin/firestore';

export interface FirestoreTournament {
  id: string;
  name: string;
  sport: 'badminton' | 'tennis' | 'squash' | 'tabletennis';
  format: 'single_elimination' | 'double_elimination';
  status: 'setup' | 'active' | 'paused' | 'completed';
  organizerId: string;
  accessCode: string;
  isPublic: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  settings: {
    maxPlayers: number;
    matchFormat: 'best_of_1' | 'best_of_3' | 'best_of_5';
    courtCount: number;
    allowSpectators: boolean;
  };
  playerCount: number;
  currentRound: number;
  winnerPlayerId?: string;
  location?: string;
  description?: string;
  scheduledDate?: Timestamp;
}

// Repository Pattern for Data Access
export class TournamentRepository {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  async create(tournament: Omit<FirestoreTournament, 'createdAt' | 'updatedAt'>): Promise<FirestoreTournament> {
    const now = Timestamp.now();
    const tournamentWithTimestamps: FirestoreTournament = {
      ...tournament,
      createdAt: now,
      updatedAt: now
    };

    await this.db.collection('tournaments').doc(tournament.id).set(tournamentWithTimestamps);
    return tournamentWithTimestamps;
  }

  async findById(id: string): Promise<FirestoreTournament | null> {
    const doc = await this.db.collection('tournaments').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as FirestoreTournament;
  }

  async updatePlayerCount(tournamentId: string, playerCount: number): Promise<void> {
    await this.db.collection('tournaments').doc(tournamentId).update({
      playerCount,
      updatedAt: Timestamp.now()
    });
  }

  async findByOrganizer(organizerId: string, limit = 20): Promise<FirestoreTournament[]> {
    const snapshot = await this.db
      .collection('tournaments')
      .where('organizerId', '==', organizerId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirestoreTournament[];
  }

  async markCompleted(tournamentId: string, winnerId: string): Promise<void> {
    await this.db.collection('tournaments').doc(tournamentId).update({
      status: 'completed',
      winnerPlayerId: winnerId,
      updatedAt: Timestamp.now()
    });
  }
}
```

### Data Access Layer with Validation
```typescript
// shared/services/TournamentService.ts
import { TournamentRepository } from '../models/Tournament';
import { MatchRepository } from '../models/Match';
import { PlayerRepository } from '../models/Player';
import { NotificationService } from './NotificationService';

export class TournamentService {
  private tournamentRepo: TournamentRepository;
  private matchRepo: MatchRepository;
  private playerRepo: PlayerRepository;
  private notificationService: NotificationService;

  constructor(
    tournamentRepo: TournamentRepository,
    matchRepo: MatchRepository, 
    playerRepo: PlayerRepository,
    notificationService: NotificationService
  ) {
    this.tournamentRepo = tournamentRepo;
    this.matchRepo = matchRepo;
    this.playerRepo = playerRepo;
    this.notificationService = notificationService;
  }

  async progressTournament(tournamentId: string, completedMatchId: string): Promise<void> {
    const tournament = await this.tournamentRepo.findById(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const completedMatch = await this.matchRepo.findById(tournamentId, completedMatchId);
    if (!completedMatch || !completedMatch.winnerId) {
      throw new Error('Match not completed');
    }

    // Generate next round matches if current round is complete
    const currentRoundMatches = await this.matchRepo.findByRound(tournamentId, tournament.currentRound);
    const allCurrentRoundComplete = currentRoundMatches.every(match => match.status === 'completed');

    if (allCurrentRoundComplete) {
      const nextRound = tournament.currentRound + 1;
      
      // Check if tournament is complete
      if (currentRoundMatches.length === 1) {
        await this.tournamentRepo.markCompleted(tournamentId, completedMatch.winnerId);
        await this.notificationService.sendTournamentCompleteNotification(tournament, completedMatch.winnerId);
      } else {
        // Generate next round matches
        await this.generateNextRoundMatches(tournamentId, currentRoundMatches, nextRound);
        await this.notificationService.sendRoundCompleteNotification(tournament, nextRound);
      }
    }

    // Send match completion notification
    await this.notificationService.sendMatchCompleteNotification(completedMatch);
  }

  private async generateNextRoundMatches(
    tournamentId: string, 
    currentRoundMatches: Match[], 
    nextRound: number
  ): Promise<void> {
    const winners = currentRoundMatches
      .filter(match => match.winnerId)
      .map(match => match.winnerId!);

    const nextRoundMatches: Match[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      const match: Match = {
        id: this.matchRepo.generateId(),
        tournamentId,
        roundNumber: nextRound,
        matchNumber: Math.floor(i / 2) + 1,
        player1Id: winners[i],
        player2Id: winners[i + 1] || null, // Handle odd number of winners (bye)
        status: 'pending',
        scores: [],
        lastUpdatedBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      nextRoundMatches.push(match);
    }

    // Batch create next round matches
    await this.matchRepo.createBatch(nextRoundMatches);
  }
}
```

## Authentication and Authorization Architecture

### Auth Flow Implementation
```typescript
// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: 'organizer' | 'player' | 'spectator';
  customClaims: Record<string, any>;
}

export async function validateFirebaseAuth(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid authorization header');
  }

  const token = authHeader.substring(7);
  
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    
    // Get user role from custom claims or database
    let userRole = decodedToken.role || 'spectator';
    if (!decodedToken.role) {
      const userDoc = await getFirestore().collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists) {
        userRole = userDoc.data()?.role || 'spectator';
      }
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: userRole,
      customClaims: decodedToken
    };
  } catch (error) {
    throw new Error('Invalid authentication token');
  }
}

// Delegation token validation
export async function validateDelegationAccess(
  tournamentId: string,
  userId: string,
  requiredPermission: string
): Promise<boolean> {
  const db = getFirestore();
  
  // Check if user is tournament organizer
  const tournament = await db.collection('tournaments').doc(tournamentId).get();
  if (tournament.exists && tournament.data()?.organizerId === userId) {
    return true;
  }

  // Check delegation tokens
  const delegationQuery = await db
    .collection('delegationTokens')
    .where('tournamentId', '==', tournamentId)
    .where('refereeUserId', '==', userId)
    .where('isActive', '==', true)
    .where('expiresAt', '>', new Date())
    .get();

  if (delegationQuery.empty) {
    return false;
  }

  const delegation = delegationQuery.docs[0].data();
  return delegation.permissions.includes(requiredPermission);
}
```

### Middleware/Guards Implementation
```typescript
// middleware/tournamentAuth.ts  
import { Request, Response, NextFunction } from 'express';
import { validateFirebaseAuth, validateDelegationAccess } from './auth';

interface TournamentAuthRequest extends Request {
  user?: AuthenticatedUser;
  tournamentId?: string;
}

export function requireTournamentAccess(permission: string) {
  return async (req: TournamentAuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await validateFirebaseAuth(req);
      const tournamentId = req.params.tournamentId || req.body.tournamentId;
      
      if (!tournamentId) {
        return res.status(400).json({ error: 'Tournament ID required' });
      }

      const hasAccess = await validateDelegationAccess(tournamentId, user.uid, permission);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission 
        });
      }

      req.user = user;
      req.tournamentId = tournamentId;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };
}

// Usage in function
export const updateMatchScore = onRequest(
  { region: 'asia-south1' },
  express().use(requireTournamentAccess('score_entry'), async (req, res) => {
    // Function implementation with guaranteed auth
    const { user, tournamentId } = req as TournamentAuthRequest;
    // Process score update...
  })
);
```

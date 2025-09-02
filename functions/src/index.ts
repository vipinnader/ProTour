import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Set Firestore settings for offline persistence
db.settings({
  ignoreUndefinedProperties: true,
});

// ============================================================================
// Authentication Functions
// ============================================================================

/**
 * Set custom user claims for role-based access control
 */
export const setUserClaims = onCall(
  {
    cors: true,
    enforceAppCheck: false, // Disable for development
  },
  async (request) => {
    const { uid, claims } = request.data;

    // Verify that the caller is an admin
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Only admins can set user claims');
    }

    try {
      await auth.setCustomUserClaims(uid, claims);
      functions.logger.info(`Custom claims set for user ${uid}`, { claims });
      
      return { success: true, message: 'Custom claims set successfully' };
    } catch (error) {
      functions.logger.error('Error setting custom claims:', error);
      throw new HttpsError('internal', 'Failed to set custom claims');
    }
  }
);

/**
 * Create user profile document when user signs up
 */
export const createUserProfile = functions.auth.user().onCreate(async (user) => {
  try {
    const userDoc = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      role: 'player', // Default role
      preferences: {
        notifications: {
          email: true,
          sms: false,
          push: true,
        },
        privacy: {
          showProfile: true,
          showStats: true,
        },
      },
    };

    await db.collection('users').doc(user.uid).set(userDoc);
    functions.logger.info(`User profile created for ${user.uid}`);
  } catch (error) {
    functions.logger.error('Error creating user profile:', error);
    // Don't throw error to avoid blocking user creation
  }
});

/**
 * Clean up user data when user is deleted
 */
export const cleanupUserData = functions.auth.user().onDelete(async (user) => {
  try {
    // Delete user profile
    await db.collection('users').doc(user.uid).delete();
    
    // TODO: Handle cleanup of user's tournaments, registrations, etc.
    functions.logger.info(`User data cleaned up for ${user.uid}`);
  } catch (error) {
    functions.logger.error('Error cleaning up user data:', error);
  }
});

// ============================================================================
// Tournament Functions
// ============================================================================

/**
 * Create a new tournament
 */
export const createTournament = onCall(
  {
    cors: true,
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { tournamentData } = request.data;

    try {
      const tournament = {
        ...tournamentData,
        ownerId: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'draft',
        participantCount: 0,
        matchCount: 0,
      };

      const docRef = await db.collection('tournaments').add(tournament);
      
      functions.logger.info(`Tournament created: ${docRef.id}`);
      return { tournamentId: docRef.id, success: true };
    } catch (error) {
      functions.logger.error('Error creating tournament:', error);
      throw new HttpsError('internal', 'Failed to create tournament');
    }
  }
);

/**
 * Update tournament participant count when registration is added/removed
 */
export const updateTournamentStats = onDocumentCreated(
  'tournaments/{tournamentId}/registrations/{registrationId}',
  async (event) => {
    const tournamentId = event.params.tournamentId;
    
    try {
      // Count current registrations
      const registrationsSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('registrations')
        .where('status', '==', 'confirmed')
        .get();

      const participantCount = registrationsSnapshot.size;

      // Update tournament document
      await db.collection('tournaments').doc(tournamentId).update({
        participantCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Updated participant count for tournament ${tournamentId}: ${participantCount}`);
    } catch (error) {
      functions.logger.error('Error updating tournament stats:', error);
    }
  }
);

// ============================================================================
// Match Functions
// ============================================================================

/**
 * Update match score
 */
export const updateMatchScore = onCall(
  {
    cors: true,
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { tournamentId, matchId, score, winnerId } = request.data;

    try {
      // Verify user has permission to update this match
      const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
      
      if (!tournamentDoc.exists) {
        throw new HttpsError('not-found', 'Tournament not found');
      }

      const tournament = tournamentDoc.data();
      const isAuthorized = 
        tournament?.ownerId === request.auth.uid ||
        tournament?.organizerIds?.includes(request.auth.uid) ||
        tournament?.refereeIds?.includes(request.auth.uid) ||
        request.auth.token.admin;

      if (!isAuthorized) {
        throw new HttpsError('permission-denied', 'Not authorized to update this match');
      }

      // Update match
      const matchRef = db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .doc(matchId);

      await matchRef.update({
        score,
        winnerId,
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
      });

      functions.logger.info(`Match ${matchId} score updated`);
      return { success: true };
    } catch (error) {
      functions.logger.error('Error updating match score:', error);
      throw new HttpsError('internal', 'Failed to update match score');
    }
  }
);

// ============================================================================
// Notification Functions
// ============================================================================

/**
 * Send notification when match is created or updated
 */
export const sendMatchNotification = onDocumentUpdated(
  'tournaments/{tournamentId}/matches/{matchId}',
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;

    try {
      // Check if match status changed to 'scheduled' or 'completed'
      if (beforeData.status !== afterData.status && 
          (afterData.status === 'scheduled' || afterData.status === 'completed')) {
        
        // Get player FCM tokens
        const player1Doc = await db.collection('users').doc(afterData.player1Id).get();
        const player2Doc = await db.collection('users').doc(afterData.player2Id).get();

        const tokens: string[] = [];
        
        if (player1Doc.exists && player1Doc.data()?.fcmToken) {
          tokens.push(player1Doc.data()!.fcmToken);
        }
        
        if (player2Doc.exists && player2Doc.data()?.fcmToken) {
          tokens.push(player2Doc.data()!.fcmToken);
        }

        if (tokens.length > 0) {
          const message = afterData.status === 'scheduled' 
            ? 'Your match has been scheduled!'
            : 'Your match has been completed!';

          await admin.messaging().sendToDevice(tokens, {
            notification: {
              title: 'Match Update',
              body: message,
            },
            data: {
              type: 'match_update',
              tournamentId: event.params.tournamentId,
              matchId: event.params.matchId,
            },
          });

          functions.logger.info(`Match notification sent for match ${event.params.matchId}`);
        }
      }
    } catch (error) {
      functions.logger.error('Error sending match notification:', error);
    }
  }
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Health check endpoint
 */
export const healthCheck = functions.https.onRequest((req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

/**
 * Get server timestamp
 */
export const getServerTimestamp = onCall(
  {
    cors: true,
    enforceAppCheck: false,
  },
  async () => {
    return {
      timestamp: admin.firestore.Timestamp.now(),
      iso: new Date().toISOString(),
    };
  }
);
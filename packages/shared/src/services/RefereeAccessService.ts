// Referee Access Service for Story 2B.2 - AC2B.2.1 & AC2B.2.2
// Secure invitation system and granular permission management

import { enhancedOfflineService } from './EnhancedOfflineService';
import { multiDeviceService } from './MultiDeviceService';
import { realTimeNotificationService } from './RealTimeNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import CryptoJS from 'crypto-js';

export interface RefereeInvitation {
  id: string;
  tournamentId: string;
  organizerId: string;
  refereeEmail?: string;
  refereePhone?: string;
  accessCode: string;
  qrCodeData: string;
  permissions: RefereePermissions;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt: number;
  acceptedAt?: number;
  deviceId?: string;
  deviceInfo?: {
    name: string;
    platform: string;
    version: string;
  };
}

export interface RefereePermissions {
  assignedMatches: string[]; // Match IDs referee can score
  canStartMatches: boolean;
  canCompleteMatches: boolean;
  canEditScores: boolean;
  canViewAllMatches: boolean; // For spectating other matches
  canAccessPlayerInfo: boolean;
  maxConcurrentMatches: number;
  restrictions: {
    timeWindow?: { start: number; end: number }; // Unix timestamps
    courtRestrictions?: string[]; // Specific courts only
    roundRestrictions?: number[]; // Specific rounds only
  };
}

export interface RefereeSession {
  invitationId: string;
  tournamentId: string;
  refereeId: string;
  deviceId: string;
  isActive: boolean;
  startTime: number;
  lastActivity: number;
  permissions: RefereePermissions;
  currentMatches: string[]; // Currently assigned/active matches
  performanceMetrics: {
    matchesCompleted: number;
    averageMatchTime: number; // minutes
    accuracyScore: number; // 0-100 based on organizer corrections
    responseTime: number; // average milliseconds for score entry
  };
}

export interface AccessCodeValidation {
  isValid: boolean;
  invitation?: RefereeInvitation;
  error?:
    | 'invalid_code'
    | 'expired'
    | 'revoked'
    | 'already_used'
    | 'tournament_not_found';
  deviceRestriction?: boolean; // If code was already used on different device
}

export class RefereeAccessService {
  private readonly ACCESS_CODE_LENGTH = 6;
  private readonly DEFAULT_INVITATION_VALIDITY_HOURS = 24;
  private readonly MAX_ACCESS_ATTEMPTS = 3;
  private readonly INVITATION_STORAGE_KEY = '@protour/referee_invitations';
  private readonly SESSION_STORAGE_KEY = '@protour/referee_sessions';

  private invitations: Map<string, RefereeInvitation> = new Map();
  private sessions: Map<string, RefereeSession> = new Map();
  private accessAttempts: Map<string, number> = new Map(); // deviceId -> attempt count

  constructor() {
    this.loadStoredData();
    this.scheduleCleanup();
  }

  private async loadStoredData(): Promise<void> {
    try {
      // Load invitations
      const invitationsData = await AsyncStorage.getItem(
        this.INVITATION_STORAGE_KEY
      );
      if (invitationsData) {
        const invitations = JSON.parse(invitationsData);
        invitations.forEach((inv: RefereeInvitation) => {
          this.invitations.set(inv.id, inv);
        });
      }

      // Load sessions
      const sessionsData = await AsyncStorage.getItem(this.SESSION_STORAGE_KEY);
      if (sessionsData) {
        const sessions = JSON.parse(sessionsData);
        sessions.forEach((session: RefereeSession) => {
          this.sessions.set(session.refereeId, session);
        });
      }
    } catch (error) {
      console.error('Failed to load referee access data:', error);
    }
  }

  private async persistData(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.INVITATION_STORAGE_KEY,
        JSON.stringify(Array.from(this.invitations.values()))
      );

      await AsyncStorage.setItem(
        this.SESSION_STORAGE_KEY,
        JSON.stringify(Array.from(this.sessions.values()))
      );
    } catch (error) {
      console.error('Failed to persist referee access data:', error);
    }
  }

  /**
   * AC2B.2.1: Create secure 6-digit access code with QR generation
   */
  async createRefereeInvitation(
    tournamentId: string,
    organizerId: string,
    permissions: RefereePermissions,
    options?: {
      email?: string;
      phone?: string;
      validityHours?: number;
      customMessage?: string;
    }
  ): Promise<RefereeInvitation> {
    try {
      // Generate secure access code
      const accessCode = this.generateAccessCode();

      // Generate QR code data
      const qrCodeData = this.generateQRCodeData(tournamentId, accessCode);

      const invitation: RefereeInvitation = {
        id: uuid.v4() as string,
        tournamentId,
        organizerId,
        refereeEmail: options?.email,
        refereePhone: options?.phone,
        accessCode,
        qrCodeData,
        permissions,
        expiresAt:
          Date.now() +
          (options?.validityHours || this.DEFAULT_INVITATION_VALIDITY_HOURS) *
            60 *
            60 *
            1000,
        status: 'pending',
        createdAt: Date.now(),
      };

      this.invitations.set(invitation.id, invitation);
      await this.persistData();

      // Send invitation if contact info provided
      if (options?.email || options?.phone) {
        await this.sendInvitation(invitation, options.customMessage);
      }

      console.log(
        `Created referee invitation: ${invitation.accessCode} for tournament ${tournamentId}`
      );
      return invitation;
    } catch (error) {
      console.error('Failed to create referee invitation:', error);
      throw error;
    }
  }

  private generateAccessCode(): string {
    // Generate cryptographically secure 6-digit code
    const chars = '0123456789';
    let result = '';

    for (let i = 0; i < this.ACCESS_CODE_LENGTH; i++) {
      // Use crypto for secure random generation
      const randomBytes = CryptoJS.lib.WordArray.random(1);
      const randomIndex = Math.abs(randomBytes.words[0]) % chars.length;
      result += chars[randomIndex];
    }

    // Ensure uniqueness
    if (this.isCodeInUse(result)) {
      return this.generateAccessCode(); // Recursive retry
    }

    return result;
  }

  private isCodeInUse(code: string): boolean {
    for (const invitation of this.invitations.values()) {
      if (invitation.accessCode === code && invitation.status === 'pending') {
        return true;
      }
    }
    return false;
  }

  private generateQRCodeData(tournamentId: string, accessCode: string): string {
    // Generate QR code data in JSON format for easy scanning
    const qrData = {
      app: 'ProTour',
      action: 'join_tournament',
      tournamentId,
      accessCode,
      version: '1.0',
      timestamp: Date.now(),
    };

    return JSON.stringify(qrData);
  }

  /**
   * AC2B.2.1: Send invitation via email or SMS
   */
  private async sendInvitation(
    invitation: RefereeInvitation,
    customMessage?: string
  ): Promise<void> {
    try {
      const message =
        customMessage ||
        `You've been invited to referee matches in ProTour tournament. Access code: ${invitation.accessCode}. The invitation expires in 24 hours.`;

      const notificationData = {
        title: 'Tournament Referee Invitation',
        body: message,
        type: 'referee_invitation' as const,
        priority: 'high' as const,
        data: {
          invitationId: invitation.id,
          tournamentId: invitation.tournamentId,
          accessCode: invitation.accessCode,
          qrCodeData: invitation.qrCodeData,
        },
      };

      // Send via push notification first
      if (invitation.refereeEmail) {
        // In real implementation, you'd send email
        console.log(`Sending invitation email to ${invitation.refereeEmail}`);
      }

      if (invitation.refereePhone) {
        // Send SMS via real-time notification service
        await realTimeNotificationService.sendSMSNotification(
          'referee_invitation',
          notificationData,
          invitation.refereePhone
        );
      }
    } catch (error) {
      console.error('Failed to send referee invitation:', error);
      // Don't throw - invitation should still be created even if sending fails
    }
  }

  /**
   * AC2B.2.2: Validate access code and establish referee session
   */
  async validateAccessCode(
    accessCode: string,
    deviceId: string,
    deviceInfo?: { name: string; platform: string; version: string }
  ): Promise<AccessCodeValidation> {
    try {
      // Check for too many failed attempts
      const attempts = this.accessAttempts.get(deviceId) || 0;
      if (attempts >= this.MAX_ACCESS_ATTEMPTS) {
        return {
          isValid: false,
          error: 'invalid_code', // Don't reveal that it's blocked due to attempts
        };
      }

      // Find invitation by access code
      const invitation = Array.from(this.invitations.values()).find(
        inv => inv.accessCode === accessCode
      );

      if (!invitation) {
        this.recordFailedAttempt(deviceId);
        return { isValid: false, error: 'invalid_code' };
      }

      // Check if invitation is expired
      if (invitation.expiresAt < Date.now()) {
        return { isValid: false, error: 'expired', invitation };
      }

      // Check if invitation is revoked
      if (invitation.status === 'revoked') {
        return { isValid: false, error: 'revoked', invitation };
      }

      // Check if already accepted on a different device
      if (
        invitation.status === 'accepted' &&
        invitation.deviceId !== deviceId
      ) {
        return {
          isValid: false,
          error: 'already_used',
          invitation,
          deviceRestriction: true,
        };
      }

      // Validate tournament exists and is accessible
      const tournament = await enhancedOfflineService.readOffline(
        'tournaments',
        invitation.tournamentId
      );
      if (!tournament) {
        return { isValid: false, error: 'tournament_not_found', invitation };
      }

      // Success - clear failed attempts
      this.accessAttempts.delete(deviceId);

      return { isValid: true, invitation };
    } catch (error) {
      console.error('Failed to validate access code:', error);
      this.recordFailedAttempt(deviceId);
      return { isValid: false, error: 'invalid_code' };
    }
  }

  private recordFailedAttempt(deviceId: string): void {
    const attempts = this.accessAttempts.get(deviceId) || 0;
    this.accessAttempts.set(deviceId, attempts + 1);

    // Clear attempts after 30 minutes
    setTimeout(
      () => {
        this.accessAttempts.delete(deviceId);
      },
      30 * 60 * 1000
    );
  }

  /**
   * AC2B.2.2: Accept invitation and create referee session
   */
  async acceptInvitation(
    invitationId: string,
    deviceId: string,
    refereeId: string,
    deviceInfo?: { name: string; platform: string; version: string }
  ): Promise<RefereeSession> {
    try {
      const invitation = this.invitations.get(invitationId);
      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // Update invitation status
      invitation.status = 'accepted';
      invitation.acceptedAt = Date.now();
      invitation.deviceId = deviceId;
      invitation.deviceInfo = deviceInfo;

      // Create referee session
      const session: RefereeSession = {
        invitationId,
        tournamentId: invitation.tournamentId,
        refereeId,
        deviceId,
        isActive: true,
        startTime: Date.now(),
        lastActivity: Date.now(),
        permissions: { ...invitation.permissions },
        currentMatches: [],
        performanceMetrics: {
          matchesCompleted: 0,
          averageMatchTime: 0,
          accuracyScore: 100, // Start with perfect score
          responseTime: 0,
        },
      };

      this.sessions.set(refereeId, session);
      await this.persistData();

      // Register with multi-device service
      await multiDeviceService.registerDevice({
        deviceId,
        userId: refereeId,
        role: 'referee',
        permissions: invitation.permissions.assignedMatches,
        deviceInfo,
      });

      console.log(
        `Referee session created for ${refereeId} on device ${deviceId}`
      );
      return session;
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      throw error;
    }
  }

  /**
   * AC2B.2.2: Emergency permission revocation
   */
  async revokeRefereeAccess(
    refereeId: string,
    reason: string = 'Access revoked by organizer'
  ): Promise<void> {
    try {
      const session = this.sessions.get(refereeId);
      if (!session) {
        throw new Error('Referee session not found');
      }

      // Deactivate session
      session.isActive = false;

      // Update invitation status
      const invitation = this.invitations.get(session.invitationId);
      if (invitation) {
        invitation.status = 'revoked';
      }

      // Disconnect device
      await multiDeviceService.disconnectDevice(session.deviceId, reason);

      // Send notification to referee
      await realTimeNotificationService.sendEmergencyNotification(
        [refereeId],
        'Access Revoked',
        `Your referee access has been revoked: ${reason}`,
        {
          tournamentId: session.tournamentId,
          action: 'access_revoked',
          timestamp: Date.now(),
        }
      );

      this.sessions.delete(refereeId);
      await this.persistData();

      console.log(`Revoked referee access for ${refereeId}: ${reason}`);
    } catch (error) {
      console.error('Failed to revoke referee access:', error);
      throw error;
    }
  }

  /**
   * AC2B.2.2: Check if referee has permission for specific match
   */
  hasMatchPermission(
    refereeId: string,
    matchId: string,
    action: 'view' | 'edit' | 'start' | 'complete'
  ): boolean {
    const session = this.sessions.get(refereeId);
    if (!session || !session.isActive) {
      return false;
    }

    const permissions = session.permissions;

    // Check if match is assigned
    const hasMatchAccess =
      permissions.assignedMatches.includes(matchId) ||
      permissions.canViewAllMatches;
    if (!hasMatchAccess) {
      return false;
    }

    // Check specific action permissions
    switch (action) {
      case 'view':
        return true; // If has match access, can view
      case 'edit':
        return permissions.canEditScores;
      case 'start':
        return permissions.canStartMatches;
      case 'complete':
        return permissions.canCompleteMatches;
      default:
        return false;
    }
  }

  /**
   * Update referee performance metrics
   */
  async updatePerformanceMetrics(
    refereeId: string,
    metrics: {
      matchCompleted?: boolean;
      matchDurationMinutes?: number;
      responseTimeMs?: number;
      accuracyAdjustment?: number; // +/- points for organizer corrections
    }
  ): Promise<void> {
    const session = this.sessions.get(refereeId);
    if (!session) return;

    const perf = session.performanceMetrics;

    if (metrics.matchCompleted) {
      perf.matchesCompleted++;

      if (metrics.matchDurationMinutes) {
        // Update average match time
        perf.averageMatchTime =
          (perf.averageMatchTime * (perf.matchesCompleted - 1) +
            metrics.matchDurationMinutes) /
          perf.matchesCompleted;
      }
    }

    if (metrics.responseTimeMs) {
      // Exponential moving average for response time
      perf.responseTime =
        perf.responseTime === 0
          ? metrics.responseTimeMs
          : perf.responseTime * 0.8 + metrics.responseTimeMs * 0.2;
    }

    if (metrics.accuracyAdjustment !== undefined) {
      // Adjust accuracy score (clamped between 0-100)
      perf.accuracyScore = Math.max(
        0,
        Math.min(100, perf.accuracyScore + metrics.accuracyAdjustment)
      );
    }

    session.lastActivity = Date.now();
    await this.persistData();
  }

  /**
   * Get all active referee sessions for tournament
   */
  getActiveReferees(tournamentId: string): RefereeSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.tournamentId === tournamentId && session.isActive
    );
  }

  /**
   * Get referee session by ID
   */
  getRefereeSession(refereeId: string): RefereeSession | undefined {
    return this.sessions.get(refereeId);
  }

  /**
   * Get all invitations for tournament
   */
  getTournamentInvitations(tournamentId: string): RefereeInvitation[] {
    return Array.from(this.invitations.values()).filter(
      inv => inv.tournamentId === tournamentId
    );
  }

  /**
   * Assign match to referee
   */
  async assignMatchToReferee(
    refereeId: string,
    matchId: string
  ): Promise<void> {
    const session = this.sessions.get(refereeId);
    if (!session || !session.isActive) {
      throw new Error('Referee session not found or inactive');
    }

    // Check concurrent match limit
    if (
      session.currentMatches.length >= session.permissions.maxConcurrentMatches
    ) {
      throw new Error('Referee has reached maximum concurrent matches limit');
    }

    // Add to assigned matches
    if (!session.permissions.assignedMatches.includes(matchId)) {
      session.permissions.assignedMatches.push(matchId);
    }

    // Add to current matches
    if (!session.currentMatches.includes(matchId)) {
      session.currentMatches.push(matchId);
    }

    session.lastActivity = Date.now();
    await this.persistData();

    // Notify referee
    await realTimeNotificationService.sendSmartNotification(refereeId, {
      title: '🎾 New Match Assignment',
      body: 'You have been assigned to referee a new match',
      type: 'match_completion',
      priority: 'high',
      data: {
        matchId,
        tournamentId: session.tournamentId,
        action: 'match_assigned',
      },
    });
  }

  /**
   * Remove match assignment from referee
   */
  async unassignMatchFromReferee(
    refereeId: string,
    matchId: string
  ): Promise<void> {
    const session = this.sessions.get(refereeId);
    if (!session) return;

    // Remove from assigned matches
    session.permissions.assignedMatches =
      session.permissions.assignedMatches.filter(id => id !== matchId);

    // Remove from current matches
    session.currentMatches = session.currentMatches.filter(
      id => id !== matchId
    );

    session.lastActivity = Date.now();
    await this.persistData();
  }

  /**
   * Cleanup expired invitations and inactive sessions
   */
  private scheduleCleanup(): void {
    setInterval(
      async () => {
        await this.cleanupExpiredData();
      },
      60 * 60 * 1000
    ); // Run every hour
  }

  private async cleanupExpiredData(): Promise<void> {
    try {
      const now = Date.now();
      let hasChanges = false;

      // Clean up expired invitations
      for (const [id, invitation] of this.invitations) {
        if (invitation.expiresAt < now && invitation.status === 'pending') {
          invitation.status = 'expired';
          hasChanges = true;
        }
      }

      // Clean up inactive sessions (inactive for more than 24 hours)
      const inactiveThreshold = now - 24 * 60 * 60 * 1000;
      for (const [refereeId, session] of this.sessions) {
        if (session.lastActivity < inactiveThreshold) {
          session.isActive = false;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await this.persistData();
      }
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
    }
  }

  /**
   * Get invitation statistics for tournament organizer
   */
  getInvitationStats(tournamentId: string): {
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    revoked: number;
    activeReferees: number;
  } {
    const invitations = this.getTournamentInvitations(tournamentId);
    const activeReferees = this.getActiveReferees(tournamentId);

    return {
      total: invitations.length,
      pending: invitations.filter(i => i.status === 'pending').length,
      accepted: invitations.filter(i => i.status === 'accepted').length,
      expired: invitations.filter(i => i.status === 'expired').length,
      revoked: invitations.filter(i => i.status === 'revoked').length,
      activeReferees: activeReferees.length,
    };
  }

  /**
   * Cleanup and dispose
   */
  async cleanup(): Promise<void> {
    this.invitations.clear();
    this.sessions.clear();
    this.accessAttempts.clear();
  }
}

export const refereeAccessService = new RefereeAccessService();

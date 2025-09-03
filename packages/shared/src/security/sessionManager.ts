import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface SessionData {
  sessionId: string;
  userId: string;
  deviceId: string;
  userAgent: string;
  ipAddress: string;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  metadata: {
    loginMethod: 'password' | 'oauth' | 'sso' | 'api_key';
    deviceType: 'mobile' | 'desktop' | 'tablet' | 'api';
    location?: {
      country: string;
      region: string;
      city: string;
    };
    riskScore: number;
    flags: string[];
  };
  permissions: string[];
  refreshTokens: string[];
}

export interface SessionConfig {
  maxSessions: number;
  sessionTimeout: number;
  inactivityTimeout: number;
  renewalThreshold: number;
  cookieName: string;
  cookieOptions: {
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    domain?: string;
    path?: string;
  };
  rememberMeTimeout: number;
  concurrentSessionLimit: number;
  enableDeviceTracking: boolean;
  enableLocationTracking: boolean;
}

export interface DeviceFingerprint {
  id: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  plugins: string[];
  canvas?: string;
  webgl?: string;
  fonts: string[];
  hash: string;
  isBot: boolean;
  confidence: number;
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, SessionData>();
  private userSessions = new Map<string, Set<string>>();
  private deviceSessions = new Map<string, Set<string>>();
  private config: SessionConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<SessionConfig> = {}) {
    super();

    this.config = {
      maxSessions: 1000,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      inactivityTimeout: 30 * 60 * 1000, // 30 minutes
      renewalThreshold: 60 * 60 * 1000, // 1 hour
      cookieName: 'session_id',
      cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      },
      rememberMeTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days
      concurrentSessionLimit: 5,
      enableDeviceTracking: true,
      enableLocationTracking: false,
      ...config,
    };

    this.startCleanupProcess();
  }

  async createSession(
    userId: string,
    req: Request,
    options: {
      rememberMe?: boolean;
      loginMethod?: SessionData['metadata']['loginMethod'];
      permissions?: string[];
    } = {}
  ): Promise<SessionData> {
    const sessionId = this.generateSessionId();
    const deviceId = this.generateDeviceId(req);
    const now = new Date();

    const timeout = options.rememberMe
      ? this.config.rememberMeTimeout
      : this.config.sessionTimeout;
    const expiresAt = new Date(now.getTime() + timeout);

    // Check concurrent session limit
    const userSessionCount = this.userSessions.get(userId)?.size || 0;
    if (userSessionCount >= this.config.concurrentSessionLimit) {
      await this.enforceSessionLimit(userId);
    }

    const session: SessionData = {
      sessionId,
      userId,
      deviceId,
      userAgent: req.get('User-Agent') || '',
      ipAddress: req.ip || req.connection.remoteAddress || '',
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      isActive: true,
      metadata: {
        loginMethod: options.loginMethod || 'password',
        deviceType: this.detectDeviceType(req.get('User-Agent') || ''),
        location: await this.getLocationFromIP(req.ip || ''),
        riskScore: await this.calculateRiskScore(req, userId),
        flags: [],
      },
      permissions: options.permissions || [],
      refreshTokens: [],
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Update user sessions tracking
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    // Update device sessions tracking
    if (!this.deviceSessions.has(deviceId)) {
      this.deviceSessions.set(deviceId, new Set());
    }
    this.deviceSessions.get(deviceId)!.add(sessionId);

    this.emit('sessionCreated', session);
    return session;
  }

  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    if (!this.isSessionValid(session)) {
      this.destroySession(sessionId);
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = new Date();
    this.sessions.set(sessionId, session);

    return session;
  }

  async renewSession(sessionId: string): Promise<SessionData | null> {
    const session = this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const now = new Date();
    const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();

    // Only renew if within renewal threshold
    if (timeUntilExpiry < this.config.renewalThreshold) {
      session.expiresAt = new Date(now.getTime() + this.config.sessionTimeout);
      session.lastAccessedAt = now;
      this.sessions.set(sessionId, session);

      this.emit('sessionRenewed', session);
    }

    return session;
  }

  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    // Remove from all tracking maps
    this.sessions.delete(sessionId);
    this.userSessions.get(session.userId)?.delete(sessionId);
    this.deviceSessions.get(session.deviceId)?.delete(sessionId);

    this.emit('sessionDestroyed', session);
    return true;
  }

  destroyAllUserSessions(userId: string): number {
    const userSessions = this.userSessions.get(userId);

    if (!userSessions) {
      return 0;
    }

    let count = 0;
    for (const sessionId of userSessions) {
      if (this.destroySession(sessionId)) {
        count++;
      }
    }

    this.userSessions.delete(userId);
    return count;
  }

  getUserSessions(userId: string): SessionData[] {
    const sessionIds = this.userSessions.get(userId);

    if (!sessionIds) {
      return [];
    }

    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter(
        (session): session is SessionData =>
          !!session && this.isSessionValid(session)
      );
  }

  getDeviceSessions(deviceId: string): SessionData[] {
    const sessionIds = this.deviceSessions.get(deviceId);

    if (!sessionIds) {
      return [];
    }

    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter(
        (session): session is SessionData =>
          !!session && this.isSessionValid(session)
      );
  }

  async flagSuspiciousSession(
    sessionId: string,
    reason: string,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return;
    }

    session.metadata.flags.push(`${severity}:${reason}`);
    session.metadata.riskScore +=
      severity === 'high' ? 30 : severity === 'medium' ? 20 : 10;

    // Auto-terminate high-risk sessions
    if (session.metadata.riskScore > 80) {
      await this.terminateHighRiskSession(session);
    }

    this.emit('suspiciousActivity', { session, reason, severity });
  }

  private async terminateHighRiskSession(session: SessionData): Promise<void> {
    session.isActive = false;
    session.metadata.flags.push('auto-terminated:high-risk');

    this.emit('highRiskSessionTerminated', session);
    this.destroySession(session.sessionId);
  }

  private isSessionValid(session: SessionData): boolean {
    const now = new Date();

    // Check if session is active
    if (!session.isActive) {
      return false;
    }

    // Check expiry
    if (session.expiresAt <= now) {
      return false;
    }

    // Check inactivity timeout
    const inactiveTime = now.getTime() - session.lastAccessedAt.getTime();
    if (inactiveTime > this.config.inactivityTimeout) {
      return false;
    }

    return true;
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const sessions = this.getUserSessions(userId).sort(
      (a, b) => a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime()
    );

    // Remove oldest sessions
    const sessionsToRemove = sessions.slice(
      0,
      sessions.length - this.config.concurrentSessionLimit + 1
    );

    for (const session of sessionsToRemove) {
      this.destroySession(session.sessionId);
    }
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateDeviceId(req: Request): string {
    const fingerprint = this.createDeviceFingerprint(req);
    return crypto.createHash('sha256').update(fingerprint.hash).digest('hex');
  }

  private createDeviceFingerprint(req: Request): DeviceFingerprint {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';

    const fingerprintData = [
      userAgent,
      acceptLanguage,
      acceptEncoding,
      req.ip || '',
    ].join('|');

    const hash = crypto
      .createHash('sha256')
      .update(fingerprintData)
      .digest('hex');

    return {
      id: hash.substring(0, 16),
      userAgent,
      screenResolution: 'unknown',
      timezone: 'unknown',
      language: acceptLanguage.split(',')[0] || 'en',
      platform: this.extractPlatform(userAgent),
      plugins: [],
      fonts: [],
      hash,
      isBot: this.detectBot(userAgent),
      confidence: 0.7, // Lower confidence for server-side fingerprinting
    };
  }

  private extractPlatform(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad'))
      return 'iOS';
    return 'Unknown';
  }

  private detectBot(userAgent: string): boolean {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /googlebot/i,
      /bingbot/i,
      /slurp/i,
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  private detectDeviceType(
    userAgent: string
  ): SessionData['metadata']['deviceType'] {
    if (/mobile|android|iphone|ipad/i.test(userAgent)) {
      return /ipad|tablet/i.test(userAgent) ? 'tablet' : 'mobile';
    }
    if (/postman|insomnia|curl|wget/i.test(userAgent)) {
      return 'api';
    }
    return 'desktop';
  }

  private async getLocationFromIP(
    ip: string
  ): Promise<SessionData['metadata']['location'] | undefined> {
    if (!this.config.enableLocationTracking || !ip || ip === '127.0.0.1') {
      return undefined;
    }

    // This would integrate with a GeoIP service
    // For now, return undefined
    return undefined;
  }

  private async calculateRiskScore(
    req: Request,
    userId: string
  ): Promise<number> {
    let score = 0;

    // Base risk factors
    const userAgent = req.get('User-Agent') || '';

    // Missing or suspicious user agent
    if (!userAgent || userAgent.length < 10) {
      score += 20;
    }

    // Bot detection
    if (this.detectBot(userAgent)) {
      score += 30;
    }

    // Proxy/VPN detection would go here
    // score += await this.checkForProxy(req.ip);

    // Check for unusual headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip'];
    if (suspiciousHeaders.some(header => req.get(header))) {
      score += 10;
    }

    // Time-based risk (unusual login hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  private startCleanupProcess(): void {
    // Clean up expired sessions every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      5 * 60 * 1000
    );
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (!this.isSessionValid(session)) {
        this.destroySession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.emit('sessionsCleanup', { count: cleanedCount, timestamp: now });
    }
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const sessionId =
        req.cookies?.[this.config.cookieName] || req.headers['x-session-id'];

      if (sessionId) {
        const session = this.getSession(sessionId as string);

        if (session) {
          (req as any).session = session;
          (req as any).user = {
            userId: session.userId,
            sessionId: session.sessionId,
            permissions: session.permissions,
          };

          // Set/refresh cookie
          res.cookie(
            this.config.cookieName,
            sessionId,
            this.config.cookieOptions
          );
        } else {
          // Clear invalid cookie
          res.clearCookie(this.config.cookieName);
        }
      }

      next();
    };
  }

  getStats(): {
    totalSessions: number;
    activeSessions: number;
    activeUsers: number;
    averageSessionDuration: number;
    sessionsPerDevice: Record<string, number>;
  } {
    const now = new Date();
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => this.isSessionValid(s));

    const sessionDurations = activeSessions.map(
      s => now.getTime() - s.createdAt.getTime()
    );

    const averageSessionDuration =
      sessionDurations.length > 0
        ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
        : 0;

    const sessionsPerDevice: Record<string, number> = {};
    activeSessions.forEach(session => {
      const deviceType = session.metadata.deviceType;
      sessionsPerDevice[deviceType] = (sessionsPerDevice[deviceType] || 0) + 1;
    });

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      activeUsers: this.userSessions.size,
      averageSessionDuration,
      sessionsPerDevice,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.sessions.clear();
    this.userSessions.clear();
    this.deviceSessions.clear();
    this.removeAllListeners();
  }
}

export default SessionManager;

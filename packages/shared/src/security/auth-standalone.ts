import crypto from 'crypto';

// Standalone authentication types and utilities (no external deps)

export interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
  algorithm: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface UserPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  organizationId?: string;
  tournamentId?: string;
  sessionId: string;
}

export interface APIKeyConfig {
  keyId: string;
  hashedKey: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  allowedIPs?: string[];
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  provider: 'google' | 'facebook' | 'apple' | 'microsoft';
}

export class BasicAuthManager {
  private config: JWTConfig;
  private blacklistedTokens = new Set<string>();
  private keys = new Map<string, APIKeyConfig>();

  constructor(config: JWTConfig) {
    this.config = config;
  }

  generateSessionId(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  generateAPIKey(): { keyId: string; apiKey: string } {
    const keyId = crypto.randomUUID();
    const apiKey = this.generateSecureKey();
    return { keyId, apiKey: `pk_${keyId}_${apiKey}` };
  }

  async hashPassword(password: string, saltRounds = 12): Promise<string> {
    // Simple hash using built-in crypto (in production, use bcrypt)
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const [salt, hash] = hashedPassword.split(':');
    const hashBuffer = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), hashBuffer);
  }

  revokeToken(token: string): void {
    this.blacklistedTokens.add(token);
  }

  isTokenRevoked(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  private generateSecureKey(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 3600; // 1 hour default
    }
  }
}

export default BasicAuthManager;
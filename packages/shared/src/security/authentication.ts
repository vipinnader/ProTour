import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';

export interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
  algorithm: jwt.Algorithm;
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

export class JWTManager {
  private config: JWTConfig;
  private blacklistedTokens = new Set<string>();

  constructor(config: JWTConfig) {
    this.config = config;
  }

  generateTokens(payload: UserPayload): AuthTokens {
    const sessionId = crypto.randomUUID();
    const enhancedPayload = {
      ...payload,
      sessionId,
      iss: this.config.issuer,
      aud: this.config.audience,
    };

    const signOptions: SignOptions = {
      algorithm: this.config.algorithm,
      expiresIn: this.config.accessTokenExpiry,
      issuer: this.config.issuer,
      audience: this.config.audience,
    };

    const refreshSignOptions: SignOptions = {
      ...signOptions,
      expiresIn: this.config.refreshTokenExpiry,
    };

    const accessToken = jwt.sign(enhancedPayload, this.config.accessTokenSecret, signOptions);
    const refreshToken = jwt.sign(
      { userId: payload.userId, sessionId, type: 'refresh' },
      this.config.refreshTokenSecret,
      refreshSignOptions
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(this.config.accessTokenExpiry),
      tokenType: 'Bearer',
    };
  }

  verifyAccessToken(token: string): UserPayload {
    if (this.blacklistedTokens.has(token)) {
      throw new Error('Token has been revoked');
    }

    const verifyOptions: VerifyOptions = {
      algorithms: [this.config.algorithm],
      issuer: this.config.issuer,
      audience: this.config.audience,
    };

    const decoded = jwt.verify(token, this.config.accessTokenSecret, verifyOptions) as JwtPayload;
    
    if (!decoded.userId || !decoded.email || !decoded.role) {
      throw new Error('Invalid token payload');
    }

    return decoded as UserPayload;
  }

  verifyRefreshToken(token: string): { userId: string; sessionId: string } {
    if (this.blacklistedTokens.has(token)) {
      throw new Error('Refresh token has been revoked');
    }

    const verifyOptions: VerifyOptions = {
      algorithms: [this.config.algorithm],
      issuer: this.config.issuer,
      audience: this.config.audience,
    };

    const decoded = jwt.verify(token, this.config.refreshTokenSecret, verifyOptions) as JwtPayload;
    
    if (!decoded.userId || !decoded.sessionId || decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token payload');
    }

    return { userId: decoded.userId, sessionId: decoded.sessionId };
  }

  refreshTokens(refreshToken: string, userPayload: UserPayload): AuthTokens {
    const { userId, sessionId } = this.verifyRefreshToken(refreshToken);
    
    if (userId !== userPayload.userId) {
      throw new Error('Token user mismatch');
    }

    this.blacklistedTokens.add(refreshToken);
    
    return this.generateTokens({
      ...userPayload,
      sessionId,
    });
  }

  revokeToken(token: string): void {
    this.blacklistedTokens.add(token);
  }

  revokeAllUserTokens(userId: string): void {
    // In production, this would require a database lookup to find all user tokens
    // For now, we'll implement basic session invalidation
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

export class APIKeyManager {
  private keys = new Map<string, APIKeyConfig>();
  private saltRounds = 12;

  async generateAPIKey(config: Omit<APIKeyConfig, 'keyId' | 'hashedKey' | 'createdAt'>): Promise<{ keyId: string; apiKey: string }> {
    const keyId = crypto.randomUUID();
    const apiKey = this.generateSecureKey();
    const hashedKey = await bcrypt.hash(apiKey, this.saltRounds);

    const keyConfig: APIKeyConfig = {
      ...config,
      keyId,
      hashedKey,
      createdAt: new Date(),
    };

    this.keys.set(keyId, keyConfig);

    return { keyId, apiKey: `pk_${keyId}_${apiKey}` };
  }

  async verifyAPIKey(apiKeyString: string): Promise<APIKeyConfig | null> {
    const parts = apiKeyString.split('_');
    if (parts.length !== 3 || parts[0] !== 'pk') {
      return null;
    }

    const keyId = parts[1];
    const key = parts[2];
    
    const config = this.keys.get(keyId);
    if (!config || !config.isActive) {
      return null;
    }

    if (config.expiresAt && config.expiresAt < new Date()) {
      return null;
    }

    const isValid = await bcrypt.compare(key, config.hashedKey);
    if (!isValid) {
      return null;
    }

    // Update last used timestamp
    config.lastUsedAt = new Date();

    return config;
  }

  async revokeAPIKey(keyId: string): Promise<boolean> {
    const config = this.keys.get(keyId);
    if (!config) {
      return false;
    }

    config.isActive = false;
    return true;
  }

  listAPIKeys(showSensitive = false): Partial<APIKeyConfig>[] {
    return Array.from(this.keys.values()).map(config => ({
      keyId: config.keyId,
      name: config.name,
      permissions: config.permissions,
      rateLimit: config.rateLimit,
      allowedIPs: config.allowedIPs,
      expiresAt: config.expiresAt,
      isActive: config.isActive,
      createdAt: config.createdAt,
      lastUsedAt: config.lastUsedAt,
      ...(showSensitive && { hashedKey: config.hashedKey }),
    }));
  }

  private generateSecureKey(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}

export class OAuth2Manager {
  private providers = new Map<string, OAuth2Config>();

  registerProvider(providerId: string, config: OAuth2Config): void {
    this.providers.set(providerId, config);
  }

  generateAuthURL(providerId: string, state?: string): string {
    const config = this.providers.get(providerId);
    if (!config) {
      throw new Error(`OAuth2 provider ${providerId} not configured`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope.join(' '),
      response_type: 'code',
      ...(state && { state }),
    });

    const baseURL = this.getProviderAuthURL(config.provider);
    return `${baseURL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(providerId: string, code: string, state?: string): Promise<any> {
    const config = this.providers.get(providerId);
    if (!config) {
      throw new Error(`OAuth2 provider ${providerId} not configured`);
    }

    const tokenURL = this.getProviderTokenURL(config.provider);
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });

    const response = await fetch(tokenURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 token exchange failed: ${response.statusText}`);
    }

    return response.json();
  }

  private getProviderAuthURL(provider: OAuth2Config['provider']): string {
    const urls = {
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
      apple: 'https://appleid.apple.com/auth/authorize',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    };
    return urls[provider];
  }

  private getProviderTokenURL(provider: OAuth2Config['provider']): string {
    const urls = {
      google: 'https://oauth2.googleapis.com/token',
      facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
      apple: 'https://appleid.apple.com/auth/token',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    };
    return urls[provider];
  }
}

// Authentication middleware
export const authenticateJWT = (jwtManager: JWTManager) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token missing' });
    }

    try {
      const payload = jwtManager.verifyAccessToken(token);
      (req as any).user = payload;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
};

// API Key authentication middleware
export const authenticateAPIKey = (apiKeyManager: APIKeyManager) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key missing' });
    }

    try {
      const keyConfig = await apiKeyManager.verifyAPIKey(apiKey);
      if (!keyConfig) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Check IP restrictions
      if (keyConfig.allowedIPs && keyConfig.allowedIPs.length > 0) {
        const clientIP = req.ip || req.connection.remoteAddress;
        if (!keyConfig.allowedIPs.includes(clientIP)) {
          return res.status(403).json({ error: 'IP address not allowed' });
        }
      }

      (req as any).apiKey = keyConfig;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'API key verification failed' });
    }
  };
};

// Combined authentication middleware (JWT or API Key)
export const authenticate = (jwtManager: JWTManager, apiKeyManager: APIKeyManager) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    if (authHeader) {
      // Try JWT authentication
      return authenticateJWT(jwtManager)(req, res, next);
    } else if (apiKey) {
      // Try API Key authentication
      return authenticateAPIKey(apiKeyManager)(req, res, next);
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }
  };
};

export default {
  JWTManager,
  APIKeyManager,
  OAuth2Manager,
  authenticateJWT,
  authenticateAPIKey,
  authenticate,
};
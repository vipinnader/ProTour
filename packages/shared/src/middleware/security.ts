/**
 * API rate limiting and security middleware for ProTour
 * Provides rate limiting, request validation, CORS, and security headers
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  statusCode?: number;
  headers?: boolean; // Include rate limit info in headers
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
  onLimitReached?: (req: any, res: any) => void;
}

export interface SecurityConfig {
  cors?: {
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  };
  helmet?: {
    contentSecurityPolicy?: boolean;
    crossOriginEmbedderPolicy?: boolean;
    crossOriginOpenerPolicy?: boolean;
    crossOriginResourcePolicy?: boolean;
    dnsPrefetchControl?: boolean;
    frameguard?: boolean;
    hidePoweredBy?: boolean;
    hsts?: boolean;
    ieNoOpen?: boolean;
    noSniff?: boolean;
    originAgentCluster?: boolean;
    permittedCrossDomainPolicies?: boolean;
    referrerPolicy?: boolean;
    xssFilter?: boolean;
  };
  rateLimiting?: {
    global?: RateLimitConfig;
    perRoute?: Record<string, RateLimitConfig>;
    perUser?: RateLimitConfig;
    perIP?: RateLimitConfig;
  };
  requestValidation?: {
    maxBodySize?: string; // e.g., '10mb'
    allowedContentTypes?: string[];
    requireContentType?: boolean;
  };
  apiKeys?: {
    headerName?: string;
    queryParam?: string;
    required?: boolean;
    validation?: (key: string) => Promise<boolean>;
  };
}

export interface RequestMetrics {
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  timestamp: Date;
  responseTime?: number;
  statusCode?: number;
  userId?: string;
  apiKey?: string;
}

export interface SecurityContext {
  ip: string;
  userAgent: string;
  isRateLimited: boolean;
  apiKeyValid: boolean;
  requestId: string;
  timestamp: Date;
  metrics: RequestMetrics;
}

export abstract class RateLimitStore {
  abstract get(key: string): Promise<number | null>;
  abstract set(key: string, value: number, ttlMs: number): Promise<void>;
  abstract increment(key: string, ttlMs: number): Promise<number>;
  abstract delete(key: string): Promise<void>;
  abstract clear(): Promise<void>;
}

export class MemoryRateLimitStore extends RateLimitStore {
  private store = new Map<string, { value: number; expires: number }>();

  async get(key: string): Promise<number | null> {
    const item = this.store.get(key);
    if (!item || item.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: number, ttlMs: number): Promise<void> {
    this.store.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const current = await this.get(key);
    const newValue = (current || 0) + 1;
    await this.set(key, newValue, ttlMs);
    return newValue;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.expires < now) {
        this.store.delete(key);
      }
    }
  }
}

export class RedisRateLimitStore extends RateLimitStore {
  private redis: any; // Redis client

  constructor(redisClient: any) {
    super();
    this.redis = redisClient;
  }

  async get(key: string): Promise<number | null> {
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : null;
  }

  async set(key: string, value: number, ttlMs: number): Promise<void> {
    await this.redis.setex(key, Math.ceil(ttlMs / 1000), value.toString());
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, Math.ceil(ttlMs / 1000));
    const results = await pipeline.exec();
    return results[0][1];
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    // Be careful with this in production
    const keys = await this.redis.keys('rate_limit:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

export class RateLimiter {
  private store: RateLimitStore;
  private config: RateLimitConfig;

  constructor(store: RateLimitStore, config: RateLimitConfig) {
    this.store = store;
    this.config = config;
  }

  async checkLimit(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalHits: number;
  }> {
    const count = await this.store.increment(key, this.config.windowMs);
    const resetTime = Date.now() + this.config.windowMs;

    const allowed = count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - count);

    return {
      allowed,
      remaining,
      resetTime,
      totalHits: count,
    };
  }

  generateKey(req: any, prefix = 'rate_limit'): string {
    if (this.config.keyGenerator) {
      return `${prefix}:${this.config.keyGenerator(req)}`;
    }

    // Default key generation
    const ip = this.getClientIP(req);
    const userId = req.user?.id || req.headers['x-user-id'];
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (apiKey) return `${prefix}:api_key:${apiKey}`;
    if (userId) return `${prefix}:user:${userId}`;
    return `${prefix}:ip:${ip}`;
  }

  private getClientIP(req: any): string {
    return (
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }
}

export class SecurityMiddleware {
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private config: SecurityConfig;
  private store: RateLimitStore;

  constructor(config: SecurityConfig, store?: RateLimitStore) {
    this.config = config;
    this.store = store || new MemoryRateLimitStore();
    this.initializeRateLimiters();
  }

  private initializeRateLimiters(): void {
    if (this.config.rateLimiting?.global) {
      this.rateLimiters.set(
        'global',
        new RateLimiter(this.store, this.config.rateLimiting.global)
      );
    }

    if (this.config.rateLimiting?.perUser) {
      this.rateLimiters.set(
        'user',
        new RateLimiter(this.store, this.config.rateLimiting.perUser)
      );
    }

    if (this.config.rateLimiting?.perIP) {
      this.rateLimiters.set(
        'ip',
        new RateLimiter(this.store, this.config.rateLimiting.perIP)
      );
    }

    if (this.config.rateLimiting?.perRoute) {
      Object.entries(this.config.rateLimiting.perRoute).forEach(
        ([route, config]) => {
          this.rateLimiters.set(
            `route:${route}`,
            new RateLimiter(this.store, config)
          );
        }
      );
    }
  }

  // Express.js middleware
  expressMiddleware() {
    return async (req: any, res: any, next: any) => {
      const context = await this.createSecurityContext(req);
      req.security = context;

      try {
        // Apply security headers
        this.applySecurityHeaders(req, res);

        // Validate request
        const validationResult = this.validateRequest(req);
        if (!validationResult.valid) {
          return res.status(400).json({
            error: 'Invalid request',
            message: validationResult.message,
          });
        }

        // Check API key
        const apiKeyResult = await this.validateApiKey(req);
        if (!apiKeyResult.valid) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: apiKeyResult.message,
          });
        }

        // Apply rate limiting
        const rateLimitResult = await this.applyRateLimit(req);
        if (!rateLimitResult.allowed) {
          this.setRateLimitHeaders(res, rateLimitResult);
          return res.status(429).json({
            error: 'Too Many Requests',
            message: rateLimitResult.message || 'Rate limit exceeded',
            retryAfter: Math.ceil(rateLimitResult.resetTime! / 1000),
          });
        }

        this.setRateLimitHeaders(res, rateLimitResult);
        next();
      } catch (error) {
        console.error('[Security] Middleware error:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Security check failed',
        });
      }
    };
  }

  // Cloud Functions middleware
  cloudFunctionMiddleware() {
    return async (req: any, res: any) => {
      const context = await this.createSecurityContext(req);

      // Apply CORS
      if (this.config.cors) {
        this.applyCORS(req, res);
        if (req.method === 'OPTIONS') {
          return res.status(204).send('');
        }
      }

      // Apply other security checks
      const validationResult = this.validateRequest(req);
      if (!validationResult.valid) {
        return res.status(400).json({
          error: 'Invalid request',
          message: validationResult.message,
        });
      }

      const apiKeyResult = await this.validateApiKey(req);
      if (!apiKeyResult.valid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: apiKeyResult.message,
        });
      }

      const rateLimitResult = await this.applyRateLimit(req);
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
        });
      }

      return { context, allowed: true };
    };
  }

  private async createSecurityContext(req: any): Promise<SecurityContext> {
    const ip = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const requestId = this.generateRequestId();

    const metrics: RequestMetrics = {
      ip,
      userAgent,
      path: req.path || req.url,
      method: req.method,
      timestamp: new Date(),
      userId: req.user?.id,
      apiKey: req.headers['x-api-key'] || req.query.api_key,
    };

    return {
      ip,
      userAgent,
      isRateLimited: false,
      apiKeyValid: false,
      requestId,
      timestamp: new Date(),
      metrics,
    };
  }

  private applyCORS(req: any, res: any): void {
    const corsConfig = this.config.cors;
    if (!corsConfig) return;

    // Origin
    if (corsConfig.origin) {
      if (typeof corsConfig.origin === 'boolean') {
        res.setHeader(
          'Access-Control-Allow-Origin',
          corsConfig.origin ? '*' : 'null'
        );
      } else if (Array.isArray(corsConfig.origin)) {
        const origin = req.headers.origin;
        if (corsConfig.origin.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else {
        res.setHeader('Access-Control-Allow-Origin', corsConfig.origin);
      }
    }

    // Methods
    if (corsConfig.methods) {
      res.setHeader(
        'Access-Control-Allow-Methods',
        corsConfig.methods.join(', ')
      );
    }

    // Headers
    if (corsConfig.allowedHeaders) {
      res.setHeader(
        'Access-Control-Allow-Headers',
        corsConfig.allowedHeaders.join(', ')
      );
    }

    // Credentials
    if (corsConfig.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Max Age
    if (corsConfig.maxAge) {
      res.setHeader('Access-Control-Max-Age', corsConfig.maxAge.toString());
    }
  }

  private applySecurityHeaders(req: any, res: any): void {
    const helmetConfig = this.config.helmet;
    if (!helmetConfig) return;

    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Download-Options', 'noopen');

    if (helmetConfig.hidePoweredBy !== false) {
      res.removeHeader('X-Powered-By');
    }

    if (helmetConfig.hsts !== false) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    if (helmetConfig.contentSecurityPolicy !== false) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      );
    }
  }

  private validateRequest(req: any): { valid: boolean; message?: string } {
    const validation = this.config.requestValidation;
    if (!validation) return { valid: true };

    // Content type validation
    if (validation.requireContentType && !req.headers['content-type']) {
      return {
        valid: false,
        message: 'Content-Type header is required',
      };
    }

    if (validation.allowedContentTypes) {
      const contentType = req.headers['content-type']?.split(';')[0];
      if (
        contentType &&
        !validation.allowedContentTypes.includes(contentType)
      ) {
        return {
          valid: false,
          message: `Content-Type ${contentType} is not allowed`,
        };
      }
    }

    return { valid: true };
  }

  private async validateApiKey(
    req: any
  ): Promise<{ valid: boolean; message?: string }> {
    const apiKeyConfig = this.config.apiKeys;
    if (!apiKeyConfig) return { valid: true };

    let apiKey: string | undefined;

    // Get API key from header or query
    if (apiKeyConfig.headerName) {
      apiKey = req.headers[apiKeyConfig.headerName.toLowerCase()];
    }

    if (!apiKey && apiKeyConfig.queryParam) {
      apiKey = req.query[apiKeyConfig.queryParam];
    }

    if (!apiKey) {
      if (apiKeyConfig.required) {
        return {
          valid: false,
          message: 'API key is required',
        };
      }
      return { valid: true };
    }

    // Validate API key
    if (apiKeyConfig.validation) {
      try {
        const isValid = await apiKeyConfig.validation(apiKey);
        if (!isValid) {
          return {
            valid: false,
            message: 'Invalid API key',
          };
        }
      } catch (error) {
        return {
          valid: false,
          message: 'API key validation failed',
        };
      }
    }

    return { valid: true };
  }

  private async applyRateLimit(req: any): Promise<{
    allowed: boolean;
    remaining?: number;
    resetTime?: number;
    totalHits?: number;
    message?: string;
  }> {
    const results: any[] = [];

    // Global rate limit
    if (this.rateLimiters.has('global')) {
      const limiter = this.rateLimiters.get('global')!;
      const result = await limiter.checkLimit(
        limiter.generateKey(req, 'global')
      );
      results.push(result);
    }

    // User rate limit
    if (this.rateLimiters.has('user') && req.user?.id) {
      const limiter = this.rateLimiters.get('user')!;
      const result = await limiter.checkLimit(limiter.generateKey(req, 'user'));
      results.push(result);
    }

    // IP rate limit
    if (this.rateLimiters.has('ip')) {
      const limiter = this.rateLimiters.get('ip')!;
      const result = await limiter.checkLimit(limiter.generateKey(req, 'ip'));
      results.push(result);
    }

    // Route-specific rate limit
    const routeKey = `route:${req.path || req.url}`;
    if (this.rateLimiters.has(routeKey)) {
      const limiter = this.rateLimiters.get(routeKey)!;
      const result = await limiter.checkLimit(
        limiter.generateKey(req, 'route')
      );
      results.push(result);
    }

    // Check if any limit is exceeded
    const failedResult = results.find(r => !r.allowed);
    if (failedResult) {
      return {
        allowed: false,
        remaining: failedResult.remaining,
        resetTime: failedResult.resetTime,
        totalHits: failedResult.totalHits,
        message: 'Rate limit exceeded',
      };
    }

    // Return the most restrictive remaining count
    const minRemaining = Math.min(...results.map(r => r.remaining));
    const maxResetTime = Math.max(...results.map(r => r.resetTime));

    return {
      allowed: true,
      remaining: minRemaining,
      resetTime: maxResetTime,
    };
  }

  private setRateLimitHeaders(res: any, result: any): void {
    if (result.remaining !== undefined) {
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    }
    if (result.resetTime !== undefined) {
      res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil(result.resetTime / 1000).toString()
      );
    }
    if (result.totalHits !== undefined) {
      res.setHeader('X-RateLimit-Used', result.totalHits.toString());
    }
  }

  private getClientIP(req: any): string {
    return (
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Utility functions for creating common security configurations
export const SecurityPresets = {
  // Basic security for public APIs
  public: (): SecurityConfig => ({
    cors: {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      credentials: true,
      maxAge: 86400,
    },
    helmet: {
      contentSecurityPolicy: true,
      hsts: true,
      hidePoweredBy: true,
      noSniff: true,
      xssFilter: true,
    },
    rateLimiting: {
      global: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
        message: 'Too many requests, please try again later',
      },
      perIP: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
      },
    },
    requestValidation: {
      maxBodySize: '10mb',
      allowedContentTypes: ['application/json', 'multipart/form-data'],
    },
  }),

  // Strict security for admin APIs
  admin: (): SecurityConfig => ({
    cors: {
      origin: ['https://admin.protour.com'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
    helmet: {
      contentSecurityPolicy: true,
      hsts: true,
      hidePoweredBy: true,
      noSniff: true,
      xssFilter: true,
      frameguard: true,
    },
    rateLimiting: {
      global: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
      },
      perUser: {
        windowMs: 5 * 60 * 1000,
        maxRequests: 50,
      },
    },
    apiKeys: {
      headerName: 'X-API-Key',
      required: true,
      validation: async (key: string) => {
        // Implement API key validation logic
        return key.startsWith('protour_admin_');
      },
    },
  }),

  // Mobile app security
  mobile: (): SecurityConfig => ({
    cors: {
      origin: false, // Mobile apps don't need CORS
    },
    rateLimiting: {
      perUser: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60,
      },
      perIP: {
        windowMs: 60 * 1000,
        maxRequests: 100,
      },
    },
    requestValidation: {
      maxBodySize: '50mb', // Allow larger uploads from mobile
      allowedContentTypes: [
        'application/json',
        'multipart/form-data',
        'image/jpeg',
        'image/png',
      ],
    },
  }),
};

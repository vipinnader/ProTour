import { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: {
    directives?: Record<string, string[]>;
    reportOnly?: boolean;
    reportUri?: string;
  };
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  contentTypeOptions?: boolean;
  xssProtection?: boolean;
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';
  permissionsPolicy?: Record<string, string[]>;
  crossOriginEmbedderPolicy?: 'unsafe-none' | 'require-corp';
  crossOriginOpenerPolicy?:
    | 'unsafe-none'
    | 'same-origin-allow-popups'
    | 'same-origin';
  crossOriginResourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin';
}

export interface CORSConfig {
  origins: string[] | string | boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders?: string[];
  credentials: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export interface EnvironmentConfig {
  development: {
    cors: CORSConfig;
    security: SecurityHeadersConfig;
  };
  staging: {
    cors: CORSConfig;
    security: SecurityHeadersConfig;
  };
  production: {
    cors: CORSConfig;
    security: SecurityHeadersConfig;
  };
}

export class SecurityHeadersManager {
  private config: SecurityHeadersConfig;

  constructor(config: SecurityHeadersConfig) {
    this.config = config;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      this.applySecurityHeaders(res);
      next();
    };
  }

  private applySecurityHeaders(res: Response): void {
    // Content Security Policy
    if (this.config.contentSecurityPolicy) {
      const csp = this.buildCSPHeader(this.config.contentSecurityPolicy);
      const headerName = this.config.contentSecurityPolicy.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
      res.setHeader(headerName, csp);
    }

    // HTTP Strict Transport Security
    if (this.config.hsts) {
      const hstsValue = this.buildHSTSHeader(this.config.hsts);
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // X-Frame-Options
    if (this.config.frameOptions) {
      res.setHeader('X-Frame-Options', this.config.frameOptions);
    }

    // X-Content-Type-Options
    if (this.config.contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection (deprecated but still used by some browsers)
    if (this.config.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (this.config.referrerPolicy) {
      res.setHeader('Referrer-Policy', this.config.referrerPolicy);
    }

    // Permissions-Policy
    if (this.config.permissionsPolicy) {
      const permissionsPolicy = this.buildPermissionsPolicyHeader(
        this.config.permissionsPolicy
      );
      res.setHeader('Permissions-Policy', permissionsPolicy);
    }

    // Cross-Origin-Embedder-Policy
    if (this.config.crossOriginEmbedderPolicy) {
      res.setHeader(
        'Cross-Origin-Embedder-Policy',
        this.config.crossOriginEmbedderPolicy
      );
    }

    // Cross-Origin-Opener-Policy
    if (this.config.crossOriginOpenerPolicy) {
      res.setHeader(
        'Cross-Origin-Opener-Policy',
        this.config.crossOriginOpenerPolicy
      );
    }

    // Cross-Origin-Resource-Policy
    if (this.config.crossOriginResourcePolicy) {
      res.setHeader(
        'Cross-Origin-Resource-Policy',
        this.config.crossOriginResourcePolicy
      );
    }

    // Remove potentially sensitive headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
  }

  private buildCSPHeader(
    csp: NonNullable<SecurityHeadersConfig['contentSecurityPolicy']>
  ): string {
    const directives = csp.directives || {};
    const defaultDirectives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'child-src': ["'self'"],
      'worker-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': [],
    };

    const mergedDirectives = { ...defaultDirectives, ...directives };
    const policyParts: string[] = [];

    for (const [directive, sources] of Object.entries(mergedDirectives)) {
      if (sources.length === 0) {
        policyParts.push(directive);
      } else {
        policyParts.push(`${directive} ${sources.join(' ')}`);
      }
    }

    let policy = policyParts.join('; ');

    if (csp.reportUri) {
      policy += `; report-uri ${csp.reportUri}`;
    }

    return policy;
  }

  private buildHSTSHeader(
    hsts: NonNullable<SecurityHeadersConfig['hsts']>
  ): string {
    const maxAge = hsts.maxAge || 31536000; // 1 year default
    let hstsValue = `max-age=${maxAge}`;

    if (hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }

    if (hsts.preload) {
      hstsValue += '; preload';
    }

    return hstsValue;
  }

  private buildPermissionsPolicyHeader(
    permissions: Record<string, string[]>
  ): string {
    const policies: string[] = [];

    for (const [feature, allowlist] of Object.entries(permissions)) {
      if (allowlist.length === 0) {
        policies.push(`${feature}=()`);
      } else {
        const allowlistStr = allowlist
          .map(origin => (origin === 'self' ? 'self' : `"${origin}"`))
          .join(' ');
        policies.push(`${feature}=(${allowlistStr})`);
      }
    }

    return policies.join(', ');
  }
}

export class CORSManager {
  private config: CORSConfig;

  constructor(config: CORSConfig) {
    this.config = config;
  }

  middleware() {
    const corsOptions: CorsOptions = {
      origin: this.config.origins,
      methods: this.config.methods,
      allowedHeaders: this.config.allowedHeaders,
      exposedHeaders: this.config.exposedHeaders,
      credentials: this.config.credentials,
      maxAge: this.config.maxAge,
      preflightContinue: this.config.preflightContinue,
      optionsSuccessStatus: this.config.optionsSuccessStatus || 204,
    };

    return cors(corsOptions);
  }

  isOriginAllowed(origin: string): boolean {
    if (typeof this.config.origins === 'boolean') {
      return this.config.origins;
    }

    if (typeof this.config.origins === 'string') {
      return this.config.origins === origin;
    }

    if (Array.isArray(this.config.origins)) {
      return this.config.origins.includes(origin);
    }

    return false;
  }
}

export class SecurityConfigManager {
  private environmentConfigs: EnvironmentConfig;

  constructor() {
    this.environmentConfigs = {
      development: {
        cors: {
          origins: [
            'http://localhost:3000',
            'http://localhost:19006',
            'exp://',
          ],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-API-Key',
            'X-Requested-With',
          ],
          exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
          credentials: true,
          maxAge: 86400, // 24 hours
        },
        security: {
          contentSecurityPolicy: {
            directives: {
              'default-src': ["'self'"],
              'script-src': [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                'localhost:*',
                '*.expo.dev',
              ],
              'style-src': ["'self'", "'unsafe-inline'", 'localhost:*'],
              'img-src': ["'self'", 'data:', 'https:', 'localhost:*'],
              'connect-src': [
                "'self'",
                'ws:',
                'wss:',
                'localhost:*',
                '*.expo.dev',
                '*.firebase.googleapis.com',
              ],
              'font-src': ["'self'", 'data:', 'https:'],
            },
          },
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: false,
          },
          frameOptions: 'SAMEORIGIN',
          contentTypeOptions: true,
          xssProtection: true,
          referrerPolicy: 'strict-origin-when-cross-origin',
          crossOriginEmbedderPolicy: 'unsafe-none',
          crossOriginOpenerPolicy: 'same-origin-allow-popups',
          crossOriginResourcePolicy: 'cross-origin',
        },
      },
      staging: {
        cors: {
          origins: [
            'https://staging.protour.app',
            'https://staging-admin.protour.app',
          ],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-API-Key',
            'X-Requested-With',
          ],
          exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
          credentials: true,
          maxAge: 86400,
        },
        security: {
          contentSecurityPolicy: {
            directives: {
              'default-src': ["'self'"],
              'script-src': ["'self'"],
              'style-src': ["'self'", "'unsafe-inline'"],
              'img-src': ["'self'", 'data:', 'https:'],
              'connect-src': [
                "'self'",
                'wss:',
                '*.firebase.googleapis.com',
                '*.razorpay.com',
                '*.stripe.com',
              ],
              'font-src': ["'self'", 'https:'],
              'frame-ancestors': ["'none'"],
            },
            reportUri: '/api/csp-report',
          },
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          },
          frameOptions: 'DENY',
          contentTypeOptions: true,
          xssProtection: true,
          referrerPolicy: 'strict-origin-when-cross-origin',
          permissionsPolicy: {
            camera: [],
            microphone: [],
            geolocation: [],
            payment: ['self'],
          },
          crossOriginEmbedderPolicy: 'require-corp',
          crossOriginOpenerPolicy: 'same-origin',
          crossOriginResourcePolicy: 'same-origin',
        },
      },
      production: {
        cors: {
          origins: [
            'https://protour.app',
            'https://admin.protour.app',
            'https://www.protour.app',
          ],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-API-Key',
            'X-Requested-With',
          ],
          exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
          credentials: true,
          maxAge: 86400,
        },
        security: {
          contentSecurityPolicy: {
            directives: {
              'default-src': ["'self'"],
              'script-src': ["'self'"],
              'style-src': ["'self'", "'unsafe-inline'"],
              'img-src': ["'self'", 'data:', 'https:'],
              'connect-src': [
                "'self'",
                'wss:',
                '*.firebase.googleapis.com',
                '*.razorpay.com',
                '*.stripe.com',
              ],
              'font-src': ["'self'", 'https:'],
              'frame-ancestors': ["'none'"],
              'upgrade-insecure-requests': [],
            },
            reportUri: '/api/csp-report',
          },
          hsts: {
            maxAge: 63072000, // 2 years
            includeSubDomains: true,
            preload: true,
          },
          frameOptions: 'DENY',
          contentTypeOptions: true,
          xssProtection: true,
          referrerPolicy: 'strict-origin-when-cross-origin',
          permissionsPolicy: {
            camera: [],
            microphone: [],
            geolocation: [],
            payment: ['self'],
            fullscreen: ['self'],
            autoplay: [],
          },
          crossOriginEmbedderPolicy: 'require-corp',
          crossOriginOpenerPolicy: 'same-origin',
          crossOriginResourcePolicy: 'same-origin',
        },
      },
    };
  }

  getConfig(environment: keyof EnvironmentConfig): {
    cors: CORSConfig;
    security: SecurityHeadersConfig;
  } {
    return this.environmentConfigs[environment];
  }

  createSecurityHeadersMiddleware(environment: keyof EnvironmentConfig) {
    const config = this.getConfig(environment);
    const manager = new SecurityHeadersManager(config.security);
    return manager.middleware();
  }

  createCORSMiddleware(environment: keyof EnvironmentConfig) {
    const config = this.getConfig(environment);
    const manager = new CORSManager(config.cors);
    return manager.middleware();
  }

  updateEnvironmentConfig(
    environment: keyof EnvironmentConfig,
    updates: Partial<{ cors: CORSConfig; security: SecurityHeadersConfig }>
  ) {
    if (updates.cors) {
      this.environmentConfigs[environment].cors = {
        ...this.environmentConfigs[environment].cors,
        ...updates.cors,
      };
    }
    if (updates.security) {
      this.environmentConfigs[environment].security = {
        ...this.environmentConfigs[environment].security,
        ...updates.security,
      };
    }
  }
}

// CSP Report handler middleware
export const cspReportHandler = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/csp-report' && req.method === 'POST') {
      console.warn('CSP Violation Report:', JSON.stringify(req.body, null, 2));

      // You can implement additional logging here
      // Example: Send to monitoring service, store in database, etc.

      res.status(204).send();
    } else {
      next();
    }
  };
};

// Security headers validation middleware
export const validateSecurityHeaders = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Strict-Transport-Security',
      'Content-Security-Policy',
    ];

    const missingHeaders = requiredHeaders.filter(
      header => !res.getHeader(header)
    );

    if (missingHeaders.length > 0 && process.env.NODE_ENV !== 'development') {
      console.warn(`Missing security headers: ${missingHeaders.join(', ')}`);
    }

    next();
  };
};

export default {
  SecurityHeadersManager,
  CORSManager,
  SecurityConfigManager,
  cspReportHandler,
  validateSecurityHeaders,
};

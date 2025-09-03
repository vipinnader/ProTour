/**
 * Environment-specific service configurations for ProTour
 * Provides centralized configuration management for all environments
 */

// Global declarations
declare global {
  var __DEV__: boolean | undefined;
}

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface EnvironmentConfig {
  environment: Environment;
  app: AppConfig;
  firebase: FirebaseConfig;
  services: ServicesConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  features: FeatureFlags;
}

export interface AppConfig {
  name: string;
  version: string;
  port: number;
  baseUrl: string;
  apiUrl: string;
  webUrl: string;
  mobileDeepLinkScheme: string;
  supportEmail: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxUploadSize: string;
  timeZone: string;
  defaultLanguage: string;
}

export interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  emulators?: {
    auth: { host: string; port: number };
    firestore: { host: string; port: number };
    functions: { host: string; port: number };
    storage: { host: string; port: number };
  };
}

export interface ServicesConfig {
  payment: PaymentServicesConfig;
  email: EmailServicesConfig;
  sms: SMSServicesConfig;
  push: PushServicesConfig;
  analytics: AnalyticsServicesConfig;
  storage: StorageServicesConfig;
  auth: AuthServicesConfig;
}

export interface PaymentServicesConfig {
  razorpay: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
    environment: 'test' | 'live';
  };
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    environment: 'test' | 'live';
  };
}

export interface EmailServicesConfig {
  sendgrid: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
    templateIds: {
      welcome: string;
      tournamentInvite: string;
      matchReminder: string;
      paymentConfirmation: string;
    };
  };
  mailgun: {
    apiKey: string;
    domain: string;
    fromEmail: string;
  };
}

export interface SMSServicesConfig {
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  msg91: {
    apiKey: string;
    senderId: string;
    route: string;
  };
  textlocal: {
    apiKey: string;
    sender: string;
  };
}

export interface PushServicesConfig {
  firebase: {
    serverKey: string;
    vapidKey?: string;
  };
  onesignal: {
    appId: string;
    apiKey: string;
  };
}

export interface AnalyticsServicesConfig {
  googleAnalytics: {
    measurementId: string;
    apiSecret?: string;
  };
  mixpanel: {
    token: string;
    apiSecret?: string;
  };
  amplitude: {
    apiKey: string;
    secretKey?: string;
  };
}

export interface StorageServicesConfig {
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    uploadPresets: {
      tournaments: string;
      profiles: string;
      documents: string;
    };
  };
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
  };
}

export interface AuthServicesConfig {
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  facebook: {
    appId: string;
    appSecret: string;
    redirectUri: string;
  };
  apple: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    redirectUri: string;
  };
  jwt: {
    secret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
  };
}

export interface SecurityConfig {
  cors: {
    origins: string[];
    credentials: boolean;
  };
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  apiKeys: {
    admin: string[];
    mobile: string[];
    webhooks: Record<string, string>;
  };
  encryption: {
    algorithm: string;
    key: string;
    iv: string;
  };
}

export interface MonitoringConfig {
  sentry: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
  };
  healthChecks: {
    interval: number;
    timeout: number;
    endpoints: string[];
  };
  logging: {
    level: string;
    transports: Array<{
      type: 'console' | 'file' | 'cloudLogging';
      options?: any;
    }>;
  };
}

export interface FeatureFlags {
  tournaments: {
    enableAdvancedBrackets: boolean;
    enableLiveStreaming: boolean;
    enableSpectatorMode: boolean;
    maxParticipants: number;
  };
  payments: {
    enableRazorpay: boolean;
    enableStripe: boolean;
    enableWalletTopup: boolean;
    minimumAmount: number;
  };
  social: {
    enableGoogleAuth: boolean;
    enableFacebookAuth: boolean;
    enableAppleAuth: boolean;
    enablePhoneAuth: boolean;
  };
  notifications: {
    enablePush: boolean;
    enableSMS: boolean;
    enableEmail: boolean;
    enableInApp: boolean;
  };
  analytics: {
    enableGoogleAnalytics: boolean;
    enableMixpanel: boolean;
    enableAmplitude: boolean;
    trackingLevel: 'basic' | 'detailed' | 'comprehensive';
  };
  experimental: {
    enableBetaFeatures: boolean;
    enableA11yFeatures: boolean;
    enableOfflineMode: boolean;
  };
}

export class EnvironmentManager {
  private static instance: EnvironmentManager;
  private config: EnvironmentConfig;
  private environment: Environment;

  private constructor() {
    this.environment = this.detectEnvironment();
    this.config = this.loadConfig();
  }

  static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  getConfig(): EnvironmentConfig {
    return this.config;
  }

  getEnvironment(): Environment {
    return this.environment;
  }

  isDevelopment(): boolean {
    return this.environment === 'development';
  }

  isStaging(): boolean {
    return this.environment === 'staging';
  }

  isProduction(): boolean {
    return this.environment === 'production';
  }

  isTest(): boolean {
    return this.environment === 'test';
  }

  private detectEnvironment(): Environment {
    // Check various environment indicators
    if (typeof process !== 'undefined' && process.env) {
      const nodeEnv = process.env.NODE_ENV?.toLowerCase();
      const environment = process.env.ENVIRONMENT?.toLowerCase();
      const stage = process.env.STAGE?.toLowerCase();

      if (nodeEnv === 'test' || environment === 'test') return 'test';
      if (
        nodeEnv === 'production' ||
        environment === 'production' ||
        stage === 'prod'
      )
        return 'production';
      if (environment === 'staging' || stage === 'staging') return 'staging';
    }

    // Check for React Native environment
    if (typeof __DEV__ !== 'undefined') {
      return __DEV__ ? 'development' : 'production';
    }

    // Check for browser environment
    if (typeof window !== 'undefined') {
      const hostname = window.location?.hostname;
      if (hostname?.includes('localhost') || hostname?.includes('127.0.0.1'))
        return 'development';
      if (hostname?.includes('staging') || hostname?.includes('dev'))
        return 'staging';
      return 'production';
    }

    // Default to development
    return 'development';
  }

  private loadConfig(): EnvironmentConfig {
    switch (this.environment) {
      case 'development':
        return this.getDevelopmentConfig();
      case 'staging':
        return this.getStagingConfig();
      case 'production':
        return this.getProductionConfig();
      case 'test':
        return this.getTestConfig();
      default:
        return this.getDevelopmentConfig();
    }
  }

  private getBaseConfig(): Partial<EnvironmentConfig> {
    return {
      app: {
        name: 'ProTour',
        version: process.env.APP_VERSION || '1.0.0',
        port: parseInt(process.env.PORT || '3000', 10),
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
        apiUrl: process.env.API_URL || 'http://localhost:3000/api',
        webUrl: process.env.WEB_URL || 'http://localhost:3000',
        mobileDeepLinkScheme: 'protour',
        supportEmail: 'support@protour.com',
        maxUploadSize: '50mb',
        timeZone: 'Asia/Kolkata',
        defaultLanguage: 'en',
        logLevel: 'info',
      },
    };
  }

  private getDevelopmentConfig(): EnvironmentConfig {
    return {
      environment: 'development',

      app: {
        ...this.getBaseConfig().app!,
        baseUrl: 'http://localhost:3000',
        apiUrl: 'http://localhost:3000/api',
        webUrl: 'http://localhost:3000',
        mobileDeepLinkScheme: 'protour-dev',
        logLevel: 'debug',
      },

      firebase: {
        projectId: 'protour-dev',
        apiKey: 'dev-api-key',
        authDomain: 'protour-dev.firebaseapp.com',
        storageBucket: 'protour-dev.appspot.com',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:dev',
        emulators: {
          auth: { host: 'localhost', port: 9099 },
          firestore: { host: 'localhost', port: 8080 },
          functions: { host: 'localhost', port: 5001 },
          storage: { host: 'localhost', port: 9199 },
        },
      },

      services: {
        payment: {
          razorpay: {
            keyId: process.env.RAZORPAY_KEY_ID_DEV || 'rzp_test_dev',
            keySecret: process.env.RAZORPAY_KEY_SECRET_DEV || 'test_secret',
            webhookSecret:
              process.env.RAZORPAY_WEBHOOK_SECRET_DEV || 'webhook_secret',
            environment: 'test',
          },
          stripe: {
            publishableKey:
              process.env.STRIPE_PUBLISHABLE_KEY_DEV || 'pk_test_dev',
            secretKey: process.env.STRIPE_SECRET_KEY_DEV || 'sk_test_dev',
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET_DEV || 'whsec_dev',
            environment: 'test',
          },
        },
        email: {
          sendgrid: {
            apiKey: process.env.SENDGRID_API_KEY_DEV || 'SG.dev',
            fromEmail: 'dev@protour.com',
            fromName: 'ProTour Dev',
            templateIds: {
              welcome: 'd-welcome-dev',
              tournamentInvite: 'd-invite-dev',
              matchReminder: 'd-reminder-dev',
              paymentConfirmation: 'd-payment-dev',
            },
          },
          mailgun: {
            apiKey: process.env.MAILGUN_API_KEY_DEV || 'mg-dev',
            domain: 'dev.protour.com',
            fromEmail: 'noreply@dev.protour.com',
          },
        },
        sms: {
          twilio: {
            accountSid: process.env.TWILIO_ACCOUNT_SID_DEV || 'ACdev',
            authToken: process.env.TWILIO_AUTH_TOKEN_DEV || 'dev_token',
            phoneNumber: process.env.TWILIO_PHONE_NUMBER_DEV || '+1234567890',
          },
          msg91: {
            apiKey: process.env.MSG91_API_KEY_DEV || 'msg91_dev',
            senderId: 'PRTOUR',
            route: '4',
          },
          textlocal: {
            apiKey: process.env.TEXTLOCAL_API_KEY_DEV || 'tl_dev',
            sender: 'PRTOUR',
          },
        },
        push: {
          firebase: {
            serverKey: process.env.FCM_SERVER_KEY_DEV || 'fcm_dev',
            vapidKey: process.env.FCM_VAPID_KEY_DEV,
          },
          onesignal: {
            appId: process.env.ONESIGNAL_APP_ID_DEV || 'os_dev',
            apiKey: process.env.ONESIGNAL_API_KEY_DEV || 'os_key_dev',
          },
        },
        analytics: {
          googleAnalytics: {
            measurementId: 'G-DEV123456',
            apiSecret: process.env.GA_API_SECRET_DEV,
          },
          mixpanel: {
            token: process.env.MIXPANEL_TOKEN_DEV || 'mp_dev',
            apiSecret: process.env.MIXPANEL_API_SECRET_DEV,
          },
          amplitude: {
            apiKey: process.env.AMPLITUDE_API_KEY_DEV || 'amp_dev',
            secretKey: process.env.AMPLITUDE_SECRET_KEY_DEV,
          },
        },
        storage: {
          cloudinary: {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME_DEV || 'protour-dev',
            apiKey: process.env.CLOUDINARY_API_KEY_DEV || 'cl_dev',
            apiSecret: process.env.CLOUDINARY_API_SECRET_DEV || 'cl_secret_dev',
            uploadPresets: {
              tournaments: 'tournament_preset_dev',
              profiles: 'profile_preset_dev',
              documents: 'document_preset_dev',
            },
          },
          aws: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID_DEV || 'aws_dev',
            secretAccessKey:
              process.env.AWS_SECRET_ACCESS_KEY_DEV || 'aws_secret_dev',
            region: process.env.AWS_REGION_DEV || 'us-east-1',
            bucketName: process.env.AWS_BUCKET_NAME_DEV || 'protour-dev-bucket',
          },
        },
        auth: {
          google: {
            clientId:
              process.env.GOOGLE_CLIENT_ID_DEV ||
              'google_dev.apps.googleusercontent.com',
            clientSecret:
              process.env.GOOGLE_CLIENT_SECRET_DEV || 'google_secret_dev',
            redirectUri: 'http://localhost:3000/auth/google/callback',
          },
          facebook: {
            appId: process.env.FACEBOOK_APP_ID_DEV || 'fb_dev',
            appSecret: process.env.FACEBOOK_APP_SECRET_DEV || 'fb_secret_dev',
            redirectUri: 'http://localhost:3000/auth/facebook/callback',
          },
          apple: {
            clientId: 'com.protour.dev',
            teamId: process.env.APPLE_TEAM_ID || 'TEAM123',
            keyId: process.env.APPLE_KEY_ID || 'KEY123',
            privateKey: process.env.APPLE_PRIVATE_KEY || 'private_key_dev',
            redirectUri: 'http://localhost:3000/auth/apple/callback',
          },
          jwt: {
            secret: process.env.JWT_SECRET || 'jwt_secret_dev_key_very_long',
            accessTokenExpiry: '1h',
            refreshTokenExpiry: '7d',
          },
        },
      },

      security: {
        cors: {
          origins: ['http://localhost:3000', 'http://localhost:19006'],
          credentials: true,
        },
        rateLimiting: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 1000,
          skipSuccessfulRequests: false,
        },
        apiKeys: {
          admin: ['dev_admin_key_123'],
          mobile: ['dev_mobile_key_456'],
          webhooks: {
            razorpay: 'dev_razorpay_webhook_key',
            stripe: 'dev_stripe_webhook_key',
          },
        },
        encryption: {
          algorithm: 'aes-256-cbc',
          key: process.env.ENCRYPTION_KEY || 'dev_encryption_key_32_characters',
          iv: process.env.ENCRYPTION_IV || 'dev_iv_16_chars',
        },
      },

      monitoring: {
        sentry: {
          dsn: process.env.SENTRY_DSN_DEV || '',
          environment: 'development',
          tracesSampleRate: 1.0,
        },
        healthChecks: {
          interval: 60000, // 1 minute
          timeout: 10000, // 10 seconds
          endpoints: [
            'http://localhost:5001/health',
            'http://localhost:8080/health',
          ],
        },
        logging: {
          level: 'debug',
          transports: [
            { type: 'console' },
            { type: 'file', options: { filename: 'logs/dev.log' } },
          ],
        },
      },

      features: {
        tournaments: {
          enableAdvancedBrackets: true,
          enableLiveStreaming: true,
          enableSpectatorMode: true,
          maxParticipants: 1000,
        },
        payments: {
          enableRazorpay: true,
          enableStripe: true,
          enableWalletTopup: true,
          minimumAmount: 1, // ₹1 for testing
        },
        social: {
          enableGoogleAuth: true,
          enableFacebookAuth: true,
          enableAppleAuth: true,
          enablePhoneAuth: true,
        },
        notifications: {
          enablePush: true,
          enableSMS: true,
          enableEmail: true,
          enableInApp: true,
        },
        analytics: {
          enableGoogleAnalytics: true,
          enableMixpanel: true,
          enableAmplitude: true,
          trackingLevel: 'comprehensive',
        },
        experimental: {
          enableBetaFeatures: true,
          enableA11yFeatures: true,
          enableOfflineMode: true,
        },
      },
    };
  }

  private getStagingConfig(): EnvironmentConfig {
    const devConfig = this.getDevelopmentConfig();

    return {
      ...devConfig,
      environment: 'staging',

      app: {
        ...devConfig.app,
        baseUrl: 'https://staging.protour.com',
        apiUrl: 'https://api-staging.protour.com',
        webUrl: 'https://staging.protour.com',
        mobileDeepLinkScheme: 'protour-staging',
        logLevel: 'info',
      },

      firebase: {
        ...devConfig.firebase,
        projectId: 'protour-staging',
        apiKey: process.env.FIREBASE_API_KEY_STAGING || 'staging-api-key',
        authDomain: 'protour-staging.firebaseapp.com',
        storageBucket: 'protour-staging.appspot.com',
        emulators: undefined, // No emulators in staging
      },

      security: {
        ...devConfig.security,
        cors: {
          origins: [
            'https://staging.protour.com',
            'https://admin-staging.protour.com',
          ],
          credentials: true,
        },
        rateLimiting: {
          windowMs: 15 * 60 * 1000,
          maxRequests: 500, // More restrictive than dev
          skipSuccessfulRequests: true,
        },
      },

      monitoring: {
        ...devConfig.monitoring,
        sentry: {
          dsn: process.env.SENTRY_DSN_STAGING || '',
          environment: 'staging',
          tracesSampleRate: 0.5,
        },
        logging: {
          level: 'info',
          transports: [{ type: 'console' }, { type: 'cloudLogging' }],
        },
      },

      features: {
        ...devConfig.features,
        experimental: {
          enableBetaFeatures: true,
          enableA11yFeatures: false,
          enableOfflineMode: false,
        },
      },
    };
  }

  private getProductionConfig(): EnvironmentConfig {
    const stagingConfig = this.getStagingConfig();

    return {
      ...stagingConfig,
      environment: 'production',

      app: {
        ...stagingConfig.app,
        baseUrl: 'https://protour.com',
        apiUrl: 'https://api.protour.com',
        webUrl: 'https://protour.com',
        mobileDeepLinkScheme: 'protour',
        logLevel: 'warn',
      },

      firebase: {
        ...stagingConfig.firebase,
        projectId: 'protour-prod',
        apiKey: process.env.FIREBASE_API_KEY_PROD!,
        authDomain: 'protour-prod.firebaseapp.com',
        storageBucket: 'protour-prod.appspot.com',
      },

      security: {
        ...stagingConfig.security,
        cors: {
          origins: [
            'https://protour.com',
            'https://www.protour.com',
            'https://admin.protour.com',
          ],
          credentials: true,
        },
        rateLimiting: {
          windowMs: 15 * 60 * 1000,
          maxRequests: 200, // Most restrictive
          skipSuccessfulRequests: true,
        },
      },

      monitoring: {
        ...stagingConfig.monitoring,
        sentry: {
          dsn: process.env.SENTRY_DSN_PROD!,
          environment: 'production',
          tracesSampleRate: 0.1,
        },
        logging: {
          level: 'error',
          transports: [{ type: 'cloudLogging' }],
        },
      },

      features: {
        ...stagingConfig.features,
        analytics: {
          ...stagingConfig.features.analytics,
          trackingLevel: 'basic', // Less tracking in production
        },
        experimental: {
          enableBetaFeatures: false,
          enableA11yFeatures: false,
          enableOfflineMode: false,
        },
      },
    };
  }

  private getTestConfig(): EnvironmentConfig {
    const devConfig = this.getDevelopmentConfig();

    return {
      ...devConfig,
      environment: 'test',

      app: {
        ...devConfig.app,
        baseUrl: 'http://localhost:3000',
        apiUrl: 'http://localhost:3000/api',
        webUrl: 'http://localhost:3000',
        mobileDeepLinkScheme: 'protour-test',
        logLevel: 'error', // Minimal logging in tests
      },

      features: {
        ...devConfig.features,
        analytics: {
          enableGoogleAnalytics: false,
          enableMixpanel: false,
          enableAmplitude: false,
          trackingLevel: 'basic',
        },
        notifications: {
          enablePush: false,
          enableSMS: false,
          enableEmail: false,
          enableInApp: false,
        },
        payments: {
          enableRazorpay: false,
          enableStripe: false,
          enableWalletTopup: false,
          minimumAmount: 1,
        },
      },
    };
  }

  // Utility methods
  getServiceConfig<K extends keyof ServicesConfig>(
    service: K
  ): ServicesConfig[K] {
    return this.config.services[service];
  }

  getFeatureFlag<K extends keyof FeatureFlags>(feature: K): FeatureFlags[K] {
    return this.config.features[feature];
  }

  isFeatureEnabled(featurePath: string): boolean {
    const parts = featurePath.split('.');
    let current: any = this.config.features;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    return Boolean(current);
  }

  getFirebaseConfig(): FirebaseConfig {
    return this.config.firebase;
  }

  getSecurityConfig(): SecurityConfig {
    return this.config.security;
  }
}

// Singleton instance
export const environmentManager = EnvironmentManager.getInstance();

// Convenience exports
export const config = environmentManager.getConfig();
export const environment = environmentManager.getEnvironment();
export const isDevelopment = environmentManager.isDevelopment();
export const isProduction = environmentManager.isProduction();
export const isStaging = environmentManager.isStaging();
export const isTest = environmentManager.isTest();

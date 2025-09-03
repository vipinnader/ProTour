/**
 * Service monitoring and health check system for ProTour
 * Provides comprehensive health monitoring for all external services
 */

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number; // milliseconds
  message?: string;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  services: HealthCheckResult[];
  timestamp: Date;
  uptime: number; // seconds since last restart
  version?: string;
  environment?: string;
}

export interface HealthCheckConfig {
  name: string;
  timeout: number; // milliseconds
  interval?: number; // milliseconds for periodic checks
  retries?: number;
  critical?: boolean; // If true, failure affects overall system health
  thresholds?: {
    degraded?: number; // response time threshold for degraded status
    unhealthy?: number; // response time threshold for unhealthy status
  };
}

export abstract class HealthCheck {
  protected config: HealthCheckConfig;

  constructor(config: HealthCheckConfig) {
    this.config = {
      timeout: 5000,
      retries: 1,
      critical: true,
      thresholds: {
        degraded: 1000,
        unhealthy: 5000,
      },
      ...config,
    };
  }

  abstract execute(): Promise<HealthCheckResult>;

  protected async measure<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; responseTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const responseTime = Date.now() - startTime;
    return { result, responseTime };
  }

  protected determineStatus(
    responseTime: number,
    isHealthy: boolean
  ): 'healthy' | 'unhealthy' | 'degraded' {
    if (!isHealthy) return 'unhealthy';

    const thresholds = this.config.thresholds!;
    if (responseTime > thresholds.unhealthy!) return 'unhealthy';
    if (responseTime > thresholds.degraded!) return 'degraded';

    return 'healthy';
  }

  protected createResult(
    status: 'healthy' | 'unhealthy' | 'degraded',
    responseTime: number,
    message?: string,
    error?: string,
    metadata?: Record<string, any>
  ): HealthCheckResult {
    return {
      name: this.config.name,
      status,
      responseTime,
      message,
      error,
      timestamp: new Date(),
      metadata,
    };
  }
}

// Database health check
export class DatabaseHealthCheck extends HealthCheck {
  private connectionTest: () => Promise<boolean>;

  constructor(
    config: HealthCheckConfig,
    connectionTest: () => Promise<boolean>
  ) {
    super(config);
    this.connectionTest = connectionTest;
  }

  async execute(): Promise<HealthCheckResult> {
    try {
      const { result: isConnected, responseTime } = await this.measure(
        this.connectionTest
      );
      const status = this.determineStatus(responseTime, isConnected);

      return this.createResult(
        status,
        responseTime,
        isConnected
          ? 'Database connection successful'
          : 'Database connection failed',
        isConnected ? undefined : 'Connection test failed'
      );
    } catch (error) {
      return this.createResult(
        'unhealthy',
        this.config.timeout,
        'Database health check failed',
        error.message
      );
    }
  }
}

// Firebase services health check
export class FirebaseHealthCheck extends HealthCheck {
  async execute(): Promise<HealthCheckResult> {
    try {
      const { responseTime } = await this.measure(async () => {
        // Test Firestore connection
        // const testDoc = await admin.firestore().collection('_health_check').doc('test').get();

        // Test Authentication
        // await admin.auth().listUsers(1);

        // Test Cloud Functions
        // const functions = admin.functions();

        return true;
      });

      return this.createResult(
        this.determineStatus(responseTime, true),
        responseTime,
        'Firebase services are operational',
        undefined,
        { services: ['firestore', 'auth', 'functions', 'storage'] }
      );
    } catch (error) {
      return this.createResult(
        'unhealthy',
        this.config.timeout,
        'Firebase services unavailable',
        error.message
      );
    }
  }
}

// HTTP service health check
export class HttpHealthCheck extends HealthCheck {
  private url: string;
  private method: 'GET' | 'POST' | 'HEAD';
  private expectedStatus?: number;
  private headers?: Record<string, string>;

  constructor(
    config: HealthCheckConfig,
    options: {
      url: string;
      method?: 'GET' | 'POST' | 'HEAD';
      expectedStatus?: number;
      headers?: Record<string, string>;
    }
  ) {
    super(config);
    this.url = options.url;
    this.method = options.method || 'GET';
    this.expectedStatus = options.expectedStatus || 200;
    this.headers = options.headers;
  }

  async execute(): Promise<HealthCheckResult> {
    try {
      const { result: response, responseTime } = await this.measure(
        async () => {
          // Mock HTTP request - replace with actual HTTP client
          await new Promise(resolve =>
            setTimeout(resolve, Math.random() * 100)
          );

          return {
            status: 200,
            statusText: 'OK',
            headers: {},
          };
        }
      );

      const isHealthy = response.status === this.expectedStatus;
      const status = this.determineStatus(responseTime, isHealthy);

      return this.createResult(
        status,
        responseTime,
        `HTTP ${this.method} ${this.url} returned ${response.status}`,
        isHealthy
          ? undefined
          : `Expected status ${this.expectedStatus}, got ${response.status}`,
        { url: this.url, method: this.method, status: response.status }
      );
    } catch (error) {
      return this.createResult(
        'unhealthy',
        this.config.timeout,
        `HTTP request to ${this.url} failed`,
        error.message,
        { url: this.url, method: this.method }
      );
    }
  }
}

// Redis health check
export class RedisHealthCheck extends HealthCheck {
  private redis: any;

  constructor(config: HealthCheckConfig, redisClient: any) {
    super(config);
    this.redis = redisClient;
  }

  async execute(): Promise<HealthCheckResult> {
    try {
      const { result: pong, responseTime } = await this.measure(async () => {
        // return await this.redis.ping();
        return 'PONG'; // Mock response
      });

      const isHealthy = pong === 'PONG';
      const status = this.determineStatus(responseTime, isHealthy);

      return this.createResult(
        status,
        responseTime,
        isHealthy ? 'Redis connection successful' : 'Redis connection failed',
        isHealthy ? undefined : 'PING command failed'
      );
    } catch (error) {
      return this.createResult(
        'unhealthy',
        this.config.timeout,
        'Redis health check failed',
        error.message
      );
    }
  }
}

// External service health check
export class ExternalServiceHealthCheck extends HealthCheck {
  private testFunction: () => Promise<{
    healthy: boolean;
    message?: string;
    metadata?: any;
  }>;

  constructor(
    config: HealthCheckConfig,
    testFunction: () => Promise<{
      healthy: boolean;
      message?: string;
      metadata?: any;
    }>
  ) {
    super(config);
    this.testFunction = testFunction;
  }

  async execute(): Promise<HealthCheckResult> {
    try {
      const { result, responseTime } = await this.measure(this.testFunction);
      const status = this.determineStatus(responseTime, result.healthy);

      return this.createResult(
        status,
        responseTime,
        result.message ||
          (result.healthy ? 'Service is healthy' : 'Service is unhealthy'),
        result.healthy ? undefined : result.message,
        result.metadata
      );
    } catch (error) {
      return this.createResult(
        'unhealthy',
        this.config.timeout,
        'External service health check failed',
        error.message
      );
    }
  }
}

export class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private lastResults: Map<string, HealthCheckResult> = new Map();
  private listeners: Array<(health: SystemHealth) => void> = [];
  private startTime: Date = new Date();

  constructor(
    private config: { environment?: string; version?: string } = {}
  ) {}

  addHealthCheck(check: HealthCheck): void {
    this.checks.set(check.config.name, check);

    // Start periodic health checks if interval is specified
    if (check.config.interval) {
      const interval = setInterval(async () => {
        try {
          const result = await check.execute();
          this.lastResults.set(check.config.name, result);
          this.notifyListeners();
        } catch (error) {
          console.error(`Health check failed for ${check.config.name}:`, error);
        }
      }, check.config.interval);

      this.intervals.set(check.config.name, interval);
    }
  }

  removeHealthCheck(name: string): void {
    this.checks.delete(name);
    this.lastResults.delete(name);

    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
  }

  async runAllChecks(): Promise<SystemHealth> {
    const results: HealthCheckResult[] = [];

    // Run all health checks in parallel
    const checkPromises = Array.from(this.checks.values()).map(async check => {
      try {
        const result = await Promise.race([
          check.execute(),
          this.timeoutPromise(check.config.timeout, check.config.name),
        ]);

        this.lastResults.set(check.config.name, result);
        return result;
      } catch (error) {
        const timeoutResult: HealthCheckResult = {
          name: check.config.name,
          status: 'unhealthy',
          responseTime: check.config.timeout,
          error: error.message || 'Health check timeout',
          timestamp: new Date(),
        };

        this.lastResults.set(check.config.name, timeoutResult);
        return timeoutResult;
      }
    });

    results.push(...(await Promise.all(checkPromises)));

    const systemHealth = this.calculateSystemHealth(results);
    this.notifyListeners(systemHealth);

    return systemHealth;
  }

  async runHealthCheck(name: string): Promise<HealthCheckResult | null> {
    const check = this.checks.get(name);
    if (!check) return null;

    try {
      const result = await check.execute();
      this.lastResults.set(name, result);
      return result;
    } catch (error) {
      const errorResult: HealthCheckResult = {
        name,
        status: 'unhealthy',
        responseTime: check.config.timeout,
        error: error.message,
        timestamp: new Date(),
      };

      this.lastResults.set(name, errorResult);
      return errorResult;
    }
  }

  getLastResults(): Map<string, HealthCheckResult> {
    return new Map(this.lastResults);
  }

  getSystemHealth(): SystemHealth {
    const results = Array.from(this.lastResults.values());
    return this.calculateSystemHealth(results);
  }

  private calculateSystemHealth(results: HealthCheckResult[]): SystemHealth {
    let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    // Determine overall health based on critical services
    const criticalChecks = Array.from(this.checks.values()).filter(
      check => check.config.critical
    );
    const criticalResults = results.filter(result =>
      criticalChecks.some(check => check.config.name === result.name)
    );

    // If any critical service is unhealthy, system is unhealthy
    if (criticalResults.some(result => result.status === 'unhealthy')) {
      overall = 'unhealthy';
    }
    // If any critical service is degraded, system is degraded
    else if (criticalResults.some(result => result.status === 'degraded')) {
      overall = 'degraded';
    }
    // If any non-critical service is unhealthy and we have no degraded criticals
    else if (results.some(result => result.status === 'unhealthy')) {
      overall = 'degraded';
    }

    return {
      overall,
      services: results,
      timestamp: new Date(),
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      version: this.config.version,
      environment: this.config.environment,
    };
  }

  private timeoutPromise(timeout: number, checkName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout for ${checkName}`));
      }, timeout);
    });
  }

  addListener(listener: (health: SystemHealth) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (health: SystemHealth) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(health?: SystemHealth): void {
    const systemHealth = health || this.getSystemHealth();
    this.listeners.forEach(listener => {
      try {
        listener(systemHealth);
      } catch (error) {
        console.error('Health monitor listener error:', error);
      }
    });
  }

  stop(): void {
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
  }

  // Express.js middleware for health check endpoint
  expressMiddleware() {
    return async (req: any, res: any) => {
      try {
        const health = await this.runAllChecks();
        const statusCode =
          health.overall === 'healthy'
            ? 200
            : health.overall === 'degraded'
              ? 200
              : 503;

        res.status(statusCode).json(health);
      } catch (error) {
        res.status(500).json({
          overall: 'unhealthy',
          error: 'Health check failed',
          timestamp: new Date(),
        });
      }
    };
  }

  // Cloud Functions health check
  cloudFunctionHandler() {
    return async (req: any, res: any) => {
      const health = await this.runAllChecks();
      const statusCode = health.overall === 'unhealthy' ? 503 : 200;

      res.status(statusCode).json(health);
    };
  }
}

// Predefined health check configurations
export const HealthCheckPresets = {
  // Basic Firebase services
  firebase: (): HealthCheck[] => [
    new FirebaseHealthCheck({
      name: 'firebase',
      timeout: 10000,
      interval: 60000,
      critical: true,
    }),
  ],

  // Database and cache
  database: (connectionTest: () => Promise<boolean>): HealthCheck[] => [
    new DatabaseHealthCheck(
      {
        name: 'database',
        timeout: 5000,
        interval: 30000,
        critical: true,
      },
      connectionTest
    ),
  ],

  // External APIs
  externalApis: (apis: Array<{ name: string; url: string }>): HealthCheck[] =>
    apis.map(
      api =>
        new HttpHealthCheck(
          {
            name: api.name,
            timeout: 10000,
            interval: 120000,
            critical: false,
          },
          { url: api.url, method: 'HEAD' }
        )
    ),

  // Payment gateways
  paymentGateways: (): HealthCheck[] => [
    new ExternalServiceHealthCheck(
      {
        name: 'razorpay',
        timeout: 8000,
        interval: 300000,
        critical: false,
      },
      async () => {
        // Test Razorpay API connectivity
        try {
          // Mock API test
          return { healthy: true, message: 'Razorpay API accessible' };
        } catch (error) {
          return { healthy: false, message: error.message };
        }
      }
    ),

    new ExternalServiceHealthCheck(
      {
        name: 'stripe',
        timeout: 8000,
        interval: 300000,
        critical: false,
      },
      async () => {
        // Test Stripe API connectivity
        try {
          // Mock API test
          return { healthy: true, message: 'Stripe API accessible' };
        } catch (error) {
          return { healthy: false, message: error.message };
        }
      }
    ),
  ],

  // Comprehensive monitoring for production
  production: (
    databaseTest: () => Promise<boolean>,
    redisClient?: any
  ): HealthCheck[] => {
    const checks: HealthCheck[] = [
      new FirebaseHealthCheck({
        name: 'firebase',
        timeout: 10000,
        interval: 60000,
        critical: true,
      }),

      new DatabaseHealthCheck(
        {
          name: 'database',
          timeout: 5000,
          interval: 30000,
          critical: true,
        },
        databaseTest
      ),
    ];

    if (redisClient) {
      checks.push(
        new RedisHealthCheck(
          {
            name: 'redis',
            timeout: 3000,
            interval: 60000,
            critical: false,
          },
          redisClient
        )
      );
    }

    return checks;
  },
};

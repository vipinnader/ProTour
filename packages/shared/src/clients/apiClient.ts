/**
 * External API client abstractions for ProTour
 * Provides unified interface for HTTP requests with retry, caching, and error handling
 */

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number; // milliseconds
  retries?: number;
  retryDelay?: number; // milliseconds
  backoffMultiplier?: number;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey' | 'custom';
    credentials: {
      token?: string;
      username?: string;
      password?: string;
      apiKey?: string;
      headerName?: string;
      queryParam?: string;
    };
    refreshToken?: {
      url: string;
      method: 'POST' | 'GET';
      payload?: any;
      responseTokenPath?: string; // JSONPath to token in response
    };
  };
  cache?: {
    enabled: boolean;
    ttlMs?: number;
    maxSize?: number;
    keyGenerator?: (url: string, options: RequestOptions) => string;
  };
  interceptors?: {
    request?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
    response?: (response: ApiResponse) => ApiResponse | Promise<ApiResponse>;
    error?: (error: ApiError) => ApiError | Promise<ApiError>;
  };
  rateLimiting?: {
    requests: number;
    windowMs: number;
    backoffMs?: number;
  };
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, any>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  validateStatus?: (status: number) => boolean;
  responseType?: 'json' | 'text' | 'blob' | 'stream';
}

export interface RequestConfig extends RequestOptions {
  url: string;
  baseUrl: string;
  fullUrl: string;
  timestamp: Date;
  requestId: string;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
  cached?: boolean;
  responseTime: number;
}

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  response?: ApiResponse;
  config?: RequestConfig;
  isTimeout?: boolean;
  isNetworkError?: boolean;
  isRetryable?: boolean;
  retryAttempt?: number;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
  etag?: string;
  lastModified?: string;
}

export abstract class ApiCache {
  abstract get<T>(key: string): Promise<CacheEntry<T> | null>;
  abstract set<T>(key: string, data: T, ttlMs: number, metadata?: any): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract clear(): Promise<void>;
  abstract has(key: string): Promise<boolean>;
}

export class MemoryApiCache extends ApiCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    super();
    this.maxSize = maxSize;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  async set<T>(
    key: string,
    data: T,
    ttlMs: number,
    metadata?: { etag?: string; lastModified?: string }
  ): Promise<void> {
    // LRU eviction if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + ttlMs),
      etag: metadata?.etag,
      lastModified: metadata?.lastModified,
    };

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

export class RedisApiCache extends ApiCache {
  private redis: any;

  constructor(redisClient: any) {
    super();
    this.redis = redisClient;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const data = await this.redis.get(`api_cache:${key}`);
    if (!data) return null;

    const entry: CacheEntry<T> = JSON.parse(data);
    entry.timestamp = new Date(entry.timestamp);
    entry.expiresAt = new Date(entry.expiresAt);

    if (entry.expiresAt < new Date()) {
      await this.delete(key);
      return null;
    }

    return entry;
  }

  async set<T>(
    key: string,
    data: T,
    ttlMs: number,
    metadata?: { etag?: string; lastModified?: string }
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + ttlMs),
      etag: metadata?.etag,
      lastModified: metadata?.lastModified,
    };

    await this.redis.setex(
      `api_cache:${key}`,
      Math.ceil(ttlMs / 1000),
      JSON.stringify(entry)
    );
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`api_cache:${key}`);
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys('api_cache:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(`api_cache:${key}`);
    return exists === 1;
  }
}

export class RateLimitManager {
  private requests: Map<string, Date[]> = new Map();
  private config: { requests: number; windowMs: number; backoffMs: number };

  constructor(config: { requests: number; windowMs: number; backoffMs?: number }) {
    this.config = {
      backoffMs: 1000,
      ...config,
    };
  }

  async checkLimit(identifier: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowMs);
    
    // Get recent requests for this identifier
    let requests = this.requests.get(identifier) || [];
    
    // Filter out requests outside the window
    requests = requests.filter(req => req > windowStart);
    
    // Check if limit is exceeded
    if (requests.length >= this.config.requests) {
      const oldestRequest = requests[0];
      const retryAfter = oldestRequest.getTime() + this.config.windowMs - now.getTime();
      
      return {
        allowed: false,
        retryAfter: Math.max(0, retryAfter),
      };
    }

    // Add current request
    requests.push(now);
    this.requests.set(identifier, requests);

    return { allowed: true };
  }

  async waitIfNeeded(identifier: string): Promise<void> {
    const result = await this.checkLimit(identifier);
    if (!result.allowed && result.retryAfter) {
      await this.delay(result.retryAfter + this.config.backoffMs);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cleanup(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.config.windowMs * 2);
    
    for (const [identifier, requests] of this.requests.entries()) {
      const filtered = requests.filter(req => req > cutoff);
      if (filtered.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, filtered);
      }
    }
  }
}

export class ApiClient {
  private config: ApiClientConfig;
  private cache?: ApiCache;
  private rateLimiter?: RateLimitManager;

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      ...config,
    };

    if (this.config.cache?.enabled) {
      this.cache = new MemoryApiCache(this.config.cache.maxSize);
    }

    if (this.config.rateLimiting) {
      this.rateLimiter = new RateLimitManager(this.config.rateLimiting);
    }
  }

  async get<T = any>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  async put<T = any>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  async patch<T = any>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }

  async delete<T = any>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  async request<T = any>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const config = this.buildRequestConfig(url, options);

    // Apply rate limiting
    if (this.rateLimiter) {
      await this.rateLimiter.waitIfNeeded(this.config.baseUrl);
    }

    // Apply request interceptor
    let finalConfig = config;
    if (this.config.interceptors?.request) {
      finalConfig = await this.config.interceptors.request(config);
    }

    // Check cache for GET requests
    if (finalConfig.method === 'GET' && this.cache && options.cache !== false) {
      const cacheKey = this.generateCacheKey(finalConfig.fullUrl, options);
      const cached = await this.cache.get<T>(cacheKey);
      if (cached) {
        return {
          data: cached.data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: finalConfig,
          cached: true,
          responseTime: 0,
        };
      }
    }

    return this.executeRequest<T>(finalConfig, 0);
  }

  private async executeRequest<T>(
    config: RequestConfig,
    attempt: number
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();

    try {
      const response = await this.makeHttpRequest<T>(config);

      // Apply response interceptor
      let finalResponse = response;
      if (this.config.interceptors?.response) {
        finalResponse = await this.config.interceptors.response(response);
      }

      // Cache GET responses
      if (
        config.method === 'GET' &&
        this.cache &&
        this.isSuccessStatus(response.status)
      ) {
        const cacheKey = this.generateCacheKey(config.fullUrl, config);
        const ttl = this.config.cache?.ttlMs || 300000; // 5 minutes default
        
        await this.cache.set(
          cacheKey,
          response.data,
          ttl,
          {
            etag: response.headers.etag,
            lastModified: response.headers['last-modified'],
          }
        );
      }

      return {
        ...finalResponse,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      const apiError: ApiError = this.createApiError(error, config, attempt);

      // Apply error interceptor
      let finalError = apiError;
      if (this.config.interceptors?.error) {
        finalError = await this.config.interceptors.error(apiError);
      }

      // Retry logic
      const shouldRetry = this.shouldRetry(finalError, attempt);
      if (shouldRetry) {
        const delay = this.calculateRetryDelay(attempt);
        await this.delay(delay);
        return this.executeRequest<T>(config, attempt + 1);
      }

      throw finalError;
    }
  }

  private async makeHttpRequest<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    // This is a mock implementation
    // In a real implementation, you'd use fetch, axios, or another HTTP client
    
    const startTime = Date.now();
    
    // Simulate network delay
    await this.delay(Math.random() * 100 + 50);

    // Mock response based on URL patterns
    if (config.fullUrl.includes('/error')) {
      throw new Error('Mock HTTP error');
    }

    const mockData: T = {
      id: 'mock_id',
      message: 'Mock response',
      url: config.fullUrl,
      method: config.method,
      timestamp: new Date().toISOString(),
    } as any;

    return {
      data: mockData,
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
        'x-response-time': (Date.now() - startTime).toString(),
      },
      config,
      responseTime: Date.now() - startTime,
    };
  }

  private buildRequestConfig(url: string, options: RequestOptions): RequestConfig {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;
    
    // Add query parameters
    if (options.query && Object.keys(options.query).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const separator = fullUrl.includes('?') ? '&' : '?';
      url = `${fullUrl}${separator}${searchParams.toString()}`;
    }

    const config: RequestConfig = {
      url,
      baseUrl: this.config.baseUrl,
      fullUrl: fullUrl,
      method: options.method || 'GET',
      headers: {
        ...this.config.headers,
        ...options.headers,
      },
      body: options.body,
      timeout: options.timeout || this.config.timeout,
      retries: options.retries ?? this.config.retries,
      timestamp: new Date(),
      requestId: this.generateRequestId(),
    };

    // Add authentication headers
    if (this.config.auth) {
      this.addAuthHeaders(config);
    }

    // Add content-type for requests with body
    if (config.body && !config.headers['content-type']) {
      config.headers['content-type'] = 'application/json';
    }

    return config;
  }

  private addAuthHeaders(config: RequestConfig): void {
    const auth = this.config.auth!;

    switch (auth.type) {
      case 'bearer':
        if (auth.credentials.token) {
          config.headers.authorization = `Bearer ${auth.credentials.token}`;
        }
        break;
      
      case 'basic':
        if (auth.credentials.username && auth.credentials.password) {
          const credentials = btoa(`${auth.credentials.username}:${auth.credentials.password}`);
          config.headers.authorization = `Basic ${credentials}`;
        }
        break;
      
      case 'apikey':
        if (auth.credentials.apiKey) {
          if (auth.credentials.headerName) {
            config.headers[auth.credentials.headerName] = auth.credentials.apiKey;
          } else if (auth.credentials.queryParam) {
            // Add to query parameters
            const url = new URL(config.fullUrl);
            url.searchParams.set(auth.credentials.queryParam, auth.credentials.apiKey);
            config.fullUrl = url.toString();
          }
        }
        break;
    }
  }

  private generateCacheKey(url: string, options: RequestOptions): string {
    if (this.config.cache?.keyGenerator) {
      return this.config.cache.keyGenerator(url, options);
    }

    // Default cache key generation
    const key = `${options.method || 'GET'}:${url}`;
    if (options.query) {
      const queryString = new URLSearchParams(options.query).toString();
      return `${key}?${queryString}`;
    }
    return key;
  }

  private createApiError(
    error: any,
    config: RequestConfig,
    retryAttempt: number
  ): ApiError {
    const apiError = new Error(error.message || 'Request failed') as ApiError;
    
    apiError.config = config;
    apiError.retryAttempt = retryAttempt;
    
    if (error.response) {
      apiError.status = error.response.status;
      apiError.statusText = error.response.statusText;
      apiError.response = error.response;
    }
    
    // Determine error type
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      apiError.isTimeout = true;
      apiError.isRetryable = true;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      apiError.isNetworkError = true;
      apiError.isRetryable = true;
    } else if (apiError.status) {
      // HTTP errors
      apiError.isRetryable = apiError.status >= 500 || apiError.status === 429;
    }

    return apiError;
  }

  private shouldRetry(error: ApiError, attempt: number): boolean {
    const maxRetries = error.config?.retries ?? this.config.retries ?? 0;
    
    if (attempt >= maxRetries) {
      return false;
    }

    return error.isRetryable === true;
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay || 1000;
    const multiplier = this.config.backoffMultiplier || 2;
    
    return baseDelay * Math.pow(multiplier, attempt);
  }

  private isSuccessStatus(status: number): boolean {
    return status >= 200 && status < 300;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for cache and rate limiter management
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }

  cleanupRateLimit(): void {
    if (this.rateLimiter) {
      this.rateLimiter.cleanup();
    }
  }

  // Set new auth token (useful for token refresh)
  setAuthToken(token: string): void {
    if (this.config.auth && this.config.auth.type === 'bearer') {
      this.config.auth.credentials.token = token;
    }
  }

  // Update base configuration
  updateConfig(updates: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Predefined client configurations for common services
export const ApiClientPresets = {
  // REST API with JSON
  restApi: (baseUrl: string): ApiClientConfig => ({
    baseUrl,
    timeout: 30000,
    retries: 3,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    cache: {
      enabled: true,
      ttlMs: 300000, // 5 minutes
    },
    rateLimiting: {
      requests: 100,
      windowMs: 60000, // 1 minute
    },
  }),

  // GraphQL API
  graphql: (baseUrl: string): ApiClientConfig => ({
    baseUrl,
    timeout: 30000,
    retries: 2,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    cache: {
      enabled: true,
      ttlMs: 180000, // 3 minutes
      keyGenerator: (url, options) => {
        // Custom cache key for GraphQL queries
        const body = options.body;
        if (body && typeof body === 'object' && body.query) {
          const query = body.query.replace(/\s+/g, ' ').trim();
          const variables = JSON.stringify(body.variables || {});
          return `graphql:${btoa(query + variables)}`;
        }
        return `graphql:${url}`;
      },
    },
  }),

  // Third-party API with API key
  thirdParty: (baseUrl: string, apiKey: string): ApiClientConfig => ({
    baseUrl,
    timeout: 45000,
    retries: 5,
    retryDelay: 2000,
    backoffMultiplier: 1.5,
    auth: {
      type: 'apikey',
      credentials: {
        apiKey,
        headerName: 'X-API-Key',
      },
    },
    rateLimiting: {
      requests: 50,
      windowMs: 60000,
      backoffMs: 2000,
    },
    cache: {
      enabled: true,
      ttlMs: 600000, // 10 minutes
    },
  }),
};
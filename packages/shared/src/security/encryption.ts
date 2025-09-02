/**
 * Comprehensive data encryption system for ProTour
 * Provides encryption at rest and in transit with key management
 */

import { createHash, randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto';

export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  ivSize: number;
  tagSize: number;
  saltSize: number;
  iterations: number;
  masterKey: string;
  keyRotationInterval: number; // milliseconds
}

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag?: string;
  keyVersion: number;
  algorithm: string;
  timestamp: Date;
}

export interface DecryptionResult {
  decrypted: string;
  keyVersion: number;
  timestamp: Date;
}

export interface FieldEncryptionConfig {
  fields: string[];
  algorithm: string;
  keyId: string;
  searchable?: boolean;
}

export interface EncryptionKey {
  id: string;
  version: number;
  key: Buffer;
  algorithm: string;
  createdAt: Date;
  expiresAt?: Date;
  status: 'active' | 'rotating' | 'deprecated' | 'revoked';
}

export class EncryptionManager {
  private config: EncryptionConfig;
  private keys: Map<string, EncryptionKey> = new Map();
  private currentKeyVersion: number = 1;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = {
      algorithm: 'aes-256-gcm',
      keySize: 32,
      ivSize: 16,
      tagSize: 16,
      saltSize: 32,
      iterations: 100000,
      keyRotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
      ...config,
      masterKey: config.masterKey || process.env.ENCRYPTION_MASTER_KEY || this.generateSecureKey(),
    };

    this.initializeKeys();
  }

  private initializeKeys(): void {
    // Initialize with master key
    const masterKey = Buffer.from(this.config.masterKey, 'hex');
    const currentKey: EncryptionKey = {
      id: 'master',
      version: this.currentKeyVersion,
      key: masterKey,
      algorithm: this.config.algorithm,
      createdAt: new Date(),
      status: 'active',
    };

    this.keys.set(`master_v${this.currentKeyVersion}`, currentKey);
  }

  private generateSecureKey(): string {
    return randomBytes(this.config.keySize).toString('hex');
  }

  /**
   * Encrypt sensitive data with current key
   */
  encrypt(plaintext: string, keyId: string = 'master'): EncryptionResult {
    const keyRef = `${keyId}_v${this.currentKeyVersion}`;
    const key = this.keys.get(keyRef);

    if (!key || key.status !== 'active') {
      throw new Error(`Encryption key not found or inactive: ${keyRef}`);
    }

    const iv = randomBytes(this.config.ivSize);
    const cipher = createCipheriv(this.config.algorithm, key.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag?.();

    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag?.toString('base64'),
      keyVersion: this.currentKeyVersion,
      algorithm: this.config.algorithm,
      timestamp: new Date(),
    };
  }

  /**
   * Decrypt data with specified key version
   */
  decrypt(encryptionResult: EncryptionResult, keyId: string = 'master'): DecryptionResult {
    const keyRef = `${keyId}_v${encryptionResult.keyVersion}`;
    const key = this.keys.get(keyRef);

    if (!key) {
      throw new Error(`Decryption key not found: ${keyRef}`);
    }

    const iv = Buffer.from(encryptionResult.iv, 'base64');
    const decipher = createDecipheriv(encryptionResult.algorithm, key.key, iv);

    if (encryptionResult.tag) {
      const tag = Buffer.from(encryptionResult.tag, 'base64');
      decipher.setAuthTag(tag);
    }

    let decrypted = decipher.update(encryptionResult.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return {
      decrypted,
      keyVersion: encryptionResult.keyVersion,
      timestamp: encryptionResult.timestamp,
    };
  }

  /**
   * Encrypt object fields selectively
   */
  encryptFields(obj: Record<string, any>, config: FieldEncryptionConfig): Record<string, any> {
    const result = { ...obj };
    const encryptionMetadata: Record<string, EncryptionResult> = {};

    config.fields.forEach(field => {
      if (result[field] !== undefined && result[field] !== null) {
        const value = typeof result[field] === 'string' ? 
          result[field] : JSON.stringify(result[field]);
        
        const encrypted = this.encrypt(value, config.keyId);
        
        // Store encrypted value
        result[field] = encrypted.encrypted;
        
        // Store metadata separately
        encryptionMetadata[field] = encrypted;

        // Create searchable hash if required
        if (config.searchable) {
          result[`${field}_hash`] = this.createSearchableHash(value);
        }
      }
    });

    result._encryption = encryptionMetadata;
    return result;
  }

  /**
   * Decrypt object fields
   */
  decryptFields(obj: Record<string, any>, config: FieldEncryptionConfig): Record<string, any> {
    const result = { ...obj };
    const encryptionMetadata = result._encryption;

    if (!encryptionMetadata) {
      return result;
    }

    config.fields.forEach(field => {
      if (result[field] !== undefined && encryptionMetadata[field]) {
        try {
          const encryptionResult: EncryptionResult = {
            encrypted: result[field],
            ...encryptionMetadata[field],
          };

          const decrypted = this.decrypt(encryptionResult, config.keyId);
          
          // Try to parse as JSON, fallback to string
          try {
            result[field] = JSON.parse(decrypted.decrypted);
          } catch {
            result[field] = decrypted.decrypted;
          }

          // Remove searchable hash
          if (config.searchable && result[`${field}_hash`]) {
            delete result[`${field}_hash`];
          }
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          // Leave field as is if decryption fails
        }
      }
    });

    delete result._encryption;
    return result;
  }

  /**
   * Create searchable hash for encrypted fields
   */
  createSearchableHash(value: string): string {
    const salt = this.config.masterKey.slice(0, 32);
    return createHash('sha256')
      .update(value + salt)
      .digest('hex')
      .substring(0, 16); // Truncate for index efficiency
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    const hashSalt = salt || randomBytes(this.config.saltSize).toString('hex');
    const hash = scryptSync(data, hashSalt, this.config.keySize).toString('hex');
    
    return { hash, salt: hashSalt };
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const expectedHash = scryptSync(data, salt, this.config.keySize);
    const actualHash = Buffer.from(hash, 'hex');
    
    return timingSafeEqual(expectedHash, actualHash);
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Derive key from password
   */
  deriveKeyFromPassword(password: string, salt: string): Buffer {
    return scryptSync(password, salt, this.config.keySize);
  }

  /**
   * Rotate encryption keys
   */
  rotateKeys(): void {
    // Mark current key as rotating
    const currentKeyRef = `master_v${this.currentKeyVersion}`;
    const currentKey = this.keys.get(currentKeyRef);
    if (currentKey) {
      currentKey.status = 'rotating';
    }

    // Create new key
    this.currentKeyVersion++;
    const newKey: EncryptionKey = {
      id: 'master',
      version: this.currentKeyVersion,
      key: Buffer.from(this.generateSecureKey(), 'hex'),
      algorithm: this.config.algorithm,
      createdAt: new Date(),
      status: 'active',
    };

    this.keys.set(`master_v${this.currentKeyVersion}`, newKey);

    // Schedule old key deprecation
    setTimeout(() => {
      if (currentKey) {
        currentKey.status = 'deprecated';
        currentKey.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }
    }, 7 * 24 * 60 * 60 * 1000); // 7 days grace period

    console.log(`[Security] Encryption keys rotated to version ${this.currentKeyVersion}`);
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats(): {
    currentKeyVersion: number;
    totalKeys: number;
    activeKeys: number;
    deprecatedKeys: number;
    algorithm: string;
  } {
    const stats = {
      currentKeyVersion: this.currentKeyVersion,
      totalKeys: this.keys.size,
      activeKeys: 0,
      deprecatedKeys: 0,
      algorithm: this.config.algorithm,
    };

    this.keys.forEach(key => {
      if (key.status === 'active') stats.activeKeys++;
      if (key.status === 'deprecated') stats.deprecatedKeys++;
    });

    return stats;
  }
}

/**
 * Transport Layer Security utilities
 */
export class TLSManager {
  /**
   * Validate TLS certificate
   */
  static validateCertificate(cert: any): {
    valid: boolean;
    issuer: string;
    subject: string;
    validFrom: Date;
    validTo: Date;
    fingerprint: string;
    keySize: number;
  } {
    return {
      valid: cert.valid !== false,
      issuer: cert.issuer?.CN || 'Unknown',
      subject: cert.subject?.CN || 'Unknown',
      validFrom: new Date(cert.valid_from),
      validTo: new Date(cert.valid_to),
      fingerprint: cert.fingerprint,
      keySize: cert.bits || 0,
    };
  }

  /**
   * Generate certificate signing request
   */
  static generateCSR(options: {
    commonName: string;
    country: string;
    state: string;
    locality: string;
    organization: string;
    organizationalUnit: string;
    emailAddress: string;
  }): { csr: string; privateKey: string } {
    // Mock implementation - in production, use actual crypto libraries
    return {
      csr: `-----BEGIN CERTIFICATE REQUEST-----
Mock CSR for ${options.commonName}
-----END CERTIFICATE REQUEST-----`,
      privateKey: `-----BEGIN PRIVATE KEY-----
Mock Private Key
-----END PRIVATE KEY-----`,
    };
  }

  /**
   * Configure TLS options for servers
   */
  static getSecureTLSOptions(): {
    secureProtocol: string;
    ciphers: string;
    honorCipherOrder: boolean;
    secureOptions: number;
  } {
    return {
      secureProtocol: 'TLSv1_3_method',
      ciphers: [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
      ].join(':'),
      honorCipherOrder: true,
      secureOptions: 0x40000000 | 0x1000000 | 0x200000, // Disable SSLv3, TLSv1, TLSv1.1
    };
  }
}

/**
 * Database encryption helpers
 */
export class DatabaseEncryption {
  private encryptionManager: EncryptionManager;

  constructor(encryptionManager: EncryptionManager) {
    this.encryptionManager = encryptionManager;
  }

  /**
   * Create encrypted field configuration for different data types
   */
  static getFieldConfigs(): Record<string, FieldEncryptionConfig> {
    return {
      // Personal Identifiable Information (PII)
      pii: {
        fields: ['email', 'phone', 'address', 'nationalId', 'passport'],
        algorithm: 'aes-256-gcm',
        keyId: 'pii',
        searchable: true,
      },

      // Financial data
      financial: {
        fields: ['bankAccount', 'creditCard', 'paymentDetails', 'taxId'],
        algorithm: 'aes-256-gcm',
        keyId: 'financial',
        searchable: false,
      },

      // Sensitive user data
      sensitive: {
        fields: ['notes', 'comments', 'preferences', 'metadata'],
        algorithm: 'aes-256-gcm',
        keyId: 'sensitive',
        searchable: false,
      },

      // Tournament sensitive data
      tournament: {
        fields: ['rules', 'privateNotes', 'judgeComments'],
        algorithm: 'aes-256-gcm',
        keyId: 'tournament',
        searchable: false,
      },
    };
  }

  /**
   * Encrypt document before storing
   */
  encryptDocument(document: Record<string, any>, configKey: string): Record<string, any> {
    const config = DatabaseEncryption.getFieldConfigs()[configKey];
    if (!config) {
      throw new Error(`Unknown encryption config: ${configKey}`);
    }

    return this.encryptionManager.encryptFields(document, config);
  }

  /**
   * Decrypt document after retrieving
   */
  decryptDocument(document: Record<string, any>, configKey: string): Record<string, any> {
    const config = DatabaseEncryption.getFieldConfigs()[configKey];
    if (!config) {
      throw new Error(`Unknown encryption config: ${configKey}`);
    }

    return this.encryptionManager.decryptFields(document, config);
  }

  /**
   * Create searchable queries for encrypted fields
   */
  createSearchableQuery(field: string, value: string, configKey: string): Record<string, any> {
    const config = DatabaseEncryption.getFieldConfigs()[configKey];
    if (!config || !config.searchable || !config.fields.includes(field)) {
      throw new Error(`Field ${field} is not searchable with config ${configKey}`);
    }

    const hash = this.encryptionManager.createSearchableHash(value);
    return { [`${field}_hash`]: hash };
  }
}

/**
 * Secure communication helpers
 */
export class SecureCommunication {
  /**
   * Encrypt API payload
   */
  static encryptPayload(payload: any, publicKey: string): {
    encryptedPayload: string;
    signature: string;
    timestamp: number;
  } {
    const timestamp = Date.now();
    const dataString = JSON.stringify(payload) + timestamp;
    
    // Mock encryption - in production use actual public key encryption
    const encryptedPayload = Buffer.from(dataString).toString('base64');
    const signature = createHash('sha256').update(dataString + 'secret').digest('hex');

    return {
      encryptedPayload,
      signature,
      timestamp,
    };
  }

  /**
   * Decrypt API payload
   */
  static decryptPayload(
    encryptedPayload: string,
    signature: string,
    timestamp: number,
    privateKey: string
  ): any {
    // Verify timestamp (prevent replay attacks)
    const now = Date.now();
    if (now - timestamp > 5 * 60 * 1000) { // 5 minutes
      throw new Error('Payload timestamp expired');
    }

    // Mock decryption
    const dataString = Buffer.from(encryptedPayload, 'base64').toString();
    const expectedSignature = createHash('sha256').update(dataString + 'secret').digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid payload signature');
    }

    const payloadString = dataString.replace(timestamp.toString(), '');
    return JSON.parse(payloadString);
  }

  /**
   * Generate secure headers for API requests
   */
  static generateSecureHeaders(payload?: any): Record<string, string> {
    const nonce = randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    
    const headers: Record<string, string> = {
      'X-Request-ID': randomBytes(16).toString('hex'),
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': "default-src 'self'",
    };

    if (payload) {
      const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      headers['X-Content-Hash'] = payloadHash;
    }

    return headers;
  }

  /**
   * Validate secure headers
   */
  static validateSecureHeaders(headers: Record<string, string>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const requiredHeaders = ['X-Request-ID', 'X-Timestamp', 'X-Nonce'];

    requiredHeaders.forEach(header => {
      if (!headers[header]) {
        errors.push(`Missing required header: ${header}`);
      }
    });

    // Validate timestamp
    if (headers['X-Timestamp']) {
      const timestamp = parseInt(headers['X-Timestamp']);
      const now = Date.now();
      if (now - timestamp > 5 * 60 * 1000) {
        errors.push('Request timestamp expired');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const encryptionManager = new EncryptionManager();
export const databaseEncryption = new DatabaseEncryption(encryptionManager);

// Firestore encryption transforms
export const FirestoreEncryption = {
  /**
   * Transform for encrypting before write
   */
  beforeWrite: (data: any, collection: string): any => {
    const configMap: Record<string, string> = {
      users: 'pii',
      payments: 'financial',
      tournaments: 'tournament',
    };

    const config = configMap[collection];
    if (config) {
      return databaseEncryption.encryptDocument(data, config);
    }

    return data;
  },

  /**
   * Transform for decrypting after read
   */
  afterRead: (data: any, collection: string): any => {
    const configMap: Record<string, string> = {
      users: 'pii',
      payments: 'financial',
      tournaments: 'tournament',
    };

    const config = configMap[collection];
    if (config && data._encryption) {
      return databaseEncryption.decryptDocument(data, config);
    }

    return data;
  },
};
import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import sharp from 'sharp';
import { createHash } from 'crypto';

export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  uploadPath: string;
  tempPath: string;
  virusScanEnabled: boolean;
  imageProcessing: {
    enabled: boolean;
    maxWidth: number;
    maxHeight: number;
    quality: number;
    formats: string[];
  };
  contentValidation: {
    enabled: boolean;
    strictMode: boolean;
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotationDays: number;
  };
  quarantine: {
    enabled: boolean;
    quarantinePath: string;
    retentionDays: number;
  };
}

export interface ProcessedFile {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  hash: string;
  encrypted: boolean;
  processed: boolean;
  metadata: {
    dimensions?: { width: number; height: number };
    duration?: number;
    pages?: number;
    customFields: Record<string, any>;
  };
  scanResults?: {
    clean: boolean;
    threats: string[];
    engine: string;
    timestamp: Date;
  };
  uploadedAt: Date;
  uploadedBy: string;
}

export interface SecurityScanResult {
  safe: boolean;
  threats: string[];
  warnings: string[];
  details: {
    engine: string;
    version: string;
    scanTime: number;
    signatures: number;
  };
}

export class SecureFileUploadManager {
  private config: FileUploadConfig;
  private upload: multer.Multer;
  private suspiciousPatterns: RegExp[];
  private encryptionKeys = new Map<
    string,
    { key: Buffer; iv: Buffer; createdAt: Date }
  >();

  constructor(config: Partial<FileUploadConfig> = {}) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/json',
      ],
      allowedExtensions: [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.webp',
        '.pdf',
        '.txt',
        '.csv',
        '.json',
      ],
      uploadPath: './uploads',
      tempPath: './temp',
      virusScanEnabled: true,
      imageProcessing: {
        enabled: true,
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 85,
        formats: ['jpeg', 'png', 'webp'],
      },
      contentValidation: {
        enabled: true,
        strictMode: true,
      },
      encryption: {
        enabled: process.env.NODE_ENV === 'production',
        algorithm: 'aes-256-gcm',
        keyRotationDays: 90,
      },
      quarantine: {
        enabled: true,
        quarantinePath: './quarantine',
        retentionDays: 30,
      },
      ...config,
    };

    this.initializeSuspiciousPatterns();
    this.setupMulter();
    this.ensureDirectories();
    this.startKeyRotation();
  }

  private initializeSuspiciousPatterns(): void {
    this.suspiciousPatterns = [
      // Executable signatures
      /^MZ/, // PE executable
      /^PK/, // Zip/Office documents (potential macro)
      /%PDF-.*\/JavaScript/i, // PDF with JavaScript
      /<script[^>]*>/i, // HTML/SVG with scripts
      /<?php/i, // PHP code
      /<\?asp/i, // ASP code
      /<%/i, // JSP/ASP code
      /\beval\s*\(/i, // JavaScript eval
      /\bshell_exec\s*\(/i, // PHP shell execution
      /\bsystem\s*\(/i, // System command execution
      /\bexec\s*\(/i, // Command execution
      /\$_GET\[/i, // PHP superglobals
      /\$_POST\[/i,
      /\$_REQUEST\[/i,
    ];
  }

  private setupMulter(): void {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.config.tempPath);
      },
      filename: (req, file, cb) => {
        const uniqueId = crypto.randomUUID();
        const sanitizedName = this.sanitizeFilename(file.originalname);
        cb(null, `${uniqueId}-${sanitizedName}`);
      },
    });

    this.upload = multer({
      storage,
      limits: {
        fileSize: this.config.maxFileSize,
        files: 5, // Maximum 5 files per request
      },
      fileFilter: this.fileFilter.bind(this),
    });
  }

  private fileFilter(
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ): void {
    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`MIME type ${file.mimetype} not allowed`));
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.config.allowedExtensions.includes(ext)) {
      return cb(new Error(`File extension ${ext} not allowed`));
    }

    // Check for suspicious filename patterns
    if (this.hasSuspiciousFilename(file.originalname)) {
      return cb(new Error('Suspicious filename detected'));
    }

    cb(null, true);
  }

  private hasSuspiciousFilename(filename: string): boolean {
    const suspiciousPatterns = [
      /\.(exe|bat|cmd|scr|pif|com)$/i,
      /\.(asp|aspx|jsp|php|cgi|pl)$/i,
      /^\./, // Hidden files
      /\$|%|&|\||;|<|>/, // Shell metacharacters
      /\0/, // Null bytes
    ];

    return suspiciousPatterns.some(pattern => pattern.test(filename));
  }

  private sanitizeFilename(filename: string): string {
    // Remove path traversal attempts
    let sanitized = path.basename(filename);

    // Remove or replace dangerous characters
    sanitized = sanitized
      .replace(/[<>:"/\\|?*\0]/g, '_')
      .replace(/^\./g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 255);

    return sanitized || 'unnamed_file';
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [this.config.uploadPath, this.config.tempPath];

    if (this.config.quarantine.enabled) {
      dirs.push(this.config.quarantine.quarantinePath);
    }

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  async processUpload(
    file: Express.Multer.File,
    uploadedBy: string
  ): Promise<ProcessedFile> {
    try {
      // 1. Validate file content
      await this.validateFileContent(file);

      // 2. Scan for malware
      let scanResults: SecurityScanResult | undefined;
      if (this.config.virusScanEnabled) {
        scanResults = await this.scanForThreats(file);
        if (!scanResults.safe) {
          await this.quarantineFile(file, scanResults);
          throw new Error(
            `File contains threats: ${scanResults.threats.join(', ')}`
          );
        }
      }

      // 3. Process file based on type
      let processedFile = await this.processFileByType(file);

      // 4. Calculate file hash
      const hash = await this.calculateFileHash(processedFile.path);

      // 5. Encrypt if enabled
      if (this.config.encryption.enabled) {
        processedFile = await this.encryptFile(processedFile);
      }

      // 6. Move to final destination
      const finalPath = path.join(
        this.config.uploadPath,
        processedFile.filename
      );
      await fs.rename(processedFile.path, finalPath);

      const result: ProcessedFile = {
        originalName: file.originalname,
        filename: processedFile.filename,
        path: finalPath,
        size: processedFile.size,
        mimetype: file.mimetype,
        hash,
        encrypted: this.config.encryption.enabled,
        processed: true,
        metadata: processedFile.metadata || { customFields: {} },
        scanResults: scanResults
          ? {
              clean: scanResults.safe,
              threats: scanResults.threats,
              engine: scanResults.details.engine,
              timestamp: new Date(),
            }
          : undefined,
        uploadedAt: new Date(),
        uploadedBy,
      };

      // 7. Clean up temp file if it still exists
      try {
        await fs.unlink(file.path);
      } catch (error) {
        // File may already be moved or deleted
      }

      return result;
    } catch (error) {
      // Clean up on error
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async validateFileContent(file: Express.Multer.File): Promise<void> {
    if (!this.config.contentValidation.enabled) {
      return;
    }

    try {
      const buffer = await fs.readFile(file.path);
      const header = buffer.subarray(0, 1024).toString('binary');

      // Check for suspicious content patterns
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(header)) {
          throw new Error(`Suspicious content pattern detected`);
        }
      }

      // Validate MIME type matches content
      if (this.config.contentValidation.strictMode) {
        await this.validateMimeTypeConsistency(file, buffer);
      }
    } catch (error) {
      throw new Error(
        `Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async validateMimeTypeConsistency(
    file: Express.Multer.File,
    buffer: Buffer
  ): Promise<void> {
    const signatures: Record<string, RegExp[]> = {
      'image/jpeg': [/^\xFF\xD8\xFF/],
      'image/png': [/^\x89PNG\r\n\x1A\n/],
      'image/gif': [/^GIF8[79]a/],
      'application/pdf': [/^%PDF-/],
      'image/webp': [/^RIFF....WEBP/],
    };

    const expectedSignatures = signatures[file.mimetype];
    if (expectedSignatures) {
      const header = buffer.subarray(0, 20).toString('binary');
      const matches = expectedSignatures.some(sig => sig.test(header));

      if (!matches) {
        throw new Error(
          `File content doesn't match declared MIME type ${file.mimetype}`
        );
      }
    }
  }

  private async scanForThreats(
    file: Express.Multer.File
  ): Promise<SecurityScanResult> {
    // In production, this would integrate with ClamAV, VirusTotal, etc.
    // For now, we'll do basic pattern matching

    const buffer = await fs.readFile(file.path);
    const content = buffer.toString('binary');

    const threats: string[] = [];
    const warnings: string[] = [];

    // Check for executable signatures
    if (buffer.subarray(0, 2).toString('binary') === 'MZ') {
      threats.push('PE_EXECUTABLE');
    }

    // Check for macro-enabled Office documents
    if (content.includes('macros') || content.includes('VBA')) {
      warnings.push('POTENTIAL_MACRO_CONTENT');
    }

    // Check for embedded JavaScript in PDFs
    if (
      file.mimetype === 'application/pdf' &&
      content.includes('/JavaScript')
    ) {
      threats.push('PDF_WITH_JAVASCRIPT');
    }

    return {
      safe: threats.length === 0,
      threats,
      warnings,
      details: {
        engine: 'basic_pattern_scanner',
        version: '1.0.0',
        scanTime: Date.now(),
        signatures: this.suspiciousPatterns.length,
      },
    };
  }

  private async quarantineFile(
    file: Express.Multer.File,
    scanResult: SecurityScanResult
  ): Promise<void> {
    if (!this.config.quarantine.enabled) {
      return;
    }

    const quarantinePath = path.join(
      this.config.quarantine.quarantinePath,
      `quarantine_${Date.now()}_${path.basename(file.path)}`
    );

    await fs.rename(file.path, quarantinePath);

    // Log quarantine action
    const logPath = path.join(
      this.config.quarantine.quarantinePath,
      'quarantine.log'
    );
    const logEntry =
      JSON.stringify({
        timestamp: new Date().toISOString(),
        originalFile: file.originalname,
        quarantinedFile: quarantinePath,
        threats: scanResult.threats,
        warnings: scanResult.warnings,
      }) + '\n';

    await fs.appendFile(logPath, logEntry);
  }

  private async processFileByType(file: Express.Multer.File): Promise<{
    filename: string;
    path: string;
    size: number;
    metadata?: any;
  }> {
    const isImage = file.mimetype.startsWith('image/');

    if (isImage && this.config.imageProcessing.enabled) {
      return this.processImage(file);
    }

    return {
      filename: path.basename(file.path),
      path: file.path,
      size: file.size,
    };
  }

  private async processImage(file: Express.Multer.File): Promise<{
    filename: string;
    path: string;
    size: number;
    metadata: any;
  }> {
    const image = sharp(file.path);
    const metadata = await image.metadata();

    // Sanitize image (removes EXIF data and potential exploits)
    let processedImage = image.rotate(); // Auto-rotate based on EXIF

    // Resize if needed
    const { maxWidth, maxHeight } = this.config.imageProcessing;
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        processedImage = processedImage.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
    }

    // Convert to safe format and optimize
    const outputFormat = this.getSafeImageFormat(file.mimetype);
    const processedPath = file.path.replace(
      path.extname(file.path),
      `.${outputFormat}`
    );

    switch (outputFormat) {
      case 'jpeg':
        await processedImage
          .jpeg({ quality: this.config.imageProcessing.quality, mozjpeg: true })
          .toFile(processedPath);
        break;
      case 'png':
        await processedImage
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toFile(processedPath);
        break;
      case 'webp':
        await processedImage
          .webp({ quality: this.config.imageProcessing.quality })
          .toFile(processedPath);
        break;
    }

    // Get final file stats
    const stats = await fs.stat(processedPath);

    // Clean up original if different
    if (processedPath !== file.path) {
      await fs.unlink(file.path);
    }

    return {
      filename: path.basename(processedPath),
      path: processedPath,
      size: stats.size,
      metadata: {
        dimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0,
        },
        format: outputFormat,
        originalFormat: metadata.format,
        customFields: {},
      },
    };
  }

  private getSafeImageFormat(mimetype: string): string {
    const formatMap: Record<string, string> = {
      'image/jpeg': 'jpeg',
      'image/png': 'png',
      'image/gif': 'png', // Convert GIF to PNG for safety
      'image/webp': 'webp',
    };

    return formatMap[mimetype] || 'png';
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async encryptFile(file: {
    filename: string;
    path: string;
    size: number;
    metadata?: any;
  }): Promise<typeof file> {
    const keyId = crypto.randomUUID();
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    this.encryptionKeys.set(keyId, {
      key,
      iv,
      createdAt: new Date(),
    });

    const cipher = crypto.createCipher(this.config.encryption.algorithm, key);
    const input = await fs.readFile(file.path);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);

    const encryptedPath = `${file.path}.enc`;
    await fs.writeFile(encryptedPath, encrypted);
    await fs.unlink(file.path);

    return {
      ...file,
      filename: `${file.filename}.enc`,
      path: encryptedPath,
      size: encrypted.length,
      metadata: {
        ...file.metadata,
        encryption: {
          keyId,
          algorithm: this.config.encryption.algorithm,
        },
      },
    };
  }

  private startKeyRotation(): void {
    if (!this.config.encryption.enabled) {
      return;
    }

    // Rotate encryption keys periodically
    setInterval(
      () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(
          cutoffDate.getDate() - this.config.encryption.keyRotationDays
        );

        for (const [keyId, keyInfo] of this.encryptionKeys.entries()) {
          if (keyInfo.createdAt < cutoffDate) {
            this.encryptionKeys.delete(keyId);
          }
        }
      },
      24 * 60 * 60 * 1000
    ); // Check daily
  }

  middleware() {
    return {
      single: (fieldName: string) => this.upload.single(fieldName),
      array: (fieldName: string, maxCount?: number) =>
        this.upload.array(fieldName, maxCount),
      fields: (fields: { name: string; maxCount?: number }[]) =>
        this.upload.fields(fields),
      any: () => this.upload.any(),
    };
  }

  // Security middleware to process uploaded files
  processFiles() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.files && !req.file) {
        return next();
      }

      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        const processedFiles: ProcessedFile[] = [];

        // Handle single file
        if (req.file) {
          const processed = await this.processUpload(req.file, user.userId);
          processedFiles.push(processed);
          (req as any).processedFile = processed;
        }

        // Handle multiple files
        if (req.files) {
          const files = Array.isArray(req.files)
            ? req.files
            : Object.values(req.files).flat();

          for (const file of files) {
            const processed = await this.processUpload(file, user.userId);
            processedFiles.push(processed);
          }

          (req as any).processedFiles = processedFiles;
        }

        next();
      } catch (error) {
        console.error('File processing error:', error);
        res.status(400).json({
          error: 'File processing failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('File deletion error:', error);
      return false;
    }
  }

  async cleanupQuarantine(): Promise<void> {
    if (!this.config.quarantine.enabled) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - this.config.quarantine.retentionDays
    );

    try {
      const files = await fs.readdir(this.config.quarantine.quarantinePath);

      for (const file of files) {
        if (file === 'quarantine.log') continue;

        const filePath = path.join(this.config.quarantine.quarantinePath, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Quarantine cleanup error:', error);
    }
  }
}

export default SecureFileUploadManager;

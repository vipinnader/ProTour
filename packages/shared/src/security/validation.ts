import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';
import { z, ZodSchema, ZodError } from 'zod';

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?:
    | 'string'
    | 'number'
    | 'boolean'
    | 'array'
    | 'object'
    | 'email'
    | 'url'
    | 'uuid'
    | 'date'
    | 'phone';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
  sanitize?: boolean;
  allowHTML?: boolean;
}

export interface SanitizationConfig {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  removeEmpty?: boolean;
  trimWhitespace?: boolean;
  normalizeEmail?: boolean;
  escapeHTML?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export class InputValidator {
  private defaultSanitizationConfig: SanitizationConfig = {
    allowedTags: [],
    allowedAttributes: {},
    removeEmpty: true,
    trimWhitespace: true,
    normalizeEmail: true,
    escapeHTML: true,
  };

  validate(
    data: any,
    rules: ValidationRule[]
  ): { isValid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      const value = this.getNestedValue(data, rule.field);
      const error = this.validateField(rule.field, value, rule);

      if (error) {
        errors.push(error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  sanitize(data: any, config: SanitizationConfig = {}): any {
    const finalConfig = { ...this.defaultSanitizationConfig, ...config };
    return this.sanitizeRecursive(data, finalConfig);
  }

  sanitizeAndValidate(
    data: any,
    rules: ValidationRule[],
    sanitizationConfig?: SanitizationConfig
  ): {
    data: any;
    isValid: boolean;
    errors: ValidationError[];
  } {
    // First sanitize
    const sanitizedData = this.sanitize(data, sanitizationConfig);

    // Then validate
    const validation = this.validate(sanitizedData, rules);

    return {
      data: sanitizedData,
      isValid: validation.isValid,
      errors: validation.errors,
    };
  }

  private validateField(
    fieldName: string,
    value: any,
    rule: ValidationRule
  ): ValidationError | null {
    // Check if field is required
    if (
      rule.required &&
      (value === undefined || value === null || value === '')
    ) {
      return {
        field: fieldName,
        message: `${fieldName} is required`,
        value,
      };
    }

    // Skip validation if field is not required and empty
    if (
      !rule.required &&
      (value === undefined || value === null || value === '')
    ) {
      return null;
    }

    // Type validation
    if (rule.type) {
      const typeError = this.validateType(fieldName, value, rule.type);
      if (typeError) return typeError;
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        return {
          field: fieldName,
          message: `${fieldName} must be at least ${rule.minLength} characters long`,
          value,
        };
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        return {
          field: fieldName,
          message: `${fieldName} must be no more than ${rule.maxLength} characters long`,
          value,
        };
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        return {
          field: fieldName,
          message: `${fieldName} has invalid format`,
          value,
        };
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return {
          field: fieldName,
          message: `${fieldName} must be at least ${rule.min}`,
          value,
        };
      }

      if (rule.max !== undefined && value > rule.max) {
        return {
          field: fieldName,
          message: `${fieldName} must be no more than ${rule.max}`,
          value,
        };
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (rule.minLength && value.length < rule.minLength) {
        return {
          field: fieldName,
          message: `${fieldName} must have at least ${rule.minLength} items`,
          value,
        };
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        return {
          field: fieldName,
          message: `${fieldName} must have no more than ${rule.maxLength} items`,
          value,
        };
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      return {
        field: fieldName,
        message: `${fieldName} must be one of: ${rule.enum.join(', ')}`,
        value,
      };
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        return {
          field: fieldName,
          message:
            typeof customResult === 'string'
              ? customResult
              : `${fieldName} is invalid`,
          value,
        };
      }
    }

    return null;
  }

  private validateType(
    fieldName: string,
    value: any,
    type: ValidationRule['type']
  ): ValidationError | null {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return {
            field: fieldName,
            message: `${fieldName} must be a string`,
            value,
          };
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field: fieldName,
            message: `${fieldName} must be a number`,
            value,
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            field: fieldName,
            message: `${fieldName} must be a boolean`,
            value,
          };
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return {
            field: fieldName,
            message: `${fieldName} must be an array`,
            value,
          };
        }
        break;

      case 'object':
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          return {
            field: fieldName,
            message: `${fieldName} must be an object`,
            value,
          };
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !validator.isEmail(value)) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid email`,
            value,
          };
        }
        break;

      case 'url':
        if (typeof value !== 'string' || !validator.isURL(value)) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid URL`,
            value,
          };
        }
        break;

      case 'uuid':
        if (typeof value !== 'string' || !validator.isUUID(value)) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid UUID`,
            value,
          };
        }
        break;

      case 'date':
        if (!validator.isISO8601(String(value))) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid date`,
            value,
          };
        }
        break;

      case 'phone':
        if (
          typeof value !== 'string' ||
          !validator.isMobilePhone(value, 'any')
        ) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid phone number`,
            value,
          };
        }
        break;
    }

    return null;
  }

  private sanitizeRecursive(data: any, config: SanitizationConfig): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data, config);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeRecursive(item, config));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        const sanitizedKey = this.sanitizeString(key, config);
        sanitized[sanitizedKey] = this.sanitizeRecursive(value, config);
      }
      return sanitized;
    }

    return data;
  }

  private sanitizeString(str: string, config: SanitizationConfig): string {
    let sanitized = str;

    // Trim whitespace
    if (config.trimWhitespace) {
      sanitized = sanitized.trim();
    }

    // Remove empty strings if configured
    if (config.removeEmpty && sanitized === '') {
      return sanitized;
    }

    // Normalize email
    if (config.normalizeEmail && validator.isEmail(sanitized)) {
      sanitized = validator.normalizeEmail(sanitized) || sanitized;
    }

    // HTML sanitization
    if (config.allowedTags && config.allowedTags.length > 0) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: config.allowedTags,
        ALLOWED_ATTR: Object.keys(config.allowedAttributes || {}),
      });
    } else if (config.escapeHTML) {
      sanitized = validator.escape(sanitized);
    }

    return sanitized;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

export class ZodValidator {
  validate<T>(
    data: any,
    schema: ZodSchema<T>
  ): {
    isValid: boolean;
    data?: T;
    errors?: ValidationError[];
  } {
    try {
      const validatedData = schema.parse(data);
      return {
        isValid: true,
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.input,
        }));

        return {
          isValid: false,
          errors: validationErrors,
        };
      }

      return {
        isValid: false,
        errors: [{ field: 'unknown', message: 'Validation failed' }],
      };
    }
  }

  middleware<T>(
    schema: ZodSchema<T>,
    target: 'body' | 'query' | 'params' = 'body'
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      const data = req[target];
      const result = this.validate(data, schema);

      if (!result.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.errors,
        });
      }

      // Replace the original data with validated/parsed data
      (req as any)[target] = result.data;
      next();
    };
  }
}

// Common validation schemas
export const commonSchemas = {
  // User schemas
  userRegistration: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    phone: z.string().optional(),
    dateOfBirth: z.string().datetime().optional(),
  }),

  userLogin: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),

  // Tournament schemas
  tournamentCreation: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    sport: z.string().min(1).max(50),
    format: z.enum([
      'single-elimination',
      'double-elimination',
      'round-robin',
      'swiss',
    ]),
    maxParticipants: z.number().int().min(2).max(10000),
    registrationDeadline: z.string().datetime(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    venue: z.string().max(200).optional(),
    entryFee: z.number().min(0).optional(),
    isPublic: z.boolean().default(true),
  }),

  // API validation schemas
  pagination: z.object({
    page: z
      .string()
      .transform(val => parseInt(val))
      .pipe(z.number().int().min(1))
      .default('1'),
    limit: z
      .string()
      .transform(val => parseInt(val))
      .pipe(z.number().int().min(1).max(100))
      .default('10'),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  // File upload schemas
  fileUpload: z.object({
    filename: z.string().min(1).max(255),
    mimetype: z
      .string()
      .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/
      ),
    size: z
      .number()
      .int()
      .min(1)
      .max(10 * 1024 * 1024), // 10MB max
  }),
};

// Validation middleware factory
export const validateInput = (rules: ValidationRule[]) => {
  const validator = new InputValidator();

  return (req: Request, res: Response, next: NextFunction) => {
    const { data, isValid, errors } = validator.sanitizeAndValidate(
      req.body,
      rules
    );

    if (!isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    req.body = data;
    next();
  };
};

// Rate limiting validation middleware
export const validateRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }

    const current = requests.get(identifier);

    if (!current) {
      requests.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (current.resetTime < now) {
      // Reset window
      requests.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
      });
    }

    current.count++;
    next();
  };
};

// SQL injection prevention
export const preventSQLInjection = () => {
  const sqlPatterns = [
    /(\b(select|insert|update|delete|drop|create|alter|exec|execute|union|script)\b)/gi,
    /(--|\/\*|\*\/|;|'|"|`)/g,
    /(\bor\b|\band\b)\s*(\d+\s*=\s*\d+|\w+\s*=\s*\w+)/gi,
  ];

  return (req: Request, res: Response, next: NextFunction) => {
    const checkForSQLInjection = (obj: any): boolean => {
      if (typeof obj === 'string') {
        return sqlPatterns.some(pattern => pattern.test(obj));
      }

      if (Array.isArray(obj)) {
        return obj.some(checkForSQLInjection);
      }

      if (obj && typeof obj === 'object') {
        return Object.values(obj).some(checkForSQLInjection);
      }

      return false;
    };

    if (
      checkForSQLInjection(req.body) ||
      checkForSQLInjection(req.query) ||
      checkForSQLInjection(req.params)
    ) {
      return res.status(400).json({
        error: 'Invalid input detected',
      });
    }

    next();
  };
};

export default {
  InputValidator,
  ZodValidator,
  commonSchemas,
  validateInput,
  validateRateLimit,
  preventSQLInjection,
};

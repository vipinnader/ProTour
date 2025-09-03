// Standalone input validation without external dependencies

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
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface SanitizationConfig {
  trimWhitespace?: boolean;
  removeEmpty?: boolean;
  escapeHTML?: boolean;
}

export class BasicInputValidator {
  private defaultSanitizationConfig: SanitizationConfig = {
    trimWhitespace: true,
    removeEmpty: true,
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
    const sanitizedData = this.sanitize(data, sanitizationConfig);
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

    if (
      !rule.required &&
      (value === undefined || value === null || value === '')
    ) {
      return null;
    }

    if (rule.type) {
      const typeError = this.validateType(fieldName, value, rule.type);
      if (typeError) return typeError;
    }

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

    if (rule.enum && !rule.enum.includes(value)) {
      return {
        field: fieldName,
        message: `${fieldName} must be one of: ${rule.enum.join(', ')}`,
        value,
      };
    }

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
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid email`,
            value,
          };
        }
        break;

      case 'url':
        if (typeof value !== 'string' || !this.isValidURL(value)) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid URL`,
            value,
          };
        }
        break;

      case 'uuid':
        if (typeof value !== 'string' || !this.isValidUUID(value)) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid UUID`,
            value,
          };
        }
        break;

      case 'date':
        if (!this.isValidDate(value)) {
          return {
            field: fieldName,
            message: `${fieldName} must be a valid date`,
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

    if (config.trimWhitespace) {
      sanitized = sanitized.trim();
    }

    if (config.removeEmpty && sanitized === '') {
      return sanitized;
    }

    if (config.escapeHTML) {
      sanitized = this.escapeHTML(sanitized);
    }

    return sanitized;
  }

  private escapeHTML(str: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };

    return str.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private isValidDate(value: any): boolean {
    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }

    return false;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // SQL injection prevention
  preventSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(select|insert|update|delete|drop|create|alter|exec|execute|union|script)\b)/gi,
      /(--|\/\*|\*\/|;|'|"|`)/g,
      /(\bor\b|\band\b)\s*(\d+\s*=\s*\d+|\w+\s*=\s*\w+)/gi,
    ];

    return !sqlPatterns.some(pattern => pattern.test(input));
  }

  // XSS prevention
  preventXSS(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /on\w+\s*=\s*["\'].*?["\']>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /\beval\s*\(/i,
    ];

    return !xssPatterns.some(pattern => pattern.test(input));
  }
}

export default BasicInputValidator;

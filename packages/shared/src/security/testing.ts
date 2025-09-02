import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export type TestSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type TestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type TestCategory = 
  | 'authentication'
  | 'authorization'
  | 'input_validation'
  | 'injection'
  | 'encryption'
  | 'session_management'
  | 'access_control'
  | 'configuration'
  | 'business_logic'
  | 'information_disclosure'
  | 'csrf'
  | 'xss'
  | 'file_upload'
  | 'api_security';

export interface SecurityTest {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  severity: TestSeverity;
  automated: boolean;
  endpoint?: string;
  method?: string;
  payload?: any;
  headers?: Record<string, string>;
  expectedResult: {
    vulnerable: boolean;
    indicators: string[];
    responseCode?: number;
    responsePattern?: RegExp;
  };
  status: TestStatus;
  result?: TestResult;
  executedAt?: Date;
  duration?: number;
  retries: number;
  maxRetries: number;
  tags: string[];
  cwe?: string;
  owasp?: string;
}

export interface TestResult {
  vulnerable: boolean;
  severity: TestSeverity;
  confidence: number;
  evidence: {
    request: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: any;
    };
    response: {
      status: number;
      headers: Record<string, string>;
      body: string;
      size: number;
      time: number;
    };
  };
  indicators: string[];
  recommendation: string;
  references: string[];
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: string[]; // Test IDs
  parallel: boolean;
  timeout: number;
  retryOnFailure: boolean;
  environment: string;
}

export interface TestReport {
  id: string;
  suiteId?: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  results: TestResult[];
  summary: string;
  recommendations: string[];
}

export class SecurityTestingFramework extends EventEmitter {
  private tests = new Map<string, SecurityTest>();
  private suites = new Map<string, TestSuite>();
  private reports = new Map<string, TestReport>();
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    super();
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'User-Agent': 'ProTour-Security-Scanner/1.0',
      'Accept': 'application/json',
      ...defaultHeaders,
    };

    this.initializeStandardTests();
  }

  private initializeStandardTests(): void {
    const standardTests: Omit<SecurityTest, 'id' | 'status' | 'retries'>[] = [
      // Authentication Tests
      {
        name: 'SQL Injection in Login',
        description: 'Test for SQL injection vulnerabilities in login form',
        category: 'injection',
        severity: 'high',
        automated: true,
        endpoint: '/api/auth/login',
        method: 'POST',
        payload: {
          email: "admin'--",
          password: 'any',
        },
        expectedResult: {
          vulnerable: true,
          indicators: ['syntax error', 'mysql', 'postgresql', 'sqlite', 'sql'],
          responseCode: 500,
        },
        maxRetries: 3,
        tags: ['owasp-top10', 'injection'],
        cwe: 'CWE-89',
        owasp: 'A03:2021 - Injection',
      },

      {
        name: 'Brute Force Protection',
        description: 'Test if login endpoint has rate limiting protection',
        category: 'authentication',
        severity: 'medium',
        automated: true,
        endpoint: '/api/auth/login',
        method: 'POST',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
        expectedResult: {
          vulnerable: false,
          indicators: ['rate limit', 'too many requests', 'locked'],
          responseCode: 429,
        },
        maxRetries: 1,
        tags: ['brute-force', 'rate-limiting'],
        cwe: 'CWE-307',
        owasp: 'A07:2021 - Identification and Authentication Failures',
      },

      // Authorization Tests
      {
        name: 'Broken Access Control',
        description: 'Test for horizontal privilege escalation',
        category: 'authorization',
        severity: 'high',
        automated: true,
        endpoint: '/api/users/{{user_id}}',
        method: 'GET',
        expectedResult: {
          vulnerable: true,
          indicators: ['unauthorized access', 'different user data'],
          responseCode: 200,
        },
        maxRetries: 2,
        tags: ['access-control', 'privilege-escalation'],
        cwe: 'CWE-639',
        owasp: 'A01:2021 - Broken Access Control',
      },

      // Input Validation Tests
      {
        name: 'XSS in User Input',
        description: 'Test for Cross-Site Scripting vulnerabilities',
        category: 'xss',
        severity: 'medium',
        automated: true,
        endpoint: '/api/profile',
        method: 'POST',
        payload: {
          name: '<script>alert("XSS")</script>',
          bio: '<img src=x onerror=alert("XSS")>',
        },
        expectedResult: {
          vulnerable: true,
          indicators: ['<script>', 'alert', 'onerror', 'javascript:'],
          responseCode: 200,
        },
        maxRetries: 2,
        tags: ['xss', 'input-validation'],
        cwe: 'CWE-79',
        owasp: 'A03:2021 - Injection',
      },

      // CSRF Tests
      {
        name: 'CSRF Token Validation',
        description: 'Test if CSRF protection is implemented',
        category: 'csrf',
        severity: 'medium',
        automated: true,
        endpoint: '/api/profile',
        method: 'POST',
        headers: {
          'Origin': 'https://malicious-site.com',
          'Referer': 'https://malicious-site.com',
        },
        payload: {
          name: 'Changed by CSRF',
        },
        expectedResult: {
          vulnerable: false,
          indicators: ['csrf token', 'forbidden', 'invalid origin'],
          responseCode: 403,
        },
        maxRetries: 1,
        tags: ['csrf', 'token-validation'],
        cwe: 'CWE-352',
        owasp: 'A01:2021 - Broken Access Control',
      },

      // File Upload Tests
      {
        name: 'Malicious File Upload',
        description: 'Test if dangerous file types can be uploaded',
        category: 'file_upload',
        severity: 'high',
        automated: true,
        endpoint: '/api/upload',
        method: 'POST',
        payload: {
          file: 'data:text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+', // <?php system($_GET['cmd']); ?>
          filename: 'shell.php',
        },
        expectedResult: {
          vulnerable: false,
          indicators: ['file type not allowed', 'forbidden extension'],
          responseCode: 400,
        },
        maxRetries: 1,
        tags: ['file-upload', 'malicious-file'],
        cwe: 'CWE-434',
        owasp: 'A04:2021 - Insecure Design',
      },

      // API Security Tests
      {
        name: 'API Rate Limiting',
        description: 'Test if API endpoints have rate limiting',
        category: 'api_security',
        severity: 'low',
        automated: true,
        endpoint: '/api/tournaments',
        method: 'GET',
        expectedResult: {
          vulnerable: false,
          indicators: ['rate limit', 'x-ratelimit-remaining'],
          responseCode: 429,
        },
        maxRetries: 1,
        tags: ['api-security', 'rate-limiting'],
        cwe: 'CWE-770',
        owasp: 'A04:2021 - Insecure Design',
      },

      // Session Management Tests
      {
        name: 'Session Fixation',
        description: 'Test if session IDs change after login',
        category: 'session_management',
        severity: 'medium',
        automated: true,
        endpoint: '/api/auth/login',
        method: 'POST',
        payload: {
          email: 'test@example.com',
          password: 'validpassword',
        },
        expectedResult: {
          vulnerable: false,
          indicators: ['new session id', 'set-cookie'],
        },
        maxRetries: 1,
        tags: ['session-management', 'session-fixation'],
        cwe: 'CWE-384',
        owasp: 'A07:2021 - Identification and Authentication Failures',
      },

      // Information Disclosure Tests
      {
        name: 'Error Information Disclosure',
        description: 'Test if error messages reveal sensitive information',
        category: 'information_disclosure',
        severity: 'low',
        automated: true,
        endpoint: '/api/nonexistent',
        method: 'GET',
        expectedResult: {
          vulnerable: true,
          indicators: ['stack trace', 'database error', 'file path', 'version'],
        },
        maxRetries: 1,
        tags: ['information-disclosure', 'error-handling'],
        cwe: 'CWE-209',
        owasp: 'A09:2021 - Security Logging and Monitoring Failures',
      },

      // Business Logic Tests
      {
        name: 'Price Manipulation',
        description: 'Test if payment amounts can be manipulated',
        category: 'business_logic',
        severity: 'high',
        automated: true,
        endpoint: '/api/tournaments/{{tournament_id}}/register',
        method: 'POST',
        payload: {
          entryFee: -100, // Negative amount
        },
        expectedResult: {
          vulnerable: false,
          indicators: ['invalid amount', 'validation error'],
          responseCode: 400,
        },
        maxRetries: 1,
        tags: ['business-logic', 'payment-manipulation'],
        cwe: 'CWE-840',
        owasp: 'A04:2021 - Insecure Design',
      },
    ];

    standardTests.forEach(test => {
      const securityTest: SecurityTest = {
        id: crypto.randomUUID(),
        status: 'pending',
        retries: 0,
        ...test,
      };
      
      this.tests.set(securityTest.id, securityTest);
    });
  }

  addTest(test: Omit<SecurityTest, 'id' | 'status' | 'retries'>): string {
    const securityTest: SecurityTest = {
      id: crypto.randomUUID(),
      status: 'pending',
      retries: 0,
      ...test,
    };

    this.tests.set(securityTest.id, securityTest);
    this.emit('testAdded', securityTest);
    
    return securityTest.id;
  }

  createSuite(suite: Omit<TestSuite, 'id'>): string {
    const testSuite: TestSuite = {
      id: crypto.randomUUID(),
      ...suite,
    };

    this.suites.set(testSuite.id, testSuite);
    return testSuite.id;
  }

  async runTest(testId: string, context: any = {}): Promise<TestResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    test.status = 'running';
    test.executedAt = new Date();
    
    this.emit('testStarted', test);

    const startTime = Date.now();

    try {
      const result = await this.executeTest(test, context);
      
      test.status = 'completed';
      test.result = result;
      test.duration = Date.now() - startTime;
      
      this.emit('testCompleted', { test, result });
      
      return result;

    } catch (error) {
      test.retries++;
      
      if (test.retries < test.maxRetries) {
        test.status = 'pending';
        this.emit('testRetrying', { test, error, attempt: test.retries });
        
        // Retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, test.retries) * 1000));
        return this.runTest(testId, context);
      }

      test.status = 'failed';
      test.duration = Date.now() - startTime;
      
      this.emit('testFailed', { test, error });
      
      throw error;
    }
  }

  private async executeTest(test: SecurityTest, context: any): Promise<TestResult> {
    if (!test.automated) {
      throw new Error('Manual test execution not supported');
    }

    // Replace placeholders in endpoint
    let endpoint = test.endpoint || '';
    Object.keys(context).forEach(key => {
      endpoint = endpoint.replace(`{{${key}}}`, context[key]);
    });

    const url = `${this.baseUrl}${endpoint}`;
    const requestHeaders = { ...this.defaultHeaders, ...test.headers };

    // Execute HTTP request
    const startTime = Date.now();
    const response = await this.makeRequest({
      url,
      method: test.method || 'GET',
      headers: requestHeaders,
      body: test.payload,
    });
    const responseTime = Date.now() - startTime;

    // Analyze response
    return this.analyzeResponse(test, {
      request: {
        url,
        method: test.method || 'GET',
        headers: requestHeaders,
        body: test.payload,
      },
      response: {
        status: response.status,
        headers: response.headers,
        body: response.body,
        size: response.body.length,
        time: responseTime,
      },
    });
  }

  private async makeRequest(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  }): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    const { url, method, headers, body } = options;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        headers: responseHeaders,
        body: await response.text(),
      };

    } catch (error) {
      throw new Error(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private analyzeResponse(
    test: SecurityTest,
    evidence: TestResult['evidence']
  ): TestResult {
    let vulnerable = false;
    let confidence = 0;
    const indicators: string[] = [];

    // Check response code
    if (test.expectedResult.responseCode) {
      const codeMatch = evidence.response.status === test.expectedResult.responseCode;
      if (test.expectedResult.vulnerable) {
        vulnerable = codeMatch;
        confidence += codeMatch ? 30 : 0;
      } else {
        vulnerable = !codeMatch;
        confidence += !codeMatch ? 30 : 0;
      }
    }

    // Check response pattern
    if (test.expectedResult.responsePattern) {
      const patternMatch = test.expectedResult.responsePattern.test(evidence.response.body);
      if (test.expectedResult.vulnerable) {
        vulnerable = vulnerable || patternMatch;
        confidence += patternMatch ? 40 : 0;
      } else {
        vulnerable = vulnerable || !patternMatch;
        confidence += !patternMatch ? 40 : 0;
      }
    }

    // Check indicators
    for (const indicator of test.expectedResult.indicators) {
      if (evidence.response.body.toLowerCase().includes(indicator.toLowerCase())) {
        indicators.push(indicator);
        confidence += 20;
        
        if (test.expectedResult.vulnerable) {
          vulnerable = true;
        }
      }
    }

    // Check security headers
    this.checkSecurityHeaders(evidence.response.headers, indicators);

    // Determine final vulnerability status
    if (test.expectedResult.vulnerable) {
      vulnerable = indicators.length > 0 || vulnerable;
    } else {
      // For tests expecting non-vulnerable behavior, vulnerability means the protection failed
      vulnerable = !vulnerable && indicators.length === 0;
    }

    confidence = Math.min(confidence, 100);

    return {
      vulnerable,
      severity: vulnerable ? test.severity : 'info',
      confidence,
      evidence,
      indicators,
      recommendation: this.generateRecommendation(test, vulnerable),
      references: this.generateReferences(test),
    };
  }

  private checkSecurityHeaders(headers: Record<string, string>, indicators: string[]): void {
    const securityHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': ['DENY', 'SAMEORIGIN'],
      'x-xss-protection': '1',
      'strict-transport-security': 'max-age',
      'content-security-policy': 'default-src',
    };

    for (const [header, expected] of Object.entries(securityHeaders)) {
      const value = headers[header];
      
      if (!value) {
        indicators.push(`Missing security header: ${header}`);
      } else if (Array.isArray(expected)) {
        if (!expected.some(exp => value.includes(exp))) {
          indicators.push(`Weak security header: ${header}`);
        }
      } else if (!value.includes(expected)) {
        indicators.push(`Weak security header: ${header}`);
      }
    }
  }

  private generateRecommendation(test: SecurityTest, vulnerable: boolean): string {
    if (!vulnerable) {
      return 'No security issues detected. Continue monitoring.';
    }

    const recommendations: Record<TestCategory, string> = {
      authentication: 'Implement proper input validation and rate limiting for authentication endpoints.',
      authorization: 'Implement proper access controls and verify user permissions for all resources.',
      input_validation: 'Implement input validation and sanitization for all user inputs.',
      injection: 'Use parameterized queries and input validation to prevent injection attacks.',
      encryption: 'Implement proper encryption for data at rest and in transit.',
      session_management: 'Implement secure session management with proper token handling.',
      access_control: 'Implement role-based access control and verify permissions.',
      configuration: 'Review and secure application and server configurations.',
      business_logic: 'Implement proper business logic validation and constraints.',
      information_disclosure: 'Implement proper error handling to avoid information leakage.',
      csrf: 'Implement CSRF tokens and validate request origins.',
      xss: 'Implement input validation, output encoding, and Content Security Policy.',
      file_upload: 'Implement file type validation, size limits, and malware scanning.',
      api_security: 'Implement proper API authentication, rate limiting, and input validation.',
    };

    return recommendations[test.category] || 'Review the security implementation for this component.';
  }

  private generateReferences(test: SecurityTest): string[] {
    const references: string[] = [];

    if (test.owasp) {
      references.push(`OWASP: ${test.owasp}`);
    }

    if (test.cwe) {
      references.push(`CWE: ${test.cwe}`);
    }

    references.push('ProTour Security Guidelines');

    return references;
  }

  async runSuite(suiteId: string, context: any = {}): Promise<TestReport> {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Test suite ${suiteId} not found`);
    }

    const reportId = crypto.randomUUID();
    const startTime = new Date();

    const report: TestReport = {
      id: reportId,
      suiteId,
      startTime,
      duration: 0,
      totalTests: suite.tests.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      vulnerabilities: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
      results: [],
      summary: '',
      recommendations: [],
    };

    this.reports.set(reportId, report);
    this.emit('suiteStarted', { suite, report });

    try {
      if (suite.parallel) {
        // Run tests in parallel
        const promises = suite.tests.map(testId => 
          this.runTest(testId, context).catch(error => ({ error, testId }))
        );

        const results = await Promise.all(promises);
        
        for (const result of results) {
          if ('error' in result) {
            report.failed++;
          } else {
            report.results.push(result);
            report.passed++;
            
            if (result.vulnerable) {
              report.vulnerabilities[result.severity]++;
            }
          }
        }
      } else {
        // Run tests sequentially
        for (const testId of suite.tests) {
          try {
            const result = await this.runTest(testId, context);
            report.results.push(result);
            report.passed++;
            
            if (result.vulnerable) {
              report.vulnerabilities[result.severity]++;
            }
          } catch (error) {
            report.failed++;
          }
        }
      }

      report.endTime = new Date();
      report.duration = report.endTime.getTime() - startTime.getTime();
      report.summary = this.generateSummary(report);
      report.recommendations = this.generateSuiteRecommendations(report);

      this.emit('suiteCompleted', { suite, report });
      
      return report;

    } catch (error) {
      this.emit('suiteFailed', { suite, report, error });
      throw error;
    }
  }

  private generateSummary(report: TestReport): string {
    const totalVulns = Object.values(report.vulnerabilities).reduce((a, b) => a + b, 0);
    
    if (totalVulns === 0) {
      return 'No vulnerabilities detected. Security posture is good.';
    }

    const critical = report.vulnerabilities.critical;
    const high = report.vulnerabilities.high;

    if (critical > 0) {
      return `${totalVulns} vulnerabilities found including ${critical} critical issues. Immediate action required.`;
    } else if (high > 0) {
      return `${totalVulns} vulnerabilities found including ${high} high-severity issues. Action recommended.`;
    } else {
      return `${totalVulns} low to medium severity vulnerabilities found. Review recommended.`;
    }
  }

  private generateSuiteRecommendations(report: TestReport): string[] {
    const recommendations = new Set<string>();
    
    report.results.forEach(result => {
      if (result.vulnerable) {
        recommendations.add(result.recommendation);
      }
    });

    if (report.vulnerabilities.critical > 0) {
      recommendations.add('Prioritize fixing critical vulnerabilities immediately.');
    }

    if (report.vulnerabilities.high > 0) {
      recommendations.add('Address high-severity vulnerabilities in the next release cycle.');
    }

    return Array.from(recommendations);
  }

  getTest(testId: string): SecurityTest | null {
    return this.tests.get(testId) || null;
  }

  getTests(filter?: { category?: TestCategory; severity?: TestSeverity }): SecurityTest[] {
    let tests = Array.from(this.tests.values());

    if (filter) {
      if (filter.category) {
        tests = tests.filter(t => t.category === filter.category);
      }
      if (filter.severity) {
        tests = tests.filter(t => t.severity === filter.severity);
      }
    }

    return tests;
  }

  getReport(reportId: string): TestReport | null {
    return this.reports.get(reportId) || null;
  }

  // Middleware for automated security testing
  continuousSecurityTesting() {
    return (req: Request, res: Response, next: NextFunction) => {
      // This would integrate with CI/CD pipelines
      // to run security tests on each deployment
      
      const originalEnd = res.end;
      
      res.end = function(this: Response, ...args: any[]) {
        // Run lightweight security checks after response
        setImmediate(() => {
          // Example: Check for sensitive data in response
          if (res.statusCode === 500) {
            // Log potential information disclosure
            console.warn('Potential information disclosure in error response');
          }
        });

        originalEnd.apply(this, args);
      };

      next();
    };
  }
}

export default SecurityTestingFramework;
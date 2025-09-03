import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  source: {
    ip: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
  };
  details: Record<string, any>;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  metadata: {
    detectionRule?: string;
    confidence: number;
    automaticResponse?: string;
  };
}

export type SecurityEventType =
  | 'authentication_failure'
  | 'brute_force_attempt'
  | 'suspicious_login'
  | 'unauthorized_access'
  | 'privilege_escalation'
  | 'data_exfiltration'
  | 'injection_attempt'
  | 'malware_detected'
  | 'anomalous_behavior'
  | 'rate_limit_exceeded'
  | 'account_lockout'
  | 'password_spray'
  | 'credential_stuffing'
  | 'session_hijacking'
  | 'csrf_attempt'
  | 'xss_attempt'
  | 'file_upload_threat'
  | 'api_abuse'
  | 'vulnerability_scan'
  | 'ddos_attempt';

export interface ThreatIntelligence {
  ipAddress: string;
  reputation: 'malicious' | 'suspicious' | 'unknown' | 'trusted';
  sources: string[];
  lastUpdated: Date;
  indicators: {
    isProxy: boolean;
    isTor: boolean;
    isVPN: boolean;
    isDatacenter: boolean;
    isBotnet: boolean;
  };
  geolocation: {
    country: string;
    region: string;
    city: string;
    asn: string;
  };
}

export interface VulnerabilityReport {
  id: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  category:
    | 'injection'
    | 'authentication'
    | 'encryption'
    | 'access_control'
    | 'configuration'
    | 'dependency';
  title: string;
  description: string;
  cwe?: string;
  cvss?: {
    version: string;
    score: number;
    vector: string;
  };
  location: {
    file?: string;
    line?: number;
    endpoint?: string;
    parameter?: string;
  };
  remediation: string;
  references: string[];
  status: 'new' | 'acknowledged' | 'fixed' | 'wont_fix' | 'false_positive';
  discoveredAt: Date;
  fixedAt?: Date;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<string, number>;
  blocked: number;
  allowed: number;
  falsePositives: number;
  averageResponseTime: number;
  topThreats: Array<{ type: SecurityEventType; count: number }>;
  vulnerabilities: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

export class SecurityEventDetector extends EventEmitter {
  private events: SecurityEvent[] = [];
  private threatIntel = new Map<string, ThreatIntelligence>();
  private suspiciousIPs = new Map<
    string,
    { attempts: number; lastAttempt: Date }
  >();
  private detectionRules = new Map<
    string,
    (req: Request, context: any) => SecurityEvent | null
  >();

  constructor() {
    super();
    this.initializeDetectionRules();
  }

  private initializeDetectionRules() {
    // Brute force detection
    this.detectionRules.set('brute_force', (req: Request, context: any) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const suspicious = this.suspiciousIPs.get(ip);

      if (
        suspicious &&
        suspicious.attempts > 5 &&
        Date.now() - suspicious.lastAttempt.getTime() < 300000
      ) {
        // 5 minutes
        return {
          id: crypto.randomUUID(),
          type: 'brute_force_attempt',
          severity: 'high',
          timestamp: new Date(),
          source: {
            ip,
            userAgent: req.get('User-Agent'),
            userId: context.userId,
            sessionId: context.sessionId,
          },
          details: {
            attempts: suspicious.attempts,
            timeWindow: '5 minutes',
            endpoint: req.path,
          },
          status: 'active',
          metadata: {
            detectionRule: 'brute_force',
            confidence: 0.9,
            automaticResponse: 'ip_block',
          },
        };
      }
      return null;
    });

    // SQL injection detection
    this.detectionRules.set('sql_injection', (req: Request, context: any) => {
      const sqlPatterns = [
        /(\b(union|select|insert|update|delete|drop|exec|script)\b.*\b(from|where|and|or)\b)/gi,
        /(--|\/\*|\*\/|;|\bor\b\s+\d+\s*=\s*\d+|\band\b\s+\d+\s*=\s*\d+)/gi,
      ];

      const checkValue = (value: string): boolean => {
        return sqlPatterns.some(pattern => pattern.test(value));
      };

      const checkObject = (obj: any): boolean => {
        if (typeof obj === 'string') return checkValue(obj);
        if (Array.isArray(obj)) return obj.some(checkObject);
        if (obj && typeof obj === 'object')
          return Object.values(obj).some(checkObject);
        return false;
      };

      if (checkObject(req.body) || checkObject(req.query)) {
        return {
          id: crypto.randomUUID(),
          type: 'injection_attempt',
          severity: 'high',
          timestamp: new Date(),
          source: {
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent'),
            userId: context.userId,
            sessionId: context.sessionId,
          },
          details: {
            injectionType: 'sql',
            endpoint: req.path,
            method: req.method,
            payload: {
              body: req.body,
              query: req.query,
            },
          },
          status: 'active',
          metadata: {
            detectionRule: 'sql_injection',
            confidence: 0.85,
            automaticResponse: 'block_request',
          },
        };
      }
      return null;
    });

    // XSS detection
    this.detectionRules.set('xss_detection', (req: Request, context: any) => {
      const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /on\w+\s*=\s*["\'].*?["\']>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
      ];

      const checkValue = (value: string): boolean => {
        return xssPatterns.some(pattern => pattern.test(value));
      };

      const checkObject = (obj: any): boolean => {
        if (typeof obj === 'string') return checkValue(obj);
        if (Array.isArray(obj)) return obj.some(checkObject);
        if (obj && typeof obj === 'object')
          return Object.values(obj).some(checkObject);
        return false;
      };

      if (checkObject(req.body) || checkObject(req.query)) {
        return {
          id: crypto.randomUUID(),
          type: 'xss_attempt',
          severity: 'medium',
          timestamp: new Date(),
          source: {
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent'),
            userId: context.userId,
            sessionId: context.sessionId,
          },
          details: {
            injectionType: 'xss',
            endpoint: req.path,
            method: req.method,
            payload: {
              body: req.body,
              query: req.query,
            },
          },
          status: 'active',
          metadata: {
            detectionRule: 'xss_detection',
            confidence: 0.8,
            automaticResponse: 'sanitize_and_log',
          },
        };
      }
      return null;
    });

    // Anomalous behavior detection
    this.detectionRules.set(
      'anomalous_behavior',
      (req: Request, context: any) => {
        const anomalies = [];

        // Check for unusual user agent
        const userAgent = req.get('User-Agent');
        if (!userAgent || userAgent.length < 10) {
          anomalies.push('Missing or short User-Agent');
        }

        // Check for unusual request patterns
        if (req.path.includes('..') || req.path.includes('%2e%2e')) {
          anomalies.push('Path traversal attempt');
        }

        // Check for unusual headers
        const suspiciousHeaders = [
          'x-forwarded-for',
          'x-real-ip',
          'x-originating-ip',
        ];
        const hasSuspiciousHeaders = suspiciousHeaders.some(header =>
          req.get(header)
        );

        if (anomalies.length > 0 || hasSuspiciousHeaders) {
          return {
            id: crypto.randomUUID(),
            type: 'anomalous_behavior',
            severity: 'medium',
            timestamp: new Date(),
            source: {
              ip: req.ip || req.connection.remoteAddress || 'unknown',
              userAgent,
              userId: context.userId,
              sessionId: context.sessionId,
            },
            details: {
              anomalies,
              hasSuspiciousHeaders,
              endpoint: req.path,
              headers: req.headers,
            },
            status: 'active',
            metadata: {
              detectionRule: 'anomalous_behavior',
              confidence: 0.6,
              automaticResponse: 'monitor',
            },
          };
        }
        return null;
      }
    );
  }

  detect(req: Request, context: any = {}): SecurityEvent[] {
    const detectedEvents: SecurityEvent[] = [];

    for (const [ruleName, rule] of this.detectionRules) {
      try {
        const event = rule(req, context);
        if (event) {
          detectedEvents.push(event);
          this.recordEvent(event);
        }
      } catch (error) {
        console.error(`Error in detection rule ${ruleName}:`, error);
      }
    }

    return detectedEvents;
  }

  recordEvent(event: SecurityEvent): void {
    this.events.push(event);
    this.emit('securityEvent', event);

    // Update suspicious IP tracking
    if (
      event.type === 'authentication_failure' ||
      event.type === 'brute_force_attempt'
    ) {
      const ip = event.source.ip;
      const existing = this.suspiciousIPs.get(ip);
      this.suspiciousIPs.set(ip, {
        attempts: (existing?.attempts || 0) + 1,
        lastAttempt: new Date(),
      });
    }
  }

  getEvents(filter?: {
    type?: SecurityEventType;
    severity?: string;
    status?: string;
    since?: Date;
    limit?: number;
  }): SecurityEvent[] {
    let filtered = this.events;

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(e => e.type === filter.type);
      }
      if (filter.severity) {
        filtered = filtered.filter(e => e.severity === filter.severity);
      }
      if (filter.status) {
        filtered = filtered.filter(e => e.status === filter.status);
      }
      if (filter.since) {
        filtered = filtered.filter(e => e.timestamp >= filter.since!);
      }
    }

    const limit = filter?.limit || 100;
    return filtered.slice(-limit);
  }

  getMetrics(period: { start: Date; end: Date }): SecurityMetrics {
    const periodEvents = this.events.filter(
      e => e.timestamp >= period.start && e.timestamp <= period.end
    );

    const eventsByType: Record<SecurityEventType, number> = {} as any;
    const eventsBySeverity: Record<string, number> = {};

    periodEvents.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] =
        (eventsBySeverity[event.severity] || 0) + 1;
    });

    const topThreats = Object.entries(eventsByType)
      .map(([type, count]) => ({ type: type as SecurityEventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents: periodEvents.length,
      eventsByType,
      eventsBySeverity,
      blocked: periodEvents.filter(e =>
        e.metadata.automaticResponse?.includes('block')
      ).length,
      allowed: periodEvents.filter(
        e => !e.metadata.automaticResponse?.includes('block')
      ).length,
      falsePositives: periodEvents.filter(e => e.status === 'false_positive')
        .length,
      averageResponseTime: 0, // Would need to track response times
      topThreats,
      vulnerabilities: {
        total: 0,
        bySeverity: {},
        byCategory: {},
      },
    };
  }

  updateThreatIntelligence(ip: string, intel: ThreatIntelligence): void {
    this.threatIntel.set(ip, intel);
  }

  getThreatIntelligence(ip: string): ThreatIntelligence | null {
    return this.threatIntel.get(ip) || null;
  }

  isIPSuspicious(ip: string): boolean {
    const intel = this.getThreatIntelligence(ip);
    if (intel && ['malicious', 'suspicious'].includes(intel.reputation)) {
      return true;
    }

    const suspicious = this.suspiciousIPs.get(ip);
    return !!(suspicious && suspicious.attempts > 3);
  }
}

export class VulnerabilityScanner {
  private vulnerabilities: VulnerabilityReport[] = [];
  private scanners = new Map<string, () => Promise<VulnerabilityReport[]>>();

  constructor() {
    this.initializeScanners();
  }

  private initializeScanners() {
    // Dependency vulnerability scanner
    this.scanners.set('dependencies', async () => {
      const vulnerabilities: VulnerabilityReport[] = [];

      // This would integrate with tools like npm audit, Snyk, etc.
      // For now, return empty array
      return vulnerabilities;
    });

    // Configuration scanner
    this.scanners.set('configuration', async () => {
      const vulnerabilities: VulnerabilityReport[] = [];

      // Check for common misconfigurations
      // This would check environment variables, security headers, etc.

      return vulnerabilities;
    });
  }

  async runScan(scanType?: string): Promise<VulnerabilityReport[]> {
    const results: VulnerabilityReport[] = [];

    if (scanType && this.scanners.has(scanType)) {
      const scanner = this.scanners.get(scanType)!;
      const scanResults = await scanner();
      results.push(...scanResults);
    } else {
      // Run all scanners
      for (const [type, scanner] of this.scanners) {
        try {
          const scanResults = await scanner();
          results.push(...scanResults);
        } catch (error) {
          console.error(`Error running ${type} scanner:`, error);
        }
      }
    }

    // Store results
    results.forEach(vuln => {
      const existing = this.vulnerabilities.find(v => v.id === vuln.id);
      if (!existing) {
        this.vulnerabilities.push(vuln);
      }
    });

    return results;
  }

  getVulnerabilities(filter?: {
    severity?: string;
    category?: string;
    status?: string;
  }): VulnerabilityReport[] {
    let filtered = this.vulnerabilities;

    if (filter) {
      if (filter.severity) {
        filtered = filtered.filter(v => v.severity === filter.severity);
      }
      if (filter.category) {
        filtered = filtered.filter(v => v.category === filter.category);
      }
      if (filter.status) {
        filtered = filtered.filter(v => v.status === filter.status);
      }
    }

    return filtered;
  }

  markVulnerabilityFixed(id: string): void {
    const vuln = this.vulnerabilities.find(v => v.id === id);
    if (vuln) {
      vuln.status = 'fixed';
      vuln.fixedAt = new Date();
    }
  }
}

// Security monitoring middleware
export const securityMonitoring = (detector: SecurityEventDetector) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = {
      userId: (req as any).user?.userId,
      sessionId: (req as any).user?.sessionId,
      timestamp: new Date(),
    };

    // Run detection
    const events = detector.detect(req, context);

    // Handle automatic responses
    for (const event of events) {
      if (event.metadata.automaticResponse === 'block_request') {
        return res.status(403).json({
          error: 'Request blocked by security policy',
          eventId: event.id,
        });
      }
    }

    // Add security headers based on threat level
    if (events.some(e => e.severity === 'high' || e.severity === 'critical')) {
      res.setHeader('X-Security-Warning', 'High threat activity detected');
    }

    next();
  };
};

// Security metrics endpoint
export const securityMetricsHandler = (detector: SecurityEventDetector) => {
  return (req: Request, res: Response) => {
    const period = {
      start: req.query.start
        ? new Date(req.query.start as string)
        : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: req.query.end ? new Date(req.query.end as string) : new Date(),
    };

    const metrics = detector.getMetrics(period);
    res.json(metrics);
  };
};

export default {
  SecurityEventDetector,
  VulnerabilityScanner,
  securityMonitoring,
  securityMetricsHandler,
};

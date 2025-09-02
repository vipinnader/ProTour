/**
 * Comprehensive audit logging and compliance tracking for ProTour
 * Provides detailed logging for security, compliance, and forensic analysis
 */

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  actor: AuditActor;
  resource: AuditResource;
  action: string;
  outcome: 'success' | 'failure' | 'pending';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  metadata: AuditMetadata;
  tags: string[];
  correlationId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  location?: AuditLocation;
  riskScore?: number;
}

export type AuditEventType = 
  | 'authentication'
  | 'authorization' 
  | 'data_access'
  | 'data_modification'
  | 'data_deletion'
  | 'system_access'
  | 'admin_action'
  | 'security_event'
  | 'compliance_event'
  | 'payment_event'
  | 'user_action'
  | 'system_event'
  | 'error_event';

export interface AuditActor {
  type: 'user' | 'system' | 'service' | 'anonymous';
  id: string;
  name?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  serviceAccount?: boolean;
}

export interface AuditResource {
  type: 'user' | 'tournament' | 'match' | 'payment' | 'system' | 'file' | 'setting';
  id: string;
  name?: string;
  collection?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  dataClassification?: string[];
}

export interface AuditMetadata {
  version: string;
  environment: string;
  service: string;
  component?: string;
  function?: string;
  requestId?: string;
  traceId?: string;
  buildVersion?: string;
}

export interface AuditLocation {
  country: string;
  region: string;
  city?: string;
  timezone: string;
  coordinates?: { latitude: number; longitude: number };
}

export interface ComplianceReport {
  id: string;
  reportType: 'gdpr' | 'sox' | 'hipaa' | 'iso27001' | 'custom';
  period: { start: Date; end: Date };
  generatedAt: Date;
  events: AuditEvent[];
  summary: ComplianceReportSummary;
  violations: ComplianceViolation[];
  recommendations: string[];
}

export interface ComplianceReportSummary {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<string, number>;
  failureRate: number;
  riskDistribution: Record<string, number>;
  complianceScore: number;
}

export interface ComplianceViolation {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  events: string[];
  riskLevel: number;
  recommendation: string;
  status: 'open' | 'acknowledged' | 'resolved';
}

export interface AuditQuery {
  eventTypes?: AuditEventType[];
  actors?: string[];
  resources?: string[];
  outcomes?: Array<'success' | 'failure' | 'pending'>;
  severities?: Array<'low' | 'medium' | 'high' | 'critical'>;
  dateRange?: { start: Date; end: Date };
  ipAddresses?: string[];
  tags?: string[];
  riskScoreRange?: { min: number; max: number };
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export abstract class AuditStorage {
  abstract save(event: AuditEvent): Promise<void>;
  abstract saveBatch(events: AuditEvent[]): Promise<void>;
  abstract query(query: AuditQuery): Promise<AuditEvent[]>;
  abstract count(query: AuditQuery): Promise<number>;
  abstract deleteOldEvents(olderThan: Date): Promise<number>;
  abstract export(query: AuditQuery, format: 'json' | 'csv' | 'xml'): Promise<string>;
}

export class FirestoreAuditStorage extends AuditStorage {
  private firestore: any;
  private collection: string;

  constructor(firestore: any, collection: string = 'audit_logs') {
    super();
    this.firestore = firestore;
    this.collection = collection;
  }

  async save(event: AuditEvent): Promise<void> {
    try {
      await this.firestore.collection(this.collection).doc(event.id).set({
        ...event,
        timestamp: event.timestamp,
      });
    } catch (error) {
      console.error('[AuditLog] Failed to save audit event:', error);
      throw error;
    }
  }

  async saveBatch(events: AuditEvent[]): Promise<void> {
    try {
      const batch = this.firestore.batch();
      
      events.forEach(event => {
        const ref = this.firestore.collection(this.collection).doc(event.id);
        batch.set(ref, {
          ...event,
          timestamp: event.timestamp,
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('[AuditLog] Failed to save audit events batch:', error);
      throw error;
    }
  }

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    try {
      let firestoreQuery = this.firestore.collection(this.collection);

      // Apply filters
      if (query.eventTypes && query.eventTypes.length > 0) {
        firestoreQuery = firestoreQuery.where('eventType', 'in', query.eventTypes);
      }

      if (query.outcomes && query.outcomes.length > 0) {
        firestoreQuery = firestoreQuery.where('outcome', 'in', query.outcomes);
      }

      if (query.severities && query.severities.length > 0) {
        firestoreQuery = firestoreQuery.where('severity', 'in', query.severities);
      }

      if (query.dateRange) {
        firestoreQuery = firestoreQuery
          .where('timestamp', '>=', query.dateRange.start)
          .where('timestamp', '<=', query.dateRange.end);
      }

      // Apply sorting
      const sortBy = query.sortBy || 'timestamp';
      const sortOrder = query.sortOrder || 'desc';
      firestoreQuery = firestoreQuery.orderBy(sortBy, sortOrder);

      // Apply pagination
      if (query.limit) {
        firestoreQuery = firestoreQuery.limit(query.limit);
      }

      if (query.offset) {
        // Note: Firestore doesn't have direct offset, need to use cursor-based pagination
        // This is a simplified implementation
      }

      const snapshot = await firestoreQuery.get();
      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      }));
    } catch (error) {
      console.error('[AuditLog] Failed to query audit events:', error);
      throw error;
    }
  }

  async count(query: AuditQuery): Promise<number> {
    // Simplified count implementation
    const events = await this.query({ ...query, limit: undefined });
    return events.length;
  }

  async deleteOldEvents(olderThan: Date): Promise<number> {
    try {
      const query = this.firestore
        .collection(this.collection)
        .where('timestamp', '<', olderThan);

      const snapshot = await query.get();
      const batch = this.firestore.batch();

      snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      return snapshot.size;
    } catch (error) {
      console.error('[AuditLog] Failed to delete old events:', error);
      throw error;
    }
  }

  async export(query: AuditQuery, format: 'json' | 'csv' | 'xml'): Promise<string> {
    const events = await this.query(query);
    
    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);
      
      case 'csv':
        return this.convertToCSV(events);
      
      case 'xml':
        return this.convertToXML(events);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private convertToCSV(events: AuditEvent[]): string {
    if (events.length === 0) return '';

    const headers = [
      'id', 'timestamp', 'eventType', 'actor.id', 'actor.type', 
      'resource.id', 'resource.type', 'action', 'outcome', 'severity',
      'ipAddress', 'userAgent'
    ];

    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.eventType,
      event.actor.id,
      event.actor.type,
      event.resource.id,
      event.resource.type,
      event.action,
      event.outcome,
      event.severity,
      event.ipAddress,
      event.userAgent,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToXML(events: AuditEvent[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<audit_events>\n';
    
    events.forEach(event => {
      xml += '  <event>\n';
      xml += `    <id>${this.escapeXML(event.id)}</id>\n`;
      xml += `    <timestamp>${event.timestamp.toISOString()}</timestamp>\n`;
      xml += `    <eventType>${event.eventType}</eventType>\n`;
      xml += `    <action>${this.escapeXML(event.action)}</action>\n`;
      xml += `    <outcome>${event.outcome}</outcome>\n`;
      xml += `    <severity>${event.severity}</severity>\n`;
      xml += `    <ipAddress>${this.escapeXML(event.ipAddress)}</ipAddress>\n`;
      xml += '  </event>\n';
    });
    
    xml += '</audit_events>';
    return xml;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export class AuditLogger {
  private storage: AuditStorage;
  private metadata: AuditMetadata;
  private eventBuffer: AuditEvent[] = [];
  private batchSize: number;
  private flushInterval: number;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    storage: AuditStorage,
    metadata: AuditMetadata,
    options: { batchSize?: number; flushInterval?: number } = {}
  ) {
    this.storage = storage;
    this.metadata = metadata;
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 5000; // 5 seconds

    this.startBatchProcessing();
  }

  /**
   * Log audit event
   */
  async log(
    eventType: AuditEventType,
    action: string,
    actor: AuditActor,
    resource: AuditResource,
    outcome: 'success' | 'failure' | 'pending',
    details: Record<string, any> = {},
    options: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      correlationId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      tags?: string[];
      riskScore?: number;
    } = {}
  ): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      eventType,
      actor,
      resource,
      action,
      outcome,
      severity: options.severity || this.calculateSeverity(eventType, outcome),
      details: this.sanitizeDetails(details),
      metadata: this.metadata,
      tags: options.tags || [],
      correlationId: options.correlationId,
      sessionId: options.sessionId,
      ipAddress: options.ipAddress || 'unknown',
      userAgent: options.userAgent || 'unknown',
      riskScore: options.riskScore || this.calculateRiskScore(eventType, outcome, actor),
    };

    // Add to buffer for batch processing
    this.eventBuffer.push(event);

    // Immediate flush for critical events
    if (event.severity === 'critical' || outcome === 'failure') {
      await this.flush();
    } else if (this.eventBuffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Log authentication events
   */
  async logAuthentication(
    action: 'login' | 'logout' | 'password_change' | 'mfa_setup' | 'account_locked',
    actor: AuditActor,
    outcome: 'success' | 'failure',
    details: Record<string, any> = {},
    options: any = {}
  ): Promise<void> {
    await this.log(
      'authentication',
      action,
      actor,
      { type: 'user', id: actor.id, name: actor.name },
      outcome,
      details,
      {
        ...options,
        severity: outcome === 'failure' ? 'high' : 'low',
        tags: ['auth', action],
      }
    );
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    action: 'read' | 'query' | 'export',
    actor: AuditActor,
    resource: AuditResource,
    outcome: 'success' | 'failure',
    details: Record<string, any> = {},
    options: any = {}
  ): Promise<void> {
    await this.log(
      'data_access',
      action,
      actor,
      resource,
      outcome,
      details,
      {
        ...options,
        severity: this.calculateDataAccessSeverity(resource, action),
        tags: ['data', 'access', resource.type],
      }
    );
  }

  /**
   * Log data modification events
   */
  async logDataModification(
    action: 'create' | 'update' | 'delete',
    actor: AuditActor,
    resource: AuditResource,
    outcome: 'success' | 'failure',
    details: Record<string, any> = {},
    options: any = {}
  ): Promise<void> {
    await this.log(
      'data_modification',
      action,
      actor,
      resource,
      outcome,
      details,
      {
        ...options,
        severity: action === 'delete' ? 'high' : 'medium',
        tags: ['data', 'modification', resource.type, action],
      }
    );
  }

  /**
   * Log admin actions
   */
  async logAdminAction(
    action: string,
    actor: AuditActor,
    resource: AuditResource,
    outcome: 'success' | 'failure',
    details: Record<string, any> = {},
    options: any = {}
  ): Promise<void> {
    await this.log(
      'admin_action',
      action,
      actor,
      resource,
      outcome,
      details,
      {
        ...options,
        severity: 'high',
        tags: ['admin', action, resource.type],
      }
    );
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    action: string,
    actor: AuditActor,
    outcome: 'success' | 'failure',
    details: Record<string, any> = {},
    options: any = {}
  ): Promise<void> {
    await this.log(
      'security_event',
      action,
      actor,
      { type: 'system', id: 'security' },
      outcome,
      details,
      {
        ...options,
        severity: 'critical',
        tags: ['security', action],
        riskScore: 90,
      }
    );
  }

  /**
   * Log payment events
   */
  async logPaymentEvent(
    action: 'payment_created' | 'payment_processed' | 'payment_failed' | 'refund_issued',
    actor: AuditActor,
    resource: AuditResource,
    outcome: 'success' | 'failure',
    details: Record<string, any> = {},
    options: any = {}
  ): Promise<void> {
    await this.log(
      'payment_event',
      action,
      actor,
      resource,
      outcome,
      this.sanitizePaymentDetails(details),
      {
        ...options,
        severity: outcome === 'failure' ? 'high' : 'medium',
        tags: ['payment', action],
      }
    );
  }

  /**
   * Flush events to storage
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];
      
      await this.storage.saveBatch(events);
      console.log(`[AuditLog] Flushed ${events.length} audit events`);
    } catch (error) {
      console.error('[AuditLog] Failed to flush events:', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...this.eventBuffer);
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    reportType: 'gdpr' | 'sox' | 'hipaa' | 'iso27001' | 'custom',
    period: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    const query: AuditQuery = {
      dateRange: period,
      limit: 10000, // Adjust as needed
    };

    const events = await this.storage.query(query);
    const summary = this.calculateReportSummary(events);
    const violations = this.detectComplianceViolations(events, reportType);

    return {
      id: this.generateEventId(),
      reportType,
      period,
      generatedAt: new Date(),
      events,
      summary,
      violations,
      recommendations: this.generateRecommendations(violations),
    };
  }

  /**
   * Search audit logs
   */
  async search(query: AuditQuery): Promise<AuditEvent[]> {
    return this.storage.query(query);
  }

  /**
   * Export audit logs
   */
  async export(
    query: AuditQuery,
    format: 'json' | 'csv' | 'xml'
  ): Promise<string> {
    return this.storage.export(query, format);
  }

  /**
   * Cleanup old audit logs
   */
  async cleanup(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    return this.storage.deleteOldEvents(cutoffDate);
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateSeverity(
    eventType: AuditEventType,
    outcome: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (outcome === 'failure') {
      switch (eventType) {
        case 'authentication':
        case 'security_event':
          return 'high';
        case 'admin_action':
        case 'data_deletion':
          return 'critical';
        default:
          return 'medium';
      }
    }

    switch (eventType) {
      case 'security_event':
      case 'admin_action':
        return 'high';
      case 'data_modification':
      case 'payment_event':
        return 'medium';
      default:
        return 'low';
    }
  }

  private calculateRiskScore(
    eventType: AuditEventType,
    outcome: string,
    actor: AuditActor
  ): number {
    let baseScore = 10;

    // Event type risk
    const eventRiskMap: Record<AuditEventType, number> = {
      security_event: 90,
      admin_action: 70,
      data_deletion: 80,
      data_modification: 50,
      payment_event: 60,
      authentication: 30,
      authorization: 25,
      data_access: 20,
      user_action: 15,
      system_access: 35,
      compliance_event: 40,
      system_event: 10,
      error_event: 25,
    };

    baseScore = eventRiskMap[eventType] || 10;

    // Outcome adjustment
    if (outcome === 'failure') {
      baseScore += 20;
    }

    // Actor type adjustment
    if (actor.type === 'system' || actor.serviceAccount) {
      baseScore += 10;
    }

    // Admin role adjustment
    if (actor.role?.includes('admin')) {
      baseScore += 15;
    }

    return Math.min(100, baseScore);
  }

  private calculateDataAccessSeverity(
    resource: AuditResource,
    action: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (resource.sensitivity === 'restricted') {
      return 'critical';
    } else if (resource.sensitivity === 'confidential') {
      return 'high';
    } else if (action === 'export' || resource.sensitivity === 'internal') {
      return 'medium';
    }
    return 'low';
  }

  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'credential',
      'ssn', 'creditCard', 'bankAccount', 'privateKey'
    ];

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const sanitizedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          sanitizedObj[key] = '[REDACTED]';
        } else {
          sanitizedObj[key] = sanitizeObject(value);
        }
      }
      return sanitizedObj;
    };

    return sanitizeObject(sanitized);
  }

  private sanitizePaymentDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Specific payment field sanitization
    if (sanitized.cardNumber) {
      sanitized.cardNumber = sanitized.cardNumber.replace(/\d{12}/, '************');
    }
    
    if (sanitized.cvv) {
      sanitized.cvv = '[REDACTED]';
    }
    
    if (sanitized.bankAccount) {
      sanitized.bankAccount = '[REDACTED]';
    }

    return this.sanitizeDetails(sanitized);
  }

  private calculateReportSummary(events: AuditEvent[]): ComplianceReportSummary {
    const totalEvents = events.length;
    const eventsByType: Record<AuditEventType, number> = {} as any;
    const eventsBySeverity: Record<string, number> = {};
    let failures = 0;
    const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };

    events.forEach(event => {
      // Count by type
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Count failures
      if (event.outcome === 'failure') failures++;
      
      // Risk distribution
      const riskLevel = event.riskScore || 0;
      if (riskLevel >= 80) riskDistribution.critical++;
      else if (riskLevel >= 60) riskDistribution.high++;
      else if (riskLevel >= 30) riskDistribution.medium++;
      else riskDistribution.low++;
    });

    const failureRate = totalEvents > 0 ? failures / totalEvents : 0;
    const complianceScore = Math.max(0, 100 - (failureRate * 100) - (riskDistribution.critical * 5));

    return {
      totalEvents,
      eventsByType,
      eventsBySeverity,
      failureRate,
      riskDistribution,
      complianceScore,
    };
  }

  private detectComplianceViolations(
    events: AuditEvent[],
    reportType: string
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check for multiple failed authentication attempts
    const failedAuth = events.filter(e => 
      e.eventType === 'authentication' && 
      e.outcome === 'failure'
    );

    if (failedAuth.length > 5) {
      violations.push({
        id: `violation_auth_${Date.now()}`,
        type: 'excessive_failed_authentication',
        severity: 'high',
        description: `${failedAuth.length} failed authentication attempts detected`,
        events: failedAuth.slice(0, 10).map(e => e.id),
        riskLevel: 75,
        recommendation: 'Implement account lockout policies and monitor for brute force attacks',
        status: 'open',
      });
    }

    // Check for admin actions without proper authorization trails
    const adminActions = events.filter(e => 
      e.eventType === 'admin_action' && 
      !e.correlationId
    );

    if (adminActions.length > 0) {
      violations.push({
        id: `violation_admin_${Date.now()}`,
        type: 'untraced_admin_actions',
        severity: 'medium',
        description: `${adminActions.length} admin actions without correlation IDs`,
        events: adminActions.map(e => e.id),
        riskLevel: 60,
        recommendation: 'Ensure all admin actions have proper correlation tracking',
        status: 'open',
      });
    }

    return violations;
  }

  private generateRecommendations(violations: ComplianceViolation[]): string[] {
    const recommendations = violations.map(v => v.recommendation);
    
    // Add general recommendations
    recommendations.push(
      'Implement regular security training for all users',
      'Review and update access control policies quarterly',
      'Conduct regular security assessments and penetration testing',
      'Maintain comprehensive incident response procedures'
    );

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private startBatchProcessing(): void {
    this.flushTimer = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flush().catch(error => {
          console.error('[AuditLog] Batch flush failed:', error);
        });
      }
    }, this.flushInterval);
  }

  public stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Final flush
    if (this.eventBuffer.length > 0) {
      this.flush().catch(error => {
        console.error('[AuditLog] Final flush failed:', error);
      });
    }
  }
}

// Singleton instance for easy access
export let auditLogger: AuditLogger | null = null;

export const initializeAuditLogger = (
  storage: AuditStorage,
  metadata: AuditMetadata,
  options?: any
): AuditLogger => {
  auditLogger = new AuditLogger(storage, metadata, options);
  return auditLogger;
};

export const getAuditLogger = (): AuditLogger => {
  if (!auditLogger) {
    throw new Error('Audit logger not initialized. Call initializeAuditLogger first.');
  }
  return auditLogger;
};
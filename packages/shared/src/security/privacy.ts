/**
 * Data privacy and GDPR compliance framework for ProTour
 * Handles consent management, data subject rights, and privacy compliance
 */

export interface DataSubject {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  registrationDate: Date;
  lastActivity: Date;
  consentStatus: ConsentStatus;
  dataCategories: DataCategory[];
  jurisdiction: string;
  minorStatus?: boolean;
}

export interface ConsentStatus {
  marketing: ConsentRecord;
  analytics: ConsentRecord;
  essential: ConsentRecord;
  thirdParty: ConsentRecord;
  location: ConsentRecord;
  communications: ConsentRecord;
}

export interface ConsentRecord {
  granted: boolean;
  timestamp: Date;
  version: string;
  method: 'explicit' | 'implicit' | 'legitimate_interest';
  ipAddress: string;
  userAgent: string;
  withdrawnAt?: Date;
  withdrawalReason?: string;
}

export interface DataCategory {
  category: 'personal' | 'sensitive' | 'financial' | 'behavioral' | 'technical';
  purpose: DataProcessingPurpose;
  legalBasis: LegalBasis;
  retentionPeriod: number; // days
  location: string; // where data is stored
  thirdParties: string[]; // who has access
}

export type DataProcessingPurpose =
  | 'account_management'
  | 'service_provision'
  | 'payment_processing'
  | 'marketing'
  | 'analytics'
  | 'security'
  | 'legal_compliance'
  | 'customer_support';

export type LegalBasis =
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests';

export interface PrivacyRequest {
  id: string;
  subjectId: string;
  type:
    | 'access'
    | 'rectification'
    | 'erasure'
    | 'portability'
    | 'restriction'
    | 'objection';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired';
  requestDate: Date;
  deadline: Date;
  completedAt?: Date;
  description: string;
  attachments?: string[];
  response?: string;
  verificationMethod: string;
  processingNotes: string[];
}

export interface DataBreachIncident {
  id: string;
  detectedAt: Date;
  reportedAt?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'confidentiality' | 'integrity' | 'availability';
  affectedSubjects: number;
  dataCategories: DataCategory[];
  description: string;
  cause: string;
  containmentActions: string[];
  notificationRequired: boolean;
  authorityNotified: boolean;
  subjectsNotified: boolean;
  status: 'open' | 'contained' | 'resolved' | 'closed';
}

export interface PrivacyReport {
  id: string;
  period: { start: Date; end: Date };
  generatedAt: Date;
  consentStatistics: ConsentStatistics;
  requestStatistics: RequestStatistics;
  breachStatistics: BreachStatistics;
  complianceScore: number;
  recommendations: string[];
}

export interface ConsentStatistics {
  totalSubjects: number;
  consentRates: Record<keyof ConsentStatus, number>;
  withdrawalRates: Record<keyof ConsentStatus, number>;
  newConsents: number;
  expiredConsents: number;
}

export interface RequestStatistics {
  totalRequests: number;
  requestsByType: Record<string, number>;
  averageProcessingTime: number;
  completionRate: number;
  overduceRequests: number;
}

export interface BreachStatistics {
  totalBreaches: number;
  breachesBySeverity: Record<string, number>;
  averageResponseTime: number;
  affectedSubjectsTotal: number;
  notificationCompliance: number;
}

export class PrivacyManager {
  private subjects: Map<string, DataSubject> = new Map();
  private requests: Map<string, PrivacyRequest> = new Map();
  private breaches: Map<string, DataBreachIncident> = new Map();

  constructor(
    private config: {
      defaultRetentionDays: number;
      requestDeadlineDays: number;
      breachNotificationHours: number;
      consentExpiryDays: number;
    } = {
      defaultRetentionDays: 365,
      requestDeadlineDays: 30,
      breachNotificationHours: 72,
      consentExpiryDays: 365,
    }
  ) {}

  /**
   * Register new data subject
   */
  async registerDataSubject(
    id: string,
    data: {
      email: string;
      name?: string;
      phone?: string;
      jurisdiction: string;
      minorStatus?: boolean;
    },
    initialConsents: Partial<ConsentStatus> = {},
    context: {
      ipAddress: string;
      userAgent: string;
      method: 'registration' | 'import' | 'api';
    }
  ): Promise<DataSubject> {
    const now = new Date();
    const consentVersion = this.getCurrentConsentVersion();

    // Build default consent status
    const defaultConsent: ConsentRecord = {
      granted: false,
      timestamp: now,
      version: consentVersion,
      method: 'explicit',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    };

    const consentStatus: ConsentStatus = {
      essential: {
        ...defaultConsent,
        granted: true,
        method: 'legitimate_interest',
      },
      marketing: initialConsents.marketing || defaultConsent,
      analytics: initialConsents.analytics || defaultConsent,
      thirdParty: initialConsents.thirdParty || defaultConsent,
      location: initialConsents.location || defaultConsent,
      communications: initialConsents.communications || defaultConsent,
    };

    const subject: DataSubject = {
      id,
      ...data,
      registrationDate: now,
      lastActivity: now,
      consentStatus,
      dataCategories: this.getDefaultDataCategories(data.jurisdiction),
    };

    this.subjects.set(id, subject);

    // Log the registration
    console.log(
      `[Privacy] Registered data subject ${id} with consents:`,
      Object.entries(consentStatus)
        .filter(([_, record]) => record.granted)
        .map(([key]) => key)
    );

    return subject;
  }

  /**
   * Update consent for data subject
   */
  async updateConsent(
    subjectId: string,
    consentType: keyof ConsentStatus,
    granted: boolean,
    context: {
      ipAddress: string;
      userAgent: string;
      method?: 'explicit' | 'implicit';
    }
  ): Promise<void> {
    const subject = this.subjects.get(subjectId);
    if (!subject) {
      throw new Error(`Data subject not found: ${subjectId}`);
    }

    const previousConsent = subject.consentStatus[consentType];
    const consentRecord: ConsentRecord = {
      granted,
      timestamp: new Date(),
      version: this.getCurrentConsentVersion(),
      method: context.method || 'explicit',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    };

    // If withdrawing consent, record withdrawal
    if (!granted && previousConsent.granted) {
      consentRecord.withdrawnAt = new Date();
    }

    subject.consentStatus[consentType] = consentRecord;
    subject.lastActivity = new Date();

    // Handle consent withdrawal actions
    if (!granted && previousConsent.granted) {
      await this.handleConsentWithdrawal(subjectId, consentType);
    }

    console.log(
      `[Privacy] Updated ${consentType} consent for ${subjectId}: ${granted}`
    );
  }

  /**
   * Submit privacy request (GDPR Article 15-21)
   */
  async submitPrivacyRequest(
    subjectId: string,
    type: PrivacyRequest['type'],
    description: string,
    verificationData: {
      method: string;
      data: Record<string, any>;
    }
  ): Promise<PrivacyRequest> {
    const subject = this.subjects.get(subjectId);
    if (!subject) {
      throw new Error(`Data subject not found: ${subjectId}`);
    }

    const now = new Date();
    const deadline = new Date(
      now.getTime() + this.config.requestDeadlineDays * 24 * 60 * 60 * 1000
    );

    const request: PrivacyRequest = {
      id: this.generateId('req'),
      subjectId,
      type,
      status: 'pending',
      requestDate: now,
      deadline,
      description,
      verificationMethod: verificationData.method,
      processingNotes: [`Request submitted via ${verificationData.method}`],
    };

    this.requests.set(request.id, request);

    // Auto-process certain request types
    if (type === 'access') {
      setTimeout(() => this.processAccessRequest(request.id), 1000);
    }

    console.log(
      `[Privacy] Submitted ${type} request ${request.id} for subject ${subjectId}`
    );
    return request;
  }

  /**
   * Process data access request (GDPR Article 15)
   */
  async processAccessRequest(requestId: string): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request || request.type !== 'access') {
      throw new Error(`Invalid access request: ${requestId}`);
    }

    const subject = this.subjects.get(request.subjectId);
    if (!subject) {
      throw new Error(`Data subject not found: ${request.subjectId}`);
    }

    request.status = 'in_progress';
    request.processingNotes.push(
      `Started processing access request at ${new Date().toISOString()}`
    );

    // Collect all data for the subject
    const personalData = {
      profile: {
        id: subject.id,
        email: subject.email,
        name: subject.name,
        phone: subject.phone,
        registrationDate: subject.registrationDate,
        jurisdiction: subject.jurisdiction,
      },
      consents: subject.consentStatus,
      dataCategories: subject.dataCategories,
      // Additional data collection would happen here
      tournaments: await this.collectTournamentData(subject.id),
      payments: await this.collectPaymentData(subject.id),
      communications: await this.collectCommunicationData(subject.id),
    };

    const response = {
      subject: personalData,
      processingPurposes: this.getProcessingPurposes(subject),
      dataRecipients: this.getDataRecipients(subject),
      retentionPeriods: this.getRetentionPeriods(subject),
      rights: this.getDataSubjectRights(subject),
    };

    request.response = JSON.stringify(response, null, 2);
    request.status = 'completed';
    request.completedAt = new Date();
    request.processingNotes.push(
      `Completed access request at ${new Date().toISOString()}`
    );

    console.log(`[Privacy] Completed access request ${requestId}`);
  }

  /**
   * Process data erasure request (GDPR Article 17)
   */
  async processErasureRequest(
    requestId: string,
    reason: string
  ): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request || request.type !== 'erasure') {
      throw new Error(`Invalid erasure request: ${requestId}`);
    }

    const subject = this.subjects.get(request.subjectId);
    if (!subject) {
      throw new Error(`Data subject not found: ${request.subjectId}`);
    }

    request.status = 'in_progress';
    request.processingNotes.push(`Started erasure process: ${reason}`);

    // Check if erasure is legally required
    const canErase = this.canEraseData(subject, reason);
    if (!canErase.allowed) {
      request.status = 'rejected';
      request.response = `Erasure rejected: ${canErase.reason}`;
      return;
    }

    // Perform data erasure
    await this.eraseSubjectData(request.subjectId);

    request.status = 'completed';
    request.completedAt = new Date();
    request.response = `Data successfully erased for reason: ${reason}`;

    console.log(`[Privacy] Completed erasure request ${requestId}`);
  }

  /**
   * Report data breach
   */
  async reportDataBreach(
    description: string,
    type: DataBreachIncident['type'],
    severity: DataBreachIncident['severity'],
    affectedSubjectIds: string[],
    dataCategories: DataCategory[],
    cause: string
  ): Promise<DataBreachIncident> {
    const now = new Date();

    const breach: DataBreachIncident = {
      id: this.generateId('breach'),
      detectedAt: now,
      severity,
      type,
      affectedSubjects: affectedSubjectIds.length,
      dataCategories,
      description,
      cause,
      containmentActions: [],
      notificationRequired: this.isNotificationRequired(
        severity,
        affectedSubjectIds.length
      ),
      authorityNotified: false,
      subjectsNotified: false,
      status: 'open',
    };

    this.breaches.set(breach.id, breach);

    // Auto-notify if required
    if (breach.notificationRequired) {
      setTimeout(() => this.notifyDataBreach(breach.id), 1000);
    }

    console.log(
      `[Privacy] Reported ${severity} data breach ${breach.id} affecting ${affectedSubjectIds.length} subjects`
    );
    return breach;
  }

  /**
   * Generate privacy report
   */
  async generatePrivacyReport(period: {
    start: Date;
    end: Date;
  }): Promise<PrivacyReport> {
    const subjects = Array.from(this.subjects.values()).filter(
      s =>
        s.registrationDate >= period.start && s.registrationDate <= period.end
    );

    const requests = Array.from(this.requests.values()).filter(
      r => r.requestDate >= period.start && r.requestDate <= period.end
    );

    const breaches = Array.from(this.breaches.values()).filter(
      b => b.detectedAt >= period.start && b.detectedAt <= period.end
    );

    const consentStatistics = this.calculateConsentStatistics(subjects);
    const requestStatistics = this.calculateRequestStatistics(requests);
    const breachStatistics = this.calculateBreachStatistics(breaches);

    const complianceScore = this.calculateComplianceScore(
      consentStatistics,
      requestStatistics,
      breachStatistics
    );

    return {
      id: this.generateId('report'),
      period,
      generatedAt: new Date(),
      consentStatistics,
      requestStatistics,
      breachStatistics,
      complianceScore,
      recommendations: this.generateComplianceRecommendations(
        consentStatistics,
        requestStatistics,
        breachStatistics
      ),
    };
  }

  /**
   * Check if subject has valid consent for purpose
   */
  hasValidConsent(subjectId: string, purpose: DataProcessingPurpose): boolean {
    const subject = this.subjects.get(subjectId);
    if (!subject) return false;

    const purposeConsentMap: Record<
      DataProcessingPurpose,
      keyof ConsentStatus
    > = {
      account_management: 'essential',
      service_provision: 'essential',
      payment_processing: 'essential',
      marketing: 'marketing',
      analytics: 'analytics',
      security: 'essential',
      legal_compliance: 'essential',
      customer_support: 'communications',
    };

    const consentType = purposeConsentMap[purpose];
    const consent = subject.consentStatus[consentType];

    return consent.granted && !this.isConsentExpired(consent);
  }

  private getCurrentConsentVersion(): string {
    return '2024.1'; // Version of consent terms
  }

  private getDefaultDataCategories(jurisdiction: string): DataCategory[] {
    const retentionPeriod =
      jurisdiction === 'EU' ? 1095 : this.config.defaultRetentionDays; // 3 years for EU

    return [
      {
        category: 'personal',
        purpose: 'account_management',
        legalBasis: 'contract',
        retentionPeriod,
        location: 'EU',
        thirdParties: [],
      },
      {
        category: 'technical',
        purpose: 'service_provision',
        legalBasis: 'legitimate_interests',
        retentionPeriod: 365,
        location: 'EU',
        thirdParties: ['analytics_provider'],
      },
    ];
  }

  private async handleConsentWithdrawal(
    subjectId: string,
    consentType: keyof ConsentStatus
  ): Promise<void> {
    console.log(
      `[Privacy] Handling consent withdrawal for ${subjectId}: ${consentType}`
    );

    // Implement specific actions based on consent type
    switch (consentType) {
      case 'marketing':
        await this.removeFromMarketingLists(subjectId);
        break;
      case 'analytics':
        await this.stopAnalyticsTracking(subjectId);
        break;
      case 'thirdParty':
        await this.removeThirdPartyDataSharing(subjectId);
        break;
      case 'location':
        await this.stopLocationTracking(subjectId);
        break;
    }
  }

  private async collectTournamentData(subjectId: string): Promise<any> {
    // Mock tournament data collection
    return {
      participated: [],
      organized: [],
      preferences: {},
    };
  }

  private async collectPaymentData(subjectId: string): Promise<any> {
    // Mock payment data collection (sanitized)
    return {
      transactions: [],
      paymentMethods: [],
      // Sensitive payment data would be encrypted/redacted
    };
  }

  private async collectCommunicationData(subjectId: string): Promise<any> {
    // Mock communication data collection
    return {
      emails: [],
      notifications: [],
      supportTickets: [],
    };
  }

  private getProcessingPurposes(subject: DataSubject): string[] {
    return subject.dataCategories.map(cat => cat.purpose);
  }

  private getDataRecipients(subject: DataSubject): string[] {
    return [
      ...new Set(subject.dataCategories.flatMap(cat => cat.thirdParties)),
    ];
  }

  private getRetentionPeriods(subject: DataSubject): Record<string, number> {
    const periods: Record<string, number> = {};
    subject.dataCategories.forEach(cat => {
      periods[cat.category] = cat.retentionPeriod;
    });
    return periods;
  }

  private getDataSubjectRights(subject: DataSubject): string[] {
    const baseRights = ['access', 'rectification', 'portability'];

    if (subject.jurisdiction === 'EU') {
      baseRights.push('erasure', 'restriction', 'objection');
    }

    return baseRights;
  }

  private canEraseData(
    subject: DataSubject,
    reason: string
  ): { allowed: boolean; reason?: string } {
    // Check legal obligations
    const hasLegalObligation = subject.dataCategories.some(
      cat => cat.legalBasis === 'legal_obligation'
    );

    if (hasLegalObligation) {
      return {
        allowed: false,
        reason: 'Data required for legal compliance cannot be erased',
      };
    }

    // Check ongoing contracts
    // In a real implementation, check if user has active tournaments, pending payments, etc.

    return { allowed: true };
  }

  private async eraseSubjectData(subjectId: string): Promise<void> {
    // In real implementation, this would:
    // 1. Remove/anonymize data in all systems
    // 2. Update third-party systems
    // 3. Create audit trail
    // 4. Verify complete erasure

    console.log(`[Privacy] Erasing all data for subject ${subjectId}`);
    this.subjects.delete(subjectId);
  }

  private isNotificationRequired(
    severity: string,
    affectedCount: number
  ): boolean {
    // EU GDPR: Must notify if high risk to rights and freedoms
    return (
      severity === 'high' || severity === 'critical' || affectedCount > 100
    );
  }

  private async notifyDataBreach(breachId: string): Promise<void> {
    const breach = this.breaches.get(breachId);
    if (!breach) return;

    // In real implementation:
    // 1. Notify supervisory authority within 72 hours
    // 2. Notify affected data subjects if high risk
    // 3. Create detailed breach report

    breach.reportedAt = new Date();
    breach.authorityNotified = true;
    breach.subjectsNotified = breach.severity === 'critical';

    console.log(`[Privacy] Notified authorities of data breach ${breachId}`);
  }

  private isConsentExpired(consent: ConsentRecord): boolean {
    const expiryDate = new Date(
      consent.timestamp.getTime() +
        this.config.consentExpiryDays * 24 * 60 * 60 * 1000
    );
    return new Date() > expiryDate;
  }

  // Mock implementations for consent withdrawal actions
  private async removeFromMarketingLists(subjectId: string): Promise<void> {
    console.log(`[Privacy] Removed ${subjectId} from marketing lists`);
  }

  private async stopAnalyticsTracking(subjectId: string): Promise<void> {
    console.log(`[Privacy] Stopped analytics tracking for ${subjectId}`);
  }

  private async removeThirdPartyDataSharing(subjectId: string): Promise<void> {
    console.log(`[Privacy] Removed third-party data sharing for ${subjectId}`);
  }

  private async stopLocationTracking(subjectId: string): Promise<void> {
    console.log(`[Privacy] Stopped location tracking for ${subjectId}`);
  }

  private calculateConsentStatistics(
    subjects: DataSubject[]
  ): ConsentStatistics {
    const stats: ConsentStatistics = {
      totalSubjects: subjects.length,
      consentRates: {} as any,
      withdrawalRates: {} as any,
      newConsents: 0,
      expiredConsents: 0,
    };

    // Calculate consent rates for each type
    (
      [
        'marketing',
        'analytics',
        'thirdParty',
        'location',
        'communications',
      ] as const
    ).forEach(type => {
      const granted = subjects.filter(
        s => s.consentStatus[type].granted
      ).length;
      const withdrawn = subjects.filter(
        s => s.consentStatus[type].withdrawnAt
      ).length;

      stats.consentRates[type] =
        subjects.length > 0 ? granted / subjects.length : 0;
      stats.withdrawalRates[type] =
        subjects.length > 0 ? withdrawn / subjects.length : 0;
    });

    return stats;
  }

  private calculateRequestStatistics(
    requests: PrivacyRequest[]
  ): RequestStatistics {
    const completedRequests = requests.filter(r => r.status === 'completed');
    const averageProcessingTime =
      completedRequests.length > 0
        ? completedRequests.reduce((sum, r) => {
            const processingTime =
              r.completedAt!.getTime() - r.requestDate.getTime();
            return sum + processingTime;
          }, 0) / completedRequests.length
        : 0;

    const requestsByType = requests.reduce(
      (acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalRequests: requests.length,
      requestsByType,
      averageProcessingTime: averageProcessingTime / (1000 * 60 * 60), // Convert to hours
      completionRate:
        requests.length > 0 ? completedRequests.length / requests.length : 0,
      overduceRequests: requests.filter(
        r => r.deadline < new Date() && r.status !== 'completed'
      ).length,
    };
  }

  private calculateBreachStatistics(
    breaches: DataBreachIncident[]
  ): BreachStatistics {
    const breachesBySeverity = breaches.reduce(
      (acc, b) => {
        acc[b.severity] = (acc[b.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const reportedBreaches = breaches.filter(b => b.reportedAt);
    const averageResponseTime =
      reportedBreaches.length > 0
        ? reportedBreaches.reduce((sum, b) => {
            const responseTime =
              b.reportedAt!.getTime() - b.detectedAt.getTime();
            return sum + responseTime;
          }, 0) / reportedBreaches.length
        : 0;

    const affectedSubjectsTotal = breaches.reduce(
      (sum, b) => sum + b.affectedSubjects,
      0
    );
    const notifiedBreaches = breaches.filter(
      b => b.authorityNotified && b.notificationRequired
    );
    const notificationCompliance =
      breaches.filter(b => b.notificationRequired).length > 0
        ? notifiedBreaches.length /
          breaches.filter(b => b.notificationRequired).length
        : 1;

    return {
      totalBreaches: breaches.length,
      breachesBySeverity,
      averageResponseTime: averageResponseTime / (1000 * 60 * 60), // Convert to hours
      affectedSubjectsTotal,
      notificationCompliance,
    };
  }

  private calculateComplianceScore(
    consent: ConsentStatistics,
    requests: RequestStatistics,
    breaches: BreachStatistics
  ): number {
    let score = 100;

    // Deduct for poor consent management
    const avgConsentRate =
      Object.values(consent.consentRates).reduce((a, b) => a + b, 0) /
      Object.keys(consent.consentRates).length;
    if (avgConsentRate < 0.3) score -= 20;

    // Deduct for poor request handling
    if (requests.completionRate < 0.9) score -= 15;
    if (requests.overduceRequests > 0) score -= 10;

    // Deduct for breaches
    score -= breaches.totalBreaches * 5;
    if (breaches.notificationCompliance < 1) score -= 20;

    return Math.max(0, score);
  }

  private generateComplianceRecommendations(
    consent: ConsentStatistics,
    requests: RequestStatistics,
    breaches: BreachStatistics
  ): string[] {
    const recommendations: string[] = [];

    if (Object.values(consent.consentRates).some(rate => rate < 0.5)) {
      recommendations.push('Improve consent collection and user experience');
    }

    if (requests.overduceRequests > 0) {
      recommendations.push(
        'Implement automated request processing to meet deadlines'
      );
    }

    if (breaches.totalBreaches > 0) {
      recommendations.push(
        'Strengthen security measures to prevent data breaches'
      );
    }

    if (breaches.notificationCompliance < 1) {
      recommendations.push(
        'Improve breach notification procedures and timelines'
      );
    }

    recommendations.push('Conduct regular privacy training for all staff');
    recommendations.push('Implement privacy by design in all new features');
    recommendations.push('Regular privacy impact assessments');

    return recommendations;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const privacyManager = new PrivacyManager();

// Cookie consent utilities
export const CookieConsent = {
  getConsentBanner: () => ({
    essential: 'Required for basic site functionality',
    analytics: 'Help us understand how visitors use our site',
    marketing: 'Used to show relevant ads and marketing content',
    thirdParty: 'Allow third-party integrations and social media',
  }),

  getConsentScript: () => `
    window.privacyConsent = {
      granted: function(types) {
        types.forEach(type => {
          localStorage.setItem('consent_' + type, JSON.stringify({
            granted: true,
            timestamp: new Date().toISOString(),
            version: '2024.1'
          }));
        });
        this.fireConsentEvents(types, true);
      },
      
      withdrawn: function(types) {
        types.forEach(type => {
          localStorage.setItem('consent_' + type, JSON.stringify({
            granted: false,
            timestamp: new Date().toISOString(),
            withdrawnAt: new Date().toISOString()
          }));
        });
        this.fireConsentEvents(types, false);
      },
      
      fireConsentEvents: function(types, granted) {
        window.dispatchEvent(new CustomEvent('consentChanged', {
          detail: { types, granted }
        }));
      }
    };
  `,
};

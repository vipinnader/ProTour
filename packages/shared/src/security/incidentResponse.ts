import { EventEmitter } from 'events';
import crypto from 'crypto';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'detected' | 'analyzing' | 'containing' | 'investigating' | 'resolving' | 'closed';
export type IncidentCategory = 
  | 'data_breach'
  | 'malware'
  | 'phishing'
  | 'ddos'
  | 'unauthorized_access'
  | 'insider_threat'
  | 'system_compromise'
  | 'data_loss'
  | 'service_disruption'
  | 'compliance_violation'
  | 'privacy_breach';

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  priority: number;
  detectedAt: Date;
  reportedAt?: Date;
  assignedTo?: string;
  source: {
    detector: string;
    confidence: number;
    automated: boolean;
  };
  affected: {
    systems: string[];
    users: string[];
    data: string[];
    locations: string[];
  };
  timeline: IncidentEvent[];
  indicators: {
    ips: string[];
    domains: string[];
    urls: string[];
    hashes: string[];
    emails: string[];
    userAccounts: string[];
  };
  evidence: {
    logs: string[];
    screenshots: string[];
    files: string[];
    forensics: string[];
  };
  response: {
    actions: ResponseAction[];
    containment: ContainmentAction[];
    eradication: EradicationAction[];
    recovery: RecoveryAction[];
  };
  impact: {
    dataCompromised: boolean;
    serviceDisrupted: boolean;
    financialLoss?: number;
    reputationalDamage: boolean;
    complianceImpact: boolean;
    affectedCustomers: number;
  };
  communication: {
    internal: CommunicationRecord[];
    external: CommunicationRecord[];
    regulatory: CommunicationRecord[];
  };
  lessons: {
    rootCause: string;
    improvements: string[];
    preventiveMeasures: string[];
  };
  metadata: {
    tags: string[];
    customFields: Record<string, any>;
  };
  createdBy: string;
  lastUpdatedAt: Date;
  closedAt?: Date;
}

export interface IncidentEvent {
  id: string;
  timestamp: Date;
  type: 'detection' | 'escalation' | 'action' | 'update' | 'resolution';
  description: string;
  actor: string;
  automated: boolean;
  metadata?: Record<string, any>;
}

export interface ResponseAction {
  id: string;
  type: 'immediate' | 'containment' | 'investigation' | 'recovery';
  title: string;
  description: string;
  assignedTo: string;
  deadline: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  dependencies: string[];
  result?: string;
  completedAt?: Date;
}

export interface ContainmentAction {
  id: string;
  action: 'isolate_system' | 'block_ip' | 'disable_account' | 'quarantine_file' | 'network_segmentation';
  target: string;
  implementedAt?: Date;
  effectiveUntil?: Date;
  reversible: boolean;
  result?: 'success' | 'failed' | 'partial';
}

export interface EradicationAction {
  id: string;
  action: 'remove_malware' | 'patch_vulnerability' | 'update_credentials' | 'fix_configuration';
  target: string;
  implementedAt?: Date;
  verified: boolean;
  verificationMethod?: string;
}

export interface RecoveryAction {
  id: string;
  action: 'restore_system' | 'restore_data' | 'resume_service' | 'renable_account';
  target: string;
  implementedAt?: Date;
  testResults?: string[];
  monitoringPeriod: number; // days
}

export interface CommunicationRecord {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'report' | 'notification';
  recipient: string;
  channel: string;
  timestamp: Date;
  subject: string;
  summary: string;
  attachments?: string[];
}

export interface IncidentTemplate {
  category: IncidentCategory;
  defaultSeverity: IncidentSeverity;
  responsePlaybook: string[];
  requiredActions: Partial<ResponseAction>[];
  escalationRules: EscalationRule[];
  communicationPlan: CommunicationPlan;
}

export interface EscalationRule {
  condition: string;
  severity: IncidentSeverity;
  timeThreshold?: number; // minutes
  stakeholders: string[];
  actions: string[];
}

export interface CommunicationPlan {
  internal: {
    immediate: string[];
    hourly: string[];
    daily: string[];
  };
  external: {
    customers: { threshold: IncidentSeverity; template: string };
    partners: { threshold: IncidentSeverity; template: string };
    media: { threshold: IncidentSeverity; template: string };
  };
  regulatory: {
    threshold: IncidentSeverity;
    timeframe: number; // hours
    contacts: string[];
  };
}

export class IncidentResponseManager extends EventEmitter {
  private incidents = new Map<string, SecurityIncident>();
  private templates = new Map<IncidentCategory, IncidentTemplate>();
  private stakeholders = new Map<string, { email: string; role: string; phone?: string }>();
  private escalationRules: EscalationRule[] = [];

  constructor() {
    super();
    this.initializeTemplates();
    this.initializeStakeholders();
    this.startMonitoringProcess();
  }

  private initializeTemplates(): void {
    const templates: Array<[IncidentCategory, IncidentTemplate]> = [
      ['data_breach', {
        category: 'data_breach',
        defaultSeverity: 'high',
        responsePlaybook: [
          'Immediately isolate affected systems',
          'Preserve evidence and logs',
          'Identify scope of data exposure',
          'Notify legal and compliance teams',
          'Prepare customer communications',
          'Contact law enforcement if required',
          'Document all actions taken',
        ],
        requiredActions: [
          { type: 'immediate', title: 'Isolate affected systems', priority: 1 },
          { type: 'containment', title: 'Preserve evidence', priority: 2 },
          { type: 'investigation', title: 'Assess data exposure', priority: 3 },
        ],
        escalationRules: [
          {
            condition: 'severity >= high',
            severity: 'high',
            stakeholders: ['ciso', 'legal', 'ceo'],
            actions: ['immediate_notification', 'legal_review'],
          },
        ],
        communicationPlan: {
          internal: {
            immediate: ['security_team', 'legal_team', 'ciso'],
            hourly: ['exec_team'],
            daily: ['board'],
          },
          external: {
            customers: { threshold: 'medium', template: 'data_breach_notification' },
            partners: { threshold: 'high', template: 'partner_notification' },
            media: { threshold: 'critical', template: 'press_release' },
          },
          regulatory: {
            threshold: 'medium',
            timeframe: 72, // GDPR requirement
            contacts: ['data_protection_authority'],
          },
        },
      }],

      ['malware', {
        category: 'malware',
        defaultSeverity: 'medium',
        responsePlaybook: [
          'Isolate infected systems',
          'Identify malware variant',
          'Check for lateral movement',
          'Remove malware from affected systems',
          'Update security controls',
          'Monitor for reinfection',
        ],
        requiredActions: [
          { type: 'immediate', title: 'Isolate infected systems', priority: 1 },
          { type: 'investigation', title: 'Analyze malware', priority: 2 },
          { type: 'containment', title: 'Prevent spread', priority: 3 },
        ],
        escalationRules: [
          {
            condition: 'lateral_movement_detected',
            severity: 'high',
            stakeholders: ['security_team', 'it_team'],
            actions: ['network_isolation', 'forensic_analysis'],
          },
        ],
        communicationPlan: {
          internal: {
            immediate: ['security_team', 'it_team'],
            hourly: ['ciso'],
            daily: ['exec_team'],
          },
          external: {
            customers: { threshold: 'high', template: 'service_disruption' },
            partners: { threshold: 'critical', template: 'security_incident' },
            media: { threshold: 'critical', template: 'security_statement' },
          },
          regulatory: {
            threshold: 'high',
            timeframe: 24,
            contacts: ['cybersecurity_authority'],
          },
        },
      }],

      ['ddos', {
        category: 'ddos',
        defaultSeverity: 'medium',
        responsePlaybook: [
          'Activate DDoS mitigation',
          'Scale infrastructure if needed',
          'Block malicious traffic',
          'Monitor service availability',
          'Communicate with customers',
          'Document attack patterns',
        ],
        requiredActions: [
          { type: 'immediate', title: 'Activate DDoS protection', priority: 1 },
          { type: 'containment', title: 'Block attack traffic', priority: 2 },
          { type: 'recovery', title: 'Restore full service', priority: 3 },
        ],
        escalationRules: [
          {
            condition: 'service_unavailable > 30min',
            severity: 'high',
            timeThreshold: 30,
            stakeholders: ['cto', 'customer_success'],
            actions: ['customer_notification', 'media_statement'],
          },
        ],
        communicationPlan: {
          internal: {
            immediate: ['ops_team', 'security_team'],
            hourly: ['cto'],
            daily: ['exec_team'],
          },
          external: {
            customers: { threshold: 'medium', template: 'service_status' },
            partners: { threshold: 'high', template: 'service_impact' },
            media: { threshold: 'high', template: 'service_statement' },
          },
          regulatory: {
            threshold: 'critical',
            timeframe: 24,
            contacts: [],
          },
        },
      }],
    ];

    templates.forEach(([category, template]) => {
      this.templates.set(category, template);
    });
  }

  private initializeStakeholders(): void {
    const stakeholders = [
      { id: 'ciso', email: 'ciso@protour.app', role: 'Chief Information Security Officer' },
      { id: 'cto', email: 'cto@protour.app', role: 'Chief Technology Officer' },
      { id: 'ceo', email: 'ceo@protour.app', role: 'Chief Executive Officer' },
      { id: 'legal', email: 'legal@protour.app', role: 'Legal Counsel' },
      { id: 'security_team', email: 'security-team@protour.app', role: 'Security Team' },
      { id: 'it_team', email: 'it-team@protour.app', role: 'IT Operations Team' },
      { id: 'ops_team', email: 'ops-team@protour.app', role: 'Operations Team' },
      { id: 'customer_success', email: 'support@protour.app', role: 'Customer Success Team' },
    ];

    stakeholders.forEach(stakeholder => {
      this.stakeholders.set(stakeholder.id, {
        email: stakeholder.email,
        role: stakeholder.role,
      });
    });
  }

  createIncident(data: {
    title: string;
    description: string;
    category: IncidentCategory;
    severity?: IncidentSeverity;
    source: SecurityIncident['source'];
    indicators?: Partial<SecurityIncident['indicators']>;
    affected?: Partial<SecurityIncident['affected']>;
    createdBy: string;
  }): SecurityIncident {
    const template = this.templates.get(data.category);
    const incidentId = crypto.randomUUID();
    const now = new Date();

    const incident: SecurityIncident = {
      id: incidentId,
      title: data.title,
      description: data.description,
      category: data.category,
      severity: data.severity || template?.defaultSeverity || 'medium',
      status: 'detected',
      priority: this.calculatePriority(data.severity || template?.defaultSeverity || 'medium'),
      detectedAt: now,
      source: data.source,
      affected: {
        systems: data.affected?.systems || [],
        users: data.affected?.users || [],
        data: data.affected?.data || [],
        locations: data.affected?.locations || [],
      },
      timeline: [{
        id: crypto.randomUUID(),
        timestamp: now,
        type: 'detection',
        description: `Incident detected: ${data.title}`,
        actor: data.createdBy,
        automated: data.source.automated,
      }],
      indicators: {
        ips: data.indicators?.ips || [],
        domains: data.indicators?.domains || [],
        urls: data.indicators?.urls || [],
        hashes: data.indicators?.hashes || [],
        emails: data.indicators?.emails || [],
        userAccounts: data.indicators?.userAccounts || [],
      },
      evidence: {
        logs: [],
        screenshots: [],
        files: [],
        forensics: [],
      },
      response: {
        actions: [],
        containment: [],
        eradication: [],
        recovery: [],
      },
      impact: {
        dataCompromised: false,
        serviceDisrupted: false,
        reputationalDamage: false,
        complianceImpact: false,
        affectedCustomers: 0,
      },
      communication: {
        internal: [],
        external: [],
        regulatory: [],
      },
      lessons: {
        rootCause: '',
        improvements: [],
        preventiveMeasures: [],
      },
      metadata: {
        tags: [],
        customFields: {},
      },
      createdBy: data.createdBy,
      lastUpdatedAt: now,
    };

    // Create initial response actions from template
    if (template) {
      incident.response.actions = template.requiredActions.map((action, index) => ({
        id: crypto.randomUUID(),
        type: action.type || 'investigation',
        title: action.title || '',
        description: action.description || '',
        assignedTo: '',
        deadline: new Date(now.getTime() + (action.priority || index + 1) * 60 * 60 * 1000), // Hours based on priority
        status: 'pending',
        priority: action.priority || index + 1,
        dependencies: action.dependencies || [],
      }));
    }

    this.incidents.set(incidentId, incident);
    this.emit('incidentCreated', incident);

    // Check for automatic escalation
    this.checkEscalation(incident);

    return incident;
  }

  updateIncident(incidentId: string, updates: Partial<SecurityIncident>): SecurityIncident | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return null;
    }

    const oldStatus = incident.status;
    const oldSeverity = incident.severity;

    // Apply updates
    Object.assign(incident, updates);
    incident.lastUpdatedAt = new Date();

    // Add timeline event for significant changes
    if (updates.status && updates.status !== oldStatus) {
      this.addTimelineEvent(incident, {
        type: 'update',
        description: `Status changed from ${oldStatus} to ${updates.status}`,
        actor: 'system',
        automated: false,
      });
    }

    if (updates.severity && updates.severity !== oldSeverity) {
      this.addTimelineEvent(incident, {
        type: 'escalation',
        description: `Severity changed from ${oldSeverity} to ${updates.severity}`,
        actor: 'system',
        automated: false,
      });
      
      // Recalculate priority and check escalation
      incident.priority = this.calculatePriority(updates.severity);
      this.checkEscalation(incident);
    }

    this.incidents.set(incidentId, incident);
    this.emit('incidentUpdated', incident);

    return incident;
  }

  addTimelineEvent(
    incident: SecurityIncident,
    event: Omit<IncidentEvent, 'id' | 'timestamp'>
  ): void {
    const timelineEvent: IncidentEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    incident.timeline.push(timelineEvent);
    incident.lastUpdatedAt = new Date();
    
    this.incidents.set(incident.id, incident);
    this.emit('timelineUpdated', { incident, event: timelineEvent });
  }

  addResponseAction(
    incidentId: string,
    action: Omit<ResponseAction, 'id'>
  ): ResponseAction | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return null;
    }

    const responseAction: ResponseAction = {
      id: crypto.randomUUID(),
      ...action,
    };

    incident.response.actions.push(responseAction);
    incident.lastUpdatedAt = new Date();

    this.addTimelineEvent(incident, {
      type: 'action',
      description: `Response action added: ${action.title}`,
      actor: 'system',
      automated: false,
    });

    this.incidents.set(incidentId, incident);
    this.emit('actionAdded', { incident, action: responseAction });

    return responseAction;
  }

  completeAction(incidentId: string, actionId: string, result: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return false;
    }

    const action = incident.response.actions.find(a => a.id === actionId);
    if (!action) {
      return false;
    }

    action.status = 'completed';
    action.result = result;
    action.completedAt = new Date();
    incident.lastUpdatedAt = new Date();

    this.addTimelineEvent(incident, {
      type: 'action',
      description: `Action completed: ${action.title}`,
      actor: action.assignedTo,
      automated: false,
      metadata: { result },
    });

    this.incidents.set(incidentId, incident);
    this.emit('actionCompleted', { incident, action });

    return true;
  }

  closeIncident(
    incidentId: string,
    resolution: {
      rootCause: string;
      improvements: string[];
      preventiveMeasures: string[];
      summary: string;
    }
  ): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return false;
    }

    incident.status = 'closed';
    incident.closedAt = new Date();
    incident.lastUpdatedAt = new Date();
    incident.lessons = {
      rootCause: resolution.rootCause,
      improvements: resolution.improvements,
      preventiveMeasures: resolution.preventiveMeasures,
    };

    this.addTimelineEvent(incident, {
      type: 'resolution',
      description: `Incident closed: ${resolution.summary}`,
      actor: 'system',
      automated: false,
      metadata: resolution,
    });

    this.incidents.set(incidentId, incident);
    this.emit('incidentClosed', incident);

    return true;
  }

  private calculatePriority(severity: IncidentSeverity): number {
    const priorityMap: Record<IncidentSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return priorityMap[severity];
  }

  private checkEscalation(incident: SecurityIncident): void {
    const template = this.templates.get(incident.category);
    if (!template) return;

    for (const rule of template.escalationRules) {
      if (this.shouldEscalate(incident, rule)) {
        this.escalateIncident(incident, rule);
      }
    }
  }

  private shouldEscalate(incident: SecurityIncident, rule: EscalationRule): boolean {
    // Simple condition parsing (in production, use a proper rule engine)
    if (rule.condition.includes('severity >= high')) {
      return ['high', 'critical'].includes(incident.severity);
    }
    
    if (rule.condition.includes('service_unavailable') && rule.timeThreshold) {
      const now = new Date();
      const timeSinceDetection = now.getTime() - incident.detectedAt.getTime();
      return timeSinceDetection > rule.timeThreshold * 60 * 1000;
    }

    return false;
  }

  private escalateIncident(incident: SecurityIncident, rule: EscalationRule): void {
    this.addTimelineEvent(incident, {
      type: 'escalation',
      description: `Incident escalated: ${rule.condition}`,
      actor: 'system',
      automated: true,
      metadata: { rule: rule.condition, stakeholders: rule.stakeholders },
    });

    // Send notifications to stakeholders
    for (const stakeholderId of rule.stakeholders) {
      this.notifyStakeholder(incident, stakeholderId, 'escalation');
    }

    this.emit('incidentEscalated', { incident, rule });
  }

  private notifyStakeholder(incident: SecurityIncident, stakeholderId: string, type: string): void {
    const stakeholder = this.stakeholders.get(stakeholderId);
    if (!stakeholder) return;

    const notification: CommunicationRecord = {
      id: crypto.randomUUID(),
      type: 'notification',
      recipient: stakeholder.email,
      channel: 'email',
      timestamp: new Date(),
      subject: `Security Incident ${type}: ${incident.title}`,
      summary: `${incident.category} incident detected with ${incident.severity} severity`,
    };

    incident.communication.internal.push(notification);
    this.emit('stakeholderNotified', { incident, stakeholder: stakeholderId, notification });
  }

  getIncident(incidentId: string): SecurityIncident | null {
    return this.incidents.get(incidentId) || null;
  }

  getIncidents(filter?: {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    category?: IncidentCategory;
    assignedTo?: string;
    since?: Date;
  }): SecurityIncident[] {
    let incidents = Array.from(this.incidents.values());

    if (filter) {
      if (filter.status) {
        incidents = incidents.filter(i => i.status === filter.status);
      }
      if (filter.severity) {
        incidents = incidents.filter(i => i.severity === filter.severity);
      }
      if (filter.category) {
        incidents = incidents.filter(i => i.category === filter.category);
      }
      if (filter.assignedTo) {
        incidents = incidents.filter(i => 
          i.response.actions.some(a => a.assignedTo === filter.assignedTo)
        );
      }
      if (filter.since) {
        incidents = incidents.filter(i => i.detectedAt >= filter.since!);
      }
    }

    return incidents.sort((a, b) => b.priority - a.priority || b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  private startMonitoringProcess(): void {
    // Check for overdue actions every 5 minutes
    setInterval(() => {
      this.checkOverdueActions();
    }, 5 * 60 * 1000);
  }

  private checkOverdueActions(): void {
    const now = new Date();

    for (const incident of this.incidents.values()) {
      if (incident.status === 'closed') continue;

      for (const action of incident.response.actions) {
        if (action.status !== 'completed' && action.deadline < now) {
          this.addTimelineEvent(incident, {
            type: 'update',
            description: `Action overdue: ${action.title}`,
            actor: 'system',
            automated: true,
            metadata: { actionId: action.id, deadline: action.deadline },
          });

          this.emit('actionOverdue', { incident, action });
        }
      }
    }
  }

  generateReport(period?: { start: Date; end: Date }): {
    totalIncidents: number;
    incidentsByCategory: Record<IncidentCategory, number>;
    incidentsBySeverity: Record<IncidentSeverity, number>;
    averageResolutionTime: number;
    openIncidents: number;
    escalatedIncidents: number;
  } {
    let incidents = Array.from(this.incidents.values());

    if (period) {
      incidents = incidents.filter(i => 
        i.detectedAt >= period.start && i.detectedAt <= period.end
      );
    }

    const incidentsByCategory: Record<IncidentCategory, number> = {} as any;
    const incidentsBySeverity: Record<IncidentSeverity, number> = {} as any;

    incidents.forEach(incident => {
      incidentsByCategory[incident.category] = (incidentsByCategory[incident.category] || 0) + 1;
      incidentsBySeverity[incident.severity] = (incidentsBySeverity[incident.severity] || 0) + 1;
    });

    const closedIncidents = incidents.filter(i => i.status === 'closed' && i.closedAt);
    const averageResolutionTime = closedIncidents.length > 0
      ? closedIncidents.reduce((sum, incident) => {
          const resolutionTime = incident.closedAt!.getTime() - incident.detectedAt.getTime();
          return sum + resolutionTime;
        }, 0) / closedIncidents.length
      : 0;

    const escalatedIncidents = incidents.filter(i => 
      i.timeline.some(event => event.type === 'escalation')
    ).length;

    return {
      totalIncidents: incidents.length,
      incidentsByCategory,
      incidentsBySeverity,
      averageResolutionTime,
      openIncidents: incidents.filter(i => i.status !== 'closed').length,
      escalatedIncidents,
    };
  }
}

export default IncidentResponseManager;
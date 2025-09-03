// Production Monitoring & Reliability Systems - Epic 4 Story 4.4
import {
  MonitoringSession,
  AlertCriteria,
  PerformanceReport,
  Incident,
  IncidentResponse,
  SystemHealth,
  TournamentMetrics,
  MonitoringConfig,
  AlertRule,
  EscalationLevel,
  Timestamp,
} from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';
import { SMSBackupService } from './SMSBackupService';

export class ProductionMonitoringService {
  private db: DatabaseService;
  private notificationService: NotificationService;
  private smsService: SMSBackupService;
  private activeSessions: Map<string, MonitoringSession> = new Map();
  private alertRules: AlertRule[] = [];
  private monitoringEnabled: boolean = false;

  constructor() {
    this.db = new DatabaseService();
    this.notificationService = new NotificationService();
    this.smsService = new SMSBackupService();
    this.initializeMonitoring();
  }

  /**
   * Start monitoring tournament-specific metrics
   * AC4.4.3: Tournament-specific monitoring during active events
   */
  async trackTournamentMetrics(
    tournamentId: string
  ): Promise<MonitoringSession> {
    try {
      const tournament = await this.db.getTournament(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const session: MonitoringSession = {
        sessionId: this.generateSessionId(),
        tournamentId,
        startTime: new Date(),
        endTime: undefined,
        status: 'active',
        metrics: {
          responseTime: { current: 0, average: 0, max: 0, alerts: 0 },
          syncLatency: { current: 0, average: 0, max: 0, alerts: 0 },
          offlineCapacity: { current: 8, minimum: 8, alerts: 0 },
          smsDeliveryRate: { current: 100, average: 95, alerts: 0 },
          batteryDrain: { current: 0, projected8Hour: 0, alerts: 0 },
          errorCount: { total: 0, critical: 0, warnings: 0 },
          activeUsers: { current: 0, peak: 0, concurrent: 0 },
        },
        alerts: [],
        incidents: [],
      };

      // Store active session
      this.activeSessions.set(tournamentId, session);

      // Start real-time monitoring
      await this.startRealTimeMonitoring(session);

      // Set up tournament-specific alerts
      await this.configureTournamentAlerts(tournamentId, session);

      return session;
    } catch (error) {
      throw new Error(
        `Failed to start tournament monitoring: ${error.message}`
      );
    }
  }

  /**
   * Configure and trigger alerts for critical issues
   * AC4.4.2: Automated alerting within 60 seconds of critical issues
   */
  async alertOnCriticalIssues(criteria: AlertCriteria): Promise<void> {
    try {
      const alertRule: AlertRule = {
        id: this.generateAlertId(),
        name: criteria.name,
        condition: criteria.condition,
        threshold: criteria.threshold,
        severity: criteria.severity,
        escalationLevel: criteria.escalationLevel || 'medium',
        notificationChannels: criteria.channels || ['app', 'sms', 'email'],
        cooldownMinutes: criteria.cooldownMinutes || 5,
        enabled: true,
        createdAt: new Date(),
      };

      this.alertRules.push(alertRule);

      // Immediately evaluate alert condition
      await this.evaluateAlertRule(alertRule);
    } catch (error) {
      throw new Error(`Failed to configure alert: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive performance report
   * AC4.4.5: Performance analytics and optimization identification
   */
  async generatePerformanceReport(timeRange: {
    start: Date;
    end: Date;
  }): Promise<PerformanceReport> {
    try {
      const report: PerformanceReport = {
        reportId: this.generateReportId(),
        timeRange,
        summary: {
          totalTournaments: await this.getTournamentCount(timeRange),
          totalUsers: await this.getUserCount(timeRange),
          totalIncidents: await this.getIncidentCount(timeRange),
          systemUptime: await this.calculateUptime(timeRange),
          averageResponseTime: await this.getAverageResponseTime(timeRange),
        },
        metrics: {
          performance: await this.getPerformanceMetrics(timeRange),
          reliability: await this.getReliabilityMetrics(timeRange),
          userExperience: await this.getUserExperienceMetrics(timeRange),
          indianMarket: await this.getIndianMarketMetrics(timeRange),
        },
        incidents: await this.getIncidentSummary(timeRange),
        recommendations:
          await this.generateOptimizationRecommendations(timeRange),
        trends: await this.analyzeTrends(timeRange),
        generatedAt: new Date(),
      };

      // Store report for historical analysis
      await this.storePerformanceReport(report);

      return report;
    } catch (error) {
      throw new Error(
        `Failed to generate performance report: ${error.message}`
      );
    }
  }

  /**
   * Handle incident management and response
   * AC4.4.6: Incident response with escalation and communication templates
   */
  async handleIncident(incident: Incident): Promise<IncidentResponse> {
    try {
      // Classify incident severity and priority
      const classification = this.classifyIncident(incident);

      // Create incident record
      const incidentRecord = {
        ...incident,
        id: incident.id || this.generateIncidentId(),
        classification,
        status: 'open',
        createdAt: new Date(),
        assignedTo: await this.assignIncident(classification),
        escalationLevel: classification.escalationLevel,
      };

      // Store incident
      await this.db.createIncident(incidentRecord);

      // Execute immediate response
      const response = await this.executeIncidentResponse(incidentRecord);

      // Send notifications based on escalation level
      await this.notifyIncidentStakeholders(incidentRecord, response);

      // Update monitoring sessions if tournament-related
      if (incident.tournamentId) {
        await this.updateMonitoringSession(
          incident.tournamentId,
          incidentRecord
        );
      }

      return response;
    } catch (error) {
      throw new Error(`Failed to handle incident: ${error.message}`);
    }
  }

  /**
   * Monitor real-time system health
   * AC4.4.1: Real-time system monitoring (performance, response times, health)
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const health: SystemHealth = {
        overall: 'healthy',
        timestamp: new Date(),
        components: {
          database: await this.checkDatabaseHealth(),
          api: await this.checkAPIHealth(),
          notifications: await this.checkNotificationHealth(),
          sms: await this.checkSMSHealth(),
          storage: await this.checkStorageHealth(),
          network: await this.checkNetworkHealth(),
        },
        metrics: {
          responseTime: await this.getCurrentResponseTime(),
          memoryUsage: await this.getCurrentMemoryUsage(),
          cpuUsage: await this.getCurrentCPUUsage(),
          diskUsage: await this.getCurrentDiskUsage(),
          activeConnections: await this.getActiveConnections(),
          errorRate: await this.getCurrentErrorRate(),
        },
        activeIncidents: await this.getActiveIncidents(),
        recentAlerts: await this.getRecentAlerts(),
      };

      // Determine overall health status
      health.overall = this.calculateOverallHealth(health.components);

      return health;
    } catch (error) {
      throw new Error(`Failed to get system health: ${error.message}`);
    }
  }

  /**
   * Track and categorize errors automatically
   * AC4.4.4: Error tracking with automatic categorization and priority
   */
  async trackError(error: {
    message: string;
    stack?: string;
    context?: any;
    userId?: string;
    tournamentId?: string;
    timestamp?: Date;
  }): Promise<void> {
    try {
      const errorRecord = {
        id: this.generateErrorId(),
        ...error,
        timestamp: error.timestamp || new Date(),
        category: this.categorizeError(error),
        priority: this.prioritizeError(error),
        fingerprint: this.generateErrorFingerprint(error),
        count: 1,
      };

      // Check if this is a known error pattern
      const existingError = await this.findSimilarError(
        errorRecord.fingerprint
      );
      if (existingError) {
        await this.incrementErrorCount(existingError.id);

        // Check if error frequency indicates a critical issue
        if (existingError.count > 10) {
          await this.escalateError(existingError);
        }
      } else {
        // New error - store and potentially alert
        await this.db.storeError(errorRecord);

        if (errorRecord.priority === 'critical') {
          await this.triggerCriticalErrorAlert(errorRecord);
        }
      }
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
      // Don't throw - error tracking shouldn't break the main application
    }
  }

  /**
   * Get monitoring configuration for Indian tournaments
   */
  getTournamentMetricsConfig(): TournamentMetrics {
    return {
      responseTime: { target: 3000, critical: 10000 }, // milliseconds
      syncLatency: { target: 5000, critical: 30000 },
      offlineCapacity: { target: 8, critical: 4 }, // hours
      smsDeliveryRate: { target: 95, critical: 80 }, // percentage
      batteryDrain: { target: 40, critical: 60 }, // percentage per 8 hours
      memoryUsage: { target: 150, critical: 200 }, // MB
      networkLatency: { target: 1000, critical: 5000 }, // milliseconds
      errorRate: { target: 1, critical: 5 }, // percentage
    };
  }

  // Private helper methods

  private async initializeMonitoring(): Promise<void> {
    this.monitoringEnabled = true;

    // Set up basic alert rules
    await this.setupDefaultAlertRules();

    // Start background monitoring
    this.startBackgroundMonitoring();
  }

  private generateSessionId(): string {
    return (
      'monitoring_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private generateAlertId(): string {
    return (
      'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private generateReportId(): string {
    return (
      'report_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private generateIncidentId(): string {
    return (
      'incident_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private generateErrorId(): string {
    return (
      'error_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private async startRealTimeMonitoring(
    session: MonitoringSession
  ): Promise<void> {
    // Set up real-time monitoring interval
    const monitoringInterval = setInterval(async () => {
      if (session.status !== 'active') {
        clearInterval(monitoringInterval);
        return;
      }

      await this.updateSessionMetrics(session);
      await this.checkSessionAlerts(session);
    }, 30000); // Check every 30 seconds

    // Store interval reference for cleanup
    (session as any).monitoringInterval = monitoringInterval;
  }

  private async configureTournamentAlerts(
    tournamentId: string,
    session: MonitoringSession
  ): Promise<void> {
    const config = this.getTournamentMetricsConfig();

    // Configure response time alerts
    await this.alertOnCriticalIssues({
      name: `Tournament ${tournamentId} - Response Time`,
      condition: 'response_time_exceeds',
      threshold: config.responseTime.critical,
      severity: 'critical',
      escalationLevel: 'high',
      channels: ['app', 'sms'],
      cooldownMinutes: 2,
    });

    // Configure offline capacity alerts
    await this.alertOnCriticalIssues({
      name: `Tournament ${tournamentId} - Offline Capacity`,
      condition: 'offline_capacity_low',
      threshold: config.offlineCapacity.critical,
      severity: 'warning',
      escalationLevel: 'medium',
      channels: ['app'],
      cooldownMinutes: 10,
    });

    // Configure SMS delivery alerts
    await this.alertOnCriticalIssues({
      name: `Tournament ${tournamentId} - SMS Delivery`,
      condition: 'sms_delivery_rate_low',
      threshold: config.smsDeliveryRate.critical,
      severity: 'critical',
      escalationLevel: 'high',
      channels: ['app', 'sms'],
      cooldownMinutes: 5,
    });
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    try {
      const shouldAlert = await this.checkAlertCondition(rule);

      if (shouldAlert) {
        await this.triggerAlert(rule);
      }
    } catch (error) {
      console.error(`Failed to evaluate alert rule ${rule.id}:`, error);
    }
  }

  private async checkAlertCondition(rule: AlertRule): Promise<boolean> {
    // Implementation would check actual system metrics against alert conditions
    // Simulated logic here
    switch (rule.condition) {
      case 'response_time_exceeds':
        const currentResponseTime = await this.getCurrentResponseTime();
        return currentResponseTime > rule.threshold;

      case 'error_rate_exceeds':
        const currentErrorRate = await this.getCurrentErrorRate();
        return currentErrorRate > rule.threshold;

      case 'offline_capacity_low':
        const offlineCapacity = await this.getOfflineCapacity();
        return offlineCapacity < rule.threshold;

      case 'sms_delivery_rate_low':
        const deliveryRate = await this.getSMSDeliveryRate();
        return deliveryRate < rule.threshold;

      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule): Promise<void> {
    const alert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `Alert: ${rule.name} - Threshold ${rule.threshold} exceeded`,
      timestamp: new Date(),
      acknowledged: false,
    };

    // Send notifications based on configured channels
    for (const channel of rule.notificationChannels) {
      await this.sendAlertNotification(alert, channel, rule.escalationLevel);
    }

    // Store alert for tracking
    await this.db.storeAlert(alert);
  }

  private async sendAlertNotification(
    alert: any,
    channel: string,
    escalationLevel: EscalationLevel
  ): Promise<void> {
    try {
      switch (channel) {
        case 'app':
          await this.notificationService.sendSystemAlert(alert);
          break;

        case 'sms':
          const adminPhones = await this.getAdminPhoneNumbers(escalationLevel);
          for (const phone of adminPhones) {
            await this.smsService.sendMatchAlert(phone, {
              type: 'tournament-delay',
              reason: alert.message,
            });
          }
          break;

        case 'email':
          await this.sendEmailAlert(alert, escalationLevel);
          break;
      }
    } catch (error) {
      console.error(`Failed to send ${channel} alert:`, error);
    }
  }

  private classifyIncident(incident: Incident): {
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    escalationLevel: EscalationLevel;
  } {
    // Classify based on incident type and impact
    const tournamentRelated = !!incident.tournamentId;
    const userImpact = incident.affectedUsers || 0;

    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let escalationLevel: EscalationLevel = 'low';

    if (tournamentRelated && userImpact > 50) {
      priority = 'critical';
      escalationLevel = 'high';
    } else if (tournamentRelated || userImpact > 10) {
      priority = 'high';
      escalationLevel = 'medium';
    } else if (userImpact > 0) {
      priority = 'medium';
      escalationLevel = 'low';
    }

    return {
      category: this.categorizeIncident(incident),
      priority,
      escalationLevel,
    };
  }

  private categorizeIncident(incident: Incident): string {
    if (incident.type?.includes('database')) return 'database';
    if (incident.type?.includes('network')) return 'network';
    if (incident.type?.includes('sms')) return 'sms';
    if (incident.type?.includes('tournament')) return 'tournament';
    return 'general';
  }

  private async executeIncidentResponse(
    incident: any
  ): Promise<IncidentResponse> {
    const response: IncidentResponse = {
      incidentId: incident.id,
      responseId: this.generateResponseId(),
      actions: [],
      status: 'in_progress',
      assignedTo: incident.assignedTo,
      startedAt: new Date(),
      estimatedResolutionTime: this.estimateResolutionTime(incident),
    };

    // Execute immediate response based on incident type
    const actions = await this.getResponseActions(incident);
    for (const action of actions) {
      try {
        await this.executeResponseAction(action);
        response.actions.push({
          ...action,
          status: 'completed',
          completedAt: new Date(),
        });
      } catch (error) {
        response.actions.push({
          ...action,
          status: 'failed',
          error: error.message,
          failedAt: new Date(),
        });
      }
    }

    return response;
  }

  private calculateOverallHealth(
    components: any
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const componentStates = Object.values(components) as string[];
    const unhealthyCount = componentStates.filter(
      state => state === 'unhealthy'
    ).length;
    const degradedCount = componentStates.filter(
      state => state === 'degraded'
    ).length;

    if (unhealthyCount > 0) return 'unhealthy';
    if (degradedCount > 1) return 'degraded';
    return 'healthy';
  }

  private categorizeError(error: any): string {
    if (error.message?.includes('database')) return 'database';
    if (error.message?.includes('network')) return 'network';
    if (error.message?.includes('timeout')) return 'timeout';
    if (error.message?.includes('auth')) return 'authentication';
    if (error.message?.includes('tournament')) return 'tournament';
    return 'application';
  }

  private prioritizeError(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (error.tournamentId) return 'high'; // Tournament-related errors are high priority
    if (error.message?.includes('critical')) return 'critical';
    if (error.message?.includes('timeout')) return 'medium';
    if (error.userId) return 'medium'; // User-impacting errors
    return 'low';
  }

  private generateErrorFingerprint(error: any): string {
    const key = `${error.message}_${error.stack?.split('\n')[0] || ''}`;
    return Buffer.from(key).toString('base64').substring(0, 16);
  }

  private generateResponseId(): string {
    return (
      'response_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  // Placeholder implementations for complex operations
  private async setupDefaultAlertRules(): Promise<void> {}
  private startBackgroundMonitoring(): void {}
  private async updateSessionMetrics(
    session: MonitoringSession
  ): Promise<void> {}
  private async checkSessionAlerts(session: MonitoringSession): Promise<void> {}
  private async getTournamentCount(timeRange: any): Promise<number> {
    return 5;
  }
  private async getUserCount(timeRange: any): Promise<number> {
    return 150;
  }
  private async getIncidentCount(timeRange: any): Promise<number> {
    return 3;
  }
  private async calculateUptime(timeRange: any): Promise<number> {
    return 99.5;
  }
  private async getAverageResponseTime(timeRange: any): Promise<number> {
    return 2500;
  }
  private async getPerformanceMetrics(timeRange: any): Promise<any> {
    return {};
  }
  private async getReliabilityMetrics(timeRange: any): Promise<any> {
    return {};
  }
  private async getUserExperienceMetrics(timeRange: any): Promise<any> {
    return {};
  }
  private async getIndianMarketMetrics(timeRange: any): Promise<any> {
    return {};
  }
  private async getIncidentSummary(timeRange: any): Promise<any[]> {
    return [];
  }
  private async generateOptimizationRecommendations(
    timeRange: any
  ): Promise<string[]> {
    return [];
  }
  private async analyzeTrends(timeRange: any): Promise<any> {
    return {};
  }
  private async storePerformanceReport(
    report: PerformanceReport
  ): Promise<void> {}
  private async assignIncident(classification: any): Promise<string> {
    return 'admin-1';
  }
  private async notifyIncidentStakeholders(
    incident: any,
    response: any
  ): Promise<void> {}
  private async updateMonitoringSession(
    tournamentId: string,
    incident: any
  ): Promise<void> {}
  private async checkDatabaseHealth(): Promise<string> {
    return 'healthy';
  }
  private async checkAPIHealth(): Promise<string> {
    return 'healthy';
  }
  private async checkNotificationHealth(): Promise<string> {
    return 'healthy';
  }
  private async checkSMSHealth(): Promise<string> {
    return 'healthy';
  }
  private async checkStorageHealth(): Promise<string> {
    return 'healthy';
  }
  private async checkNetworkHealth(): Promise<string> {
    return 'healthy';
  }
  private async getCurrentResponseTime(): Promise<number> {
    return 2500;
  }
  private async getCurrentMemoryUsage(): Promise<number> {
    return 150;
  }
  private async getCurrentCPUUsage(): Promise<number> {
    return 45;
  }
  private async getCurrentDiskUsage(): Promise<number> {
    return 60;
  }
  private async getActiveConnections(): Promise<number> {
    return 25;
  }
  private async getCurrentErrorRate(): Promise<number> {
    return 0.5;
  }
  private async getActiveIncidents(): Promise<any[]> {
    return [];
  }
  private async getRecentAlerts(): Promise<any[]> {
    return [];
  }
  private async findSimilarError(fingerprint: string): Promise<any> {
    return null;
  }
  private async incrementErrorCount(errorId: string): Promise<void> {}
  private async escalateError(error: any): Promise<void> {}
  private async triggerCriticalErrorAlert(error: any): Promise<void> {}
  private async getOfflineCapacity(): Promise<number> {
    return 8;
  }
  private async getSMSDeliveryRate(): Promise<number> {
    return 95;
  }
  private async getAdminPhoneNumbers(
    level: EscalationLevel
  ): Promise<string[]> {
    return [];
  }
  private async sendEmailAlert(
    alert: any,
    level: EscalationLevel
  ): Promise<void> {}
  private estimateResolutionTime(incident: any): Date {
    return new Date(Date.now() + 60 * 60 * 1000);
  }
  private async getResponseActions(incident: any): Promise<any[]> {
    return [];
  }
  private async executeResponseAction(action: any): Promise<void> {}
}

export const productionMonitoringService = new ProductionMonitoringService();

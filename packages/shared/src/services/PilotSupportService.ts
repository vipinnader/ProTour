// Pilot Tournament Support & Feedback Systems - Epic 4 Story 4.5
import {
  PilotSession,
  TournamentContext,
  PilotIssue,
  SupportTicket,
  SuccessMetrics,
  PilotReport,
  FeedbackData,
  SystemDiagnostics,
  SupportChannel,
  IssueCategory,
  PilotSuccessMetrics,
  Timestamp,
} from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';
import { ProductionMonitoringService } from './ProductionMonitoringService';

export class PilotSupportService {
  private db: DatabaseService;
  private notificationService: NotificationService;
  private monitoringService: ProductionMonitoringService;
  private activePilotSessions: Map<string, PilotSession> = new Map();
  private supportChannels: SupportChannel[] = [];
  private feedbackBuffer: FeedbackData[] = [];

  constructor() {
    this.db = new DatabaseService();
    this.notificationService = new NotificationService();
    this.monitoringService = new ProductionMonitoringService();
    this.initializePilotSupport();
  }

  /**
   * Enable pilot mode for a tournament with enhanced support
   * AC4.5.1: In-app support with direct development team communication
   */
  async enablePilotMode(tournamentId: string): Promise<PilotSession> {
    try {
      const tournament = await this.db.getTournament(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const session: PilotSession = {
        sessionId: this.generatePilotSessionId(),
        tournamentId,
        tournamentName: tournament.name,
        organizerId: tournament.organizerId,
        startTime: new Date(),
        endTime: undefined,
        status: 'active',
        supportLevel: 'enhanced',
        features: {
          directDevSupport: true,
          enhancedLogging: true,
          realTimeFeedback: true,
          rapidBugReporting: true,
          successMetricsTracking: true,
          postTournamentDebrief: true,
        },
        supportTeam: await this.assignSupportTeam(),
        issues: [],
        feedback: [],
        metrics: this.initializePilotMetrics(),
        diagnostics: await this.enableEnhancedDiagnostics(tournamentId),
      };

      // Store active pilot session
      this.activePilotSessions.set(tournamentId, session);

      // Set up enhanced monitoring for pilot tournament
      await this.monitoringService.trackTournamentMetrics(tournamentId);

      // Enable enhanced logging
      await this.enableEnhancedLogging(tournamentId);

      // Set up direct communication channel
      await this.establishDirectSupportChannel(session);

      // Initialize real-time feedback collection
      await this.initializeRealTimeFeedback(session);

      return session;
    } catch (error) {
      throw new Error(`Failed to enable pilot mode: ${error.message}`);
    }
  }

  /**
   * Collect real-time feedback during tournament workflow
   * AC4.5.3: Real-time feedback collection during tournament workflow
   */
  async collectRealTimeFeedback(context: TournamentContext): Promise<void> {
    try {
      const feedback: FeedbackData = {
        id: this.generateFeedbackId(),
        tournamentId: context.tournamentId,
        userId: context.userId,
        userRole: context.userRole,
        workflow: context.workflow,
        step: context.step,
        timestamp: new Date(),
        rating: context.rating,
        comment: context.comment,
        issues: context.issues || [],
        suggestions: context.suggestions || [],
        usabilityScore: context.usabilityScore,
        performanceRating: context.performanceRating,
        context: {
          deviceType: context.deviceType,
          networkQuality: context.networkQuality,
          appVersion: context.appVersion,
          sessionDuration: context.sessionDuration,
        },
      };

      // Store feedback immediately
      await this.storeFeedback(feedback);

      // Update pilot session if applicable
      const pilotSession = this.activePilotSessions.get(context.tournamentId);
      if (pilotSession) {
        pilotSession.feedback.push(feedback);
        await this.updatePilotSession(pilotSession);
      }

      // Analyze feedback for immediate issues
      await this.analyzeRealTimeFeedback(feedback);

      // Buffer for batch analysis
      this.feedbackBuffer.push(feedback);
    } catch (error) {
      throw new Error(`Failed to collect feedback: ${error.message}`);
    }
  }

  /**
   * Report issues with rapid response for pilot tournaments
   * AC4.5.4: Rapid bug reporting with screenshot and system information
   */
  async reportIssue(issue: PilotIssue): Promise<SupportTicket> {
    try {
      // Enhance issue with system diagnostics
      const enhancedIssue = await this.enhanceIssueWithDiagnostics(issue);

      const ticket: SupportTicket = {
        ticketId: this.generateTicketId(),
        tournamentId: issue.tournamentId,
        reportedBy: issue.userId,
        title: issue.title,
        description: issue.description,
        category: this.categorizeIssue(issue),
        priority: this.prioritizeIssue(enhancedIssue),
        severity: this.assessSeverity(enhancedIssue),
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
        assignedTo: await this.assignSupportAgent(enhancedIssue),
        attachments: issue.attachments || [],
        systemInfo: enhancedIssue.systemInfo,
        diagnostics: enhancedIssue.diagnostics,
        reproductionSteps: issue.reproductionSteps || [],
        expectedBehavior: issue.expectedBehavior,
        actualBehavior: issue.actualBehavior,
        workaround: undefined,
        resolution: undefined,
        tags: this.generateIssueTags(enhancedIssue),
      };

      // Store ticket
      await this.db.createSupportTicket(ticket);

      // Update pilot session
      const pilotSession = this.activePilotSessions.get(issue.tournamentId);
      if (pilotSession) {
        pilotSession.issues.push(ticket);
        await this.updatePilotSession(pilotSession);
      }

      // Send immediate notifications to support team
      await this.notifySupportTeam(ticket);

      // Auto-escalate critical issues
      if (ticket.priority === 'critical') {
        await this.escalateCriticalIssue(ticket);
      }

      return ticket;
    } catch (error) {
      throw new Error(`Failed to report issue: ${error.message}`);
    }
  }

  /**
   * Track and measure tournament success metrics
   * AC4.5.5: Tournament success metrics tracking (efficiency, satisfaction)
   */
  async measureSuccess(metrics: SuccessMetrics): Promise<PilotReport> {
    try {
      const pilotSession = this.activePilotSessions.get(metrics.tournamentId);
      if (!pilotSession) {
        throw new Error('Pilot session not found');
      }

      // Calculate comprehensive success metrics
      const successMetrics: PilotSuccessMetrics = {
        adminTimeReduction: await this.calculateAdminTimeReduction(metrics),
        playerSatisfactionNPS: await this.calculatePlayerNPS(metrics),
        organizerEfficiencyGain: await this.calculateEfficiencyGain(metrics),
        technicalIssueCount: pilotSession.issues.length,
        tournamentCompletionRate: await this.calculateCompletionRate(metrics),
        userAdoptionRate: await this.calculateUserAdoption(metrics),
        performanceMetrics: await this.gatherPerformanceMetrics(
          metrics.tournamentId
        ),
        feedbackScores: await this.analyzeFeedbackScores(metrics.tournamentId),
        supportResponseTime: await this.calculateSupportResponseTime(
          metrics.tournamentId
        ),
      };

      // Generate comprehensive pilot report
      const report: PilotReport = {
        reportId: this.generateReportId(),
        tournamentId: metrics.tournamentId,
        pilotSessionId: pilotSession.sessionId,
        tournamentName: pilotSession.tournamentName,
        organizerId: pilotSession.organizerId,
        duration: {
          start: pilotSession.startTime,
          end: new Date(),
          totalHours: this.calculateDurationHours(pilotSession.startTime),
        },
        successMetrics,
        feedback: {
          totalResponses: pilotSession.feedback.length,
          averageRating: this.calculateAverageRating(pilotSession.feedback),
          satisfactionScore: successMetrics.playerSatisfactionNPS,
          keyInsights: await this.extractKeyInsights(pilotSession.feedback),
          improvementAreas: await this.identifyImprovementAreas(
            pilotSession.feedback
          ),
        },
        issues: {
          totalReported: pilotSession.issues.length,
          resolved: pilotSession.issues.filter(i => i.status === 'resolved')
            .length,
          pending: pilotSession.issues.filter(i => i.status !== 'resolved')
            .length,
          criticalIssues: pilotSession.issues.filter(
            i => i.priority === 'critical'
          ),
          averageResolutionTime: this.calculateAverageResolutionTime(
            pilotSession.issues
          ),
        },
        recommendations: await this.generatePilotRecommendations(
          pilotSession,
          successMetrics
        ),
        nextSteps: await this.defineNextSteps(successMetrics),
        generatedAt: new Date(),
      };

      // Store pilot report
      await this.storePilotReport(report);

      return report;
    } catch (error) {
      throw new Error(`Failed to measure success: ${error.message}`);
    }
  }

  /**
   * Conduct post-tournament debrief and capture lessons learned
   * AC4.5.6: Post-tournament debrief capturing lessons and improvements
   */
  async conductPostTournamentDebrief(tournamentId: string): Promise<{
    debriefReport: any;
    lessonsLearned: string[];
    improvements: string[];
    actionItems: any[];
  }> {
    try {
      const pilotSession = this.activePilotSessions.get(tournamentId);
      if (!pilotSession) {
        throw new Error('Pilot session not found');
      }

      // Mark session as completed
      pilotSession.status = 'completed';
      pilotSession.endTime = new Date();

      // Gather all data for debrief
      const debriefData = {
        session: pilotSession,
        finalReport: await this.measureSuccess({ tournamentId }),
        stakeholderFeedback: await this.gatherStakeholderFeedback(tournamentId),
        technicalMetrics: await this.gatherTechnicalMetrics(tournamentId),
        userExperienceData: await this.gatherUserExperienceData(tournamentId),
      };

      // Extract lessons learned
      const lessonsLearned = await this.extractLessonsLearned(debriefData);

      // Identify improvements
      const improvements = await this.identifyImprovements(debriefData);

      // Define action items
      const actionItems = await this.defineActionItems(debriefData);

      // Create comprehensive debrief report
      const debriefReport = {
        tournamentId,
        pilotSessionId: pilotSession.sessionId,
        debriefDate: new Date(),
        participants: await this.getDebriefParticipants(tournamentId),
        summary: await this.generateDebriefSummary(debriefData),
        achievements: await this.listAchievements(debriefData),
        challenges: await this.listChallenges(debriefData),
        lessonsLearned,
        improvements,
        actionItems,
        successRate: this.calculateOverallSuccessRate(debriefData),
        mvpValidation: await this.assessMVPValidation(debriefData),
        productionReadiness: await this.assessProductionReadiness(debriefData),
      };

      // Store debrief results
      await this.storeDebriefReport(debriefReport);

      // Clean up pilot session
      this.activePilotSessions.delete(tournamentId);

      return {
        debriefReport,
        lessonsLearned,
        improvements,
        actionItems,
      };
    } catch (error) {
      throw new Error(`Failed to conduct debrief: ${error.message}`);
    }
  }

  /**
   * Get comprehensive pilot tournament analytics
   */
  async getPilotAnalytics(tournamentId: string): Promise<{
    realTimeMetrics: any;
    feedbackSummary: any;
    issueSummary: any;
    performanceData: any;
    recommendations: string[];
  }> {
    try {
      const pilotSession = this.activePilotSessions.get(tournamentId);
      if (!pilotSession) {
        throw new Error('Pilot session not found');
      }

      return {
        realTimeMetrics: await this.getRealTimeMetrics(tournamentId),
        feedbackSummary: this.summarizeFeedback(pilotSession.feedback),
        issueSummary: this.summarizeIssues(pilotSession.issues),
        performanceData: await this.gatherPerformanceMetrics(tournamentId),
        recommendations:
          await this.generateRealTimeRecommendations(pilotSession),
      };
    } catch (error) {
      throw new Error(`Failed to get pilot analytics: ${error.message}`);
    }
  }

  // Private helper methods

  private async initializePilotSupport(): Promise<void> {
    // Set up support channels
    this.supportChannels = [
      {
        id: 'dev-direct',
        name: 'Direct Development Team',
        type: 'chat',
        priority: 'high',
        responseTime: '< 5 minutes',
        availability: '24/7',
      },
      {
        id: 'support-escalation',
        name: 'Support Escalation',
        type: 'ticket',
        priority: 'medium',
        responseTime: '< 15 minutes',
        availability: '8am-10pm IST',
      },
    ];

    // Initialize feedback processing
    this.startFeedbackProcessing();
  }

  private generatePilotSessionId(): string {
    return (
      'pilot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private generateFeedbackId(): string {
    return (
      'feedback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private generateTicketId(): string {
    return (
      'ticket_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private generateReportId(): string {
    return (
      'pilot_report_' +
      Date.now() +
      '_' +
      Math.random().toString(36).substr(2, 9)
    );
  }

  private async assignSupportTeam(): Promise<string[]> {
    return ['dev-lead', 'support-specialist', 'product-manager'];
  }

  private initializePilotMetrics(): any {
    return {
      startTime: new Date(),
      userSessions: 0,
      completedWorkflows: 0,
      reportedIssues: 0,
      resolvedIssues: 0,
      averageResponseTime: 0,
      satisfactionScore: 0,
      technicalProblems: 0,
      usabilityIssues: 0,
    };
  }

  private async enableEnhancedDiagnostics(
    tournamentId: string
  ): Promise<SystemDiagnostics> {
    return {
      loggingLevel: 'debug',
      performanceTracking: true,
      errorReporting: 'enhanced',
      userInteractionTracking: true,
      networkMonitoring: true,
      deviceMetrics: true,
    };
  }

  private async enableEnhancedLogging(tournamentId: string): Promise<void> {
    // Enable detailed logging for pilot tournament
    await this.db.updateTournamentConfig(tournamentId, {
      loggingLevel: 'debug',
      captureUserInteractions: true,
      capturePerformanceMetrics: true,
      captureNetworkMetrics: true,
    });
  }

  private async establishDirectSupportChannel(
    session: PilotSession
  ): Promise<void> {
    // Set up real-time communication channel with development team
    const channel = {
      sessionId: session.sessionId,
      tournamentId: session.tournamentId,
      type: 'pilot-support',
      participants: session.supportTeam,
      features: ['instant-messaging', 'screen-sharing', 'issue-escalation'],
    };

    await this.db.createSupportChannel(channel);
  }

  private async initializeRealTimeFeedback(
    session: PilotSession
  ): Promise<void> {
    // Set up real-time feedback collection system
    const feedbackConfig = {
      tournamentId: session.tournamentId,
      collectOnWorkflowCompletion: true,
      collectOnIssueEncounter: true,
      collectOnRegularIntervals: 15, // minutes
      collectOnSentiment: ['frustrated', 'confused', 'delighted'],
    };

    await this.db.updateFeedbackConfig(session.tournamentId, feedbackConfig);
  }

  private async enhanceIssueWithDiagnostics(issue: PilotIssue): Promise<any> {
    const systemInfo = await this.gatherSystemInfo(issue.userId);
    const diagnostics = await this.runDiagnostics(issue.tournamentId);

    return {
      ...issue,
      systemInfo,
      diagnostics,
      timestamp: new Date(),
    };
  }

  private categorizeIssue(issue: PilotIssue): IssueCategory {
    if (issue.description?.toLowerCase().includes('crash')) return 'bug';
    if (issue.description?.toLowerCase().includes('slow')) return 'performance';
    if (issue.description?.toLowerCase().includes('confus')) return 'usability';
    if (issue.description?.toLowerCase().includes('data')) return 'data';
    if (issue.description?.toLowerCase().includes('network')) return 'network';
    return 'general';
  }

  private prioritizeIssue(issue: any): 'low' | 'medium' | 'high' | 'critical' {
    if (
      issue.description?.toLowerCase().includes('crash') ||
      issue.description?.toLowerCase().includes('data loss')
    ) {
      return 'critical';
    }
    if (
      issue.description?.toLowerCase().includes('tournament') ||
      issue.description?.toLowerCase().includes('match')
    ) {
      return 'high';
    }
    if (
      issue.description?.toLowerCase().includes('slow') ||
      issue.description?.toLowerCase().includes('error')
    ) {
      return 'medium';
    }
    return 'low';
  }

  private assessSeverity(issue: any): 'low' | 'medium' | 'high' | 'critical' {
    return this.prioritizeIssue(issue); // Same logic for now
  }

  private calculateDurationHours(startTime: Date): number {
    return (new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60);
  }

  private calculateAverageRating(feedback: FeedbackData[]): number {
    if (feedback.length === 0) return 0;
    const sum = feedback.reduce((acc, f) => acc + (f.rating || 0), 0);
    return sum / feedback.length;
  }

  private calculateAverageResolutionTime(issues: SupportTicket[]): number {
    const resolvedIssues = issues.filter(
      i => i.status === 'resolved' && i.resolution?.resolvedAt
    );
    if (resolvedIssues.length === 0) return 0;

    const totalTime = resolvedIssues.reduce((acc, issue) => {
      const duration =
        issue.resolution!.resolvedAt!.getTime() - issue.createdAt.getTime();
      return acc + duration;
    }, 0);

    return totalTime / resolvedIssues.length / (1000 * 60); // minutes
  }

  private calculateOverallSuccessRate(debriefData: any): number {
    const metrics = debriefData.finalReport.successMetrics;
    const weights = {
      adminTimeReduction: 0.2,
      playerSatisfactionNPS: 0.3,
      organizerEfficiencyGain: 0.2,
      technicalIssueResolution: 0.15,
      tournamentCompletionRate: 0.15,
    };

    const scores = {
      adminTimeReduction: Math.min(metrics.adminTimeReduction / 50, 1) * 100, // Target 50%
      playerSatisfactionNPS:
        Math.max((metrics.playerSatisfactionNPS + 100) / 200, 0) * 100, // NPS -100 to +100
      organizerEfficiencyGain:
        Math.min(metrics.organizerEfficiencyGain / 40, 1) * 100, // Target 40%
      technicalIssueResolution: Math.min(
        (debriefData.session.issues.length > 0
          ? debriefData.session.issues.filter(i => i.status === 'resolved')
              .length / debriefData.session.issues.length
          : 1) * 100,
        100
      ),
      tournamentCompletionRate: metrics.tournamentCompletionRate,
    };

    return Object.entries(weights).reduce(
      (acc, [key, weight]) => acc + scores[key] * weight,
      0
    );
  }

  // Placeholder implementations for complex operations
  private async storeFeedback(feedback: FeedbackData): Promise<void> {}
  private async updatePilotSession(session: PilotSession): Promise<void> {}
  private async analyzeRealTimeFeedback(
    feedback: FeedbackData
  ): Promise<void> {}
  private async assignSupportAgent(issue: any): Promise<string> {
    return 'support-agent-1';
  }
  private async notifySupportTeam(ticket: SupportTicket): Promise<void> {}
  private async escalateCriticalIssue(ticket: SupportTicket): Promise<void> {}
  private async calculateAdminTimeReduction(
    metrics: SuccessMetrics
  ): Promise<number> {
    return 35;
  }
  private async calculatePlayerNPS(metrics: SuccessMetrics): Promise<number> {
    return 42;
  }
  private async calculateEfficiencyGain(
    metrics: SuccessMetrics
  ): Promise<number> {
    return 28;
  }
  private async calculateCompletionRate(
    metrics: SuccessMetrics
  ): Promise<number> {
    return 95;
  }
  private async calculateUserAdoption(
    metrics: SuccessMetrics
  ): Promise<number> {
    return 78;
  }
  private async gatherPerformanceMetrics(tournamentId: string): Promise<any> {
    return {};
  }
  private async analyzeFeedbackScores(tournamentId: string): Promise<any> {
    return {};
  }
  private async calculateSupportResponseTime(
    tournamentId: string
  ): Promise<number> {
    return 8;
  }
  private async extractKeyInsights(
    feedback: FeedbackData[]
  ): Promise<string[]> {
    return [];
  }
  private async identifyImprovementAreas(
    feedback: FeedbackData[]
  ): Promise<string[]> {
    return [];
  }
  private async generatePilotRecommendations(
    session: PilotSession,
    metrics: any
  ): Promise<string[]> {
    return [];
  }
  private async defineNextSteps(metrics: any): Promise<string[]> {
    return [];
  }
  private async storePilotReport(report: PilotReport): Promise<void> {}
  private async gatherStakeholderFeedback(tournamentId: string): Promise<any> {
    return {};
  }
  private async gatherTechnicalMetrics(tournamentId: string): Promise<any> {
    return {};
  }
  private async gatherUserExperienceData(tournamentId: string): Promise<any> {
    return {};
  }
  private async extractLessonsLearned(data: any): Promise<string[]> {
    return [];
  }
  private async identifyImprovements(data: any): Promise<string[]> {
    return [];
  }
  private async defineActionItems(data: any): Promise<any[]> {
    return [];
  }
  private async getDebriefParticipants(
    tournamentId: string
  ): Promise<string[]> {
    return [];
  }
  private async generateDebriefSummary(data: any): Promise<string> {
    return '';
  }
  private async listAchievements(data: any): Promise<string[]> {
    return [];
  }
  private async listChallenges(data: any): Promise<string[]> {
    return [];
  }
  private async assessMVPValidation(data: any): Promise<any> {
    return {};
  }
  private async assessProductionReadiness(data: any): Promise<any> {
    return {};
  }
  private async storeDebriefReport(report: any): Promise<void> {}
  private async getRealTimeMetrics(tournamentId: string): Promise<any> {
    return {};
  }
  private summarizeFeedback(feedback: FeedbackData[]): any {
    return {};
  }
  private summarizeIssues(issues: SupportTicket[]): any {
    return {};
  }
  private async generateRealTimeRecommendations(
    session: PilotSession
  ): Promise<string[]> {
    return [];
  }
  private async gatherSystemInfo(userId: string): Promise<any> {
    return {};
  }
  private async runDiagnostics(tournamentId: string): Promise<any> {
    return {};
  }
  private startFeedbackProcessing(): void {}
  private generateIssueTags(issue: any): string[] {
    return [];
  }
}

export const pilotSupportService = new PilotSupportService();

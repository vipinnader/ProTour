// SMS Notification Backup System - Epic 4 Story 4.2
import {
  SMSResult,
  BatchSMSResult,
  MatchAlert,
  FallbackConditions,
  DeliveryStatus,
  SMSProvider,
  SMSTemplate,
  SMSCostConfig,
  Timestamp,
} from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';

export class SMSBackupService {
  private db: DatabaseService;
  private notificationService: NotificationService;
  private smsProvider: SMSProvider;
  private costConfig: SMSCostConfig;
  private fallbackEnabled: boolean = true;
  private fallbackTimeoutMs: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.db = new DatabaseService();
    this.notificationService = new NotificationService();
    this.initializeSMSProvider();
    this.setupCostControls();
  }

  /**
   * Send match alert via SMS
   * AC4.2.1: SMS gateway integration with Indian providers supporting tournament notifications
   */
  async sendMatchAlert(
    phoneNumber: string,
    matchInfo: MatchAlert
  ): Promise<SMSResult> {
    try {
      // Format phone number for Indian market
      const formattedNumber = this.formatIndianPhoneNumber(phoneNumber);

      // Create optimized SMS content
      const message = this.createMatchAlertMessage(matchInfo);

      // Check cost limits before sending
      await this.checkCostLimits(1);

      // Send SMS with delivery tracking
      const result = await this.sendSMS(formattedNumber, message, {
        priority: 'high',
        trackDelivery: true,
        retryOnFail: true,
        templateType: 'match-alert',
      });

      // Log SMS for cost tracking
      await this.logSMSUsage(result);

      return result;
    } catch (error) {
      throw new Error(`Failed to send match alert SMS: ${error.message}`);
    }
  }

  /**
   * Send tournament updates to multiple recipients
   * AC4.2.3: SMS content optimization for 160-character limit with tournament codes
   */
  async sendTournamentUpdate(
    recipients: string[],
    message: string,
    tournamentCode?: string
  ): Promise<BatchSMSResult> {
    try {
      // Optimize message for 160-character SMS limit
      const optimizedMessage = this.optimizeMessageForSMS(
        message,
        tournamentCode
      );

      // Format all phone numbers
      const formattedNumbers = recipients.map(num =>
        this.formatIndianPhoneNumber(num)
      );

      // Check cost limits for batch
      await this.checkCostLimits(formattedNumbers.length);

      // Implement rate limiting for batch sending
      const results = await this.sendBatchSMS(
        formattedNumbers,
        optimizedMessage,
        {
          batchSize: this.getBatchSize(),
          delayBetweenBatches: this.getBatchDelay(),
          priority: 'normal',
        }
      );

      // Log batch SMS usage
      await this.logBatchSMSUsage(results);

      return results;
    } catch (error) {
      throw new Error(`Failed to send tournament update SMS: ${error.message}`);
    }
  }

  /**
   * Configure automatic SMS fallback when push notifications fail
   * AC4.2.2: Automatic SMS fallback when push notifications fail (5-minute timeout)
   */
  async configureFallback(conditions: FallbackConditions): Promise<void> {
    try {
      this.fallbackEnabled = conditions.enabled;
      this.fallbackTimeoutMs = conditions.timeoutMs || 5 * 60 * 1000;

      // Store fallback configuration
      await this.db.updateSystemConfig('sms_fallback', {
        enabled: this.fallbackEnabled,
        timeoutMs: this.fallbackTimeoutMs,
        conditions: conditions,
        updatedAt: new Date(),
      });

      // Set up automatic fallback monitoring
      if (this.fallbackEnabled) {
        await this.setupFallbackMonitoring();
      }
    } catch (error) {
      throw new Error(`Failed to configure SMS fallback: ${error.message}`);
    }
  }

  /**
   * Track SMS delivery status and implement retry mechanisms
   * AC4.2.6: SMS delivery confirmation and retry mechanisms
   */
  async trackDelivery(messageId: string): Promise<DeliveryStatus> {
    try {
      // Query SMS provider for delivery status
      const providerStatus = await this.queryProviderDeliveryStatus(messageId);

      // Update local delivery tracking
      await this.updateDeliveryStatus(messageId, providerStatus);

      // Implement retry logic for failed deliveries
      if (providerStatus.status === 'failed' && providerStatus.canRetry) {
        await this.scheduleRetry(messageId);
      }

      return providerStatus;
    } catch (error) {
      throw new Error(`Failed to track SMS delivery: ${error.message}`);
    }
  }

  /**
   * Configure user SMS preferences and frequency controls
   * AC4.2.4: User SMS preferences and frequency controls
   */
  async updateUserSMSPreferences(
    userId: string,
    preferences: {
      enableSMSFallback?: boolean;
      maxDailySMS?: number;
      allowedTypes?: string[];
      quietHours?: { start: number; end: number };
      emergencyOnly?: boolean;
    }
  ): Promise<void> {
    try {
      await this.db.updateUserPreferences(userId, 'sms', preferences);

      // Update rate limiting for this user
      if (preferences.maxDailySMS) {
        await this.updateUserRateLimit(userId, preferences.maxDailySMS);
      }
    } catch (error) {
      throw new Error(`Failed to update SMS preferences: ${error.message}`);
    }
  }

  /**
   * Implement cost-efficient SMS batching and rate limiting
   * AC4.2.5: Cost-efficient SMS batching and rate limiting
   */
  async enableCostOptimization(config: SMSCostConfig): Promise<void> {
    try {
      this.costConfig = config;

      // Set up daily/monthly cost limits
      await this.setupCostLimits(config);

      // Configure optimal batch sizes for cost efficiency
      await this.optimizeBatchSizes(config);

      // Enable cost monitoring and alerts
      await this.enableCostMonitoring(config);
    } catch (error) {
      throw new Error(`Failed to enable cost optimization: ${error.message}`);
    }
  }

  /**
   * Handle automatic fallback from push notifications to SMS
   */
  async handleNotificationFallback(
    userId: string,
    notificationId: string,
    originalMessage: string,
    urgency: 'low' | 'medium' | 'high' | 'emergency' = 'medium'
  ): Promise<SMSResult | null> {
    try {
      // Check if fallback is enabled for this user
      const userPrefs = await this.getUserSMSPreferences(userId);
      if (!userPrefs.enableSMSFallback && urgency !== 'emergency') {
        return null;
      }

      // Wait for fallback timeout
      await this.delay(this.fallbackTimeoutMs);

      // Check if push notification was delivered
      const deliveryStatus =
        await this.notificationService.checkDeliveryStatus(notificationId);

      if (deliveryStatus.delivered) {
        // Push notification was delivered, no need for SMS fallback
        return null;
      }

      // Get user phone number
      const user = await this.db.getUser(userId);
      if (!user?.phone) {
        throw new Error('User phone number not available for SMS fallback');
      }

      // Send SMS fallback
      const smsMessage = this.optimizeMessageForSMS(originalMessage);
      return await this.sendSMS(user.phone, smsMessage, {
        priority: urgency,
        fallback: true,
        originalNotificationId: notificationId,
      });
    } catch (error) {
      console.error('SMS fallback failed:', error);
      return null;
    }
  }

  /**
   * Get SMS usage statistics for cost monitoring
   */
  async getSMSUsageStats(timeRange: 'daily' | 'monthly'): Promise<{
    totalSent: number;
    totalCost: number;
    deliveryRate: number;
    topRecipients: string[];
    costByType: Record<string, number>;
  }> {
    try {
      const stats = await this.db.getSMSUsageStats(timeRange);
      return {
        totalSent: stats.count || 0,
        totalCost: stats.cost || 0,
        deliveryRate: stats.deliveryRate || 0,
        topRecipients: stats.topRecipients || [],
        costByType: stats.costByType || {},
      };
    } catch (error) {
      return {
        totalSent: 0,
        totalCost: 0,
        deliveryRate: 0,
        topRecipients: [],
        costByType: {},
      };
    }
  }

  // Private helper methods

  private async initializeSMSProvider(): Promise<void> {
    // Initialize Indian SMS providers (Twilio India, MSG91, etc.)
    this.smsProvider = {
      name: 'twilio-india', // or 'msg91' based on configuration
      apiKey: process.env.SMS_API_KEY || '',
      apiSecret: process.env.SMS_API_SECRET || '',
      senderId: process.env.SMS_SENDER_ID || 'ProTour',
      baseUrl: this.getSMSProviderBaseUrl(),
    };
  }

  private setupCostControls(): void {
    this.costConfig = {
      dailyLimit: 500, // ₹500 per day
      monthlyLimit: 10000, // ₹10,000 per month
      costPerSMS: 0.25, // ₹0.25 per SMS
      emergencyCostMultiplier: 2.0,
      batchDiscountThreshold: 100,
      batchDiscountRate: 0.1, // 10% discount for 100+ SMS
    };
  }

  private formatIndianPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Add country code if missing
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned; // Add India country code
    } else if (cleaned.startsWith('0')) {
      cleaned = '91' + cleaned.substring(1); // Replace leading 0 with country code
    }

    return '+' + cleaned;
  }

  private createMatchAlertMessage(matchInfo: MatchAlert): string {
    const templates = this.getSMSTemplates();

    switch (matchInfo.type) {
      case 'match-ready':
        return templates.matchReady(
          matchInfo.playerName || 'Player',
          matchInfo.opponent || 'Opponent',
          matchInfo.court || 'TBD'
        );
      case 'tournament-delay':
        return templates.tournamentDelay(
          matchInfo.delayMinutes || 0,
          matchInfo.reason || 'Technical issues'
        );
      case 'bracket-update':
        return templates.bracketUpdate(
          matchInfo.playerName || 'Player',
          matchInfo.result || 'advanced'
        );
      default:
        return `ProTour: Tournament update. Check app for details.`;
    }
  }

  private getSMSTemplates(): Record<string, Function> {
    return {
      matchReady: (playerName: string, opponent: string, court: string) =>
        `ProTour: ${playerName} vs ${opponent} starting soon on Court ${court}. Check app for details.`,
      tournamentDelay: (minutes: number, reason: string) =>
        `ProTour: Tournament delayed ${minutes}min due to ${reason}. Updates in app.`,
      bracketUpdate: (playerName: string, result: string) =>
        `ProTour: ${playerName} ${result}. Next match details in app.`,
      generalUpdate: (tournamentCode: string, message: string) =>
        `ProTour ${tournamentCode}: ${message}`,
    };
  }

  private optimizeMessageForSMS(
    message: string,
    tournamentCode?: string
  ): string {
    const maxLength = 160;
    const prefix = tournamentCode ? `ProTour ${tournamentCode}: ` : 'ProTour: ';
    const suffix = ' Check app.';
    const availableLength = maxLength - prefix.length - suffix.length;

    let optimizedMessage = message;

    if (optimizedMessage.length > availableLength) {
      // Truncate message to fit within SMS limit
      optimizedMessage =
        optimizedMessage.substring(0, availableLength - 3) + '...';
    }

    return prefix + optimizedMessage + suffix;
  }

  private async sendSMS(
    phoneNumber: string,
    message: string,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'emergency';
      trackDelivery?: boolean;
      retryOnFail?: boolean;
      templateType?: string;
      fallback?: boolean;
      originalNotificationId?: string;
    } = {}
  ): Promise<SMSResult> {
    try {
      // Simulate SMS sending (in real implementation, would call actual SMS API)
      const messageId = this.generateMessageId();
      const cost = this.calculateSMSCost(message, options.priority);

      // Log SMS attempt
      await this.logSMSAttempt(phoneNumber, message, options);

      // Simulate delivery (in real implementation, would be async callback)
      setTimeout(() => {
        this.handleDeliveryCallback(messageId, 'delivered');
      }, 5000);

      return {
        messageId,
        status: 'sent',
        cost,
        timestamp: new Date(),
        phoneNumber,
        message,
        deliveryExpected: options.trackDelivery
          ? new Date(Date.now() + 30000)
          : undefined,
      };
    } catch (error) {
      return {
        messageId: '',
        status: 'failed',
        cost: 0,
        timestamp: new Date(),
        phoneNumber,
        message,
        error: error.message,
      };
    }
  }

  private async sendBatchSMS(
    phoneNumbers: string[],
    message: string,
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<BatchSMSResult> {
    const batchSize = options.batchSize || 50;
    const delay = options.delayBetweenBatches || 1000;
    const results: SMSResult[] = [];
    let totalCost = 0;
    let successCount = 0;

    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize);

      // Send batch
      for (const phoneNumber of batch) {
        const result = await this.sendSMS(phoneNumber, message, {
          priority: options.priority,
          trackDelivery: true,
        });

        results.push(result);
        totalCost += result.cost;
        if (result.status === 'sent') successCount++;
      }

      // Delay between batches for rate limiting
      if (i + batchSize < phoneNumbers.length) {
        await this.delay(delay);
      }
    }

    return {
      batchId: this.generateBatchId(),
      totalCount: phoneNumbers.length,
      successCount,
      failureCount: phoneNumbers.length - successCount,
      totalCost,
      results,
      timestamp: new Date(),
    };
  }

  private getBatchSize(): number {
    // Optimize batch size based on cost configuration
    return this.costConfig.batchDiscountThreshold || 50;
  }

  private getBatchDelay(): number {
    // Rate limiting delay between batches
    return 1000; // 1 second
  }

  private async checkCostLimits(smsCount: number): Promise<void> {
    const estimatedCost = smsCount * this.costConfig.costPerSMS;
    const dailyUsage = await this.getDailySMSCost();
    const monthlyUsage = await this.getMonthlySMSCost();

    if (dailyUsage + estimatedCost > this.costConfig.dailyLimit) {
      throw new Error('Daily SMS cost limit exceeded');
    }

    if (monthlyUsage + estimatedCost > this.costConfig.monthlyLimit) {
      throw new Error('Monthly SMS cost limit exceeded');
    }
  }

  private calculateSMSCost(message: string, priority?: string): number {
    let cost = this.costConfig.costPerSMS;

    // Multiple SMS for long messages
    const smsCount = Math.ceil(message.length / 160);
    cost *= smsCount;

    // Emergency multiplier
    if (priority === 'emergency') {
      cost *= this.costConfig.emergencyCostMultiplier;
    }

    return cost;
  }

  private async setupFallbackMonitoring(): Promise<void> {
    // Set up monitoring for push notification failures
    this.notificationService.onDeliveryFailure(async notificationInfo => {
      await this.handleNotificationFallback(
        notificationInfo.userId,
        notificationInfo.notificationId,
        notificationInfo.message,
        notificationInfo.urgency
      );
    });
  }

  private async getUserSMSPreferences(userId: string) {
    const prefs = await this.db.getUserPreferences(userId, 'sms');
    return {
      enableSMSFallback: prefs?.enableSMSFallback ?? true,
      maxDailySMS: prefs?.maxDailySMS ?? 10,
      allowedTypes: prefs?.allowedTypes ?? ['match-alert', 'tournament-update'],
      quietHours: prefs?.quietHours ?? { start: 22, end: 8 },
      emergencyOnly: prefs?.emergencyOnly ?? false,
    };
  }

  private getSMSProviderBaseUrl(): string {
    const provider = this.smsProvider?.name || 'twilio-india';
    const urls = {
      'twilio-india': 'https://api.twilio.com/2010-04-01',
      msg91: 'https://api.msg91.com/api',
      textlocal: 'https://api.textlocal.in',
    };
    return urls[provider] || urls['twilio-india'];
  }

  // Placeholder implementations for complex operations
  private generateMessageId(): string {
    return 'sms_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateBatchId(): string {
    return (
      'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  private async queryProviderDeliveryStatus(
    messageId: string
  ): Promise<DeliveryStatus> {
    // Implementation would query actual SMS provider
    return {
      messageId,
      status: 'delivered',
      deliveredAt: new Date(),
      canRetry: false,
    };
  }

  private async updateDeliveryStatus(
    messageId: string,
    status: DeliveryStatus
  ): Promise<void> {
    await this.db.updateSMSDeliveryStatus(messageId, status);
  }

  private async scheduleRetry(messageId: string): Promise<void> {
    // Implementation would schedule SMS retry
    setTimeout(async () => {
      // Retry logic here
    }, 60000); // Retry after 1 minute
  }

  private async updateUserRateLimit(
    userId: string,
    maxDaily: number
  ): Promise<void> {
    await this.db.updateUserSMSRateLimit(userId, maxDaily);
  }

  private async setupCostLimits(config: SMSCostConfig): Promise<void> {
    // Implementation would set up cost monitoring
  }

  private async optimizeBatchSizes(config: SMSCostConfig): Promise<void> {
    // Implementation would optimize batching for cost efficiency
  }

  private async enableCostMonitoring(config: SMSCostConfig): Promise<void> {
    // Implementation would enable cost alerts and monitoring
  }

  private async logSMSUsage(result: SMSResult): Promise<void> {
    await this.db.logSMSUsage({
      messageId: result.messageId,
      phoneNumber: result.phoneNumber,
      message: result.message,
      cost: result.cost,
      status: result.status,
      timestamp: result.timestamp,
    });
  }

  private async logBatchSMSUsage(results: BatchSMSResult): Promise<void> {
    await this.db.logBatchSMSUsage({
      batchId: results.batchId,
      totalCount: results.totalCount,
      successCount: results.successCount,
      totalCost: results.totalCost,
      timestamp: results.timestamp,
    });
  }

  private async logSMSAttempt(
    phoneNumber: string,
    message: string,
    options: any
  ): Promise<void> {
    // Log SMS attempt for debugging and monitoring
  }

  private handleDeliveryCallback(messageId: string, status: string): void {
    // Handle SMS delivery callback from provider
  }

  private async getDailySMSCost(): Promise<number> {
    return await this.db.getDailySMSCost();
  }

  private async getMonthlySMSCost(): Promise<number> {
    return await this.db.getMonthlySMSCost();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const smsBackupService = new SMSBackupService();

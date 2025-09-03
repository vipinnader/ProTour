/**
 * External service testing mocks and fixtures for ProTour
 * Provides comprehensive mocking for all external service integrations
 */

// TODO: Re-enable when these services are implemented
// import type {
//   PaymentGateway, PaymentIntent, PaymentResult, RefundResult, PaymentCustomer, PaymentAmount,
//   SMSProvider, SMSResult, SMSMessage,
//   EmailProvider, EmailResult, EmailMessage,
//   PushNotificationService, NotificationResult, PushNotificationPayload, NotificationTarget,
//   StorageProvider, UploadResult, StorageFile,
//   AnalyticsProvider, AnalyticsEvent,
//   SocialAuthProvider, AuthResult, AuthCredentials,
// } from '../services';

export interface MockConfig {
  delayMs?: number;
  failureRate?: number; // 0-1, probability of failure
  networkLatency?: number;
  enableRandomFailures?: boolean;
}

export class MockService {
  protected config: MockConfig;

  constructor(config: MockConfig = {}) {
    this.config = {
      delayMs: 100,
      failureRate: 0,
      networkLatency: 50,
      enableRandomFailures: false,
      ...config,
    };
  }

  protected async simulateNetworkDelay(): Promise<void> {
    const delay =
      this.config.delayMs! + Math.random() * (this.config.networkLatency! * 2);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  protected shouldSimulateFailure(): boolean {
    if (
      this.config.enableRandomFailures &&
      Math.random() < this.config.failureRate!
    ) {
      return true;
    }
    return false;
  }

  protected generateId(prefix: string = 'mock'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Mock Payment Gateway
 */
export class MockPaymentGateway extends MockService implements PaymentGateway {
  async createPaymentIntent(
    amount: PaymentAmount,
    customer: PaymentCustomer,
    options: any
  ): Promise<PaymentIntent> {
    await this.simulateNetworkDelay();

    if (this.shouldSimulateFailure()) {
      throw new Error('Mock payment intent creation failed');
    }

    return {
      id: this.generateId('pi'),
      amount,
      customer,
      description: options.description || 'Test payment',
      metadata: options.metadata || {},
      status: 'pending',
      clientSecret: `${this.generateId('secret')}_client_secret`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async confirmPayment(
    paymentIntentId: string,
    paymentMethod: any
  ): Promise<PaymentResult> {
    await this.simulateNetworkDelay();

    if (this.shouldSimulateFailure()) {
      return {
        success: false,
        paymentId: paymentIntentId,
        error: 'Mock payment confirmation failed',
      };
    }

    return {
      success: true,
      paymentId: this.generateId('pay'),
      transactionId: this.generateId('txn'),
    };
  }

  async capturePayment(paymentIntentId: string): Promise<PaymentResult> {
    await this.simulateNetworkDelay();
    return {
      success: !this.shouldSimulateFailure(),
      paymentId: paymentIntentId,
    };
  }

  async refundPayment(request: any): Promise<RefundResult> {
    await this.simulateNetworkDelay();

    return {
      success: !this.shouldSimulateFailure(),
      refundId: this.generateId('rfnd'),
      amount: request.amount || { value: 1000, currency: 'INR' },
      status: 'pending',
    };
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent> {
    await this.simulateNetworkDelay();

    return {
      id,
      amount: { value: 1000, currency: 'INR' },
      customer: {
        id: 'cust_123',
        name: 'Mock User',
        email: 'user@example.com',
      },
      description: 'Mock payment',
      metadata: {},
      status: 'succeeded',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async listPaymentMethods(customerId: string): Promise<any[]> {
    await this.simulateNetworkDelay();
    return [{ id: 'pm_123', type: 'card', last4: '4242', brand: 'visa' }];
  }

  async createCustomer(customer: any): Promise<PaymentCustomer> {
    await this.simulateNetworkDelay();
    return { id: this.generateId('cust'), ...customer };
  }

  async updateCustomer(
    customerId: string,
    updates: any
  ): Promise<PaymentCustomer> {
    await this.simulateNetworkDelay();
    return {
      id: customerId,
      name: 'Updated User',
      email: 'user@example.com',
      ...updates,
    };
  }

  verifyWebhook(payload: string, signature: string, secret: string): any {
    return JSON.parse(payload);
  }

  async calculateFees(amount: PaymentAmount): Promise<PaymentAmount> {
    return { value: amount.value * 0.02, currency: amount.currency };
  }
}

/**
 * Mock SMS Provider
 */
export class MockSMSProvider extends MockService implements SMSProvider {
  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    await this.simulateNetworkDelay();

    if (this.shouldSimulateFailure()) {
      return {
        success: false,
        error: 'Mock SMS sending failed',
        status: 'failed',
      };
    }

    return {
      success: true,
      messageId: this.generateId('sms'),
      status: 'sent',
      cost: 0.1,
    };
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    await this.simulateNetworkDelay();

    return messages.map(() => ({
      success: !this.shouldSimulateFailure(),
      messageId: this.generateId('sms'),
      status: 'sent' as const,
      cost: 0.1,
    }));
  }

  async getDeliveryStatus(messageId: string): Promise<any> {
    await this.simulateNetworkDelay();
    return {
      id: messageId,
      status: 'delivered',
      sentAt: new Date(),
      deliveredAt: new Date(),
    };
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  async estimateCost(message: SMSMessage): Promise<number> {
    const segments = Math.ceil(message.body.length / 160);
    return segments * 0.1;
  }
}

/**
 * Mock Email Provider
 */
export class MockEmailProvider extends MockService implements EmailProvider {
  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    await this.simulateNetworkDelay();

    if (this.shouldSimulateFailure()) {
      return {
        success: false,
        error: 'Mock email sending failed',
        rejected: message.to.map(addr => addr.email),
      };
    }

    return {
      success: true,
      messageId: this.generateId('email'),
      accepted: message.to.map(addr => addr.email),
    };
  }

  async sendBulkEmail(request: any): Promise<EmailResult> {
    await this.simulateNetworkDelay();

    const accepted = request.recipients.map((r: any) => r.email.email);

    return {
      success: !this.shouldSimulateFailure(),
      messageId: this.generateId('bulk_email'),
      accepted,
    };
  }

  async sendTemplatedEmail(data: any): Promise<EmailResult> {
    await this.simulateNetworkDelay();

    return {
      success: !this.shouldSimulateFailure(),
      messageId: this.generateId('template_email'),
      accepted: data.to.map((addr: any) => addr.email),
    };
  }

  async createTemplate(template: any): Promise<any> {
    await this.simulateNetworkDelay();
    return {
      id: this.generateId('template'),
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateTemplate(id: string, updates: any): Promise<any> {
    await this.simulateNetworkDelay();
    return { id, ...updates, updatedAt: new Date() };
  }

  async deleteTemplate(id: string): Promise<boolean> {
    await this.simulateNetworkDelay();
    return !this.shouldSimulateFailure();
  }

  async getTemplate(id: string): Promise<any> {
    await this.simulateNetworkDelay();
    return {
      id,
      name: 'Mock Template',
      subject: 'Mock Subject',
      htmlContent: '<p>Mock content</p>',
      variables: [],
    };
  }

  async listTemplates(): Promise<any[]> {
    await this.simulateNetworkDelay();
    return [
      {
        id: 'template_1',
        name: 'Welcome Email',
        subject: 'Welcome!',
        htmlContent: '<p>Welcome!</p>',
      },
    ];
  }

  async getStats(): Promise<any> {
    return {
      sent: 100,
      delivered: 95,
      opened: 60,
      clicked: 20,
      bounced: 3,
      spam: 2,
      unsubscribed: 1,
    };
  }

  processWebhook(payload: string, signature?: string): any[] {
    return [
      {
        messageId: 'mock_msg',
        event: 'delivered',
        timestamp: new Date(),
        recipient: 'user@example.com',
      },
    ];
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Mock Push Notification Service
 */
export class MockPushNotificationService
  extends MockService
  implements PushNotificationService
{
  async initialize(): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockPush] Initialized');
  }

  async sendNotification(
    payload: PushNotificationPayload,
    target: NotificationTarget
  ): Promise<NotificationResult> {
    await this.simulateNetworkDelay();

    if (this.shouldSimulateFailure()) {
      return {
        success: false,
        error: 'Mock push notification failed',
        successCount: 0,
        failureCount: 1,
      };
    }

    return {
      success: true,
      messageId: this.generateId('push'),
      successCount: 1,
      failureCount: 0,
    };
  }

  async sendBulkNotifications(
    notifications: any[]
  ): Promise<NotificationResult> {
    await this.simulateNetworkDelay();

    const successCount = this.shouldSimulateFailure()
      ? Math.floor(notifications.length * 0.8)
      : notifications.length;
    const failureCount = notifications.length - successCount;

    return {
      success: failureCount === 0,
      messageId: this.generateId('bulk_push'),
      successCount,
      failureCount,
    };
  }

  async sendTemplatedNotification(): Promise<NotificationResult> {
    await this.simulateNetworkDelay();
    return {
      success: true,
      messageId: this.generateId('template_push'),
      successCount: 1,
      failureCount: 0,
    };
  }

  async scheduleNotification(): Promise<any> {
    await this.simulateNetworkDelay();
    return {
      id: this.generateId('scheduled'),
      status: 'pending',
      scheduledTime: new Date(),
      createdAt: new Date(),
    };
  }

  async cancelScheduledNotification(): Promise<boolean> {
    await this.simulateNetworkDelay();
    return !this.shouldSimulateFailure();
  }

  async subscribeToTopic(): Promise<boolean> {
    await this.simulateNetworkDelay();
    return !this.shouldSimulateFailure();
  }

  async unsubscribeFromTopic(): Promise<boolean> {
    await this.simulateNetworkDelay();
    return !this.shouldSimulateFailure();
  }

  async validateRegistrationToken(): Promise<boolean> {
    await this.simulateNetworkDelay();
    return !this.shouldSimulateFailure();
  }

  async getNotificationStats(): Promise<any> {
    return {
      sent: 150,
      delivered: 145,
      opened: 75,
      failed: 5,
      clickThroughRate: 0.52,
      deliveryRate: 0.97,
    };
  }

  async createNotificationTemplate(): Promise<any> {
    await this.simulateNetworkDelay();
    return {
      id: this.generateId('template'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateNotificationTemplate(): Promise<any> {
    await this.simulateNetworkDelay();
    return { id: this.generateId('template'), updatedAt: new Date() };
  }

  async deleteNotificationTemplate(): Promise<boolean> {
    await this.simulateNetworkDelay();
    return !this.shouldSimulateFailure();
  }

  async listNotificationTemplates(): Promise<any[]> {
    await this.simulateNetworkDelay();
    return [
      {
        id: 'template_1',
        name: 'Match Reminder',
        title: 'Match starting soon!',
      },
    ];
  }
}

/**
 * Mock Storage Provider
 */
export class MockStorageProvider
  extends MockService
  implements StorageProvider
{
  async initialize(): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockStorage] Initialized');
  }

  async uploadFile(file: any, options: any = {}): Promise<UploadResult> {
    await this.simulateNetworkDelay();

    if (this.shouldSimulateFailure()) {
      return {
        success: false,
        error: 'Mock upload failed',
      };
    }

    const storageFile: StorageFile = {
      id: this.generateId('file'),
      filename: options.filename || 'mock_file.jpg',
      originalName: options.originalName || 'mock_file.jpg',
      size: 1024 * 500, // 500KB
      mimeType: 'image/jpeg',
      url: `https://mock-cdn.com/${this.generateId('file')}.jpg`,
      uploadedAt: new Date(),
    };

    return {
      success: true,
      file: storageFile,
      uploadId: storageFile.id,
    };
  }

  async uploadMultipleFiles(files: any[], options: any = {}): Promise<any> {
    await this.simulateNetworkDelay();

    const results = files.map(() => ({
      success: !this.shouldSimulateFailure(),
      file: {
        id: this.generateId('file'),
        filename: 'mock_file.jpg',
        originalName: 'mock_file.jpg',
        size: 1024 * 300,
        mimeType: 'image/jpeg',
        url: `https://mock-cdn.com/${this.generateId('file')}.jpg`,
        uploadedAt: new Date(),
      },
    }));

    return {
      success: results.every(r => r.success),
      results,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
    };
  }

  async uploadFromUrl(): Promise<UploadResult> {
    return this.uploadFile(null, { filename: 'url_upload.jpg' });
  }

  async deleteFile(): Promise<boolean> {
    await this.simulateNetworkDelay();
    return !this.shouldSimulateFailure();
  }

  async deleteMultipleFiles(fileIds: string[]): Promise<boolean[]> {
    await this.simulateNetworkDelay();
    return fileIds.map(() => !this.shouldSimulateFailure());
  }

  async getFile(fileId: string): Promise<StorageFile | null> {
    await this.simulateNetworkDelay();

    if (this.shouldSimulateFailure()) return null;

    return {
      id: fileId,
      filename: 'mock_file.jpg',
      originalName: 'mock_file.jpg',
      size: 1024 * 400,
      mimeType: 'image/jpeg',
      url: `https://mock-cdn.com/${fileId}.jpg`,
      uploadedAt: new Date(),
    };
  }

  async listFiles(): Promise<any> {
    await this.simulateNetworkDelay();

    return {
      files: [
        {
          id: 'file_1',
          filename: 'mock_1.jpg',
          originalName: 'mock_1.jpg',
          size: 1024 * 300,
          mimeType: 'image/jpeg',
          url: 'https://mock-cdn.com/file_1.jpg',
          uploadedAt: new Date(),
        },
      ],
      hasMore: false,
    };
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    await this.simulateNetworkDelay();
    return `https://mock-cdn.com/download/${fileId}`;
  }

  async generateThumbnail(): Promise<string> {
    await this.simulateNetworkDelay();
    return `https://mock-cdn.com/thumb/${this.generateId('thumb')}.jpg`;
  }

  async searchFiles(): Promise<StorageFile[]> {
    await this.simulateNetworkDelay();
    return [];
  }

  async getStorageStats(): Promise<any> {
    return {
      totalFiles: 1250,
      totalSize: 1024 * 1024 * 750, // 750MB
      usedBandwidth: 1024 * 1024 * 1024 * 5, // 5GB
    };
  }

  async createUploadSignature(): Promise<any> {
    await this.simulateNetworkDelay();
    return {
      signature: this.generateId('sig'),
      timestamp: Date.now(),
      apiKey: 'mock_api_key',
      uploadUrl: 'https://mock-upload.com/upload',
    };
  }
}

/**
 * Mock Analytics Provider
 */
export class MockAnalyticsProvider
  extends MockService
  implements AnalyticsProvider
{
  async initialize(): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockAnalytics] Initialized');
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockAnalytics] Event tracked:', event.name);
  }

  async trackScreenView(): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockAnalytics] Screen view tracked');
  }

  async trackConversion(): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockAnalytics] Conversion tracked');
  }

  async setUserId(userId: string): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockAnalytics] User ID set:', userId);
  }

  async setUserProperties(): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockAnalytics] User properties set');
  }

  async trackFunnelStep(): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockAnalytics] Funnel step tracked');
  }

  async flush(): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockAnalytics] Events flushed');
  }

  async reset(): Promise<void> {
    await this.simulateNetworkDelay();
    console.log('[MockAnalytics] Analytics reset');
  }
}

/**
 * Mock Social Auth Provider
 */
export class MockSocialAuthProvider
  extends MockService
  implements SocialAuthProvider
{
  getAuthorizationUrl(state: string): string {
    return `https://mock-auth.com/oauth/authorize?state=${state}`;
  }

  async exchangeCodeForTokens(code: string): Promise<AuthCredentials> {
    await this.simulateNetworkDelay();

    if (this.shouldSimulateFailure()) {
      throw new Error('Mock token exchange failed');
    }

    return {
      accessToken: this.generateId('access'),
      refreshToken: this.generateId('refresh'),
      idToken: this.generateId('id'),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    };
  }

  async getUserInfo(): Promise<any> {
    await this.simulateNetworkDelay();

    return {
      id: this.generateId('user'),
      email: 'mock@example.com',
      name: 'Mock User',
      firstName: 'Mock',
      lastName: 'User',
      profilePicture: 'https://mock-cdn.com/avatar.jpg',
      isVerified: true,
      provider: 'mock',
      providerId: this.generateId('provider'),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthCredentials> {
    await this.simulateNetworkDelay();
    return {
      accessToken: this.generateId('access'),
      refreshToken,
      expiresAt: new Date(Date.now() + 3600000),
    };
  }

  async revokeAccess(): Promise<boolean> {
    await this.simulateNetworkDelay();
    return !this.shouldSimulateFailure();
  }

  async validateToken(): Promise<boolean> {
    await this.simulateNetworkDelay();
    return !this.shouldSimulateFailure();
  }
}

/**
 * Mock Service Factory
 */
export class MockServiceFactory {
  static createMockServices(config: MockConfig = {}): {
    paymentGateway: MockPaymentGateway;
    smsProvider: MockSMSProvider;
    emailProvider: MockEmailProvider;
    pushService: MockPushNotificationService;
    storageProvider: MockStorageProvider;
    analyticsProvider: MockAnalyticsProvider;
    authProvider: MockSocialAuthProvider;
  } {
    return {
      paymentGateway: new MockPaymentGateway(config),
      smsProvider: new MockSMSProvider(config),
      emailProvider: new MockEmailProvider(config),
      pushService: new MockPushNotificationService(config),
      storageProvider: new MockStorageProvider(config),
      analyticsProvider: new MockAnalyticsProvider(config),
      authProvider: new MockSocialAuthProvider(config),
    };
  }

  static createReliableMocks(): ReturnType<
    typeof MockServiceFactory.createMockServices
  > {
    return MockServiceFactory.createMockServices({
      delayMs: 50,
      failureRate: 0,
      networkLatency: 25,
      enableRandomFailures: false,
    });
  }

  static createUnreliableMocks(): ReturnType<
    typeof MockServiceFactory.createMockServices
  > {
    return MockServiceFactory.createMockServices({
      delayMs: 200,
      failureRate: 0.1, // 10% failure rate
      networkLatency: 100,
      enableRandomFailures: true,
    });
  }

  static createSlowMocks(): ReturnType<
    typeof MockServiceFactory.createMockServices
  > {
    return MockServiceFactory.createMockServices({
      delayMs: 1000,
      failureRate: 0.05,
      networkLatency: 500,
      enableRandomFailures: false,
    });
  }
}

/**
 * Test fixtures and data
 */
export const TestFixtures = {
  // Payment fixtures
  payment: {
    validCustomer: (): PaymentCustomer => ({
      id: 'cust_test_123',
      name: 'Test User',
      email: 'test@example.com',
      phone: '+919876543210',
    }),

    validAmount: (): PaymentAmount => ({
      value: 1000, // ₹10.00
      currency: 'INR',
    }),

    validPaymentIntent: (): PaymentIntent => ({
      id: 'pi_test_123',
      amount: TestFixtures.payment.validAmount(),
      customer: TestFixtures.payment.validCustomer(),
      description: 'Test tournament registration',
      metadata: { tournamentId: 'tournament_123' },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  },

  // Email fixtures
  email: {
    validMessage: (): EmailMessage => ({
      from: { email: 'noreply@protour.com', name: 'ProTour' },
      to: [{ email: 'user@example.com', name: 'Test User' }],
      subject: 'Test Email',
      html: '<p>This is a test email</p>',
      text: 'This is a test email',
    }),

    templateData: () => ({
      templateId: 'template_123',
      variables: { userName: 'Test User', tournamentName: 'Test Tournament' },
      to: [{ email: 'user@example.com', name: 'Test User' }],
    }),
  },

  // SMS fixtures
  sms: {
    validMessage: (): SMSMessage => ({
      to: '+919876543210',
      body: 'Your tournament registration is confirmed!',
      from: 'PROTOUR',
    }),
  },

  // Push notification fixtures
  push: {
    validPayload: (): PushNotificationPayload => ({
      title: 'Match Starting Soon!',
      body: 'Your tournament match starts in 5 minutes',
      data: { tournamentId: 'tournament_123', matchId: 'match_456' },
      imageUrl: 'https://example.com/tournament-image.jpg',
    }),

    validTarget: (): NotificationTarget => ({
      type: 'token',
      value: 'mock_fcm_token_123',
      platform: 'all',
    }),
  },

  // Storage fixtures
  storage: {
    mockFile: (): StorageFile => ({
      id: 'file_test_123',
      filename: 'tournament_logo.jpg',
      originalName: 'tournament_logo.jpg',
      size: 1024 * 250, // 250KB
      mimeType: 'image/jpeg',
      url: 'https://cdn.protour.com/tournament_logo.jpg',
      uploadedAt: new Date(),
    }),
  },

  // Analytics fixtures
  analytics: {
    validEvent: (): AnalyticsEvent => ({
      name: 'tournament_joined',
      parameters: {
        tournamentId: 'tournament_123',
        tournamentName: 'Test Tournament',
        userRole: 'player',
      },
      value: 1,
    }),
  },

  // Auth fixtures
  auth: {
    validCredentials: (): AuthCredentials => ({
      accessToken: 'mock_access_token_123',
      refreshToken: 'mock_refresh_token_123',
      idToken: 'mock_id_token_123',
      expiresAt: new Date(Date.now() + 3600000),
    }),

    validUser: () => ({
      id: 'user_test_123',
      email: 'test@example.com',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      profilePicture: 'https://example.com/avatar.jpg',
      isVerified: true,
      provider: 'google',
      providerId: 'google_user_123',
    }),
  },
};

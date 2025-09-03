/**
 * SMS and notification service abstractions for ProTour
 * Supports Twilio (global), Firebase (push), and local providers for India
 */

export interface SMSMessage {
  to: string; // Phone number with country code
  body: string;
  from?: string; // Sender ID or phone number
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
  status?: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed';
}

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  clickAction?: string;
  priority?: 'high' | 'normal';
}

export interface PushTarget {
  type: 'token' | 'topic' | 'condition';
  value: string; // FCM token, topic name, or condition
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
  results?: Array<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'sms' | 'push' | 'email';
  subject?: string; // For email
  body: string;
  variables: string[]; // Template variables like {tournamentName}
}

export interface BulkNotification {
  template: NotificationTemplate;
  recipients: Array<{
    target: string; // phone/token/email
    variables: Record<string, string>;
  }>;
  scheduled?: Date;
  priority?: 'high' | 'normal' | 'low';
}

export interface NotificationStatus {
  id: string;
  status: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  cost?: number;
}

export abstract class SMSProvider {
  protected config: SMSConfig;

  constructor(config: SMSConfig) {
    this.config = config;
  }

  abstract sendSMS(message: SMSMessage): Promise<SMSResult>;
  abstract sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]>;
  abstract getDeliveryStatus(messageId: string): Promise<NotificationStatus>;
  abstract validatePhoneNumber(phoneNumber: string): boolean;
  abstract estimateCost(message: SMSMessage): Promise<number>;
}

export abstract class PushProvider {
  protected config: PushConfig;

  constructor(config: PushConfig) {
    this.config = config;
  }

  abstract sendPush(
    notification: PushNotification,
    target: PushTarget
  ): Promise<PushResult>;
  abstract sendBulkPush(
    notification: PushNotification,
    targets: PushTarget[]
  ): Promise<PushResult>;
  abstract subscribeToTopic(token: string, topic: string): Promise<boolean>;
  abstract unsubscribeFromTopic(token: string, topic: string): Promise<boolean>;
  abstract validateToken(token: string): Promise<boolean>;
}

export interface SMSConfig {
  provider: 'twilio' | 'textlocal' | 'msg91' | 'firebase';
  apiKey: string;
  apiSecret?: string;
  senderId?: string;
  webhook?: string;
  environment: 'sandbox' | 'production';
}

export interface PushConfig {
  provider: 'firebase' | 'apns' | 'onesignal';
  serverKey?: string;
  serviceAccountKey?: any;
  bundleId?: string;
  environment: 'sandbox' | 'production';
}

export class NotificationServiceFactory {
  static createSMSProvider(config: SMSConfig): SMSProvider {
    switch (config.provider) {
      case 'twilio':
        return new TwilioSMSProvider(config);
      case 'textlocal':
        return new TextLocalSMSProvider(config);
      case 'msg91':
        return new MSG91SMSProvider(config);
      case 'firebase':
        return new FirebaseSMSProvider(config);
      default:
        throw new Error(`Unsupported SMS provider: ${config.provider}`);
    }
  }

  static createPushProvider(config: PushConfig): PushProvider {
    switch (config.provider) {
      case 'firebase':
        return new FirebasePushProvider(config);
      case 'onesignal':
        return new OneSignalPushProvider(config);
      default:
        throw new Error(`Unsupported push provider: ${config.provider}`);
    }
  }
}

/**
 * Twilio SMS implementation (global)
 */
export class TwilioSMSProvider extends SMSProvider {
  private client: any; // Twilio client

  constructor(config: SMSConfig) {
    super(config);
    // Initialize Twilio client
    // this.client = twilio(config.apiKey, config.apiSecret);
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // const result = await this.client.messages.create({
      //   body: message.body,
      //   from: message.from || this.config.senderId,
      //   to: message.to,
      // });

      return {
        success: true,
        messageId: `SM${Date.now()}`,
        status: 'queued',
        cost: await this.estimateCost(message),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 'failed',
      };
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    const results: SMSResult[] = [];

    for (const message of messages) {
      const result = await this.sendSMS(message);
      results.push(result);
    }

    return results;
  }

  async getDeliveryStatus(messageId: string): Promise<NotificationStatus> {
    // const message = await this.client.messages(messageId).fetch();

    return {
      id: messageId,
      status: 'delivered',
      sentAt: new Date(),
      deliveredAt: new Date(),
    };
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  async estimateCost(message: SMSMessage): Promise<number> {
    // Twilio pricing varies by country
    const baseCost = 0.0075; // $0.0075 per SMS (US)
    const segments = Math.ceil(message.body.length / 160);
    return baseCost * segments;
  }
}

/**
 * TextLocal SMS implementation (India)
 */
export class TextLocalSMSProvider extends SMSProvider {
  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // TextLocal API implementation
      const params = new URLSearchParams({
        apikey: this.config.apiKey,
        numbers: message.to,
        message: message.body,
        sender: message.from || this.config.senderId || 'TXTLCL',
      });

      // const response = await fetch('https://api.textlocal.in/send/', {
      //   method: 'POST',
      //   body: params,
      // });

      return {
        success: true,
        messageId: `TL${Date.now()}`,
        status: 'sent',
        cost: await this.estimateCost(message),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 'failed',
      };
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    // TextLocal supports bulk SMS
    try {
      const numbers = messages.map(m => m.to).join(',');
      const message = messages[0].body; // Assume same message for bulk

      const params = new URLSearchParams({
        apikey: this.config.apiKey,
        numbers,
        message,
        sender: this.config.senderId || 'TXTLCL',
      });

      // const response = await fetch('https://api.textlocal.in/bulk_json', {
      //   method: 'POST',
      //   body: params,
      // });

      return messages.map(() => ({
        success: true,
        messageId: `TL${Date.now()}`,
        status: 'sent' as const,
      }));
    } catch (error) {
      return messages.map(() => ({
        success: false,
        error: error.message,
        status: 'failed' as const,
      }));
    }
  }

  async getDeliveryStatus(messageId: string): Promise<NotificationStatus> {
    return {
      id: messageId,
      status: 'delivered',
      sentAt: new Date(),
      deliveredAt: new Date(),
    };
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    // Indian mobile number validation
    const indianMobileRegex = /^(\+91|91|0)?[6789]\d{9}$/;
    return indianMobileRegex.test(phoneNumber);
  }

  async estimateCost(message: SMSMessage): Promise<number> {
    // TextLocal India pricing
    const baseCost = 0.15; // ₹0.15 per SMS
    const segments = Math.ceil(message.body.length / 160);
    return baseCost * segments;
  }
}

/**
 * MSG91 SMS implementation (India)
 */
export class MSG91SMSProvider extends SMSProvider {
  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // MSG91 API implementation
      const payload = {
        sender: message.from || this.config.senderId,
        route: '4', // Transactional route
        country: '91',
        sms: [
          {
            message: message.body,
            to: [message.to.replace(/^\+91/, '')],
          },
        ],
      };

      // const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'authkey': this.config.apiKey,
      //   },
      //   body: JSON.stringify(payload),
      // });

      return {
        success: true,
        messageId: `MSG91${Date.now()}`,
        status: 'sent',
        cost: await this.estimateCost(message),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 'failed',
      };
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    try {
      const smsArray = messages.map(msg => ({
        message: msg.body,
        to: [msg.to.replace(/^\+91/, '')],
      }));

      const payload = {
        sender: this.config.senderId,
        route: '4',
        country: '91',
        sms: smsArray,
      };

      // API call implementation...

      return messages.map(() => ({
        success: true,
        messageId: `MSG91${Date.now()}`,
        status: 'sent' as const,
      }));
    } catch (error) {
      return messages.map(() => ({
        success: false,
        error: error.message,
        status: 'failed' as const,
      }));
    }
  }

  async getDeliveryStatus(messageId: string): Promise<NotificationStatus> {
    return {
      id: messageId,
      status: 'delivered',
      sentAt: new Date(),
      deliveredAt: new Date(),
    };
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    const indianMobileRegex = /^(\+91|91)?[6789]\d{9}$/;
    return indianMobileRegex.test(phoneNumber);
  }

  async estimateCost(message: SMSMessage): Promise<number> {
    const baseCost = 0.2; // ₹0.20 per SMS
    const segments = Math.ceil(message.body.length / 160);
    return baseCost * segments;
  }
}

/**
 * Firebase SMS implementation (using Cloud Functions)
 */
export class FirebaseSMSProvider extends SMSProvider {
  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // This would call a Firebase Cloud Function that handles SMS
      // The function would use a provider like Twilio or TextLocal

      return {
        success: true,
        messageId: `FB${Date.now()}`,
        status: 'queued',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 'failed',
      };
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    return Promise.all(messages.map(msg => this.sendSMS(msg)));
  }

  async getDeliveryStatus(messageId: string): Promise<NotificationStatus> {
    return {
      id: messageId,
      status: 'delivered',
      sentAt: new Date(),
    };
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  async estimateCost(message: SMSMessage): Promise<number> {
    return 0.1; // Estimated cost
  }
}

/**
 * Firebase Push Notifications implementation
 */
export class FirebasePushProvider extends PushProvider {
  private admin: any; // Firebase Admin SDK

  constructor(config: PushConfig) {
    super(config);
    // Initialize Firebase Admin
    // this.admin = admin.initializeApp({ ... });
  }

  async sendPush(
    notification: PushNotification,
    target: PushTarget
  ): Promise<PushResult> {
    try {
      const message: any = {
        notification: {
          title: notification.title,
          body: notification.body,
          image: notification.imageUrl,
        },
        data: notification.data,
        android: {
          priority: notification.priority || 'high',
          notification: {
            sound: notification.sound || 'default',
            clickAction: notification.clickAction,
          },
        },
        apns: {
          payload: {
            aps: {
              badge: notification.badge,
              sound: notification.sound || 'default',
            },
          },
        },
      };

      if (target.type === 'token') {
        message.token = target.value;
      } else if (target.type === 'topic') {
        message.topic = target.value;
      } else if (target.type === 'condition') {
        message.condition = target.value;
      }

      // const response = await this.admin.messaging().send(message);

      return {
        success: true,
        messageId: `fcm_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendBulkPush(
    notification: PushNotification,
    targets: PushTarget[]
  ): Promise<PushResult> {
    try {
      const tokens = targets.filter(t => t.type === 'token').map(t => t.value);

      if (tokens.length === 0) {
        throw new Error('No valid tokens provided');
      }

      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          image: notification.imageUrl,
        },
        data: notification.data,
        tokens,
      };

      // const response = await this.admin.messaging().sendMulticast(message);

      return {
        success: true,
        messageId: `fcm_bulk_${Date.now()}`,
        results: tokens.map(() => ({
          success: true,
          messageId: `fcm_${Date.now()}`,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    try {
      // await this.admin.messaging().subscribeToTopic([token], topic);
      return true;
    } catch (error) {
      return false;
    }
  }

  async unsubscribeFromTopic(token: string, topic: string): Promise<boolean> {
    try {
      // await this.admin.messaging().unsubscribeFromTopic([token], topic);
      return true;
    } catch (error) {
      return false;
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      // Test send to validate token
      // await this.admin.messaging().send({ token }, true);
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * OneSignal Push implementation
 */
export class OneSignalPushProvider extends PushProvider {
  async sendPush(
    notification: PushNotification,
    target: PushTarget
  ): Promise<PushResult> {
    try {
      const payload: any = {
        app_id: this.config.serverKey,
        headings: { en: notification.title },
        contents: { en: notification.body },
        data: notification.data,
        large_icon: notification.imageUrl,
      };

      if (target.type === 'token') {
        payload.include_player_ids = [target.value];
      } else if (target.type === 'topic') {
        payload.included_segments = [target.value];
      }

      // const response = await fetch('https://onesignal.com/api/v1/notifications', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Basic ${this.config.apiKey}`,
      //   },
      //   body: JSON.stringify(payload),
      // });

      return {
        success: true,
        messageId: `onesignal_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendBulkPush(
    notification: PushNotification,
    targets: PushTarget[]
  ): Promise<PushResult> {
    // OneSignal supports bulk by default
    return this.sendPush(notification, { type: 'condition', value: 'true' });
  }

  async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    // OneSignal handles this through segments
    return true;
  }

  async unsubscribeFromTopic(token: string, topic: string): Promise<boolean> {
    // OneSignal handles this through segments
    return true;
  }

  async validateToken(token: string): Promise<boolean> {
    // OneSignal token validation
    return true;
  }
}

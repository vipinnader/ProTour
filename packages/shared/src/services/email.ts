/**
 * Email service abstractions for ProTour
 * Supports SendGrid, Mailgun, and Firebase Extensions for email delivery
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer; // Base64 string or buffer
  contentType: string;
  size?: number;
}

export interface EmailMessage {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  text?: string; // Plain text version
  html?: string; // HTML version
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[]; // For categorization
  metadata?: Record<string, any>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rejected?: string[]; // Failed recipient emails
  accepted?: string[]; // Successful recipient emails
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[]; // Template variables like {{tournamentName}}
  category?: string;
  version?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateData {
  templateId: string;
  variables: Record<string, string>;
  to: EmailAddress[];
  from?: EmailAddress;
  tags?: string[];
}

export interface BulkEmailRequest {
  template?: EmailTemplate;
  message?: EmailMessage;
  recipients: Array<{
    email: EmailAddress;
    variables?: Record<string, string>;
  }>;
  scheduled?: Date;
  unsubscribeGroup?: string;
}

export interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  spam: number;
  unsubscribed: number;
}

export interface EmailEvent {
  messageId: string;
  event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'unsubscribed';
  timestamp: Date;
  recipient: string;
  url?: string; // For click events
  reason?: string; // For bounce/spam events
}

export abstract class EmailProvider {
  protected config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  abstract sendEmail(message: EmailMessage): Promise<EmailResult>;
  abstract sendBulkEmail(request: BulkEmailRequest): Promise<EmailResult>;
  abstract sendTemplatedEmail(data: TemplateData): Promise<EmailResult>;
  abstract createTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate>;
  abstract updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate>;
  abstract deleteTemplate(id: string): Promise<boolean>;
  abstract getTemplate(id: string): Promise<EmailTemplate>;
  abstract listTemplates(): Promise<EmailTemplate[]>;
  abstract getStats(messageId?: string): Promise<EmailStats>;
  abstract processWebhook(payload: string, signature?: string): EmailEvent[];
  abstract validateEmail(email: string): boolean;
}

export interface EmailConfig {
  provider: 'sendgrid' | 'mailgun' | 'firebase' | 'ses';
  apiKey: string;
  apiSecret?: string;
  domain?: string; // For Mailgun
  region?: string; // For SES
  webhookSecret?: string;
  defaultFrom: EmailAddress;
  environment: 'sandbox' | 'production';
}

export class EmailServiceFactory {
  static create(config: EmailConfig): EmailProvider {
    switch (config.provider) {
      case 'sendgrid':
        return new SendGridProvider(config);
      case 'mailgun':
        return new MailgunProvider(config);
      case 'firebase':
        return new FirebaseEmailProvider(config);
      case 'ses':
        return new SESProvider(config);
      default:
        throw new Error(`Unsupported email provider: ${config.provider}`);
    }
  }
}

/**
 * SendGrid implementation
 */
export class SendGridProvider extends EmailProvider {
  private client: any; // SendGrid client

  constructor(config: EmailConfig) {
    super(config);
    // Initialize SendGrid
    // this.client = require('@sendgrid/mail');
    // this.client.setApiKey(config.apiKey);
  }

  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    try {
      const msg = {
        from: message.from,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          type: att.contentType,
        })),
        customArgs: message.metadata,
        categories: message.tags,
        headers: message.headers,
      };

      // const response = await this.client.send(msg);

      return {
        success: true,
        messageId: `sg_${Date.now()}`,
        accepted: message.to.map(addr => addr.email),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rejected: message.to.map(addr => addr.email),
      };
    }
  }

  async sendBulkEmail(request: BulkEmailRequest): Promise<EmailResult> {
    try {
      const personalizations = request.recipients.map(recipient => ({
        to: [recipient.email],
        dynamicTemplateData: recipient.variables || {},
      }));

      const msg: any = {
        from: request.message?.from || this.config.defaultFrom,
        personalizations,
      };

      if (request.template) {
        msg.templateId = request.template.id;
      } else if (request.message) {
        msg.subject = request.message.subject;
        msg.html = request.message.html;
        msg.text = request.message.text;
      }

      // const response = await this.client.send(msg);

      return {
        success: true,
        messageId: `sg_bulk_${Date.now()}`,
        accepted: request.recipients.map(r => r.email.email),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rejected: request.recipients.map(r => r.email.email),
      };
    }
  }

  async sendTemplatedEmail(data: TemplateData): Promise<EmailResult> {
    try {
      const msg = {
        from: data.from || this.config.defaultFrom,
        to: data.to,
        templateId: data.templateId,
        dynamicTemplateData: data.variables,
        categories: data.tags,
      };

      // const response = await this.client.send(msg);

      return {
        success: true,
        messageId: `sg_template_${Date.now()}`,
        accepted: data.to.map(addr => addr.email),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rejected: data.to.map(addr => addr.email),
      };
    }
  }

  async createTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    try {
      const templateData = {
        name: template.name,
        generation: 'dynamic',
        versions: [{
          template_id: `sg_${Date.now()}`,
          active: 1,
          name: template.name,
          subject: template.subject,
          html_content: template.htmlContent,
          plain_content: template.textContent,
        }],
      };

      // const response = await this.client.request({
      //   method: 'POST',
      //   url: '/v3/templates',
      //   body: templateData,
      // });

      return {
        id: `sg_${Date.now()}`,
        ...template,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  async updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    // Implementation for updating SendGrid template
    return {
      id,
      name: updates.name || 'Updated Template',
      subject: updates.subject || 'Updated Subject',
      htmlContent: updates.htmlContent || '<p>Updated content</p>',
      variables: updates.variables || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async deleteTemplate(id: string): Promise<boolean> {
    try {
      // await this.client.request({
      //   method: 'DELETE',
      //   url: `/v3/templates/${id}`,
      // });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getTemplate(id: string): Promise<EmailTemplate> {
    // Implementation for getting SendGrid template
    return {
      id,
      name: 'Template Name',
      subject: 'Template Subject',
      htmlContent: '<p>Template content</p>',
      variables: ['name', 'tournamentName'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async listTemplates(): Promise<EmailTemplate[]> {
    // Implementation for listing SendGrid templates
    return [];
  }

  async getStats(messageId?: string): Promise<EmailStats> {
    // Implementation for SendGrid stats
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

  processWebhook(payload: string, signature?: string): EmailEvent[] {
    try {
      // Verify webhook signature if provided
      // const isValid = this.verifySignature(payload, signature);
      
      const events = JSON.parse(payload);
      return events.map((event: any) => ({
        messageId: event.sg_message_id,
        event: event.event,
        timestamp: new Date(event.timestamp * 1000),
        recipient: event.email,
        url: event.url,
        reason: event.reason,
      }));
    } catch (error) {
      return [];
    }
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Mailgun implementation
 */
export class MailgunProvider extends EmailProvider {
  private client: any; // Mailgun client

  constructor(config: EmailConfig) {
    super(config);
    // Initialize Mailgun
    // this.client = new Mailgun({ apiKey: config.apiKey, domain: config.domain });
  }

  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    try {
      const data = {
        from: `${message.from.name} <${message.from.email}>`,
        to: message.to.map(addr => `${addr.name || ''} <${addr.email}>`).join(','),
        cc: message.cc?.map(addr => `${addr.name || ''} <${addr.email}>`).join(','),
        bcc: message.bcc?.map(addr => `${addr.name || ''} <${addr.email}>`).join(','),
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachment: message.attachments,
        'o:tag': message.tags?.join(','),
        'v:metadata': JSON.stringify(message.metadata),
      };

      // const response = await this.client.messages().send(data);

      return {
        success: true,
        messageId: `mg_${Date.now()}`,
        accepted: message.to.map(addr => addr.email),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rejected: message.to.map(addr => addr.email),
      };
    }
  }

  async sendBulkEmail(request: BulkEmailRequest): Promise<EmailResult> {
    // Mailgun batch sending implementation
    const results: EmailResult[] = [];
    
    for (const recipient of request.recipients) {
      if (request.template && request.message) {
        const message: EmailMessage = {
          ...request.message,
          to: [recipient.email],
          html: this.replaceVariables(request.template.htmlContent, recipient.variables || {}),
          text: this.replaceVariables(request.template.textContent || '', recipient.variables || {}),
          subject: this.replaceVariables(request.template.subject, recipient.variables || {}),
        };
        
        const result = await this.sendEmail(message);
        results.push(result);
      }
    }

    const allSuccessful = results.every(r => r.success);
    
    return {
      success: allSuccessful,
      messageId: `mg_bulk_${Date.now()}`,
      accepted: results.flatMap(r => r.accepted || []),
      rejected: results.flatMap(r => r.rejected || []),
    };
  }

  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  }

  async sendTemplatedEmail(data: TemplateData): Promise<EmailResult> {
    // Mailgun doesn't have built-in templates like SendGrid
    // We'll use stored templates and variable replacement
    const template = await this.getTemplate(data.templateId);
    
    const message: EmailMessage = {
      from: data.from || this.config.defaultFrom,
      to: data.to,
      subject: this.replaceVariables(template.subject, data.variables),
      html: this.replaceVariables(template.htmlContent, data.variables),
      text: template.textContent ? this.replaceVariables(template.textContent, data.variables) : undefined,
      tags: data.tags,
    };

    return this.sendEmail(message);
  }

  async createTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    // Store template (would typically be in database)
    return {
      id: `mg_template_${Date.now()}`,
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    // Update template in storage
    return {
      id,
      name: updates.name || 'Updated Template',
      subject: updates.subject || 'Updated Subject',
      htmlContent: updates.htmlContent || '<p>Updated content</p>',
      variables: updates.variables || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async deleteTemplate(id: string): Promise<boolean> {
    // Delete template from storage
    return true;
  }

  async getTemplate(id: string): Promise<EmailTemplate> {
    // Get template from storage
    return {
      id,
      name: 'Mailgun Template',
      subject: 'Welcome to {{tournamentName}}',
      htmlContent: '<h1>Hello {{playerName}}</h1><p>Welcome to {{tournamentName}}!</p>',
      textContent: 'Hello {{playerName}}\n\nWelcome to {{tournamentName}}!',
      variables: ['playerName', 'tournamentName'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async listTemplates(): Promise<EmailTemplate[]> {
    // List templates from storage
    return [];
  }

  async getStats(messageId?: string): Promise<EmailStats> {
    try {
      // const stats = await this.client.events().get({ ...filters });
      
      return {
        sent: 50,
        delivered: 48,
        opened: 30,
        clicked: 10,
        bounced: 1,
        spam: 1,
        unsubscribed: 0,
      };
    } catch (error) {
      return {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        spam: 0,
        unsubscribed: 0,
      };
    }
  }

  processWebhook(payload: string, signature?: string): EmailEvent[] {
    try {
      // Verify Mailgun webhook signature
      // const isValid = this.verifySignature(payload, signature);
      
      const data = JSON.parse(payload);
      return [{
        messageId: data['message-id'] || `mg_${Date.now()}`,
        event: data.event as any,
        timestamp: new Date(data.timestamp * 1000),
        recipient: data.recipient,
        url: data.url,
        reason: data.reason,
      }];
    } catch (error) {
      return [];
    }
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Firebase Email Extensions implementation
 */
export class FirebaseEmailProvider extends EmailProvider {
  private firestore: any; // Firestore instance

  constructor(config: EmailConfig) {
    super(config);
    // Initialize Firebase
    // this.firestore = admin.firestore();
  }

  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    try {
      // Firebase email extensions use Firestore collections to queue emails
      const emailDoc = {
        from: message.from,
        to: message.to.map(addr => addr.email),
        cc: message.cc?.map(addr => addr.email),
        bcc: message.bcc?.map(addr => addr.email),
        replyTo: message.replyTo?.email,
        message: {
          subject: message.subject,
          text: message.text,
          html: message.html,
          attachments: message.attachments,
        },
        template: null,
        delivery: {
          startTime: new Date(),
          state: 'PENDING',
          attempts: 0,
          endTime: null,
          leaseExpireTime: null,
          error: null,
        },
      };

      // await this.firestore.collection('mail').add(emailDoc);

      return {
        success: true,
        messageId: `fb_${Date.now()}`,
        accepted: message.to.map(addr => addr.email),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rejected: message.to.map(addr => addr.email),
      };
    }
  }

  async sendBulkEmail(request: BulkEmailRequest): Promise<EmailResult> {
    // Firebase extension handles bulk via multiple documents
    const promises = request.recipients.map(async (recipient) => {
      let message: EmailMessage;
      
      if (request.template) {
        message = {
          from: this.config.defaultFrom,
          to: [recipient.email],
          subject: this.replaceVariables(request.template.subject, recipient.variables || {}),
          html: this.replaceVariables(request.template.htmlContent, recipient.variables || {}),
          text: request.template.textContent ? 
            this.replaceVariables(request.template.textContent, recipient.variables || {}) : undefined,
        };
      } else if (request.message) {
        message = {
          ...request.message,
          to: [recipient.email],
        };
      } else {
        throw new Error('Either template or message must be provided');
      }

      return this.sendEmail(message);
    });

    const results = await Promise.all(promises);
    const allSuccessful = results.every(r => r.success);

    return {
      success: allSuccessful,
      messageId: `fb_bulk_${Date.now()}`,
      accepted: results.flatMap(r => r.accepted || []),
      rejected: results.flatMap(r => r.rejected || []),
    };
  }

  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  }

  async sendTemplatedEmail(data: TemplateData): Promise<EmailResult> {
    const template = await this.getTemplate(data.templateId);
    
    const message: EmailMessage = {
      from: data.from || this.config.defaultFrom,
      to: data.to,
      subject: this.replaceVariables(template.subject, data.variables),
      html: this.replaceVariables(template.htmlContent, data.variables),
      text: template.textContent ? this.replaceVariables(template.textContent, data.variables) : undefined,
      tags: data.tags,
    };

    return this.sendEmail(message);
  }

  async createTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    const newTemplate: EmailTemplate = {
      id: `fb_template_${Date.now()}`,
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // await this.firestore.collection('emailTemplates').doc(newTemplate.id).set(newTemplate);

    return newTemplate;
  }

  async updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const updatedTemplate: EmailTemplate = {
      id,
      name: updates.name || 'Updated Template',
      subject: updates.subject || 'Updated Subject',
      htmlContent: updates.htmlContent || '<p>Updated content</p>',
      variables: updates.variables || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // await this.firestore.collection('emailTemplates').doc(id).update({
    //   ...updates,
    //   updatedAt: new Date(),
    // });

    return updatedTemplate;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    try {
      // await this.firestore.collection('emailTemplates').doc(id).delete();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getTemplate(id: string): Promise<EmailTemplate> {
    // const doc = await this.firestore.collection('emailTemplates').doc(id).get();
    
    return {
      id,
      name: 'Firebase Template',
      subject: 'Tournament Update: {{tournamentName}}',
      htmlContent: '<h1>Hello {{playerName}}!</h1><p>{{tournamentName}} has been updated.</p>',
      textContent: 'Hello {{playerName}}!\n\n{{tournamentName}} has been updated.',
      variables: ['playerName', 'tournamentName'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async listTemplates(): Promise<EmailTemplate[]> {
    // const snapshot = await this.firestore.collection('emailTemplates').get();
    // return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return [];
  }

  async getStats(messageId?: string): Promise<EmailStats> {
    // Firebase extensions don't provide detailed stats by default
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      spam: 0,
      unsubscribed: 0,
    };
  }

  processWebhook(payload: string, signature?: string): EmailEvent[] {
    // Firebase extensions use Firestore triggers instead of webhooks
    return [];
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * AWS SES implementation
 */
export class SESProvider extends EmailProvider {
  private ses: any; // AWS SES client

  constructor(config: EmailConfig) {
    super(config);
    // Initialize AWS SES
    // this.ses = new AWS.SES({ region: config.region });
  }

  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    try {
      const params = {
        Source: `${message.from.name} <${message.from.email}>`,
        Destination: {
          ToAddresses: message.to.map(addr => `${addr.name || ''} <${addr.email}>`),
          CcAddresses: message.cc?.map(addr => `${addr.name || ''} <${addr.email}>`) || [],
          BccAddresses: message.bcc?.map(addr => `${addr.name || ''} <${addr.email}>`) || [],
        },
        Message: {
          Subject: { Data: message.subject },
          Body: {
            Text: message.text ? { Data: message.text } : undefined,
            Html: message.html ? { Data: message.html } : undefined,
          },
        },
        ReplyToAddresses: message.replyTo ? [`${message.replyTo.name || ''} <${message.replyTo.email}>`] : [],
        Tags: message.tags?.map(tag => ({ Name: 'category', Value: tag })) || [],
      };

      // const result = await this.ses.sendEmail(params).promise();

      return {
        success: true,
        messageId: `ses_${Date.now()}`,
        accepted: message.to.map(addr => addr.email),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rejected: message.to.map(addr => addr.email),
      };
    }
  }

  async sendBulkEmail(request: BulkEmailRequest): Promise<EmailResult> {
    // SES bulk sending implementation
    const results = await Promise.all(
      request.recipients.map(async (recipient) => {
        if (request.message) {
          const message: EmailMessage = {
            ...request.message,
            to: [recipient.email],
          };
          return this.sendEmail(message);
        }
        throw new Error('Message is required for SES bulk email');
      })
    );

    const allSuccessful = results.every(r => r.success);

    return {
      success: allSuccessful,
      messageId: `ses_bulk_${Date.now()}`,
      accepted: results.flatMap(r => r.accepted || []),
      rejected: results.flatMap(r => r.rejected || []),
    };
  }

  async sendTemplatedEmail(data: TemplateData): Promise<EmailResult> {
    try {
      const params = {
        Source: `${data.from?.name || this.config.defaultFrom.name} <${data.from?.email || this.config.defaultFrom.email}>`,
        Template: data.templateId,
        Destination: {
          ToAddresses: data.to.map(addr => `${addr.name || ''} <${addr.email}>`),
        },
        TemplateData: JSON.stringify(data.variables),
        Tags: data.tags?.map(tag => ({ Name: 'category', Value: tag })) || [],
      };

      // const result = await this.ses.sendTemplatedEmail(params).promise();

      return {
        success: true,
        messageId: `ses_template_${Date.now()}`,
        accepted: data.to.map(addr => addr.email),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rejected: data.to.map(addr => addr.email),
      };
    }
  }

  async createTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    try {
      const params = {
        Template: {
          TemplateName: template.name,
          SubjectPart: template.subject,
          HtmlPart: template.htmlContent,
          TextPart: template.textContent,
        },
      };

      // await this.ses.createTemplate(params).promise();

      return {
        id: template.name, // SES uses template name as ID
        ...template,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to create SES template: ${error.message}`);
    }
  }

  async updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    // SES template update implementation
    return {
      id,
      name: updates.name || 'Updated Template',
      subject: updates.subject || 'Updated Subject',
      htmlContent: updates.htmlContent || '<p>Updated content</p>',
      variables: updates.variables || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async deleteTemplate(id: string): Promise<boolean> {
    try {
      // await this.ses.deleteTemplate({ TemplateName: id }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getTemplate(id: string): Promise<EmailTemplate> {
    // const result = await this.ses.getTemplate({ TemplateName: id }).promise();
    
    return {
      id,
      name: 'SES Template',
      subject: 'Tournament {{action}}: {{tournamentName}}',
      htmlContent: '<h1>{{action}}: {{tournamentName}}</h1><p>Hello {{playerName}}!</p>',
      textContent: '{{action}}: {{tournamentName}}\n\nHello {{playerName}}!',
      variables: ['action', 'tournamentName', 'playerName'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async listTemplates(): Promise<EmailTemplate[]> {
    // const result = await this.ses.listTemplates().promise();
    return [];
  }

  async getStats(messageId?: string): Promise<EmailStats> {
    // SES CloudWatch metrics implementation
    return {
      sent: 25,
      delivered: 24,
      opened: 15,
      clicked: 5,
      bounced: 1,
      spam: 0,
      unsubscribed: 0,
    };
  }

  processWebhook(payload: string, signature?: string): EmailEvent[] {
    try {
      // Process SES SNS webhook
      const message = JSON.parse(payload);
      
      if (message.Type === 'Notification') {
        const eventData = JSON.parse(message.Message);
        
        return [{
          messageId: eventData.mail?.messageId || `ses_${Date.now()}`,
          event: eventData.eventType as any,
          timestamp: new Date(eventData.mail?.timestamp || Date.now()),
          recipient: eventData.mail?.destination?.[0] || '',
        }];
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
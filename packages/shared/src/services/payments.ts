/**
 * Payment gateway integration abstractions for ProTour
 * Supports Razorpay (India-focused) and Stripe (global) payment gateways
 */

export interface PaymentAmount {
  value: number;
  currency: string; // INR, USD, etc.
}

export interface PaymentCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'netbanking' | 'wallet';
  last4?: string;
  brand?: string;
  isDefault?: boolean;
}

export interface PaymentIntent {
  id: string;
  amount: PaymentAmount;
  customer: PaymentCustomer;
  description: string;
  metadata: Record<string, any>;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  clientSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  transactionId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: PaymentAmount; // Partial refund if specified
  reason: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: PaymentAmount;
  status: 'pending' | 'succeeded' | 'failed';
  error?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  signature?: string;
}

export abstract class PaymentGateway {
  protected config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  abstract createPaymentIntent(
    amount: PaymentAmount,
    customer: PaymentCustomer,
    options: CreatePaymentOptions
  ): Promise<PaymentIntent>;

  abstract confirmPayment(
    paymentIntentId: string,
    paymentMethod: PaymentMethod
  ): Promise<PaymentResult>;

  abstract capturePayment(paymentIntentId: string): Promise<PaymentResult>;

  abstract refundPayment(request: RefundRequest): Promise<RefundResult>;

  abstract getPaymentIntent(id: string): Promise<PaymentIntent>;

  abstract listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;

  abstract createCustomer(
    customer: Omit<PaymentCustomer, 'id'>
  ): Promise<PaymentCustomer>;

  abstract updateCustomer(
    customerId: string,
    updates: Partial<PaymentCustomer>
  ): Promise<PaymentCustomer>;

  abstract verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): WebhookEvent | null;

  abstract calculateFees(amount: PaymentAmount): Promise<PaymentAmount>;
}

export interface PaymentGatewayConfig {
  provider: 'razorpay' | 'stripe';
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production';
  currency: string;
  country: string;
}

export interface CreatePaymentOptions {
  description: string;
  metadata?: Record<string, any>;
  captureMethod?: 'automatic' | 'manual';
  paymentMethods?: string[]; // Allowed payment methods
  returnUrl?: string;
  cancelUrl?: string;
}

export class PaymentGatewayFactory {
  static create(config: PaymentGatewayConfig): PaymentGateway {
    switch (config.provider) {
      case 'razorpay':
        return new RazorpayGateway(config);
      case 'stripe':
        return new StripeGateway(config);
      default:
        throw new Error(`Unsupported payment provider: ${config.provider}`);
    }
  }
}

/**
 * Razorpay implementation for Indian market
 */
export class RazorpayGateway extends PaymentGateway {
  private client: any; // Razorpay client instance

  constructor(config: PaymentGatewayConfig) {
    super(config);
    // Initialize Razorpay client in actual implementation
    // this.client = new Razorpay({...});
  }

  async createPaymentIntent(
    amount: PaymentAmount,
    customer: PaymentCustomer,
    options: CreatePaymentOptions
  ): Promise<PaymentIntent> {
    try {
      // Razorpay uses orders, not payment intents
      const orderData = {
        amount: amount.value * 100, // Convert to paise
        currency: amount.currency,
        receipt: `receipt_${Date.now()}`,
        notes: {
          customerId: customer.id,
          description: options.description,
          ...options.metadata,
        },
      };

      // const order = await this.client.orders.create(orderData);

      // Mock response for now
      const paymentIntent: PaymentIntent = {
        id: `order_${Date.now()}`,
        amount,
        customer,
        description: options.description,
        metadata: options.metadata || {},
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return paymentIntent;
    } catch (error) {
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  async confirmPayment(
    paymentIntentId: string,
    paymentMethod: PaymentMethod
  ): Promise<PaymentResult> {
    try {
      // Razorpay handles confirmation differently
      // Usually done through webhook after successful payment

      return {
        success: true,
        paymentId: `pay_${Date.now()}`,
        transactionId: paymentIntentId,
      };
    } catch (error) {
      return {
        success: false,
        paymentId: '',
        error: error.message,
      };
    }
  }

  async capturePayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      // const payment = await this.client.payments.capture(paymentIntentId, amount);

      return {
        success: true,
        paymentId: paymentIntentId,
      };
    } catch (error) {
      return {
        success: false,
        paymentId: paymentIntentId,
        error: error.message,
      };
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    try {
      const refundData = {
        amount: request.amount ? request.amount.value * 100 : undefined,
        notes: {
          reason: request.reason,
          ...request.metadata,
        },
      };

      // const refund = await this.client.payments.refund(request.paymentId, refundData);

      return {
        success: true,
        refundId: `rfnd_${Date.now()}`,
        amount: request.amount || { value: 0, currency: 'INR' },
        status: 'pending',
      };
    } catch (error) {
      return {
        success: false,
        refundId: '',
        amount: { value: 0, currency: 'INR' },
        status: 'failed',
        error: error.message,
      };
    }
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent> {
    // const order = await this.client.orders.fetch(id);
    
    // Mock response
    return {
      id,
      amount: { value: 1000, currency: 'INR' },
      customer: { id: 'cust_123', name: 'Test User', email: 'test@example.com' },
      description: 'Tournament registration',
      metadata: {},
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    // Razorpay doesn't store payment methods like Stripe
    // Usually handled through saved cards API
    return [];
  }

  async createCustomer(
    customer: Omit<PaymentCustomer, 'id'>
  ): Promise<PaymentCustomer> {
    const customerData = {
      name: customer.name,
      email: customer.email,
      contact: customer.phone,
    };

    // const razorpayCustomer = await this.client.customers.create(customerData);

    return {
      id: `cust_${Date.now()}`,
      ...customer,
    };
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<PaymentCustomer>
  ): Promise<PaymentCustomer> {
    // const updated = await this.client.customers.edit(customerId, updates);

    return {
      id: customerId,
      name: updates.name || 'Test User',
      email: updates.email || 'test@example.com',
      phone: updates.phone,
    };
  }

  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): WebhookEvent | null {
    try {
      // Use Razorpay webhook verification
      // const isValid = Razorpay.validateWebhookSignature(payload, signature, secret);
      
      if (true) { // Mock verification
        const event = JSON.parse(payload);
        return {
          id: event.id || `evt_${Date.now()}`,
          type: event.event,
          data: event.payload,
          timestamp: new Date(event.created_at * 1000),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async calculateFees(amount: PaymentAmount): Promise<PaymentAmount> {
    // Razorpay fees calculation
    const feePercentage = 0.02; // 2% + GST
    const gst = 0.18;
    const baseFee = amount.value * feePercentage;
    const totalFee = baseFee + (baseFee * gst);

    return {
      value: Math.round(totalFee * 100) / 100,
      currency: amount.currency,
    };
  }
}

/**
 * Stripe implementation for global markets
 */
export class StripeGateway extends PaymentGateway {
  private stripe: any; // Stripe client instance

  constructor(config: PaymentGatewayConfig) {
    super(config);
    // Initialize Stripe client in actual implementation
    // this.stripe = new Stripe(config.secretKey);
  }

  async createPaymentIntent(
    amount: PaymentAmount,
    customer: PaymentCustomer,
    options: CreatePaymentOptions
  ): Promise<PaymentIntent> {
    try {
      const paymentIntentData = {
        amount: amount.value * 100, // Convert to cents
        currency: amount.currency.toLowerCase(),
        customer: customer.id,
        description: options.description,
        metadata: options.metadata,
        capture_method: options.captureMethod || 'automatic',
      };

      // const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      // Mock response
      const intent: PaymentIntent = {
        id: `pi_${Date.now()}`,
        amount,
        customer,
        description: options.description,
        metadata: options.metadata || {},
        status: 'pending',
        clientSecret: `pi_${Date.now()}_secret_${Math.random()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return intent;
    } catch (error) {
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  async confirmPayment(
    paymentIntentId: string,
    paymentMethod: PaymentMethod
  ): Promise<PaymentResult> {
    try {
      // const confirmed = await this.stripe.paymentIntents.confirm(paymentIntentId, {
      //   payment_method: paymentMethod.id
      // });

      return {
        success: true,
        paymentId: paymentIntentId,
        transactionId: `ch_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        paymentId: paymentIntentId,
        error: error.message,
      };
    }
  }

  async capturePayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      // const captured = await this.stripe.paymentIntents.capture(paymentIntentId);

      return {
        success: true,
        paymentId: paymentIntentId,
      };
    } catch (error) {
      return {
        success: false,
        paymentId: paymentIntentId,
        error: error.message,
      };
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    try {
      const refundData: any = {
        payment_intent: request.paymentId,
        reason: request.reason,
        metadata: request.metadata,
      };

      if (request.amount) {
        refundData.amount = request.amount.value * 100;
      }

      // const refund = await this.stripe.refunds.create(refundData);

      return {
        success: true,
        refundId: `re_${Date.now()}`,
        amount: request.amount || { value: 0, currency: 'USD' },
        status: 'pending',
      };
    } catch (error) {
      return {
        success: false,
        refundId: '',
        amount: { value: 0, currency: 'USD' },
        status: 'failed',
        error: error.message,
      };
    }
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent> {
    // const paymentIntent = await this.stripe.paymentIntents.retrieve(id);
    
    // Mock response
    return {
      id,
      amount: { value: 1000, currency: 'USD' },
      customer: { id: 'cus_123', name: 'Test User', email: 'test@example.com' },
      description: 'Tournament registration',
      metadata: {},
      status: 'pending',
      clientSecret: `${id}_secret_${Math.random()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    // const paymentMethods = await this.stripe.paymentMethods.list({
    //   customer: customerId,
    //   type: 'card',
    // });

    // Mock response
    return [
      {
        id: 'pm_123',
        type: 'card',
        last4: '4242',
        brand: 'visa',
        isDefault: true,
      },
    ];
  }

  async createCustomer(
    customer: Omit<PaymentCustomer, 'id'>
  ): Promise<PaymentCustomer> {
    const customerData = {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    };

    // const stripeCustomer = await this.stripe.customers.create(customerData);

    return {
      id: `cus_${Date.now()}`,
      ...customer,
    };
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<PaymentCustomer>
  ): Promise<PaymentCustomer> {
    // const updated = await this.stripe.customers.update(customerId, updates);

    return {
      id: customerId,
      name: updates.name || 'Test User',
      email: updates.email || 'test@example.com',
      phone: updates.phone,
    };
  }

  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): WebhookEvent | null {
    try {
      // const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
      
      // Mock verification
      const event = JSON.parse(payload);
      return {
        id: event.id || `evt_${Date.now()}`,
        type: event.type,
        data: event.data,
        timestamp: new Date(event.created * 1000),
      };
    } catch (error) {
      return null;
    }
  }

  async calculateFees(amount: PaymentAmount): Promise<PaymentAmount> {
    // Stripe fees calculation
    const feePercentage = 0.029; // 2.9% + 30¢
    const fixedFee = 0.30;
    const totalFee = (amount.value * feePercentage) + fixedFee;

    return {
      value: Math.round(totalFee * 100) / 100,
      currency: amount.currency,
    };
  }
}
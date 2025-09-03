/**
 * Analytics service abstractions for ProTour
 * Supports Google Analytics, Mixpanel, and Firebase Analytics
 */

export interface AnalyticsEvent {
  name: string;
  parameters?: Record<string, any>;
  value?: number;
  currency?: string;
  timestamp?: Date;
}

export interface UserProperties {
  userId?: string;
  email?: string;
  name?: string;
  role?: 'player' | 'organizer' | 'admin';
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
  registrationDate?: Date;
  country?: string;
  deviceType?: 'mobile' | 'web' | 'tablet';
  appVersion?: string;
  [key: string]: any;
}

export interface ScreenView {
  screenName: string;
  screenClass?: string;
  parameters?: Record<string, any>;
}

export interface ConversionEvent {
  name: string;
  transactionId?: string;
  value: number;
  currency: string;
  items?: Array<{
    itemId: string;
    itemName: string;
    category?: string;
    quantity?: number;
    price?: number;
  }>;
}

export interface FunnelStep {
  stepName: string;
  stepNumber: number;
  parameters?: Record<string, any>;
}

export interface CohortAnalysis {
  cohortId: string;
  userCount: number;
  retentionRates: Record<string, number>; // day/week/month -> retention %
}

export interface AnalyticsConfig {
  provider: 'google_analytics' | 'mixpanel' | 'firebase' | 'amplitude';
  apiKey: string;
  projectId?: string;
  measurementId?: string; // For GA4
  environment: 'development' | 'staging' | 'production';
  enableDebug?: boolean;
  enableBatching?: boolean;
  batchSize?: number;
  flushInterval?: number; // milliseconds
}

export abstract class AnalyticsProvider {
  protected config: AnalyticsConfig;
  protected userId?: string;
  protected userProperties: UserProperties = {};

  constructor(config: AnalyticsConfig) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract trackEvent(event: AnalyticsEvent): Promise<void>;
  abstract trackScreenView(screenView: ScreenView): Promise<void>;
  abstract trackConversion(conversion: ConversionEvent): Promise<void>;
  abstract setUserId(userId: string): Promise<void>;
  abstract setUserProperties(properties: UserProperties): Promise<void>;
  abstract trackFunnelStep(step: FunnelStep): Promise<void>;
  abstract flush(): Promise<void>; // Force send batched events
  abstract reset(): Promise<void>; // Clear user data and session
}

export class AnalyticsServiceFactory {
  static create(config: AnalyticsConfig): AnalyticsProvider {
    switch (config.provider) {
      case 'google_analytics':
        return new GoogleAnalyticsProvider(config);
      case 'mixpanel':
        return new MixpanelProvider(config);
      case 'firebase':
        return new FirebaseAnalyticsProvider(config);
      case 'amplitude':
        return new AmplitudeProvider(config);
      default:
        throw new Error(`Unsupported analytics provider: ${config.provider}`);
    }
  }
}

/**
 * Google Analytics 4 implementation
 */
export class GoogleAnalyticsProvider extends AnalyticsProvider {
  private gtag: any;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load gtag for web or use Firebase SDK for mobile
      if (typeof window !== 'undefined') {
        // Web implementation
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.measurementId}`;
        script.async = true;
        document.head.appendChild(script);

        // Initialize gtag
        (window as any).dataLayer = (window as any).dataLayer || [];
        this.gtag = function (...args: any[]) {
          (window as any).dataLayer.push(args);
        };

        this.gtag('js', new Date());
        this.gtag('config', this.config.measurementId, {
          debug_mode: this.config.enableDebug,
          send_page_view: false, // We'll handle page views manually
        });
      } else {
        // Mobile/Node.js implementation would use Firebase SDK
        console.log(
          '[Analytics] Google Analytics initialized for mobile/server'
        );
      }

      this.initialized = true;
      console.log('[Analytics] Google Analytics initialized');
    } catch (error) {
      console.error(
        '[Analytics] Failed to initialize Google Analytics:',
        error
      );
    }
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const eventData: any = {
        ...event.parameters,
        value: event.value,
        currency: event.currency,
      };

      if (this.gtag) {
        this.gtag('event', event.name, eventData);
      }

      if (this.config.enableDebug) {
        console.log('[Analytics] GA Event:', event.name, eventData);
      }
    } catch (error) {
      console.error('[Analytics] Failed to track GA event:', error);
    }
  }

  async trackScreenView(screenView: ScreenView): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const eventData = {
        screen_name: screenView.screenName,
        screen_class: screenView.screenClass,
        ...screenView.parameters,
      };

      if (this.gtag) {
        this.gtag('event', 'screen_view', eventData);
      }

      if (this.config.enableDebug) {
        console.log('[Analytics] GA Screen View:', screenView.screenName);
      }
    } catch (error) {
      console.error('[Analytics] Failed to track GA screen view:', error);
    }
  }

  async trackConversion(conversion: ConversionEvent): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const eventData: any = {
        transaction_id: conversion.transactionId,
        value: conversion.value,
        currency: conversion.currency,
        items: conversion.items,
      };

      if (this.gtag) {
        this.gtag('event', conversion.name, eventData);
      }

      if (this.config.enableDebug) {
        console.log('[Analytics] GA Conversion:', conversion.name, eventData);
      }
    } catch (error) {
      console.error('[Analytics] Failed to track GA conversion:', error);
    }
  }

  async setUserId(userId: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.userId = userId;

    try {
      if (this.gtag) {
        this.gtag('config', this.config.measurementId, {
          user_id: userId,
        });
      }
    } catch (error) {
      console.error('[Analytics] Failed to set GA user ID:', error);
    }
  }

  async setUserProperties(properties: UserProperties): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.userProperties = { ...this.userProperties, ...properties };

    try {
      if (this.gtag) {
        this.gtag('config', this.config.measurementId, {
          custom_map: properties,
        });
      }
    } catch (error) {
      console.error('[Analytics] Failed to set GA user properties:', error);
    }
  }

  async trackFunnelStep(step: FunnelStep): Promise<void> {
    await this.trackEvent({
      name: 'funnel_step',
      parameters: {
        step_name: step.stepName,
        step_number: step.stepNumber,
        ...step.parameters,
      },
    });
  }

  async flush(): Promise<void> {
    // GA4 doesn't require manual flushing
    console.log('[Analytics] GA flush requested (not required)');
  }

  async reset(): Promise<void> {
    this.userId = undefined;
    this.userProperties = {};

    if (this.gtag) {
      this.gtag('config', this.config.measurementId, {
        user_id: null,
      });
    }
  }
}

/**
 * Mixpanel implementation
 */
export class MixpanelProvider extends AnalyticsProvider {
  private mixpanel: any;
  private initialized = false;
  private eventQueue: AnalyticsEvent[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load Mixpanel SDK
      if (typeof window !== 'undefined') {
        // Web implementation - load Mixpanel script
        console.log('[Analytics] Initializing Mixpanel for web');
      } else {
        // Mobile/Node.js implementation
        console.log('[Analytics] Initializing Mixpanel for mobile/server');
      }

      // Mock Mixpanel client for now
      this.mixpanel = {
        track: (eventName: string, properties: any) => {
          console.log('[Mixpanel] Track:', eventName, properties);
        },
        identify: (userId: string) => {
          console.log('[Mixpanel] Identify:', userId);
        },
        people: {
          set: (properties: any) => {
            console.log('[Mixpanel] People Set:', properties);
          },
        },
        flush: () => {
          console.log('[Mixpanel] Flush');
        },
        reset: () => {
          console.log('[Mixpanel] Reset');
        },
      };

      this.initialized = true;
      console.log('[Analytics] Mixpanel initialized');
    } catch (error) {
      console.error('[Analytics] Failed to initialize Mixpanel:', error);
    }
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const properties = {
        ...event.parameters,
        value: event.value,
        currency: event.currency,
        timestamp: event.timestamp || new Date(),
        $insert_id: `${event.name}_${Date.now()}_${Math.random()}`,
      };

      if (this.config.enableBatching) {
        this.eventQueue.push(event);
        if (this.eventQueue.length >= (this.config.batchSize || 50)) {
          await this.flush();
        }
      } else {
        this.mixpanel.track(event.name, properties);
      }

      if (this.config.enableDebug) {
        console.log('[Analytics] Mixpanel Event:', event.name, properties);
      }
    } catch (error) {
      console.error('[Analytics] Failed to track Mixpanel event:', error);
    }
  }

  async trackScreenView(screenView: ScreenView): Promise<void> {
    await this.trackEvent({
      name: 'Screen View',
      parameters: {
        screen_name: screenView.screenName,
        screen_class: screenView.screenClass,
        ...screenView.parameters,
      },
    });
  }

  async trackConversion(conversion: ConversionEvent): Promise<void> {
    await this.trackEvent({
      name: conversion.name,
      parameters: {
        transaction_id: conversion.transactionId,
        items: conversion.items,
      },
      value: conversion.value,
      currency: conversion.currency,
    });
  }

  async setUserId(userId: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.userId = userId;

    try {
      this.mixpanel.identify(userId);
    } catch (error) {
      console.error('[Analytics] Failed to set Mixpanel user ID:', error);
    }
  }

  async setUserProperties(properties: UserProperties): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.userProperties = { ...this.userProperties, ...properties };

    try {
      this.mixpanel.people.set(properties);
    } catch (error) {
      console.error(
        '[Analytics] Failed to set Mixpanel user properties:',
        error
      );
    }
  }

  async trackFunnelStep(step: FunnelStep): Promise<void> {
    await this.trackEvent({
      name: `Funnel: ${step.stepName}`,
      parameters: {
        funnel_step: step.stepNumber,
        ...step.parameters,
      },
    });
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    try {
      // Send batched events
      for (const event of this.eventQueue) {
        const properties = {
          ...event.parameters,
          value: event.value,
          currency: event.currency,
        };
        this.mixpanel.track(event.name, properties);
      }

      this.mixpanel.flush();
      this.eventQueue = [];

      console.log('[Analytics] Mixpanel events flushed');
    } catch (error) {
      console.error('[Analytics] Failed to flush Mixpanel events:', error);
    }
  }

  async reset(): Promise<void> {
    this.userId = undefined;
    this.userProperties = {};
    this.eventQueue = [];

    try {
      this.mixpanel.reset();
    } catch (error) {
      console.error('[Analytics] Failed to reset Mixpanel:', error);
    }
  }
}

/**
 * Firebase Analytics implementation
 */
export class FirebaseAnalyticsProvider extends AnalyticsProvider {
  private analytics: any;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Firebase Analytics
      // this.analytics = getAnalytics(app);

      console.log('[Analytics] Firebase Analytics initialized');
      this.initialized = true;
    } catch (error) {
      console.error(
        '[Analytics] Failed to initialize Firebase Analytics:',
        error
      );
    }
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const parameters = {
        ...event.parameters,
        value: event.value,
        currency: event.currency,
      };

      // logEvent(this.analytics, event.name, parameters);

      if (this.config.enableDebug) {
        console.log('[Analytics] Firebase Event:', event.name, parameters);
      }
    } catch (error) {
      console.error('[Analytics] Failed to track Firebase event:', error);
    }
  }

  async trackScreenView(screenView: ScreenView): Promise<void> {
    await this.trackEvent({
      name: 'screen_view',
      parameters: {
        screen_name: screenView.screenName,
        screen_class: screenView.screenClass,
        ...screenView.parameters,
      },
    });
  }

  async trackConversion(conversion: ConversionEvent): Promise<void> {
    await this.trackEvent({
      name: 'purchase',
      parameters: {
        transaction_id: conversion.transactionId,
        items: conversion.items,
      },
      value: conversion.value,
      currency: conversion.currency,
    });
  }

  async setUserId(userId: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.userId = userId;

    try {
      // setUserId(this.analytics, userId);
    } catch (error) {
      console.error('[Analytics] Failed to set Firebase user ID:', error);
    }
  }

  async setUserProperties(properties: UserProperties): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.userProperties = { ...this.userProperties, ...properties };

    try {
      // Object.entries(properties).forEach(([key, value]) => {
      //   setUserProperties(this.analytics, { [key]: value });
      // });
    } catch (error) {
      console.error(
        '[Analytics] Failed to set Firebase user properties:',
        error
      );
    }
  }

  async trackFunnelStep(step: FunnelStep): Promise<void> {
    await this.trackEvent({
      name: 'funnel_step',
      parameters: {
        step_name: step.stepName,
        step_number: step.stepNumber,
        ...step.parameters,
      },
    });
  }

  async flush(): Promise<void> {
    // Firebase Analytics doesn't require manual flushing
    console.log('[Analytics] Firebase flush requested (not required)');
  }

  async reset(): Promise<void> {
    this.userId = undefined;
    this.userProperties = {};
    // Firebase Analytics doesn't have a reset method
    console.log('[Analytics] Firebase reset (user data cleared locally)');
  }
}

/**
 * Amplitude implementation
 */
export class AmplitudeProvider extends AnalyticsProvider {
  private amplitude: any;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Amplitude
      console.log('[Analytics] Amplitude initialized');
      this.initialized = true;
    } catch (error) {
      console.error('[Analytics] Failed to initialize Amplitude:', error);
    }
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const eventProperties = {
        ...event.parameters,
        value: event.value,
        currency: event.currency,
      };

      // amplitude.track(event.name, eventProperties);

      if (this.config.enableDebug) {
        console.log(
          '[Analytics] Amplitude Event:',
          event.name,
          eventProperties
        );
      }
    } catch (error) {
      console.error('[Analytics] Failed to track Amplitude event:', error);
    }
  }

  async trackScreenView(screenView: ScreenView): Promise<void> {
    await this.trackEvent({
      name: 'Screen Viewed',
      parameters: {
        screen_name: screenView.screenName,
        screen_class: screenView.screenClass,
        ...screenView.parameters,
      },
    });
  }

  async trackConversion(conversion: ConversionEvent): Promise<void> {
    await this.trackEvent({
      name: conversion.name,
      parameters: {
        transaction_id: conversion.transactionId,
        items: conversion.items,
      },
      value: conversion.value,
      currency: conversion.currency,
    });
  }

  async setUserId(userId: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.userId = userId;

    try {
      // amplitude.setUserId(userId);
    } catch (error) {
      console.error('[Analytics] Failed to set Amplitude user ID:', error);
    }
  }

  async setUserProperties(properties: UserProperties): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.userProperties = { ...this.userProperties, ...properties };

    try {
      // amplitude.setUserProperties(properties);
    } catch (error) {
      console.error(
        '[Analytics] Failed to set Amplitude user properties:',
        error
      );
    }
  }

  async trackFunnelStep(step: FunnelStep): Promise<void> {
    await this.trackEvent({
      name: step.stepName,
      parameters: {
        funnel_step: step.stepNumber,
        ...step.parameters,
      },
    });
  }

  async flush(): Promise<void> {
    try {
      // amplitude.flush();
      console.log('[Analytics] Amplitude events flushed');
    } catch (error) {
      console.error('[Analytics] Failed to flush Amplitude events:', error);
    }
  }

  async reset(): Promise<void> {
    this.userId = undefined;
    this.userProperties = {};

    try {
      // amplitude.reset();
    } catch (error) {
      console.error('[Analytics] Failed to reset Amplitude:', error);
    }
  }
}

/**
 * Multi-provider analytics manager
 */
export class AnalyticsManager {
  private providers: AnalyticsProvider[] = [];
  private initialized = false;

  constructor(configs: AnalyticsConfig[]) {
    this.providers = configs.map(config =>
      AnalyticsServiceFactory.create(config)
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all(this.providers.map(provider => provider.initialize()));
    this.initialized = true;
    console.log(`[Analytics] Initialized ${this.providers.length} providers`);
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.initialized) await this.initialize();

    await Promise.all(
      this.providers.map(provider =>
        provider
          .trackEvent(event)
          .catch(error =>
            console.error(`[Analytics] Provider failed to track event:`, error)
          )
      )
    );
  }

  async trackScreenView(screenView: ScreenView): Promise<void> {
    if (!this.initialized) await this.initialize();

    await Promise.all(
      this.providers.map(provider =>
        provider
          .trackScreenView(screenView)
          .catch(error =>
            console.error(
              `[Analytics] Provider failed to track screen view:`,
              error
            )
          )
      )
    );
  }

  async trackConversion(conversion: ConversionEvent): Promise<void> {
    if (!this.initialized) await this.initialize();

    await Promise.all(
      this.providers.map(provider =>
        provider
          .trackConversion(conversion)
          .catch(error =>
            console.error(
              `[Analytics] Provider failed to track conversion:`,
              error
            )
          )
      )
    );
  }

  async setUserId(userId: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    await Promise.all(
      this.providers.map(provider =>
        provider
          .setUserId(userId)
          .catch(error =>
            console.error(`[Analytics] Provider failed to set user ID:`, error)
          )
      )
    );
  }

  async setUserProperties(properties: UserProperties): Promise<void> {
    if (!this.initialized) await this.initialize();

    await Promise.all(
      this.providers.map(provider =>
        provider
          .setUserProperties(properties)
          .catch(error =>
            console.error(
              `[Analytics] Provider failed to set user properties:`,
              error
            )
          )
      )
    );
  }

  async trackFunnelStep(step: FunnelStep): Promise<void> {
    if (!this.initialized) await this.initialize();

    await Promise.all(
      this.providers.map(provider =>
        provider
          .trackFunnelStep(step)
          .catch(error =>
            console.error(
              `[Analytics] Provider failed to track funnel step:`,
              error
            )
          )
      )
    );
  }

  async flush(): Promise<void> {
    await Promise.all(
      this.providers.map(provider =>
        provider
          .flush()
          .catch(error =>
            console.error(`[Analytics] Provider failed to flush:`, error)
          )
      )
    );
  }

  async reset(): Promise<void> {
    await Promise.all(
      this.providers.map(provider =>
        provider
          .reset()
          .catch(error =>
            console.error(`[Analytics] Provider failed to reset:`, error)
          )
      )
    );
  }
}

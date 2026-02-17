/**
 * PayPal Integration for Subscriptions
 * 
 * This module handles PayPal subscription creation and cancellation
 */

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  weeklyPlanId: string;
  monthlyPlanId: string;
  mode: 'sandbox' | 'live';
}

export interface PayPalSubscription {
  id: string;
  status: string;
  plan_id: string;
  start_time: string;
  subscriber: {
    email_address?: string;
  };
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

class PayPalService {
  private config: PayPalConfig | null = null;
  private baseUrl: string = '';

  /**
   * Initialize PayPal with configuration
   */
  initialize(config: PayPalConfig) {
    this.config = config;
    this.baseUrl = config.mode === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
    
    // Validate that plan IDs are provided
    if (!config.weeklyPlanId || !config.monthlyPlanId) {
      console.warn('PayPal plan IDs not fully configured. Weekly or monthly plan may not work.');
    }
  }

  /**
   * Get PayPal access token
   */
  private async getAccessToken(): Promise<string> {
    if (!this.config) {
      throw new Error('PayPal not initialized. Call initialize() first.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`,
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal auth failed: ${error.error_description || error.error}`);
      }

      const data: PayPalAccessToken = await response.json();
      return data.access_token;
    } catch (error: any) {
      console.error('Error getting PayPal access token:', error);
      throw new Error(`Failed to get PayPal access token: ${error.message}`);
    }
  }

  /**
   * Create a PayPal subscription
   */
  async createSubscription(userEmail: string, returnUrl: string, cancelUrl: string, planType: 'weekly' | 'monthly' = 'monthly'): Promise<PayPalSubscription> {
    if (!this.config) {
      throw new Error('PayPal not initialized. Call initialize() first.');
    }

    try {
      const accessToken = await this.getAccessToken();

      const planId = planType === 'weekly' ? this.config.weeklyPlanId : this.config.monthlyPlanId;
      if (!planId) {
        throw new Error(`PayPal ${planType} plan ID not configured`);
      }

      const subscriptionData = {
        plan_id: planId,
        start_time: new Date(Date.now() + 60000).toISOString(), // Start 1 minute from now
        subscriber: {
          email_address: userEmail,
        },
        application_context: {
          brand_name: 'ChatMyte',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
          },
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      };

      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(subscriptionData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal subscription creation failed: ${JSON.stringify(error)}`);
      }

      const subscription: PayPalSubscription = await response.json();
      return subscription;
    } catch (error: any) {
      console.error('Error creating PayPal subscription:', error);
      throw new Error(`Failed to create PayPal subscription: ${error.message}`);
    }
  }

  /**
   * Cancel a PayPal subscription
   */
  async cancelSubscription(subscriptionId: string, reason?: string): Promise<void> {
    if (!this.config) {
      throw new Error('PayPal not initialized. Call initialize() first.');
    }

    try {
      const accessToken = await this.getAccessToken();

      const cancelData: any = {};
      if (reason) {
        cancelData.reason = reason;
      }

      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: Object.keys(cancelData).length > 0 ? JSON.stringify(cancelData) : undefined,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal subscription cancellation failed: ${JSON.stringify(error)}`);
      }
    } catch (error: any) {
      console.error('Error cancelling PayPal subscription:', error);
      throw new Error(`Failed to cancel PayPal subscription: ${error.message}`);
    }
  }

  /**
   * Get subscription details from PayPal
   */
  async getSubscription(subscriptionId: string): Promise<PayPalSubscription> {
    if (!this.config) {
      throw new Error('PayPal not initialized. Call initialize() first.');
    }

    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal subscription fetch failed: ${JSON.stringify(error)}`);
      }

      const subscription: PayPalSubscription = await response.json();
      return subscription;
    } catch (error: any) {
      console.error('Error getting PayPal subscription:', error);
      throw new Error(`Failed to get PayPal subscription: ${error.message}`);
    }
  }

  /**
   * Activate a subscription (if it was suspended)
   */
  async activateSubscription(subscriptionId: string): Promise<void> {
    if (!this.config) {
      throw new Error('PayPal not initialized. Call initialize() first.');
    }

    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          reason: 'Reactivating subscription',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`PayPal subscription activation failed: ${JSON.stringify(error)}`);
      }
    } catch (error: any) {
      console.error('Error activating PayPal subscription:', error);
      throw new Error(`Failed to activate PayPal subscription: ${error.message}`);
    }
  }
}

// Export singleton instance
export const paypalService = new PayPalService();

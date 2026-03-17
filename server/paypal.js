import fetch from 'node-fetch';

class PayPalService {
  constructor() {
    this.config = null;
    this.baseUrl = '';
  }

  initialize(config) {
    this.config = config;
    this.baseUrl = config.mode === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  async getAccessToken() {
    if (!this.config) {
      throw new Error('PayPal not initialized');
    }

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`PayPal auth failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async cancelSubscription(subscriptionId, reason) {
    if (!this.config) {
      throw new Error('PayPal not initialized');
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ reason: reason || 'User requested cancellation' }),
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json();
      throw new Error(`PayPal cancellation failed: ${JSON.stringify(error)}`);
    }
  }
}

export const paypalService = new PayPalService();

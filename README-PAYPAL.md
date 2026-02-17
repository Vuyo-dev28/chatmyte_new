# PayPal Subscription Integration

This guide explains how to set up and use PayPal subscriptions in ChatMyte.

## Setup Instructions

### 1. Get PayPal Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create a new app or use an existing one
3. Get your **Client ID** and **Client Secret**
4. Note: Use Sandbox credentials for testing, Live credentials for production

### 2. Create a PayPal Subscription Plan

1. In PayPal Dashboard, go to **Products** → **Subscriptions**
2. Click **Create Plan**
3. Set up your plan details:
   - Name: "ChatMyte Premium"
   - Billing cycle: Monthly (or your preference)
   - Price: $9.99 (or your price)
4. Copy the **Plan ID** (starts with `P-`)

### 3. Configure Your App

Open `src/lib/paypal-config.ts` and update with your credentials:

```typescript
export const PAYPAL_CONFIG: PayPalCredentials = {
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  planId: 'P-YOUR_PLAN_ID',
  mode: 'sandbox', // Change to 'live' for production
};
```

### 4. Environment Variables (Optional)

For better security, you can use environment variables:

1. Add to your `.env` file:
```env
VITE_PAYPAL_CLIENT_ID=your_client_id
VITE_PAYPAL_CLIENT_SECRET=your_client_secret
VITE_PAYPAL_PLAN_ID=your_plan_id
VITE_PAYPAL_MODE=sandbox
```

2. Update `paypal-config.ts`:
```typescript
export const PAYPAL_CONFIG: PayPalCredentials = {
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_PAYPAL_CLIENT_SECRET || '',
  planId: import.meta.env.VITE_PAYPAL_PLAN_ID || '',
  mode: (import.meta.env.VITE_PAYPAL_MODE || 'sandbox') as 'sandbox' | 'live',
};
```

## Usage

### Creating a Subscription

When a user clicks "Upgrade Now" in the premium modal:

1. The app creates a PayPal subscription
2. User is redirected to PayPal to approve
3. After approval, PayPal redirects back to your app
4. The subscription is stored in your database

### Cancelling a Subscription

Users can cancel their subscription through the subscription management component:

1. The app cancels the subscription in PayPal
2. Updates the subscription status in the database
3. User retains access until the end of the billing period

## Functions Available

### `createPayPalSubscription(userEmail, returnUrl, cancelUrl)`
Creates a PayPal subscription and returns the approval URL.

### `cancelPayPalSubscription(subscriptionId, reason?)`
Cancels a PayPal subscription by database subscription ID.

### `getActiveSubscription()`
Gets the current user's active subscription.

## Return URLs

After PayPal approval, users are redirected to:
- **Success URL**: `/subscription/success` - Handle successful subscription
- **Cancel URL**: `/subscription/cancel` - Handle cancelled subscription

You may want to create pages to handle these redirects and update the user's subscription status.

## Webhook Setup (Recommended)

For production, set up PayPal webhooks to handle:
- Subscription activations
- Payment failures
- Subscription cancellations
- Subscription renewals

1. In PayPal Dashboard, go to **Webhooks**
2. Add webhook URL: `https://your-domain.com/api/webhooks/paypal`
3. Subscribe to events:
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `PAYMENT.SALE.COMPLETED`
   - `PAYMENT.SALE.DENIED`

## Testing

1. Use PayPal Sandbox mode for testing
2. Create test accounts at [PayPal Sandbox](https://developer.paypal.com/dashboard/accounts)
3. Test the full subscription flow:
   - Create subscription
   - Approve payment
   - Cancel subscription

## Security Notes

- Never expose your Client Secret in client-side code
- For production, consider moving PayPal API calls to a backend server
- Use environment variables for sensitive credentials
- Enable PayPal webhooks for reliable subscription status updates

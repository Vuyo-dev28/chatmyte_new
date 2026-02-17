/**
 * PayPal Configuration
 * 
 * Replace these values with your actual PayPal credentials
 * You can get these from: https://developer.paypal.com/dashboard/
 */

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  weeklyPlanId: string;
  monthlyPlanId: string;
  mode: 'sandbox' | 'live';
}

/**
 * Initialize PayPal with your credentials
 * Call this function when your app starts (e.g., in App.tsx or main.tsx)
 * 
 * Example:
 * ```typescript
 * import { initializePayPal } from './lib/subscriptions';
 * 
 * initializePayPal({
 *   clientId: 'YOUR_CLIENT_ID',
 *   clientSecret: 'YOUR_CLIENT_SECRET',
 *   weeklyPlanId: 'YOUR_WEEKLY_PLAN_ID',
 *   monthlyPlanId: 'YOUR_MONTHLY_PLAN_ID',
 *   mode: 'sandbox' // or 'live' for production
 * });
 * ```
 */

// PayPal configuration from environment variables
// Add these to your .env file:
// VITE_PAYPAL_CLIENT_ID=your_client_id
// VITE_PAYPAL_CLIENT_SECRET=your_client_secret
// VITE_PAYPAL_WEEKLY_PLAN_ID=your_weekly_plan_id
// VITE_PAYPAL_MONTHLY_PLAN_ID=your_monthly_plan_id
// VITE_PAYPAL_MODE=sandbox (or 'live' for production)

export const PAYPAL_CONFIG: PayPalCredentials = {
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_PAYPAL_CLIENT_SECRET || '',
  weeklyPlanId: import.meta.env.VITE_PAYPAL_WEEKLY_PLAN_ID || '',
  monthlyPlanId: import.meta.env.VITE_PAYPAL_MONTHLY_PLAN_ID || '',
  mode: (import.meta.env.VITE_PAYPAL_MODE || 'sandbox') as 'sandbox' | 'live',
};

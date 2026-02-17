import { createClient } from './supabase';
import { paypalService, PayPalConfig } from './paypal';

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending' | 'past_due';

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  auto_renew: boolean;
  payment_provider: string | null;
  payment_provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

const supabase = createClient();

/**
 * Get the active subscription for the current user
 */
export async function getActiveSubscription(): Promise<Subscription | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found
        return null;
      }
      console.error('Error fetching subscription:', error);
      return null;
    }

    return data as Subscription;
  } catch (error) {
    console.error('Error getting active subscription:', error);
    return null;
  }
}

/**
 * Create a new subscription
 */
export async function createSubscription(
  tier: SubscriptionTier,
  expiresAt?: Date,
  paymentProvider?: string,
  paymentProviderSubscriptionId?: string
): Promise<Subscription | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Cancel any existing active subscriptions
    await cancelActiveSubscriptions(user.id);

    const subscriptionData: any = {
      user_id: user.id,
      tier,
      status: 'active',
      started_at: new Date().toISOString(),
      auto_renew: false,
    };

    if (expiresAt) {
      subscriptionData.expires_at = expiresAt.toISOString();
    }

    if (paymentProvider) {
      subscriptionData.payment_provider = paymentProvider;
    }

    if (paymentProviderSubscriptionId) {
      subscriptionData.payment_provider_subscription_id = paymentProviderSubscriptionId;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }

    return data as Subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}

/**
 * Cancel all active subscriptions for a user
 */
export async function cancelActiveSubscriptions(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('Error cancelling subscriptions:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error cancelling subscriptions:', error);
    throw error;
  }
}

/**
 * Initialize PayPal service
 */
export function initializePayPal(config: PayPalConfig): void {
  paypalService.initialize(config);
}

/**
 * Create a PayPal subscription and store it in the database
 */
export async function createPayPalSubscription(
  userEmail: string,
  returnUrl: string,
  cancelUrl: string,
  planType: 'weekly' | 'monthly' = 'monthly'
): Promise<{ subscription: Subscription; approvalUrl: string }> {
  try {
    // Create subscription in PayPal
    const paypalSubscription = await paypalService.createSubscription(userEmail, returnUrl, cancelUrl, planType);

    // Find approval URL from links
    const approvalLink = paypalSubscription.links.find(link => link.rel === 'approve');
    if (!approvalLink) {
      throw new Error('No approval URL found in PayPal subscription response');
    }

    // Calculate expiration date based on plan type
    const expiresAt = new Date();
    if (planType === 'weekly') {
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month from now
    }

    // Create subscription record in database with 'pending' status
    // It will be activated after PayPal approval
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Cancel any existing active subscriptions
    await cancelActiveSubscriptions(user.id);

    const subscriptionData: any = {
      user_id: user.id,
      tier: 'premium',
      status: 'pending', // Will be activated after PayPal approval
      started_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      auto_renew: false,
      payment_provider: 'paypal',
      payment_provider_subscription_id: paypalSubscription.id,
    };

    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }

    return {
      subscription: data as Subscription,
      approvalUrl: approvalLink.href,
    };
  } catch (error) {
    console.error('Error creating PayPal subscription:', error);
    throw error;
  }
}

/**
 * Cancel a PayPal subscription by database subscription ID
 */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason?: string
): Promise<void> {
  try {
    // Get subscription from database to find PayPal subscription ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      throw new Error('Subscription not found');
    }

    // Cancel in PayPal if it's a PayPal subscription
    if (subscription.payment_provider === 'paypal' && subscription.payment_provider_subscription_id) {
      try {
        await paypalService.cancelSubscription(subscription.payment_provider_subscription_id, reason);
      } catch (paypalError: any) {
        console.warn('PayPal cancellation failed, but continuing with database update:', paypalError);
        // Continue to update database even if PayPal cancellation fails
      }
    }

    // Update subscription status in database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }
  } catch (error) {
    console.error('Error cancelling PayPal subscription:', error);
    throw error;
  }
}

/**
 * Upgrade user to premium
 */
export async function upgradeToPremium(
  expiresAt?: Date,
  paymentProvider?: string,
  paymentProviderSubscriptionId?: string
): Promise<Subscription | null> {
  return createSubscription('premium', expiresAt, paymentProvider, paymentProviderSubscriptionId);
}

/**
 * Downgrade user to free
 */
export async function downgradeToFree(): Promise<Subscription | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Cancel active subscriptions
    await cancelActiveSubscriptions(user.id);

    // Create new free subscription
    return createSubscription('free');
  } catch (error) {
    console.error('Error downgrading to free:', error);
    throw error;
  }
}

/**
 * Check if subscription is expired and update status
 */
export async function checkAndUpdateExpiredSubscriptions(): Promise<void> {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error updating expired subscriptions:', error);
    }
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
  }
}

/**
 * Get user's current tier based on active subscription
 */
export async function getUserTier(): Promise<SubscriptionTier> {
  const subscription = await getActiveSubscription();
  return subscription?.tier || 'free';
}

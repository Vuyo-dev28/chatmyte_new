import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/auth-context';
import { LoginPage } from './components/login-page';
import { SignupPage } from './components/signup-page';
import { ChatInterface } from './components/chat-interface';
import { initializePayPal } from '../lib/subscriptions';
import { PAYPAL_CONFIG } from '../lib/paypal-config';
import { paypalService } from '../lib/paypal';
import { createClient } from '../lib/supabase';

function AppContent() {
  const { user, loading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [processingSubscription, setProcessingSubscription] = useState(false);
  const supabase = createClient();

  // Handle PayPal subscription callback
  useEffect(() => {
    const handlePayPalCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const subscriptionId = urlParams.get('subscription_id');
      const token = urlParams.get('token');

      // Check if this is a PayPal return URL (using query parameters)
      const subscriptionParam = urlParams.get('subscription');
      const isSuccessPage = subscriptionParam === 'success';
      const isCancelPage = subscriptionParam === 'cancel';

      if (isSuccessPage && (subscriptionId || token)) {
        setProcessingSubscription(true);

        try {
          let paypalSubscriptionId = subscriptionId;

          // If we have a token, extract subscription ID from it or query PayPal
          if (token && !paypalSubscriptionId) {
            // PayPal sometimes returns the subscription ID in the token or we need to query it
            // For now, try to find the pending subscription and update it
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
              // Find the most recent pending PayPal subscription
              const { data: subscriptions } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('payment_provider', 'paypal')
                .in('status', ['pending', 'active'])
                .order('created_at', { ascending: false })
                .limit(1);

              if (subscriptions && subscriptions.length > 0) {
                const subscription = subscriptions[0];
                paypalSubscriptionId = subscription.payment_provider_subscription_id || subscriptionId;

                if (paypalSubscriptionId) {
                  // Get subscription details from PayPal
                  try {
                    const paypalSub = await paypalService.getSubscription(paypalSubscriptionId);
                    
                    // Update subscription status
                    const { error: updateError } = await supabase
                      .from('subscriptions')
                      .update({
                        payment_provider_subscription_id: paypalSubscriptionId,
                        status: paypalSub.status === 'ACTIVE' || paypalSub.status === 'APPROVED' ? 'active' : 'pending',
                      })
                      .eq('id', subscription.id);

                    if (updateError) {
                      console.error('Error updating subscription:', updateError);
                    }
                  } catch (paypalError) {
                    console.error('Error fetching PayPal subscription:', paypalError);
                    // Still update status to active if we have the ID
                    await supabase
                      .from('subscriptions')
                      .update({ status: 'active' })
                      .eq('id', subscription.id);
                  }
                } else {
                  // No subscription ID yet, just activate the pending subscription
                  await supabase
                    .from('subscriptions')
                    .update({ status: 'active' })
                    .eq('id', subscription.id);
                }
              }
            }
          } else if (paypalSubscriptionId) {
            // We have a subscription ID, update the database
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
              const { data: subscriptions } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('payment_provider', 'paypal')
                .in('status', ['pending', 'active'])
                .order('created_at', { ascending: false })
                .limit(1);

              if (subscriptions && subscriptions.length > 0) {
                await supabase
                  .from('subscriptions')
                  .update({
                    payment_provider_subscription_id: paypalSubscriptionId,
                    status: 'active',
                  })
                  .eq('id', subscriptions[0].id);
              }
            }
          }

          // Clean up URL and redirect to home
          setTimeout(() => {
            window.history.replaceState({}, document.title, '/');
            window.location.reload(); // Reload to refresh user data
          }, 1000);
        } catch (error) {
          console.error('Error processing PayPal callback:', error);
          // Still redirect to main page
          setTimeout(() => {
            window.history.replaceState({}, document.title, '/');
            window.location.reload();
          }, 1000);
        }
      } else if (isCancelPage) {
        // User cancelled - clean up URL and redirect
        window.history.replaceState({}, document.title, '/');
      }
    };

    if (!loading) {
      handlePayPalCallback();
    }
  }, [loading]);

  // Show loading state while checking authentication or processing subscription
  if (loading || processingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-yellow-400">
            {processingSubscription ? 'Processing your subscription...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return showSignup ? (
      <SignupPage onSwitchToLogin={() => setShowSignup(false)} />
    ) : (
      <LoginPage onSwitchToSignup={() => setShowSignup(true)} />
    );
  }

  return <ChatInterface />;
}

export default function App() {
  useEffect(() => {
    // Initialize PayPal when app starts
    if (PAYPAL_CONFIG.clientId && PAYPAL_CONFIG.clientSecret && (PAYPAL_CONFIG.weeklyPlanId || PAYPAL_CONFIG.monthlyPlanId)) {
      try {
        initializePayPal({
          clientId: PAYPAL_CONFIG.clientId,
          clientSecret: PAYPAL_CONFIG.clientSecret,
          weeklyPlanId: PAYPAL_CONFIG.weeklyPlanId,
          monthlyPlanId: PAYPAL_CONFIG.monthlyPlanId,
          mode: PAYPAL_CONFIG.mode,
        });
        console.log('PayPal initialized successfully');
      } catch (error) {
        console.error('Failed to initialize PayPal:', error);
      }
    } else {
      console.warn('PayPal credentials not configured. Please update paypal-config.ts or .env file');
    }
  }, []);

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

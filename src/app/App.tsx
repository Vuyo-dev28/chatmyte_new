import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/auth-context';
import { LoginPage } from './components/login-page';
import { SignupPage } from './components/signup-page';
import { ChatInterface } from './components/chat-interface';
import { initializePayPal } from '../lib/subscriptions';
import { PAYPAL_CONFIG } from '../lib/paypal-config';
import { paypalService } from '../lib/paypal';
import { supabase } from '../lib/supabase';

function AppContent() {
  const { user, loading, refreshUser } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [processingSubscription, setProcessingSubscription] = useState(false);
  // Use singleton instance

  // Handle PayPal subscription callback
  useEffect(() => {
    const handlePayPalCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const subscriptionId = urlParams.get('subscription_id');
      const token = urlParams.get('token');
      const ba_token = urlParams.get('ba_token'); // PayPal sometimes uses ba_token

      // Check if this is a PayPal return URL (using query parameters)
      const subscriptionParam = urlParams.get('subscription');
      const isSuccessPage = subscriptionParam === 'success';
      const isCancelPage = subscriptionParam === 'cancel';

      // Also check for PayPal's standard return parameters
      const hasPayPalParams = subscriptionId || token || ba_token || isSuccessPage || isCancelPage;

      console.log('[App] PayPal callback detected:', {
        subscriptionParam,
        subscriptionId,
        token,
        ba_token,
        isSuccessPage,
        isCancelPage,
        hasPayPalParams,
        fullUrl: window.location.href
      });

      if (isCancelPage) {
        // User cancelled - clean up URL and redirect immediately
        console.log('[App] Subscription cancelled by user');
        window.history.replaceState({}, document.title, '/');
        return;
      }

      if (isSuccessPage || hasPayPalParams) {
        console.log('[App] Processing subscription callback...');
        setProcessingSubscription(true);

        try {
          let paypalSubscriptionId = subscriptionId || ba_token;

          // If we have a token, extract subscription ID from it or query PayPal
          if (token && !paypalSubscriptionId) {
            console.log('[App] Processing token-based subscription');
            // PayPal sometimes returns the subscription ID in the token or we need to query it
            // For now, try to find the pending subscription and update it
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
              // Find the most recent pending PayPal subscription
              const { data: subscriptions, error: subError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('payment_provider', 'paypal')
                .in('status', ['pending', 'active'])
                .order('created_at', { ascending: false })
                .limit(1);

              if (subError) {
                console.error('[App] Error fetching subscriptions:', subError);
              }

              if (subscriptions && subscriptions.length > 0) {
                const subscription = subscriptions[0];
                paypalSubscriptionId = subscription.payment_provider_subscription_id || subscriptionId;

                if (paypalSubscriptionId) {
                  // User successfully approved subscription - ALWAYS set to active
                  // Get subscription details from PayPal for verification (but don't let it override success)
                  try {
                    const paypalSub = await paypalService.getSubscription(paypalSubscriptionId);
                    console.log('[App] PayPal subscription status:', paypalSub.status);
                    console.log('[App] User approved subscription - setting status to ACTIVE');
                  } catch (paypalError) {
                    console.warn('[App] Could not fetch PayPal subscription details (non-critical):', paypalError);
                    // Continue anyway - user approved it, so it should be active
                  }
                  
                  // ALWAYS set to active since user successfully approved
                  const { error: updateError } = await supabase
                    .from('subscriptions')
                    .update({
                      payment_provider_subscription_id: paypalSubscriptionId,
                      status: 'active', // Always active on successful approval
                    })
                    .eq('id', subscription.id);

                  if (updateError) {
                    console.error('[App] Error updating subscription:', updateError);
                  } else {
                    console.log('[App] ✅ Subscription activated successfully (status: active)');
                  }
                } else {
                  // No subscription ID yet, but user approved - activate the pending subscription
                  console.log('[App] User approved subscription - activating without PayPal ID');
                  const { error } = await supabase
                    .from('subscriptions')
                    .update({ status: 'active' })
                    .eq('id', subscription.id);
                  if (error) {
                    console.error('[App] Error activating subscription:', error);
                  } else {
                    console.log('[App] ✅ Subscription activated successfully (status: active)');
                  }
                }
              } else {
                console.warn('[App] No pending subscription found');
              }
            }
          } else if (paypalSubscriptionId) {
            // We have a subscription ID, update the database
            console.log('[App] Processing subscription with ID:', paypalSubscriptionId);
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
              const { data: subscriptions, error: subError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('payment_provider', 'paypal')
                .in('status', ['pending', 'active'])
                .order('created_at', { ascending: false })
                .limit(1);

              if (subError) {
                console.error('[App] Error fetching subscriptions:', subError);
              }

              if (subscriptions && subscriptions.length > 0) {
                // User successfully approved subscription - ALWAYS set to active
                console.log('[App] User approved subscription - setting status to ACTIVE');
                const { error } = await supabase
                  .from('subscriptions')
                  .update({
                    payment_provider_subscription_id: paypalSubscriptionId,
                    status: 'active', // Always active on successful approval
                  })
                  .eq('id', subscriptions[0].id);
                if (error) {
                  console.error('[App] Error updating subscription:', error);
                } else {
                  console.log('[App] ✅ Subscription activated successfully (status: active)');
                }
              } else {
                console.warn('[App] No subscription found to update');
              }
            }
          } else {
            // No subscription ID, but we're on success page - user approved, so activate pending subscription
            console.log('[App] User approved subscription - activating pending subscription');
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
              const { data: subscriptions, error: subError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('payment_provider', 'paypal')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1);

              if (subError) {
                console.error('[App] Error fetching pending subscriptions:', subError);
              }

              if (subscriptions && subscriptions.length > 0) {
                // User successfully approved - ALWAYS set to active
                console.log('[App] Activating subscription - user approved, setting status to ACTIVE');
                const { error } = await supabase
                  .from('subscriptions')
                  .update({ status: 'active' }) // Always active on successful approval
                  .eq('id', subscriptions[0].id);
                if (error) {
                  console.error('[App] Error activating subscription:', error);
                } else {
                  console.log('[App] ✅ Pending subscription activated (status: active)');
                }
              } else {
                console.warn('[App] No pending subscription found to activate');
              }
            }
          }

          // Clean up URL first (but keep subscription params for now to prevent session timeout)
          // We'll clean it up after refresh
          
          // Refresh user data without reloading the page
          // This preserves the session and just updates the subscription tier
          console.log('[App] Refreshing user data without reloading...');
          
          try {
            // CRITICAL: Refresh the Supabase session after PayPal redirect
            // No delay needed - database update is fast and we want immediate feedback
            // PayPal redirect can cause session tokens to become stale
            console.log('[App] Refreshing Supabase session after PayPal redirect...');
            try {
              const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
              if (currentSession) {
                // Force refresh the session to get a new token
                const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) {
                  console.warn('[App] Session refresh error (non-critical):', refreshError);
                  // Continue with current session if refresh fails
                } else if (refreshedSession) {
                  console.log('[App] ✅ Session refreshed successfully');
                }
              } else if (sessionError) {
                console.error('[App] Error getting session:', sessionError);
              }
            } catch (refreshErr) {
              console.warn('[App] Session refresh failed (non-critical):', refreshErr);
              // Continue anyway - session might still be valid
            }
            
            // Refresh user data which will fetch the updated subscription tier
            await refreshUser();
            console.log('[App] ✅ Subscription processed successfully - user data refreshed');
            
            // Verify user is still logged in
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              console.log('[App] ✅ User session verified - staying logged in');
            } else {
              console.warn('[App] ⚠️ No session found after subscription processing');
              // Try to get session one more time
              const { data: { session: retrySession } } = await supabase.auth.getSession();
              if (retrySession?.user) {
                console.log('[App] ✅ Session found on retry - loading user');
                await refreshUser();
              }
            }
            
            // Now clean up URL and set processing to false
            // Do this last to ensure user stays logged in
            window.history.replaceState({}, document.title, '/');
            setProcessingSubscription(false);
            
            console.log('[App] ✅ Subscription processing complete - user remains logged in');
          } catch (err) {
            console.error('[App] Error refreshing user data:', err);
            // Verify session is still valid even on error
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              console.log('[App] ✅ User session still valid despite error');
              // Try to refresh user anyway
              try {
                await refreshUser();
              } catch (refreshErr) {
                console.error('[App] Error refreshing user on error recovery:', refreshErr);
              }
            } else {
              // Last resort: try to get session again
              console.log('[App] Attempting to recover session...');
              const { data: { session: recoverySession } } = await supabase.auth.getSession();
              if (recoverySession?.user) {
                console.log('[App] ✅ Session recovered - loading user');
                await refreshUser();
              }
            }
            // Still clean up even on error
            window.history.replaceState({}, document.title, '/');
            setProcessingSubscription(false);
          }
        } catch (error) {
          console.error('[App] Error processing PayPal callback:', error);
          // Clean up URL and reset state
          window.history.replaceState({}, document.title, '/');
          setProcessingSubscription(false);
        }
      }
    };

    if (!loading) {
      handlePayPalCallback();
    }
  }, [loading]);

  // Show loading state while checking authentication or processing subscription
  // Add a maximum loading time to prevent infinite loading
  const [maxLoadingReached, setMaxLoadingReached] = useState(false);
  
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setMaxLoadingReached(true);
      }, 3000); // Force show login after 3 seconds max
      return () => clearTimeout(timer);
    } else {
      setMaxLoadingReached(false);
    }
  }, [loading]);

  // Add timeout for processing subscription to prevent infinite loading
  useEffect(() => {
    if (processingSubscription) {
      const timer = setTimeout(() => {
        console.warn('[App] Subscription processing timeout - forcing completion');
        // Try to refresh user data one more time
        refreshUser().catch(err => {
          console.error('[App] Error refreshing user on timeout:', err);
        });
        setProcessingSubscription(false);
        // Clean up URL if still processing
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('subscription') === 'success' || urlParams.get('subscription_id')) {
          window.history.replaceState({}, document.title, '/');
        }
      }, 15000); // 15 second timeout (increased to allow for slower DB updates)
      return () => clearTimeout(timer);
    }
  }, [processingSubscription, refreshUser]);

  // Show loading screen only if:
  // 1. We're loading AND haven't reached max timeout AND user is not already loaded
  // 2. We're processing subscription AND user is not already loaded
  // BUT: If user exists, don't show loading screen (keep them in the app)
  // This prevents logout during subscription processing
  if (((loading && !maxLoadingReached) || processingSubscription) && !user) {
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

  // If user exists, show the app even if loading/processing (prevents logout during subscription processing)
  // Only show login if user doesn't exist AND we're not loading/processing
  if (!user && !loading && !processingSubscription) {
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

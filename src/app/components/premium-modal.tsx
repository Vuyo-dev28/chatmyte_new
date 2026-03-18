import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { useAuth } from './auth-context';
import { Crown, Check, Loader2, Sparkles } from 'lucide-react';
import { createPayPalSubscription } from '../../lib/subscriptions';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { PAYPAL_CONFIG } from '../../lib/paypal-config';
import { supabase } from '../../lib/supabase';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly'>('weekly');

  const [success, setSuccess] = useState(false);

  const planId = selectedPlan === 'weekly' ? PAYPAL_CONFIG.weeklyPlanId : PAYPAL_CONFIG.monthlyPlanId;

  const handleSuccess = async (subscriptionId: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Find the pending subscription or create/update the active one
      // The backend callback logic is still there as a fallback, 
      // but here we do it immediately for better UX
      const { error: updateError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          tier: 'premium',
          status: 'active',
          payment_provider: 'paypal',
          payment_provider_subscription_id: subscriptionId,
          started_at: new Date().toISOString(),
          // Default expiration if not calculated - mostly handled by server later
          expires_at: new Date(Date.now() + (selectedPlan === 'weekly' ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString()
        }, { onConflict: 'user_id, status' });

      if (updateError) throw updateError;
      
      setSuccess(true);
      await refreshUser();
      
      // Close modal after showing success for a bit
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error activating subscription:', err);
      setError('Subscription approved but activation failed. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-2 border-yellow-600/60 text-white w-[calc(100%-2rem)] sm:w-full max-w-md lg:max-w-lg xl:max-w-xl bg-black/92 backdrop-blur-xl shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto pb-6">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full mx-auto mb-3 sm:mb-4">
            <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-black" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl text-yellow-300 text-center drop-shadow-sm">
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription className="text-yellow-100/90 text-center text-sm sm:text-base">
            Unlock exclusive features and enhance your experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 my-3 sm:my-4 lg:my-5">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="mt-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-400" />
            </div>
            <div>
              <p className="text-yellow-100 font-medium text-sm sm:text-base">Filter by Gender</p>
              <p className="text-yellow-100/75 text-xs sm:text-sm">Choose who you want to connect with</p>
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-3">
            <div className="mt-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-400" />
            </div>
            <div>
              <p className="text-yellow-100 font-medium text-sm sm:text-base">Priority Matching</p>
              <p className="text-yellow-100/75 text-xs sm:text-sm">Connect faster with premium users</p>
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-3">
            <div className="mt-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-400" />
            </div>
            <div>
              <p className="text-yellow-100 font-medium text-sm sm:text-base">Ad-Free Experience</p>
              <p className="text-yellow-100/75 text-xs sm:text-sm">Enjoy uninterrupted conversations</p>
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-3">
            <div className="mt-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-400" />
            </div>
            <div>
              <p className="text-yellow-100 font-medium text-sm sm:text-base">Unlimited Skips</p>
              <p className="text-yellow-100/75 text-xs sm:text-sm">Find the perfect match without limits</p>
            </div>
          </div>
        </div>

        <div className="mb-3 sm:mb-4 lg:mb-5">
          {/* Plan Selection */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedPlan('weekly')}
              className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                selectedPlan === 'weekly'
                  ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                  : 'border-yellow-600/30 bg-black/40 text-yellow-200/70 hover:border-yellow-600/50'
              }`}
            >
              <div className="font-semibold text-sm sm:text-base">Weekly</div>
              <div className="text-xs sm:text-sm mt-0.5">$4.20/week</div>
            </button>
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                selectedPlan === 'monthly'
                  ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                  : 'border-yellow-600/30 bg-black/40 text-yellow-200/70 hover:border-yellow-600/50'
              }`}
            >
              <div className="font-semibold text-sm sm:text-base">Monthly</div>
              <div className="text-xs sm:text-sm mt-0.5">$9.99/month</div>
            </button>
          </div>

          {/* Pricing Card */}
          <div className="mx-auto w-full max-w-sm lg:max-w-md xl:max-w-lg rounded-xl border border-yellow-500/40 bg-gradient-to-br from-yellow-500/15 via-black/40 to-black/80 p-4 sm:p-5 lg:p-6 shadow-xl shadow-yellow-500/10">
            <div className="flex items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-black/60 px-3 py-1 text-xs sm:text-sm lg:text-base text-yellow-100/90">
                <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-yellow-400" />
                Premium Membership
              </div>
            </div>
            <div className="mt-3 lg:mt-4 text-center">
              <div className="flex items-end justify-center gap-1">
                <span className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-tight text-yellow-300 drop-shadow-sm">
                  {selectedPlan === 'weekly' ? '$4.20' : '$9.99'}
                </span>
                <span className="pb-1 text-sm sm:text-base lg:text-lg xl:text-xl text-yellow-100/80">
                  /{selectedPlan === 'weekly' ? 'week' : 'month'}
                </span>
              </div>
              {selectedPlan === 'monthly' && (
                <p className="mt-1 text-xs sm:text-sm lg:text-base text-yellow-100/70">
                  Save 40% with monthly plan
                </p>
              )}
              <p className="mt-1 text-xs sm:text-sm lg:text-base text-yellow-100/70">Cancel anytime</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 bg-green-500/10 border border-green-500/20 rounded-2xl animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/20">
                <Check className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Welcome to Premium!</h3>
              <p className="text-green-100/70 text-sm text-center px-6">
                Your subscription has been activated successfully. Enjoy exclusive features!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="relative min-h-[50px]">
                {loading && (
                   <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-xl">
                     <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                   </div>
                )}
                <PayPalButtons
                  style={{ 
                    layout: 'vertical',
                    color: 'gold',
                    shape: 'rect',
                    label: 'subscribe',
                    tagline: false
                  }}
                  disabled={loading}
                  createSubscription={(data, actions) => {
                    return actions.subscription.create({
                      plan_id: planId
                    });
                  }}
                  onApprove={async (data) => {
                    if (data.subscriptionID) {
                      await handleSuccess(data.subscriptionID);
                    }
                  }}
                  onError={(err) => {
                    console.error('PayPal Error:', err);
                    setError('An error occurred with PayPal. Please try again.');
                  }}
                  onCancel={() => {
                    setError('Subscription cancelled.');
                  }}
                />
              </div>
              
              <Button
                onClick={onClose}
                variant="ghost"
                className="w-full text-zinc-500 hover:text-white hover:bg-white/5 h-10 text-xs font-bold uppercase tracking-widest"
              >
                Maybe Later
              </Button>
            </div>
          )}
          {error && (
            <p className="text-red-400 text-xs text-center mt-3 animate-bounce">{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { useAuth } from './auth-context';
import { Crown, Check, Loader2 } from 'lucide-react';
import { createPayPalSubscription } from '../../lib/subscriptions';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly'>('weekly');

  const handleUpgrade = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      // Get current URL for return/cancel URLs
      // Use query parameters instead of paths since we don't have routing
      const baseUrl = window.location.origin;
      const returnUrl = `${baseUrl}/?subscription=success`;
      const cancelUrl = `${baseUrl}/?subscription=cancel`;

      // Create PayPal subscription with selected plan
      const { approvalUrl } = await createPayPalSubscription(
        user.email,
        returnUrl,
        cancelUrl,
        selectedPlan
      );

      // Redirect to PayPal approval page
      window.location.href = approvalUrl;
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      setError(err.message || 'Failed to create subscription. Please try again.');
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

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-yellow-600/60 bg-black/40 text-yellow-100 hover:bg-black/55 h-10 sm:h-11 text-sm sm:text-base"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black h-10 sm:h-11 text-sm sm:text-base disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Upgrade Now'
            )}
          </Button>
          {error && (
            <p className="text-red-400 text-sm text-center mt-2">{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

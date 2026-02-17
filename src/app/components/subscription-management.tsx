import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { useAuth } from './auth-context';
import { getActiveSubscription, cancelPayPalSubscription } from '../../lib/subscriptions';
import { Crown, X, Loader2, AlertTriangle } from 'lucide-react';
import type { Subscription } from '../../lib/subscriptions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export function SubscriptionManagement() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const activeSubscription = await getActiveSubscription();
      setSubscription(activeSubscription);
    } catch (err: any) {
      console.error('Error loading subscription:', err);
      setError('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = async () => {
    if (!subscription) return;

    setShowCancelDialog(false);
    setCancelling(true);
    setError('');

    try {
      await cancelPayPalSubscription(subscription.id, 'User requested cancellation');
      await loadSubscription(); // Reload to get updated status
      setCancelSuccess(true);
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setCancelSuccess(false);
      }, 5000);
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(err.message || 'Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!subscription || subscription.tier === 'free') {
    return (
      <div className="p-4 bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border border-yellow-600/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          <h3 className="text-yellow-300 font-semibold">Free Plan</h3>
        </div>
        <p className="text-yellow-200/70 text-sm">
          Upgrade to premium to unlock exclusive features
        </p>
      </div>
    );
  }

  const isActive = subscription.status === 'active';
  const expiresAt = subscription.expires_at 
    ? new Date(subscription.expires_at)
    : null;

  return (
    <div className="p-4 bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border border-yellow-600/30 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          <div>
            <h3 className="text-yellow-300 font-semibold">Premium Plan</h3>
            <p className="text-yellow-200/70 text-xs">
              Status: <span className={isActive ? 'text-green-400' : 'text-red-400'}>
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {expiresAt && (
        <p className="text-yellow-200/70 text-sm mb-3">
          {isActive ? 'Renews on' : 'Expires on'}: {expiresAt.toLocaleDateString()}
        </p>
      )}

      {subscription.payment_provider && (
        <p className="text-yellow-200/70 text-xs mb-3">
          Payment: {subscription.payment_provider.charAt(0).toUpperCase() + subscription.payment_provider.slice(1)}
        </p>
      )}

      {isActive && (
        <Button
          onClick={handleCancelClick}
          disabled={cancelling}
          variant="outline"
          className="w-full border-red-600/60 bg-red-900/20 text-red-300 hover:bg-red-900/30 h-9 text-sm"
        >
          {cancelling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Cancelling...
            </>
          ) : (
            <>
              <X className="w-4 h-4 mr-2" />
              Cancel Subscription
            </>
          )}
        </Button>
      )}

      {cancelSuccess && (
        <div className="mt-3 p-3 bg-green-900/30 border border-green-600/50 rounded-lg">
          <p className="text-green-300 text-sm">
            ✓ Your subscription has been cancelled. You will retain access until the end of your billing period.
          </p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-2">{error}</p>
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="border-2 border-red-600/60 bg-black/95 backdrop-blur-xl text-white">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <AlertDialogTitle className="text-xl text-red-300">
                Cancel Subscription?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-yellow-100/90 text-base pt-2">
              Are you sure you want to cancel your premium subscription? 
              <br /><br />
              You will lose access to premium features at the end of your billing period. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3 mt-4">
            <AlertDialogCancel className="border-yellow-600/60 bg-black/40 text-yellow-100 hover:bg-black/55">
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

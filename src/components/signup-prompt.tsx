'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Sparkles, History, Lock, CreditCard, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import { useSubscription } from '@/hooks/use-subscription';

interface SignupPromptProps {
  open: boolean;
  onClose: () => void;
  onSignUp: () => void;
  rateLimitContext?: 'anonymous' | 'free' | 'subscription' | null;
}

export function SignupPrompt({ open, onClose, onSignUp, rateLimitContext }: SignupPromptProps) {
  const user = useAuthStore((state) => state.user);
  const subscription = useSubscription();

  // Determine the context
  const isAnonymous = !user;
  const isFreeUser = user && subscription.tier === 'free';
  const isSubscriptionUser = subscription.tier === 'subscription';

  // Use rateLimitContext if provided, otherwise infer from user state
  const context = rateLimitContext || (isAnonymous ? 'anonymous' : isFreeUser ? 'free' : isSubscriptionUser ? 'subscription' : null);
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
          >
            <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent transition-colors z-10"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Content */}
              <div className="p-8">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center border border-primary/20">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-semibold text-center mb-2 text-foreground">
                  {context === 'anonymous' && 'Free Query Used'}
                  {context === 'free' && 'Daily Queries Used'}
                  {context === 'subscription' && 'Monthly Queries Used'}
                  {!context && 'Unlock the Full Experience'}
                </h2>

                {/* Subtitle */}
                <p className="text-center text-muted-foreground mb-6">
                  {context === 'anonymous' && 'Sign up to get 3 free queries per day!'}
                  {context === 'free' && 'Subscribe to a plan for more queries'}
                  {context === 'subscription' && 'You\'ve used all 100 monthly queries. Upgrade to pay-per-use for unlimited access.'}
                  {!context && 'Sign up to save your research and explore unlimited locations.'}
                </p>

                {/* Features */}
                <div className="space-y-4 mb-8">
                  {context === 'anonymous' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            3 Free Queries Per Day
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Create an account to get 3 deep research queries every day, completely free!
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                          <History className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            Save Your Research
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Access your research history anytime, anywhere.
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {(context === 'free' || context === 'subscription') && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            {context === 'subscription' ? 'Pay-Per-Use Plan' : 'Subscription Plan'}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {context === 'subscription'
                              ? '$0.25 per query - unlimited access, only pay for what you use'
                              : '$20/month for 100 queries (~$0.20 each) with 1 week free trial'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            Professional Research
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Access advanced AI models and priority processing
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {!context && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                          <History className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            Save Your Research History
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Never lose your discoveries. Access all research anytime.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            More Queries
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Free accounts get 3 queries per day. Upgrade for more access.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* CTA Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={onSignUp}
                    size="lg"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  >
                    {context === 'anonymous' && 'Create Free Account'}
                    {(context === 'free' || context === 'subscription') && 'View Plans'}
                    {!context && 'Create Free Account'}
                  </Button>
                  {!context && (
                    <Button
                      onClick={onClose}
                      variant="ghost"
                      size="lg"
                      className="w-full"
                    >
                      Continue Without Account
                    </Button>
                  )}
                </div>

                {/* Note */}
                <p className="text-center text-xs text-muted-foreground mt-4">
                  {context === 'anonymous' && 'Takes less than 30 seconds. No credit card required.'}
                  {context === 'free' && 'Reset at midnight. Subscribe for more queries now.'}
                  {context === 'subscription' && 'Resets on the 1st of each month.'}
                  {!context && 'Takes less than 30 seconds. No credit card required.'}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

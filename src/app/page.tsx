'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { track } from '@vercel/analytics';
import { CheckCircle, AlertCircle, Sparkles, Shuffle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, GlobeTheme } from '@/components/globe';
import { HistoryResearchInterface } from '@/components/history-research-interface';
import { RateLimitDialog } from '@/components/rate-limit-dialog';
import { useRateLimit } from '@/lib/hooks/use-rate-limit';
import { AuthModal } from '@/components/auth/auth-modal';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import { Sidebar } from '@/components/sidebar';
import BottomBar from '@/components/bottom-bar';
import { SignupPrompt } from '@/components/signup-prompt';

function HomeContent() {
  const { user, loading } = useAuthStore();
  const queryClient = useQueryClient();
  const { allowed, remaining, resetTime, increment } = useRateLimit();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showRateLimitDialog, setShowRateLimitDialog] = useState(false);
  const [rateLimitResetTime, setRateLimitResetTime] = useState(new Date());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ name: string; lat: number; lng: number; taskId?: string } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [globeTheme, setGlobeTheme] = useState<GlobeTheme>('satellite-streets-v12');
  const globeRef = useRef<any>(null);

  // Handle rate limit errors
  const handleRateLimitError = useCallback((resetTime: string) => {
    setRateLimitResetTime(new Date(resetTime));
    setShowRateLimitDialog(true);
  }, []);

  // Handle URL messages from auth callbacks
  useEffect(() => {
    const message = searchParams.get('message');
    const error = searchParams.get('error');

    if (message === 'email_updated') {
      setNotification({ type: 'success', message: 'Email address successfully updated!' });
      router.replace('/');
    } else if (message === 'email_link_expired') {
      setNotification({ type: 'error', message: 'Email confirmation link has expired. Please request a new email change.' });
      router.replace('/');
    } else if (error === 'auth_failed') {
      setNotification({ type: 'error', message: 'Authentication failed. Please try again.' });
      router.replace('/');
    }

    // Handle checkout success
    const checkoutSuccess = searchParams.get('checkout');
    if (checkoutSuccess === 'success') {
      setNotification({ type: 'success', message: 'Payment setup successful!' });
      queryClient.invalidateQueries({ queryKey: ['user-subscription'] });
      router.replace('/');
    }
  }, [searchParams, router, queryClient]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleLocationClick = useCallback((location: { name: string; lat: number; lng: number }, taskId?: string) => {
    console.log('Location clicked:', location);
    track('location_clicked', { location: location.name });

    // Check if user is signed in - BLOCK with signup prompt
    if (!user) {
      setPendingLocation({ ...location, taskId });
      setShowSignupPrompt(true);
      return;
    }

    // Check rate limit for signed-in users
    if (!allowed) {
      handleRateLimitError(resetTime?.toISOString() || new Date().toISOString());
      return;
    }

    setSelectedLocation(location);

    // Update URL with research ID if provided
    if (taskId) {
      const params = new URLSearchParams(window.location.search);
      params.set('research', taskId);
      window.history.pushState({}, '', `?${params.toString()}`);
    }
  }, [allowed, user, resetTime, handleRateLimitError]);

  const handleCloseResearch = useCallback(() => {
    setSelectedLocation(null);

    // Remove research ID from URL
    const params = new URLSearchParams(window.location.search);
    params.delete('research');
    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    window.history.pushState({}, '', newUrl);

    // Trigger popstate to update searchParams
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  // Handle URL-based research loading
  useEffect(() => {
    const researchId = searchParams.get('research');
    if (researchId && !selectedLocation) {
      // Fetch task data to get the actual location
      const fetchTaskData = async () => {
        try {
          const response = await fetch('/api/research/tasks');
          const { tasks } = await response.json();
          const task = tasks.find((t: any) => t.deepresearchId === researchId);

          if (task) {
            setSelectedLocation({
              name: task.locationName,
              lat: task.locationLat,
              lng: task.locationLng,
            });
            console.log('Loading research from URL:', researchId, task.locationName);
          } else {
            // Fallback if task not found
            setSelectedLocation({
              name: 'Loading research...',
              lat: 0,
              lng: 0,
            });
            console.log('Loading research from URL (task not found):', researchId);
          }
        } catch (error) {
          console.error('Failed to fetch task data:', error);
          // Fallback on error
          setSelectedLocation({
            name: 'Loading research...',
            lat: 0,
            lng: 0,
          });
        }
      };

      fetchTaskData();
    }
  }, [searchParams]); // Remove selectedLocation from deps to prevent re-opening

  // Handle show-auth-modal event from sidebar
  useEffect(() => {
    const handleShowAuthModal = () => {
      setShowAuthModal(true);
    };

    window.addEventListener('show-auth-modal', handleShowAuthModal);
    return () => window.removeEventListener('show-auth-modal', handleShowAuthModal);
  }, []);

  const handleFeelingLucky = useCallback(() => {
    // Check if user is signed in - BLOCK with signup prompt
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }

    // Check rate limit for signed-in users
    if (!allowed) {
      handleRateLimitError(resetTime?.toISOString() || new Date().toISOString());
      return;
    }

    if (globeRef.current) {
      globeRef.current.selectRandomLocation();
    }
  }, [allowed, user, resetTime, handleRateLimitError]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar globeTheme={globeTheme} onGlobeThemeChange={(theme) => setGlobeTheme(theme as GlobeTheme)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Clean Layout */}
        <header className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
          {/* Title Section - Centered */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center pt-12 pb-4 pointer-events-auto"
          >
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1 className="text-7xl font-light tracking-tight mb-4 relative">
                  <span className="font-serif italic bg-gradient-to-br from-white via-white/95 to-white/90 bg-clip-text text-transparent drop-shadow-lg">
                    History
                  </span>
                  <motion.div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-[2px] bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1, delay: 0.6 }}
                  />
                </h1>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-base text-white/90 font-light tracking-wide drop-shadow-md"
              >
                Discover the stories behind every place on Earth
              </motion.p>
            </div>
          </motion.div>

          {/* I'm Feeling Lucky - Top Right */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="absolute top-8 right-8 pointer-events-auto"
          >
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleFeelingLucky}
              className="group relative px-6 py-3 text-sm font-semibold bg-white/90 dark:bg-black/40 backdrop-blur-xl text-foreground border border-black/10 dark:border-white/15 rounded-full transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/20 hover:bg-white dark:hover:bg-black/60 hover:border-black/20 dark:hover:border-white/25 flex items-center gap-2.5"
            >
              <Shuffle className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
              <span>Random Location</span>
            </motion.button>
          </motion.div>
        </header>

        {/* Globe container */}
        <div className="flex-1 overflow-hidden relative">
          <Globe ref={globeRef} onLocationClick={handleLocationClick} theme={globeTheme} />
        </div>

        {/* Bottom bar */}
        <BottomBar />
      </div>

      {/* Research interface overlay */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <HistoryResearchInterface
              location={selectedLocation}
              onClose={handleCloseResearch}
              onTaskCreated={(taskId) => {
                // Update URL with research ID
                const params = new URLSearchParams(window.location.search);
                params.set('research', taskId);
                window.history.pushState({}, '', `?${params.toString()}`);
              }}
              initialTaskId={searchParams.get('research') || undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals and dialogs */}
      <SignupPrompt
        open={showSignupPrompt}
        onClose={() => {
          setShowSignupPrompt(false);
          // Continue without account - proceed with pending location
          if (pendingLocation) {
            setSelectedLocation(pendingLocation);
            if (pendingLocation.taskId) {
              const params = new URLSearchParams(window.location.search);
              params.set('research', pendingLocation.taskId);
              window.history.pushState({}, '', `?${params.toString()}`);
            }
            setPendingLocation(null);
          }
        }}
        onSignUp={() => {
          setShowSignupPrompt(false);
          setShowAuthModal(true);
        }}
      />

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSignUpSuccess={(message) => {
          setNotification({ type: 'success', message });
          setShowAuthModal(false);
        }}
      />

      <RateLimitDialog
        open={showRateLimitDialog}
        onOpenChange={setShowRateLimitDialog}
        resetTime={rateLimitResetTime}
      />

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50"
          >
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
                notification.type === 'success'
                  ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                  : notification.type === 'info'
                  ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                  : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : notification.type === 'info' ? (
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

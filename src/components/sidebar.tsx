'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import { createClient } from '@/utils/supabase/client-wrapper';
import {
  MessageSquare,
  MessagesSquare,
  MessageCirclePlus,
  History,
  Settings,
  LogOut,
  Trash2,
  CreditCard,
  BarChart3,
  Plus,
  Building2,
  MapPin,
  Loader,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/user/settings-modal';
import { SubscriptionModal } from '@/components/user/subscription-modal';
import { useSubscription } from '@/hooks/use-subscription';
import { EnterpriseContactModal } from '@/components/enterprise/enterprise-contact-modal';

interface SidebarProps {
  currentSessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
  onNewChat?: () => void;
  hasMessages?: boolean;
  globeTheme?: string;
  onGlobeThemeChange?: (theme: string) => void;
}

interface ResearchTask {
  id: string;
  deepresearchId: string;
  locationName: string;
  locationLat: number;
  locationLng: number;
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function Sidebar({
  currentSessionId,
  onSessionSelect,
  onNewChat,
  hasMessages = false,
  globeTheme,
  onGlobeThemeChange,
}: SidebarProps) {
  const { user } = useAuthStore();
  const signOut = useAuthStore((state) => state.signOut);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';

  // Keep dock open by default for everyone
  const [isOpen, setIsOpen] = useState(true);
  const [alwaysOpen, setAlwaysOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [showMapStyles, setShowMapStyles] = useState(false);

  // Fetch research tasks
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['research-tasks'],
    queryFn: async () => {
      if (isDevelopment) {
        const response = await fetch('/api/research/tasks');
        const { tasks } = await response.json();
        return tasks;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/research/tasks', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      const { tasks } = await response.json();
      return tasks;
    },
    enabled: isDevelopment || !!user,
    refetchInterval: 5000, // Refresh every 5 seconds to update status badges
  });

  const handleTaskSelect = useCallback((task: ResearchTask) => {
    // Navigate to the research by updating the URL
    const params = new URLSearchParams(window.location.search);
    params.set('research', task.deepresearchId);
    window.history.pushState({}, '', `?${params.toString()}`);

    // Trigger popstate event so URL change is detected
    window.dispatchEvent(new PopStateEvent('popstate'));

    setShowHistory(false);
  }, []);

  const handleNewResearch = useCallback(() => {
    // Clear the research from URL
    const params = new URLSearchParams(window.location.search);
    params.delete('research');
    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    window.history.pushState({}, '', newUrl);

    setShowHistory(false);
  }, []);

  const toggleSidebar = () => {
    if (alwaysOpen) return; // Don't allow closing if always open is enabled
    setIsOpen(!isOpen);
    if (isOpen) {
      setShowHistory(false); // Close history when closing sidebar
    }
  };

  // Keep sidebar open if alwaysOpen is enabled
  useEffect(() => {
    if (alwaysOpen) {
      setIsOpen(true);
    }
  }, [alwaysOpen]);

  // Listen for upgrade modal trigger from rate limit banner
  useEffect(() => {
    const handleShowUpgradeModal = () => setShowSubscription(true);
    window.addEventListener('show-upgrade-modal', handleShowUpgradeModal);
    return () => window.removeEventListener('show-upgrade-modal', handleShowUpgradeModal);
  }, []);

  const handleLogoClick = () => {
    // Check if there's an active research (research param in URL)
    const hasActiveResearch = new URLSearchParams(window.location.search).has('research');

    if (hasActiveResearch) {
      const confirmed = window.confirm(
        'Close current research and return to globe?'
      );

      if (confirmed) {
        handleNewResearch();
      }
      return;
    }

    // If on homepage without active research, just close history
    if (pathname === '/') {
      setShowHistory(false);
      return;
    }

    // If on other pages, navigate to home
    router.push('/');
  };

  const handleViewUsage = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/customer-portal', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        const { redirectUrl } = await response.json();
        window.open(redirectUrl, '_blank');
      }
    } catch (error) {
    }
  };

  // Get subscription status from database
  const subscription = useSubscription();
  const { isPaid } = subscription;

  return (
    <>
      {/* Chevron Toggle Button - Left Edge, Centered */}
      {!isOpen && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={toggleSidebar}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 w-10 h-16 flex items-center justify-center bg-white dark:bg-gray-900 border-r-2 border-t-2 border-b-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-r-2xl transition-all duration-200 shadow-lg hover:shadow-xl hover:w-12 group"
          title="Open Menu"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </motion.button>
      )}

      {/* macOS Dock-Style Navigation - Left Side */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300
            }}
            className="fixed left-6 top-1/2 -translate-y-1/2 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl border border-gray-200 dark:border-gray-700 rounded-[32px] shadow-2xl py-4 px-3"
          >
            <div className="flex flex-col items-center gap-2">
              {/* Always Open Toggle */}
              <div className="relative group/tooltip">
                <button
                  onClick={() => setAlwaysOpen(!alwaysOpen)}
                  className={`w-12 h-12 flex items-center justify-center rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95 ${
                    alwaysOpen
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <svg
                    className={`w-6 h-6 transition-colors ${
                      alwaysOpen
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {alwaysOpen ? 'Always Open (On)' : 'Always Open (Off)'}
                </div>
              </div>

              {/* Divider */}
              <div className="w-10 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />

              {/* Logo */}
              <div className="relative group/tooltip">
                <button
                  onClick={handleLogoClick}
                  className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <Image
                    src="/nabla.png"
                    alt="Home"
                    width={28}
                    height={28}
                    className="rounded-lg"
                  />
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  Home
                </div>
              </div>

              {/* Divider */}
              <div className="w-10 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />

              {/* New Research */}
              {(user || isDevelopment) && (
                <div className="relative group/tooltip">
                  <button
                    onClick={handleNewResearch}
                    className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                  >
                    <Plus className="h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    New Research
                  </div>
                </div>
              )}

                      {/* Research History */}
              <div className="relative group/tooltip">
                <button
                  onClick={() => {
                    if (!user && !isDevelopment) {
                      window.dispatchEvent(new CustomEvent('show-auth-modal'));
                    } else {
                      setShowHistory(!showHistory);
                    }
                  }}
                  className={`w-12 h-12 flex items-center justify-center rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95 ${
                    !user && !isDevelopment
                      ? 'opacity-50 cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800'
                      : showHistory
                        ? 'bg-gray-900 dark:bg-gray-100 shadow-lg'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <History className={`h-6 w-6 transition-colors ${
                    !user && !isDevelopment
                      ? 'text-gray-400 dark:text-gray-600'
                      : showHistory
                        ? 'text-white dark:text-gray-900'
                        : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {!user && !isDevelopment ? 'Sign up (free) for history' : 'Research History'}
                </div>
              </div>

              {/* Divider */}
              {user && !isDevelopment && <div className="w-10 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent my-1" />}

              {/* Billing/Subscription - Hidden in development mode */}
              {user && !isDevelopment && (
                <>
                  {!isPaid ? (
                    <div className="relative group/tooltip">
                      <button
                        onClick={() => setShowSubscription(true)}
                        className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                      >
                        <CreditCard className="h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
                      </button>
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        Upgrade
                      </div>
                    </div>
                  ) : (
                    <div className="relative group/tooltip">
                      <button
                        onClick={handleViewUsage}
                        className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                      >
                        <BarChart3 className="h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
                      </button>
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        Usage & Billing
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Enterprise */}
              {user && process.env.NEXT_PUBLIC_APP_MODE !== 'development' && process.env.NEXT_PUBLIC_ENTERPRISE === 'true' && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => setShowEnterpriseModal(true)}
                    className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                  >
                    <Building2 className="h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    Enterprise Solutions
                  </div>
                </div>
              )}

              {/* Map Style - For signed-in users */}
              {user && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => setShowMapStyles(!showMapStyles)}
                    className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                  >
                    <Globe2 className="h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    Map Style
                  </div>
                </div>
              )}

              {/* Settings */}
              {user && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                  >
                    <Settings className="h-6 w-6 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    Settings
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="w-10 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent mt-1" />

              {/* Log In Button for unauthenticated users */}
              {!user && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('show-auth-modal'));
                    }}
                    className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-blue-900/30 dark:to-emerald-900/30 hover:from-blue-100 hover:to-emerald-100 dark:hover:from-blue-900/40 dark:hover:to-emerald-900/40 rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95 border border-blue-200/50 dark:border-blue-800/50 relative"
                  >
                    <LogOut className="h-6 w-6 text-blue-600 dark:text-blue-400 rotate-180" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    Log in
                  </div>
                </div>
              )}

              {/* User Avatar with Dropdown */}
              {user && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95"
                  >
                    <Avatar className="h-9 w-9 ring-2 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600 transition-all">
                      <AvatarImage src={user.user_metadata?.avatar_url} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 text-white dark:text-gray-900 font-semibold">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  {/* Only show tooltip when menu is NOT open */}
                  {!showProfileMenu && (
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      Account
                    </div>
                  )}

                  {/* Profile Dropdown */}
                  <AnimatePresence>
                    {showProfileMenu && (
                      <>
                        {/* Backdrop to close on click away */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowProfileMenu(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, x: -10, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-full ml-4 bottom-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-2 px-1 min-w-[220px] z-50"
                        >
                        {/* User Email */}
                        <div className="px-3 py-2.5 mb-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Signed in as</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {user.email}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

                        {/* Sign Out */}
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            const confirmed = window.confirm('Are you sure you want to sign out?');
                            if (confirmed) {
                              signOut();
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200"
                        >
                          <LogOut className="h-4 w-4" />
                          <span className="font-medium">Sign out</span>
                        </button>
                      </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Close Dock Button - Only show if not always open */}
              {!alwaysOpen && (
                <>
                  <div className="w-10 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent mt-2" />
                  <div className="relative group/tooltip">
                    <button
                      onClick={toggleSidebar}
                      className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95 mt-2"
                    >
                      <svg
                        className="w-5 h-5 text-gray-600 dark:text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      Close
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Research History Panel */}
      <AnimatePresence>
        {showHistory && (user || isDevelopment) && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
              onClick={() => setShowHistory(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300
              }}
              className="fixed left-20 top-4 bottom-4 w-72 bg-white dark:bg-gray-900 rounded-3xl z-50 shadow-xl ml-2 flex flex-col border border-gray-200 dark:border-gray-800"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Research History</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNewResearch}
                    className="h-8 w-8 p-0"
                    title="New Research"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Research Tasks List */}
              <ScrollArea className="flex-1 px-2">
                {loadingTasks ? (
                  <div className="space-y-2 p-2">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
                      />
                    ))}
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="flex items-center justify-center h-full p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      No research history yet.<br />Click anywhere on the globe to start researching!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-2">
                    {tasks.map((task: ResearchTask) => {
                      const StatusIcon = task.status === 'completed' ? CheckCircle2 : task.status === 'running' ? Loader : task.status === 'failed' ? AlertCircle : Clock;
                      const statusColor = task.status === 'completed' ? 'text-green-600 dark:text-green-400' : task.status === 'running' ? 'text-blue-600 dark:text-blue-400' : task.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400';
                      const statusBg = task.status === 'completed' ? 'bg-green-50 dark:bg-green-950/30' : task.status === 'running' ? 'bg-blue-50 dark:bg-blue-950/30' : task.status === 'failed' ? 'bg-red-50 dark:bg-red-950/30' : 'bg-gray-50 dark:bg-gray-800/30';

                      return (
                        <div
                          key={task.id}
                          onClick={() => handleTaskSelect(task)}
                          className="flex items-start gap-2.5 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 group cursor-pointer transition-colors"
                        >
                          <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {task.locationName}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {new Date(task.createdAt).toLocaleDateString()}
                            </div>
                            <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBg} ${statusColor}`}>
                              <StatusIcon className={`h-3 w-3 ${task.status === 'running' ? 'animate-spin' : ''}`} />
                              <span className="capitalize">{task.status}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <SubscriptionModal
        open={showSubscription}
        onClose={() => setShowSubscription(false)}
      />

      <EnterpriseContactModal
        open={showEnterpriseModal}
        onClose={() => setShowEnterpriseModal(false)}
      />

      {/* Map Styles Panel */}
      <AnimatePresence>
        {showMapStyles && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowMapStyles(false)}
            />
            <motion.div
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-24 top-1/2 -translate-y-1/2 z-50 w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Map Style</h3>
              <div className="space-y-2">
                {[
                  { value: 'satellite-streets-v12', label: 'Satellite Streets', description: 'Satellite imagery with labels' },
                  { value: 'satellite-v9', label: 'Satellite', description: 'Pure satellite imagery' },
                  { value: 'streets-v12', label: 'Streets', description: 'Classic street map' },
                  { value: 'outdoors-v12', label: 'Outdoors', description: 'Topographic style' },
                  { value: 'light-v11', label: 'Light', description: 'Minimal light theme' },
                  { value: 'dark-v11', label: 'Dark', description: 'Minimal dark theme' },
                  { value: 'navigation-day-v1', label: 'Navigation Day', description: 'Navigation optimized' },
                  { value: 'navigation-night-v1', label: 'Navigation Night', description: 'Night mode navigation' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onGlobeThemeChange?.(option.value);
                      setShowMapStyles(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                      globeTheme === option.value
                        ? 'bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-purple-500/10 border-l-2 border-violet-500'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

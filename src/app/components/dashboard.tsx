import React, { useState } from 'react';
import { useAuth } from './auth-context';
import { PremiumModal } from './premium-modal';
import { ProfileModal } from './profile-modal';
import { Button } from './ui/button';
import {
  LogOut,
  Video,
  Settings,
  User as UserIcon,
  ShieldCheck,
  MessageSquare,
  Users,
  ChevronDown,
  Crown,
  LayoutDashboard
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface DashboardProps {
  onStartChat: () => void;
  preferredGender: 'all' | 'male' | 'female' | 'other';
  setPreferredGender: (gender: 'all' | 'male' | 'female' | 'other') => void;
  onOpenAdmin: () => void;
  chatMode: 'video' | 'text';
  setChatMode: (mode: 'video' | 'text') => void;
}

export function Dashboard({
  onStartChat,
  preferredGender,
  setPreferredGender,
  onOpenAdmin,
  chatMode,
  setChatMode
}: DashboardProps) {
  const { user, logout } = useAuth();
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'subscription'>('profile');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isGenderMenuOpen, setIsGenderMenuOpen] = useState(false);

  if (!user) return null;

  const isAdmin = !!user.is_admin;

  const openProfile = (tab: 'profile' | 'subscription' = 'profile') => {
    setProfileTab(tab);
    setIsProfileModalOpen(true);
    setIsUserMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-yellow-500/30">
      {/* --- Navigation Bar --- */}
      <nav className="border-b border-yellow-600/20 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/chatmyte_logo.png" alt="ChatMyte" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent">
              ChatMyte
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPremiumModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-600/30 bg-yellow-600/10 text-yellow-300 text-sm hover:bg-yellow-600/20 transition-all font-medium"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{user.tier === 'premium' ? 'Premium Active' : 'Upgrade'}</span>
            </button>

            {/* --- User Menu Dropdown --- */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-yellow-600/20 flex items-center justify-center border border-yellow-500/40">
                  <UserIcon className="w-4 h-4 text-yellow-400" />
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <>
                    {/* Backdrop for closing */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsUserMenuOpen(false)}
                    />

                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20 backdrop-blur-xl"
                    >
                      <div className="p-4 border-b border-white/5 bg-white/5">
                        <p className="text-sm font-bold text-white">{user.username}</p>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      </div>

                      <div className="p-2">
                        <button
                          onClick={() => openProfile('profile')}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Edit Profile
                        </button>

                        <button
                          onClick={() => openProfile('subscription')}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          <Crown className="w-4 h-4 text-yellow-500" />
                          Manage Subscription
                        </button>

                        {isAdmin && (
                          <button
                            onClick={onOpenAdmin}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-yellow-500 hover:bg-yellow-500/5 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            Admin Dashboard
                          </button>
                        )}

                        {user.tier !== 'premium' && (
                          <button
                            onClick={() => {
                              setIsPremiumModalOpen(true);
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-yellow-500 hover:bg-yellow-500/5 transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            Go Premium
                          </button>
                        )}

                        <div className="h-px bg-white/5 my-2" />

                        <button
                          onClick={logout}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-400/5 transition-colors text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* --- Left Column: Profile & Stats --- */}
          <div className="hidden lg:block lg:col-span-1 space-y-6">
            <div className="p-6 rounded-2xl border border-yellow-600/20 bg-gradient-to-b from-yellow-900/10 to-transparent backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-yellow-600/20 border-2 border-yellow-500/40 flex items-center justify-center overflow-hidden">
                  <UserIcon className="w-8 h-8 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-yellow-100">{user.username}</h2>
                  <p className="text-yellow-200/50 text-sm">{user.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-100/80">Gender</span>
                  </div>
                  <span className="text-sm font-medium text-yellow-300 capitalize">{user.gender || 'Not set'}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-100/80">Membership</span>
                  </div>
                  <span className={`text-sm font-medium capitalize ${user.tier === 'premium' ? 'text-yellow-300' : 'text-yellow-200/50'}`}>
                    {user.tier}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => openProfile('profile')}
                className="w-full mt-6 border-yellow-600/20 bg-white/5 text-yellow-200 hover:bg-white/10"
              >
                <Settings className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </div>

          {/* --- Right Column: Main Action --- */}
          <div className="lg:col-span-2 space-y-8">
            <div className="relative p-8 sm:p-12 rounded-3xl border border-yellow-600/30 overflow-hidden group">
              {/* Background Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-yellow-500/10 blur-[100px] pointer-events-none group-hover:bg-yellow-500/15 transition-all duration-700" />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-yellow-400 rounded-2xl flex items-center justify-center mb-6 rotate-3 group-hover:rotate-6 transition-transform shadow-2xl shadow-yellow-500/40">
                  <MessageSquare className="w-10 h-10 text-black" />
                </div>

                <h1 className="text-3xl sm:text-4xl font-black mb-4 bg-gradient-to-r from-white to-yellow-200 bg-clip-text text-transparent italic">
                  READY TO CONNECT?
                </h1>

                {/* --- Chat Mode Selection --- */}
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-6 w-full max-w-sm">
                  <button
                    onClick={() => setChatMode('video')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${chatMode === 'video'
                        ? 'bg-yellow-500 text-black font-bold shadow-lg'
                        : 'text-zinc-500 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <Video className="w-4 h-4" />
                    <span className="text-sm">Video Chat</span>
                  </button>
                  <button
                    onClick={() => setChatMode('text')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${chatMode === 'text'
                        ? 'bg-yellow-500 text-black font-bold shadow-lg'
                        : 'text-zinc-500 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm">Text Only</span>
                  </button>
                </div>

                <p className="text-yellow-100/60 max-w-md mb-8 text-lg">
                  {chatMode === 'video'
                    ? 'Meet interesting people from around the world instantly via random video chat.'
                    : 'Connect with people instantly through anonymous text messaging.'}
                </p>

                {/* --- Matching Preferences (Dropdown Style) --- */}
                <div className="w-full max-w-sm mb-8">
                  <div className="relative">
                    <button
                      onClick={() => setIsGenderMenuOpen(!isGenderMenuOpen)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center border border-yellow-500/40">
                          <Users className="w-4 h-4 text-yellow-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest leading-none mb-1">Looking for</p>
                          <p className="text-sm font-bold text-white leading-none capitalize">
                            {preferredGender === 'all' ? 'Everyone' : preferredGender}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isGenderMenuOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isGenderMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsGenderMenuOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute bottom-full mb-3 w-full bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20"
                          >
                            {(['all', 'male', 'female', 'other'] as const).map((g) => (
                              <button
                                key={g}
                                onClick={() => {
                                  if (user.tier !== 'premium' && g !== 'all') {
                                    setIsPremiumModalOpen(true);
                                    setIsGenderMenuOpen(false);
                                    return;
                                  }
                                  setPreferredGender(g);
                                  setIsGenderMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${preferredGender === g ? 'bg-yellow-500 text-black font-bold' : 'text-zinc-300 hover:bg-white/5'
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="capitalize">{g === 'all' ? 'Everyone' : g}</span>
                                  {user.tier !== 'premium' && g !== 'all' && (
                                    <ShieldCheck className="w-3 h-3 text-yellow-500/60" />
                                  )}
                                </div>
                                {preferredGender === g && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <Button
                  onClick={onStartChat}
                  className="px-10 h-14 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold text-lg rounded-full shadow-xl shadow-yellow-500/20 hover:scale-105 active:scale-95 transition-all w-full max-w-sm"
                >
                  START CHATTING NOW
                </Button>

                <p className="mt-6 text-xs text-yellow-200/40 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3 text-yellow-500/50" />
                  Encrypted & Secure Peer-to-Peer Connection
                </p>
              </div>
            </div>

            {/* Quick Tips/Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-yellow-500/30 transition-colors">
                <h3 className="font-bold text-yellow-100 mb-1">Global Community</h3>
                <p className="text-sm text-yellow-100/50">Connect with millions of active users worldwide.</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-yellow-500/30 transition-colors">
                <h3 className="font-bold text-yellow-100 mb-1">Instant Matches</h3>
                <p className="text-sm text-yellow-100/50">Zero wait time with our high-speed matching algorithm.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileTab}
      />
    </div>
  );
}

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
  LayoutDashboard,
  Zap,
  Play
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface DashboardProps {
  onStartChat: (mode: 'video' | 'text') => void;
  preferredGender: 'all' | 'male' | 'female' | 'other';
  setPreferredGender: (gender: 'all' | 'male' | 'female' | 'other') => void;
  onOpenAdmin: () => void;
}

export function Dashboard({ onStartChat, preferredGender, setPreferredGender, onOpenAdmin }: DashboardProps) {
  const { user, logout } = useAuth();
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'subscription'>('profile');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'video' | 'text'>('video');

  if (!user) return null;

  const isAdmin = !!user.is_admin;

  const openProfile = (tab: 'profile' | 'subscription' = 'profile') => {
    setProfileTab(tab);
    setIsProfileModalOpen(true);
    setIsUserMenuOpen(false);
  };

  return (
    <div className="h-[100dvh] bg-[#5B46F2] bg-gradient-to-br from-[#5B46F2] via-[#4F39CC] to-[#3924A8] text-white selection:bg-yellow-500/30 overflow-hidden flex flex-col">
      
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-white rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-yellow-400 rounded-full blur-[100px]" />
      </div>

      {/* --- Navigation Bar --- */}
      <nav className="h-16 sm:h-20 flex items-center justify-between px-6 sm:px-12 relative z-50 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/chatmyte_logo.png" alt="ChatMyte" className="w-10 h-10 object-contain drop-shadow-lg" />
          <span className="text-2xl font-black italic tracking-tighter uppercase">ChatMyte</span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsPremiumModalOpen(true)}
            className="hidden sm:flex items-center gap-2 px-6 py-2 rounded-full bg-yellow-400 text-black text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-yellow-400/20"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{user.tier === 'premium' ? 'Premium active' : 'Go Premium'}</span>
          </button>

          {/* --- User Menu --- */}
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <UserIcon className="w-5 h-5 text-white" />
            </button>

            <AnimatePresence>
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-72 bg-[#1a1a2e]/90 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden z-20 p-4"
                  >
                    <div className="p-4 mb-2">
                       <h4 className="text-white font-black italic uppercase tracking-tighter text-xl">{user.username}</h4>
                       <p className="text-white/40 text-xs font-bold uppercase tracking-widest">{user.tier} member</p>
                    </div>

                    <div className="space-y-1">
                      <button onClick={() => openProfile('profile')} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition-all">
                        <Settings className="w-4 h-4" /> Profile Settings
                      </button>
                      
                      <button onClick={() => openProfile('subscription')} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition-all">
                        <Crown className="w-4 h-4 text-yellow-400" /> Subscription
                      </button>
                      
                      {isAdmin && (
                        <button onClick={onOpenAdmin} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-yellow-500 hover:bg-yellow-500/10 transition-all">
                          <LayoutDashboard className="w-4 h-4" /> Admin Controls
                        </button>
                      )}

                      <div className="h-px bg-white/5 my-2 mx-4" />
                      
                      <button onClick={logout} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-red-400 hover:bg-red-400/10 transition-all">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 pt-8 pb-4 sm:pt-4 sm:pb-16 relative z-10 flex flex-col sm:justify-center overflow-y-auto sm:overflow-hidden">
        <div className="flex flex-col items-center">
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="text-center mt-4 mb-6 sm:mt-0 sm:mb-16 shrink-0"
           >
             <h1 className="text-3xl sm:text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-1 sm:mb-4">
               Meet people <span className="text-yellow-400">instantly</span>
             </h1>
             <p className="text-white/60 text-xs sm:text-xl font-bold uppercase tracking-widest">
               Choose your mode and start the party
             </p>
           </motion.div>

           {/* --- Main Action Cards --- */}
           <div className="grid sm:grid-cols-2 gap-4 sm:gap-8 w-full max-w-5xl shrink-1">
              
              {/* Video Chat Card */}
              <motion.button 
                whileHover={{ scale: 1.02, rotate: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setChatMode('video');
                  onStartChat('video');
                }}
                className={`relative group h-48 sm:h-[28rem] rounded-3xl sm:rounded-[3.5rem] overflow-hidden border-4 transition-all ${
                  chatMode === 'video' ? 'border-yellow-400 shadow-2xl shadow-yellow-400/20' : 'border-white/10 hover:border-white/30'
                }`}
              >
                <img 
                  src="https://images.unsplash.com/photo-1516724562728-afc824a36e84?auto=format&fit=crop&q=80&w=800" 
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" 
                  alt="Video mode"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${chatMode === 'video' ? 'from-[#5B46F2] via-transparent' : 'from-black/80 via-transparent'}`} />
                
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 flex flex-col justify-end items-start text-left">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-4 transition-colors ${
                    chatMode === 'video' ? 'bg-yellow-400 text-black' : 'bg-white/20 text-white'
                  }`}>
                    <Video size={20} className="sm:hidden" />
                    <Video size={28} className="hidden sm:block" />
                  </div>
                  <h3 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tighter text-white leading-none whitespace-nowrap sm:whitespace-normal">Video <br className="hidden sm:block" /> Chat</h3>
                  <p className="mt-1 sm:mt-2 text-white/60 font-bold uppercase tracking-widest text-[10px]">Real-time face-to-face</p>
                </div>

                {chatMode === 'video' && (
                  <div className="absolute top-8 right-8 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    Selected
                  </div>
                )}
              </motion.button>

              {/* Text Chat Card */}
              <motion.button 
                whileHover={{ scale: 1.02, rotate: 1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setChatMode('text');
                  onStartChat('text');
                }}
                className={`relative group h-48 sm:h-[28rem] rounded-3xl sm:rounded-[3.5rem] overflow-hidden border-4 transition-all ${
                  chatMode === 'text' ? 'border-yellow-400 shadow-2xl shadow-yellow-400/20' : 'border-white/10 hover:border-white/30'
                }`}
              >
                <img 
                  src="https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?auto=format&fit=crop&q=80&w=800" 
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" 
                  alt="Text mode"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${chatMode === 'text' ? 'from-[#5B46F2] via-transparent' : 'from-black/80 via-transparent'}`} />
                
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 flex flex-col justify-end items-start text-left">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-4 transition-colors ${
                    chatMode === 'text' ? 'bg-yellow-400 text-black' : 'bg-white/20 text-white'
                  }`}>
                    <MessageSquare size={20} className="sm:hidden" />
                    <MessageSquare size={28} className="hidden sm:block" />
                  </div>
                  <h3 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tighter text-white leading-none whitespace-nowrap sm:whitespace-normal">Text <br className="hidden sm:block" /> Only</h3>
                  <p className="mt-1 sm:mt-2 text-white/60 font-bold uppercase tracking-widest text-[10px]">Secure chat connection</p>
                </div>

                {chatMode === 'text' && (
                  <div className="absolute top-6 right-6 sm:top-8 sm:right-8 bg-yellow-400 text-black text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 sm:px-3 py-1 rounded-full">
                    Selected
                  </div>
                )}
              </motion.button>

           </div>

           {/* --- Filters & Start Button --- */}
           <div className="mt-6 sm:mt-12 w-full max-w-sm flex flex-col gap-4 sm:gap-6 shrink-0">
              
              <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl sm:rounded-[2rem] p-3 sm:p-4 flex items-center justify-between">
                 <div className="flex items-center gap-3 sm:gap-4 pl-1 sm:pl-2">
                    <div className="p-1.5 sm:p-2 bg-yellow-400 rounded-lg sm:rounded-xl">
                       <Users className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                    </div>
                    <div className="text-left">
                       <p className="text-[9px] sm:text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Looking for</p>
                       <p className="text-xs sm:text-sm font-black text-white uppercase italic tracking-tighter">
                          {preferredGender === 'all' ? 'Everyone' : preferredGender}
                       </p>
                    </div>
                 </div>

                 <div className="flex gap-1 pr-1">
                    {(['all', 'male', 'female'] as const).map((g) => (
                       <button
                         key={g}
                         onClick={() => {
                            if (user.tier !== 'premium' && g !== 'all') {
                               setIsPremiumModalOpen(true);
                               return;
                            }
                            setPreferredGender(g);
                         }}
                         className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-xs sm:text-sm font-black transition-all ${
                            preferredGender === g ? 'bg-yellow-400 text-black' : 'text-white/40 hover:text-white hover:bg-white/10'
                         }`}
                       >
                          {g === 'all' ? <Zap size={14} /> : g.charAt(0).toUpperCase()}
                       </button>
                    ))}
                 </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onStartChat(chatMode)}
                className="w-full h-16 sm:h-20 bg-white text-[#5B46F2] rounded-2xl sm:rounded-[2rem] flex items-center justify-center gap-3 sm:gap-4 shadow-2xl shadow-black/20 group"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#5B46F2] rounded-lg sm:rounded-xl flex items-center justify-center text-white group-hover:rotate-12 transition-transform">
                   <Play size={16} className="fill-current sm:hidden" />
                   <Play size={20} className="fill-current hidden sm:block" />
                </div>
                <span className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter">Enter {chatMode}</span>
              </motion.button>

              <div className="flex items-center justify-center gap-2 opacity-50 mb-4 sm:mb-0">
                 <ShieldCheck className="w-3 h-3 text-white" />
                 <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Safe & Anonymous connection</span>
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

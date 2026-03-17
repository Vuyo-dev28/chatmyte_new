import React, { useState } from 'react';
import { useAuth } from './auth-context';
import { SubscriptionManagement } from './subscription-management';
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
  Users
} from 'lucide-react';

interface DashboardProps {
  onStartChat: () => void;
}

export function Dashboard({ onStartChat }: DashboardProps) {
  const { user, logout } = useAuth();
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-yellow-500/30">
      {/* --- Navigation Bar --- */}
      <nav className="border-b border-yellow-600/20 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent">
              ChatMyte
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPremiumModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-600/30 bg-yellow-600/10 text-yellow-300 text-sm hover:bg-yellow-600/20 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{user.tier === 'premium' ? 'Premium Active' : 'Upgrade'}</span>
            </button>
            <Button
              variant="ghost"
              onClick={logout}
              className="text-yellow-200/60 hover:text-yellow-100 hover:bg-white/5"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- Left Column: Profile & Stats --- */}
          <div className="lg:col-span-1 space-y-6">
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
                onClick={() => setIsProfileModalOpen(true)}
                className="w-full mt-6 border-yellow-600/20 bg-white/5 text-yellow-200 hover:bg-white/10"
              >
                <Settings className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>

            <SubscriptionManagement />
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
                
                <p className="text-yellow-100/60 max-w-md mb-8 text-lg">
                  Meet interesting people from around the world instantly via random video chat.
                </p>

                <Button 
                  onClick={onStartChat}
                  className="px-10 h-14 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold text-lg rounded-full shadow-xl shadow-yellow-500/20 hover:scale-105 active:scale-95 transition-all"
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
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { Button } from './ui/button';
import { SubscriptionManagement } from './subscription-management';
import { 
  User, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Users,
  Smile,
  Crown,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'subscription';
}

export function ProfileModal({ isOpen, onClose, initialTab = 'profile' }: ProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription'>(initialTab);
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('18');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (user && isOpen) {
      setUsername(user.username || '');
      setGender(user.gender || 'male');
      setAge((user.age || 18).toString());
      setSuccess(false);
      setError('');
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 18) {
        setError('Age must be at least 18');
        setLoading(false);
        return;
      }

      await updateProfile({ username, gender, age: ageNum });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-yellow-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Settings</h2>
                  <p className="text-zinc-500 text-xs">Manage your account & membership</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex px-6 border-b border-white/5 bg-black/20">
              <button 
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 transition-all text-sm font-bold ${
                  activeTab === 'profile' 
                    ? 'border-yellow-500 text-yellow-500' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <User size={16} />
                Profile
              </button>
              <button 
                onClick={() => setActiveTab('subscription')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 transition-all text-sm font-bold ${
                  activeTab === 'subscription' 
                    ? 'border-yellow-500 text-yellow-500' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Crown size={16} />
                Membership
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
              {activeTab === 'profile' ? (
                /* Form */
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Username Input */}
                  <div className="space-y-2">
                    <label htmlFor="username" className="text-sm font-medium text-zinc-400 ml-1">
                      Username
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-yellow-400 transition-colors">
                        <User size={18} />
                      </div>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Age Input */}
                  <div className="space-y-2">
                    <label htmlFor="age" className="text-sm font-medium text-zinc-400 ml-1">
                      Age
                    </label>
                    <div className="relative group">
                      <input
                        id="age"
                        type="number"
                        min="18"
                        max="100"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="Your age"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Gender Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400 ml-1">
                      Gender
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['male', 'female', 'other'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={`py-3 px-2 rounded-2xl border transition-all text-sm font-bold capitalize ${
                            gender === g
                              ? 'bg-yellow-500 border-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                              : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status Messages */}
                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                      >
                        <AlertCircle size={16} />
                        <span>{error}</span>
                      </motion.div>
                    )}
                    {success && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm"
                      >
                        <CheckCircle2 size={16} />
                        <span>Profile updated successfully!</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={loading || success}
                    className={`w-full py-6 rounded-2xl font-bold shadow-xl transition-all ${
                      success 
                        ? 'bg-green-500 hover:bg-green-500' 
                        : 'bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black'
                    }`}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : success ? (
                      <CheckCircle2 className="w-5 h-5 mx-auto" />
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </form>
              ) : (
                <div className="p-6">
                   <SubscriptionManagement />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

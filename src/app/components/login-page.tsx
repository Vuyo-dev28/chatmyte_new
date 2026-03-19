import React, { useState } from 'react';
import { useAuth } from './auth-context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Video, Sparkles, LogIn, Github } from 'lucide-react';
import { SEO } from './SEO';
import { motion, AnimatePresence } from 'motion/react';

interface LoginPageProps {
  onSwitchToSignup: () => void;
}

export function LoginPage({ onSwitchToSignup }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmitting) return;
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await login(email, password);
      if (!success) {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEO 
        title="Login | ChatMyte - #1 Monkey Alternative | Meet New Friends Face-to-Face"
        description="Sign in to ChatMyte, the ultimate video chat app. Start connecting with strangers instantly with high-quality video and text chat."
      />
      
      <div className="min-h-screen bg-[#5B46F2] bg-gradient-to-br from-[#5B46F2] via-[#4F39CC] to-[#3924A8] overflow-hidden relative flex items-center justify-center">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-400 rounded-full blur-[120px]" />
          <div className="grid grid-cols-12 gap-8 w-full h-full p-20 rotate-12 scale-150">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className="text-white text-[10px] font-black opacity-20 uppercase tracking-widest italic select-none">
                ChatMyte
              </div>
            ))}
          </div>
        </div>
        
        {/* Floating Online Counter */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute top-4 sm:top-8 inset-x-0 flex justify-center z-50 pointer-events-none"
        >
          <div className="flex items-center gap-4 px-6 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">14,204 Online Now</span>
            </div>
            <div className="w-[1px] h-3 bg-white/20" />
            <span className="text-white text-[10px] font-black uppercase tracking-[0.2em] italic">Join the Party</span>
          </div>
        </motion.div>

        <div className="max-w-7xl w-full mx-auto px-6 py-8 lg:py-12 grid lg:grid-cols-2 gap-8 lg:gap-16 items-center relative z-10">
          
          {/* Left Column: Branding & Form */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img src="/chatmyte_logo.png" alt="ChatMyte" className="w-10 h-10 drop-shadow-lg" />
                <span className="text-white text-2xl font-black italic tracking-tighter">CHATMYTE</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-white leading-[0.95] tracking-tighter uppercase italic">
                Talk to friends <br/> <span className="text-yellow-400">face-to-face</span>
              </h1>
              <p className="text-white/80 text-base sm:text-lg font-medium max-w-sm leading-tight">
                Connect with anyone, anywhere, instantly. The best way to meet new people.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
              
              <h2 className="text-2xl font-black text-white mb-6 italic uppercase tracking-tighter">Welcome Back</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl px-4 focus:bg-white/10 focus:ring-yellow-400 transition-all text-base"
                    placeholder="Email Address"
                  />
                </div>
 
                <div className="space-y-1.5 text-right">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl px-4 focus:bg-white/10 focus:ring-yellow-400 transition-all text-base"
                    placeholder="Password"
                  />
                  <button type="button" className="text-white/50 text-[10px] hover:text-white transition-colors mt-1 font-bold uppercase tracking-widest px-1">Forgot Password?</button>
                </div>

                {error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm font-bold bg-red-400/10 p-3 rounded-xl border border-red-400/20"
                  >
                    {error}
                  </motion.p>
                )}

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-white hover:bg-zinc-100 text-[#5B46F2] h-12 rounded-xl text-lg font-black italic uppercase shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Entering...' : 'Enter App'}
                </Button>
              </form>
 
              <div className="mt-6 border-t border-white/10 pt-6 flex flex-col items-center gap-4">
                <p className="text-white/60 font-bold uppercase tracking-widest text-[9px]">
                  New around here?
                </p>
                <button
                  onClick={onSwitchToSignup}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-black h-10 rounded-xl text-xs font-black italic uppercase transition-all flex items-center justify-center gap-2 group/btn"
                >
                  Create an account
                  <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                    →
                  </motion.span>
                </button>
              </div>
            </div>

          </motion.div>

          {/* Right Column: Visual Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, x: 100 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="hidden lg:block relative"
          >
            {/* Floating Elements */}
            <motion.div 
               animate={{ y: [0, -20, 0] }}
               transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
               className="absolute -top-10 -right-10 z-20"
            >
               <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-3xl shadow-2xl scale-125">
                 <video autoPlay muted loop className="w-32 h-44 rounded-2xl object-cover bg-black/50" src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJocDNhYnB0bmZ5cmM5Z3M4Z3ZyZXR2ZXR2ZXR2ZXR2ZXR2ZXR2JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKVUn7iM8FMEU24/giphy.mp4" />
               </div>
            </motion.div>

            <div className="relative rounded-[3rem] overflow-hidden border-[10px] border-white/5 shadow-2xl scale-100">
               <img src="/mockup.png" alt="Chat Interface" className="w-full aspect-[4/5] object-cover" />
               <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-12">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-full border-4 border-yellow-400 overflow-hidden shadow-2xl">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
                     </div>
                     <div>
                        <h4 className="text-white text-2xl font-black italic uppercase tracking-tighter leading-none">Felix, 21</h4>
                        <p className="text-yellow-400 text-sm font-bold tracking-widest uppercase">Verified Match</p>
                     </div>
                  </div>
               </div>
               
               {/* Accent decoration */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ">
                  <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center shadow-2xl rotate-12">
                     <Video className="text-black w-10 h-10" />
                  </div>
               </div>
            </div>
            
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-white/5 rounded-full blur-[100px] pointer-events-none" />
          </motion.div>

        </div>
      </div>
    </>
  );
}

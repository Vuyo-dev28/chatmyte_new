import React, { useState } from 'react';
import { useAuth } from './auth-context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Video, UserPlus, Sparkles, ChevronRight } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { SEO } from './SEO';
import { motion } from 'motion/react';

interface SignupPageProps {
  onSwitchToLogin: () => void;
}

export function SignupPage({ onSwitchToLogin }: SignupPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('18');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    
    if (!email || !password || !username || !age) {
      setError('Please fill in all fields');
      return;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 18) {
      setError('You must be at least 18 years old');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await signup(email, password, username, gender, ageNum);
      if (!success) {
        setError('Signup failed. Please try again.');
      }
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        setError('Email already exists. Please login.');
      } else {
        setError(err.message || 'Signup failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEO 
        title="Join ChatMyte | Safe Monkey Alternative - Anonymous Random Video Chat"
        description="Create your free ChatMyte account. Experience the best random video chat. Secure, moderated, and premium 1-on-1 video calling."
      />
      
      <div className="min-h-screen bg-[#5B46F2] bg-gradient-to-br from-[#5B46F2] via-[#4F39CC] to-[#3924A8] overflow-hidden relative flex items-center justify-center">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-400 rounded-full blur-[120px]" />
          <div className="grid grid-cols-12 gap-8 w-full h-full p-20 rotate-12 scale-150">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className="text-white text-[10px] font-black opacity-20 uppercase tracking-widest italic select-none">
                Join Now
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
          
          {/* Left Column: Form */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="order-2 lg:order-1"
          >
            <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-2.5 bg-yellow-400 rounded-xl shadow-lg rotate-3 group-hover:rotate-0 transition-transform">
                    <UserPlus className="text-black w-5 h-5" />
                 </div>
                 <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">New Account</h2>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 rounded-lg px-4 focus:bg-white/10 focus:ring-yellow-400 transition-all text-sm"
                    placeholder="Username"
                  />
                  <Input
                    type="number"
                    min="18"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 rounded-lg px-4 focus:bg-white/10 focus:ring-yellow-400 transition-all text-sm"
                    placeholder="Age"
                  />
                </div>

                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 rounded-lg px-4 focus:bg-white/10 focus:ring-yellow-400 transition-all text-sm"
                  placeholder="Email Address"
                />
 
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 rounded-lg px-4 focus:bg-white/10 focus:ring-yellow-400 transition-all text-sm"
                  placeholder="Password (6+ chars)"
                />

                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <Label className="text-white/60 text-[9px] font-black uppercase tracking-widest mb-2 block">Choose Gender</Label>
                  <RadioGroup value={gender} onValueChange={(value) => setGender(value as 'male' | 'female' | 'other')} className="flex gap-4">
                    {['male', 'female', 'other'].map((g) => (
                       <div key={g} className="flex items-center gap-2">
                         <RadioGroupItem value={g} id={g} className="border-white/20 text-yellow-400 scale-90" />
                         <Label htmlFor={g} className="text-white text-xs font-bold uppercase cursor-pointer">{g}</Label>
                       </div>
                    ))}
                  </RadioGroup>
                </div>

                {error && (
                  <motion.p 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-red-400 text-xs font-bold bg-red-400/10 p-3 rounded-xl border border-red-400/20"
                  >
                    {error}
                  </motion.p>
                )}

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-white hover:bg-zinc-100 text-[#5B46F2] h-12 rounded-xl text-lg font-black italic uppercase shadow-xl transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Joining...' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <button
                  onClick={onSwitchToLogin}
                  className="text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  Already have an account? <span className="text-yellow-400 underline">Log In</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Branding & Mockup */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-12 order-1 lg:order-2"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img src="/chatmyte_logo.png" alt="ChatMyte" className="w-10 h-10" />
                <span className="text-white text-2xl font-black italic tracking-tighter">CHATMYTE</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-white leading-[0.95] tracking-tighter uppercase italic">
                The New Way <br/> <span className="text-yellow-400">to Connect</span>
              </h1>
              <p className="text-white/80 text-base font-medium max-w-sm">
                Safe, fun, and fast. Join ChatMyte today and start meeting thousands worldwide.
              </p>
            </div>

            <div className="relative rounded-[2.5rem] overflow-hidden border-[6px] border-white/5 shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-700">
               <img src="/mockup.png" alt="Experience" className="w-full aspect-video object-cover" />
               <div className="absolute inset-0 bg-gradient-to-t from-[#5B46F2]/80 to-transparent flex items-end p-8">
                  <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                     <Sparkles className="text-yellow-400 w-5 h-5" />
                     <span className="text-white text-xs font-black uppercase tracking-widest">Premium quality video</span>
                  </div>
               </div>
            </div>
          </motion.div>

        </div>
      </div>
    </>
  );
}

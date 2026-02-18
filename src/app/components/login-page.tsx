import React, { useState } from 'react';
import { useAuth } from './auth-context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Video, Sparkles } from 'lucide-react';

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
    
    if (isSubmitting) {
      return; // Prevent double submission
    }
    
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await login(email, password);
      if (!success) {
        setError('Login failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full mb-3 sm:mb-4">
            <Video className="w-6 h-6 sm:w-8 sm:h-8 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl text-yellow-400 mb-2">ChatMyte</h1>
          <p className="text-sm sm:text-base text-yellow-200/70">Meet new people instantly</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border-2 border-yellow-600/30 rounded-xl p-6 sm:p-8">
          <h2 className="text-lg sm:text-xl text-yellow-400 mb-4 sm:mb-6">Welcome Back</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-yellow-200 text-sm sm:text-base">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50 border-yellow-600/30 text-white placeholder:text-yellow-200/30 focus:border-yellow-500 h-10 sm:h-11 text-sm sm:text-base"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-yellow-200 text-sm sm:text-base">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/50 border-yellow-600/30 text-white placeholder:text-yellow-200/30 focus:border-yellow-500 h-10 sm:h-11 text-sm sm:text-base"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black h-10 sm:h-11 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-yellow-200/70 text-xs sm:text-sm">
              Don't have an account?{' '}
              <button
                onClick={onSwitchToSignup}
                className="text-yellow-400 hover:text-yellow-300 underline"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

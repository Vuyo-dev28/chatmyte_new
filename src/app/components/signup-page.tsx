import React, { useState } from 'react';
import { useAuth } from './auth-context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Video } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

interface SignupPageProps {
  onSwitchToLogin: () => void;
}

export function SignupPage({ onSwitchToLogin }: SignupPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [error, setError] = useState('');
  const { signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password || !username) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const success = await signup(email, password, username, gender);
      if (!success) {
        setError('Signup failed. Please try again.');
      }
    } catch (err: any) {
      // Handle specific Supabase errors
      if (err.message?.includes('already registered')) {
        setError('This email is already registered. Please login instead.');
      } else if (err.message?.includes('Invalid email')) {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Signup failed. Please try again.');
      }
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
          <p className="text-sm sm:text-base text-yellow-200/70">Join and start connecting</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border-2 border-yellow-600/30 rounded-xl p-6 sm:p-8">
          <h2 className="text-lg sm:text-xl text-yellow-400 mb-4 sm:mb-6">Create Account</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-yellow-200 text-sm sm:text-base">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-black/50 border-yellow-600/30 text-white placeholder:text-yellow-200/30 focus:border-yellow-500 h-10 sm:h-11 text-sm sm:text-base"
                placeholder="Choose a username"
              />
            </div>

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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/50 border-yellow-600/30 text-white placeholder:text-yellow-200/30 focus:border-yellow-500 h-10 sm:h-11 text-sm sm:text-base"
                placeholder="••••••••"
              />
            </div>

            <div>
              <Label className="text-yellow-200 mb-2 sm:mb-3 block text-sm sm:text-base">Gender</Label>
              <RadioGroup value={gender} onValueChange={(value) => setGender(value as 'male' | 'female' | 'other')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" className="border-yellow-600/50 text-yellow-500" />
                  <Label htmlFor="male" className="text-yellow-200/90 cursor-pointer text-sm sm:text-base">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" className="border-yellow-600/50 text-yellow-500" />
                  <Label htmlFor="female" className="text-yellow-200/90 cursor-pointer text-sm sm:text-base">Female</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" className="border-yellow-600/50 text-yellow-500" />
                  <Label htmlFor="other" className="text-yellow-200/90 cursor-pointer text-sm sm:text-base">Other</Label>
                </div>
              </RadioGroup>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black h-10 sm:h-11 text-sm sm:text-base"
            >
              Sign Up
            </Button>
          </form>

          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-yellow-200/70 text-xs sm:text-sm">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-yellow-400 hover:text-yellow-300 underline"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

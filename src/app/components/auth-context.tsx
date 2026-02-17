import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '../../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getUserTier, upgradeToPremium as upgradeSubscription } from '../../lib/subscriptions';

export type UserTier = 'free' | 'premium';

export interface User {
  id: string;
  email: string;
  username: string;
  tier: UserTier;
  gender?: 'male' | 'female' | 'other';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, username: string, gender: 'male' | 'female' | 'other') => Promise<boolean>;
  logout: () => Promise<void>;
  upgradeToPremium: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUser(session.user);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadUser = async (supabaseUser: SupabaseUser) => {
    try {
      // Get user metadata
      const metadata = supabaseUser.user_metadata || {};
      const username = metadata.username || supabaseUser.email?.split('@')[0] || 'User';
      const gender = metadata.gender || 'male';
      
      // Get tier from subscriptions table (fallback to metadata if not found)
      let tier: UserTier = 'free';
      try {
        const subscriptionTier = await getUserTier();
        tier = subscriptionTier;
      } catch (error) {
        // Fallback to metadata if subscription lookup fails
        tier = (metadata.tier || 'free') as UserTier;
        console.warn('Could not fetch subscription, using metadata tier:', error);
      }

      const userData: User = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        username,
        tier,
        gender: gender as 'male' | 'female' | 'other'
      };

      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const signup = async (email: string, password: string, username: string, gender: 'male' | 'female' | 'other') => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            gender,
            tier: 'free'
          }
        }
      });

      if (error) {
        console.error('Signup error:', error);
        throw error;
      }

      if (data.user) {
        await loadUser(data.user);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Login error:', error);
        throw error;
      }

      if (data.user) {
        await loadUser(data.user);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const upgradeToPremium = async () => {
    if (!user) return;

    try {
      // Create premium subscription in database
      const subscription = await upgradeSubscription();
      
      if (subscription) {
        // Also update user metadata for backward compatibility
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (supabaseUser) {
          await supabase.auth.updateUser({
            data: {
              ...supabaseUser.user_metadata,
              tier: 'premium'
            }
          });
        }

        setUser({ ...user, tier: 'premium' });
      } else {
        throw new Error('Failed to create premium subscription');
      }
    } catch (error) {
      console.error('Upgrade to premium failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, upgradeToPremium, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

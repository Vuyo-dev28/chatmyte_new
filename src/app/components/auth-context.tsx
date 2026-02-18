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
  signup: (
    email: string,
    password: string,
    username: string,
    gender: 'male' | 'female' | 'other'
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  upgradeToPremium: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔥 Load user profile from Supabase user object
  const loadUser = async (supabaseUser: SupabaseUser) => {
    try {
      const metadata = supabaseUser.user_metadata || {};
      const username =
        metadata.username ||
        supabaseUser.email?.split('@')[0] ||
        'User';
      const gender = metadata.gender || 'male';

      // Set user immediately with metadata tier (fast, no DB query)
      // Then update with actual subscription tier in background
      const initialTier = (metadata.tier || 'free') as UserTier;
      
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        username,
        tier: initialTier, // Show immediately
        gender,
      });

      // Fetch actual subscription tier in background (non-blocking)
      // This allows UI to render quickly while subscription status loads
      getUserTier()
        .then((actualTier) => {
          // Only update if tier changed (avoid unnecessary re-renders)
          setUser((prevUser) => {
            if (prevUser && prevUser.tier !== actualTier) {
              return { ...prevUser, tier: actualTier };
            }
            return prevUser;
          });
        })
        .catch((err) => {
          console.warn('Subscription lookup failed, using metadata tier:', err);
          // Keep using metadata tier if subscription lookup fails
        });
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  // 🔥 Core Auth Initialization
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (session?.user) {
        await loadUser(session.user);
      }

      setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        console.log('[Auth] Event:', event, 'Session:', !!session);

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          await loadUser(session.user);
        }

        setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 🔐 Auth Actions

  const signup = async (
    email: string,
    password: string,
    username: string,
    gender: 'male' | 'female' | 'other'
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          gender,
          tier: 'free',
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      await loadUser(data.user);
      return true;
    }

    return false;
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      await loadUser(data.user);
      return true;
    }

    return false;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const upgradeToPremium = async () => {
    if (!user) return;

    const subscription = await upgradeSubscription();
    if (!subscription) throw new Error('Failed to upgrade subscription');

    const { data: { user: supabaseUser } } = await supabase.auth.getUser();

    if (supabaseUser) {
      await supabase.auth.updateUser({
        data: {
          ...supabaseUser.user_metadata,
          tier: 'premium',
        },
      });
    }

    setUser({ ...user, tier: 'premium' });
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadUser(session.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        upgradeToPremium,
        refreshUser,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

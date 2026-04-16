import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { authService, User, UserRole } from '../services/authService';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, name: string, role: UserRole, department?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfileImage: (imageUri: string | null) => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshUser();
  }, []);

  const refreshUser = async () => {
    try {
      setLoading(true);
      const currentUser = await authService.getCurrentUser();
      
      if (currentUser?.isVirtual) {
        setUser(currentUser);
      } else if (currentUser) {
        // Fetch latest profile to check for status changes (like isApproved)
        const refreshedUser = await authService.refreshProfile(currentUser.id);
        if (refreshedUser) {
          setUser(refreshedUser);
        } else {
          // If profile fetch fails, fallback to local but check session
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            setUser(currentUser);
          } else {
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<User> => {
    const loggedInUser = await authService.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const signup = async (email: string, password: string, name: string, role: UserRole, department?: string) => {
    const newUser = await authService.signup(email, password, name, role, department);
    setUser(newUser);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const updateProfileImage = async (imageUri: string | null) => {
    const uploadedUrl = await authService.updateProfileImage(imageUri);
    if (user) {
      setUser({ ...user, profileImage: uploadedUrl || imageUri });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfileImage, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

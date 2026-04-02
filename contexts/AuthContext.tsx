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
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      // Wait for Supabase to recover session first
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      const currentUser = await authService.getCurrentUser();
      if (authUser && currentUser) {
        setUser(currentUser);
      } else if (!authUser) {
        // Session died or expired
        setUser(null);
      } else {
        setUser(currentUser);
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
    await authService.updateProfileImage(imageUri);
    if (user) {
      setUser({ ...user, profileImage: imageUri });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfileImage }}>
      {children}
    </AuthContext.Provider>
  );
}

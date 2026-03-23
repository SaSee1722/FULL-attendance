import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'dean' | 'staff';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  verified?: boolean;
  assignedClasses?: string[];
  profileImage?: string | null;
}

const AUTH_KEY = 'auth_user';

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('No user found after login');

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      if (profileError) console.error('Profile fetch error:', profileError);
      // Fallback if profile not found (maybe first login after DB reset)
      const user: User = {
        id: authData.user.id,
        email: authData.user.email!,
        name: authData.user.user_metadata?.name || email.split('@')[0],
        role: authData.user.user_metadata?.role || 'staff',
        department: authData.user.user_metadata?.department,
      };
      
      // Attempt to create the missing profile
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
        });
      } catch (e) {
        console.error('Failed to create fallback profile:', e);
      }

      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
      return user;
    }

    const user: User = {
      ...profile,
      assignedClasses: profile.assigned_classes,
    };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  },

  signup: async (email: string, password: string, name: string, role: UserRole, department?: string): Promise<User> => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, department },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Signup failed');

    // Profile is now created by a trigger in Supabase (see supabase_schema.sql)
    // But we'll verify it or create it if the trigger failed/wasn't run
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    let user: User;
    if (!profile) {
      // Manual creation if no trigger exists or hasn't finished
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email,
          name,
          role,
          department,
          verified: true,
        })
        .select()
        .single();
      
      if (createError) throw createError;
      user = {
        ...newProfile,
        assignedClasses: newProfile.assigned_classes,
      };
    } else {
      user = {
        ...profile,
        assignedClasses: profile.assigned_classes,
      };
    }

    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  },

  getCurrentUser: async (): Promise<User | null> => {
    const userJson = await AsyncStorage.getItem(AUTH_KEY);
    return userJson ? JSON.parse(userJson) : null;
  },

  logout: async (): Promise<void> => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(AUTH_KEY);
  },

  updateProfileImage: async (imageUri: string | null): Promise<void> => {
    const userJson = await AsyncStorage.getItem(AUTH_KEY);
    if (!userJson) return;
    
    const user: User = JSON.parse(userJson);
    user.profileImage = imageUri;
    
    // Update local storage
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
    
    // Update database (optional if real Supabase)
    const { error } = await supabase
      .from('profiles')
      .update({ profile_image: imageUri })
      .eq('id', user.id);
      
    if (error) console.error('Failed to update DB profile image:', error);
  },
};

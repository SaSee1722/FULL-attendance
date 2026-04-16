import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { cloudinaryService } from './cloudinaryService';

export type UserRole = 'admin' | 'hod' | 'staff';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  verified?: boolean;
  assignedClasses?: string[];
  profileImage?: string | null;
  isVirtual?: boolean;
  staffId?: string;
  isApproved?: boolean; // New: For HOD approval system
}

const AUTH_KEY = 'auth_user';

export const authService = {
  login: async (identifier: string, password: string): Promise<User> => {
    // 1. Check if it's a Staff ID Login (identifier doesn't look like email)
    if (!identifier.includes('@')) {
      const { data: managed, error } = await supabase
        .from('managed_staff')
        .select('*')
        .eq('staff_id', identifier)
        .eq('password', password)
        .maybeSingle();

      if (error) throw error;
      if (!managed) throw new Error('Invalid Staff ID or password');

      const user: User = {
        id: managed.id,
        email: managed.staff_id + '@attendx.virtual',
        staffId: managed.staff_id,
        name: managed.name,
        role: 'staff',
        department: managed.department,
        verified: true,
        isVirtual: true
      };
      
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
      return user;
    }

    // 2. Standard Email/Password Login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: identifier,
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
      const user: User = {
        id: authData.user.id,
        email: authData.user.email!,
        name: authData.user.user_metadata?.name || identifier.split('@')[0],
        role: authData.user.user_metadata?.role || 'staff',
        department: authData.user.user_metadata?.department,
      };
      
      await supabase.from('profiles').upsert({
        id: user.id, email: user.email, name: user.name,
        role: user.role, department: user.department,
      });

      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
      return user;
    }

    const user: User = {
      ...profile,
      assignedClasses: profile.assigned_classes,
      profileImage: profile.profile_image,
      isApproved: profile.is_approved,
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

    // Give the Supabase trigger ~1.5s to create the profile row
    await new Promise(res => setTimeout(res, 1500));

    // Check if the trigger already created the profile
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!profile) {
      // Trigger didn't run — manually upsert (safe against duplicate key)
      const { data: upserted, error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email,
          name,
          role,
          department: department || null,
          verified: true,
          is_approved: role === 'admin', // Admins are approved by default
        }, { onConflict: 'id' })
        .select()
        .single();

      if (upsertError) {
        // Upsert also failed — still let the user in using metadata
        console.error('Profile upsert error (non-fatal):', upsertError);
        const fallback: User = {
          id: authData.user.id,
          email,
          name,
          role,
          department,
          verified: true,
        };
        await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(fallback));
        return fallback;
      }
      profile = upserted;
    }

    const user: User = {
      ...profile,
      assignedClasses: profile.assigned_classes,
      profileImage: profile.profile_image,
      isApproved: profile.is_approved,
    };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  },


  getCurrentUser: async (): Promise<User | null> => {
    const userJson = await AsyncStorage.getItem(AUTH_KEY);
    if (!userJson) return null;
    const user = JSON.parse(userJson);
    // Map database 'dean' to 'hod' for backward compatibility
    if (user.role === 'dean') user.role = 'hod';
    
    // Ensure consistent mapping for boolean flags
    if (user.is_approved !== undefined) {
      user.isApproved = !!user.is_approved;
    }
    return user;
  },

  refreshProfile: async (userId: string): Promise<User | null> => {
    try {
      // Use maybeSingle but check strictly for data
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(); // Use single to ensure we get an error if not found

      if (error || !profile) {
        console.error('Refresh profile fetch error:', error);
        return null;
      }

      const user: User = {
        ...profile,
        assignedClasses: profile.assigned_classes,
        profileImage: profile.profile_image,
        isApproved: !!profile.is_approved, // Ensure strictly boolean
      };
      
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
      return user;
    } catch (e) {
      console.error('Refresh profile exception:', e);
      return null;
    }
  },

  logout: async (): Promise<void> => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(AUTH_KEY);
  },

  updateProfileImage: async (imageUri: string | null): Promise<string | null> => {
    const userJson = await AsyncStorage.getItem(AUTH_KEY);
    if (!userJson) return null;
    
    let finalUrl = imageUri;

    // If it's a local file and we have an imageUri, upload to Cloudinary
    if (imageUri && (imageUri.startsWith('file://') || imageUri.startsWith('content://') || !imageUri.startsWith('http'))) {
      try {
        finalUrl = await cloudinaryService.uploadImage(imageUri);
      } catch (e) {
        console.error('Cloudinary upload failed, falling back to local URI:', e);
        // Keep finalUrl as localUri if upload fails (though it won't be visible globally)
      }
    }

    const user: User = JSON.parse(userJson);
    user.profileImage = finalUrl;
    
    // Update local storage
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
    
    // Update database
    const profileUpdate = supabase
      .from('profiles')
      .update({ profile_image: finalUrl })
      .eq('id', user.id);

    // If it's a virtual account, also update managed_staff
    const managedUpdate = user.isVirtual
      ? supabase.from('managed_staff').update({ profile_image: finalUrl }).eq('id', user.id)
      : Promise.resolve({ error: null });
      
    const [pRes, mRes] = await Promise.all([profileUpdate, managedUpdate]);
      
    if (pRes.error && !user.isVirtual) {
      console.error('Failed to update DB profile image:', pRes.error);
      throw pRes.error;
    }
    
    if (mRes.error && user.isVirtual) {
      console.error('Failed to update managed_staff profile image:', mRes.error);
      throw mRes.error;
    }

    return finalUrl;
  },
};

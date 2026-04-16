import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserRole } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const router = useRouter();
  const { login, logout } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email || !password) {
      const fieldName = selectedRole === 'staff' ? 'Staff ID/Email' : 'email';
      showAlert('Error', `Please enter ${fieldName} and password`);
      return;
    }

    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      
      // FIX: Check for "Mis-mapped Admin" (Staff with no department trying to login as Admin)
      let finalUser = loggedInUser;
      if (loggedInUser.role === 'staff' && selectedRole === 'admin' && !loggedInUser.department) {
        // Automatically Promote to Admin permanently
        const { error: updError } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', loggedInUser.id);
        
        if (!updError) {
          finalUser = { ...loggedInUser, role: 'admin' };
          // Update local storage so splash screen etc work next time
          await AsyncStorage.setItem('auth_user', JSON.stringify(finalUser));
        }
      }

      // Role Mismatch Check
      if (finalUser.role !== selectedRole) {
        await logout();
        showAlert(
          'Incorrect Access', 
          `This account is registered as a ${finalUser.role.toUpperCase()}. Please select the correct role above to continue.`
        );
        setLoading(false);
        return;
      }

      // Navigate based on FINAL role
      switch (finalUser.role) {
        case 'admin':
          router.replace('/(admin)');
          break;
        case 'hod':
          router.replace('/(hod)');
          break;
        case 'staff':
          router.replace('/(staff)');
          break;
        default:
          router.replace('/auth/login');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error?.message || 'Invalid email or password. Please try again.';
      
      showAlert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const roles: { value: UserRole; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { value: 'admin', label: 'Admin', icon: 'security' },
    { value: 'hod', label: 'HOD', icon: 'account-balance' },
    { value: 'staff', label: 'Advisor', icon: 'groups' },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Image 
              source={require('../../assets/images/logo.png')} 
              style={{ width: 60, height: 60 }} 
              resizeMode="contain" 
            />
          </View>
          <Text style={styles.title}>Welcome to AttendX</Text>
          <Text style={styles.subtitle}>Institutional access for attendance management</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionLabel}>STAFF ROLE</Text>
          <View style={styles.roleSelector}>
            {roles.map((role) => {
              const isActive = selectedRole === role.value;
              return (
                <Pressable
                  key={role.value}
                  onPress={() => setSelectedRole(role.value)}
                  style={[
                    styles.roleItem,
                    isActive && styles.roleItemActive,
                  ]}
                >
                  <MaterialIcons 
                    name={role.icon} 
                    size={22} 
                    color={isActive ? colors.primaryBlue : colors.textSecondary} 
                  />
                  <Text style={[
                    styles.roleText,
                    isActive && styles.roleTextActive
                  ]}>
                    {role.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>
            {selectedRole === 'staff' ? 'Staff ID or Email' : 'Institutional Email'}
          </Text>
          <View style={styles.inputWrapper}>
            <Ionicons 
              name={selectedRole === 'staff' ? "card-outline" : "at-outline"} 
              size={20} 
              color={colors.textTertiary} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder={selectedRole === 'staff' ? "ST-2024-001" : "name@college.edu"}
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType={selectedRole === 'staff' ? "default" : "email-address"}
            />
          </View>

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.rightIcon}>
              <MaterialIcons 
                name={showPassword ? 'visibility' : 'visibility-off'} 
                size={20} 
                color={colors.textTertiary} 
              />
            </Pressable>
          </View>

          <Pressable 
            style={({ pressed }) => [
              styles.submitButton,
              shadows.md,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Signing in...' : 'Sign In to Dashboard'}
            </Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" style={styles.arrowIcon} />
          </Pressable>

          {selectedRole !== 'staff' && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>New to the platform? </Text>
              <Pressable onPress={() => router.push({
                pathname: '/auth/signup',
                params: { role: selectedRole }
              })}>
                <Text style={styles.footerLink}>Create an Account</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  iconBox: {
    width: 80,
    height: 80,
    backgroundColor: '#eff6ff',
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  form: {
    width: '100%',
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textPrimary,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    fontSize: 12,
  },
  roleSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  roleItemActive: {
    backgroundColor: colors.pureWhite,
    ...shadows.sm,
  },
  roleText: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
  },
  roleTextActive: {
    color: colors.primaryBlue,
    fontWeight: '700',
  },
  inputLabel: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 0,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
    height: '100%',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotText: {
    ...typography.label,
    color: colors.primaryBlue,
    fontSize: 12,
  },
  rightIcon: {
    padding: spacing.xs,
  },
  submitButton: {
    backgroundColor: colors.primaryBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  submitButtonText: {
    ...typography.h3,
    color: '#FFFFFF',
    fontSize: 18,
  },
  arrowIcon: {
    marginLeft: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    ...typography.bodySemibold,
    color: colors.primaryBlue,
    fontSize: 14,
  },
});

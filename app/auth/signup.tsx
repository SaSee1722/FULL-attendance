import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { UserRole } from '../../services/authService';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { role } = useLocalSearchParams<{ role: UserRole }>();
  const [selectedRole, setSelectedRole] = useState<UserRole>(role || 'hod');
  const [department, setDepartment] = useState('');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { signup } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const departments = [
    'Computer Science',
    'Electronics & Communication',
    'Mechanical Engineering',
    'Civil Engineering',
    'Information Technology',
    'Electrical Engineering',
  ];


  const handleSignup = async () => {
    if (!name || !email || !password) {
      showAlert('Error', 'Please fill all fields');
      return;
    }

    if ((selectedRole === 'hod' || selectedRole === 'staff') && !department) {
      showAlert('Error', 'Please select a department');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, name, selectedRole, department || undefined);
      
      switch (selectedRole) {
        case 'admin':
          router.replace('/(admin)');
          break;
        case 'hod':
          router.replace('/(hod)');
          break;
        case 'staff':
          router.replace('/(staff)');
          break;
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      const msg = error?.message || error?.error_description || 'Failed to create account';
      showAlert('Signup Failed', msg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={[styles.navHeader, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={32} color={colors.primaryBlue} />
        </Pressable>
        <Text style={styles.navTitle}>Account Registration</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Join our portal</Text>
        <Text style={styles.subtitle}>
          Enter your details to register as a {selectedRole === 'admin' ? 'Office Admin' : 'Head of Department'}. 
          {"\n\n"}
          <Text style={{ fontWeight: '700', color: colors.primaryBlue }}>Note to Advisors:</Text> Please contact your HOD to receive your Login ID and Password. Public signup is restricted for staff.
        </Text>

        <View style={styles.form}>

          <Text style={styles.inputLabel}>Full Name</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="person-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={selectedRole === 'admin' ? "John Doe" : "Dr. Jane Smith"}
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
            />
          </View>

          {(selectedRole === 'hod' || selectedRole === 'staff') && (
            <>
              <Text style={styles.inputLabel}>Department</Text>
              <Pressable 
                style={styles.inputWrapper} 
                onPress={() => setShowDeptModal(true)}
              >
                <MaterialIcons name="account-balance" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                <Text style={[
                  styles.input, 
                  { flex: 1, paddingVertical: 0, textAlignVertical: 'center' }, // Ensure no internal padding pushes text
                  !department && { color: colors.textTertiary }
                ]}>
                  {department || "Choose your department"}
                </Text>
                <MaterialIcons name="expand-more" size={24} color={colors.textTertiary} />
              </Pressable>
            </>
          )}

          <Text style={styles.inputLabel}>Institutional Email</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="at-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="jane.smith@college.edu"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <Text style={styles.inputLabel}>Create Password</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
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
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Creating Account...' : 'Register Account'}
            </Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" style={styles.arrowIcon} />
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={() => router.replace('/auth/login')}>
              <Text style={styles.footerLink}>Sign In</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Department Selection Modal */}
      <Modal
        visible={showDeptModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Department</Text>
              <Pressable onPress={() => setShowDeptModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <FlatList
              data={departments}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.deptItem}
                  onPress={() => {
                    setDepartment(item);
                    setShowDeptModal(false);
                  }}
                >
                  <Text style={[
                    styles.deptItemText,
                    department === item && styles.deptItemTextActive
                  ]}>
                    {item}
                  </Text>
                  {department === item && (
                    <MaterialIcons name="check" size={20} color={colors.primaryBlue} />
                  )}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  navTitle: {
    ...typography.label,
    color: colors.textPrimary,
    fontSize: 16,
  },
  backButtonPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  sectionLabel: {
    ...typography.label,
    color: colors.primaryBlue,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
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
    color: colors.textPrimary,
    marginLeft: spacing.xs,
    includeFontPadding: false,
    textAlignVertical: 'center',
    paddingVertical: 0,
    height: '100%',
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
    borderRadius: borderRadius.xl,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.pureWhite,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '60%',
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  deptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  deptItemText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  deptItemTextActive: {
    color: colors.primaryBlue,
    fontWeight: '600',
  },
});

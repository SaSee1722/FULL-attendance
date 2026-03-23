import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { UserRole } from '../../services/authService';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signup } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const departments = [
    'CSE',
    'ECE',
    'MECH',
    'CIVIL',
  ];

  const roles: { value: UserRole; label: string; color: string; bgColor: string }[] = [
    { value: 'admin', label: 'Office Admin', color: colors.admin, bgColor: colors.adminLight },
    { value: 'dean', label: 'Dean', color: colors.dean, bgColor: colors.deanLight },
    { value: 'staff', label: 'Staff', color: colors.staff, bgColor: colors.staffLight },
  ];

  const handleSignup = async () => {
    if (!name || !email || !password) {
      showAlert('Error', 'Please fill all fields');
      return;
    }

    if ((selectedRole === 'dean' || selectedRole === 'staff') && !department) {
      showAlert('Error', 'Please select a department');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, name, selectedRole, department);
      
      // Navigate based on selected role
      switch (selectedRole) {
        case 'admin':
          router.replace('/(admin)');
          break;
        case 'dean':
          router.replace('/(dean)');
          break;
        case 'staff':
          router.replace('/(staff)');
          break;
      }
    } catch (error) {
      showAlert('Signup Failed', error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        style={styles.header}
      >
        <View style={[styles.headerContent, { paddingTop: insets.top + spacing.lg }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Join Smart Attendance System</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="person" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <Text style={styles.label}>Select Role</Text>
          <View style={styles.roleContainer}>
            {roles.map((role) => (
              <Pressable
                key={role.value}
                style={[
                  styles.roleButton,
                  selectedRole === role.value && { backgroundColor: role.bgColor, borderColor: role.color },
                ]}
                onPress={() => setSelectedRole(role.value)}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    selectedRole === role.value && { color: role.color },
                  ]}
                >
                  {role.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {(selectedRole === 'dean' || selectedRole === 'staff') && (
            <>
              <Text style={styles.label}>Department</Text>
              <View style={styles.departmentContainer}>
                {departments.map((dept) => (
                  <Pressable
                    key={dept}
                    style={[
                      styles.deptButton,
                      department === dept && styles.deptButtonActive,
                    ]}
                    onPress={() => setDepartment(dept)}
                  >
                    <Text
                      style={[
                        styles.deptButtonText,
                        department === dept && styles.deptButtonTextActive,
                      ]}
                    >
                      {dept}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>{loading ? 'Creating Account...' : 'Create Account'}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.linkButton}>
            <Text style={styles.linkText}>Already have an account? Login</Text>
          </Pressable>
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
  header: {
    paddingBottom: spacing.xxl,
  },
  headerContent: {
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 28,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginLeft: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
  },
  roleContainer: {
    gap: spacing.sm,
  },
  roleButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
  },
  roleButtonText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  departmentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  deptButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.xs,
  },
  deptButtonActive: {
    backgroundColor: colors.admin,
    borderColor: colors.admin,
  },
  deptButtonText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  deptButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  button: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  linkButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  linkText: {
    ...typography.body,
    color: colors.admin,
  },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

export default function DeanProfile() {
  const { user, logout, updateProfileImage } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const handleEditProfilePic = () => {
    showAlert('Profile Picture', 'Would you like to change or remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Change Photo', 
        onPress: () => {
          // Using a high-quality unsplash URL as a mock updated photo
          updateProfileImage('https://images.unsplash.com/photo-1559170655-90596efae742?auto=format&fit=crop&q=80&w=200&h=200');
          showAlert('Success', 'Profile photo updated (simulated).');
        } 
      },
      { 
        text: 'Remove Photo', 
        style: 'destructive', 
        onPress: () => {
          updateProfileImage(null);
          showAlert('Removed', 'Profile photo has been removed.');
        } 
      },
    ]);
  };

  const handleLogout = () => {
    showAlert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.dean, '#059669']}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            <View style={styles.imageInner}>
              {user?.profileImage === null ? (
                <MaterialIcons name="account-circle" size={90} color="rgba(255,255,255,0.6)" />
              ) : (
                <Image 
                  source={user?.profileImage ? { uri: user.profileImage } : require('../../assets/images/profile_image.png')} 
                  style={styles.profileImage} 
                />
              )}
            </View>
            <TouchableOpacity 
              style={styles.editBadge} 
              onPress={handleEditProfilePic}
              activeOpacity={0.8}
            >
              <MaterialIcons name="camera-alt" size={18} color={colors.dean} />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{user?.name?.toUpperCase()}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <MaterialIcons name="verified" size={16} color="#FFFFFF" />
            <Text style={styles.roleText}>Verified Dean</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, shadows.md]}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          
          <View style={styles.infoRow}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <MaterialIcons name="badge" size={20} color={colors.dean} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Official Role</Text>
              <Text style={styles.infoValue}>Academic Dean</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
              <MaterialIcons name="apartment" size={20} color="#0284C7" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Current Department</Text>
              <Text style={styles.infoValue}>{user?.department || 'Not Assigned'}</Text>
            </View>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
              <MaterialIcons name="verified-user" size={20} color="#7C3AED" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Account Status</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Verified & Active</Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            shadows.sm,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleLogout}
        >
          <View style={styles.logoutIcon}>
            <MaterialIcons name="logout" size={20} color={colors.error} />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </View>
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
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    marginBottom: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageInner: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 60,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.md,
  },
  name: {
    ...typography.h1,
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: spacing.md,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  roleText: {
    ...typography.label,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.xl * 1.5,
  },
  sectionTitle: {
    ...typography.h2,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  logoutIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  logoutText: {
    ...typography.bodyMedium,
    color: colors.error,
    flex: 1,
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { colors, typography, spacing, shadows } from '../../constants/theme';

export default function AdminProfile() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [sessionTime, setSessionTime] = useState('00h 00m');

  useEffect(() => {
    // Simple mock session timer
    const start = Date.now();
    const interval = setInterval(() => {
      const diff = Date.now() - start;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      setSessionTime(`${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    showAlert('Logout', 'Are you sure you want to end your current session?', [
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

  const configItems = [
    { 
      icon: 'shield-outline', 
      label: 'Account Security', 
      color: '#3B82F6',
      onPress: () => showAlert('Security', 'Security settings are locked for your role.') 
    },
    { 
      icon: 'notifications-outline', 
      label: 'Notification Settings', 
      color: '#6366F1',
      onPress: () => showAlert('Notifications', 'Settings updated locally.') 
    },
    { 
      icon: 'business-outline', 
      label: 'Department Management', 
      color: '#10B981',
      onPress: () => showAlert('Management', 'Redirecting to Department Console...') 
    },
    { 
      icon: 'file-tray-full-outline', 
      label: 'Institutional Policies', 
      color: '#F59E0B',
      onPress: () => showAlert('Policies', 'Downloading latest policy handbook...') 
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBorder}>
              <View style={styles.avatarInner}>
                <FontAwesome5 name="user-tie" size={42} color={colors.admin} />
              </View>
            </View>
            <TouchableOpacity style={styles.editBtn}>
              <Feather name="edit-2" size={12} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.roleLabel}>OFFICE ADMINISTRATOR</Text>
          <Text style={styles.nameText}>{user?.name || 'System Admin'}</Text>
          <Text style={styles.idText}>ID: MS-ADMIN-2024-001</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={styles.statIconHeader}>
              <Ionicons name="shield-checkmark" size={18} color={colors.admin} />
            </View>
            <Text style={styles.statLabel}>TIER</Text>
            <Text style={styles.statValue}>Super Admin</Text>
          </View>
          
          <View style={styles.statBox}>
            <View style={styles.statIconHeader}>
              <Ionicons name="timer-outline" size={18} color="#6366F1" />
              <View style={styles.onlineBadge}>
                <Text style={styles.onlineText}>ONLINE</Text>
              </View>
            </View>
            <Text style={styles.statLabel}>SESSION</Text>
            <Text style={styles.statValue}>{sessionTime}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYSTEM CONFIGURATION</Text>
          
          {configItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.configCard} onPress={item.onPress}>
              <View style={[styles.configIconBox, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={styles.configLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LinearGradient
            colors={['#FEF2F2', '#FFF1F1']}
            style={styles.logoutGradient}
          >
            <MaterialIcons name="logout" size={20} color={colors.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.versionText}>VERSION 2.4.1 (STABLE BUILD)</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  profileHeader: { alignItems: 'center', marginBottom: spacing.xl },
  avatarContainer: { position: 'relative', marginBottom: spacing.md },
  avatarBorder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: 6,
    backgroundColor: '#FFF',
    ...shadows.sm,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.admin,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  roleLabel: { fontSize: 9, fontWeight: '900', color: colors.admin, letterSpacing: 0.8, marginBottom: 4 },
  nameText: { ...typography.h2, fontSize: 24, color: colors.textPrimary },
  idText: { ...typography.caption, fontSize: 13, color: colors.textTertiary, marginTop: 2, fontWeight: '700' },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: 12, marginBottom: spacing.xl },
  statBox: { 
    flex: 1, 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    padding: spacing.lg, 
    ...shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  statIconHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  onlineBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  onlineText: { fontSize: 8, fontWeight: '900', color: '#166534' },
  statLabel: { fontSize: 9, fontWeight: '900', color: colors.textTertiary, letterSpacing: 0.5 },
  statValue: { fontSize: 17, fontWeight: '900', color: colors.textPrimary, marginTop: 4 },
  section: { paddingHorizontal: spacing.xl },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1, marginBottom: spacing.lg },
  configCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  configIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  configLabel: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  logoutBtn: { marginHorizontal: spacing.xl, marginTop: spacing.xl },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoutText: { fontSize: 16, fontWeight: '800', color: colors.error },
  versionText: { 
    textAlign: 'center', 
    fontSize: 9, 
    fontWeight: '900', 
    color: colors.textTertiary, 
    marginTop: spacing.xl,
    letterSpacing: 0.5 
  },
});

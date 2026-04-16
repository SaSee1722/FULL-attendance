import React, { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

const PendingApprovalScreen = ({ onRefresh, onLogout }: { onRefresh: () => void, onLogout: () => void }) => (
  <View style={pendingStyles.container}>
    <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={pendingStyles.background}>
      <View style={pendingStyles.content}>
        <View style={pendingStyles.iconContainer}>
          <Ionicons name="time-outline" size={80} color={colors.primaryBlue} />
        </View>
        <Text style={pendingStyles.title}>Approval Pending</Text>
        <Text style={pendingStyles.subtitle}>
          Your HOD account has been created successfully and is now awaiting administrative approval.
        </Text>
        
        <View style={pendingStyles.infoCard}>
          <MaterialIcons name="info-outline" size={20} color={colors.primaryBlue} />
          <Text style={pendingStyles.infoText}>
            You will gain full access once an administrator verifies your department.
          </Text>
        </View>

        <TouchableOpacity style={pendingStyles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={pendingStyles.btnText}>Check Status Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={pendingStyles.logoutBtn} onPress={onLogout}>
          <Text style={pendingStyles.logoutText}>Sign Out from Account</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  </View>
);

const pendingStyles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { alignItems: 'center', width: '100%', maxWidth: 400 },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    ...shadows.sm,
  },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center', marginBottom: 12 },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 24 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F0F7FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0E7FF',
    marginBottom: 40,
  },
  infoText: { flex: 1, fontSize: 13, color: '#1E40AF', marginLeft: 12, lineHeight: 18, fontWeight: '500' },
  refreshBtn: {
    backgroundColor: colors.primaryBlue,
    width: '100%',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  logoutBtn: { marginTop: 20, padding: 12 },
  logoutText: { color: colors.textTertiary, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});

const HomeIcon = ({ active, color }: { active: boolean; color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Svg>
);

const ManagementIcon = ({ active, color }: { active: boolean; color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Circle cx="9" cy="7" r="4" />
    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

const ReportsIcon = ({ active, color }: { active: boolean; color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 3v18h18" />
    <Path d="M18 17V9" />
    <Path d="M13 17V5" />
    <Path d="M8 17v-3" />
  </Svg>
);

const ProfileIcon = ({ active, color }: { active: boolean; color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </Svg>
);

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBarContainer}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const renderIcon = () => {
            const color = isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)';
            switch (route.name) {
              case 'index': return <HomeIcon active={isFocused} color={color} />;
              case 'management': return <ManagementIcon active={isFocused} color={color} />;
              case 'reports': return <ReportsIcon active={isFocused} color={color} />;
              case 'profile': return <ProfileIcon active={isFocused} color={color} />;
              default: return null;
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              {renderIcon()}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function HODLayout() {
  const { user, loading, refreshUser, logout } = useAuth();
  const router = useRouter();

  // Real-time approval listener
  useEffect(() => {
    if (!user || user.isVirtual || user.isApproved) return;

    const channel = supabase
      .channel(`hod_approval_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          // Robust check for approval status change
          if (payload.new && payload.new.is_approved === true) {
            refreshUser();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.isApproved]);

  // Use useEffect for redirection to avoid render-time navigation issues (depth loops)
  useEffect(() => {
    if (!loading && (!user || (user.role !== 'hod' && user.role !== 'admin'))) {
      router.replace('/auth/login');
    }
  }, [user, loading, router]);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={colors.primaryBlue} />
    </View>
  );

  if (!user) return null;

  if (user.role === 'hod' && !user.isApproved) {
    const handleLogout = async () => {
      await logout();
      router.replace('/auth/login');
    };
    return <PendingApprovalScreen onRefresh={refreshUser} onLogout={handleLogout} />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="management" options={{ title: 'Management' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    width: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

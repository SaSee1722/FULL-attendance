import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import { StatCard } from '../../components/ui/StatCard';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

export default function AdminDashboard() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [statsData, activity] = await Promise.all([
        dataService.getStatistics(),
        dataService.getRecentActivity(),
      ]);
      setStats(statsData);
      setRecentActivity(activity || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadData();

      subsRef.current.forEach(s => s.unsubscribe());
      subsRef.current = [
        dataService.subscribeToTable('classes', loadData),
        dataService.subscribeToTable('students', loadData),
        dataService.subscribeToTable('profiles', loadData),
        dataService.subscribeToTable('attendance_records', loadData),
      ];

      return () => {
        subsRef.current.forEach(s => s.unsubscribe());
        subsRef.current = [];
      };
    }, [user, loadData])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.admin} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.admin, '#312E81']}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name}</Text>
            <View style={styles.roleBadge}>
              <MaterialIcons name="verified" size={14} color={colors.admin} />
              <Text style={styles.roleText}>OFFICE ADMIN</Text>
            </View>
          </View>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.avatarInner}
            >
              <MaterialIcons name="person" size={32} color="#FFFFFF" />
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <MaterialIcons name="info-outline" size={18} color={colors.textTertiary} />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon="class"
            label="Total Classes"
            value={stats.totalClasses}
            color={colors.admin}
            bgColor={colors.adminLight}
          />
          <StatCard
            icon="people"
            label="Total Students"
            value={stats.totalStudents}
            color={colors.info}
            bgColor={colors.infoLight}
          />
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            icon="person"
            label="Total Staff"
            value={stats.totalStaff}
            color={colors.dean}
            bgColor={colors.deanLight}
          />
          <StatCard
            icon="analytics"
            label="Avg Attendance"
            value={`${stats.averageAttendance}%`}
            color={colors.success}
            bgColor={colors.successLight}
          />
        </View>

        <Text style={styles.sectionTitle}>Today's Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.success }]} />
              <Text style={styles.summaryValue}>{stats.presentToday}</Text>
              <Text style={styles.summaryLabel}>Present</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.error }]} />
              <Text style={styles.summaryValue}>{stats.absentToday}</Text>
              <Text style={styles.summaryLabel}>Absent</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.info }]} />
              <Text style={styles.summaryValue}>{stats.onDutyToday}</Text>
              <Text style={styles.summaryLabel}>On-Duty</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Text style={styles.seeAllText}>See All</Text>
        </View>

        {recentActivity.length > 0 ? (
          recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <MaterialIcons name="notifications-none" size={18} color={colors.admin} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityMessage}>{activity.message}</Text>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <MaterialIcons name="history" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No recent activity found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  greeting: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  userName: {
    ...typography.h1,
    fontSize: 26,
    color: '#FFFFFF',
    marginVertical: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  roleText: {
    ...typography.label,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarInner: {
    flex: 1,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginTop: -20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 18,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.admin,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  summaryValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.adminLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activityTime: {
    ...typography.small,
    color: colors.textTertiary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.textTertiary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});

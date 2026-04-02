import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import { StatCard } from '../../components/ui/StatCard';
import { colors, typography, spacing, shadows } from '../../constants/theme';

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
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
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[colors.admin, '#2D3436']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>MANAGEMENT PORTAL</Text>
              <Text style={styles.userName}>{user?.name}</Text>
              <View style={styles.roleContainer}>
                <View style={styles.activeDot} />
                <Text style={styles.roleText}>Office Administrator</Text>
              </View>
            </View>
            <Pressable 
              onPress={() => router.push('/profile')}
              style={styles.avatarWrapper}
            >
              <View style={styles.avatarBorder}>
                <Image 
                  source={user?.profileImage ? { uri: user.profileImage } : require('../../assets/images/profile_image.png')} 
                  style={styles.avatarImage} 
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.statsSummary}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIndicator, { backgroundColor: colors.present }]} />
              <Text style={styles.summaryValue}>{stats.totalStudents}</Text>
              <Text style={styles.summaryLabel}>Students</Text>
            </View>
            <View style={styles.summaryVerticalDivider} />
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIndicator, { backgroundColor: colors.onDuty }]} />
              <Text style={styles.summaryValue}>{stats.totalClasses}</Text>
              <Text style={styles.summaryLabel}>Classes</Text>
            </View>
            <View style={styles.summaryVerticalDivider} />
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIndicator, { backgroundColor: colors.staff }]} />
              <Text style={styles.summaryValue}>{stats.totalStaff}</Text>
              <Text style={styles.summaryLabel}>Staff</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.iconBadge}>
            <MaterialIcons name="insights" size={16} color={colors.admin} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon="event-available"
            label="Attendance"
            value={`${stats.averageAttendance}%`}
            color={colors.success}
          />
          <StatCard
            icon="person"
            label="Active Staff"
            value={stats.totalStaff}
            color={colors.dean}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable 
            onPress={() => router.push('/(admin)/reports' as any)}
            style={styles.seeAllContainer}
          >
            <Text style={styles.seeAllText}>Reports</Text>
            <MaterialIcons name="arrow-forward" size={14} color={colors.admin} />
          </Pressable>
        </View>

        {recentActivity.length > 0 ? (
          recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <MaterialIcons name="notifications-active" size={18} color={colors.admin} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityMessage}>{activity.message}</Text>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
              <View style={styles.activityChevron}>
                <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="history" size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Activity</Text>
            <Text style={styles.emptyText}>Recent updates will appear here</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  headerContainer: {
    ...shadows.premium,
    backgroundColor: colors.admin,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  header: {
    paddingBottom: spacing.xxl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  greeting: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 10,
  },
  userName: {
    ...typography.h1,
    color: '#FFFFFF',
    fontSize: 32,
    marginTop: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CD964',
    marginRight: 6,
  },
  roleText: {
    ...typography.label,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarWrapper: {
    ...shadows.lg,
  },
  avatarBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  statsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    ...typography.h2,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  summaryIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
  },
  summaryLabel: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
    fontWeight: '700',
  },
  summaryVerticalDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
    color: '#1A1C1E',
    fontSize: 22,
    fontWeight: '800',
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${colors.admin}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seeAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.admin}10`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  seeAllText: {
    ...typography.label,
    color: colors.admin,
    fontWeight: '800',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F0F2F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  activityTime: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 4,
    fontWeight: '600',
  },
  activityChevron: {
    marginLeft: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: colors.surface,
    borderRadius: 32,
    ...shadows.sm,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: colors.border,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyText: {
    ...typography.body,
    color: colors.textTertiary,
    fontSize: 14,
  },
});

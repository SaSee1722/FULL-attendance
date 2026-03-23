import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData } from '../../services/dataService';
import { ClassCard } from '../../components/ui/ClassCard';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

export default function StaffDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [allClasses, activity] = await Promise.all([
        dataService.getClasses(),
        dataService.getRecentActivity(3),
      ]);

      const userClasses = allClasses.filter(
        cls => cls.advisor === user?.name
      );
      setAssignedClasses(userClasses);
      setRecentActivity(activity);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadData();

      subsRef.current.forEach(s => s.unsubscribe());
      subsRef.current = [
        dataService.subscribeToTable('classes', loadData),
        dataService.subscribeToTable('students', loadData),
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
        <ActivityIndicator size="large" color={colors.staff} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.staff, '#D97706']}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Hello</Text>
            <Text style={styles.userName}>{user?.name}</Text>
            <View style={styles.roleBadge}>
              <MaterialIcons name="verified" size={14} color={colors.staff} />
              <Text style={styles.roleText}>{(user?.department || 'General')} Staff Member</Text>
            </View>
          </View>
          <View style={styles.avatarContainer}>
            <MaterialIcons name="school" size={40} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>My Assigned Classes</Text>
        {assignedClasses.length > 0 ? (
          assignedClasses.map((classItem) => (
            <ClassCard
              key={classItem.id}
              name={classItem.name}
              advisor={classItem.advisor}
              studentCount={classItem.studentCount}
              attendanceRate={classItem.attendanceRate}
              onPress={() => router.push({
                pathname: '/class-detail/[id]',
                params: { id: classItem.id }
              })}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="info-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No classes assigned yet</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentActivity.map((activity) => (
          <View key={activity.id} style={styles.activityCard}>
            <View style={styles.activityIcon}>
              <MaterialIcons name="history" size={20} color={colors.staff} />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityMessage}>{activity.message}</Text>
              <Text style={styles.activityTime}>{activity.time}</Text>
            </View>
          </View>
        ))}
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
    paddingBottom: spacing.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  greeting: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  userName: {
    ...typography.h1,
    fontSize: 24,
    color: '#FFFFFF',
    marginVertical: spacing.xs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  roleText: {
    ...typography.label,
    fontSize: 11,
    color: colors.staff,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.staffLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  activityTime: {
    ...typography.small,
    color: colors.textSecondary,
  },
});

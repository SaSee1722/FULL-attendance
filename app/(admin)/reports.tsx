import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dataService, ClassData } from '../../services/dataService';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

export default function AdminReports() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [classData, statsData, logsData] = await Promise.all([
        dataService.getClasses(),
        dataService.getStatistics(),
        dataService.getAttendanceLogs(),
      ]);
      setClasses(classData);
      setStats(statsData);
      setAttendanceLogs(logsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (dateString === today) return 'Today';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

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
        colors={[colors.admin, '#8B5CF6']}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
        <Text style={styles.headerSubtitle}>Comprehensive attendance overview</Text>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Overall Statistics</Text>
        <View style={styles.overallCard}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.averageAttendance}%</Text>
              <Text style={styles.statLabel}>Average Attendance</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalClasses}</Text>
              <Text style={styles.statLabel}>Active Classes</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalStudents}</Text>
              <Text style={styles.statLabel}>Total Students</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalStaff}</Text>
              <Text style={styles.statLabel}>Active Staff</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Daily Attendance Logs</Text>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeText}>{attendanceLogs.length}</Text>
          </View>
        </View>

        {attendanceLogs.length > 0 ? (
          attendanceLogs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={styles.logIndicator} />
                <View style={styles.logClassInfo}>
                  <Text style={styles.logClassName}>{log.className}</Text>
                  <Text style={styles.logMeta}>{log.markedBy} • {formatDate(log.date)}</Text>
                </View>
                <View style={styles.logSessionBadge}>
                  <Text style={styles.logSessionText}>Session</Text>
                </View>
              </View>
              
              <View style={styles.logStats}>
                <View style={[styles.logStat, { backgroundColor: '#E1F8E1' }]}>
                  <MaterialIcons name="check-circle" size={14} color={colors.success} />
                  <Text style={[styles.logStatValue, { color: colors.success }]}>{log.present}</Text>
                  <Text style={styles.logStatLabel}>Present</Text>
                </View>
                <View style={[styles.logStat, { backgroundColor: '#FEEEEE' }]}>
                  <MaterialIcons name="cancel" size={14} color={colors.error} />
                  <Text style={[styles.logStatValue, { color: colors.error }]}>{log.absent}</Text>
                  <Text style={styles.logStatLabel}>Absent</Text>
                </View>
                <View style={[styles.logStat, { backgroundColor: '#FFF5E6' }]}>
                  <MaterialIcons name="work" size={14} color={colors.warning} />
                  <Text style={[styles.logStatValue, { color: colors.warning }]}>{log.onDuty}</Text>
                  <Text style={styles.logStatLabel}>On Duty</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="history" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No attendance records found.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Class-wise Performance</Text>
        {classes.map((classItem) => (
          <View key={classItem.id} style={[styles.classCard, shadows.sm]}>
            <View style={styles.classHeader}>
              <View style={styles.classIcon}>
                <MaterialIcons name="class" size={20} color={colors.admin} />
              </View>
              <View style={styles.classInfo}>
                <Text style={styles.className}>{classItem.name}</Text>
                <Text style={styles.classAdvisor}>{classItem.advisor}</Text>
              </View>
            </View>
            
            <View style={styles.classStats}>
              <View style={styles.classStatItem}>
                <MaterialIcons name="people" size={18} color={colors.textSecondary} />
                <Text style={styles.classStatText}>{classItem.studentCount} Students</Text>
              </View>
              <View style={styles.classStatItem}>
                <MaterialIcons name="apartment" size={18} color={colors.textSecondary} />
                <Text style={styles.classStatText}>{classItem.department}</Text>
              </View>
            </View>

            <View style={styles.attendanceBar}>
              <View style={styles.attendanceLabels}>
                <Text style={styles.attendanceLabel}>Overall Rate</Text>
                <Text style={[styles.attendanceValue, { color: getAttendanceColor(classItem.attendanceRate) }]}>
                  {classItem.attendanceRate}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${classItem.attendanceRate}%`,
                      backgroundColor: getAttendanceColor(classItem.attendanceRate),
                    },
                  ]} 
                />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const getAttendanceColor = (rate: number) => {
  if (rate >= 90) return colors.success;
  if (rate >= 75) return colors.warning;
  return colors.error;
};

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
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 24,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.xs,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgeCount: {
    backgroundColor: colors.adminLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    ...typography.label,
    fontSize: 10,
    color: colors.admin,
  },
  overallCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...typography.h1,
    color: colors.admin,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  logCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.admin,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.admin,
    marginRight: spacing.sm,
  },
  logClassInfo: {
    flex: 1,
  },
  logClassName: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  logMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logSessionBadge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  logSessionText: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
  },
  logStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  logStatValue: {
    ...typography.label,
    fontSize: 14,
    fontWeight: '700',
  },
  logStatLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.md,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  classCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  classIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.adminLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  classAdvisor: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  classStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  classStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  classStatText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  attendanceBar: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attendanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  attendanceLabel: {
    ...typography.label,
    fontSize: 12,
    color: colors.textSecondary,
  },
  attendanceValue: {
    ...typography.label,
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
});

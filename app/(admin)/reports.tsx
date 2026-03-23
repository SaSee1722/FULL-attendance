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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [classData, statsData] = await Promise.all([
        dataService.getClasses(),
        dataService.getStatistics(),
      ]);
      setClasses(classData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
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
        contentContainerStyle={{ paddingBottom: spacing.xl }}
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

        <Text style={styles.sectionTitle}>Class-wise Analysis</Text>
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
                <Text style={styles.attendanceLabel}>Attendance Rate</Text>
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
  overallCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
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

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

interface ClassCardProps {
  name: string;
  advisor: string;
  studentCount: number;
  attendanceRate: number;
  onPress?: () => void;
}

export function ClassCard({ name, advisor, studentCount, attendanceRate, onPress }: ClassCardProps) {
  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return colors.success;
    if (rate >= 75) return colors.warning;
    return colors.error;
  };

  const statusColor = getAttendanceColor(attendanceRate);

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.admin}10` }]}>
          <MaterialIcons name="school" size={26} color={colors.admin} />
        </View>
        <View style={styles.headerMain}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <View style={styles.advisorBadge}>
            <MaterialIcons name="person" size={14} color={colors.textTertiary} />
            <Text style={styles.advisor} numberOfLines={1}>{advisor}</Text>
          </View>
        </View>
        <View style={styles.chevronWrap}>
          <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Students</Text>
          <Text style={styles.statValue}>{studentCount}</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Avg Attendance</Text>
          <View style={styles.attendanceRow}>
            <Text style={[styles.statValue, { color: statusColor }]}>{attendanceRate}%</Text>
            {attendanceRate < 75 && (
              <MaterialIcons name="trending-down" size={16} color={colors.error} style={styles.trendIcon} />
            )}
            {attendanceRate >= 90 && (
              <MaterialIcons name="trending-up" size={16} color={colors.success} style={styles.trendIcon} />
            )}
          </View>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Performance</Text>
          <Text style={[styles.progressValue, { color: statusColor }]}>
            {attendanceRate >= 90 ? 'Excellent' : attendanceRate >= 75 ? 'Good' : 'Needs Focus'}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${attendanceRate}%`,
                backgroundColor: statusColor 
              }
            ]} 
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    ...shadows.sm,
  },
  headerMain: {
    flex: 1,
  },
  name: {
    ...typography.h2,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  advisorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    alignSelf: 'flex-start',
    gap: 4,
  },
  advisor: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    ...typography.small,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontSize: 10,
  },
  statValue: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendIcon: {
    marginLeft: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    opacity: 0.5,
  },
  progressContainer: {
    marginTop: 2,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  progressValue: {
    ...typography.small,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});

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

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        shadows.md,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="class" size={24} color={colors.admin} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.advisor}>{advisor}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <MaterialIcons name="people" size={16} color={colors.textSecondary} />
          <Text style={styles.statText}>{studentCount} Students</Text>
        </View>
        <View style={[styles.attendanceBadge, { backgroundColor: `${getAttendanceColor(attendanceRate)}15` }]}>
          <MaterialIcons name="check-circle" size={16} color={getAttendanceColor(attendanceRate)} />
          <Text style={[styles.attendanceText, { color: getAttendanceColor(attendanceRate) }]}>
            {attendanceRate}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.adminLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  name: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  advisor: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  attendanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  attendanceText: {
    ...typography.label,
    fontSize: 12,
  },
});

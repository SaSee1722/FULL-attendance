import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

interface StatCardProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string | number;
  color: string;
  bgColor?: string;
}

export function StatCard({ icon, label, value, color, bgColor }: StatCardProps) {
  const iconBg = bgColor || `${color}15`;

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon} size={24} color={color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    ...shadows.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  label: {
    ...typography.small,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  value: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 22,
  },
});

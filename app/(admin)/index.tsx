import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import { colors, typography, spacing, shadows, gradients } from '../../constants/theme';

function AdminCircleGauge({ pct, size = 160 }: { pct: number; size?: number }) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="gaugeGradAd" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#3B82F6" stopOpacity="1" />
            <Stop offset="100%" stopColor="#2563EB" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} fill="none"
          />
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="url(#gaugeGradAd)" strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" fill="none"
          />
        </G>
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '900' }}>{pct}%</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 2 }}>ATTENDANCE</Text>
        </View>
      </View>
    </View>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [deptSummary, setDeptSummary] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [statsData, activity, depts, systemAlerts] = await Promise.all([
        dataService.getAdminStatsWithTrends(),
        dataService.getRecentActivity(5),
        dataService.getDepartmentSummary(),
        dataService.getSystemAlerts()
      ]);
      setStats(statsData);
      setRecentActivity(activity || []);
      setDeptSummary(depts || []);
      setAlerts(systemAlerts || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      subsRef.current.forEach(s => s.unsubscribe());
      subsRef.current = [
        dataService.subscribeToTable('classes', loadData),
        dataService.subscribeToTable('attendance_records', loadData),
      ];
      return () => subsRef.current.forEach(s => s.unsubscribe());
    }, [loadData])
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
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Executive Overview Header */}
        <View style={styles.headerWrapper}>
          <LinearGradient
            colors={['#0F172A', '#1E293B']}
            style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
          >
            <Text style={styles.headerTag}>EXECUTIVE OVERVIEW</Text>
            <Text style={styles.greetingText}>Good Morning, Admin</Text>
            <Text style={styles.trendText}>
              {stats?.trend?.message || "System performance is optimal today."}
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
                onPress={() => router.push('/(admin)/reports')}
              >
                <Text style={styles.actionBtnText}>GENERATE REPORT</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                onPress={() => router.push('/(admin)/reports')}
              >
                <Text style={styles.actionBtnText}>VIEW LOGS</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.gaugeContainer}>
              <AdminCircleGauge pct={stats?.averageAttendance || 0} />
            </View>
          </LinearGradient>
        </View>

        {/* Global Stats */}
        <View style={styles.statsList}>
          <View style={styles.statCard}>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>TOTAL STUDENTS</Text>
              <Text style={styles.statValue}>{stats?.totalStudents?.toLocaleString() || '0'}</Text>
              <View style={styles.statTrend}>
                <Feather name="trending-up" size={12} color={colors.success} />
                <Text style={[styles.statTrendText, { color: colors.success }]}>+12 NEW</Text>
              </View>
            </View>
            <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
              <FontAwesome5 name="graduation-cap" size={18} color="#3B82F6" />
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>ALL CLASSES</Text>
              <Text style={styles.statValue}>{stats?.totalClasses || '0'}</Text>
              <View style={styles.statTrend}>
                <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                <Text style={styles.statTrendText}>8 ACTIVE NOW</Text>
              </View>
            </View>
            <View style={[styles.statIconBox, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="book" size={18} color="#8B5CF6" />
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>STAFF LOGGED IN</Text>
              <Text style={styles.statValue}>{stats?.totalStaff || '0'}</Text>
              <View style={styles.statTrend}>
                <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                <Text style={styles.statTrendText}>SYSTEM NORMAL</Text>
              </View>
            </View>
            <View style={[styles.statIconBox, { backgroundColor: '#F0FDF4' }]}>
              <FontAwesome5 name="users" size={18} color="#10B981" />
            </View>
          </View>
        </View>

        {/* Alerts & Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/reports')}>
              <Text style={styles.viewAllBtn}>VIEW ALL LOGS</Text>
            </TouchableOpacity>
          </View>

          {alerts.map(alert => (
            <View key={alert.id} style={styles.activityItem}>
              <View style={[styles.activityIconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{alert.message}</Text>
                <Text style={styles.activityDesc}>{alert.desc}</Text>
              </View>
              <Text style={styles.activityTime}>{alert.time}</Text>
            </View>
          ))}

          {recentActivity.map((log, idx) => (
            <View key={log.id || idx} style={styles.activityItem}>
              <View style={[styles.activityIconBox, { backgroundColor: log.type === 'attendance_marked' ? '#EFF6FF' : '#F0FDF4' }]}>
                <Ionicons 
                  name={log.type === 'attendance_marked' ? "person" : "add-circle"} 
                  size={18} 
                  color={log.type === 'attendance_marked' ? colors.admin : colors.success} 
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{log.user || 'System'} {log.type === 'attendance_marked' ? 'marked attendance' : 'performed an action'}</Text>
                <Text style={styles.activityDesc}>{log.message}</Text>
              </View>
              <Text style={styles.activityTime}>{log.timestamp ? '2m ago' : 'Today'}</Text>
            </View>
          ))}
        </View>

        {/* Department Status */}
        <View style={[styles.section, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Department Status</Text>
          <View style={styles.deptStatusList}>
            {deptSummary.slice(0, 3).map((dept, idx) => (
              <View key={idx} style={styles.deptStatusLine}>
                <View style={styles.deptLineTop}>
                  <View style={styles.deptLineIcon}>
                    <Ionicons name={idx === 0 ? "flask" : idx === 1 ? "flask-outline" : "library"} size={16} color={colors.admin} />
                    <Text style={styles.deptLineName}>{dept.name}</Text>
                  </View>
                  <Text style={[styles.deptLineValue, { color: dept.averageRate >= 80 ? colors.success : colors.warning }]}>{dept.averageRate}% ACTIVE</Text>
                </View>
                <View style={styles.progressContainer}>
                  <View style={[styles.progressFill, { width: `${dept.averageRate}%`, backgroundColor: dept.averageRate >= 80 ? colors.success : colors.warning }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Support Banner */}
        <TouchableOpacity style={styles.supportBanner}>
          <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.supportGradient}>
            <View style={styles.supportContent}>
              <Text style={styles.supportTitle}>Need Support?</Text>
              <Text style={styles.supportDesc}>Direct access to system architects for institutional configuration and data migration.</Text>
              <View style={styles.contactBtn}>
                <Text style={styles.contactBtnText}>CONTACT ARCHITECT</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerWrapper: { ...shadows.premium, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  header: { paddingHorizontal: spacing.xl, paddingBottom: 40 },
  headerTag: { color: colors.admin, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  greetingText: { ...typography.h1, color: '#FFF', fontSize: 32, marginBottom: 12 },
  trendText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20, marginBottom: 24, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  actionBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  gaugeContainer: { alignItems: 'center', marginBottom: -20 },
  statsList: { paddingHorizontal: spacing.xl, marginTop: -30, gap: 12 },
  statCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    padding: spacing.lg, 
    ...shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  statInfo: { flex: 1 },
  statLabel: { fontSize: 9, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
  statTrend: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  statTrendText: { fontSize: 10, fontWeight: '800', color: colors.textTertiary },
  statIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 2 },
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xxl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, fontSize: 18, color: colors.textPrimary },
  viewAllBtn: { fontSize: 10, fontWeight: '900', color: colors.admin, letterSpacing: 0.5 },
  activityItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, backgroundColor: '#FFF', padding: spacing.md, borderRadius: 16, ...shadows.sm },
  activityIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  activityDesc: { fontSize: 11, color: colors.textTertiary, marginTop: 2, fontWeight: '600' },
  activityTime: { fontSize: 10, fontWeight: '700', color: colors.textTertiary },
  deptStatusList: { backgroundColor: '#FFF', borderRadius: 24, padding: spacing.lg, ...shadows.sm },
  deptStatusLine: { marginBottom: spacing.xl },
  deptLineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  deptLineIcon: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deptLineName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  deptLineValue: { fontSize: 10, fontWeight: '900' },
  progressContainer: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  supportBanner: { marginHorizontal: spacing.xl, marginTop: spacing.xxl },
  supportGradient: { borderRadius: 24, overflow: 'hidden' },
  supportContent: { padding: spacing.xl, alignItems: 'center' },
  supportTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  supportDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 20, fontWeight: '500' },
  contactBtn: { backgroundColor: '#FFF', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  contactBtnText: { color: '#2563EB', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});

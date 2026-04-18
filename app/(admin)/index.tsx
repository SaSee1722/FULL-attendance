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
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 2 }}>TODAY'S AVG</Text>
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
        dataService.subscribeToTable('profiles', loadData), // Watch for new signups
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Modern Header Section */}
        <View style={styles.headerWrapper}>
          <LinearGradient
            colors={['#1E293B', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + spacing.xl }]}
          >
            <View style={styles.headerTopRow}>
              <View>
                <View style={styles.badgeRow}>
                  <Text style={styles.headerTag}>INSTITUTIONAL PORTAL</Text>
                </View>
                <Text style={styles.greetingText}>
                  {greeting}, {user?.name ? (user.name.split(' ')[0].charAt(0).toUpperCase() + user.name.split(' ')[0].slice(1).toLowerCase()) : 'Admin'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.profileBtn}
                onPress={() => router.push('/(admin)/profile')}
              >
                {user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={styles.profileImg} />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Text style={styles.profileInitial}>{user?.name?.charAt(0)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.trendText}>
              System report: Today's global attendance is at <Text style={styles.whiteBold}>{stats?.presentTodayPct || 0}%</Text>. 
              Marking is <Text style={styles.whiteBold}>{stats?.markingDone || 0}%</Text> complete across all departments.
            </Text>

            <View style={styles.gaugeSection}>
                <View style={styles.gaugeContainer}>
                  <AdminCircleGauge pct={stats?.presentTodayPct || 0} size={140} />
                </View>
                
                <View style={styles.quickActionsGrid}>
                  <View style={styles.actionRow}>
                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={() => router.push('/(admin)/staff')}
                    >
                      <View style={[styles.actionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                        <Ionicons name="people" size={18} color="#60A5FA" />
                      </View>
                      <Text style={styles.actionLabel}>Staff</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={() => router.push({ pathname: '/(admin)/classes', params: { view: 'byDept' }})}
                    >
                      <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                        <Ionicons name="business" size={18} color="#34D399" />
                      </View>
                      <Text style={styles.actionLabel}>Dept</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={() => router.push('/(admin)/reports')}
                    >
                      <View style={[styles.actionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                        <Ionicons name="document-text" size={18} color="#A78BFA" />
                      </View>
                      <Text style={styles.actionLabel}>Logs</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                       style={styles.actionBtn}
                       onPress={() => router.push('/(admin)/profile')}
                    >
                      <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                        <Ionicons name="settings" size={18} color="#FBBF24" />
                      </View>
                      <Text style={styles.actionLabel}>Setup</Text>
                    </TouchableOpacity>
                  </View>
                </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Actions & Critical Alerts */}
        <View style={styles.contentContainer}>
          
          {/* CRITICAL: HOD Approval Alert (Only shows if there are pending HODs) */}
          {(stats?.pendingHODs > 0) && (
            <TouchableOpacity 
              style={styles.approvalAlert}
              onPress={() => router.push('/(admin)/staff')}
            >
              <LinearGradient 
                colors={['#F59E0B', '#D97706']} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }}
                style={styles.approvalGradient}
              >
                <View style={styles.approvalContent}>
                  <MaterialIcons name="person-add" size={24} color="#FFF" />
                  <View style={styles.approvalTextContainer}>
                    <Text style={styles.approvalTitle}>{stats.pendingHODs} PENDING APPROVALS</Text>
                    <Text style={styles.approvalDesc}>New HOD accounts are waiting for your verification.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Grid of Main Stats - Triple Aura Design */}
          <View style={styles.statsGrid}>
            <Pressable 
              style={[styles.gridCardAura, { borderTopColor: '#3B82F6' }]}
              onPress={() => router.push('/(admin)/staff')}
            >
              <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.auraGradient}>
                <View style={[styles.iconAura, { backgroundColor: '#DBEAFE' }]}>
                  <FontAwesome5 name="users" size={14} color="#2563EB" />
                </View>
                <Text style={styles.cardValAura}>{stats?.totalStaff || 0}</Text>
                <Text style={styles.cardLabelAura}>STAFF</Text>
              </LinearGradient>
            </Pressable>

            <Pressable 
              style={[styles.gridCardAura, { borderTopColor: '#10B981' }]}
              onPress={() => router.push({ pathname: '/(admin)/classes', params: { view: 'byDept' }})}
            >
              <LinearGradient colors={['#FFFFFF', '#F0FDF4']} style={styles.auraGradient}>
                <View style={[styles.iconAura, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="people" size={16} color="#059669" />
                </View>
                <Text style={styles.cardValAura}>{stats?.totalStudents || 0}</Text>
                <Text style={styles.cardLabelAura}>STUDENTS</Text>
              </LinearGradient>
            </Pressable>

            <Pressable 
              style={[styles.gridCardAura, { borderTopColor: '#8B5CF6' }]}
              onPress={() => router.push({ pathname: '/(admin)/classes', params: { view: 'all' }})}
            >
              <LinearGradient colors={['#FFFFFF', '#FDFEFE']} style={styles.auraGradient}>
                <View style={[styles.iconAura, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="book" size={15} color="#7C3AED" />
                </View>
                <Text style={styles.cardValAura}>{stats?.totalClasses || 0}</Text>
                <Text style={styles.cardLabelAura}>CLASSES</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Department Performance List */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Department Performance</Text>
              <TouchableOpacity onPress={() => router.push('/(admin)/reports')}>
                <Text style={styles.actionLink}>Export CSV</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.deptCardList}>
              {deptSummary.length > 0 ? deptSummary.slice(0, 4).map((dept, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.deptItem}
                  onPress={() => router.push({
                    pathname: '/(admin)/department-report',
                    params: { departmentId: dept.name, departmentName: dept.name }
                  })}
                >
                  <View style={styles.deptMain}>
                    <View style={[styles.deptIconBox, { backgroundColor: idx % 2 === 0 ? '#F1F5F9' : '#F8FAFC' }]}>
                       <MaterialIcons name="domain" size={18} color={colors.admin} />
                    </View>
                    <View style={styles.deptInfo}>
                      <Text style={styles.deptName}>{dept.name}</Text>
                      <Text style={styles.deptSub}>{dept.classCount} Classes • {dept.hod}</Text>
                    </View>
                    <View style={styles.deptRateContainer}>
                       <Text style={[styles.deptRateVal, { color: (dept.todayRate ?? dept.averageRate) >= 80 ? colors.success : colors.warning }]}>
                        {dept.todayRate !== null ? `${dept.todayRate}%` : '—'}
                       </Text>
                       <Text style={styles.deptRateLabel}>{dept.todayRate !== null ? "TODAY" : "AVG (M)"}</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressFill, { 
                      width: `${dept.todayRate !== null ? dept.todayRate : dept.averageRate}%`, 
                      backgroundColor: (dept.todayRate ?? dept.averageRate) >= 80 ? colors.success : colors.warning 
                    }]} />
                  </View>
                </TouchableOpacity>
              )) : (
                <View style={styles.emptyCard}>
                   <Text style={styles.emptyText}>No department data available</Text>
                </View>
              )}
            </View>
          </View>

          {/* Redesigned Activity Log */}
          <View style={[styles.section, { marginTop: spacing.xl }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>System Activity</Text>
                <Text style={styles.sectionSubtitle}>Live Monitoring & Marking Pulse</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(admin)/reports')} style={styles.viewDetailedBtn}>
                <Text style={styles.viewDetailedText}>View Detailed Logs</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.admin} />
              </TouchableOpacity>
            </View>

            {/* Marking Pulse Summary */}
            <View style={styles.markingPulseRow}>
               <View style={[styles.pulsePill, { backgroundColor: '#ECFDF5' }]}>
                  <View style={[styles.pulseDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.pulseText, { color: '#064E3B' }]}>
                    {recentActivity.filter(a => !a.isAlert).length} Completed
                  </Text>
               </View>
               <View style={[styles.pulsePill, { backgroundColor: '#FEF2F2' }]}>
                  <View style={[styles.pulseDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={[styles.pulseText, { color: '#7F1D1D' }]}>
                    {recentActivity.filter(a => a.isAlert).length} Pending
                  </Text>
               </View>
            </View>

            <View style={styles.activityList}>
              {recentActivity.map((log, idx) => (
                <View key={log.id || idx} style={styles.activityItem}>
                   <View style={styles.activityIndicatorContainer}>
                      <View style={[styles.indicatorLine, idx === 0 && { marginTop: 10 }]} />
                      <View style={[styles.indicatorCore, { 
                        backgroundColor: log.isAlert ? '#EF4444' : '#3B82F6',
                        shadowColor: log.isAlert ? '#EF4444' : '#3B82F6',
                      }]} />
                      <View style={[styles.indicatorLine, idx === recentActivity.length - 1 && { height: 0 }]} />
                   </View>
                   
                   <View style={[styles.premiumActivityCard, log.isAlert && styles.alertCardBorder]}>
                      <View style={styles.activityTitleRow}>
                        <View style={[styles.statusBadge, { backgroundColor: log.isAlert ? '#FEE2E2' : '#EFF6FF' }]}>
                          <Text style={[styles.statusBadgeText, { color: log.isAlert ? '#EF4444' : '#3B82F6' }]}>
                            {log.isAlert ? 'PENDING' : 'COMPLETED'}
                          </Text>
                        </View>
                        <Text style={styles.activityTimeLabel}>{log.isAlert ? 'NOW' : 'TODAY'}</Text>
                      </View>

                      <Text style={styles.activityMainMsg}>
                        {log.message}
                      </Text>

                      {!log.isAlert && log.message.includes(':') && (
                        <View style={styles.activityBreakdownRow}>
                           {log.message.split(': ')[1].split(', ').map((stat, sidx) => {
                             const [val, label] = [stat.match(/\d+/)?.[0] || '0', stat.replace(/\d+/, '')];
                             const sColors = label === 'P' ? ['#ECFDF5', '#10B981'] : label === 'A' ? ['#FEF2F2', '#EF4444'] : ['#F5F3FF', '#8B5CF6'];
                             return (
                               <View key={sidx} style={[styles.smallStatPill, { backgroundColor: sColors[0] }]}>
                                  <Text style={[styles.smallStatText, { color: sColors[1] }]}>{val}{label}</Text>
                               </View>
                             );
                           })}
                        </View>
                      )}

                      <View style={styles.activityFooterRow}>
                        <View style={styles.activityOriginator}>
                          <View style={styles.originatorAvatar}>
                            <Text style={styles.originatorInitial}>{log.user?.charAt(0)}</Text>
                          </View>
                          <Text style={styles.originatorName}>{log.user || 'System'}</Text>
                        </View>
                        {log.isAlert && (
                          <TouchableOpacity style={styles.remindBtn}>
                            <Text style={styles.remindText}>Notify Advisor</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                   </View>
                </View>
              ))}
            </View>
          </View>

          {/* Quick Support Banner */}
          <TouchableOpacity 
            style={styles.supportCard}
            onPress={() => router.push('/(admin)/profile')}
          >
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.supportGradient}>
              <View style={styles.supportIcons}>
                <Ionicons name="help-buoy" size={32} color="rgba(255,255,255,0.3)" />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>Administrator Console</Text>
                <Text style={styles.supportDesc}>Manage system-wide settings, user roles, and data integrity protocols.</Text>
              </View>
              <Ionicons name="settings-sharp" size={24} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  headerWrapper: { backgroundColor: '#0F172A', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, ...shadows.premium },
  header: { paddingHorizontal: spacing.xl, paddingBottom: 50 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTag: { color: '#60A5FA', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, gap: 4 },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#EF4444' },
  liveText: { color: '#EF4444', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  greetingText: { ...typography.h1, color: '#FFF', fontSize: 26, marginTop: 4, letterSpacing: -0.5 },
  trendText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20, marginBottom: 25, fontWeight: '500' },
  whiteBold: { color: '#FFF', fontWeight: '800' },
  profileBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  profileImg: { width: '100%', height: '100%' },
  profilePlaceholder: { width: '100%', height: '100%', backgroundColor: colors.admin, justifyContent: 'center', alignItems: 'center' },
  profileInitial: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  gaugeSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, gap: 15 },
  gaugeContainer: { flex: 0.9, alignItems: 'center' },
  quickActionsGrid: { flex: 1.1, gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { 
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, 
    padding: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  actionIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 },
  
  contentContainer: { paddingHorizontal: spacing.xl, marginTop: -30 },
  
  approvalAlert: { marginBottom: spacing.lg, borderRadius: 20, overflow: 'hidden', ...shadows.md },
  approvalGradient: { padding: spacing.lg },
  approvalContent: { flexDirection: 'row', alignItems: 'center' },
  approvalTextContainer: { flex: 1, marginLeft: spacing.md },
  approvalTitle: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  approvalDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2, fontWeight: '500' },
  
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: spacing.xl },
  gridCardAura: { flex: 1, borderRadius: 24, overflow: 'hidden', ...shadows.sm, borderTopWidth: 4, backgroundColor: '#FFF' },
  auraGradient: { padding: 14, flex: 1 },
  iconAura: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardValAura: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  cardLabelAura: { fontSize: 8, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5 },
  
  section: { marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sectionSubtitle: { fontSize: 11, color: colors.textTertiary, fontWeight: '700', marginTop: 2 },
  viewDetailedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewDetailedText: { fontSize: 10, fontWeight: '800', color: colors.admin, textTransform: 'uppercase' },
  
  markingPulseRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  pulsePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  pulseText: { fontSize: 10, fontWeight: '800' },

  activityList: { },
  activityItem: { flexDirection: 'row' },
  activityIndicatorContainer: { alignItems: 'center', width: 24 },
  indicatorLine: { width: 1.5, flex: 1, backgroundColor: '#E2E8F0' },
  indicatorCore: { 
    width: 12, height: 12, borderRadius: 6, marginVertical: 4, 
    borderWidth: 2, borderColor: '#FFF', elevation: 4,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 
  },
  
  premiumActivityCard: { 
    flex: 1, backgroundColor: '#FFF', borderRadius: 20, padding: 16, 
    marginBottom: 16, marginLeft: 12, ...shadows.sm, borderWidth: 1, borderColor: '#F1F5F9' 
  },
  alertCardBorder: { borderColor: '#FECACA' },
  activityTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  activityTimeLabel: { fontSize: 9, fontWeight: '800', color: colors.textTertiary },
  activityMainMsg: { fontSize: 13, color: colors.textPrimary, fontWeight: '700', lineHeight: 20 },
  
  activityBreakdownRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  smallStatPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  smallStatText: { fontSize: 10, fontWeight: '900' },
  
  activityFooterRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F8FAFC' 
  },
  activityOriginator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  originatorAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.softGray, justifyContent: 'center', alignItems: 'center' },
  originatorInitial: { fontSize: 10, fontWeight: '800', color: colors.textSecondary },
  originatorName: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  remindBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  remindText: { fontSize: 9, fontWeight: '800', color: '#EF4444' },

  deptCardList: { gap: 12 },
  deptItem: { backgroundColor: '#FFF', borderRadius: 20, padding: spacing.lg, ...shadows.sm },
  deptMain: { flexDirection: 'row', alignItems: 'center' },
  deptIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  deptInfo: { flex: 1, marginLeft: spacing.md },
  deptName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  deptSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  deptRateContainer: { alignItems: 'flex-end' },
  deptRateVal: { fontSize: 18, fontWeight: '900' },
  deptRateLabel: { fontSize: 8, fontWeight: '900', color: colors.textTertiary },
  progressBarBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, marginTop: 15, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  
  supportCard: { marginTop: spacing.xxl, marginBottom: 20, borderRadius: 24, overflow: 'hidden', ...shadows.md },
  supportGradient: { padding: spacing.xl, flexDirection: 'row', alignItems: 'center' },
  supportIcons: { marginRight: spacing.lg },
  supportText: { flex: 1 },
  supportTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  supportDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, lineHeight: 16, fontWeight: '500' },
  
  emptyCard: { padding: 40, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20 },
  emptyText: { color: colors.textTertiary, fontWeight: '600' }
});

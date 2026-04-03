import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData } from '../../services/dataService';
import { gradients } from '../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface DayTrend {
  date: string;
  dayLabel: string;
  rate: number;       // -1 = no session that day
  present: number;
  absent: number;
  total: number;
}

type ClassSummary = Record<string, {
  present: number; absent: number; onDuty: number; total: number; rate: number;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: status label
// ─────────────────────────────────────────────────────────────────────────────
function getLabel(rate: number) {
  if (rate >= 90) return { text: 'EXCELLENT', color: '#10B981' };
  if (rate >= 80) return { text: 'STABLE',    color: '#3B82F6' };
  if (rate >= 60) return { text: 'LOW TREND', color: '#F59E0B' };
  return          { text: 'CRITICAL',  color: '#EF4444' };
}
function getAttColor(rate: number) {
  if (rate >= 80) return '#10B981';
  if (rate >= 60) return '#F59E0B';
  return '#EF4444';
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Gauge
// ─────────────────────────────────────────────────────────────────────────────
function ReportGauge({ pct }: { pct: number }) {
  const size = 160;
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const isNA = pct === 0;
  const color = isNA ? '#CBD5E1' : pct >= 80 ? '#34D399' : pct >= 60 ? '#FBBF24' : '#F87171';
  const color2 = isNA ? '#94A3B8' : pct >= 80 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color2} stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius}
            stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={radius}
            stroke="url(#rg)" strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={isNA ? circumference : offset}
            strokeLinecap="round" fill="none" />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={g.pct}>{isNA ? '—' : `${pct}%`}</Text>
        <Text style={g.lbl}>{isNA ? 'NO DATA YET' : 'AVG ATTENDANCE'}</Text>
      </View>
    </View>
  );
}
const g = StyleSheet.create({
  pct: { fontSize: 34, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  lbl: { fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 1, marginTop: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Bar Chart – real 7-day data
// ─────────────────────────────────────────────────────────────────────────────
function BarChart({ data }: { data: DayTrend[] }) {
  const BAR_H = 90;
  const validRates = data.filter(d => d.rate >= 0).map(d => d.rate);
  const max = validRates.length > 0 ? Math.max(...validRates, 1) : 100;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: BAR_H + 36, paddingHorizontal: 4 }}>
      {data.map((d, i) => {
        const hasData = d.rate >= 0;
        const h = hasData ? Math.max((d.rate / max) * BAR_H, 6) : 0;
        const barColor = hasData ? getAttColor(d.rate) : '#E2E8F0';
        const barColor2 = hasData ? `${barColor}66` : '#F1F5F9';
        const isToday = d.date === new Date().toISOString().split('T')[0];

        return (
          <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            {/* value label */}
            <Text style={{ fontSize: 10, fontWeight: '800', color: hasData ? barColor : '#CBD5E1' }}>
              {hasData ? `${d.rate}%` : '—'}
            </Text>

            {/* bar container */}
            <View style={{ width: '65%', height: BAR_H, justifyContent: 'flex-end' }}>
              {hasData ? (
                <LinearGradient
                  colors={[barColor, barColor2]}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={{ height: h, borderRadius: 6, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
                />
              ) : (
                <View style={{ height: 4, backgroundColor: '#F1F5F9', borderRadius: 4 }} />
              )}
            </View>

            {/* day label */}
            <Text style={[bc.dayLabel, isToday && bc.dayLabelToday]}>
              {d.dayLabel}
            </Text>
            {isToday && <View style={bc.todayDot} />}
          </View>
        );
      })}
    </View>
  );
}
const bc = StyleSheet.create({
  dayLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '700' },
  dayLabelToday: { color: '#4F46E5', fontWeight: '900' },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4F46E5', marginTop: -2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, bg }: {
  icon: string; label: string; value: string | number; color: string; bg: string;
}) {
  return (
    <View style={[sc.card, { backgroundColor: bg }]}>
      <View style={[sc.icon, { backgroundColor: `${color}20` }]}>
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[sc.val, { color }]}>{value}</Text>
      <Text style={sc.lbl}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 18, padding: 14, alignItems: 'center', gap: 6,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  icon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  val: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  lbl: { fontSize: 10, color: '#64748B', fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function StaffReports() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [trend, setTrend] = useState<DayTrend[]>([]);
  const [classSummary, setClassSummary] = useState<ClassSummary>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalClasses: 0, totalStudents: 0, needAttention: 0 });

  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // Parallel fetch: classes, weekly trend, logs
      const [cls, trendData, logData] = await Promise.all([
        dataService.getClasses(),
        dataService.getWeeklyAttendanceTrend(7),
        dataService.getAttendanceLogs(10),
      ]);

      setClasses(cls);
      setTrend(trendData);
      setLogs(logData);

      // Fetch per-class real attendance summary
      if (cls.length > 0) {
        // from 14 days ago (optimized for speed)
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 14);
        const summary = await dataService.getClassAttendanceSummary(
          cls.map(c => c.id),
          fromDate.toISOString().split('T')[0]
        );
        setClassSummary(summary);

        // Compute stats from real summary
        const needsAttn = cls.filter(c => {
          const s = summary[c.id];
          // If we have real attendance data, use it; else fall back to attendanceRate from DB
          const rate = s && s.total > 0 ? s.rate : c.attendanceRate;
          return rate < 80;
        }).length;

        setStats({
          totalClasses: cls.length,
          totalStudents: cls.reduce((a, c) => a + (c.studentCount || 0), 0),
          needAttention: needsAttn,
        });
      } else {
        setStats({ totalClasses: 0, totalStudents: 0, needAttention: 0 });
      }

    } catch (e) {
      console.error('Reports loadAll error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadAll();
    // Subscribe to realtime changes
    subsRef.current.forEach(s => s.unsubscribe());
    subsRef.current = [
      dataService.subscribeToTable('attendance_records', () => loadAll(true)),
    ];
    return () => { subsRef.current.forEach(s => s.unsubscribe()); subsRef.current = []; };
  }, [loadAll]));

  // Compute overall avg from trend (days that had sessions)
  const sessionDays = trend.filter(d => d.rate >= 0);
  const avgRate = sessionDays.length > 0
    ? Math.round(sessionDays.reduce((a, d) => a + d.rate, 0) / sessionDays.length)
    : 0;

  // Get real rate for a class (prefer live summary, fall back to DB rate)
  const getRealRate = (cls: ClassData): number => {
    const s = classSummary[cls.id];
    if (s && s.total > 0) return s.rate;
    return cls.attendanceRate || 0;
  };

  const sortedClasses = [...classes].sort((a, b) => getRealRate(b) - getRealRate(a));

  const dateRange = trend.length > 0
    ? `${new Date(trend[0].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(trend[trend.length - 1].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : '—';

  const totalPresent7d = trend.reduce((a, d) => a + d.present, 0);
  const totalAbsent7d = trend.reduce((a, d) => a + d.absent, 0);
  const sessionsHeld = sessionDays.length;

  if (loading) {
    return (
      <View style={r.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ color: '#64748B', marginTop: 12, fontSize: 13, fontWeight: '600' }}>
          Loading reports…
        </Text>
      </View>
    );
  }

  return (
    <View style={r.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── PROFESSIONAL HEADER ── */}
        <LinearGradient
          colors={gradients.premium as any}
          style={[r.hero, { paddingTop: insets.top + 8 }]}
        >
          {/* Top row */}
          <View style={r.heroTopRow}>
            <View>
              <Text style={r.heroLabel}>ADMINISTRATIVE INSIGHTS</Text>
              <Text style={r.heroTitle}>Academic Reports</Text>
              <Text style={r.heroSub}>{user?.department || 'Department Overview'}</Text>
            </View>
            <Pressable
              style={[r.refreshBtn, refreshing && { opacity: 0.6 }]}
              onPress={() => loadAll(true)}
              disabled={refreshing}
            >
              {refreshing
                ? <ActivityIndicator size="small" color="#FFF" />
                : <MaterialIcons name="refresh" size={20} color="#FFF" />
              }
            </Pressable>
          </View>

          {/* Date pill */}
          <View style={r.datePill}>
            <MaterialIcons name="event-note" size={13} color="#FFF" />
            <Text style={r.datePillTxt}>Weekly Outlook · {dateRange}</Text>
          </View>

          {/* Gauge - Reduced size for better visibility */}
          <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <ReportGauge pct={avgRate} />
          </View>

          {/* Mini summary pills */}
          <View style={r.miniRow}>
            <View style={r.miniPill}>
              <Text style={r.miniTxt}>{sessionsHeld} Sessions</Text>
            </View>
            <View style={r.miniPill}>
              <View style={[r.miniDot, { backgroundColor: '#34D399' }]} />
              <Text style={r.miniTxt}>{totalPresent7d} Present</Text>
            </View>
            <View style={r.miniPill}>
              <View style={[r.miniDot, { backgroundColor: '#F87171' }]} />
              <Text style={r.miniTxt}>{totalAbsent7d} Absent</Text>
            </View>
          </View>

        </LinearGradient>

        {/* ── QUICK STATS ── */}
        <View style={r.statsRow}>
          <StatCard icon="school"  label="Classes"    value={stats.totalClasses}  color="#4F46E5" bg="#FFF" />
          <StatCard icon="groups"  label="Students"   value={stats.totalStudents} color="#10B981" bg="#FFF" />
          <StatCard icon="track-changes" label="Accuracy" value={`${avgRate}%`} color="#F59E0B" bg="#FFF" />
        </View>

        {/* ── 7-DAY TREND CHART ── */}
        <View style={r.card}>
          <View style={r.cardHeader}>
            <View>
              <Text style={r.cardTitle}>Activity Trend</Text>
              <Text style={r.cardSub}>
                {sessionsHeld === 0 ? 'No sessions recorded this week' : 'Daily engagement over 7 days'}
              </Text>
            </View>
            <View style={r.iconBtn}>
              <MaterialIcons name="trending-up" size={16} color="#4F46E5" />
            </View>
          </View>

          {trend.length > 0 ? (
            <BarChart data={trend} />
          ) : (
            <EmptyState message="No attendance data for the last 7 days." />
          )}
        </View>

        {/* ── CLASS PERFORMANCE ── */}
        <View style={r.card}>
          <View style={r.cardHeader}>
            <Text style={r.cardTitle}>Performance Analysis</Text>
            <Text style={r.cardSub2}>Last 30 Days</Text>
          </View>

          {classes.length === 0 ? (
            <EmptyState message="No classes assigned to you yet." />
          ) : (
            sortedClasses.map((cls, i) => {
              const rate = getRealRate(cls);
              const rateColor = getAttColor(rate);
              const lbl = getLabel(rate);
              const hasRealData = classSummary[cls.id]?.total > 0;

              return (
                <View key={cls.id} style={[r.classRow, i > 0 && r.borderTop]}>
                  <View style={r.classInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={r.className}>{cls.name}</Text>
                      {!hasRealData && <View style={r.naTag}><Text style={r.naTxt}>N/A</Text></View>}
                    </View>
                    <Text style={r.classMeta}>{cls.section} · {cls.year} · {cls.studentCount} Students</Text>

                    <View style={r.progressTrack}>
                      <View 
                        style={[r.progressFill, { width: `${hasRealData ? rate : 0}%`, backgroundColor: rateColor }]} 
                      />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                    <Text style={[r.classRate, { color: rateColor }]}>{hasRealData ? `${rate}%` : '—'}</Text>
                    <Text style={[r.classBadge, { color: rateColor }]}>{hasRealData ? lbl.text : 'PENDING'}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── RECENT SESSIONS ── */}
        <View style={r.card}>
          <View style={r.cardHeader}>
            <Text style={r.cardTitle}>Recent Logs</Text>
            <MaterialIcons name="history" size={16} color="#4F46E5" />
          </View>

          {logs.length === 0 ? (
            <EmptyState message="No recent sessions available." />
          ) : (
            logs.slice(0, 5).map((log, i) => {
              const rate = log.total > 0 ? Math.round(((log.present + (log.onDuty || 0)) / log.total) * 100) : 0;
              const rateColor = getAttColor(rate);
              const formattedDate = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
              });
              return (
                <View key={log.id || i} style={[r.logRow, i > 0 && r.borderTop]}>
                  <View style={{ flex: 1 }}>
                    <Text style={r.logName}>{log.className}</Text>
                    <Text style={r.logDate}>{formattedDate}</Text>
                  </View>
                  <View style={r.logStats}>
                    <View style={[r.logStatusPill, { backgroundColor: `${rateColor}15` }]}>
                      <Text style={[r.logStatusTxt, { color: rateColor }]}>{rate}%</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state helper
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <View style={e.wrap}>
      <MaterialIcons name="inbox" size={24} color="#CBD5E1" />
      <Text style={e.txt}>{message}</Text>
    </View>
  );
}
const e = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  txt: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const r = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

  // Hero
  hero: { 
    paddingHorizontal: 20, paddingBottom: 35, 
    borderBottomLeftRadius: 35, borderBottomRightRadius: 35,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  heroLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '600' },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginBottom: 10,
  },
  datePillTxt: { fontSize: 11, color: '#FFF', fontWeight: '700' },
  miniRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  miniPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  miniTxt: { fontSize: 10, color: '#FFF', fontWeight: '800' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: -20 },

  // Cards
  card: {
    backgroundColor: '#FFF', borderRadius: 24,
    marginHorizontal: 16, marginTop: 16, padding: 18,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  cardSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  cardSub2: { fontSize: 10, color: '#4F46E5', fontWeight: '800', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
  },

  // Class rows
  classRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  borderTop: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  classInfo: { flex: 1, gap: 6 },
  className: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  classMeta: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 3 },
  classRate: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  classBadge: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 1 },
  naTag: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  naTxt: { fontSize: 8, fontWeight: '800', color: '#94A3B8' },

  // Log rows
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  logName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  logDate: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 1 },
  logStats: { flexDirection: 'row', alignItems: 'center' },
  logStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  logStatusTxt: { fontSize: 12, fontWeight: '800' },
});


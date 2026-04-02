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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
        // from 30 days ago
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 30);
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

      setLastUpdated(new Date());
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
  const needAttentionList = classes.filter(c => getRealRate(c) < 80);

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

        {/* ── HERO HEADER ── */}
        <LinearGradient
          colors={['#0F172A', '#1E1B4B', '#1E293B']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[r.hero, { paddingTop: insets.top + 20 }]}
        >
          <View style={r.heroBlob1} />
          <View style={r.heroBlob2} />

          {/* Top row */}
          <View style={r.heroTopRow}>
            <View>
              <Text style={r.heroLabel}>ACADEMIC OVERVIEW</Text>
              <Text style={r.heroTitle}>Staff Reports</Text>
              <Text style={r.heroSub}>{user?.department || 'Your Department'}</Text>
            </View>
            <Pressable
              style={[r.refreshBtn, refreshing && { opacity: 0.6 }]}
              onPress={() => loadAll(true)}
              disabled={refreshing}
            >
              {refreshing
                ? <ActivityIndicator size="small" color="#818CF8" />
                : <MaterialIcons name="refresh" size={20} color="#818CF8" />
              }
            </Pressable>
          </View>

          {/* Date pill */}
          <View style={r.datePill}>
            <MaterialIcons name="calendar-today" size={13} color="#818CF8" />
            <Text style={r.datePillTxt}>Last 7 Days · {dateRange}</Text>
          </View>

          {/* Gauge */}
          <View style={{ alignItems: 'center', marginVertical: 4 }}>
            <ReportGauge pct={avgRate} />
          </View>

          {/* 3 mini summary pills */}
          <View style={r.miniRow}>
            <View style={r.miniPill}>
              <MaterialIcons name="event" size={12} color="#818CF8" />
              <Text style={r.miniTxt}>{sessionsHeld} Sessions</Text>
            </View>
            <View style={[r.miniPill, { borderColor: 'rgba(52,211,153,0.3)' }]}>
              <View style={[r.miniDot, { backgroundColor: '#34D399' }]} />
              <Text style={[r.miniTxt, { color: '#34D399' }]}>{totalPresent7d} Present</Text>
            </View>
            <View style={[r.miniPill, { borderColor: 'rgba(248,113,113,0.3)' }]}>
              <View style={[r.miniDot, { backgroundColor: '#F87171' }]} />
              <Text style={[r.miniTxt, { color: '#F87171' }]}>{totalAbsent7d} Absent</Text>
            </View>
          </View>

          {/* Last updated */}
          {lastUpdated && (
            <Text style={r.lastUpdated}>
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </LinearGradient>

        {/* ── QUICK STATS ── */}
        <View style={r.statsRow}>
          <StatCard icon="class"   label="Classes"    value={stats.totalClasses}  color="#4F46E5" bg="#EEF2FF" />
          <StatCard icon="people"  label="Students"   value={stats.totalStudents} color="#059669" bg="#ECFDF5" />
          <StatCard icon="warning" label="Need Focus" value={stats.needAttention} color="#D97706" bg="#FFFBEB" />
        </View>

        {/* ── 7-DAY TREND CHART ── */}
        <View style={r.card}>
          <View style={r.cardHeader}>
            <View>
              <Text style={r.cardTitle}>Weekly Trend</Text>
              <Text style={r.cardSub}>
                {sessionsHeld === 0 ? 'No sessions recorded this week' : `${sessionsHeld} of 7 days had sessions`}
              </Text>
            </View>
            <View style={r.iconBtn}>
              <MaterialIcons name="bar-chart" size={14} color="#4F46E5" />
            </View>
          </View>

          {trend.length > 0 ? (
            <BarChart data={trend} />
          ) : (
            <EmptyState message="No attendance data for the last 7 days." />
          )}

          {/* No-session notice */}
          {sessionsHeld === 0 && trend.length > 0 && (
            <View style={r.noSessionBanner}>
              <MaterialIcons name="info-outline" size={14} color="#F59E0B" />
              <Text style={r.noSessionTxt}>Mark attendance in the Classes tab to populate this chart.</Text>
            </View>
          )}
        </View>

        {/* ── CLASS PERFORMANCE ── */}
        <View style={r.card}>
          <View style={r.cardHeader}>
            <Text style={r.cardTitle}>Class Performance</Text>
            <Text style={r.cardSub2}>Last 30 days</Text>
          </View>

          {classes.length === 0 ? (
            <EmptyState message="No classes assigned to you yet." />
          ) : (
            sortedClasses.map((cls, i) => {
              const icons = ['science', 'calculate', 'biotech', 'psychology'] as const;
              const palettes = [
                { bg: '#FEF2F2', ic: '#EF4444' },
                { bg: '#EEF2FF', ic: '#4F46E5' },
                { bg: '#ECFDF5', ic: '#10B981' },
                { bg: '#F5F3FF', ic: '#8B5CF6' },
              ];
              const pal = palettes[i % 4];
              const rate = getRealRate(cls);
              const rateColor = getAttColor(rate);
              const lbl = getLabel(rate);
              const summary = classSummary[cls.id];
              const hasRealData = summary && summary.total > 0;

              return (
                <View key={cls.id} style={[r.classRow, i > 0 && r.borderTop]}>
                  <View style={[r.classIcon, { backgroundColor: pal.bg }]}>
                    <MaterialIcons name={icons[i % 4]} size={18} color={pal.ic} />
                  </View>
                  <View style={r.classInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={r.className}>{cls.name}</Text>
                      {!hasRealData && (
                        <View style={r.naTag}>
                          <Text style={r.naTxt}>NO RECORDS</Text>
                        </View>
                      )}
                    </View>
                    <Text style={r.classMeta}>{cls.section} · {cls.year} · {cls.studentCount} Students</Text>

                    {/* Progress bar */}
                    <View style={r.progressTrack}>
                      <LinearGradient
                        colors={hasRealData ? [rateColor, `${rateColor}88`] : ['#E2E8F0', '#E2E8F0']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[r.progressFill, { width: `${hasRealData ? rate : 0}%` as any }]}
                      />
                    </View>

                    {/* P/A/OD mini stats */}
                    {hasRealData && (
                      <View style={r.miniStats}>
                        <Text style={[r.miniStat, { color: '#10B981' }]}>{summary.present}P</Text>
                        <Text style={r.miniStatSep}>·</Text>
                        <Text style={[r.miniStat, { color: '#EF4444' }]}>{summary.absent}A</Text>
                        <Text style={r.miniStatSep}>·</Text>
                        <Text style={[r.miniStat, { color: '#3B82F6' }]}>{summary.onDuty}OD</Text>
                        <Text style={r.miniStatSep}>·</Text>
                        <Text style={r.miniStat}>{summary.total} Total</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 66 }}>
                    <Text style={[r.classRate, { color: hasRealData ? rateColor : '#CBD5E1' }]}>
                      {hasRealData ? `${rate}%` : '—'}
                    </Text>
                    <Text style={[r.classBadge, { color: hasRealData ? lbl.color : '#CBD5E1' }]}>
                      {hasRealData ? lbl.text : 'NO DATA'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── TOP PERFORMING ── */}
        {sortedClasses.filter(c => getRealRate(c) >= 80).length > 0 && (
          <View style={r.card}>
            <View style={[r.sectionPill, { backgroundColor: '#ECFDF5' }]}>
              <View style={[r.sectionDot, { backgroundColor: '#10B981' }]} />
              <Text style={[r.sectionLabel, { color: '#059669' }]}>Top Attended</Text>
            </View>
            {sortedClasses.filter(c => getRealRate(c) >= 80).slice(0, 3).map((cls, i) => {
              const rate = getRealRate(cls);
              const lbl = getLabel(rate);
              return (
                <View key={cls.id} style={[r.listRow, i > 0 && r.borderTop]}>
                  <Text style={r.rank}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={r.listName}>{cls.name}</Text>
                    <Text style={r.listMeta}>{cls.section} · {cls.year}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[r.listRate, { color: lbl.color }]}>{rate}%</Text>
                    <Text style={[r.listTag, { color: lbl.color }]}>{lbl.text}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── NEEDS ATTENTION ── */}
        {needAttentionList.length > 0 && (
          <View style={r.card}>
            <View style={[r.sectionPill, { backgroundColor: '#FEF2F2' }]}>
              <View style={[r.sectionDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[r.sectionLabel, { color: '#DC2626' }]}>Needs Attention</Text>
            </View>
            {needAttentionList.map((cls, i) => {
              const rate = getRealRate(cls);
              const lbl = getLabel(rate);
              const summary = classSummary[cls.id];
              return (
                <View key={cls.id} style={[r.listRow, i > 0 && r.borderTop]}>
                  <View style={{ flex: 1 }}>
                    <Text style={r.listName}>{cls.name}</Text>
                    <Text style={r.listMeta}>{cls.section} · {cls.year}</Text>
                  </View>
                  {summary && summary.total > 0 && (
                    <View style={r.attChips}>
                      <Text style={r.chipP}>{summary.present}P</Text>
                      <Text style={r.chipA}>{summary.absent}A</Text>
                    </View>
                  )}
                  <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                    <Text style={[r.listRate, { color: lbl.color }]}>{rate > 0 ? `${rate}%` : '—'}</Text>
                    <Text style={[r.listTag, { color: lbl.color }]}>{lbl.text}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── RECENT SESSIONS ── */}
        <View style={r.card}>
          <View style={r.cardHeader}>
            <Text style={r.cardTitle}>Recent Sessions</Text>
            <View style={r.iconBtn}>
              <MaterialIcons name="history" size={14} color="#4F46E5" />
            </View>
          </View>

          {logs.length === 0 ? (
            <EmptyState message="No sessions recorded yet. Mark attendance to see logs here." />
          ) : (
            logs.slice(0, 8).map((log, i) => {
              const rate = log.total > 0 ? Math.round(((log.present + (log.onDuty || 0)) / log.total) * 100) : 0;
              const rateColor = getAttColor(rate);
              const absentCount = log.total - log.present - (log.onDuty || 0);
              const formattedDate = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              });
              return (
                <View key={log.id || i} style={[r.logRow, i > 0 && r.borderTop]}>
                  <View style={[r.logIcon, { backgroundColor: `${rateColor}15` }]}>
                    <MaterialIcons
                      name={rate >= 75 ? 'check-circle' : 'warning'}
                      size={16} color={rateColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={r.logName}>{log.className}</Text>
                    <Text style={r.logDate}>{formattedDate}</Text>
                  </View>
                  <View style={r.logStats}>
                    <View style={r.logP}><Text style={r.logPS}>{log.present}P</Text></View>
                    {absentCount > 0 && (
                      <View style={r.logA}><Text style={r.logAS}>{absentCount}A</Text></View>
                    )}
                    {(log.onDuty || 0) > 0 && (
                      <View style={r.logOD}><Text style={r.logODS}>{log.onDuty}OD</Text></View>
                    )}
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
      <MaterialIcons name="inbox" size={28} color="#CBD5E1" />
      <Text style={e.txt}>{message}</Text>
    </View>
  );
}
const e = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  txt: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const r = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FF' },

  // Hero
  hero: { paddingHorizontal: 20, paddingBottom: 24, overflow: 'hidden' },
  heroBlob1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(99,102,241,0.12)', top: -60, right: -50,
  },
  heroBlob2: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(79,70,229,0.08)', bottom: 20, left: -30,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  heroLabel: { fontSize: 10, color: '#818CF8', fontWeight: '800', letterSpacing: 1.8, marginBottom: 4 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center',
  },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 22, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  datePillTxt: { fontSize: 11, color: '#C7D2FE', fontWeight: '600' },
  miniRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  miniPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(129,140,248,0.2)',
  },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  miniTxt: { fontSize: 11, color: '#C7D2FE', fontWeight: '700' },
  lastUpdated: { fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 8, fontWeight: '600' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginTop: 14 },

  // Cards
  card: {
    backgroundColor: '#FFF', borderRadius: 22,
    marginHorizontal: 14, marginTop: 12, padding: 18,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  cardSub2: { fontSize: 11, color: '#94A3B8', fontWeight: '600', alignSelf: 'center' },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },

  noSessionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 10,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  noSessionTxt: { fontSize: 11, color: '#92400E', fontWeight: '600', flex: 1 },

  // Class rows
  classRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, gap: 12 },
  borderTop: { borderTopWidth: 1, borderTopColor: '#F8FAFF' },
  classIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  classInfo: { flex: 1, gap: 5 },
  className: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  classMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  progressTrack: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  miniStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  miniStat: { fontSize: 10, fontWeight: '800', color: '#94A3B8' },
  miniStatSep: { fontSize: 10, color: '#CBD5E1' },
  classRate: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  classBadge: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 1 },
  naTag: {
    backgroundColor: '#F1F5F9', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  naTxt: { fontSize: 8, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5 },

  // Section pills
  sectionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginBottom: 12,
  },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  // List rows
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  rank: { fontSize: 13, fontWeight: '900', color: '#CBD5E1', width: 24, textAlign: 'center' },
  listName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  listMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  listRate: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  listTag: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  attChips: { flexDirection: 'row', gap: 4 },
  chipP: { fontSize: 11, fontWeight: '800', color: '#10B981', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  chipA: { fontSize: 11, fontWeight: '800', color: '#EF4444', backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  // Log rows
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  logIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  logName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  logDate: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 1 },
  logStats: { flexDirection: 'row', gap: 5 },
  logP: { backgroundColor: '#ECFDF5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  logPS: { fontSize: 10, fontWeight: '800', color: '#10B981' },
  logA: { backgroundColor: '#FEF2F2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  logAS: { fontSize: 10, fontWeight: '800', color: '#EF4444' },
  logOD: { backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  logODS: { fontSize: 10, fontWeight: '800', color: '#3B82F6' },
});

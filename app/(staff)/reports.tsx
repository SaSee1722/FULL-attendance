import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData } from '../../services/dataService';
import { gradients } from '../../constants/theme';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';

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

type ReportMode = 'day' | 'week' | 'month';

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
function BarChart({ data, mode }: { data: DayTrend[], mode: ReportMode }) {
  const BAR_H = 100;
  const validRates = data.filter(d => d.rate >= 0).map(d => d.rate);
  const max = validRates.length > 0 ? Math.max(...validRates, 1) : 100;

  // For month mode, bars represent weeks. For day mode, maybe we show session breakdown?
  // But dataService gives us daily summary. So if mode === 'day', we'll just show 1 thinner bar.

  return (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'flex-end', 
      justifyContent: data.length === 1 ? 'center' : 'space-between', 
      height: BAR_H + 40, 
      paddingHorizontal: 10 
    }}>
      {data.map((d, i) => {
        const hasData = d.rate >= 0;
        const h = hasData ? Math.max((d.rate / 100) * BAR_H, 6) : 0;
        const barColor = hasData ? getAttColor(d.rate) : '#E2E8F0';
        const barColor2 = hasData ? `${barColor}66` : '#F1F5F9';
        const isToday = d.date === new Date().toISOString().split('T')[0];

        // Specific width for single bar to avoid "fat bar"
        const barWidth = data.length === 1 ? 60 : data.length < 5 ? 45 : '70%';

        return (
          <View key={`${d.date}-${i}`} style={{ flex: data.length === 1 ? 0 : 1, width: data.length === 1 ? 80 : undefined, alignItems: 'center', gap: 6 }}>
            {/* value label */}
            <Text style={{ fontSize: 11, fontWeight: '900', color: hasData ? barColor : '#CBD5E1' }}>
              {hasData ? `${d.rate}%` : '—'}
            </Text>

            {/* bar container */}
            <View style={{ width: barWidth as any, height: BAR_H, justifyContent: 'flex-end' }}>
              {hasData ? (
                <LinearGradient
                  colors={[barColor, barColor2]}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={{ height: h, borderRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}
                />
              ) : (
                <View style={{ height: 4, backgroundColor: '#F1F5F9', borderRadius: 4 }} />
              )}
            </View>

            {/* label */}
            <Text 
              numberOfLines={1}
              style={[bc.dayLabel, isToday && bc.dayLabelToday, mode === 'month' && { fontSize: 8 }]}
            >
              {d.dayLabel}
            </Text>
            {isToday && mode !== 'month' && <View style={bc.todayDot} />}
          </View>
        );
      })}
    </View>
  );
}
const bc = StyleSheet.create({
  dayLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', marginTop: 2 },
  dayLabelToday: { color: '#4F46E5', fontWeight: '900' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4F46E5', marginTop: -2 },
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

function toDateStr(d: Date) { return d.toISOString().split('T')[0]; }



// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function StaffReports() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportMode, setReportMode] = useState<ReportMode>('week');
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [trend, setTrend] = useState<DayTrend[]>([]);
  const [classSummary, setClassSummary] = useState<ClassSummary>({});
  const [stats, setStats] = useState({ totalClasses: 0, totalStudents: 0, needAttention: 0 });
  const [absenteeDetails, setAbsenteeDetails] = useState<{
    studentName: string; rollNo: string; status: string; date: string; className: string;
  }[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'absent' | 'unapproved' | 'on-duty'>('all');

  // Date range state
  const [startDate, setStartDate] = useState(() => toDateStr(subDays(new Date(), 6)));
  const [endDate, setEndDate] = useState(() => toDateStr(new Date()));

  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  // Auto-update range when mode changes
  React.useEffect(() => {
    if (reportMode === 'day') {
      const today = toDateStr(new Date());
      setStartDate(today); setEndDate(today);
    } else if (reportMode === 'week') {
      setStartDate(toDateStr(subDays(new Date(), 6)));
      setEndDate(toDateStr(new Date()));
    } else if (reportMode === 'month') {
      setStartDate(toDateStr(startOfMonth(new Date())));
      setEndDate(toDateStr(endOfMonth(new Date())));
    }
  }, [reportMode]);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // Use dates directly from state. 
      // The reportMode logic is handled by the useEffect or CalendarPicker.
      let s = startDate;
      let e = endDate;

      // If for some reason we land here without dates (shouldn't happen), use defaults
      if (!s) s = toDateStr(new Date());
      if (!e) e = s;

      const [cls, trendData, details] = await Promise.all([
        dataService.getClasses(),
        dataService.getAttendanceTrend(s, e),
        dataService.getAttendanceDetailsByRange(s, e),
      ]);

      setClasses(cls);
      setTrend(trendData);
      setAbsenteeDetails(details);

      // Fetch per-class real attendance summary based on selected range
      if (cls.length > 0) {
        const summary = await dataService.getClassAttendanceSummary(
          cls.map(c => c.id),
          s,
          e
        );
        setClassSummary(summary);

        // Compute stats from real summary (using average start date is okay for accuracy)
        const needsAttn = cls.filter(c => {
          const sc = summary[c.id];
          const rate = sc && sc.total > 0 ? sc.rate : c.attendanceRate;
          return rate < 80;
        }).length;

        setStats({
          totalClasses: cls.length,
          totalStudents: cls.reduce((acc, c) => acc + (c.studentCount || 0), 0),
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
  }, [startDate, endDate, reportMode]);

  useFocusEffect(useCallback(() => {
    loadAll();
    // Subscribe to realtime changes across all relevant tables
    subsRef.current.forEach(s => s.unsubscribe());
    subsRef.current = [
      dataService.subscribeToTable('attendance_records', () => loadAll(true)),
      dataService.subscribeToTable('classes',            () => loadAll(true)),
      dataService.subscribeToTable('students',           () => loadAll(true)),
    ];
    return () => { subsRef.current.forEach(s => s.unsubscribe()); subsRef.current = []; };
  }, [loadAll]));

  // Compute overall avg from trend (days that had sessions)
  const sessionDays = trend.filter(d => d.rate >= 0);
  const avgRate = sessionDays.length > 0
    ? Math.round(sessionDays.reduce((a, d) => a + d.rate, 0) / sessionDays.length)
    : 0;

  // Monthly Aggregated Trend: Aggregate into weeks if range is long (> 7 days)
  const displayTrend = useMemo(() => {
    const dayCount = trend.length;
    const shouldAggregate = reportMode === 'month';

    if (shouldAggregate && dayCount >= 14) {
      const weeks: DayTrend[] = [];
      // If it's roughly a month (28-31 days), use 4 weeks. 
      // Otherwise, use 7-day chunks.
      const chunk = dayCount <= 31 ? Math.floor(dayCount / 4) : 7;
      const numChunks = dayCount <= 31 ? 4 : Math.ceil(dayCount / 7);
      
      for (let i = 0; i < numChunks; i++) {
        const weekDays = trend.slice(i * chunk, (i + 1) * chunk);
        if (weekDays.length === 0) continue;

        const valid = weekDays.filter(d => d.rate >= 0);
        const avg = valid.length > 0
          ? Math.round(valid.reduce((acc, d) => acc + d.rate, 0) / valid.length)
          : -1;
        
        weeks.push({
          date: weekDays[0].date,
          dayLabel: numChunks <= 5 ? `WK ${i + 1}` : `W${i + 1}`,
          rate: avg,
          present: weekDays.reduce((acc, d) => acc + d.present, 0),
          absent: weekDays.reduce((acc, d) => acc + d.absent, 0),
          total: weekDays.reduce((acc, d) => acc + d.total, 0),
        });
      }
      return weeks;
    }
    return trend;
  }, [trend, reportMode]);

  // Get real rate for a class (prefer live summary, fall back to DB rate)
  const getRealRate = (cls: ClassData): number => {
    const s = classSummary[cls.id];
    if (s && s.total > 0) return s.rate;
    return cls.attendanceRate || 0;
  };

  const sortedClasses = [...classes].sort((a, b) => getRealRate(b) - getRealRate(a));

  const dateRangeLabel = useMemo(() => {
    if (reportMode === 'day') return format(new Date(startDate + 'T00:00:00'), 'MMM dd, yyyy');
    if (reportMode === 'week') return 'Last 7 Days';
    if (reportMode === 'month') return format(new Date(startDate + 'T00:00:00'), 'MMMM yyyy');
    
    return '—';
  }, [reportMode, startDate]);

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

          {/* Range Mode Selector */}
          <View style={r.modeRow}>
            {(['day', 'week', 'month'] as ReportMode[]).map(m => (
              <Pressable
                key={m}
                onPress={() => setReportMode(m)}
                style={[r.modeTab, reportMode === m && r.modeTabActive]}
              >
                <Text style={[r.modeTabTxt, reportMode === m && r.modeTabTxtActive]}>
                  {m.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Date label pill */}
          <View style={r.datePill}>
            <MaterialIcons name="event-note" size={13} color="#FFF" />
            <Text style={r.datePillTxt}>{dateRangeLabel}</Text>
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
                {reportMode === 'day' ? 'Performance for selected day' : 
                 reportMode === 'week' ? 'Daily metrics for the last 7 days' :
                 reportMode === 'month' ? 'Weekly averages for this month' :
                 'Attendance trends for custom range'}
              </Text>
            </View>
            <View style={r.iconBtn}>
              <MaterialIcons name="trending-up" size={16} color="#4F46E5" />
            </View>
          </View>

          {displayTrend.length > 0 ? (
            <BarChart data={displayTrend} mode={reportMode} />
          ) : (
            <EmptyState message="No attendance data for this period." />
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

        {/* ── ABSENTEES & OD DETAILS ── */}
        <View style={r.card}>
          <View style={r.cardHeader}>
            <View>
              <Text style={r.cardTitle}>Absentees & OD</Text>
              <Text style={r.cardSub}>Student-wise breakdown for selected range</Text>
            </View>
            <View style={[r.iconBtn, { backgroundColor: '#FEE2E2' }]}>
              <MaterialIcons name="person-off" size={16} color="#DC2626" />
            </View>
          </View>

          {/* Filter tabs */}
          <View style={r.filterRow}>
            {(['all', 'unapproved', 'absent', 'on-duty'] as const).map(f => (
              <Pressable
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[r.filterTab, activeFilter === f && r.filterTabActive]}
              >
                <Text style={[r.filterTabTxt, activeFilter === f && r.filterTabTxtActive]}>
                  {f === 'all' ? 'All' : f === 'unapproved' ? 'Unapproved' : f === 'absent' ? 'Approved' : 'OD'}
                </Text>
              </Pressable>
            ))}
          </View>

          {(() => {
            const filtered = activeFilter === 'all'
              ? absenteeDetails
              : absenteeDetails.filter(d => d.status === activeFilter);

            if (filtered.length === 0) {
              return (
                <View style={e.wrap}>
                  <Ionicons name="checkmark-circle" size={28} color="#34D399" />
                  <Text style={[e.txt, { color: '#059669', fontWeight: '700' }]}>
                    {activeFilter === 'all' ? 'No absences or OD in this period 🎉' : `No ${activeFilter === 'absent' ? 'approved absences' : activeFilter === 'unapproved' ? 'unapproved absences' : 'OD entries'} found`}
                  </Text>
                </View>
              );
            }

            // Group by date
            const grouped: Record<string, typeof filtered> = {};
            filtered.forEach(d => {
              if (!grouped[d.date]) grouped[d.date] = [];
              grouped[d.date].push(d);
            });
            const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

            return sortedDates.map(dateKey => {
              const dayEntries = grouped[dateKey];
              const dateLabel = new Date(dateKey + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
              }).toUpperCase();

              // Count by status for this day
              const dayUnapproved = dayEntries.filter(x => x.status === 'unapproved').length;
              const dayApproved   = dayEntries.filter(x => x.status === 'absent').length;
              const dayOD         = dayEntries.filter(x => x.status === 'on-duty').length;

              return (
                <View key={dateKey} style={r.dayGroup}>
                  {/* Date header bar */}
                  <View style={r.dayHeader}>
                    <View style={r.dayHeaderLeft}>
                      <Ionicons name="calendar" size={12} color="#4F46E5" />
                      <Text style={r.dayDate}>{dateLabel}</Text>
                    </View>
                    <View style={r.dayCountRow}>
                      {dayUnapproved > 0 && (
                        <View style={[r.dayCount, { backgroundColor: '#FEF2F2' }]}>
                          <Text style={[r.dayCountTxt, { color: '#DC2626' }]}>{dayUnapproved}U</Text>
                        </View>
                      )}
                      {dayApproved > 0 && (
                        <View style={[r.dayCount, { backgroundColor: '#FEF9C3' }]}>
                          <Text style={[r.dayCountTxt, { color: '#92400E' }]}>{dayApproved}A</Text>
                        </View>
                      )}
                      {dayOD > 0 && (
                        <View style={[r.dayCount, { backgroundColor: '#EEF2FF' }]}>
                          <Text style={[r.dayCountTxt, { color: '#4F46E5' }]}>{dayOD}OD</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Student rows */}
                  {dayEntries.map((entry, idx) => {
                    const isUnappr = entry.status === 'unapproved';
                    const isOD     = entry.status === 'on-duty';
                    const statusColor = isUnappr ? '#DC2626' : isOD ? '#4F46E5' : '#D97706';
                    const statusBg    = isUnappr ? '#FEF2F2' : isOD ? '#EEF2FF' : '#FFFBEB';
                    const statusLabel = isUnappr ? 'Unapproved' : isOD ? 'OD' : 'Approved';
                    const statusIcon  = isUnappr ? 'close-circle' : isOD ? 'briefcase' : 'checkmark-circle';

                    return (
                      <View
                        key={`${dateKey}-${idx}`}
                        style={[r.studentRow, idx < dayEntries.length - 1 && r.studentRowBorder]}
                      >
                        {/* Name + roll */}
                        <View style={{ flex: 1 }}>
                          <Text style={r.studentName}>{entry.studentName}</Text>
                          <Text style={r.studentRoll}>Roll: {entry.rollNo}</Text>
                        </View>

                        {/* Status badge */}
                        <View style={[r.statusBadge, { backgroundColor: statusBg }]}>
                          <Ionicons name={statusIcon as any} size={12} color={statusColor} />
                          <Text style={[r.statusBadgeTxt, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            });
          })()}
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
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 2 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  modeTab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modeTabActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
  modeTabTxt: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },
  modeTabTxtActive: { color: '#4F46E5' },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center'
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



  // ── Absentees panel ──
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  filterTab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  filterTabActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  filterTabTxt: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  filterTabTxtActive: { color: '#FFF' },

  dayGroup: {
    marginBottom: 12, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8,
  },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayDate: { fontSize: 10, fontWeight: '900', color: '#4F46E5', letterSpacing: 0.5 },
  dayCountRow: { flexDirection: 'row', gap: 4 },
  dayCount: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  dayCountTxt: { fontSize: 10, fontWeight: '900' },

  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#FFF',
  },
  studentRowBorder: { borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  studentName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  studentRoll: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10,
  },
  statusBadgeTxt: { fontSize: 11, fontWeight: '800' },

  statusBadgeTxt: { fontSize: 11, fontWeight: '800' },
});


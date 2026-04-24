import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Pressable, Clipboard, Alert, Share, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData, Student } from '../../services/dataService';
import { shadows, gradients } from '../../constants/theme';

// screen width available if needed for future layout calculations

// ── Premium SVG Circular Gauge ──────────────────────────────────
function CircleGauge({ pct, size = 150, label = 'AVG ATTENDANCE' }: { pct: number; size?: number; label?: string }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  
  // Vibrant gradients based on rate
  const color1 = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';
  const color2 = pct >= 80 ? '#34D399' : pct >= 60 ? '#FBBF24' : '#F87171';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color1} stopOpacity="1" />
            <Stop offset="100%" stopColor={color2} stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background Track with subtle glow */}
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none"
          />
          {/* Main Progress Ring */}
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="url(#gaugeGrad)" strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" fill="none"
          />
        </G>
      </Svg>
      {/* Center text with professional spacing */}
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '900', color: '#FFF', letterSpacing: -1.5 }}>{pct}%</Text>
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '800', letterSpacing: 0.8, marginTop: -2 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

// ── Daily Report Generator ───────────────────────────────────────
interface DailyReport {
  dateFormatted: string;
  className: string;
  year: string;
  total: number;
  present: number;
  absent: number;
  od: number;
  unapproved: number;
  approvedAbsent: number;
  intern: number;
  unapprovedNames: { name: string; roll: string }[];
  approvedNames: { name: string; roll: string }[];
  odNames: { name: string; roll: string }[];
  internNames: { name: string; roll: string }[];
  advisor: string;
  isSubmitted: boolean;
}

function buildReportText(r: DailyReport): string {
  const fmt = (arr: { name: string; roll: string }[]) =>
    arr.length === 0 ? 'Nil' :
    arr.map((s, i) => `${i + 1}. ${s.name} ${s.roll}`).join('\n    ');

  return [
    `📕Date: ${r.dateFormatted}`,
    ``,
    `Year:${r.year}`,
    `📍Total: ${r.total}`,
    `📍Present: ${r.present}`,
    `📍Absent: ${r.absent + r.unapproved}`,
    `📍OD: ${r.od}`,
    `📍Intern: ${r.intern}`,
    ``,
    `✅ Absentees Name:`,
    ``,
    `📌 Unapproved leave- `,
    r.unapproved === 0 ? '    Nil' : `    ${fmt(r.unapprovedNames)}`,
    ``,
    `📌 Approved leave -`,
    r.approvedAbsent === 0 ? '    Nil' : `    ${fmt(r.approvedNames)}`,
    ``,
    `📌On duty- ${r.od === 0 ? 'Nil' : ''}`,
    r.od > 0 ? `    ${fmt(r.odNames)}` : '',
    ``,
    `📌 Intern-   ${r.intern === 0 ? 'Nil' : ''}`,
    r.intern > 0 ? `    ${fmt(r.internNames)}` : '',
    ``,
    `Class Advisor: `,
    `${r.advisor}`,
  ].filter(l => l !== undefined).join('\n');
}

function DailyReportCard({
  report, onCopy, onShare, loading
}: {
  report: DailyReport | null;
  onCopy: (text: string) => void;
  onShare: (text: string) => void;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <View style={[s.reportCard, { alignItems: 'center', paddingVertical: 28 }]}>
        <ActivityIndicator color="#4F46E5" />
        <Text style={{ color: '#94A3B8', marginTop: 8, fontSize: 12, fontWeight: '600' }}>{'Loading today\'s report…'}</Text>
      </View>
    );
  }

  if (!report || !report.isSubmitted) {
    return (
      <View style={s.reportCard}>
        <View style={s.reportCardHeader}>
          <View style={s.reportHeaderLeft}>
            <View style={[s.reportIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Text style={{ fontSize: 18 }}>📋</Text>
            </View>
            <View>
              <Text style={s.reportCardTitle}>Daily Report</Text>
              <Text style={s.reportCardSub}>No attendance submitted today</Text>
            </View>
          </View>
        </View>
        <View style={s.reportPendingBadge}>
          <Ionicons name="time-outline" size={15} color="#D97706" />
          <Text style={s.reportPendingTxt}>{"Submit today's attendance to generate the report"}</Text>
        </View>
      </View>
    );
  }

  const reportText = buildReportText(report);
  const absTotal = report.absent + report.unapproved;

  return (
    <View style={s.reportCard}>
      {/* Card Header */}
      <View style={s.reportCardHeader}>
        <View style={s.reportHeaderLeft}>
          <LinearGradient colors={['#6366F1', '#8B5CF6']} style={s.reportIconBg}>
            <Text style={{ fontSize: 18 }}>📕</Text>
          </LinearGradient>
          <View>
            <Text style={s.reportCardTitle}>Daily Report</Text>
            <Text style={s.reportCardSub}>{report.dateFormatted}</Text>
          </View>
        </View>
        {/* Total badge */}
        <View style={s.totalBadge}>
          <Text style={s.totalBadgeLbl}>TOTAL</Text>
          <Text style={s.totalBadgeVal}>{report.total}</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={s.reportStatsRow}>
        <View style={[s.reportStat, { borderColor: '#DCFCE7' }]}>
          <Text style={[s.reportStatVal, { color: '#16A34A' }]}>{report.present}</Text>
          <Text style={s.reportStatLbl}>Present</Text>
        </View>
        <View style={[s.reportStat, { borderColor: '#FEE2E2' }]}>
          <Text style={[s.reportStatVal, { color: '#DC2626' }]}>{absTotal}</Text>
          <Text style={s.reportStatLbl}>Absent</Text>
        </View>
        <View style={[s.reportStat, { borderColor: '#DBEAFE' }]}>
          <Text style={[s.reportStatVal, { color: '#2563EB' }]}>{report.od}</Text>
          <Text style={s.reportStatLbl}>OD</Text>
        </View>
        <View style={[s.reportStat, { borderColor: '#F3E8FF' }]}>
          <Text style={[s.reportStatVal, { color: '#7C3AED' }]}>{report.intern}</Text>
          <Text style={s.reportStatLbl}>Intern</Text>
        </View>
      </View>

      {/* Preview / Full Text */}
      <Pressable onPress={() => setExpanded(e => !e)} style={s.reportPreviewWrap}>
        <View style={s.reportPreviewHeader}>
          <Text style={s.reportPreviewLabel}>📋 Report Preview</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
        </View>
        {expanded && (
          <Text style={s.reportPreviewText} selectable>{reportText}</Text>
        )}
        {!expanded && (
          <Text style={s.reportPreviewText} numberOfLines={3} selectable>{reportText}</Text>
        )}
      </Pressable>

      {/* Action Buttons */}
      <View style={s.reportActions}>
        {/* Primary – Share (opens native share sheet) */}
        <Pressable
          style={({ pressed }) => [s.shareBtn, pressed && { opacity: 0.88 }]}
          onPress={() => onShare(reportText)}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.shareBtnGrad}
          >
            <Ionicons name="share-social" size={18} color="#FFF" />
            <Text style={s.shareBtnTxt}>Send Report</Text>
          </LinearGradient>
        </Pressable>

        {/* Secondary – Copy */}
        <Pressable
          style={({ pressed }) => [s.copyBtnAlt, pressed && { opacity: 0.8 }]}
          onPress={() => onCopy(reportText)}
        >
          <Ionicons name="copy-outline" size={17} color="#4F46E5" />
          <Text style={s.copyBtnAltTxt}>Copy</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function StaffHome() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // silent background refresh
  const [myClasses, setMyClasses] = useState<ClassData[]>([]);
  const [deptClassesStatus, setDeptClassesStatus] = useState<any[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedLogs(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  }, []);

  const loadDailyReport = useCallback(async () => {
    if (authLoading || !user) return;
    try {
      setReportLoading(true);
      const classes = await dataService.getClasses();
      if (classes.length === 0) { setDailyReport(null); return; }

      const cls = classes[0];
      const today = new Date().toISOString().split('T')[0];
      const [students, records] = await Promise.all([
        dataService.getStudents(cls.id),
        dataService.getAttendance(cls.id, today)
      ]);

      const isSubmitted = records.length > 0;

      // Build lookup maps
      const statusMap: Record<string, string> = {};
      records.forEach(r => { statusMap[r.studentId] = r.status; });
      const studentMap: Record<string, Student> = {};
      students.forEach(s => { studentMap[s.id] = s; });

      const unapprovedList: { name: string; roll: string }[] = [];
      const approvedList: { name: string; roll: string }[] = [];
      const odList: { name: string; roll: string }[] = [];
      const internList: { name: string; roll: string }[] = [];

      let presentCount = 0, absentCount = 0, odCount = 0, internCount = 0, unapprovedCount = 0;

      students.forEach(s => {
        const status = statusMap[s.id] || (isSubmitted ? 'present' : undefined);
        if (!status) return;
        const entry = { name: s.name, roll: s.rollNo };
        switch (status) {
          case 'present': presentCount++; break;
          case 'unapproved': unapprovedCount++; unapprovedList.push(entry); break;
          case 'absent': absentCount++; approvedList.push(entry); break;
          case 'on-duty': odCount++; odList.push(entry); break;
          case 'intern': internCount++; internList.push(entry); break;
        }
      });

      // Format date as DD.MM.YYYY
      const d = new Date(today);
      const dateFormatted = [
        String(d.getDate()).padStart(2, '0'),
        String(d.getMonth() + 1).padStart(2, '0'),
        d.getFullYear()
      ].join('.');

      setDailyReport({
        dateFormatted,
        className: cls.name,
        year: `${cls.year} ${cls.name}`,
        total: students.length,
        present: presentCount,
        absent: absentCount,
        od: odCount,
        unapproved: unapprovedCount,
        approvedAbsent: absentCount,
        intern: internCount,
        unapprovedNames: unapprovedList,
        approvedNames: approvedList,
        odNames: odList,
        internNames: internList,
        advisor: user?.name ? `${user.name} AP/${cls.department?.toUpperCase() || 'CSE'}` : 'Class Advisor',
        isSubmitted,
      });
    } catch (e) {
      console.error('loadDailyReport error:', e);
    } finally {
      setReportLoading(false);
    }
  }, [user, authLoading]);

  const loadData = useCallback(async (silent = false) => {
    if (authLoading || !user) return;
    try {
      // Only show full spinner on very first load (no data yet)
      if (!silent && myClasses.length === 0) setLoading(true);
      else setRefreshing(true);

      const [cls, deptStatus] = await Promise.all([
        dataService.getClasses(true), // Force bypass cache
        dataService.getDepartmentClassesTodayStatus(),
      ]);
      setMyClasses(cls);
      setDeptClassesStatus(deptStatus);
    } catch (e) {
      console.error('StaffHome load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, authLoading, myClasses.length]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading && user) {
        // First visit: full load. Subsequent visits: silent background refresh
        const isFirstLoad = myClasses.length === 0;
        loadData(!isFirstLoad);
        loadDailyReport();
        subsRef.current.forEach(s => s.unsubscribe());
        subsRef.current = [
          dataService.subscribeToTable('classes', () => loadData(true)),
          dataService.subscribeToTable('attendance_records', () => {
            loadData(true);
            loadDailyReport();
          }),
        ];
      }
      return () => {
        subsRef.current.forEach(s => s.unsubscribe());
        subsRef.current = [];
      };
    }, [user, loadData, loadDailyReport, authLoading, myClasses.length])
  );

  const today = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${dayNames[today.getDay()]}, ${monthNames[today.getMonth()]} ${today.getDate()}`;
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';

  // Today's attendance percentage — from the daily report ( (present + od) / total )
  const todayPct = dailyReport?.isSubmitted && dailyReport.total > 0
    ? Math.round(((dailyReport.present + dailyReport.od) / dailyReport.total) * 100)
    : 0;
  const todayLabel = dailyReport?.isSubmitted ? 'TODAY' : 'NO DATA';

  const totalStudents = myClasses.reduce((a, c) => a + (c.studentCount || 0), 0);


  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4F7FFF" />
        <Text style={{ color: '#64748B', marginTop: 12, fontSize: 13, fontWeight: '600' }}>Loading dashboard…</Text>
      </View>
    );
  }



  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── PROFESSIONAL LIGHT BLUE HEADER ── */}
        <LinearGradient
          colors={gradients.premium as any}
          style={[s.header, { paddingTop: insets.top + 8 }]}
        >
          {/* Greeting Row with date opposite */}
          <View style={s.greetingRow}>
            <View style={s.greetingBlock}>
              <Text style={s.greeting}>{greeting},</Text>
              <Text style={s.greetingName}>{firstName} 👋</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={s.dateLabel}>{dateStr.toUpperCase()}</Text>
              {refreshing && (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
              )}
            </View>
          </View>

          {/* Stats cards row */}
          <View style={s.statsRow}>
            {/* Gauge card */}
            <View style={s.gaugeCard}>
              <CircleGauge pct={todayPct} size={145} label={todayLabel} />
            </View>

            {/* Right mini tiles */}
            <View style={s.miniCol}>
              <View style={s.miniCard}>
                <View style={[s.miniIconBg, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Ionicons name="school" size={16} color="#FFF" />
                </View>
                <Text style={s.miniVal}>{myClasses.length}</Text>
                <Text style={s.miniLbl}>CLASSES</Text>
              </View>
              <View style={s.miniCard}>
                <View style={[s.miniIconBg, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <MaterialIcons name="people" size={16} color="#FFF" />
                </View>
                <Text style={s.miniVal}>{totalStudents}</Text>
                <Text style={s.miniLbl}>STUDENTS</Text>
              </View>
            </View>
          </View>

          {/* Attendance status pill */}
          <View style={s.statusPillRow}>
            <View style={[s.statusPill, { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.2)' }]}>
              <View style={[s.statusDot, { backgroundColor: '#34D399' }]} />
              <Text style={[s.statusTxt, { color: '#FFF' }]}>
                {todayPct >= 80 ? 'Excellent Performance' : todayPct >= 60 ? 'Moderate Performance' : todayPct > 0 ? 'Attention Needed' : 'No Attendance Yet'}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/(staff)/attendance' as any)}>
              <Text style={s.viewCalLink}>CALENDAR →</Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* ── DAILY REPORT ── */}
        <View style={s.sectionWrap}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{"Today's Report"}</Text>
            <Pressable
              onPress={() => loadDailyReport()}
              style={{ marginBottom: 12, padding: 6 }}
            >
              <Ionicons name="refresh" size={16} color="#94A3B8" />
            </Pressable>
          </View>
          <DailyReportCard
            report={dailyReport}
            loading={reportLoading}
            onCopy={(text) => {
              Clipboard.setString(text);
              Alert.alert('Copied!', 'Report copied to clipboard. Paste it anywhere to share.');
            }}
            onShare={async (text) => {
              try {
                await Share.share(
                  { message: text, title: 'Attendance Report' },
                  { dialogTitle: 'Send attendance report via…' }
                );
              } catch (e: any) {
                if (e.message !== 'User did not share') {
                  Alert.alert('Error', 'Could not open share sheet.');
                }
              }
            }}
          />
        </View>

        {/* ── MY CLASSES ── */}
        <View style={s.sectionWrap}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>My Classes</Text>
            {myClasses.length > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countBadgeTxt}>{myClasses.length}</Text>
              </View>
            )}
          </View>

          {myClasses.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIconWrap}>
                <MaterialIcons name="event-busy" size={32} color="#CBD5E1" />
              </View>
              <Text style={s.emptyTitle}>No classes assigned</Text>
              <Text style={s.emptyDesc}>Ask your HOD to assign classes to your account.</Text>
            </View>
          ) : (
            myClasses.map((cls, idx) => {
              const palette = [
                { bg: '#EEF2FF', ic: '#4F46E5', accent: '#6366F1' },
                { bg: '#ECFDF5', ic: '#059669', accent: '#10B981' },
                { bg: '#FEF3C7', ic: '#D97706', accent: '#F59E0B' },
                { bg: '#FDF2F8', ic: '#9D174D', accent: '#DB2777' },
              ][idx % 4];
              const rate = cls.attendanceRate || 0;
              const rateColor = rate >= 80 ? '#10B981' : rate >= 60 ? '#F59E0B' : '#EF4444';

              return (
                <Pressable
                  key={cls.id}
                  style={({ pressed }) => [s.classCard, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
                  onPress={() => router.push('/(staff)/attendance' as any)}
                >
                  {/* Left accent bar */}
                  <View style={[s.classAccentBar, { backgroundColor: palette.accent }]} />

                  <View style={[s.classIconWrap, { backgroundColor: palette.bg }]}>
                    {cls.advisorImage ? (
                      <Image source={{ uri: cls.advisorImage }} style={s.advisorImg} />
                    ) : (
                      <View style={[s.advisorFallback, { backgroundColor: palette.bg, justifyContent: 'center', alignItems: 'center' }]}>
                        <MaterialIcons name="person" size={24} color={palette.ic} />
                      </View>
                    )}
                  </View>

                  <View style={s.classInfo}>
                    <Text style={s.classSection}>{cls.section} · {cls.year}</Text>
                    <Text style={s.className}>{cls.name}</Text>
                    <View style={s.classMeta}>
                      <MaterialIcons name="people" size={12} color="#94A3B8" />
                      <Text style={s.classMetaTxt}>{cls.studentCount} Students</Text>
                    </View>
                  </View>

                  {/* Attendance rate */}
                  <View style={s.classRateWrap}>
                    <Text style={[s.classRate, { color: rateColor }]}>{rate}%</Text>
                    <Text style={s.classRateLbl}>ATTEND.</Text>
                  </View>

                  <View style={s.arrowBtn}>
                    <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── DEPARTMENT CLASSES ── */}
        <View style={s.sectionWrap}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Department Classes</Text>
            {deptClassesStatus.length > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countBadgeTxt}>{deptClassesStatus.length}</Text>
              </View>
            )}
          </View>
          {deptClassesStatus.length === 0 ? (
            <View style={[s.actCard, { padding: 28, alignItems: 'center', gap: 8 }]}>
              <MaterialIcons name="history" size={28} color="#CBD5E1" />
              <Text style={s.actEmptyTxt}>No department classes found.</Text>
            </View>
          ) : (
            deptClassesStatus.map((clsStatus, i) => {
              const isExpanded = expandedLogs.has(clsStatus.classId);
              const isMarked = clsStatus.isMarked;
              
              const timeLabel = (() => {
                if (!clsStatus.timestamp) return '';
                const t = new Date(clsStatus.timestamp);
                return t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              })();

              return (
                <View key={clsStatus.classId} style={[s.richCard, { marginBottom: 12, opacity: isMarked ? 1 : 0.8 }]}>
                  {/* Header — always visible */}
                  <Pressable style={s.richHeader} onPress={() => toggleExpand(clsStatus.classId)}>
                    {/* Avatar */}
                    <View style={s.richAvatar}>
                      {clsStatus.advisorImage ? (
                        <Image source={{ uri: clsStatus.advisorImage }} style={{ width: '100%', height: '100%', borderRadius: 24 }} />
                      ) : (
                        <LinearGradient
                          colors={['#6366F1', '#8B5CF6']}
                          style={{ width: '100%', height: '100%', borderRadius: 24, justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>
                            {clsStatus.advisor ? clsStatus.advisor.charAt(0).toUpperCase() : 'S'}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={s.richClassName} numberOfLines={1}>{clsStatus.className}</Text>
                      <Text style={s.richAdvisor} numberOfLines={1}>{clsStatus.year} · {clsStatus.section}</Text>
                      <Text style={s.richTime}>
                        {isMarked ? `Marked at ${timeLabel} by ${clsStatus.markedBy}` : 'Attendance not yet marked today'}
                      </Text>
                    </View>

                    {/* Status chips */}
                    {isMarked ? (
                      <View style={s.richChips}>
                        <View style={[s.richChip, { backgroundColor: '#ECFDF5' }]}>
                          <Text style={[s.richChipTxt, { color: '#059669' }]}>{clsStatus.present}✓</Text>
                        </View>
                        {(clsStatus.absent + clsStatus.unapproved) > 0 && (
                          <View style={[s.richChip, { backgroundColor: '#FFF1F2' }]}>
                            <Text style={[s.richChipTxt, { color: '#EF4444' }]}>{clsStatus.absent + clsStatus.unapproved}✗</Text>
                          </View>
                        )}
                        {clsStatus.onDuty > 0 && (
                          <View style={[s.richChip, { backgroundColor: '#EFF6FF' }]}>
                            <Text style={[s.richChipTxt, { color: '#3B82F6' }]}>{clsStatus.onDuty}OD</Text>
                          </View>
                        )}
                        {clsStatus.intern > 0 && (
                          <View style={[s.richChip, { backgroundColor: '#F5F3FF' }]}>
                            <Text style={[s.richChipTxt, { color: '#8B5CF6' }]}>{clsStatus.intern}I</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={[s.richChip, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={[s.richChipTxt, { color: '#64748B' }]}>PENDING</Text>
                      </View>
                    )}

                    <MaterialIcons
                      name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={20} color="#94A3B8"
                    />
                  </Pressable>

                  {/* Expanded student details */}
                  {isExpanded && isMarked && (
                    <View style={s.richDetails}>
                      {/* Summary */}
                      <View style={s.richSummaryBar}>
                        <Text style={s.richSummaryTxt}>
                          {clsStatus.present + clsStatus.absent + clsStatus.onDuty + clsStatus.unapproved}/{clsStatus.totalStudents} Marked
                        </Text>
                        <View style={[s.richChip, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[s.richChipTxt, { color: '#475569', fontWeight: '700' }]}>
                            {clsStatus.totalStudents > 0 ? Math.round(((clsStatus.present + clsStatus.onDuty) / clsStatus.totalStudents) * 100) : 0}% Att.
                          </Text>
                        </View>
                      </View>

                      {/* Present — count only */}
                      {clsStatus.present > 0 && (
                        <View style={s.richGroup}>
                          <View style={s.richGroupHdr}>
                            <View style={[s.richDot, { backgroundColor: '#10B981' }]} />
                            <Text style={[s.richGroupTitle, { color: '#059669' }]}>Present ({clsStatus.present})</Text>
                            <View style={[s.richBadge, { backgroundColor: '#ECFDF5', marginLeft: 'auto' }]}>
                              <Text style={[s.richBadgeTxt, { color: '#059669' }]}>{clsStatus.present} students ✔</Text>
                            </View>
                          </View>
                        </View>
                      )}

                      {/* Absent — with Approved / Unapproved sub-groups */}
                      {(clsStatus.absent + clsStatus.unapproved) > 0 && (
                        <View style={s.richGroup}>
                          <View style={s.richGroupHdr}>
                            <View style={[s.richDot, { backgroundColor: '#EF4444' }]} />
                            <Text style={[s.richGroupTitle, { color: '#DC2626' }]}>
                              Absent ({clsStatus.absent + clsStatus.unapproved})
                            </Text>
                          </View>

                          {/* Approved Absent sub-group */}
                          {clsStatus.absentStudents?.length > 0 && (
                            <View style={s.richSubGroup}>
                              <Text style={s.richSubTitle}>— Approved ({clsStatus.absent})</Text>
                              {clsStatus.absentStudents.map((st: any, si: number) => (
                                <View key={si} style={s.richStudentRow}>
                                  <Text style={s.richRoll}>{st.rollNo}</Text>
                                  <Text style={s.richName} numberOfLines={1}>{st.name}</Text>
                                  <View style={[s.richBadge, { backgroundColor: '#FEF3C7' }]}>
                                    <Text style={[s.richBadgeTxt, { color: '#92400E' }]}>Approved</Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Unapproved sub-group */}
                          {clsStatus.unapprovedStudents?.length > 0 && (
                            <View style={s.richSubGroup}>
                              <Text style={s.richSubTitle}>— Unapproved ({clsStatus.unapproved})</Text>
                              {clsStatus.unapprovedStudents.map((st: any, si: number) => (
                                <View key={si} style={s.richStudentRow}>
                                  <Text style={s.richRoll}>{st.rollNo}</Text>
                                  <Text style={s.richName} numberOfLines={1}>{st.name}</Text>
                                  <View style={[s.richBadge, { backgroundColor: '#FFF1F2' }]}>
                                    <Text style={[s.richBadgeTxt, { color: '#EF4444' }]}>Unapp.</Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* OD Group */}
                      {clsStatus.onDuty > 0 && (
                        <View style={s.richGroup}>
                          <View style={s.richGroupHdr}>
                            <View style={[s.richDot, { backgroundColor: '#3B82F6' }]} />
                            <Text style={[s.richGroupTitle, { color: '#2563EB' }]}>On Duty ({clsStatus.onDuty})</Text>
                          </View>
                          <View style={s.richSubGroup}>
                            {clsStatus.onDutyStudents.map((st: any, si: number) => (
                              <View key={si} style={s.richStudentRow}>
                                <Text style={s.richRoll}>{st.rollNo}</Text>
                                <Text style={s.richName} numberOfLines={1}>{st.name}</Text>
                                <View style={[s.richBadge, { backgroundColor: '#EFF6FF' }]}>
                                  <Text style={[s.richBadgeTxt, { color: '#3B82F6' }]}>OD</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Empty expanded view if not marked */}
                  {isExpanded && !isMarked && (
                    <View style={[s.richDetails, { padding: 20, alignItems: 'center' }]}>
                      <Ionicons name="alert-circle-outline" size={32} color="#CBD5E1" />
                      <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8 }}>
                        Attendance has not been marked for this class today.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

      </ScrollView>


    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FF' },

  // ── Hero Header ──
  header: {
    paddingBottom: 40, paddingHorizontal: 20,
    overflow: 'hidden',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  blob1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -40,
  },
  blob2: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: 0, left: -30,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  brandName: { fontSize: 15, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  bellWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  bellDot: {
    position: 'absolute', top: 8, right: 9,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#060D1F',
  },

  greetingRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, marginTop: 4,
  },
  greetingBlock: { flex: 1 },
  dateLabel: { 
    fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '800', 
    letterSpacing: 1, marginTop: 8 
  },
  greeting: { fontSize: 18, fontWeight: '400', color: 'rgba(255,255,255,0.8)' },
  greetingName: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },

  statsRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  gaugeCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    alignItems: 'center', justifyContent: 'center',
    aspectRatio: 1,
  },
  miniCol: { flex: 1, gap: 10 },
  miniCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    gap: 3,
  },
  miniIconBg: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  miniVal: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  miniLbl: { fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: 1.2 },

  statusPillRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  viewCalLink: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '800', letterSpacing: 1 },

  // ── Section Layout ──
  sectionWrap: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  countBadge: {
    backgroundColor: '#4F46E5', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 12,
  },
  countBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#FFF' },

  // ── Daily Report Card ──
  reportCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 18,
    ...shadows.md, borderWidth: 1, borderColor: '#F1F5F9',
  },
  reportCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  reportHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reportIconBg: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#EEF2FF',
  },
  reportCardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  reportCardSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  // header badge
  totalBadge: {
    alignItems: 'center', backgroundColor: '#F1F5F9',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  totalBadgeLbl: { fontSize: 8, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  totalBadgeVal: { fontSize: 20, fontWeight: '900', color: '#0F172A' },

  reportStatsRow: {
    flexDirection: 'row', gap: 8, marginBottom: 14,
  },
  reportStat: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: '#FAFAFA', borderRadius: 14,
    borderWidth: 1.5,
  },
  reportStatVal: { fontSize: 20, fontWeight: '900' },
  reportStatLbl: { fontSize: 9, fontWeight: '700', color: '#94A3B8', marginTop: 2, letterSpacing: 0.5 },
  reportPreviewWrap: {
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  reportPreviewHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  reportPreviewLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.3 },
  reportPreviewText: {
    fontSize: 12, color: '#334155', lineHeight: 20,
    fontFamily: 'monospace',
  },

  // Action buttons
  reportActions: {
    flexDirection: 'row', gap: 10, marginTop: 14,
  },
  shareBtn: {
    flex: 1, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  shareBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 16,
  },
  shareBtnTxt: { fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  copyBtnAlt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#EEF2FF', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#C7D2FE',
  },
  copyBtnAltTxt: { fontSize: 13, fontWeight: '800', color: '#4F46E5' },

  reportPendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A',
  },
  reportPendingTxt: { fontSize: 12, color: '#92400E', fontWeight: '600', flex: 1 },

  // ── Class Cards ──
  emptyCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 32,
    alignItems: 'center', gap: 8, ...shadows.sm,
  },
  emptyIconWrap: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptyDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  classCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 20,
    padding: 14, marginBottom: 10,
    gap: 12, overflow: 'hidden',
    ...shadows.sm,
  },
  classAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 4,
  },
  classIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginLeft: 6,
    overflow: 'hidden',
  },
  advisorImg: {
    width: '100%', height: '100%',
  },
  advisorFallback: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  advisorFallbackText: {
    fontSize: 18, fontWeight: '900',
  },
  classInfo: { flex: 1 },
  classSection: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 },
  className: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
  classMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  classMetaTxt: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  classRateWrap: { alignItems: 'center' },
  classRate: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  classRateLbl: { fontSize: 8, color: '#CBD5E1', fontWeight: '700', letterSpacing: 1 },
  arrowBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Activity ──
  actCard: {
    backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden',
    ...shadows.sm,
  },
  actEmpty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  actEmptyTxt: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  actRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  actDivider: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  actIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  actContent: { flex: 1 },
  actMsg: { fontSize: 13, fontWeight: '600', color: '#0F172A', lineHeight: 19 },
  actTime: { fontSize: 10, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  // ── Rich Activity Cards (Staff) ──
  richCard: {
    backgroundColor: '#FFF', borderRadius: 22,
    overflow: 'hidden', ...shadows.sm,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  richHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 11,
  },
  richAvatar: {
    width: 46, height: 46, borderRadius: 23,
    overflow: 'hidden', borderWidth: 2, borderColor: '#E0E7FF',
  },
  richClassName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  richAdvisor: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 1 },
  richTime: { fontSize: 9, color: '#94A3B8', fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
  richChips: { flexDirection: 'column', gap: 3, alignItems: 'flex-end' },
  richChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  richChipTxt: { fontSize: 10, fontWeight: '800' },
  richDetails: {
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#FAFBFF', gap: 12,
  },
  richSummaryBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7,
  },
  richSummaryTxt: { fontSize: 11, fontWeight: '700', color: '#475569' },
  richGroup: { gap: 5 },
  richGroupHdr: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  richDot: { width: 7, height: 7, borderRadius: 3.5 },
  richGroupTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  richStudentRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 9,
    paddingHorizontal: 9, paddingVertical: 7,
    borderWidth: 1, borderColor: '#F1F5F9', gap: 8,
  },
  richRoll: { fontSize: 10, fontWeight: '800', color: '#64748B', minWidth: 68, fontFamily: 'monospace' },
  richName: { flex: 1, fontSize: 12, fontWeight: '600', color: '#1E293B' },
  richBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  richBadgeTxt: { fontSize: 9, fontWeight: '800' },
  richSubGroup: { marginLeft: 12, gap: 4, marginTop: 4 },
  richSubTitle: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 2, letterSpacing: 0.3 },

  // ── FAB ──
  fab: {
    position: 'absolute', bottom: 110, right: 20,
    width: 58, height: 58, borderRadius: 20,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 12,
  },
  fabGrad: {
    flex: 1, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
});

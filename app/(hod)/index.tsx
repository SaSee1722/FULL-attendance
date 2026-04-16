import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Dimensions, ActivityIndicator, Alert, Modal, TextInput, Image, Share, Clipboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Calendar } from 'react-native-calendars';
import Animated, { 
  useSharedValue, useAnimatedProps, withTiming, 
  FadeInDown, FadeInRight, useAnimatedStyle 
} from 'react-native-reanimated';
import { 
  School, Users, CheckCircle2, XCircle, 
  RefreshCw, Calendar as CalendarIcon,
  TrendingUp, Activity
} from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData } from '../../services/dataService';
import { colors, spacing, shadows, borderRadius, gradients } from '../../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const { width } = Dimensions.get('window');
const GAUGE_SIZE = width * 0.35;
const STROKE_WIDTH = 11;
const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PALETTE = [
  { bg: '#EEF2FF', ic: '#4F46E5', Icon: Activity },
  { bg: '#ECFDF5', ic: '#059669', Icon: School },
  { bg: '#EFF6FF', ic: '#2563EB', Icon: TrendingUp },
  { bg: '#FFFBEB', ic: '#D97706', Icon: Users },
  { bg: '#FDF2F8', ic: '#DB2777', Icon: CheckCircle2 },
];

export default function HODHome() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [stats, setStats] = useState({
    presentToday: 0, absentToday: 0, onDutyToday: 0,
    totalClasses: 0, totalStudents: 0, totalStaff: 0,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [holidays, setHolidays] = useState<{ date: string; note: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingHoliday, setMarkingHoliday] = useState<string | null>(null);
  const [hodReport, setHodReport] = useState<string | null>(null);
  const [hodReportLoading, setHodReportLoading] = useState(true);
  const [hodExpanded, setHodExpanded] = useState(false);
  const [eventModal, setEventModal] = useState<{ visible: boolean; date: string; note: string; type: 'Leave' | 'Event' | 'Function' }>({
    visible: false,
    date: '',
    note: '',
    type: 'Leave'
  });

  const toggleLogExpand = useCallback((id: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const fetchAll = useCallback(async (silent = false) => {
    if (authLoading || !user) return;
    try {
      // Show full spinner only on first ever load (no data yet)
      if (!silent && classes.length === 0) setLoading(true);
      const [cls, st, logs, hols] = await Promise.all([
        dataService.getClasses(),
        dataService.getStatistics(),
        dataService.getDetailedActivityLogs(8),
        dataService.getHolidays(),
      ]);
      setClasses(cls);
      setStats(st);
      setRecentLogs(logs);
      setHolidays(hols as any);
    } catch {
      // Silently ignore errors on background refresh
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, classes.length]);

  // ── HOD Daily Report ──────────────────────────────────────────
  const loadHodReport = useCallback(async () => {
    if (!user) return;
    try {
      setHodReportLoading(true);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yy = String(today.getFullYear()).slice(2);
      const dateFormatted = `${dd}.${mm}.${yy}`;

      const cls = await dataService.getClasses();
      if (cls.length === 0) { setHodReport(null); setHodReportLoading(false); return; }

      // Fetch today's attendance for all classes
      const classLines: string[] = [];
      for (const c of cls) {
        const [students, records] = await Promise.all([
          dataService.getStudents(c.id),
          dataService.getAttendance(c.id, todayStr),
        ]);
        if (records.length === 0) continue; // skip unsubmitted
        const total = students.length;
        let present = 0, approved = 0, unapproved = 0, od = 0;
        records.forEach((r: any) => {
          if (r.status === 'present') present++;
          else if (r.status === 'absent') approved++;
          else if (r.status === 'unapproved') unapproved++;
          else if (r.status === 'on-duty') { present++; od++; }
        });
        const label = c.year ? `${c.year} ${c.name}` : c.name;
        classLines.push(
          `➕${label} ${present}/${total}\n` +
          `📍Approved: ${String(approved).padStart(2, '0')}\n` +
          `📍Unapproved: ${String(unapproved).padStart(2, '0')}\n` +
          `📍OD: ${String(od).padStart(2, '0')}`
        );
      }

      if (classLines.length === 0) { setHodReport(null); setHodReportLoading(false); return; }

      const dept = (user.department || 'Dept').toUpperCase();
      const hodName = user.name || 'HOD';
      const report = [
        `Department: ${dept}`,
        `☀Date: ${dateFormatted}`,
        '',
        classLines.join('\n\n'),
        '',
        `Reported by:`,
        `HOD /${dept} : ${hodName}`,
      ].join('\n');
      setHodReport(report);
    } catch (e) {
      console.error('loadHodReport error:', e);
      setHodReport(null);
    } finally {
      setHodReportLoading(false);
    }
  }, [user]);

  useEffect(() => { loadHodReport(); }, [loadHodReport]);

  useEffect(() => {
    if (authLoading || !user) return;

    // First mount: full load
    fetchAll(classes.length > 0);
    // Realtime: silent background refresh
    const subClasses     = dataService.subscribeToTable('classes',            () => fetchAll(true));
    const subAttendance  = dataService.subscribeToTable('attendance_records', () => fetchAll(true));
    const subStudents    = dataService.subscribeToTable('students',           () => fetchAll(true));
    const subHolidays    = dataService.subscribeToTable('holidays',           () => fetchAll(true));

    return () => {
      subClasses?.unsubscribe();
      subAttendance?.unsubscribe();
      subStudents?.unsubscribe();
      subHolidays?.unsubscribe();
    };
  }, [fetchAll, authLoading, user, classes.length]);

  const handleDayPress = useCallback((date: string) => {
    const existing = holidays.find(h => h.date === date);
    if (existing) {
      // Parse note if it has type prefix: "[Type] Note"
      const typeMatch = existing.note.match(/^\[(Leave|Event|Function)\]\s*(.*)/);
      setEventModal({
        visible: true,
        date,
        type: (typeMatch?.[1] as any) || 'Leave',
        note: typeMatch?.[2] || existing.note
      });
    } else {
      setEventModal({ visible: true, date, type: 'Leave', note: '' });
    }
  }, [holidays]);

  const saveEvent = async () => {
    if (!user?.department) return;
    const { date, type, note } = eventModal;
    const fullNote = `[${type}] ${note}`;
    
    // Optimistic Update
    const originalHolidays = [...holidays];
    setHolidays(prev => {
      const filtered = prev.filter(h => h.date !== date);
      return [...filtered, { date, note: fullNote }];
    });
    setMarkingHoliday(date);
    setEventModal(prev => ({ ...prev, visible: false }));

    try {
      await dataService.markHoliday(date, user.department, fullNote);
    } catch {
      setHolidays(originalHolidays);
      Alert.alert('Error', 'Failed to save event');
    } finally {
      setMarkingHoliday(null);
    }
  };

  const deleteEvent = async () => {
    if (!user?.department) return;
    const { date } = eventModal;
    
    const originalHolidays = [...holidays];
    setHolidays(prev => prev.filter(h => h.date !== date));
    setMarkingHoliday(date);
    setEventModal(prev => ({ ...prev, visible: false }));

    try {
      await dataService.removeHoliday(date, user.department);
    } catch {
      setHolidays(originalHolidays);
      Alert.alert('Error', 'Failed to delete event');
    } finally {
      setMarkingHoliday(null);
    }
  };

  const markedDates = useMemo(() => {
    const obj: any = {};
    holidays.forEach(h => {
      let color = '#10B981'; // Default Leave (Green)
      if (h.note.startsWith('[Event]')) color = '#3B82F6'; // Blue
      if (h.note.startsWith('[Function]')) color = '#F59E0B'; // Orange
      
      const isProcessing = markingHoliday === h.date;
      obj[h.date] = {
        selected: true,
        selectedColor: isProcessing ? '#94A3B8' : color,
        activeOpacity: 0.8
      };
    });
    if (markingHoliday && !obj[markingHoliday]) {
      obj[markingHoliday] = { selected: true, selectedColor: '#E2E8F0', marking: true };
    }
    return obj;
  }, [holidays, markingHoliday]);

  const overall = useMemo(() => {
    const totalToday = stats.presentToday + stats.absentToday + stats.onDutyToday;
    if (totalToday > 0 && stats.totalStudents > 0) {
      return Math.round(((stats.presentToday + stats.onDutyToday) / stats.totalStudents) * 100);
    }
    return classes.length > 0
      ? Math.round(classes.reduce((s, c) => s + (c.attendanceRate || 0), 0) / classes.length)
      : 0;
  }, [classes, stats]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(overall / 100, { duration: 1500 });
  }, [overall, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const ringColor = overall >= 80 ? '#34D399' : overall >= 60 ? '#F59E0B' : '#EF4444';
  
  const dotStyle = useAnimatedStyle(() => {
    const angle = (2 * Math.PI * progress.value) - Math.PI / 2;
    return {
      transform: [
        { translateX: RADIUS * Math.cos(angle) },
        { translateY: RADIUS * Math.sin(angle) }
      ]
    };
  });

  const depts = useMemo(() => {
    const deptMap: Record<string, { n: number; r: number }> = {};
    classes.forEach(c => {
      const d = c.department || 'General';
      if (!deptMap[d]) deptMap[d] = { n: 0, r: 0 };
      deptMap[d].n += 1;
      deptMap[d].r += c.attendanceRate || 0;
    });

    return Object.entries(deptMap).map(([name, d], i) => {
      // Use overall calculation for the user's primary department to ensure dashboard consistency
      const isUserDept = user?.department && name.toLowerCase() === user.department.toLowerCase();
      const pct = isUserDept ? overall : Math.round(d.r / d.n);

      return {
        name,
        count: d.n,
        pct,
        ...PALETTE[i % PALETTE.length],
      };
    });
  }, [classes, overall, user]);





  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  const today = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${dayNames[today.getDay()]}, ${monthNames[today.getMonth()]} ${today.getDate()}`;
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.premium as any}
        style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <Animated.View entering={FadeInDown.delay(100).duration(800)} style={styles.greetingGroup}>
            <Text style={styles.greetingLabel}>{greeting},</Text>
            <Text style={styles.greetingName}>{firstName} 👋</Text>
          </Animated.View>
          <View style={styles.rightActionsGroup}>
            <Text style={styles.dateDisplay}>{dateStr.toUpperCase()}</Text>
            <Pressable onPress={() => setLeaveModalOpen(true)} style={styles.iconBtn}>
              <CalendarIcon size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.gaugeRow}>
          <Animated.View entering={FadeInRight.delay(200).duration(1000)} style={styles.gaugeWrap}>
            {loading
              ? <ActivityIndicator color="#4F7FFF" size="large" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }} />
              : <View style={{ width: GAUGE_SIZE, height: GAUGE_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
                    <Defs>
                      <SvgGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={ringColor} stopOpacity={1} />
                        <Stop offset="100%" stopColor={ringColor} stopOpacity={0.6} />
                      </SvgGradient>
                    </Defs>
                    <G rotation="-90" origin={`${GAUGE_SIZE / 2}, ${GAUGE_SIZE / 2}`}>
                      <Circle cx={GAUGE_SIZE/2} cy={GAUGE_SIZE/2} r={RADIUS}
                        stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE_WIDTH} fill="none" />
                      <AnimatedCircle 
                        cx={GAUGE_SIZE/2} cy={GAUGE_SIZE/2} r={RADIUS}
                        stroke="url(#gaugeGradient)" strokeWidth={STROKE_WIDTH}
                        strokeDasharray={CIRCUMFERENCE}
                        animatedProps={animatedProps}
                        strokeLinecap="round" fill="none" 
                      />
                    </G>
                  </Svg>
                  <View style={styles.gaugeCenter}>
                    <View style={styles.pctRow}>
                      <Text style={styles.pctNum}>{overall}</Text>
                      <Text style={styles.pctSym}>%</Text>
                    </View>
                    <Text style={styles.pctLabel}>ATTENDANCE</Text>
                  </View>
                  {/* Premium Accent Dot - Position computed absolute to overlay the progress end */}
                  <Animated.View style={[
                    {
                      position: 'absolute',
                      width: STROKE_WIDTH * 0.8,
                      height: STROKE_WIDTH * 0.8,
                      borderRadius: STROKE_WIDTH * 0.4,
                      backgroundColor: '#FFF',
                      shadowColor: '#FFF',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 5,
                      elevation: 5,
                    },
                    dotStyle
                  ]} />
                </View>
            }
          </Animated.View>

          <View style={styles.tileGrid}>
            {[
              { label: 'Classes', value: stats.totalClasses, icon: School, color: '#818CF8' },
              { label: 'Students', value: stats.totalStudents, icon: Users, color: '#34D399' },
              { label: 'Present', value: stats.presentToday, icon: CheckCircle2, color: '#10B981' },
              { label: 'Absent', value: stats.absentToday, icon: XCircle, color: '#F87171' },
            ].map((t, i) => (
              <Animated.View 
                key={t.label} 
                entering={FadeInRight.delay(300 + (i * 100)).duration(800)}
                style={styles.tile}
              >
                <View style={[styles.tileIcon, { backgroundColor: `${t.color}20` }]}>
                  <t.icon size={16} color={t.color} />
                </View>
                <View>
                  <Text style={styles.tileVal} numberOfLines={1}>{loading ? '—' : t.value}</Text>
                  <Text style={styles.tileLbl} numberOfLines={1}>{t.label}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>


      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* ── HOD DAILY REPORT ── */}
        <View style={d.reportWrap}>
          <View style={d.reportSectionHeader}>
            <Text style={styles.secTitle}>{"Today's Report"}</Text>
            <Pressable onPress={loadHodReport}>
              <RefreshCw size={16} color={colors.primaryBlue} />
            </Pressable>
          </View>

          {hodReportLoading ? (
            <View style={d.reportCard}>
              <ActivityIndicator color="#4F46E5" />
            </View>
          ) : !hodReport ? (
            <View style={d.reportCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[d.reportIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={{ fontSize: 18 }}>📋</Text>
                </View>
                <View>
                  <Text style={d.reportCardTitle}>HOD Report</Text>
                  <Text style={d.reportCardSub}>No attendance submitted today</Text>
                </View>
              </View>
              <View style={d.pendingBadge}>
                <Text style={d.pendingTxt}>Waiting for advisors to submit attendance</Text>
              </View>
            </View>
          ) : (
            <View style={d.reportCard}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <LinearGradient colors={['#6366F1', '#8B5CF6']} style={d.reportIconBg}>
                    <Text style={{ fontSize: 18 }}>📊</Text>
                  </LinearGradient>
                  <View>
                    <Text style={d.reportCardTitle}>HOD Report</Text>
                    <Text style={d.reportCardSub}>{new Date().toLocaleDateString('en-GB').replace(/\//g, '.')}</Text>
                  </View>
                </View>
              </View>

              {/* Preview */}
              <Pressable onPress={() => setHodExpanded(e => !e)} style={d.previewWrap}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B' }}>📋 Report Preview</Text>
                  <MaterialIcons name={hodExpanded ? 'expand-less' : 'expand-more'} size={18} color="#94A3B8" />
                </View>
                <Text
                  style={d.previewText}
                  numberOfLines={hodExpanded ? undefined : 4}
                  selectable
                >
                  {hodReport}
                </Text>
              </Pressable>

              {/* Actions */}
              <View style={d.actionRow}>
                <Pressable
                  style={d.shareBtn}
                  onPress={() => Share.share({ message: hodReport! })}
                >
                  <LinearGradient colors={['#4F46E5','#7C3AED']} start={{x:0,y:0}} end={{x:1,y:0}} style={d.shareBtnGrad}>
                    <MaterialIcons name="share" size={16} color="#FFF" />
                    <Text style={d.shareBtnTxt}>Send Report</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  style={d.copyBtn}
                  onPress={() => {
                    Clipboard.setString(hodReport!);
                    Alert.alert('Copied', 'Report copied to clipboard');
                  }}
                >
                  <MaterialIcons name="content-copy" size={16} color="#4F46E5" />
                  <Text style={d.copyBtnTxt}>Copy</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <Animated.View entering={FadeInDown.delay(700).duration(800)} style={styles.secRow}>
          <View>
            <Text style={styles.secTitle}>Departmental Overview</Text>
            <Text style={styles.secSubtitle}>Real-time performance metrics</Text>
          </View>
          <Pressable onPress={() => fetchAll(false)} style={styles.refreshBtn}>
            <RefreshCw size={18} color={colors.primaryBlue} />
          </Pressable>
        </Animated.View>

        {loading
          ? <ActivityIndicator color={colors.primaryBlue} style={{ marginVertical: 24 }} />
          : depts.length === 0
            ? <View style={[styles.emptyCard, shadows.sm]}>
                <School size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No classes yet</Text>
                <Text style={styles.emptyDesc}>Go to Management tab to create your first class.</Text>
              </View>
            : depts.map((d, i) => (
                <Animated.View 
                  key={d.name} 
                  entering={FadeInDown.delay(800 + (i * 100)).duration(800)}
                  style={[styles.deptCard, shadows.sm]}
                >
                  <View style={[styles.deptIcon, { backgroundColor: d.bg }]}>
                    <d.Icon size={16} color={d.ic} />
                  </View>
                  <View style={styles.deptInfo}>
                    <Text style={styles.deptNm}>{d.name}</Text>
                    <View style={styles.deptMetaRow}>
                      <Text style={styles.deptSub}>{d.count} class{d.count !== 1 ? 'es' : ''}</Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.deptSub}>{d.pct}% attendance</Text>
                    </View>
                    <View style={styles.progBg}>
                      <LinearGradient 
                        colors={[d.ic, `${d.ic}60`]} 
                        start={{x:0, y:0}} end={{x:1, y:0}}
                        style={[styles.progFill, { width: `${d.pct}%` as any }]} 
                      />
                    </View>
                  </View>
                  <View style={[styles.pctBadge, { backgroundColor: `${d.ic}10` }]}>
                    <TrendingUp size={12} color={d.ic} style={{ marginRight: 4 }} />
                    <Text style={[styles.pctText, { color: d.ic }]}>{d.pct}%</Text>
                  </View>
                </Animated.View>
              ))
        }

        {recentLogs.length > 0 && (
          <>
            <Animated.View entering={FadeInDown.delay(1000).duration(800)} style={[styles.secRow, { marginTop: spacing.lg }]}>
              <View>
                <Text style={styles.secTitle}>Recent Activity</Text>
                <Text style={styles.secSubtitle}>Staff attendance submissions</Text>
              </View>
            </Animated.View>

            {recentLogs.map((log, i) => {
              const isExpanded = expandedLogs.has(log.id);
              const dateLabel = (() => {
                const d = new Date(log.date);
                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              })();
              const timeLabel = (() => {
                if (!log.timestamp) return '';
                const t = new Date(log.timestamp);
                return t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              })();

              return (
                <Animated.View
                  key={log.id}
                  entering={FadeInDown.delay(1100 + (i * 80)).duration(800)}
                  style={[styles.activityCard, shadows.sm]}
                >
                  {/* Card Header — always visible */}
                  <Pressable
                    style={styles.activityHeader}
                    onPress={() => toggleLogExpand(log.id)}
                  >
                    {/* Advisor Avatar */}
                    <View style={styles.activityAvatar}>
                      {log.advisorImage ? (
                        <Image source={{ uri: log.advisorImage }} style={{ width: '100%', height: '100%', borderRadius: 24 }} />
                      ) : (
                        <LinearGradient colors={['#6366F1', '#8B5CF6']} style={{ width: '100%', height: '100%', borderRadius: 24, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>
                            {log.advisor ? log.advisor.charAt(0).toUpperCase() : 'S'}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>

                    {/* Class Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityClassName} numberOfLines={1}>{log.className}</Text>
                      <Text style={styles.activityAdvisor} numberOfLines={1}>by {log.advisor}</Text>
                      <Text style={styles.activityTime}>{dateLabel} · {timeLabel}</Text>
                    </View>

                    {/* Summary Chips */}
                    <View style={styles.activityChips}>
                      <View style={[styles.chip, { backgroundColor: '#ECFDF5' }]}>
                        <Text style={[styles.chipTxt, { color: '#059669' }]}>{log.present}✓</Text>
                      </View>
                      {(log.absent + log.unapproved) > 0 && (
                        <View style={[styles.chip, { backgroundColor: '#FFF1F2' }]}>
                          <Text style={[styles.chipTxt, { color: '#EF4444' }]}>{log.absent + log.unapproved}✗</Text>
                        </View>
                      )}
                      {log.onDuty > 0 && (
                        <View style={[styles.chip, { backgroundColor: '#EFF6FF' }]}>
                          <Text style={[styles.chipTxt, { color: '#3B82F6' }]}>{log.onDuty}OD</Text>
                        </View>
                      )}
                    </View>

                    <MaterialIcons
                      name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={20}
                      color="#94A3B8"
                    />
                  </Pressable>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <View style={styles.activityDetails}>
                      {/* Total summary bar */}
                      <View style={styles.summaryBar}>
                        <Text style={styles.summaryBarTxt}>
                          {log.present + log.absent + log.onDuty + log.unapproved}/{log.totalStudents} Students Marked
                        </Text>
                        <View style={[styles.chip, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.chipTxt, { color: '#475569', fontWeight: '600' }]}>
                            {log.totalStudents > 0 ? Math.round(((log.present + log.onDuty) / log.totalStudents) * 100) : 0}% Attendance
                          </Text>
                        </View>
                      </View>

                      {/* Present — count only, no list */}
                      {log.present > 0 && (
                        <View style={styles.studentGroup}>
                          <View style={styles.studentGroupHeader}>
                            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                            <Text style={[styles.studentGroupTitle, { color: '#059669' }]}>Present ({log.present})</Text>
                            <View style={[styles.statusBadge, { backgroundColor: '#ECFDF5', marginLeft: 'auto' }]}>
                              <Text style={[styles.statusBadgeTxt, { color: '#059669' }]}>{log.present} students ✔</Text>
                            </View>
                          </View>
                        </View>
                      )}

                      {/* Absent — with Approved / Unapproved sub-groups */}
                      {(log.absent + log.unapproved) > 0 && (
                        <View style={styles.studentGroup}>
                          {/* Parent header */}
                          <View style={styles.studentGroupHeader}>
                            <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
                            <Text style={[styles.studentGroupTitle, { color: '#DC2626' }]}>
                              Absent ({log.absent + log.unapproved})
                            </Text>
                          </View>

                          {/* Approved Absent sub-group */}
                          {log.absentStudents?.length > 0 && (
                            <View style={{ marginLeft: 12, gap: 4, marginTop: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 2, letterSpacing: 0.3 }}>
                                — Approved ({log.absent})
                              </Text>
                              {log.absentStudents.map((s: any, si: number) => (
                                <View key={si} style={styles.studentRow}>
                                  <Text style={styles.studentRoll}>{s.rollNo}</Text>
                                  <Text style={styles.studentName} numberOfLines={1}>{s.name}</Text>
                                  <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                                    <Text style={[styles.statusBadgeTxt, { color: '#92400E' }]}>Approved</Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Unapproved sub-group */}
                          {log.unapprovedStudents?.length > 0 && (
                            <View style={{ marginLeft: 12, gap: 4, marginTop: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 2, letterSpacing: 0.3 }}>
                                — Unapproved ({log.unapproved})
                              </Text>
                              {log.unapprovedStudents.map((s: any, si: number) => (
                                <View key={si} style={styles.studentRow}>
                                  <Text style={styles.studentRoll}>{s.rollNo}</Text>
                                  <Text style={styles.studentName} numberOfLines={1}>{s.name}</Text>
                                  <View style={[styles.statusBadge, { backgroundColor: '#FFF1F2' }]}>
                                    <Text style={[styles.statusBadgeTxt, { color: '#EF4444' }]}>Unapp.</Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* On-Duty Students */}
                      {log.onDutyStudents?.length > 0 && (
                        <View style={styles.studentGroup}>
                          <View style={styles.studentGroupHeader}>
                            <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
                            <Text style={[styles.studentGroupTitle, { color: '#2563EB' }]}>On-Duty ({log.onDuty})</Text>
                          </View>
                          {log.onDutyStudents.map((s: any, si: number) => (
                            <View key={si} style={styles.studentRow}>
                              <Text style={styles.studentRoll}>{s.rollNo}</Text>
                              <Text style={styles.studentName} numberOfLines={1}>{s.name}</Text>
                              <View style={[styles.statusBadge, { backgroundColor: '#EFF6FF' }]}>
                                <Text style={[styles.statusBadgeTxt, { color: '#3B82F6' }]}>OD</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </Animated.View>
              );
            })}
          </>
        )}

        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Leave Management Modal */}
      <Modal visible={leaveModalOpen} animationType="slide">
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setLeaveModalOpen(false)} style={styles.backBtn}>
              <MaterialIcons name="close" size={24} color="#0F172A" />
            </Pressable>
            <View>
              <Text style={styles.modalTitle}>Leave Management</Text>
              <Text style={styles.modalSub}>Tap a date to toggle department leave</Text>
            </View>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={[styles.calendarContainer, shadows.md]}>
              <Calendar
                theme={{
                  backgroundColor: '#ffffff',
                  calendarBackground: '#ffffff',
                  textSectionTitleColor: '#94a3b8',
                  selectedDayBackgroundColor: colors.error,
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: colors.primaryBlue,
                  dayTextColor: '#1e293b',
                  textDisabledColor: '#cbd5e1',
                  dotColor: colors.primaryBlue,
                  selectedDotColor: '#ffffff',
                  arrowColor: colors.primaryBlue,
                  monthTextColor: '#0f172a',
                  indicatorColor: colors.primaryBlue,
                  textDayFontWeight: '500',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '600',
                  textDayFontSize: 14,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 12,
                }}
                markedDates={markedDates}
                onDayPress={(day) => handleDayPress(day.dateString)}
                enableSwipeMonths={true}
              />
            </View>

            <View style={styles.legend}>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>Leave</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.legendText}>Event</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendText}>Function</Text>
                </View>
              </View>
            </View>

            <Text style={[styles.modalTitle, { marginTop: spacing.xl, marginBottom: spacing.sm, fontSize: 16 }]}>Upcoming Activities</Text>
            {holidays.length === 0 ? (
              <View style={styles.emptyEvents}>
                <CalendarIcon size={32} color="#CBD5E1" />
                <Text style={styles.modalSub}>No upcoming events or leaves</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {[...holidays].sort((a,b) => a.date.localeCompare(b.date)).map(h => {
                  let color = '#10B981';
                  let type = 'Leave';
                  let note = h.note;
                  if (h.note.startsWith('[Event]')) { color = '#3B82F6'; type = 'Event'; note = h.note.replace('[Event] ', ''); }
                  else if (h.note.startsWith('[Function]')) { color = '#F59E0B'; type = 'Function'; note = h.note.replace('[Function] ', ''); }
                  else if (h.note.startsWith('[Leave]')) { note = h.note.replace('[Leave] ', ''); }

                  return (
                    <Pressable 
                      key={h.date} 
                      style={[styles.eventListItem, shadows.sm]}
                      onPress={() => handleDayPress(h.date)}
                    >
                      <View style={[styles.eventListColor, { backgroundColor: color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventListDate}>{new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                        <Text style={styles.eventListNote} numberOfLines={1}>{note || 'No description'}</Text>
                      </View>
                      <View style={[styles.typeBadge, { backgroundColor: `${color}15` }]}>
                        <Text style={[styles.typeBadgeText, { color }]}>{type}</Text>
                      </View>
                      <MaterialIcons name="edit" size={16} color="#CBD5E1" style={{ marginLeft: 4 }} />
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Event Details Editor Overlay */}
          {eventModal.visible && (
            <View style={styles.eventModalOverlay}>
              <Pressable style={styles.overlayBg} onPress={() => setEventModal(prev => ({ ...prev, visible: false }))} />
              <View style={styles.eventModalContent}>
                <Text style={styles.eventModalTitle}>{eventModal.note ? 'Edit Activity' : 'New Activity'}</Text>
                <Text style={styles.eventModalDate}>{new Date(eventModal.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                
                <View style={styles.typeSelector}>
                  {(['Leave', 'Event', 'Function'] as const).map(t => {
                    const colorsMap = { Leave: '#10B981', Event: '#3B82F6', Function: '#F59E0B' };
                    const isSelected = eventModal.type === t;
                    return (
                      <Pressable 
                        key={t}
                        onPress={() => setEventModal(prev => ({ ...prev, type: t }))}
                        style={[styles.typeBtn, isSelected && { backgroundColor: colorsMap[t], borderColor: colorsMap[t] }]}
                      >
                        <Text style={[styles.typeBtnText, isSelected && { color: '#FFF' }]}>{t}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.noteInput}
                  placeholder="Description (e.g. Sports Day, Holiday...)"
                  value={eventModal.note}
                  onChangeText={(t) => setEventModal(prev => ({ ...prev, note: t }))}
                  multiline
                  autoFocus
                />

                <View style={styles.modalActions}>
                  <Pressable onPress={() => setEventModal(prev => ({ ...prev, visible: false }))} style={[styles.modalBtn, styles.cancelBtn]}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  {holidays.find(h => h.date === eventModal.date) && (
                    <Pressable onPress={deleteEvent} style={[styles.modalBtn, styles.deleteBtn]}>
                      <MaterialIcons name="delete-outline" size={20} color="#F87171" />
                    </Pressable>
                  )}
                  <Pressable onPress={saveEvent} style={[styles.modalBtn, styles.saveBtn]}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: spacing.lg, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  greetingGroup: { flex: 1, flexShrink: 1, paddingRight: 8 },
  greetingLabel: { fontSize: 18, fontWeight: '400', color: 'rgba(255,255,255,0.8)' },
  greetingName: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  rightActionsGroup: { alignItems: 'flex-end', gap: 6, marginTop: 4 },
  dateDisplay: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: 1 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 2,
  },
  gaugeRow: {
    flexDirection: 'row', 
    alignItems: 'center',
    paddingHorizontal: spacing.lg, 
    gap: 16, 
    marginBottom: spacing.lg,
  },
  gaugeWrap: { 
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  tileGrid: { 
    flex: 1, 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    alignContent: 'center',
    gap: 8,
  },
  tile: {
    width: '47%', 
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16, 
    padding: 12, 
    flexDirection: 'column', 
    alignItems: 'flex-start', 
    gap: 6,
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  tileIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  tileVal: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  tileLbl: { 
    fontSize: 9, 
    color: 'rgba(255,255,255,0.4)', 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: 0.8,
    marginTop: -2,
  },
  barWrap: { paddingHorizontal: spacing.lg, gap: 10 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  seg: { height: '100%' },
  barMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLbl: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 120 },
  secRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.md,
  },
  secTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  secSubtitle: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 1 },
  
  calendarContainer: {
    backgroundColor: '#FFF', borderRadius: 28, padding: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  
  refreshBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  emptyCard: {
    backgroundColor: '#FFF', borderRadius: borderRadius.xl,
    padding: spacing.xl, alignItems: 'center', gap: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  emptyDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  deptCard: {
    backgroundColor: '#FFF', borderRadius: 26,
    padding: 16, flexDirection: 'row',
    alignItems: 'center', marginBottom: spacing.md, gap: 16,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  deptIcon: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  deptInfo: { flex: 1, gap: 4 },
  deptNm: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  deptMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deptSub: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' },
  progBg: { height: 7, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  progFill: { height: '100%', borderRadius: 4 },
  pctBadge: { 
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 
  },
  pctText: { fontSize: 14, fontWeight: '900' },
  
  logCard: {
    backgroundColor: '#FFF', borderRadius: 22,
    padding: 14, flexDirection: 'row',
    alignItems: 'center', marginBottom: 12, gap: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  logIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  logInfo: { flex: 1 },
  logClass: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  logMeta: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '600' },

  // ── Activity Cards ─────────────────────────────────────────────
  activityCard: {
    backgroundColor: '#FFF', borderRadius: 24,
    marginBottom: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  activityHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  activityAvatar: {
    width: 48, height: 48, borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2, borderColor: '#E0E7FF',
  },
  activityClassName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  activityAdvisor: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 1 },
  activityTime: { fontSize: 10, color: '#94A3B8', fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
  activityChips: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  chip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  chipTxt: { fontSize: 11, fontWeight: '800' },
  activityDetails: {
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FAFBFF', gap: 14,
  },
  summaryBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  summaryBarTxt: { fontSize: 12, fontWeight: '700', color: '#475569' },
  studentGroup: { gap: 6 },
  studentGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  studentGroupTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  studentRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: '#F1F5F9',
    gap: 10,
  },
  studentRoll: {
    fontSize: 11, fontWeight: '800', color: '#64748B',
    minWidth: 72, fontFamily: 'monospace',
  },
  studentName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E293B' },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeTxt: { fontSize: 10, fontWeight: '800' },

  footerSpacer: { height: 80 },

  // Gauge Overlay
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pctNum: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  pctSym: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    marginLeft: 2,
  },
  pctLabel: {
    fontSize: 7,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2,
    fontWeight: '900',
    marginTop: -2,
    textTransform: 'uppercase',
  },

  // Modal Styles
  modalRoot: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFF',
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  modalBody: { padding: spacing.lg },
  legend: { marginTop: 24, gap: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 12, height: 12, borderRadius: 4 },
  legendText: { fontSize: 13, color: '#1E293B', fontWeight: '600' },

  eventListItem: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#F1F5F9',
  },
  eventListColor: { width: 4, height: 40, borderRadius: 2 },
  eventListDate: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  eventListNote: { fontSize: 12, color: '#64748B', marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  // Event Details Overlay
  eventModalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 24, zIndex: 1000 },
  overlayBg: { ...StyleSheet.absoluteFillObject },
  eventModalContent: { backgroundColor: '#FFF', borderRadius: 28, padding: 24, gap: 16 },
  eventModalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  eventModalDate: { fontSize: 14, color: '#64748B', fontWeight: '500', marginTop: -8 },
  typeSelector: { flexDirection: 'row', gap: 8, marginTop: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  noteInput: {
    backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, height: 100,
    fontSize: 14, color: '#1E293B', textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0',
  },
  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  modalBtn: { height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  saveBtn: { backgroundColor: colors.primaryBlue, paddingHorizontal: 24 },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  cancelBtn: { backgroundColor: '#F1F5F9' },
  cancelBtnText: { color: '#64748B', fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FFF1F2', width: 48 },
  emptyEvents: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 24, 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#F1F5F9',
    gap: 12,
    marginTop: 12 
  },
});

// ── HOD Report Card styles ──────────────────────────────────────
const d = StyleSheet.create({
  reportWrap: { marginBottom: 20 },
  reportSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  reportCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 18,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  reportIconBg: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  reportCardTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  reportCardSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 1 },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 12,
  },
  pendingTxt: { fontSize: 12, color: '#D97706', fontWeight: '700', flex: 1 },
  previewWrap: {
    backgroundColor: '#F8FAFC', borderRadius: 16,
    padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  previewText: {
    fontSize: 12, color: '#334155', lineHeight: 20, fontFamily: 'monospace',
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  shareBtn: { flex: 3, borderRadius: 16, overflow: 'hidden' },
  shareBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  shareBtnTxt: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  copyBtn: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  copyBtnTxt: { fontSize: 13, fontWeight: '800', color: '#4F46E5' },
});


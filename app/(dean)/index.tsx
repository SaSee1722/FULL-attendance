import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Dimensions, ActivityIndicator, Alert, Modal, TextInput, Image,
} from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G } from 'react-native-svg';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData } from '../../services/dataService';
import { colors, spacing, shadows, borderRadius } from '../../constants/theme';

const { width } = Dimensions.get('window');
const GAUGE_SIZE = width * 0.35;
const STROKE_WIDTH = 12;
const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PALETTE = [
  { bg: '#EEF2FF', ic: '#4F46E5', fi: 'atom' },
  { bg: '#ECFDF5', ic: '#059669', fi: 'flask' },
  { bg: '#EFF6FF', ic: '#2563EB', fi: 'calculator' },
  { bg: '#FFFBEB', ic: '#D97706', fi: 'book' },
  { bg: '#FDF2F8', ic: '#DB2777', fi: 'microscope' },
];

export default function DeanHome() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [stats, setStats] = useState({
    presentToday: 0, absentToday: 0, onDutyToday: 0,
    totalClasses: 0, totalStudents: 0, totalStaff: 0,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<{ date: string; note: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingHoliday, setMarkingHoliday] = useState<string | null>(null);
  const [eventModal, setEventModal] = useState<{ visible: boolean; date: string; note: string; type: 'Leave' | 'Event' | 'Function' }>({
    visible: false,
    date: '',
    note: '',
    type: 'Leave'
  });

  const fetchAll = useCallback(async () => {
    if (authLoading || !user) return;
    try {
      setLoading(true);
      const [cls, st, logs, hols] = await Promise.all([
        dataService.getClasses(),
        dataService.getStatistics(),
        dataService.getAttendanceLogs(5),
        dataService.getHolidays(),
      ]);
      setClasses(cls);
      setStats(st);
      setRecentLogs(logs);
      setHolidays(hols as any);
    } catch {
      Alert.alert('Error', 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading || !user) return;

    fetchAll();
    const subClasses = dataService.subscribeToTable('classes', fetchAll);
    const subAttendance = dataService.subscribeToTable('attendance_records', fetchAll);
    const subStudents = dataService.subscribeToTable('students', fetchAll);
    const subHolidays = dataService.subscribeToTable('holidays', fetchAll);

    return () => {
      subClasses?.unsubscribe();
      subAttendance?.unsubscribe();
      subStudents?.unsubscribe();
      subHolidays?.unsubscribe();
    };
  }, [fetchAll, authLoading, user]);

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
    // If we have stats for today, use them for a reactive dashboard experience
    const totalToday = stats.presentToday + stats.absentToday + stats.onDutyToday;
    if (totalToday > 0 && stats.totalStudents > 0) {
      // Calculate based on total students to reflect "Out of total"
      return Math.round(((stats.presentToday + stats.onDutyToday) / stats.totalStudents) * 100);
    }
    
    // Fallback to department average from class records
    return classes.length > 0
      ? Math.round(classes.reduce((s, c) => s + (c.attendanceRate || 0), 0) / classes.length)
      : 0;
  }, [classes, stats]);

  const offset = CIRCUMFERENCE - (overall / 100) * CIRCUMFERENCE;
  const ringColor = overall >= 80 ? '#10B981' : overall >= 75 ? '#34D399' : overall >= 60 ? '#F59E0B' : '#EF4444';

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

  const total = stats.presentToday + stats.absentToday + stats.onDutyToday;



  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0F172A', '#1E293B']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>Welcome back 👋</Text>
            <Text style={styles.deptName}>{user?.department || 'Dean Dashboard'}</Text>
          </View>
          <Pressable onPress={() => setLeaveModalOpen(true)} style={styles.iconBtn}>
            <MaterialIcons name="event" size={22} color="#FFF" />
          </Pressable>
        </View>

        <View style={styles.gaugeRow}>
          <View style={styles.gaugeWrap}>
            {loading
              ? <ActivityIndicator color="#4F7FFF" size="large" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }} />
              : <View style={{ width: GAUGE_SIZE, height: GAUGE_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
                    <G rotation="-90" origin={`${GAUGE_SIZE / 2}, ${GAUGE_SIZE / 2}`}>
                      <Circle cx={GAUGE_SIZE/2} cy={GAUGE_SIZE/2} r={RADIUS}
                        stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE_WIDTH} fill="none" />
                      <Circle cx={GAUGE_SIZE/2} cy={GAUGE_SIZE/2} r={RADIUS}
                        stroke={ringColor} strokeWidth={STROKE_WIDTH}
                        strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
                        strokeLinecap="round" fill="none" />
                    </G>
                  </Svg>
                  <View style={styles.gaugeCenter}>
                    <View style={styles.pctRow}>
                      <Text style={styles.pctNum}>{overall}</Text>
                      <Text style={styles.pctSym}>%</Text>
                    </View>
                    <Text style={styles.pctLabel}>ATTENDANCE</Text>
                  </View>
                </View>
            }
          </View>

          <View style={styles.tileGrid}>
            {[
              { label: 'Classes', value: stats.totalClasses, icon: 'school', color: '#818CF8' },
              { label: 'Students', value: stats.totalStudents, icon: 'people', color: '#34D399' },
              { label: 'Present', value: stats.presentToday, icon: 'check-circle', color: '#10B981' },
              { label: 'Absent', value: stats.absentToday, icon: 'cancel', color: '#F87171' },
            ].map(t => (
              <View key={t.label} style={styles.tile}>
                <View style={[styles.tileIcon, { backgroundColor: `${t.color}20` }]}>
                  <MaterialIcons name={t.icon as any} size={14} color={t.color} />
                </View>
                <View>
                  <Text style={styles.tileVal} numberOfLines={1}>{loading ? '—' : t.value}</Text>
                  <Text style={styles.tileLbl} numberOfLines={1}>{t.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {!loading && total > 0 && (
          <View style={styles.barWrap}>
            <View style={styles.bar}>
              <View style={[styles.seg, { flex: stats.presentToday, backgroundColor: '#10B981' }]} />
              <View style={[styles.seg, { flex: stats.onDutyToday, backgroundColor: '#F59E0B' }]} />
              <View style={[styles.seg, { flex: stats.absentToday, backgroundColor: '#EF4444' }]} />
            </View>
            <Text style={styles.barLbl}>{total} students recorded today</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.secRow}>
          <Text style={styles.secTitle}>Departmental Overview</Text>
          <Pressable onPress={fetchAll} style={styles.refreshBtn}>
            <MaterialIcons name="refresh" size={18} color={colors.primaryBlue} />
          </Pressable>
        </View>

        {loading
          ? <ActivityIndicator color={colors.primaryBlue} style={{ marginVertical: 24 }} />
          : depts.length === 0
            ? <View style={[styles.emptyCard, shadows.sm]}>
                <MaterialIcons name="school" size={40} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No classes yet</Text>
                <Text style={styles.emptyDesc}>Go to Management tab to create your first class.</Text>
              </View>
            : depts.map(d => (
                <View key={d.name} style={[styles.deptCard, shadows.sm]}>
                  <View style={[styles.deptIcon, { backgroundColor: d.bg }]}>
                    <FontAwesome5 name={d.fi as any} size={16} color={d.ic} />
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
                        colors={[d.ic, `${d.ic}80`]} 
                        start={{x:0, y:0}} end={{x:1, y:0}}
                        style={[styles.progFill, { width: `${d.pct}%` as any }]} 
                      />
                    </View>
                  </View>
                  <View style={[styles.pctBadge, { backgroundColor: `${d.ic}10` }]}>
                    <Text style={[styles.pctText, { color: d.ic }]}>{d.pct}%</Text>
                  </View>
                </View>
              ))
        }

        {recentLogs.length > 0 && (
          <>
            <View style={[styles.secRow, { marginTop: spacing.lg }]}>
              <Text style={styles.secTitle}>Recent Activity</Text>
            </View>
            {recentLogs.map(log => {
              const good = (log.absent || 0) === 0;
              return (
                <View key={log.id} style={[styles.logCard, shadows.sm]}>
                  <View style={[styles.logIcon, { backgroundColor: good ? '#ECFDF5' : '#FFF1F2', overflow: 'hidden' }]}>
                    {log.advisorImage ? (
                      <Image source={{ uri: log.advisorImage }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <MaterialIcons name={good ? 'check-circle' : 'info'} size={20} color={good ? '#10B981' : '#EF4444'} />
                    )}
                  </View>
                  <View style={styles.logInfo}>
                    <Text style={styles.logClass} numberOfLines={1}>{log.className}</Text>
                    <Text style={styles.logMeta}>
                      Marked by {log.markedBy} • {log.present}P, {log.absent}A, {log.onDuty}OD
                    </Text>
                  </View>
                </View>
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

          <View style={styles.modalBody}>
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
              <Text style={styles.modalSub}>No upcoming events or leaves</Text>
            ) : (
              [...holidays].sort((a,b) => a.date.localeCompare(b.date)).map(h => {
                let color = '#10B981';
                let type = 'Leave';
                let note = h.note;
                if (h.note.startsWith('[Event]')) { color = '#3B82F6'; type = 'Event'; note = h.note.replace('[Event] ', ''); }
                else if (h.note.startsWith('[Function]')) { color = '#F59E0B'; type = 'Function'; note = h.note.replace('[Function] ', ''); }
                else if (h.note.startsWith('[Leave]')) { note = h.note.replace('[Leave] ', ''); }

                return (
                  <View key={h.date} style={styles.eventListItem}>
                    <View style={[styles.eventListColor, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventListDate}>{new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                      <Text style={styles.eventListNote} numberOfLines={1}>{note || 'No description'}</Text>
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: `${color}15` }]}>
                      <Text style={[styles.typeBadgeText, { color }]}>{type}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

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
    alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 0.5 },
  deptName: { fontSize: 22, fontWeight: '900', color: '#FFF', marginTop: 2, letterSpacing: -0.5 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  gaugeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, gap: spacing.lg, marginBottom: spacing.md,
  },
  gaugeWrap: { 
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  tileGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, padding: 12, flexDirection: 'column', alignItems: 'flex-start', gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: spacing.xs,
  },
  tileIcon: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  tileVal: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  tileLbl: { fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  barWrap: { paddingHorizontal: spacing.lg, gap: 6 },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  seg: { height: '100%' },
  barLbl: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 100 },
  secRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.md,
  },
  secTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  secSubtitle: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 2 },
  
  calendarContainer: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  
  refreshBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: `${colors.primaryBlue}10`,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFF', borderRadius: borderRadius.xl,
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  emptyDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
  deptCard: {
    backgroundColor: '#FFF', borderRadius: 24,
    padding: 16, flexDirection: 'row',
    alignItems: 'center', marginBottom: spacing.md, gap: 16,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  deptIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  deptInfo: { flex: 1, gap: 4 },
  deptNm: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  deptMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deptSub: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1' },
  progBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  progFill: { height: '100%', borderRadius: 3 },
  pctBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  pctText: { fontSize: 14, fontWeight: '900' },
  
  logCard: {
    backgroundColor: '#FFF', borderRadius: 20,
    padding: 16, flexDirection: 'row',
    alignItems: 'center', marginBottom: spacing.sm, gap: 12,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  logIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  logInfo: { flex: 1 },
  logClass: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  logMeta: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '500' },
  
  footerSpacer: { height: 60 },

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
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  pctSym: {
    fontSize: 14,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 10,
    marginLeft: 2,
  },
  pctLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.5,
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
});

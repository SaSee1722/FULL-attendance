import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, LayoutAnimation, Platform, UIManager, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { dataService, Student, ClassData } from '../../services/dataService';
import { useAuth } from '../../hooks/useAuth';
import { gradients, shadows, colors } from '../../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── 5-day date strip component ─────────────────────────────────────
function AttendanceDateStrip({
  selectedDate, onSelect, holidays, lockedDates
}: { 
  selectedDate: string; 
  onSelect: (d: string) => void; 
  holidays: string[];
  lockedDates: string[];
}) {
  const dates = [];
  const todayStr = new Date().toISOString().split('T')[0];
  for (let i = -2; i <= 2; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  return (
    <View style={s.dateStrip}>
      {dates.map((dateStr) => {
        const d = new Date(dateStr);
        const day = d.getDate();
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const isSelected = dateStr === selectedDate;
        const isFuture = dateStr > todayStr;

        return (
          <Pressable
            key={dateStr}
            onPress={() => onSelect(dateStr)}
            disabled={isFuture}
            style={[
              s.dateItem,
              isSelected && s.dateItemSelected,
              isFuture && { opacity: 0.3 }
            ]}
          >
            <Text style={[s.dateDayName, isSelected && s.dateTextSelectedName]}>
              {dayName}
            </Text>
            <Text style={[s.dateDay, isSelected && s.dateTextSelectedDay]}>
              {day}
            </Text>
            {isSelected && <View style={s.selectedDot} />}
            {holidays.some(h => (typeof h === 'string' ? h : (h as any).date) === dateStr) && (
              <View style={s.holidayDot} />
            )}
            {lockedDates.includes(dateStr) && (
              <View style={s.dateTickCorner}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Main Staff Attendance Screen ───────────────────────────────────
export default function StaffAttendance() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present'|'absent'|'on-duty'|'unapproved'>>({});
  const [lockedDates, setLockedDates] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const cls = await dataService.getClasses();
      if (cls.length > 0 && !selectedClass) {
        setSelectedClass(cls[0]);
      }

      if (user?.department) {
        const hols = await dataService.getHolidays(user.department);
        setHolidays(hols);
      }
    } catch (e) {
      console.error('Attendance load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.department, selectedClass]);

  // Load students and marked records when class or date changes
  const loadClassAttendance = useCallback(async () => {
    if (!selectedClass) return;
    try {
      const [allStudents, records] = await Promise.all([
        dataService.getStudents(selectedClass.id),
        dataService.getAttendance(selectedClass.id, date)
      ]);

      setStudents(allStudents);
      
      const marked: Record<string, any> = {};
      records.forEach(r => {
        marked[r.studentId] = r.status;
      });
      setAttendance(marked);

      // If records exist, mark date as potentially locked
      if (records.length > 0) {
        setLockedDates(prev => [...new Set([...prev, date])]);
      } else {
        // AUTO-MARK ON HOLIDAYS: If no records, but it's a holiday, set default to present
        const isHoliday = holidays.some(h => (typeof h === 'string' ? h : (h as any).date) === date);
        if (isHoliday) {
          const marked: Record<string, any> = {};
          allStudents.forEach(s => marked[s.id] = 'present');
          setAttendance(marked);
        }
      }
    } catch (e) {
      console.error('Load class attendance error:', e);
    }
  }, [selectedClass, date, holidays]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadClassAttendance(); }, [loadClassAttendance]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedClass) return;
    const subRecords = dataService.subscribeToTable('attendance_records', loadClassAttendance);
    const subStudents = dataService.subscribeToTable('students', loadClassAttendance);
    const subClasses = dataService.subscribeToTable('classes', loadData);
    
    return () => {
      subRecords?.unsubscribe();
      subStudents?.unsubscribe();
      subClasses?.unsubscribe();
    };
  }, [selectedClass, loadClassAttendance, loadData]);

  const toggleAttendance = (studentId: string, status: 'present'|'absent'|'on-duty'|'unapproved') => {
    if (lockedDates.includes(date) || isFutureDate) {
      Alert.alert('Restricted', 'Attendance cannot be modified for this date.');
      return;
    }
    if (isHoliday) {
      Alert.alert('Holiday Mode', 'This day is marked as a holiday. All students are set to "Present" by default.');
      return;
    }

    if (status === 'absent') {
      Alert.alert(
        'Absence Reason',
        'Is this absence approved by the dean?',
        [
          { text: 'Unapproved', onPress: () => setAttendance(p => ({ ...p, [studentId]: 'unapproved' })) },
          { text: 'Approved', onPress: () => setAttendance(p => ({ ...p, [studentId]: 'absent' })) },
        ]
      );
    } else {
      setAttendance(prev => ({
        ...prev,
        [studentId]: prev[studentId] === status ? 'present' : status
      }));
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const saveAttendance = async () => {
    if (!selectedClass || lockedDates.includes(date) || isFutureDate) return;

    setSaving(true);
    try {
      const records = students.map(s => ({
        studentId: s.id,
        classId: selectedClass.id,
        date: date,
        status: attendance[s.id] || 'present'
      }));

      await dataService.markAttendance(records);
      setLockedDates(prev => [...prev, date]);
      Alert.alert('Success', 'Attendance marked successfully!');
    } catch (e) {
      console.error('Save attendance button failed:', e);
      Alert.alert('Error', 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = React.useMemo(() => {
    return students.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNo.toString().includes(searchQuery)
    );
  }, [students, searchQuery]);

  const todayStr = new Date().toISOString().split('T')[0];
  const activeHoliday = holidays.find(h => (typeof h === 'string' ? h : (h as any).date) === date) as any;
  const isHoliday = !!activeHoliday;
  const isFutureDate = date > todayStr;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4F7FFF" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient
        colors={gradients.premium as any}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.navRow}>
          <Pressable onPress={() => router.back()} style={s.backCircle}>
            <MaterialIcons name="arrow-back-ios" size={16} color="#FFF" style={{ marginLeft: 6 }} />
          </Pressable>
          <View style={s.titleBlock}>
            <Text style={s.title}>{selectedClass?.name || 'Loading...'}</Text>
            <Text style={s.subtitle}>{selectedClass?.section?.toUpperCase() || 'SECTION'} • ATTENDANCE</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <AttendanceDateStrip 
          selectedDate={date} 
          onSelect={setDate} 
          holidays={holidays}
          lockedDates={lockedDates}
        />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={s.searchContainer}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              style={s.searchBarInput}
              placeholder="Search student name or roll no..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={s.listMeta}>
          <Text style={s.studentCount}>{filteredStudents.length} Students Enrolled</Text>
        </View>

        {isHoliday && (
          <View style={s.holidayBanner}>
            <Ionicons name="sunny" size={18} color="#15803D" />
            <Text style={s.holidayText}>
              Holiday/Event: {activeHoliday.note ? activeHoliday.note.replace(/\[.*?\]\s*/, '') : 'Dean marked this day as leave'}
            </Text>
          </View>
        )}



        {/* Student List */}
        <View style={s.list}>
          {filteredStudents.map((student, idx) => {
            const status = attendance[student.id] || 'present';
            return (
              <View key={student.id} style={s.studentCard}>
                <View style={s.studentHeader}>
                  <View style={s.nameBlock}>
                    <Text style={s.studentName}>{student.name}</Text>
                    <Text style={s.rollNo}>ROLL: {student.rollNo}</Text>
                  </View>
                  <View style={s.statsBlock}>
                    <Text style={[s.percentageTxt, { color: student.attendanceRate >= 80 ? colors.success : student.attendanceRate >= 60 ? colors.warning : colors.error }]}>
                      {Math.round(student.attendanceRate)}%
                    </Text>
                    <Text style={s.statsLabel}>TOTAL</Text>
                  </View>
                </View>

                <View style={s.statusGrid}>
                  <Pressable
                    onPress={() => toggleAttendance(student.id, 'present')}
                    style={[s.statusTab, status === 'present' && s.tabPresent]}
                  >
                    <Text style={[s.tabTxt, status === 'present' && s.tabTxtActive]}>P</Text>
                  </Pressable>
                  
                  <Pressable
                    onPress={() => toggleAttendance(student.id, 'absent')}
                    style={[s.statusTab, (status === 'absent' || status === 'unapproved') && s.tabAbsent]}
                  >
                    <Text style={[s.tabTxt, (status === 'absent' || status === 'unapproved') && s.tabTxtActive]}>A</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => toggleAttendance(student.id, 'on-duty')}
                    style={[s.statusTab, status === 'on-duty' && s.tabOD]}
                  >
                    <Text style={[s.tabTxt, status === 'on-duty' && s.tabTxtActive]}>OD</Text>
                  </Pressable>
                </View>

                {(status === 'absent' || status === 'unapproved') && (
                  <View style={s.absentActions}>
                    <Pressable 
                      style={[s.subBtn, { backgroundColor: status === 'absent' ? '#FEE2E2' : '#F1F5F9' }]}
                      onPress={() => toggleAttendance(student.id, 'absent')}
                    >
                      <Text style={[s.subBtnTxt, { color: '#EF4444' }]}>APPR.</Text>
                    </Pressable>
                    <Pressable 
                      style={[s.subBtn, { backgroundColor: status === 'unapproved' ? '#7F1D1D' : '#F1F5F9' }]}
                      onPress={() => toggleAttendance(student.id, 'unapproved')}
                    >
                      <Text style={[s.subBtnTxt, { color: status === 'unapproved' ? '#FFF' : '#7F1D1D' }]}>UNAPPR.</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      {!lockedDates.includes(date) && !isFutureDate && (
        <View style={[s.bottomBar, { paddingBottom: 30 }]}>
          <Pressable
            style={[s.saveBtn, saving && { opacity: 0.7 }, isHoliday && { backgroundColor: '#10B981' }]}
            onPress={saveAttendance}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name={isHoliday ? "checkmark-circle" : "person"} size={18} color="#FFF" />
                <Text style={s.saveBtnTxt}>{isHoliday ? 'Finalize Holiday Attendance' : 'Submit Attendance'}</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {isFutureDate && (
        <View style={s.lockedBanner}>
          <Ionicons name="time" size={16} color="#64748B" />
          <Text style={s.lockedTxt}>FUTURE DATE LOCKED</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingBottom: 20, paddingHorizontal: 20,
    borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
  },
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', marginBottom: 20,
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20, 
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center'
  },
  titleBlock: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  subtitle: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '800', letterSpacing: 1.2, marginTop: 4 },
  moreBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },

  // Date Strip
  dateStrip: {
    flexDirection: 'row', justifyContent: 'space-between', width: '100%',
    paddingVertical: 10,
  },
  dateItem: {
    width: 60, height: 75, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  dateItemSelected: { 
    backgroundColor: '#FFF', height: 90, marginTop: -7.5,
    ...shadows.md,
  },
  dateDayName: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  dateDay: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  dateTextSelectedName: { color: '#4F7FFF' },
  dateTextSelectedDay: { color: '#1E293B', fontSize: 22 },
  selectedDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4F7FFF', marginTop: 4 },
  holidayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#F59E0B', position: 'absolute', top: 8, right: 8 },
  dateTickCorner: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#FFF', borderRadius: 10,
    width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
    ...shadows.sm,
  },

  // Search
  searchContainer: { paddingHorizontal: 20, marginTop: 25 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F1F5F9', paddingHorizontal: 16,
    borderRadius: 14, height: 48,
  },
  searchBarInput: { flex: 1, color: '#1E293B', fontSize: 14, fontWeight: '600' },
  placeholder: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },

  // List Meta
  listMeta: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, marginTop: 25, marginBottom: 15,
  },
  studentCount: { fontSize: 15, fontWeight: '700', color: '#64748B' },

  // Student Cards
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  studentCard: {
    backgroundColor: '#FFF', padding: 16, borderRadius: 24, marginBottom: 16,
    ...shadows.sm, borderWidth: 1, borderColor: '#F1F5F9',
  },
  studentHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  nameBlock: { flex: 1 },
  studentName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  rollNo: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  statsBlock: { alignItems: 'flex-end' },
  percentageTxt: { fontSize: 18, fontWeight: '900' },
  statsLabel: { fontSize: 8, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },

  statusGrid: { flexDirection: 'row', gap: 10 },
  statusTab: { flex: 1, height: 42, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  tabPresent: { backgroundColor: '#10B981' },
  tabAbsent: { backgroundColor: '#EF4444' },
  tabOD: { backgroundColor: '#2563EB' },
  tabTxt: { fontSize: 14, fontWeight: '900', color: '#94A3B8' },
  tabTxtActive: { color: '#FFF' },

  absentActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  subBtn: { flex: 1, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  subBtnTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  holidayBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DCFCE7',
    margin: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#86EFAC',
  },
  holidayText: { fontSize: 13, color: '#15803D', fontWeight: '600' },

  // Class Picker
  pickerRow: { paddingVertical: 12 },
  classPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
    backgroundColor: '#FFF', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  classPillActive: { backgroundColor: '#1E293B', borderColor: '#1E293B' },
  classPillTxt: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  classPillTxtActive: { color: '#FFF' },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  saveBtn: {
    backgroundColor: '#1D4ED8', height: 60, borderRadius: 18,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12,
    ...shadows.md,
  },
  saveBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  lockedBanner: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F1F5F9', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  lockedTxt: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 1 },
});

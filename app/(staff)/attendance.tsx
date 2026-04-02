import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, LayoutAnimation, Platform, UIManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { dataService, Student, ClassData } from '../../services/dataService';
import { useAuth } from '../../hooks/useAuth';
import { shadows } from '../../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── 5-day date strip component ─────────────────────────────────────
function AttendanceDateStrip({
  selectedDate, onSelect, holidays
}: { 
  selectedDate: string; 
  onSelect: (d: string) => void; 
  holidays: string[] 
}) {
  const dates = [];
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
        const isHoliday = holidays.includes(dateStr);

        return (
          <Pressable
            key={dateStr}
            onPress={() => onSelect(dateStr)}
            style={[
              s.dateItem,
              isSelected && s.dateItemSelected,
              isHoliday && s.dateItemHoliday
            ]}
          >
            <Text style={[s.dateDayName, isSelected && s.dateTextSelected, isHoliday && s.dateTextHoliday]}>
              {dayName}
            </Text>
            <Text style={[s.dateDay, isSelected && s.dateTextSelected, isHoliday && s.dateTextHoliday]}>
              {day}
            </Text>
            {isHoliday && <View style={s.holidayDot} />}
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

  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present'|'absent'|'on-duty'|'unapproved'>>({});
  const [lockedDates, setLockedDates] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const cls = await dataService.getClasses();
      setClasses(cls);
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
      }
    } catch (e) {
      console.error('Load class attendance error:', e);
    }
  }, [selectedClass, date]);

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
    if (lockedDates.includes(date)) {
      Alert.alert('Locked', 'Attendance for this date is already marked and locked.');
      return;
    }
    if (isHoliday) {
      Alert.alert('Leave Day', 'The Dean has marked this day as a department-wide leave. Attendance cannot be recorded.');
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
    if (!selectedClass) return;
    if (lockedDates.includes(date)) return;

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

  const isHoliday = holidays.includes(date);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4F7FFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={20} color="#0F172A" />
        </Pressable>
        <View>
          <Text style={s.title}>Attendance</Text>
          <Text style={s.subtitle}>{selectedClass?.name || 'Loading...'}</Text>
        </View>
        <View style={s.headerRight} />
      </View>

      {/* Date Strip */}
      <AttendanceDateStrip 
        selectedDate={date} 
        onSelect={setDate} 
        holidays={holidays}
      />

      {isHoliday && (
        <View style={s.holidayBanner}>
          <Ionicons name="sunny" size={18} color="#15803D" />
          <Text style={s.holidayText}>Dean marked this day as a holiday/leave.</Text>
        </View>
      )}

      {/* Class Picker */}
      <View style={s.pickerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {classes.map(c => (
            <Pressable
              key={c.id}
              onPress={() => setSelectedClass(c)}
              style={[s.classPill, selectedClass?.id === c.id && s.classPillActive]}
            >
              <Text style={[s.classPillTxt, selectedClass?.id === c.id && s.classPillTxtActive]}>
                {c.section}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Student List */}
      <ScrollView contentContainerStyle={s.list}>
        {students.map((student, idx) => {
          const status = attendance[student.id] || 'present';
          return (
            <View key={student.id} style={s.studentCard}>
              <View style={s.studentInfo}>
                <View style={s.avatar}>
                  <Text style={s.avatarTxt}>{student.name.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={s.studentName}>{student.name}</Text>
                  <View style={s.rollRow}>
                    <Text style={s.rollNo}>{student.rollNo}</Text>
                    <View style={s.dot} />
                    <Text style={s.studentRate}>{Math.round(student.attendanceRate)}% Attendance</Text>
                  </View>
                </View>
              </View>

              <View style={s.actionRow}>
                <Pressable
                  onPress={() => toggleAttendance(student.id, 'present')}
                  style={[s.statusBtn, status === 'present' && s.btnPresent]}
                >
                  <MaterialIcons name="check" size={18} color={status === 'present' ? '#FFF' : '#CBD5E1'} />
                </Pressable>
                
                <Pressable
                  onPress={() => toggleAttendance(student.id, 'absent')}
                  style={[s.statusBtn, (status === 'absent' || status === 'unapproved') && s.btnAbsent]}
                >
                  <MaterialIcons 
                    name={status === 'unapproved' ? 'block' : 'close'} 
                    size={18} 
                    color={(status === 'absent' || status === 'unapproved') ? '#FFF' : '#CBD5E1'} 
                  />
                </Pressable>

                <Pressable
                  onPress={() => toggleAttendance(student.id, 'on-duty')}
                  style={[s.statusBtn, status === 'on-duty' && s.btnOD]}
                >
                  <Text style={[s.odTxt, status === 'on-duty' && { color: '#FFF' }]}>OD</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Bar */}
      {!lockedDates.includes(date) && !isHoliday && (
        <View style={[s.bottomBar, { paddingBottom: 20 }]}>
          <Pressable
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={saveAttendance}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={s.saveBtnTxt}>SUBMIT ATTENDANCE</Text>
                <MaterialIcons name="send" size={18} color="#FFF" />
              </>
            )}
          </Pressable>
        </View>
      )}

      {lockedDates.includes(date) && (
        <View style={s.lockedBanner}>
          <FontAwesome name="lock" size={16} color="#64748B" />
          <Text style={s.lockedTxt}>ATTENDANCE FINALIZED</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  headerRight: { width: 40 },

  // Date Strip
  dateStrip: {
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20,
    backgroundColor: '#FFF', paddingVertical: 12, ...shadows.sm,
  },
  dateItem: {
    width: 58, height: 75, borderRadius: 18, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  dateItemSelected: { backgroundColor: '#4F7FFF' },
  dateItemHoliday: { backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC' },
  dateDayName: { fontSize: 10, fontWeight: '800', color: '#94A3B8' },
  dateDay: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  dateTextSelected: { color: '#FFF' },
  dateTextHoliday: { color: '#15803D' },
  holidayDot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: '#15803D' },

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

  // Student List
  list: { padding: 16, paddingBottom: 100 },
  studentCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    padding: 14, borderRadius: 20, marginBottom: 12, ...shadows.sm,
  },
  studentInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4F7FFF15', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 16, fontWeight: '800', color: '#4F7FFF' },
  studentName: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  rollRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rollNo: { fontSize: 12, color: '#6366F1', fontWeight: '800' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1' },
  studentRate: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 8 },
  statusBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  btnPresent: { backgroundColor: '#10B981' },
  btnAbsent: { backgroundColor: '#EF4444' },
  btnOD: { backgroundColor: '#3B82F6' },
  odTxt: { fontSize: 10, fontWeight: '900', color: '#CBD5E1' },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  saveBtn: {
    backgroundColor: '#4F46E5', height: 54, borderRadius: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    ...shadows.md,
  },
  saveBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },

  lockedBanner: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F1F5F9', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  lockedTxt: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 1 },
});

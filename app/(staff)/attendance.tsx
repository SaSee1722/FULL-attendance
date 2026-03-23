import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { dataService, ClassData, Student } from '../../services/dataService';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

type AttendanceStatus = 'present' | 'absent' | 'on-duty' | 'unapproved';

export default function StaffAttendance() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const loadClasses = useCallback(async () => {
    try {
      const allClasses = await dataService.getClasses();
      const userClasses = allClasses.filter(
        cls => cls.advisor === user?.name
      );
      setAssignedClasses(userClasses);
    } catch (error) {
      console.error('Failed to load classes:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadClasses();

      subsRef.current.forEach(s => s.unsubscribe());
      subsRef.current = [
        dataService.subscribeToTable('classes', loadClasses),
      ];

      return () => {
        subsRef.current.forEach(s => s.unsubscribe());
        subsRef.current = [];
      };
    }, [user, loadClasses])
  );

  const loadStudents = async (classId: string) => {
    try {
      const studentData = await dataService.getStudentsByClass(classId);
      setStudents(studentData);
      
      // Initialize all as present (mark all present feature)
      const initialAttendance: Record<string, AttendanceStatus> = {};
      studentData.forEach(student => {
        initialAttendance[student.id] = 'present';
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  };

  const handleClassSelect = (classId: string) => {
    setSelectedClass(classId);
    loadStudents(classId);
  };

  const handleMarkAllPresent = () => {
    const allPresent: Record<string, AttendanceStatus> = {};
    students.forEach(student => {
      allPresent[student.id] = 'present';
    });
    setAttendance(allPresent);
  };

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSubmit = async () => {
    if (!selectedClass) return;

    try {
      const records = students.map(student => ({
        studentId: student.id,
        classId: selectedClass,
        date: new Date().toISOString().split('T')[0],
        status: attendance[student.id] || 'present',
        markedBy: user?.id || '',
      }));

      await dataService.markAttendance(records);
      showAlert('Success', 'Attendance marked successfully');
      setSelectedClass(null);
      setStudents([]);
      setAttendance({});
    } catch (error) {
      showAlert('Error', 'Failed to mark attendance');
    }
  };

  const MAIN_OPTIONS = [
    { key: 'present' as AttendanceStatus,  label: 'Present', color: colors.present, icon: 'check-circle' },
    { key: 'absent'  as AttendanceStatus,  label: 'Absent',  color: colors.absent,  icon: 'cancel' },
    { key: 'on-duty' as AttendanceStatus,  label: 'On Duty', color: colors.onDuty,  icon: 'work' },
  ];

  const ABSENT_SUB_OPTIONS = [
    { key: 'unapproved' as AttendanceStatus, label: 'Unapproved', color: colors.absent,     icon: 'block' },
    { key: 'absent'     as AttendanceStatus, label: 'Approved',   color: colors.unapproved, icon: 'event-available' },
  ];

  const isAbsentVariant = (s: AttendanceStatus) => s === 'absent' || s === 'unapproved';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.staff} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.staff, '#D97706']}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.headerTitle}>Mark Attendance</Text>
        <Text style={styles.headerSubtitle}>
          {selectedClass ? 'Select student status' : 'Choose a class to begin'}
        </Text>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {!selectedClass ? (
          <>
            <Text style={styles.sectionTitle}>Select Class</Text>
            {assignedClasses.map((classItem) => (
              <Pressable
                key={classItem.id}
                style={({ pressed }) => [
                  styles.classCard,
                  shadows.md,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => handleClassSelect(classItem.id)}
              >
                <View style={styles.classIcon}>
                  <MaterialIcons name="class" size={24} color={colors.staff} />
                </View>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{classItem.name}</Text>
                  <Text style={styles.classDetails}>
                    {classItem.studentCount} Students • {classItem.section}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <View style={styles.toolbar}>
              <Pressable
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setSelectedClass(null)}
              >
                <MaterialIcons name="arrow-back" size={20} color={colors.staff} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.markAllButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleMarkAllPresent}
              >
                <MaterialIcons name="done-all" size={20} color={colors.success} />
                <Text style={styles.markAllText}>Mark All Present</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>
              Students ({students.length})
            </Text>

            {students.map((student) => {
              const currentStatus = attendance[student.id] || 'present';
              const absentActive = isAbsentVariant(currentStatus);

              return (
                <View key={student.id} style={[styles.studentCard, shadows.sm]}>
                  <View style={styles.studentHeader}>
                    <View style={styles.studentAvatar}>
                      <MaterialIcons name="person" size={20} color={colors.staff} />
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{student.name}</Text>
                      <Text style={styles.studentRoll}>Roll No: {student.rollNo}</Text>
                    </View>
                  </View>

                  <View style={styles.statusButtonRow}>
                    {MAIN_OPTIONS.map((opt) => {
                      const isAbsentBtn = opt.key === 'absent';
                      const isSelected = isAbsentBtn ? absentActive : currentStatus === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          style={[
                            styles.statusButton,
                            isSelected
                              ? { backgroundColor: opt.color, borderColor: opt.color }
                              : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                          ]}
                          onPress={() => {
                            if (isAbsentBtn) {
                              setStudentStatus(student.id, 'unapproved');
                            } else {
                              setStudentStatus(student.id, opt.key);
                            }
                          }}
                        >
                          <MaterialIcons
                            name={opt.icon as any}
                            size={14}
                            color={isSelected ? '#FFFFFF' : colors.textTertiary}
                          />
                          <Text style={[styles.statusButtonText, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {absentActive && (
                    <View style={styles.subOptionRow}>
                      <MaterialIcons name="subdirectory-arrow-right" size={14} color={colors.textTertiary} style={{ marginRight: 4 }} />
                      {ABSENT_SUB_OPTIONS.map((sub) => {
                        const isSelected = currentStatus === sub.key;
                        return (
                          <Pressable
                            key={sub.key}
                            style={[
                              styles.subOptionButton,
                              isSelected
                                ? { backgroundColor: sub.color, borderColor: sub.color }
                                : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                            ]}
                            onPress={() => setStudentStatus(student.id, sub.key)}
                          >
                            <MaterialIcons
                              name={sub.icon as any}
                              size={13}
                              color={isSelected ? '#FFFFFF' : colors.textTertiary}
                            />
                            <Text style={[styles.subOptionText, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
                              {sub.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                shadows.lg,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSubmit}
            >
              <LinearGradient
                colors={[colors.staff, '#D97706']}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialIcons name="check" size={24} color="#FFFFFF" />
                <Text style={styles.submitText}>Submit Attendance</Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 24,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  classIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.staffLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  classDetails: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.staff,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  markAllText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  studentCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.staffLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  studentRoll: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusButtonRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statusButtonText: {
    ...typography.label,
    fontSize: 11,
    fontWeight: '600',
  },
  subOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
    gap: spacing.xs,
  },
  subOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  subOptionText: {
    ...typography.label,
    fontSize: 11,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  submitText: {
    ...typography.bodyMedium,
    fontSize: 18,
    color: '#FFFFFF',
  },
});

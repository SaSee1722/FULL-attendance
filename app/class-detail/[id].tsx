import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dataService, ClassData, Student } from '../../services/dataService';
import { useAlert } from '@/template';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [studentForm, setStudentForm] = useState({
    name: '',
    rollNo: '',
  });

  useEffect(() => {
    loadData();

    // Subscribe to students changes for this class
    const subscription = dataService.subscribeToTable('students', loadData, {
      filter: `class_id=eq.${id}`
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cls, stds] = await Promise.all([
        dataService.getClassById(id),
        dataService.getStudentsByClass(id),
      ]);
      setClassData(cls);
      setStudents(stds);
    } catch (error) {
      console.error('Failed to load class detail:', error);
      showAlert('Error', 'Failed to load class information');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!studentForm.name || !studentForm.rollNo) {
      showAlert('Error', 'Please fill all fields');
      return;
    }

    try {
      if (editingStudent) {
        await dataService.updateStudent(editingStudent.id, {
          name: studentForm.name,
          rollNo: studentForm.rollNo,
        });
        showAlert('Success', 'Student updated successfully');
      } else {
        await dataService.addStudent({
          name: studentForm.name,
          rollNo: studentForm.rollNo,
          classId: id as string,
        });
        showAlert('Success', 'Student added successfully');
      }
      setStudentForm({ name: '', rollNo: '' });
      setShowAddForm(false);
      setEditingStudent(null);
      loadData();
    } catch (error: any) {
      console.error('Operation failed:', error);
      showAlert('Error', error.message || (editingStudent ? 'Failed to update student' : 'Failed to add student'));
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({ name: student.name, rollNo: student.rollNo });
    setShowAddForm(true);
  };

  const handleDelete = (student: Student) => {
    showAlert(
      'Confirm Delete',
      `Are you sure you want to remove ${student.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await dataService.deleteStudent(student.id, id as string);
              loadData();
            } catch (error: any) {
              console.error('Delete failed:', error);
              showAlert('Error', error.message || 'Failed to delete student');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.admin} />
      </View>
    );
  }

  if (!classData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Class not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.admin, '#312E81']}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{classData.name}</Text>
            <Text style={styles.headerSubtitle}>
              {classData.year} - Section {classData.section}
            </Text>
          </View>
          <View style={styles.iconButton} />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Students ({students.length})</Text>
          <Pressable 
            style={styles.addButton}
            onPress={() => {
              if (showAddForm) {
                setEditingStudent(null);
                setStudentForm({ name: '', rollNo: '' });
              }
              setShowAddForm(!showAddForm);
            }}
          >
            <MaterialIcons name={showAddForm ? 'close' : 'person-add'} size={20} color={colors.admin} />
            <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : 'Add Student'}</Text>
          </Pressable>
        </View>

        {showAddForm && (
          <View style={[styles.formCard, shadows.sm]}>
            <Text style={styles.formTitle}>
              {editingStudent ? 'Edit Student' : 'Add New Student'}
            </Text>
            
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., John Doe"
              value={studentForm.name}
              onChangeText={(text) => setStudentForm({ ...studentForm, name: text })}
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Roll Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., CSE001"
              value={studentForm.rollNo}
              onChangeText={(text) => setStudentForm({ ...studentForm, rollNo: text })}
              placeholderTextColor={colors.textTertiary}
            />

            <Pressable style={styles.submitButton} onPress={handleAddStudent}>
              <Text style={styles.submitButtonText}>
                {editingStudent ? 'Update Student' : 'Add Student'}
              </Text>
            </Pressable>
          </View>
        )}

        {students.length > 0 ? (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.studentCard, shadows.sm]}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{item.name}</Text>
                  <Text style={styles.studentRoll}>{item.rollNo}</Text>
                </View>
                <View style={styles.actions}>
                  <Pressable style={styles.actionButton} onPress={() => handleEdit(item)}>
                    <MaterialIcons name="edit" size={20} color={colors.info} />
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => handleDelete(item)}>
                    <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: spacing.xxl }}
            showsVerticalScrollIndicator={false}
          />
        ) : !showAddForm && (
          <View style={styles.emptyState}>
            <MaterialIcons name="people-outline" size={60} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No students added yet</Text>
            <Pressable 
              style={styles.emptyButton}
              onPress={() => setShowAddForm(true)}
            >
              <Text style={styles.emptyButtonText}>Add First Student</Text>
            </Pressable>
          </View>
        )}
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.h2,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.admin,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  header: {
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    fontSize: 20,
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.adminLight,
    borderRadius: borderRadius.sm,
  },
  addButtonText: {
    ...typography.label,
    color: colors.admin,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  formTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
  },
  submitButton: {
    backgroundColor: colors.admin,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  studentRoll: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    backgroundColor: colors.admin,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
});

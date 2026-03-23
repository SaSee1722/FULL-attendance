import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { dataService, StaffMember, ClassData } from '../../services/dataService';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

export default function DeanManagement() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    year: '',
    section: '',
    advisor: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [staffData, classesData] = await Promise.all([
        dataService.getStaffMembers(user?.department),
        dataService.getClasses(user?.department)
      ]);
      setStaff(staffData);
      setClasses(classesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.department]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadData();

      subsRef.current.forEach(s => s.unsubscribe());
      subsRef.current = [
        dataService.subscribeToTable('profiles', loadData),
        dataService.subscribeToTable('classes', loadData),
      ];

      return () => {
        subsRef.current.forEach(s => s.unsubscribe());
        subsRef.current = [];
      };
    }, [user, loadData])
  );

  const handleCreateClass = async () => {
    if (!formData.name || !formData.year || !formData.section || !formData.advisor) {
      showAlert('Error', 'Please fill all fields');
      return;
    }

    try {
      await dataService.createClass({
        name: formData.name,
        department: user?.department || '',
        year: formData.year,
        section: formData.section,
        advisor: formData.advisor,
      });

      showAlert('Success', 'Class created successfully');
      setFormData({ name: '', year: '', section: '', advisor: '' });
      setShowForm(false);
      loadData();
    } catch (error) {
      showAlert('Error', 'Failed to create class');
    }
  };

  const handleDeleteClass = (classId: string, className: string) => {
    console.log('handleDeleteClass called for:', classId);
    showAlert(
      'Delete Class',
      `Are you sure you want to delete ${className}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            console.log('Confirm delete pressed for:', classId);
            try {
              await dataService.deleteClass(classId);
              console.log('Class deleted successfully');
              loadData();
            } catch (error: any) {
              console.error('Class delete failed in UI:', error);
              showAlert('Error', error.message || 'Failed to delete class');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.dean} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.dean, '#059669']}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.headerTitle}>Class Management</Text>
        <Text style={styles.headerSubtitle}>Create and assign classes</Text>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            shadows.md,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setShowForm(!showForm)}
        >
          <LinearGradient
            colors={[colors.dean, '#059669']}
            style={styles.createButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <MaterialIcons name={showForm ? 'close' : 'add'} size={24} color="#FFFFFF" />
            <Text style={styles.createButtonText}>
              {showForm ? 'Cancel' : 'Create New Class'}
            </Text>
          </LinearGradient>
        </Pressable>

        {showForm && (
          <View style={[styles.formCard, shadows.sm]}>
            <Text style={styles.formTitle}>New Class Details</Text>

            <Text style={styles.label}>Class Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Computer Science - A"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Year</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2024"
              value={formData.year}
              onChangeText={(text) => setFormData({ ...formData, year: text })}
              keyboardType="numeric"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Section</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., A"
              value={formData.section}
              onChangeText={(text) => setFormData({ ...formData, section: text })}
              maxLength={1}
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Assign Advisor</Text>
            <View style={styles.staffList}>
              {staff.map((member) => (
                <Pressable
                  key={member.id}
                  style={[
                    styles.staffOption,
                    formData.advisor === member.name && styles.staffOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, advisor: member.name })}
                >
                  <MaterialIcons
                    name={formData.advisor === member.name ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={20}
                    color={formData.advisor === member.name ? colors.dean : colors.textSecondary}
                  />
                  <Text style={styles.staffName}>{member.name}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.submitButton} onPress={handleCreateClass}>
              <Text style={styles.submitButtonText}>Create Class</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionTitle}>Department Classes</Text>
        {classes.length > 0 ? (
          classes.map((cls) => (
            <View key={cls.id} style={[styles.classCard, shadows.sm]}>
              <View style={styles.classInfo}>
                <Text style={styles.className}>{cls.name}</Text>
                <Text style={styles.classAdvisor}>Advisor: {cls.advisor}</Text>
                <Text style={styles.classDetails}>{cls.year} - Section {cls.section}</Text>
              </View>
              <Pressable 
                onPress={() => {
                  console.log('Delete icon pressed for:', cls.id);
                  handleDeleteClass(cls.id, cls.name);
                }}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && { opacity: 0.5 }
                ]}
                hitSlop={15}
              >
                <MaterialIcons name="delete-outline" size={24} color={colors.error} />
              </Pressable>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No classes created yet</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Available Staff</Text>
        {staff.map((member) => (
          <View key={member.id}>
            <Pressable 
              style={({ pressed }) => [
                styles.staffCard, 
                shadows.sm,
                pressed && { opacity: 0.7 }
              ]}
              onPress={() => {
                console.log('Staff card pressed:', member.name, member.id);
                setSelectedStaff(selectedStaff === member.id ? null : member.id);
              }}
            >
              <View style={styles.staffIcon}>
                <MaterialIcons name="person" size={24} color={colors.dean} />
              </View>
              <View style={styles.staffInfo}>
                <Text style={styles.staffCardName}>{member.name}</Text>
                <Text style={styles.staffEmail}>{member.email}</Text>
                <View style={styles.staffStats}>
                  <MaterialIcons name="class" size={14} color={colors.textSecondary} />
                  <Text style={styles.staffStatsText}>
                    {member.assignedClasses} classes assigned
                  </Text>
                  <MaterialIcons 
                    name={selectedStaff === member.id ? 'expand-less' : 'expand-more'} 
                    size={20} 
                    color={colors.textSecondary} 
                    style={{ marginLeft: 'auto' }}
                  />
                </View>
              </View>
            </Pressable>
            
            {selectedStaff === member.id && (
              <View style={styles.assignedClassesList}>
                <Text style={styles.assignedClassesTitle}>Assigned Classes:</Text>
                {classes.filter(c => c.advisor === member.name).length > 0 ? (
                  classes.filter(c => c.advisor === member.name).map(c => (
                    <View key={c.id} style={styles.assignedClassItem}>
                      <MaterialIcons name="check-circle" size={16} color={colors.success} />
                      <Text style={styles.assignedClassName}>{c.name} ({c.id})</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noAssignedText}>No classes assigned to this staff member.</Text>
                )}
              </View>
            )}
          </View>
        ))}
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
  createButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  createButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  formTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  staffList: {
    gap: spacing.sm,
  },
  staffOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  staffOptionSelected: {
    backgroundColor: colors.deanLight,
    borderColor: colors.dean,
  },
  staffName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  submitButton: {
    backgroundColor: colors.dean,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  sectionTitle: {
    ...typography.h2,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
  },
  classAdvisor: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  classDetails: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  staffCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  staffIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.deanLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  staffInfo: {
    flex: 1,
  },
  staffCardName: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  staffEmail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  staffStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  staffStatsText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  assignedClassesList: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    marginLeft: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.dean,
  },
  assignedClassesTitle: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  assignedClassItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  assignedClassName: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  noAssignedText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.textTertiary,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
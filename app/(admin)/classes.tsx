import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform, UIManager, Modal, TouchableWithoutFeedback, Image } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, shadows } from '../../constants/theme';
import { dataService } from '../../services/dataService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ClassExplorer() {
  const router = useRouter();
  const { view } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);

  useEffect(() => {
    loadData();

    // Listen for live class changes (transfers, renaming, etc.)
    const sub = dataService.subscribeToTable('classes', () => loadData());
    
    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const result = await dataService.getClassesWithStudents();
    setData(result);
    setLoading(false);
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.admin} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.headerWrapper}>
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.headerGradient}>
          <SafeAreaView>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerLabel}>INSTITUTION EXPLORER</Text>
                  <Text style={styles.headerTitle}>
                    {view === 'byDept' ? 'Departmental Assets' : 'School Manifest'}
                  </Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {data.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptyDesc}>Add classes and students to see them here.</Text>
          </View>
        ) : (
          data.map((dept, dIdx) => (
            <View key={dept.department} style={styles.deptSection}>
              <View style={styles.deptHeader}>
                <View style={styles.deptTitleBox}>
                   <View style={styles.deptIcon}>
                      <FontAwesome5 name="building" size={12} color={colors.admin} />
                   </View>
                   <Text style={styles.deptTitle}>{dept.department}</Text>
                </View>
                <View style={styles.deptStat}>
                   <Text style={styles.deptStatVal}>{dept.totalStudents}</Text>
                   <Text style={styles.deptStatLabel}>STUDENTS</Text>
                </View>
              </View>

              {dept.classes.map((cls: any) => (
                <View key={cls.id} style={styles.classCardContainer}>
                  <TouchableOpacity 
                    style={styles.classCard}
                    onPress={() => setSelectedClass(cls)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.classMain}>
                      <View style={styles.advisorImageContainer}>
                        {cls.advisorImage ? (
                          <Image source={{ uri: cls.advisorImage }} style={styles.advisorImageList} />
                        ) : (
                          <Ionicons name="person" size={16} color={colors.textTertiary} />
                        )}
                      </View>
                      <View style={styles.classInfo}>
                        <Text style={styles.className}>{cls.name}</Text>
                        <Text style={styles.classAdvisor}>Advisor: {cls.advisor || 'Not Assigned'}</Text>
                      </View>
                      <View style={styles.classRight}>
                        <View style={styles.countPill}>
                           <Text style={styles.countText}>{cls.students.length} Students</Text>
                        </View>
                        <Ionicons 
                          name="chevron-forward" 
                          size={18} 
                          color={colors.textTertiary} 
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!selectedClass}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedClass(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setSelectedClass(null)}>
            <View style={styles.modalBgDim} />
          </TouchableWithoutFeedback>
          
          <View style={styles.modalContent}>
             <View style={styles.modalIndicator} />
             
             <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTop}>
                   <View style={styles.modalAdvisorRow}>
                      <View style={styles.modalAdvisorImage}>
                        {selectedClass?.advisorImage ? (
                          <Image source={{ uri: selectedClass.advisorImage }} style={styles.fullImage} />
                        ) : (
                          <Ionicons name="person" size={24} color={colors.textTertiary} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalClassTitle}>{selectedClass?.name}</Text>
                        <Text style={styles.modalAdvisorText}>Advisor: {selectedClass?.advisor || 'N/A'}</Text>
                      </View>
                   </View>
                   <TouchableOpacity 
                     onPress={() => setSelectedClass(null)}
                     style={styles.closeModalBtn}
                   >
                      <Ionicons name="close" size={20} color={colors.textSecondary} />
                   </TouchableOpacity>
                </View>
             </View>

             <View style={styles.modalManifest}>
                <Text style={styles.manifestTitle}>STUDENT MANIFEST ({selectedClass?.students?.length})</Text>
                <ScrollView 
                  style={styles.modalScroll} 
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  contentContainerStyle={{ paddingBottom: 40 }}
                >
                  <View style={styles.studentGrid}>
                    {selectedClass?.students?.length > 0 ? (
                      selectedClass.students.map((s: any) => (
                        <View key={s.id} style={styles.studentItem}>
                          <View style={styles.studentInfo}>
                             <Text style={styles.modalStudentName} numberOfLines={1}>{s.name}</Text>
                             <Text style={styles.studentId}>Reg No: {s.roll_no || s.enrollment_no || 'N/A'}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noStudentsText}>No students in this class.</Text>
                    )}
                  </View>
                </ScrollView>
             </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  
  headerWrapper: { ...shadows.md, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  headerGradient: { paddingBottom: 15 },
  header: { paddingHorizontal: spacing.xl, paddingTop: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1 },
  headerLabel: { color: colors.admin, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 2 },

  content: { flex: 1 },
  scrollContent: { padding: spacing.xl, paddingBottom: 100 },
  
  deptSection: { marginBottom: 30 },
  deptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  deptTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deptIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  deptTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  deptStat: { alignItems: 'flex-end' },
  deptStatVal: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
  deptStatLabel: { fontSize: 8, fontWeight: '700', color: colors.textTertiary },

  classCardContainer: { marginBottom: 12 },
  classCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, ...shadows.sm, borderWidth: 1, borderColor: '#F1F5F9' },
  classMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  classInfo: { flex: 1 },
  className: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  classAdvisor: { fontSize: 11, color: colors.textTertiary, marginTop: 2, fontWeight: '600' },
  advisorImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  advisorImageList: {
    width: '100%',
    height: '100%',
  },
  modalAdvisorRow: { flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1 },
  modalAdvisorImage: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fullImage: { width: '100%', height: '100%' },
  classRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countPill: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  countText: { fontSize: 10, fontWeight: '800', color: colors.textSecondary },

  // Updated Modal Styles for perfect scrolling
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBgDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.75)' },
  modalContent: { 
    backgroundColor: '#FFF', 
    borderTopLeftRadius: 36, 
    borderTopRightRadius: 36, 
    height: '85%',
    padding: spacing.xl,
    paddingTop: 12
  },
  modalIndicator: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  modalHeader: { marginBottom: 20 },
  modalHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  modalClassTitle: { fontSize: 26, fontWeight: '900', color: colors.textPrimary },
  modalAdvisorText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginTop: 4 },
  closeModalBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  modalManifest: { flex: 1 },
  manifestTitle: { fontSize: 10, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1, marginBottom: 15 },
  modalScroll: { flex: 1 },
  studentGrid: { gap: 12 },
  studentItem: { 
    flexDirection: 'row', alignItems: 'center', gap: 12, 
    backgroundColor: '#FFF', padding: 12, borderRadius: 16,
    borderWidth: 1, borderColor: '#F8FAFC', ...shadows.sm
  },
  studentInfo: { flex: 1 },
  modalStudentName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  studentId: { fontSize: 11, fontWeight: '600', color: colors.textTertiary, marginTop: 2 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: colors.textPrimary, marginTop: 20 },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, marginTop: 8, textAlign: 'center' },
  noStudentsText: { fontSize: 13, fontStyle: 'italic', color: colors.textTertiary, textAlign: 'center', marginTop: 20 }
});

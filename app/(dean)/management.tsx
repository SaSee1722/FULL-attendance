import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, FlatList, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData, Student, StaffMember } from '../../services/dataService';
import { supabase } from '../../lib/supabase';
import { colors, spacing, shadows, borderRadius } from '../../constants/theme';

// ── Patch: update class in supabase ─────────────────────────
const patchClass = async (id: string, payload: { name?: string; advisor?: string }) => {
  const { error } = await supabase.from('classes').update(payload).eq('id', id);
  if (error) throw error;
};

// ── Small Step Chip ──────────────────────────────────────────
function StepChip({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <View style={chipStyles.wrap}>
      <View style={[chipStyles.circle,
        done ? chipStyles.done : active ? chipStyles.active : chipStyles.idle]}>
        {done
          ? <MaterialIcons name="check" size={12} color="#FFF" />
          : <Text style={[chipStyles.num, !active && { color: '#94A3B8' }]}>{num}</Text>}
      </View>
      <Text style={[chipStyles.lbl, active && chipStyles.lblActive]}>{label}</Text>
    </View>
  );
}
const chipStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 3 },
  circle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  active: { backgroundColor: colors.primaryBlue },
  done: { backgroundColor: '#10B981' },
  idle: { backgroundColor: 'rgba(255,255,255,0.12)' },
  num: { fontSize: 11, fontWeight: 'bold', color: '#FFF' },
  lbl: { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  lblActive: { color: '#FFF' },
});

// ── MAIN COMPONENT ───────────────────────────────────────────
export default function DeanManagement() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();

  // ── Data ──
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [students, setStudents] = useState<Record<string, Student[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingStu, setLoadingStu] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Create-class wizard ──
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step-1 form
  const [clsName, setClsName] = useState('');
  const [clsYear, setClsYear] = useState('');
  const [clsSection, setClsSection] = useState('');

  // Step-2 staff picker
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Created class (passed from step 1→2→3)
  const [createdClass, setCreatedClass] = useState<ClassData | null>(null);

  // ── Edit-class modal ──
  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ClassData | null>(null);
  const [editName, setEditName] = useState('');
  const [editAdvisor, setEditAdvisor] = useState<StaffMember | null>(null);

  // ── Student modal (add / edit) ──
  const [stuModal, setStuModal] = useState(false);
  const [stuClassId, setStuClassId] = useState('');
  const [editingStu, setEditingStu] = useState<Student | null>(null);
  const [stuName, setStuName] = useState('');
  const [stuRoll, setStuRoll] = useState('');

  const fetchAll = useCallback(async () => {
    if (authLoading || !user) return;
    try {
      setLoading(true);
      const [cls, sf] = await Promise.all([
        dataService.getClasses(),
        dataService.getStaffMembers(),
      ]);
      setClasses(cls);
      setStaffList(sf);
    } catch (e) {
      console.error('fetchAll management error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchAll();
      const subClasses = dataService.subscribeToTable('classes', fetchAll);
      const subStudents = dataService.subscribeToTable('students', fetchAll);
      
      return () => {
        subClasses?.unsubscribe();
        subStudents?.unsubscribe();
      };
    }
  }, [fetchAll, authLoading, user]);

  const fetchStudents = async (classId: string, force = false) => {
    if (students[classId] && !force) return;
    setLoadingStu(p => ({ ...p, [classId]: true }));
    try {
      const s = await dataService.getStudentsByClass(classId);
      setStudents(p => ({ ...p, [classId]: s }));
    } catch (e) { console.error(e); }
    finally { setLoadingStu(p => ({ ...p, [classId]: false })); }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    fetchStudents(id);
  };

  // ── Reset wizard ───────────────────────────────────────────
  const resetWizard = () => {
    setStep(1);
    setClsName(''); setClsYear(''); setClsSection('');
    setSelectedStaff(null);
    setCreatedClass(null);
    setWizardOpen(false);
  };

  // ── Step 1 → create class ──────────────────────────────────
  const handleStep1 = async () => {
    if (!clsName.trim() || !clsYear.trim() || !clsSection.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all three fields.'); return;
    }
    try {
      setSubmitting(true);
      const cls = await dataService.createClass({
        name: clsName.trim(),
        department: user?.department || '',
        year: clsYear.trim(),
        section: clsSection.trim(),
        advisor: '',               // advisor assigned in step 2
      });
      setCreatedClass(cls);
      setClasses(p => [cls, ...p]);
      setStep(2);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create class.'); 
    } finally { setSubmitting(false); }
  };

  // ── Step 2 → assign staff ─────────────────────────────────
  const handleStep2 = async () => {
    if (!selectedStaff) { Alert.alert('Required', 'Please select a staff member.'); return; }
    try {
      setSubmitting(true);
      await patchClass(createdClass!.id, { advisor: selectedStaff.name });
      setCreatedClass(c => c ? { ...c, advisor: selectedStaff.name } : c);
      setClasses(p => p.map(c => c.id === createdClass!.id ? { ...c, advisor: selectedStaff.name } : c));
      setStep(3);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to assign staff.'); 
    } finally { setSubmitting(false); }
  };

  // ── Step 3 → add students ─────────────────────────────────
  const handleAddStudentInWizard = async () => {
    if (!stuName.trim() || !stuRoll.trim()) {
      Alert.alert('Required', 'Name and Roll No are required.'); return;
    }
    try {
      setSubmitting(true);
      const added = await dataService.addStudent({
        name: stuName.trim(), rollNo: stuRoll.trim(), classId: createdClass!.id,
      });
      setStudents(p => ({
        ...p, [createdClass!.id]: [added, ...(p[createdClass!.id] || [])],
      }));
      setStuName(''); setStuRoll('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add student.');
    } finally { setSubmitting(false); }
  };

  // ── Edit class ────────────────────────────────────────────
  const openEditClass = (cls: ClassData) => {
    setEditTarget(cls);
    setEditName(cls.name);
    const match = staffList.find(s => s.name === cls.advisor) || null;
    setEditAdvisor(match);
    setEditModal(true);
  };

  const saveEditClass = async () => {
    if (!editTarget || !editName.trim()) { Alert.alert('Required', 'Class name is required.'); return; }
    try {
      setSubmitting(true);
      await patchClass(editTarget.id, {
        name: editName.trim(),
        advisor: editAdvisor?.name || editTarget.advisor,
      });
      setClasses(p => p.map(c => c.id === editTarget.id
        ? { ...c, name: editName.trim(), advisor: editAdvisor?.name || c.advisor } : c));
      setEditModal(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update class.');
    } finally { setSubmitting(false); }
  };

  // ── Delete class ──────────────────────────────────────────
  const deleteClass = (id: string, name: string) => {
    Alert.alert('Delete Class', `"${name}" and all its students will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await dataService.deleteClass(id);
            setClasses(p => p.filter(c => c.id !== id));
            setStudents(p => { const n = { ...p }; delete n[id]; return n; });
            if (expandedId === id) setExpandedId(null);
          } catch (e: any) { Alert.alert('Error', e?.message || 'Could not delete.'); }
      }},
    ]);
  };

  // ── Add student inline ────────────────────────────────────
  const openAddStu = (classId: string) => {
    setStuClassId(classId); setEditingStu(null);
    setStuName(''); setStuRoll('');
    setStuModal(true);
  };
  const openEditStu = (classId: string, s: Student) => {
    setStuClassId(classId); setEditingStu(s);
    setStuName(s.name); setStuRoll(s.rollNo);
    setStuModal(true);
  };
  const saveStu = async () => {
    if (!stuName.trim() || !stuRoll.trim()) { Alert.alert('Required', 'Both fields are required.'); return; }
    try {
      setSubmitting(true);
      if (editingStu) {
        const updated = await dataService.updateStudent(editingStu.id, { name: stuName.trim(), rollNo: stuRoll.trim() });
        setStudents(p => ({ ...p, [stuClassId]: (p[stuClassId] || []).map(s => s.id === editingStu.id ? updated : s) }));
      } else {
        const added = await dataService.addStudent({ name: stuName.trim(), rollNo: stuRoll.trim(), classId: stuClassId });
        setStudents(p => ({ ...p, [stuClassId]: [added, ...(p[stuClassId] || [])] }));
      }
      setStuModal(false);
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
    finally { setSubmitting(false); }
  };
  const deleteStu = (classId: string, s: Student) => {
    Alert.alert('Remove Student', `Remove "${s.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await dataService.deleteStudent(s.id, classId);
            setStudents(p => ({ ...p, [classId]: (p[classId] || []).filter(x => x.id !== s.id) }));
          } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
      }},
    ]);
  };

  // ─── RENDER ───────────────────────────────────────────────
  const PALETTE = [
    { bg: '#EEF2FF', color: '#4F46E5' },
    { bg: '#ECFDF5', color: '#059669' },
    { bg: '#EFF6FF', color: '#2563EB' },
    { bg: '#FFF7ED', color: '#D97706' },
    { bg: '#FFF1F2', color: '#E11D48' },
  ];

  return (
    <View style={s.root}>
      {/* ── HEADER ── */}
      <LinearGradient 
        colors={['#0F172A', '#1E293B']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.topBar}>
          <View>
            <Text style={s.headerSub}>ADMINISTRATION</Text>
            <Text style={s.headerTitle}>Class Management</Text>
          </View>
          <Pressable 
            style={({ pressed }) => [s.createBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]} 
            onPress={() => { resetWizard(); setWizardOpen(true); }}
          >
            <LinearGradient
              colors={['#1152d4', '#1d4ed8']}
              style={s.createBtnGradient}
            >
              <MaterialIcons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={s.createBtnText}>New Class</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={s.statChipsScroll}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statChips}>
            <View style={s.chip}>
              <MaterialIcons name="class" size={14} color="#818CF8" />
              <Text style={s.chipTxt}>{classes.length} <Text style={s.chipBold}>Classes</Text></Text>
            </View>
            <View style={s.chip}>
              <MaterialIcons name="groups" size={14} color="#34D399" />
              <Text style={s.chipTxt}>
                {Object.values(students).reduce((a, arr) => a + arr.length, 0)} <Text style={s.chipBold}>Students</Text>
              </Text>
            </View>
            <View style={s.chip}>
              <MaterialIcons name="admin-panel-settings" size={14} color="#FBBF24" />
              <Text style={s.chipTxt}>{staffList.length} <Text style={s.chipBold}>Staff</Text></Text>
            </View>
          </ScrollView>
        </View>
      </LinearGradient>

      {/* ── CLASS LIST ── */}

      {loading
        ? <ActivityIndicator color={colors.primaryBlue} style={{ marginTop: 48 }} />
        : (
          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {classes.length === 0
              ? (
                <View style={[s.emptyCrd, shadows.sm]}>
                  <MaterialIcons name="class" size={52} color="#CBD5E1" />
                  <Text style={s.emptyT}>No classes yet</Text>
                  <Text style={s.emptyD}>Create your first class to start tracking attendance for your department.</Text>
                  <Pressable 
                    style={s.emptyBtn}
                    onPress={() => { resetWizard(); setWizardOpen(true); }}
                  >
                    <Text style={s.emptyBtnTxt}>Initialize First Class</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
                  </Pressable>
                </View>
              )
              : classes.map((cls, idx) => {
                  const expanded = expandedId === cls.id;
                  const clsStu = students[cls.id] || [];
                  const stuLoading = loadingStu[cls.id];
                  
                  const actualCount = students[cls.id] ? students[cls.id].length : (cls.studentCount || 0);
                  const pal = PALETTE[idx % PALETTE.length];

                  return (
                    <View key={cls.id} style={[s.clsCrd, shadows.md]}>
                      <Pressable 
                        style={({ pressed }) => [s.clsRow, pressed && { backgroundColor: '#F8FAFC' }]}
                        onPress={() => toggleExpand(cls.id)}
                      >
                        {/* Advisor Image / Class Badge */}
                        <View style={s.clsBadge}>
                          {cls.advisorImage ? (
                            <Image 
                              source={{ uri: cls.advisorImage }} 
                              style={s.clsBadgeImg} 
                            />
                          ) : (
                            <LinearGradient
                              colors={[pal.bg, '#FFFFFF']}
                              style={s.clsBadgeFill}
                            >
                              <Text style={[s.clsBadgeTxt, { color: pal.color }]}>
                                {cls.name.charAt(0).toUpperCase()}
                              </Text>
                            </LinearGradient>
                          )}
                        </View>
 
                        {/* Info */}
                        <View style={s.clsInfo}>
                          <Text style={s.clsName}>{cls.name}</Text>
                          <Text style={s.clsMeta} numberOfLines={1}>
                            {cls.advisor || 'No Advisor Assigned'}
                          </Text>
                          <View style={s.clsTagRow}>
                            <View style={s.tagBlue}>
                              <Text style={s.tagBlueTxt}>Yr {cls.year}</Text>
                            </View>
                            <View style={s.tagSlate}>
                              <Text style={s.tagSlateTxt}>Sec {cls.section}</Text>
                            </View>
                          </View>
                        </View>
 
                        <View style={s.clsActions}>
                          <View style={[s.rateTag, { backgroundColor: '#F0F9FF' }]}>
                            <Text style={[s.rateTagTxt, { color: colors.primaryBlue }]}>
                              {actualCount} Student{actualCount !== 1 ? 's' : ''}
                            </Text>
                          </View>
                          <View style={s.iconRow}>
                            <Pressable 
                              onPress={() => openEditClass(cls)} 
                              style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
                            >
                              <MaterialIcons name="edit" size={16} color="#64748B" />
                            </Pressable>
                            <Pressable 
                              onPress={() => deleteClass(cls.id, cls.name)} 
                              style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
                            >
                              <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>

                      {/* ── Students Panel ── */}
                      {expanded && (
                        <View style={s.stuPanel}>
                          <View style={s.stuPanelTop}>
                            <Text style={s.stuSectionTitle}>
                              Students{!stuLoading ? ` (${clsStu.length})` : ''}
                            </Text>
                            <Pressable onPress={() => openAddStu(cls.id)} style={s.addStuBtn}>
                              <MaterialIcons name="person-add" size={13} color="#FFF" />
                              <Text style={s.addStuTxt}>Add Student</Text>
                            </Pressable>
                          </View>

                          {stuLoading
                            ? <ActivityIndicator color={colors.primaryBlue} style={{ marginVertical: 12 }} />
                            : clsStu.length === 0
                              ? (
                                <Pressable style={s.noStuBox} onPress={() => openAddStu(cls.id)}>
                                  <MaterialIcons name="person-add" size={28} color="#CBD5E1" />
                                  <Text style={s.noStuTxt}>No students yet. Tap to enroll.</Text>
                                </Pressable>
                              )
                              : clsStu.map((st, si) => {
                                  const stRate = Math.round(st.attendanceRate || 0);
                                  const stColor = stRate >= 75 ? '#10B981' : '#EF4444';
                                  return (
                                    <View key={st.id}
                                      style={[s.stuRow, si === clsStu.length - 1 && { borderBottomWidth: 0 }]}>
                                      <View style={s.stuAv}>
                                        <Text style={s.stuAvLetter}>{st.name.charAt(0)}</Text>
                                      </View>
                                      <View style={s.stuInfo}>
                                        <Text style={s.stuName}>{st.name}</Text>
                                        <Text style={s.stuRoll}>{st.rollNo}</Text>
                                      </View>
                                      <View style={s.stRateW}>
                                        <Text style={[s.stRateV, { color: stColor }]}>{stRate}</Text>
                                        <Text style={[s.stRateS, { color: stColor }]}>%</Text>
                                      </View>
                                      <Pressable onPress={() => openEditStu(cls.id, st)} style={s.iconBtn}>
                                        <MaterialIcons name="edit" size={15} color="#64748B" />
                                      </Pressable>
                                      <Pressable onPress={() => deleteStu(cls.id, st)} style={s.iconBtn}>
                                        <MaterialIcons name="person-remove" size={15} color="#EF4444" />
                                      </Pressable>
                                    </View>
                                  );
                                })
                          }
                        </View>
                      )}
                    </View>
                  );
                })
            }
          </ScrollView>
        )
      }


      {/* ════════════════════════════════════════════════
          CREATE CLASS WIZARD MODAL (3 steps)
      ════════════════════════════════════════════════ */}
      <Modal visible={wizardOpen} animationType="slide">
        <View style={wiz.root}>
          {/* Wizard Header */}
          <LinearGradient colors={['#0F172A', '#1E293B']}
            style={[wiz.header, { paddingTop: insets.top + 8 }]}>
            <View style={wiz.topBar}>
              <Pressable onPress={resetWizard} style={wiz.closeBtn}>
                <MaterialIcons name="close" size={22} color="#FFF" />
              </Pressable>
              <Text style={wiz.headerTitle}>
                {step === 1 ? 'New Class' : step === 2 ? 'Assign Staff' : 'Add Students'}
              </Text>
              <View style={{ width: 36 }} />
            </View>

            {/* Step chips row */}
            <View style={wiz.stepRow}>
              <StepChip num={1} label="Class Info" active={step === 1} done={step > 1} />
              <View style={wiz.stepLine} />
              <StepChip num={2} label="Assign Staff" active={step === 2} done={step > 2} />
              <View style={wiz.stepLine} />
              <StepChip num={3} label="Add Students" active={step === 3} done={false} />
            </View>
          </LinearGradient>

          {/* ── STEP 1: Class Info ── */}
          {step === 1 && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={wiz.body}>
              <ScrollView contentContainerStyle={wiz.content} keyboardShouldPersistTaps="handled">
                <Text style={wiz.stepTitle}>Class Details</Text>
                <Text style={wiz.stepSub}>Enter the basic information for the new class</Text>

                <Text style={wiz.label}>Class Name</Text>
                <TextInput style={wiz.input} placeholder="e.g. Advanced Physics"
                  value={clsName} onChangeText={setClsName} placeholderTextColor="#94A3B8" />

                <View style={wiz.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={wiz.label}>Academic Year</Text>
                    <TextInput style={wiz.input} placeholder="e.g. 2024"
                      value={clsYear} onChangeText={setClsYear}
                      keyboardType="numeric" placeholderTextColor="#94A3B8" />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={wiz.label}>Section</Text>
                    <TextInput style={wiz.input} placeholder="e.g. A"
                      value={clsSection} onChangeText={setClsSection}
                      autoCapitalize="characters" placeholderTextColor="#94A3B8" />
                  </View>
                </View>

                <View style={wiz.infoBox}>
                  <MaterialIcons name="info" size={16} color={colors.primaryBlue} />
                  <Text style={wiz.infoTxt}>
                    Department will be automatically set to &quot;{user?.department}&quot;.
                  </Text>
                </View>

                <Pressable
                  style={[wiz.nextBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleStep1} disabled={submitting}>
                  {submitting
                    ? <ActivityIndicator color="#FFF" />
                    : <>
                        <Text style={wiz.nextBtnTxt}>Create Class & Continue</Text>
                        <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
                      </>
                  }
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {/* ── STEP 2: Assign Staff ── */}
          {step === 2 && (
            <View style={wiz.body}>
              <View style={wiz.content}>
                <Text style={wiz.stepTitle}>Assign Staff Advisor</Text>
                <Text style={wiz.stepSub}>
                  Choose from registered staff in {user?.department}
                </Text>

                {staffList.length === 0
                  ? (
                    <View style={wiz.noStaff}>
                      <MaterialIcons name="badge" size={48} color="#CBD5E1" />
                      <Text style={wiz.noStaffT}>No registered staff found</Text>
                      <Text style={wiz.noStaffD}>
                        Staff must sign up with the &quot;{user?.department}&quot; department first.
                      </Text>
                    </View>
                  )
                  : (
                    <FlatList
                      data={staffList}
                      keyExtractor={i => i.id}
                      scrollEnabled={false}
                      renderItem={({ item }) => {
                        const selected = selectedStaff?.id === item.id;
                        return (
                          <Pressable
                            onPress={() => setSelectedStaff(selected ? null : item)}
                            style={[wiz.staffCard, selected && wiz.staffCardSel]}>
                            <View style={[wiz.staffAv, selected && wiz.staffAvSel]}>
                              <Text style={[wiz.staffAvLetter, selected && { color: '#FFF' }]}>
                                {item.name.charAt(0)}
                              </Text>
                            </View>
                            <View style={wiz.staffInfo}>
                              <Text style={[wiz.staffName, selected && { color: colors.primaryBlue }]}>
                                {item.name}
                              </Text>
                              <Text style={wiz.staffEmail}>{item.email}</Text>
                              <Text style={wiz.staffMeta}>
                                {item.assignedClasses} class{item.assignedClasses !== 1 ? 'es' : ''} assigned
                              </Text>
                            </View>
                            <View style={[wiz.checkCircle, selected && wiz.checkCircleSel]}>
                              {selected && <MaterialIcons name="check" size={14} color="#FFF" />}
                            </View>
                          </Pressable>
                        );
                      }}
                    />
                  )
                }
              </View>

              <View style={wiz.footer}>
                <Pressable style={wiz.backBtn} onPress={() => setStep(1)}>
                  <MaterialIcons name="arrow-back" size={18} color="#64748B" />
                  <Text style={wiz.backBtnTxt}>Back</Text>
                </Pressable>
                <Pressable
                  style={[wiz.nextBtn, { flex: 1 }, submitting && { opacity: 0.6 }]}
                  onPress={handleStep2} disabled={submitting}>
                  {submitting
                    ? <ActivityIndicator color="#FFF" />
                    : <>
                        <Text style={wiz.nextBtnTxt}>Assign & Continue</Text>
                        <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
                      </>
                  }
                </Pressable>
              </View>
            </View>
          )}

          {/* ── STEP 3: Add Students ── */}
          {step === 3 && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={wiz.body}>
              <ScrollView contentContainerStyle={wiz.content} keyboardShouldPersistTaps="handled">
                <Text style={wiz.stepTitle}>Enroll Students</Text>
                <Text style={wiz.stepSub}>
                  Add students to &quot;{createdClass?.name}&quot;. You can add more later.
                </Text>

                {/* Added students list */}
                {(students[createdClass?.id || ''] || []).length > 0 && (
                  <View style={wiz.enrolledBox}>
                    <Text style={wiz.enrolledTitle}>
                      Enrolled ({(students[createdClass?.id || ''] || []).length})
                    </Text>
                    {(students[createdClass?.id || ''] || []).map(st => (
                      <View key={st.id} style={wiz.enrolledRow}>
                        <View style={wiz.enrolledAv}>
                          <Text style={wiz.enrolledAvLetter}>{st.name.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={wiz.enrolledName}>{st.name}</Text>
                          <Text style={wiz.enrolledRoll}>{st.rollNo}</Text>
                        </View>
                        <Pressable onPress={() => deleteStu(createdClass!.id, st)}>
                          <MaterialIcons name="close" size={18} color="#EF4444" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* Add form */}
                <View style={wiz.addStuBox}>
                  <Text style={wiz.label}>Student Name</Text>
                  <TextInput style={wiz.input} placeholder="Full name"
                    value={stuName} onChangeText={setStuName} placeholderTextColor="#94A3B8" />
                  <Text style={wiz.label}>Roll Number</Text>
                  <TextInput style={wiz.input} placeholder="e.g. CS2024-001"
                    value={stuRoll} onChangeText={setStuRoll}
                    autoCapitalize="characters" placeholderTextColor="#94A3B8" />
                  <Pressable
                    style={[wiz.addStuBtn, submitting && { opacity: 0.6 }]}
                    onPress={handleAddStudentInWizard} disabled={submitting}>
                    {submitting
                      ? <ActivityIndicator color={colors.primaryBlue} size="small" />
                      : <>
                          <MaterialIcons name="person-add" size={18} color={colors.primaryBlue} />
                          <Text style={wiz.addStuTxtBtn}>Add Student</Text>
                        </>
                    }
                  </Pressable>
                </View>
              </ScrollView>

              <View style={wiz.footer}>
                <Pressable style={wiz.backBtn} onPress={() => setStep(2)}>
                  <MaterialIcons name="arrow-back" size={18} color="#64748B" />
                  <Text style={wiz.backBtnTxt}>Back</Text>
                </Pressable>
                <Pressable style={[wiz.nextBtn, { flex: 1, backgroundColor: '#10B981' }]} onPress={resetWizard}>
                  <MaterialIcons name="check" size={20} color="#FFF" />
                  <Text style={wiz.nextBtnTxt}>Done</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </Modal>

      {/* ── EDIT CLASS MODAL ── */}
      <Modal visible={editModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setEditModal(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Edit Class</Text>
              <Pressable onPress={() => setEditModal(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <Text style={s.label}>Class Name</Text>
            <TextInput style={s.input} value={editName}
              onChangeText={setEditName} placeholderTextColor="#94A3B8" />

            <Text style={s.label}>Assign Staff Advisor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {staffList.map(sf => {
                const sel = editAdvisor?.id === sf.id;
                return (
                  <Pressable key={sf.id} onPress={() => setEditAdvisor(sel ? null : sf)}
                    style={[s.sfChip, sel && s.sfChipSel]}>
                    <Text style={[s.sfChipTxt, sel && { color: '#FFF' }]}>{sf.name}</Text>
                  </Pressable>
                );
              })}
              {staffList.length === 0 && (
                <Text style={{ color: '#94A3B8', fontSize: 12, paddingVertical: 8 }}>
                  No staff registered in this department.
                </Text>
              )}
            </ScrollView>

            <Pressable style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={saveEditClass} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitTxt}>Save Changes</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── ADD / EDIT STUDENT MODAL ── */}
      <Modal visible={stuModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setStuModal(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{editingStu ? 'Edit Student' : 'Add Student'}</Text>
              <Pressable onPress={() => setStuModal(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <Text style={s.label}>Full Name</Text>
            <TextInput style={s.input} placeholder="e.g. Ravi Kumar"
              value={stuName} onChangeText={setStuName} placeholderTextColor="#94A3B8" />
            <Text style={s.label}>Roll Number</Text>
            <TextInput style={s.input} placeholder="e.g. CS2024-001"
              value={stuRoll} onChangeText={setStuRoll}
              autoCapitalize="characters" placeholderTextColor="#94A3B8" />
            <Pressable style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={saveStu} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitTxt}>
                {editingStu ? 'Save Changes' : 'Add Student'}
              </Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Main Screen Styles ─────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    paddingBottom: spacing.lg, 
    borderBottomLeftRadius: 32, 
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', marginTop: 2, letterSpacing: -0.5 },
  createBtn: {
    overflow: 'hidden',
    borderRadius: 14,
    shadowColor: '#1152d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  createBtnGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  createBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  statChipsScroll: { marginTop: spacing.xs },
  statChips: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xs,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  chipTxt: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  chipBold: { color: '#FFF', fontWeight: '800' },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 160 },
  // Empty
  emptyCrd: {
    backgroundColor: '#FFF', borderRadius: borderRadius.xl,
    padding: spacing.xl, alignItems: 'center', gap: 10,
  },
  emptyT: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  emptyD: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primaryBlue, paddingHorizontal: 20,
    paddingVertical: 12, borderRadius: 12, marginTop: 8,
  },
  emptyBtnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  // Class card
  clsCrd: {
    backgroundColor: '#FFF', borderRadius: 24,
    marginBottom: spacing.md, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F1F5F9'
  },
  clsRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, gap: spacing.md,
  },
  clsBadge: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  clsBadgeImg: { width: '100%', height: '100%' },
  clsBadgeFill: { 
    width: '100%', 
    height: '100%', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  clsBadgeTxt: { fontSize: 20, fontWeight: 'bold' },
  clsInfo: { flex: 1, gap: 4 },
  clsName: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  clsMeta: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  clsTagRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tagBlue: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagBlueTxt: { color: '#3B82F6', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  tagSlate: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagSlateTxt: { color: '#64748B', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  clsActions: { alignItems: 'flex-end', gap: 8 },
  rateTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  rateTagTxt: { fontSize: 13, fontWeight: '900' },
  iconRow: { flexDirection: 'row', gap: 4 },
  actionBtn: { 
    width: 36, height: 36, borderRadius: 18, 
    backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9'
  },
  actionBtnPressed: { backgroundColor: '#F1F5F9' },
  iconBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  // Students Panel
  stuPanel: {
    backgroundColor: '#FAFBFC', borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  stuPanelTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: spacing.sm,
  },
  stuSectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  addStuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryBlue, paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 8,
  },
  addStuTxt: { fontSize: 11, fontWeight: 'bold', color: '#FFF' },
  noStuBox: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  noStuTxt: { fontSize: 13, color: '#94A3B8' },
  stuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10,
  },
  stuAv: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: `${colors.primaryBlue}12`,
    justifyContent: 'center', alignItems: 'center',
  },
  stuAvLetter: { fontSize: 14, fontWeight: 'bold', color: colors.primaryBlue },
  stuInfo: { flex: 1 },
  stuName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  stuRoll: { fontSize: 11, color: '#94A3B8' },
  stRateW: { flexDirection: 'row', alignItems: 'flex-start', minWidth: 44, justifyContent: 'flex-end' },
  stRateV: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  stRateS: { fontSize: 10, fontWeight: '700', marginTop: 2, marginLeft: 1 },
  // Bottom sheet modal (edit class / add student)
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.xl, paddingBottom: 44,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.lg,
  },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 16, height: 50,
    fontSize: 15, color: '#0F172A', marginBottom: spacing.md,
  },
  sfChip: {
    backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, marginRight: 8,
  },
  sfChipSel: { backgroundColor: colors.primaryBlue },
  sfChipTxt: { fontSize: 13, fontWeight: '600', color: '#475569' },
  submitBtn: {
    backgroundColor: colors.primaryBlue, height: 52,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  submitTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});

// ── Wizard Styles ─────────────────────────────────────────
const wiz = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingBottom: spacing.md },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#FFF' },
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: 0,
  },
  stepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 6 },
  body: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 160 },
  stepTitle: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  stepSub: { fontSize: 13, color: '#64748B', marginBottom: spacing.xl },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 16, height: 52,
    fontSize: 15, color: '#0F172A', marginBottom: spacing.md,
  },
  row: { flexDirection: 'row' },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${colors.primaryBlue}08`,
    borderRadius: 12, padding: 12, marginBottom: spacing.xl,
    borderWidth: 1, borderColor: `${colors.primaryBlue}15`,
  },
  infoTxt: { flex: 1, fontSize: 12, color: '#475569', lineHeight: 17 },
  nextBtn: {
    backgroundColor: colors.primaryBlue, height: 54,
    borderRadius: 14, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  nextBtnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  footer: {
    flexDirection: 'row', gap: spacing.sm,
    padding: spacing.md, borderTopWidth: 1, borderTopColor: '#F1F5F9',
    backgroundColor: '#FFF',
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F1F5F9', paddingHorizontal: 16,
    height: 54, borderRadius: 14,
  },
  backBtnTxt: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  // Staff cards
  noStaff: {
    alignItems: 'center', gap: 10, backgroundColor: '#FFF',
    borderRadius: 20, padding: 32, marginTop: spacing.md,
  },
  noStaffT: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  noStaffD: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
  staffCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 16,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: '#E2E8F0', gap: spacing.sm,
  },
  staffCardSel: {
    borderColor: colors.primaryBlue,
    backgroundColor: `${colors.primaryBlue}06`,
  },
  staffAv: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  staffAvSel: { backgroundColor: `${colors.primaryBlue}15` },
  staffAvLetter: { fontSize: 20, fontWeight: 'bold', color: '#64748B' },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  staffEmail: { fontSize: 11, color: '#64748B', marginTop: 1 },
  staffMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center',
  },
  checkCircleSel: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
  // Students step
  enrolledBox: {
    backgroundColor: '#FFF', borderRadius: 16,
    padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#E2E8F0',
  },
  enrolledTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 10, textTransform: 'uppercase' },
  enrolledRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  enrolledAv: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: `${colors.primaryBlue}12`,
    justifyContent: 'center', alignItems: 'center',
  },
  enrolledAvLetter: { fontSize: 13, fontWeight: 'bold', color: colors.primaryBlue },
  enrolledName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  enrolledRoll: { fontSize: 11, color: '#94A3B8' },
  addStuBox: {
    backgroundColor: '#FFF', borderRadius: 16,
    padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0',
  },
  addStuBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.primaryBlue,
    height: 48, borderRadius: 12,
  },
  addStuTxtBtn: { fontSize: 14, fontWeight: 'bold', color: colors.primaryBlue },
});
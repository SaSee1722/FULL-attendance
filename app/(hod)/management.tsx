import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, FlatList, Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData, Student, StaffMember } from '../../services/dataService';
import { supabase } from '../../lib/supabase';
import { colors, spacing, shadows, borderRadius } from '../../constants/theme';

// ── CSV Parser ────────────────────────────────────────────────
function parseCSV(raw: string): { rollNo: string; name: string }[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.toLowerCase().startsWith('register') && !l.toLowerCase().startsWith('roll'))
    .map(l => {
      const parts = l.split(',').map(p => p.trim());
      return { rollNo: parts[0] || '', name: parts.slice(1).join(' ').trim() || '' };
    })
    .filter(r => r.rollNo && r.name);
}

// ── Patch: update class in supabase ─────────────────────────
const patchClass = async (id: string, payload: Record<string, any>) => {
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
export default function HODManagement() {
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

  // ── CSV import state ──
  const [csvModal, setCsvModal] = useState(false);
  const [csvClassId, setCsvClassId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ rollNo: string; name: string }[]>([]);

  // ── Standalone Create Staff modal ──
  const [createStaffModal, setCreateStaffModal] = useState(false);
  const [csName, setCsName] = useState('');
  const [csId, setCsId] = useState('');
  const [csPass, setCsPass] = useState('');
  const [csSubmitting, setCsSubmitting] = useState(false);

  // ── Detail sheet (Classes / Students / Staff chips) ──
  const [detailSheet, setDetailSheet] = useState<'classes' | 'students' | 'staff' | null>(null);

  // ── Staff credentials viewer ──
  const [credModal, setCredModal] = useState(false);
  const [selectedStaffCred, setSelectedStaffCred] = useState<StaffMember | null>(null);
  const [copiedField, setCopiedField] = useState<'id' | 'pass' | null>(null);

  const showStaffCred = (sf: StaffMember) => {
    setSelectedStaffCred(sf);
    setCredModal(true);
    setCopiedField(null);
  };

  const copyToClipboard = async (textToCopy: string, field: 'id' | 'pass') => {
    try {
      if (!textToCopy) return;
      const cleanText = String(textToCopy).trim();
      await Clipboard.setStringAsync(cleanText);
      
      // Visual feedback in UI
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      
      // Confirm with a small alert to verify the app is getting the right data
      Alert.alert('Copied to Clipboard', `Value: ${cleanText}`);
    } catch (error) {
      console.error('Clipboard error:', error);
      Alert.alert('Copy Failed', 'Please try copying again or take a screenshot.');
    }
  };

  // Auto-generate Staff ID + Password from name
  const generateCredentials = (name: string) => {
    if (!name.trim()) { setCsId(''); setCsPass(''); return; }
    // Staff ID: initials + year + random 3-digit number
    const initials = name.trim().split(' ').map(w => w[0]?.toUpperCase() || '').join('');
    const year = new Date().getFullYear().toString().slice(-2);
    const rand3 = String(Math.floor(100 + Math.random() * 900));
    setCsId(`${initials}-${year}-${rand3}`);
    // Password: 8 chars alphanumeric
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const pwd = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setCsPass(pwd);
  };

  const handleCsNameChange = (text: string) => {
    setCsName(text);
    generateCredentials(text);
  };

  // ── Staff creation state (wizard) ──
  const [staffMode, setStaffMode] = useState<'pick' | 'create'>('create');
  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPass, setNewStaffPass] = useState('123456'); // Default password

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
      const subClasses  = dataService.subscribeToTable('classes',            fetchAll);
      const subStudents = dataService.subscribeToTable('students',           fetchAll);
      const subStaff    = dataService.subscribeToTable('managed_staff',      fetchAll);
      const subProfiles = dataService.subscribeToTable('profiles',           fetchAll);
      const subAtt      = dataService.subscribeToTable('attendance_records', fetchAll);

      return () => {
        subClasses?.unsubscribe();
        subStudents?.unsubscribe();
        subStaff?.unsubscribe();
        subProfiles?.unsubscribe();
        subAtt?.unsubscribe();
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
    setStaffMode('create');
    setNewStaffId('');
    setNewStaffName('');
    setNewStaffPass('123456');
  };

  // ── Open CSV import ─────────────────────────────────────────
  const openCsvImport = (classId: string) => {
    setCsvClassId(classId);
    setCsvText('');
    setCsvPreview([]);
    setCsvModal(true);
  };

  // ── Parse CSV preview ───────────────────────────────────────
  const handleCsvChange = (text: string) => {
    setCsvText(text);
    setCsvPreview(parseCSV(text));
  };

  // ── Bulk import CSV students ────────────────────────────────
  const handleCsvImport = async () => {
    if (csvPreview.length === 0) {
      Alert.alert('Empty', 'Paste CSV data in the format: register_number,name'); return;
    }
    setCsvImporting(true);
    let success = 0; let fail = 0;
    for (const row of csvPreview) {
      try {
        const added = await dataService.addStudent({ name: row.name, rollNo: row.rollNo, classId: csvClassId });
        setStudents(p => ({ ...p, [csvClassId]: [added, ...(p[csvClassId] || [])] }));
        success++;
      } catch { fail++; }
    }
    setCsvImporting(false);
    setCsvModal(false);
    Alert.alert('Import Complete', `✅ ${success} students imported${fail > 0 ? `\n⚠️ ${fail} failed (duplicate roll numbers)` : ''}`);
  };

  // ── Standalone Create Staff ──────────────────────────────────
  const handleCreateStaff = async () => {
    if (!csName.trim() || !csId.trim() || !csPass.trim()) {
      Alert.alert('Required', 'All fields are required.'); return;
    }
    setCsSubmitting(true);
    try {
      await dataService.createManagedStaff({
        staff_id: csId.trim(),
        name: csName.trim(),
        password: csPass.trim(),
        department: user?.department || '',
      });
      const sf = await dataService.getStaffMembers();
      setStaffList(sf);
      setCreateStaffModal(false);
      setCsName(''); setCsId(''); setCsPass('123456');
      Alert.alert('Success', `Staff "${csName.trim()}" created with ID: ${csId.trim()}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create staff.');
    } finally { setCsSubmitting(false); }
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

  // ── Step 2 → create/assign staff ─────────────────────────
  const handleStep2 = async () => {
    try {
      setSubmitting(true);
      let staffName = '';
      let staffIdForCls = '';

      if (staffMode === 'create') {
        if (!newStaffId.trim() || !newStaffName.trim() || !newStaffPass.trim()) {
          Alert.alert('Required', 'Please fill all staff fields.');
          return;
        }
        const managed = await dataService.createManagedStaff({
          staff_id: newStaffId.trim(),
          name: newStaffName.trim(),
          password: newStaffPass.trim(),
          department: user?.department || '',
        });
        staffName = managed.name;
        staffIdForCls = managed.staff_id;
      } else {
        if (!selectedStaff) { Alert.alert('Required', 'Please select a staff member.'); return; }
        staffName = selectedStaff.name;
        staffIdForCls = selectedStaff.staffId || ''; // Link via Staff ID if available
      }

      await supabase.from('classes').update({ 
        advisor: staffName,
        advisor_staff_id: staffIdForCls 
      }).eq('id', createdClass!.id);

      setCreatedClass(c => c ? { ...c, advisor: staffName } : c);
      setClasses(p => p.map(c => c.id === createdClass!.id ? { ...c, advisor: staffName } : c));
      
      // Refresh staff list
      const sf = await dataService.getStaffMembers();
      setStaffList(sf);
      
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
      const updateData: any = {
        name: editName.trim(),
        advisor: editAdvisor?.name || editTarget.advisor,
        advisor_staff_id: editAdvisor?.staffId || editTarget.advisor_staff_id || null
      };

      await patchClass(editTarget.id, updateData);

      setClasses(p => p.map(c => c.id === editTarget.id
        ? { 
            ...c, 
            name: updateData.name, 
            advisor: updateData.advisor,
            advisor_staff_id: updateData.advisor_staff_id 
          } : c));
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
        {/* Title row */}
        <View style={s.topBar}>
          <View>
            <Text style={s.headerSub}>ADMINISTRATION</Text>
            <Text style={s.headerTitle}>Class Management</Text>
          </View>
        </View>

        {/* Action buttons row */}
        <View style={s.actionRow}>
          <Pressable
            style={({ pressed }) => [s.actionBtn2, pressed && { opacity: 0.8 }]}
            onPress={() => { setCsName(''); setCsId(''); setCsPass(''); setCreateStaffModal(true); }}
          >
            <LinearGradient colors={['#0F766E', '#0D9488']} style={s.actionBtnGrad}>
              <MaterialIcons name="person-add" size={16} color="#FFF" />
              <Text style={s.actionBtnTxt}>Add Staff</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.actionBtn2, pressed && { opacity: 0.8 }]}
            onPress={() => { resetWizard(); setWizardOpen(true); }}
          >
            <LinearGradient colors={['#1152d4', '#1d4ed8']} style={s.actionBtnGrad}>
              <MaterialIcons name="add-circle-outline" size={16} color="#FFF" />
              <Text style={s.actionBtnTxt}>New Class</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={s.statChipsScroll}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statChips}>
            <Pressable style={s.chip} onPress={() => setDetailSheet('classes')}>
              <MaterialIcons name="class" size={14} color="#818CF8" />
              <Text style={s.chipTxt}>{classes.length} <Text style={s.chipBold}>Classes</Text></Text>
              <MaterialIcons name="chevron-right" size={14} color="rgba(255,255,255,0.4)" />
            </Pressable>
            <Pressable style={s.chip} onPress={() => setDetailSheet('students')}>
              <MaterialIcons name="groups" size={14} color="#34D399" />
              <Text style={s.chipTxt}>
                {Object.values(students).reduce((a, arr) => a + arr.length, 0)} <Text style={s.chipBold}>Students</Text>
              </Text>
              <MaterialIcons name="chevron-right" size={14} color="rgba(255,255,255,0.4)" />
            </Pressable>
            <Pressable style={s.chip} onPress={() => setDetailSheet('staff')}>
              <MaterialIcons name="admin-panel-settings" size={14} color="#FBBF24" />
              <Text style={s.chipTxt}>{staffList.length} <Text style={s.chipBold}>Staff</Text></Text>
              <MaterialIcons name="chevron-right" size={14} color="rgba(255,255,255,0.4)" />
            </Pressable>
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
                              style={[s.clsBadgeFill, { justifyContent: 'center', alignItems: 'center' }]}
                            >
                              <MaterialIcons name="person" size={24} color={pal.color} />
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
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <Pressable onPress={() => openCsvImport(cls.id)} style={[s.addStuBtn, { backgroundColor: '#0F766E' }]}>
                                <MaterialIcons name="upload-file" size={13} color="#FFF" />
                                <Text style={s.addStuTxt}>CSV</Text>
                              </Pressable>
                              <Pressable onPress={() => openAddStu(cls.id)} style={s.addStuBtn}>
                                <MaterialIcons name="person-add" size={13} color="#FFF" />
                                <Text style={s.addStuTxt}>Add</Text>
                              </Pressable>
                            </View>
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
              <ScrollView contentContainerStyle={wiz.content}>
                <Text style={wiz.stepTitle}>Assign Staff Advisor</Text>
                <Text style={wiz.stepSub}>Create a new account or choose an existing staff member</Text>

                {/* Mode Selector */}
                <View style={wiz.modeRow}>
                  <Pressable 
                    onPress={() => setStaffMode('create')}
                    style={[wiz.modeBtn, staffMode === 'create' && wiz.modeBtnActive]}
                  >
                    <MaterialIcons name="person-add" size={18} color={staffMode === 'create' ? '#FFF' : '#64748B'} />
                    <Text style={[wiz.modeBtnTxt, staffMode === 'create' && wiz.modeBtnTxtActive]}>New Account</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => setStaffMode('pick')}
                    style={[wiz.modeBtn, staffMode === 'pick' && wiz.modeBtnActive]}
                  >
                    <MaterialIcons name="people" size={18} color={staffMode === 'pick' ? '#FFF' : '#64748B'} />
                    <Text style={[wiz.modeBtnTxt, staffMode === 'pick' && wiz.modeBtnTxtActive]}>Existing Staff</Text>
                  </Pressable>
                </View>

                {staffMode === 'create' ? (
                  <View style={wiz.createForm}>
                    <Text style={wiz.label}>Staff Full Name</Text>
                    <TextInput style={wiz.input} placeholder="e.g. Dr. Sarah Connor"
                      value={newStaffName} onChangeText={setNewStaffName} placeholderTextColor="#94A3B8" />

                    <Text style={wiz.label}>Login Staff ID (Unique)</Text>
                    <TextInput style={wiz.input} placeholder="e.g. ST-2024-001"
                      value={newStaffId} onChangeText={setNewStaffId} 
                      autoCapitalize="characters" placeholderTextColor="#94A3B8" />

                    <Text style={wiz.label}>Initial Password</Text>
                    <TextInput style={wiz.input} placeholder="Enter password"
                      value={newStaffPass} onChangeText={setNewStaffPass} 
                      secureTextEntry placeholderTextColor="#94A3B8" />
                    
                    <View style={wiz.infoBox}>
                      <MaterialIcons name="vpn-key" size={16} color={colors.primaryBlue} />
                      <Text style={wiz.infoTxt}>
                        This ID and Password will be used by the staff to login to the Staff role.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <>
                    {staffList.length === 0
                      ? (
                        <View style={wiz.noStaff}>
                          <MaterialIcons name="badge" size={48} color="#CBD5E1" />
                          <Text style={wiz.noStaffT}>No staff created yet</Text>
                          <Text style={wiz.noStaffD}>Select &quot;New Account&quot; to create your first staff credits.</Text>
                        </View>
                      )
                      : staffList.map(item => {
                          const selected = selectedStaff?.id === item.id;
                          return (
                            <Pressable
                              key={item.id}
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
                                <Text style={wiz.staffEmail}>{item.staffId || item.email}</Text>
                                <Text style={wiz.staffMeta}>
                                  {item.department} Department
                                </Text>
                              </View>
                              <View style={[wiz.checkCircle, selected && wiz.checkCircleSel]}>
                                {selected && <MaterialIcons name="check" size={14} color="#FFF" />}
                              </View>
                            </Pressable>
                          );
                      })
                    }
                  </>
                )}
              </ScrollView>

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
                        <Text style={wiz.nextBtnTxt}>{staffMode === 'create' ? 'Create & Assign' : 'Assign & Continue'}</Text>
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

                {/* CSV Bulk Import */}
                <Pressable
                  style={wiz.csvImportBtn}
                  onPress={() => openCsvImport(createdClass?.id || '')}
                >
                  <MaterialIcons name="upload-file" size={20} color="#0F766E" />
                  <Text style={wiz.csvImportTxt}>Bulk Import via CSV</Text>
                </Pressable>
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
            {!editingStu && (
              <Pressable
                style={[s.csvAltBtn, { marginTop: 10 }]}
                onPress={() => { setStuModal(false); openCsvImport(stuClassId); }}
              >
                <MaterialIcons name="upload-file" size={16} color="#0F766E" />
                <Text style={s.csvAltTxt}>Import multiple via CSV instead</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CSV IMPORT MODAL ── */}
      <Modal visible={csvModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setCsvModal(false)} />
          <View style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Bulk Import Students</Text>
              <Pressable onPress={() => setCsvModal(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            {/* Format info */}
            <View style={s.csvInfoBox}>
              <MaterialIcons name="info-outline" size={16} color={colors.primaryBlue} />
              <Text style={s.csvInfoTxt}>
                Format: <Text style={{ fontWeight: '700' }}>register_number,name</Text>{`\n`}One student per line. First row can be a header (will be skipped).
              </Text>
            </View>

            <Text style={s.label}>Paste CSV Data</Text>
            <TextInput
              style={[s.input, { height: 130, textAlignVertical: 'top', paddingTop: 12 }]}
              placeholder={`21CS001,Ravi Kumar\n21CS002,Priya Sharma\n21CS003,Arjun Singh`}
              placeholderTextColor="#94A3B8"
              value={csvText}
              onChangeText={handleCsvChange}
              multiline
              autoCapitalize="none"
            />

            {/* Preview */}
            {csvPreview.length > 0 && (
              <View style={s.csvPreviewBox}>
                <Text style={s.csvPreviewTitle}>Preview — {csvPreview.length} students</Text>
                <ScrollView style={{ maxHeight: 140 }}>
                  {csvPreview.slice(0, 8).map((r, i) => (
                    <View key={i} style={s.csvPreviewRow}>
                      <Text style={s.csvPreviewRoll}>{r.rollNo}</Text>
                      <Text style={s.csvPreviewName}>{r.name}</Text>
                    </View>
                  ))}
                  {csvPreview.length > 8 && (
                    <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', paddingVertical: 4 }}>
                      +{csvPreview.length - 8} more...
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}

            <Pressable
              style={[s.submitBtn, (csvImporting || csvPreview.length === 0) && { opacity: 0.5 }]}
              onPress={handleCsvImport}
              disabled={csvImporting || csvPreview.length === 0}
            >
              {csvImporting
                ? <ActivityIndicator color="#FFF" />
                : <Text style={s.submitTxt}>Import {csvPreview.length > 0 ? `${csvPreview.length} Students` : 'Students'}</Text>
              }
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── DETAIL SHEET (Classes / Students / Staff) ── */}
      <Modal visible={detailSheet !== null} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setDetailSheet(null)} />
          <View style={[s.sheet, { maxHeight: '78%', paddingBottom: 32 }]}>

            {/* Header */}
            <View style={s.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: detailSheet === 'classes' ? '#EEF2FF' : detailSheet === 'students' ? '#ECFDF5' : '#FFFBEB',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <MaterialIcons
                    name={detailSheet === 'classes' ? 'class' : detailSheet === 'students' ? 'groups' : 'admin-panel-settings'}
                    size={20}
                    color={detailSheet === 'classes' ? '#6366F1' : detailSheet === 'students' ? '#059669' : '#D97706'}
                  />
                </View>
                <Text style={s.sheetTitle}>
                  {detailSheet === 'classes' ? `All Classes (${classes.length})`
                    : detailSheet === 'students' ? `All Students (${Object.values(students).reduce((a, arr) => a + arr.length, 0)})`
                    : `Staff Members (${staffList.length})`}
                </Text>
              </View>
              <Pressable onPress={() => setDetailSheet(null)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* CLASSES */}
              {detailSheet === 'classes' && (
                classes.length === 0
                  ? <View style={s.detailEmpty}>
                      <MaterialIcons name="class" size={40} color="#E2E8F0" />
                      <Text style={s.detailEmptyTxt}>No classes created yet</Text>
                    </View>
                  : classes.map((cls, i) => {
                      const clsStu = students[cls.id] || [];
                      const pal = ['#EEF2FF','#ECFDF5','#EFF6FF','#FFF7ED','#FFF1F2'];
                      const palC = ['#6366F1','#059669','#3B82F6','#D97706','#E11D48'];
                      return (
                        <View key={cls.id} style={s.detailRow}>
                          <View style={[s.detailIcon, { backgroundColor: pal[i % 5] }]}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: palC[i % 5] }}>{cls.name[0]}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.detailTitle}>{cls.name}</Text>
                            <Text style={s.detailSub}>Year {cls.year} · Sec {cls.section}</Text>
                            <Text style={s.detailSub2}>Advisor: {cls.advisor || 'Unassigned'}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <View style={s.detailBadge}>
                              <MaterialIcons name="person" size={11} color="#6366F1" />
                              <Text style={[s.detailBadgeTxt, { color: '#6366F1' }]}>{clsStu.length}</Text>
                            </View>
                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>students</Text>
                          </View>
                        </View>
                      );
                    })
              )}

              {/* STUDENTS */}
              {detailSheet === 'students' && (
                Object.values(students).flat().length === 0
                  ? <View style={s.detailEmpty}>
                      <MaterialIcons name="groups" size={40} color="#E2E8F0" />
                      <Text style={s.detailEmptyTxt}>No students enrolled yet</Text>
                    </View>
                  : classes.map(cls => {
                      const clsStu = students[cls.id] || [];
                      if (clsStu.length === 0) return null;
                      return (
                        <View key={cls.id}>
                          <Text style={s.detailGroupHeader}>{cls.name} — {clsStu.length} students</Text>
                          {clsStu.map(stu => (
                            <View key={stu.id} style={s.detailRow}>
                              <View style={[s.detailIcon, { backgroundColor: '#EFF6FF' }]}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#3B82F6' }}>{stu.name[0]?.toUpperCase()}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.detailTitle}>{stu.name}</Text>
                                <Text style={s.detailSub}>{stu.rollNo}</Text>
                              </View>
                              <View style={s.detailBadge}>
                                <Text style={[s.detailBadgeTxt, { color: stu.attendanceRate >= 75 ? '#059669' : '#E11D48' }]}>
                                  {stu.attendanceRate ?? 0}%
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })
              )}

              {/* STAFF */}
              {detailSheet === 'staff' && (
                staffList.length === 0
                  ? <View style={s.detailEmpty}>
                      <MaterialIcons name="admin-panel-settings" size={40} color="#E2E8F0" />
                      <Text style={s.detailEmptyTxt}>No staff in this department yet</Text>
                    </View>
                  : staffList.map((sf) => {
                      const assignedClasses = classes.filter(c => c.advisor === sf.name);
                      const isExpanded = selectedStaffCred?.id === sf.id;
                      return (
                        <View key={sf.id}>
                          {/* Staff row */}
                          <Pressable
                            style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.7 }]}
                            onPress={() => {
                              setSelectedStaffCred(isExpanded ? null : sf);
                              setCopiedField(null);
                            }}
                          >
                            <View style={[s.detailIcon, { backgroundColor: '#FFFBEB' }]}>
                              <Text style={{ fontSize: 18, fontWeight: '900', color: '#D97706' }}>{sf.name[0]?.toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.detailTitle}>{sf.name}</Text>
                              <Text style={s.detailSub}>{sf.staffId || sf.email || 'Auth account'}</Text>
                              <Text style={s.detailSub2}>
                                {assignedClasses.length > 0
                                  ? `Assigned: ${assignedClasses.map(c => c.name).join(', ')}`
                                  : 'No class assigned'}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <View style={[s.detailBadge, { backgroundColor: assignedClasses.length > 0 ? '#ECFDF5' : '#F1F5F9' }]}>
                                <MaterialIcons name="class" size={11} color={assignedClasses.length > 0 ? '#059669' : '#94A3B8'} />
                                <Text style={[s.detailBadgeTxt, { color: assignedClasses.length > 0 ? '#059669' : '#94A3B8' }]}>
                                  {assignedClasses.length}
                                </Text>
                              </View>
                              <MaterialIcons
                                name={isExpanded ? 'expand-less' : 'vpn-key'}
                                size={16}
                                color={sf.staffId ? '#D97706' : '#CBD5E1'}
                              />
                            </View>
                          </Pressable>

                          {/* Inline credentials expand */}
                          {isExpanded && (
                            <View style={s.credInlineBox}>
                              {sf.staffId ? (
                                <>
                                  <Text style={s.credInlineLabel}>STAFF ID</Text>
                                  <Pressable
                                    style={s.credCopyField}
                                    onPress={() => copyToClipboard(sf.staffId!, 'id')}
                                  >
                                    <Text style={s.credCopyValue}>{sf.staffId}</Text>
                                    <View style={[s.credCopyBtn, copiedField === 'id' && s.credCopyBtnDone]}>
                                      <MaterialIcons
                                        name={copiedField === 'id' ? 'check' : 'content-copy'}
                                        size={15} color={copiedField === 'id' ? '#059669' : '#475569'}
                                      />
                                      <Text style={[s.credCopyBtnTxt, copiedField === 'id' && { color: '#059669' }]}>
                                        {copiedField === 'id' ? 'Copied!' : 'Copy'}
                                      </Text>
                                    </View>
                                  </Pressable>

                                  {sf.password ? (
                                    <>
                                      <Text style={[s.credInlineLabel, { marginTop: 10 }]}>PASSWORD</Text>
                                      <Pressable
                                        style={s.credCopyField}
                                        onPress={() => copyToClipboard(sf.password!, 'pass')}
                                      >
                                        <Text style={s.credCopyValue}>{sf.password}</Text>
                                        <View style={[s.credCopyBtn, copiedField === 'pass' && s.credCopyBtnDone]}>
                                          <MaterialIcons
                                            name={copiedField === 'pass' ? 'check' : 'content-copy'}
                                            size={15} color={copiedField === 'pass' ? '#059669' : '#475569'}
                                          />
                                          <Text style={[s.credCopyBtnTxt, copiedField === 'pass' && { color: '#059669' }]}>
                                            {copiedField === 'pass' ? 'Copied!' : 'Copy'}
                                          </Text>
                                        </View>
                                      </Pressable>
                                    </>
                                  ) : (
                                    <Text style={s.credInlineNoPass}>Password not stored (legacy account)</Text>
                                  )}
                                </>
                              ) : (
                                <Text style={s.credInlineNoPass}>Email/password account — no managed credentials</Text>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })
              )}

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CREATE STAFF MODAL ── */}
      <Modal visible={createStaffModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={s.overlayBg} onPress={() => setCreateStaffModal(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Create Staff Account</Text>
              <Pressable onPress={() => setCreateStaffModal(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <View style={s.csvInfoBox}>
              <MaterialIcons name="vpn-key" size={16} color="#0F766E" />
              <Text style={s.csvInfoTxt}>
                Department: <Text style={{ fontWeight: '700' }}>{user?.department}</Text>. Staff will login using Staff ID + Password.
              </Text>
            </View>

            <Text style={s.label}>Full Name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Dr. Sarah Connor"
              value={csName}
              onChangeText={handleCsNameChange}
              placeholderTextColor="#94A3B8"
            />

            {/* Auto-generated credentials */}
            {csId !== '' && (
              <>
                <View style={s.genRow}>
                  <Text style={s.label}>Staff ID</Text>
                  <Pressable onPress={() => generateCredentials(csName)} style={s.regenBtn}>
                    <MaterialIcons name="refresh" size={14} color="#0F766E" />
                    <Text style={s.regenTxt}>Regenerate</Text>
                  </Pressable>
                </View>
                <View style={s.genField}>
                  <MaterialIcons name="badge" size={18} color="#0F766E" />
                  <Text style={s.genValue}>{csId}</Text>
                </View>

                <Text style={[s.label, { marginTop: 12 }]}>Password</Text>
                <View style={s.genField}>
                  <MaterialIcons name="vpn-key" size={18} color="#0F766E" />
                  <Text style={s.genValue}>{csPass}</Text>
                </View>

                <View style={s.credHintBox}>
                  <MaterialIcons name="info-outline" size={14} color="#92400E" />
                  <Text style={s.credHintTxt}>Screenshot or note these credentials — share them with the staff member.</Text>
                </View>
              </>
            )}

            <Pressable
              style={[s.submitBtn, { backgroundColor: '#0F766E', marginTop: 16 }, (csSubmitting || !csId) && { opacity: 0.5 }]}
              onPress={handleCreateStaff}
              disabled={csSubmitting || !csId}
            >
              {csSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitTxt}>Create Staff Account</Text>}
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
  // Action buttons row (below title)
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: 4,
  },
  actionBtn2: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  actionBtnTxt: { color: '#FFF', fontWeight: '800', fontSize: 13 },
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
  // CSV styles
  csvAltBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  csvAltTxt: { fontSize: 13, color: '#0F766E', fontWeight: '600' },
  csvInfoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12,
    marginBottom: spacing.md, borderWidth: 1, borderColor: '#BBF7D0',
  },
  csvInfoTxt: { flex: 1, fontSize: 12, color: '#166534', lineHeight: 17 },
  csvPreviewBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12,
    marginBottom: spacing.md, borderWidth: 1, borderColor: '#E2E8F0',
  },
  csvPreviewTitle: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase' },
  csvPreviewRow: { flexDirection: 'row', gap: 10, paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  csvPreviewRoll: { fontSize: 12, fontWeight: '700', color: colors.primaryBlue, minWidth: 90 },
  csvPreviewName: { fontSize: 12, color: '#0F172A', flex: 1 },
  // Auto-generated credential styles
  genRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  regenBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  regenTxt: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  genField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#BBF7D0', marginBottom: 4,
  },
  genValue: { fontSize: 16, fontWeight: '800', color: '#065F46', letterSpacing: 0.5, flex: 1 },
  credHintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FDE68A', marginTop: 10,
  },
  credHintTxt: { fontSize: 12, color: '#92400E', flex: 1, lineHeight: 17 },
  // Detail sheet styles
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  detailIcon: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  detailSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  detailSub2: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  detailBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  detailBadgeTxt: { fontSize: 12, fontWeight: '800' },
  detailGroupHeader: {
    fontSize: 11, fontWeight: '700', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingVertical: 10, paddingTop: 18,
  },
  detailEmpty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  detailEmptyTxt: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  // Credential copy field
  credCopyField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0FDF4', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#BBF7D0',
    paddingLeft: 16, paddingRight: 10, paddingVertical: 14,
    gap: 10, marginBottom: 4,
  },
  credCopyValue: {
    flex: 1, fontSize: 18, fontWeight: '800',
    color: '#065F46', letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  credCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  credCopyBtnDone: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  credCopyBtnTxt: { fontSize: 12, fontWeight: '700', color: '#475569' },
  // Inline credential expand block
  credInlineBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14, padding: 14,
    marginBottom: 8, marginTop: 2,
    borderWidth: 1.5, borderColor: '#BBF7D0',
  },
  credInlineLabel: {
    fontSize: 10, fontWeight: '800', color: '#059669',
    letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase',
  },
  credInlineNoPass: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
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
  // Mode switch
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 46, borderRadius: 12, backgroundColor: '#FFF',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  modeBtnActive: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
  modeBtnTxt: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  modeBtnTxtActive: { color: '#FFF' },
  createForm: { gap: 4 },
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
  csvImportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#0F766E',
    borderStyle: 'dashed',
  },
  csvImportTxt: { fontSize: 14, fontWeight: '700', color: '#0F766E' },
});
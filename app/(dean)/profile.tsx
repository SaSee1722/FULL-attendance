import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Image, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { supabase } from '../../lib/supabase';
import { colors, spacing, shadows, borderRadius } from '../../constants/theme';
import { useRouter } from 'expo-router';

export default function DeanProfile() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(user?.profileImage || null);
  const [bio, setBio] = useState('');
  const [editBioModal, setEditBioModal] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [stats, setStats] = useState({ classes: 0, students: 0, staff: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    setImageUri(user?.profileImage || null);
    loadBio();
    loadStats();
  }, [user]);

  const loadBio = async () => {
    try {
      const { data } = await supabase.from('profiles').select('bio').eq('id', user?.id || '').maybeSingle();
      if (data?.bio) setBio(data.bio);
    } catch {}
  };

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const { dataService } = await import('../../services/dataService');
      const st = await dataService.getStatistics();
      setStats({ classes: st.totalClasses, students: st.totalStudents, staff: st.totalStaff });
    } catch {} finally { setLoadingStats(false); }
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        const uri = result.assets[0].uri;
        await authService.updateProfileImage(uri);
        setImageUri(uri);
        if (refreshUser) await refreshUser();
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update image.');
    } finally { setUploadingImage(false); }
  };

  const saveBio = async () => {
    try {
      setSavingBio(true);
      const trimmed = bioInput.trim();
      try {
        await supabase.from('profiles').update({ bio: trimmed }).eq('id', user?.id || '');
      } catch {}
      setBio(trimmed);
      setEditBioModal(false);
    } finally { setSavingBio(false); }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { await logout(); router.replace('/auth/login'); },
      },
    ]);
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : '??';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Profile Card ── */}
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.profileCard}>
          {/* Avatar */}
          <Pressable onPress={pickImage} style={styles.avatarWrap} disabled={uploadingImage}>
            {uploadingImage
              ? <View style={styles.avatar}><ActivityIndicator color="#FFF" /></View>
              : imageUri
                ? <Image source={{ uri: imageUri }} style={styles.avatar} />
                : <View style={styles.avatar}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
            }
            <View style={styles.cameraBtn}>
              <MaterialIcons name="photo-camera" size={14} color="#FFF" />
            </View>
          </Pressable>

          {/* Name & Role */}
          <Text style={styles.profileName}>{user?.name || '—'}</Text>
          <View style={styles.roleBadge}>
            <MaterialIcons name="verified" size={14} color="#FBBF24" />
            <Text style={styles.roleText}>Dean of {user?.department || 'Department'}</Text>
          </View>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>

          {/* Quick stats */}
          <View style={styles.profileStats}>
            {[
              { label: 'Classes', value: stats.classes },
              { label: 'Students', value: stats.students },
              { label: 'Staff', value: stats.staff },
            ].map((s, i) => (
              <View key={s.label} style={[styles.pStat, i < 2 && styles.pStatBorder]}>
                <Text style={styles.pStatVal}>{loadingStats ? '—' : s.value}</Text>
                <Text style={styles.pStatLbl}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ── Bio Section ── */}
        <View style={[styles.section, shadows.sm]}>
          <View style={styles.secHeader}>
            <View style={styles.secTitleRow}>
              <MaterialIcons name="person" size={18} color={colors.primaryBlue} />
              <Text style={styles.secTitle}>About Me</Text>
            </View>
            <Pressable onPress={() => { setBioInput(bio); setEditBioModal(true); }}
              style={styles.editBtn}>
              <MaterialIcons name="edit" size={16} color={colors.primaryBlue} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <Text style={styles.bioText}>
            {bio || 'No bio added yet. Tap Edit to write something about yourself.'}
          </Text>
        </View>

        {/* ── Account Details ── */}
        <View style={[styles.section, shadows.sm]}>
          <View style={styles.secHeader}>
            <View style={styles.secTitleRow}>
              <MaterialIcons name="info" size={18} color={colors.primaryBlue} />
              <Text style={styles.secTitle}>Account Details</Text>
            </View>
          </View>
          {[
            { icon: 'person', label: 'Full Name', value: user?.name || '—' },
            { icon: 'email', label: 'Email Address', value: user?.email || '—' },
            { icon: 'school', label: 'Department', value: user?.department || '—' },
            { icon: 'badge', label: 'Role', value: 'Dean' },
          ].map((row, i, arr) => (
            <View key={row.label} style={[styles.detailRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.detailIcon}>
                <MaterialIcons name={row.icon as any} size={18} color="#64748B" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={styles.detailValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Settings ── */}
        <View style={[styles.section, shadows.sm]}>
          <View style={styles.secHeader}>
            <View style={styles.secTitleRow}>
              <MaterialIcons name="settings" size={18} color={colors.primaryBlue} />
              <Text style={styles.secTitle}>Settings</Text>
            </View>
          </View>
          {[
            { icon: 'notifications', label: 'Notifications', sub: 'Attendance alerts & reminders' },
            { icon: 'lock', label: 'Privacy & Security', sub: 'Password and account security' },
            { icon: 'help', label: 'Help & Support', sub: 'Contact support team' },
          ].map((item, i, arr) => (
            <Pressable key={item.label}
              style={[styles.settingRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.settingIcon, { backgroundColor: `${colors.primaryBlue}10` }]}>
                <MaterialIcons name={item.icon as any} size={20} color={colors.primaryBlue} />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text style={styles.settingSub}>{item.sub}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#CBD5E1" />
            </Pressable>
          ))}
        </View>

        {/* ── Logout ── */}
        <Pressable onPress={handleLogout} style={[styles.logoutBtn, shadows.sm]}>
          <MaterialIcons name="logout" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.version}>Attendance Management System v1.0.0</Text>
      </ScrollView>

      {/* ── Edit Bio Modal ── */}
      <Modal visible={editBioModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <Pressable style={styles.modalBg} onPress={() => setEditBioModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Bio</Text>
              <Pressable onPress={() => setEditBioModal(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <TextInput
              style={styles.bioInput}
              value={bioInput}
              onChangeText={setBioInput}
              placeholder="Write something about yourself…"
              placeholderTextColor="#94A3B8"
              multiline numberOfLines={5}
              textAlignVertical="top"
            />
            <Pressable onPress={saveBio} style={[styles.saveBtn, savingBio && { opacity: 0.6 }]} disabled={savingBio}>
              {savingBio
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.saveBtnText}>Save Bio</Text>
              }
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  body: { paddingBottom: 160 },
  // Profile Card
  profileCard: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xl,
    marginBottom: spacing.md,
  },
  avatarWrap: { marginBottom: spacing.md, position: 'relative' },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${colors.primaryBlue}30`,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarInitials: { fontSize: 32, fontWeight: 'bold', color: '#FFF' },
  cameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primaryBlue,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0F172A',
  },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 6 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(251,191,36,0.15)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginBottom: 8,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: '#FBBF24' },
  profileEmail: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: spacing.xl },
  profileStats: {
    flexDirection: 'row', width: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, padding: spacing.md,
  },
  pStat: { flex: 1, alignItems: 'center' },
  pStatBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  pStatVal: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  pStatLbl: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  // Sections
  section: {
    backgroundColor: '#FFF', borderRadius: borderRadius.xl,
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    overflow: 'hidden',
  },
  secHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${colors.primaryBlue}10`,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  editBtnText: { fontSize: 12, fontWeight: 'bold', color: colors.primaryBlue },
  bioText: { fontSize: 14, color: '#475569', lineHeight: 22, padding: spacing.md },
  // Details
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC', gap: spacing.md,
  },
  detailIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center',
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  // Settings
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC', gap: spacing.md,
  },
  settingIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  settingSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: '#FFF', marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl, marginBottom: spacing.md,
    height: 56, borderWidth: 1, borderColor: '#FEE2E2',
  },
  logoutText: { fontSize: 16, fontWeight: 'bold', color: '#EF4444' },
  version: { fontSize: 11, color: '#CBD5E1', textAlign: 'center', marginBottom: spacing.md },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.xl, paddingBottom: 48,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  bioInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 14, padding: spacing.md, fontSize: 15,
    color: '#0F172A', height: 130, marginBottom: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primaryBlue, height: 52,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});

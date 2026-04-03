import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Image, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { 
  User, Mail, School, BadgeCheck,
  LogOut, Camera, Edit3,
  Info, IdCard
} from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { supabase } from '../../lib/supabase';
import { colors, spacing, shadows, gradients } from '../../constants/theme';
import { useRouter } from 'expo-router';

export default function StaffProfile() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(user?.profileImage || null);
  const [bio, setBio] = useState('');
  const [editBioModal, setEditBioModal] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [stats, setStats] = useState({ classes: 0, students: 0, attendance: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const loadBio = useCallback(async () => {
    try {
      const { data } = await supabase.from('profiles').select('bio').eq('id', user?.id || '').maybeSingle();
      if (data?.bio) setBio(data.bio);
    } catch {}
  }, [user?.id]);

  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const { dataService } = await import('../../services/dataService');
      const cls = await dataService.getClasses();
      const totalStudents = cls.reduce((acc, c) => acc + (c.studentCount || 0), 0);
      const avgRate = cls.length > 0 
        ? Math.round(cls.reduce((acc, c) => acc + (c.attendanceRate || 0), 0) / cls.length)
        : 0;
      setStats({ classes: cls.length, students: totalStudents, attendance: avgRate });
    } catch {} finally { setLoadingStats(false); }
  }, []);

  useEffect(() => {
    setImageUri(user?.profileImage || null);
    loadBio();
    loadStats();
  }, [user, loadBio, loadStats]);

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
      await supabase.from('profiles').update({ bio: trimmed }).eq('id', user?.id || '');
      setBio(trimmed);
      setEditBioModal(false);
    } catch {
      Alert.alert('Error', 'Failed to save bio');
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

  const staffId = user?.id ? `#MS-${user.id.slice(-5).toUpperCase()}` : '#MS-XXXXX';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ── Profile Header ── */}
        <LinearGradient colors={gradients.premium as any} style={[styles.profileHeader, { paddingTop: insets.top + 20 }]}>
          <Animated.View entering={FadeInUp.delay(100).duration(800)} style={styles.avatarGroup}>
            <Pressable onPress={pickImage} style={[styles.avatarContainer, shadows.premium]} disabled={uploadingImage}>
              {uploadingImage
                ? <View style={styles.avatarMain}><ActivityIndicator color="#FFF" /></View>
                : imageUri
                  ? <Image source={{ uri: imageUri }} style={styles.avatarMain} />
                  : <View style={styles.avatarMain}>
                      <Text style={styles.avatarLetters}>{initials}</Text>
                    </View>
              }
              <View style={styles.cameraPill}>
                <Camera size={14} color="#FFF" />
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.profileMeta}>
            <Text style={styles.userName}>{user?.name || 'Staff Member'}</Text>
            <View style={styles.proBadge}>
              <BadgeCheck size={14} color="#34D399" />
              <Text style={styles.proBadgeText}>Senior Faculty</Text>
            </View>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
          </Animated.View>
        </LinearGradient>

        {/* ── Integrated Stats Bar ── */}
        <Animated.View entering={FadeInUp.delay(400).duration(800)} style={[styles.statsPanel, shadows.premium]}>
          {[
            { label: 'Classes', value: stats.classes, icon: School, color: '#818CF8' },
            { label: 'Students', value: stats.students, icon: User, color: '#34D399' },
            { label: 'Avg Att.', value: `${stats.attendance}%`, icon: BadgeCheck, color: '#F59E0B' },
          ].map((s, i) => (
            <View key={s.label} style={[styles.statCell, i < 2 && styles.statDivider]}>
              <View style={[styles.statIconCircle, { backgroundColor: `${s.color}15` }]}>
                <s.icon size={16} color={s.color} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.statNumber}>{loadingStats ? '—' : s.value}</Text>
                <Text style={styles.statDescription}>{s.label}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* ── Bio Section ── */}
        <Animated.View entering={FadeInDown.delay(500).duration(800)} style={[styles.section, shadows.sm, { marginTop: 15 }]}>
          <View style={styles.secHeader}>
            <View style={styles.secTitleRow}>
              <Info size={18} color={colors.primaryBlue} />
              <Text style={styles.secTitle}>About Me</Text>
            </View>
            <Pressable onPress={() => { setBioInput(bio); setEditBioModal(true); }}
              style={styles.editBtn}>
              <Edit3 size={14} color={colors.primaryBlue} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <Text style={styles.bioText}>
            {bio || 'No bio added yet. Write something about your teaching philosophy or role.'}
          </Text>
        </Animated.View>

        {/* ── Account Details ── */}
        <Animated.View entering={FadeInDown.delay(600).duration(800)} style={[styles.section, shadows.sm]}>
          <View style={styles.secHeader}>
            <View style={styles.secTitleRow}>
              <User size={18} color={colors.primaryBlue} />
              <Text style={styles.secTitle}>Faculty Details</Text>
            </View>
          </View>
          {[
            { icon: IdCard, label: 'Staff ID', value: staffId },
            { icon: User, label: 'Full Name', value: user?.name || '—' },
            { icon: Mail, label: 'Email Address', value: user?.email || '—' },
            { icon: School, label: 'Department', value: user?.department || '—' },
          ].map((row, i, arr) => (
            <View key={row.label} style={[styles.detailRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.detailIcon}>
                <row.icon size={18} color="#64748B" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={styles.detailValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* ── Logout ── */}
        <Animated.View entering={FadeInDown.delay(800).duration(800)}>
          <Pressable onPress={handleLogout} style={[styles.logoutBtn, shadows.sm]}>
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutTxt}>Sign Out</Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.version}>VERSION 4.2.0 • ACADEMIC PORTAL</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Bio Modal */}
      <Modal visible={editBioModal} animationType="fade" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.overlayBg} onPress={() => setEditBioModal(false)} />
          <View style={[styles.modalContent, shadows.premium]}>
            <Text style={styles.modalTitle}>Edit About Me</Text>
            <TextInput
              style={styles.bioInput}
              multiline
              numberOfLines={4}
              placeholder="Tell us about yourself..."
              value={bioInput}
              onChangeText={setBioInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditBioModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveBio} style={styles.saveBtn} disabled={savingBio}>
                {savingBio ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveTxt}>Save Changes</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { paddingBottom: 40 },
  profileHeader: {
    paddingBottom: 80,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  avatarGroup: { marginBottom: spacing.md },
  avatarContainer: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', padding: 4,
  },
  avatarMain: {
    width: '100%', height: '100%', borderRadius: 52,
    backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#FFF',
  },
  avatarLetters: { fontSize: 36, fontWeight: '900', color: '#FFF' },
  cameraPill: {
    position: 'absolute', bottom: 4, right: 4,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primaryBlue, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#FFF',
  },
  profileMeta: { alignItems: 'center', gap: 6 },
  userName: { fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  proBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },
  proBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  
  statsPanel: {
    flexDirection: 'row', backgroundColor: '#FFF',
    marginHorizontal: spacing.xl, borderRadius: 24,
    padding: 20, marginTop: -45,
    justifyContent: 'space-between', alignItems: 'center',
  },
  statCell: { flex: 1, alignItems: 'center', gap: 8 },
  statIconCircle: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  statDescription: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase' },
  statDivider: { borderRightWidth: 1, borderRightColor: '#F1F5F9' },

  section: {
    backgroundColor: '#FFF', marginHorizontal: spacing.lg,
    borderRadius: 24, padding: 20, marginBottom: 15,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: colors.primaryBlue },
  bioText: { fontSize: 14, color: '#475569', lineHeight: 22 },

  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  detailValue: { fontSize: 14, color: '#1E293B', fontWeight: '600' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#FFF', marginHorizontal: spacing.lg,
    paddingVertical: 18, borderRadius: 24, marginTop: 10,
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  logoutTxt: { fontSize: 16, fontWeight: '800', color: '#EF4444' },
  version: { textAlign: 'center', marginTop: 24, fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 1 },

  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 28, padding: 24, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  bioInput: {
    backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16,
    fontSize: 15, color: '#1E293B', height: 120, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  saveBtn: { flex: 2, height: 50, borderRadius: 16, backgroundColor: colors.primaryBlue, justifyContent: 'center', alignItems: 'center' },
  cancelTxt: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  saveTxt: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});

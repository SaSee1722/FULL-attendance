import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Image, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  TouchableOpacity
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { 
  User, Mail, School, BadgeCheck, 
  LogOut, Camera, Edit3, 
  Shield, Info
} from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { supabase } from '../../lib/supabase';
import { colors, spacing, shadows, gradients } from '../../constants/theme';
import { useRouter } from 'expo-router';
import { dataService } from '../../services/dataService';

export default function AdminProfile() {
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
      const st = await dataService.getStatistics();
      setStats({ classes: st.totalClasses, students: st.totalStudents, staff: st.totalStaff });
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
        const uploadedUrl = await authService.updateProfileImage(uri);
        setImageUri(uploadedUrl || uri);
        if (refreshUser) await refreshUser();
        
        // Clear caches to force refresh of profile images everywhere
        dataService.clearCache();
        Alert.alert('Success', 'Profile image updated successfully');
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
    } catch (e) {
      Alert.alert('Error', 'Failed to save bio.');
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
    : 'AD';

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
            <Text style={styles.userName}>{user?.name || 'System Admin'}</Text>
            <View style={styles.proBadge}>
              <Shield size={14} color="#34D399" />
              <Text style={styles.proBadgeText}>Super Admin Privilege</Text>
            </View>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
          </Animated.View>
        </LinearGradient>

        {/* ── Stats Panel ── */}
        <Animated.View entering={FadeInUp.delay(400).duration(800)} style={[styles.statsPanel, shadows.premium]}>
          {[
            { label: 'Global Classes', value: stats.classes, icon: School, color: '#818CF8' },
            { label: 'Total Students', value: stats.students, icon: User, color: '#34D399' },
            { label: 'Staff Directory', value: stats.staff, icon: BadgeCheck, color: '#F59E0B' },
          ].map((s, i) => (
            <View key={s.label} style={[styles.statCell, i < 2 && styles.statDivider]}>
              <View style={[styles.statIconCircle, { backgroundColor: `${s.color}15` }]}>
                <s.icon size={16} color={s.color} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.statNumber}>{loadingStats ? '—' : s.value}</Text>
                <Text style={styles.statDescription}>{s.label.split(' ')[1] || s.label}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* ── Bio Section ── */}
        <Animated.View entering={FadeInDown.delay(500).duration(800)} style={[styles.section, shadows.sm]}>
          <View style={styles.secHeader}>
            <View style={styles.secTitleRow}>
              <Info size={18} color={colors.admin} />
              <Text style={styles.secTitle}>Designation Bio</Text>
            </View>
            <Pressable onPress={() => { setBioInput(bio); setEditBioModal(true); }} style={styles.editBtn}>
              <Edit3 size={14} color={colors.admin} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <Text style={styles.bioText}>
            {bio || 'Define your roles and responsibilities as the institutional administrator here.'}
          </Text>
        </Animated.View>

        {/* ── Account Details ── */}
        <Animated.View entering={FadeInDown.delay(700).duration(800)} style={[styles.section, shadows.sm]}>
          <View style={styles.secHeader}>
            <View style={styles.secTitleRow}>
              <User size={18} color={colors.admin} />
              <Text style={styles.secTitle}>Identity Metrics</Text>
            </View>
          </View>
          {[
            { icon: User, label: 'Admin Identity', value: user?.name || '—' },
            { icon: Mail, label: 'System Endpoint', value: user?.email || '—' },
            { icon: BadgeCheck, label: 'Authority Tier', value: 'Global Administrator' },
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

        <Animated.View entering={FadeInDown.delay(800).duration(800)}>
          <Pressable onPress={handleLogout} style={[styles.logoutBtnFull, shadows.sm]}>
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutTextMain}>Terminate Session</Text>
          </Pressable>
          <Text style={styles.versionNotice}>VERSION 2.4.1 (STABLE BUILD)</Text>
        </Animated.View>

      </ScrollView>

      {/* ── Edit Bio Modal ── */}
      <Modal visible={editBioModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <Pressable style={styles.modalBg} onPress={() => setEditBioModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Bio</Text>
              <Pressable onPress={() => setEditBioModal(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <TextInput
              style={styles.bioInput}
              value={bioInput}
              onChangeText={setBioInput}
              placeholder="System Administrator responsibilities..."
              placeholderTextColor="#94A3B8"
              multiline numberOfLines={5}
              textAlignVertical="top"
            />
            <Pressable onPress={saveBio} style={[styles.saveBtn, savingBio && { opacity: 0.6 }]} disabled={savingBio}>
              {savingBio ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Update Bio</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { paddingBottom: 160 },
  profileHeader: {
    paddingBottom: 80,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  avatarGroup: { marginBottom: spacing.md },
  avatarContainer: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  avatarMain: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarLetters: { fontSize: 32, fontWeight: '900', color: '#FFF' },
  cameraPill: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.admin,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileMeta: { alignItems: 'center', gap: 6 },
  userName: { fontSize: 24, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  proBadgeText: { fontSize: 13, fontWeight: '800', color: '#34D399' },
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },

  // Stats Panel
  statsPanel: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: spacing.lg,
    marginTop: -35,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statCell: { flex: 1, alignItems: 'center', gap: 10 },
  statDivider: { borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  statIconCircle: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  statDescription: { fontSize: 10, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },

  // Sections
  section: {
    backgroundColor: '#FFF', borderRadius: 28,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  secHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
  },
  editBtnText: { fontSize: 13, fontWeight: '800', color: colors.admin },
  bioText: { fontSize: 14, color: '#475569', lineHeight: 22, padding: spacing.lg, fontWeight: '500' },
  

  // Detail Row
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, marginHorizontal: 12, borderRadius: 20,
    marginBottom: 8, backgroundColor: '#F8FAFC',
  },
  detailIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { fontSize: 14, color: '#1E293B', fontWeight: '800' },

  logoutBtnFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#FFF1F2', marginHorizontal: spacing.lg, marginTop: spacing.xl,
    padding: 18, borderRadius: 24, borderWidth: 1, borderColor: '#FECDD3',
  },
  logoutTextMain: { fontSize: 16, fontWeight: '900', color: '#EF4444' },
  versionNotice: { textAlign: 'center', color: '#CBD5E1', fontSize: 10, fontWeight: '900', marginTop: spacing.lg, letterSpacing: 1 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  bioInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontSize: 15, color: '#0F172A', height: 140, marginBottom: 20, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: colors.admin, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
});

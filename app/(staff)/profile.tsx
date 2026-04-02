import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function StaffProfile() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'S';

  const staffId = user?.id ? `#MS-${user.id.slice(-5).toUpperCase()}` : '#MS-XXXXX';

  const menuItems = [
    {
      group: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit Profile', badge: null, color: '#4F46E5' },
        { icon: 'notifications-outline', label: 'Notifications', badge: 'ON', color: '#059669' },
        { icon: 'shield-outline', label: 'Privacy & Security', badge: null, color: '#7C3AED' },
      ],
    },
    {
      group: 'Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help & Support', badge: null, color: '#D97706' },
        { icon: 'information-circle-outline', label: 'About App', badge: 'v4.2', color: '#64748B' },
      ],
    },
  ];

  return (
    <View style={p.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ── HERO HEADER ── */}
        <LinearGradient
          colors={['#1E1B4B', '#312E81', '#1E293B']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[p.hero, { paddingTop: insets.top + 16 }]}
        >
          <View style={p.heroBlob} />

          {/* Top bar */}
          <View style={p.heroTopBar}>
            <View style={p.brandRow}>
              <View style={p.brandIcon}>
                <MaterialIcons name="school" size={18} color="#FFF" />
              </View>
              <Text style={p.brandName}>Midnight Scholar</Text>
            </View>
            <Pressable style={p.bellBtn}>
              <Ionicons name="notifications-outline" size={22} color="#FFF" />
            </Pressable>
          </View>

          {/* Avatar section */}
          <View style={p.avatarSection}>
            {/* Avatar with gradient ring + edit button anchored to corner */}
            <View style={p.avatarWrapper}>
              <View style={p.avatarRing}>
                <LinearGradient
                  colors={['#818CF8', '#4F46E5', '#7C3AED']}
                  style={p.avatarGrad}
                >
                  <Text style={p.avatarText}>{initials}</Text>
                </LinearGradient>
              </View>
              <Pressable style={p.editDot}>
                <MaterialIcons name="edit" size={11} color="#FFF" />
              </Pressable>
            </View>

            <Text style={p.userName}>{user?.name || 'Staff Member'}</Text>

            <View style={p.rolePill}>
              <View style={p.roleDot} />
              <Text style={p.roleTxt}>SENIOR FACULTY</Text>
            </View>
          </View>

          {/* Stats strip */}
          <View style={p.statsStrip}>
            <View style={p.statItem}>
              <Text style={p.statVal}>{user?.department || '—'}</Text>
              <Text style={p.statLbl}>DEPARTMENT</Text>
            </View>
            <View style={p.statDiv} />
            <View style={p.statItem}>
              <Text style={p.statVal}>{staffId}</Text>
              <Text style={p.statLbl}>STAFF ID</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── INFO CARDS ── */}
        <View style={p.infoGroup}>
          <InfoCard
            icon="email"
            iconColor="#4F46E5"
            iconBg="#EEF2FF"
            label="WORK EMAIL"
            value={user?.email || '—'}
          />
          <InfoCard
            icon="badge"
            iconColor="#059669"
            iconBg="#ECFDF5"
            label="ROLE"
            value={`Staff · ${user?.department || 'Faculty'}`}
          />
          <InfoCard
            icon="location-on"
            iconColor="#D97706"
            iconBg="#FFFBEB"
            label="DEPARTMENT"
            value={user?.department || '—'}
          />
        </View>

        {/* ── MENU GROUPS ── */}
        {menuItems.map((group) => (
          <View key={group.group} style={p.menuGroup}>
            <Text style={p.menuGroupLabel}>{group.group.toUpperCase()}</Text>
            <View style={p.menuCard}>
              {group.items.map((item, i) => (
                <React.Fragment key={item.label}>
                  {i > 0 && <View style={p.menuDivider} />}
                  <Pressable
                    style={({ pressed }) => [p.menuRow, pressed && { backgroundColor: '#FAFBFF' }]}
                  >
                    <View style={[p.menuIcon, { backgroundColor: `${item.color}12` }]}>
                      <Ionicons name={item.icon as any} size={19} color={item.color} />
                    </View>
                    <Text style={p.menuLabel}>{item.label}</Text>
                    <View style={{ flex: 1 }} />
                    {item.badge && (
                      <View style={[p.menuBadge, {
                        backgroundColor: item.badge === 'ON' ? '#ECFDF5' : '#F1F5F9',
                      }]}>
                        <Text style={[p.menuBadgeTxt, {
                          color: item.badge === 'ON' ? '#059669' : '#64748B',
                        }]}>{item.badge}</Text>
                      </View>
                    )}
                    <MaterialIcons name="chevron-right" size={20} color="#E2E8F0" style={{ marginLeft: 8 }} />
                  </Pressable>
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* ── LOGOUT ── */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Pressable
            style={({ pressed }) => [p.logoutBtn, pressed && { opacity: 0.9 }]}
            onPress={handleLogout}
          >
            <View style={p.logoutIconWrap}>
              <MaterialIcons name="logout" size={20} color="#EF4444" />
            </View>
            <Text style={p.logoutTxt}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Version */}
        <Text style={p.version}>MIDNIGHT SCHOLAR V4.2.0-ALPHA</Text>
      </ScrollView>
    </View>
  );
}

function InfoCard({
  icon, iconColor, iconBg, label, value,
}: { icon: string; iconColor: string; iconBg: string; label: string; value: string }) {
  return (
    <View style={ic.card}>
      <View style={[ic.icon, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={ic.content}>
        <Text style={ic.label}>{label}</Text>
        <Text style={ic.value}>{value}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={18} color="#E2E8F0" />
    </View>
  );
}
const ic = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF', borderRadius: 16,
    padding: 14, marginBottom: 8,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  icon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  label: { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8, marginBottom: 3 },
  value: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
});

const p = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FF' },

  // Hero
  hero: { paddingBottom: 24, paddingHorizontal: 20, overflow: 'hidden' },
  heroBlob: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(99,102,241,0.12)', top: -60, right: -60,
  },
  heroTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  brandName: { fontSize: 15, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  bellBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },

  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarRing: {
    width: 96, height: 96, borderRadius: 29,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatarGrad: {
    flex: 1, borderRadius: 26, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 34, fontWeight: '900', color: '#FFF' },
  editDot: {
    position: 'absolute', bottom: -4, right: -4,
    width: 26, height: 26, borderRadius: 9,
    backgroundColor: '#4F46E5', borderWidth: 2.5, borderColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
  },
  userName: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 8, letterSpacing: -0.3 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)',
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  roleTxt: { fontSize: 10, fontWeight: '800', color: '#34D399', letterSpacing: 1 },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  statVal: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  statLbl: { fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 0.8 },

  // Info group
  infoGroup: { paddingHorizontal: 16, marginTop: 16 },

  // Menu groups
  menuGroup: { paddingHorizontal: 16, marginTop: 20 },
  menuGroupLabel: {
    fontSize: 10, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 1.2, marginBottom: 8, marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, gap: 14,
  },
  menuIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  menuDivider: { height: 1, backgroundColor: '#F8FAFF', marginHorizontal: 16 },
  menuBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  menuBadgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 20, gap: 14,
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
  },
  logoutTxt: { fontSize: 16, fontWeight: '800', color: '#EF4444' },

  version: {
    textAlign: 'center', fontSize: 9, color: '#CBD5E1',
    fontWeight: '700', letterSpacing: 1.2, marginTop: 20,
  },
});

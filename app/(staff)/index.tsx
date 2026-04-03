import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData } from '../../services/dataService';
import { shadows, gradients } from '../../constants/theme';

// screen width available if needed for future layout calculations

// ── Premium SVG Circular Gauge ──────────────────────────────────
function CircleGauge({ pct, size = 150 }: { pct: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  
  // Vibrant gradients based on rate
  const color1 = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';
  const color2 = pct >= 80 ? '#34D399' : pct >= 60 ? '#FBBF24' : '#F87171';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color1} stopOpacity="1" />
            <Stop offset="100%" stopColor={color2} stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background Track with subtle glow */}
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none"
          />
          {/* Main Progress Ring */}
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="url(#gaugeGrad)" strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" fill="none"
          />
        </G>
      </Svg>
      {/* Center text with professional spacing */}
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '900', color: '#FFF', letterSpacing: -1.5 }}>{pct}%</Text>
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '800', letterSpacing: 0.8, marginTop: -2 }}>
          AVG ATTENDANCE
        </Text>
      </View>
    </View>
  );
}

// ── Quick Action Button ──────────────────────────────────────────
function QuickAction({ icon, label, color, onPress }: {
  icon: string; label: string; color: string; onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [s.qaBtn, pressed && { opacity: 0.8 }]} onPress={onPress}>
      <View style={[s.qaIcon, { backgroundColor: `${color}18` }]}>
        <MaterialIcons name={icon as any} size={22} color={color} />
      </View>
      <Text style={s.qaLabel}>{label}</Text>
    </Pressable>
  );
}

export default function StaffHome() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [myClasses, setMyClasses] = useState<ClassData[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const loadData = useCallback(async () => {
    if (authLoading || !user) return;
    try {
      setLoading(true);
      const [cls, act] = await Promise.all([
        dataService.getClasses(),
        dataService.getRecentActivity(4),
      ]);
      setMyClasses(cls);
      setRecentActivity(act);
    } catch (e) {
      console.error('StaffHome load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading && user) {
        loadData();
        subsRef.current.forEach(s => s.unsubscribe());
        subsRef.current = [
          dataService.subscribeToTable('classes', loadData),
          dataService.subscribeToTable('attendance_records', loadData),
        ];
      }
      return () => {
        subsRef.current.forEach(s => s.unsubscribe());
        subsRef.current = [];
      };
    }, [user, loadData, authLoading])
  );

  const today = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${dayNames[today.getDay()]}, ${monthNames[today.getMonth()]} ${today.getDate()}`;
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';

  const avgAttRate = myClasses.length
    ? Math.round(myClasses.reduce((a, c) => a + (c.attendanceRate || 0), 0) / myClasses.length)
    : 0;
  const totalStudents = myClasses.reduce((a, c) => a + (c.studentCount || 0), 0);

  function timeAgo(ts: string) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4F7FFF" />
        <Text style={{ color: '#64748B', marginTop: 12, fontSize: 13, fontWeight: '600' }}>Loading dashboard…</Text>
      </View>
    );
  }



  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── PROFESSIONAL LIGHT BLUE HEADER ── */}
        <LinearGradient
          colors={gradients.premium as any}
          style={[s.header, { paddingTop: insets.top + 8 }]}
        >
          {/* Greeting Row with date opposite */}
          <View style={s.greetingRow}>
            <View style={s.greetingBlock}>
              <Text style={s.greeting}>{greeting},</Text>
              <Text style={s.greetingName}>{firstName} 👋</Text>
            </View>
            <Text style={s.dateLabel}>{dateStr.toUpperCase()}</Text>
          </View>

          {/* Stats cards row */}
          <View style={s.statsRow}>
            {/* Gauge card */}
            <View style={s.gaugeCard}>
              <CircleGauge pct={avgAttRate} size={145} />
            </View>

            {/* Right mini tiles */}
            <View style={s.miniCol}>
              <View style={s.miniCard}>
                <View style={[s.miniIconBg, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Ionicons name="school" size={16} color="#FFF" />
                </View>
                <Text style={s.miniVal}>{myClasses.length}</Text>
                <Text style={s.miniLbl}>CLASSES</Text>
              </View>
              <View style={s.miniCard}>
                <View style={[s.miniIconBg, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <MaterialIcons name="people" size={16} color="#FFF" />
                </View>
                <Text style={s.miniVal}>{totalStudents}</Text>
                <Text style={s.miniLbl}>STUDENTS</Text>
              </View>
            </View>
          </View>

          {/* Attendance status pill */}
          <View style={s.statusPillRow}>
            <View style={[s.statusPill, { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.2)' }]}>
              <View style={[s.statusDot, { backgroundColor: '#34D399' }]} />
              <Text style={[s.statusTxt, { color: '#FFF' }]}>
                {avgAttRate >= 80 ? 'Excellent Performance' : avgAttRate >= 60 ? 'Moderate Performance' : 'Attention Needed'}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/(staff)/attendance' as any)}>
              <Text style={s.viewCalLink}>CALENDAR →</Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* ── QUICK ACTIONS ── */}
        <View style={s.sectionWrap}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.qaRow}>
            <QuickAction icon="assignment" label="Mark Attendance" color="#4F46E5"
              onPress={() => router.push('/(staff)/attendance' as any)} />
            <QuickAction icon="bar-chart" label="View Reports" color="#059669"
              onPress={() => router.push('/(staff)/reports' as any)} />
            <QuickAction icon="history" label="History" color="#D97706"
              onPress={() => router.push('/(staff)/reports' as any)} />
            <QuickAction icon="person" label="Profile" color="#7C3AED"
              onPress={() => router.push('/(staff)/profile' as any)} />
          </View>
        </View>

        {/* ── MY CLASSES ── */}
        <View style={s.sectionWrap}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>My Classes</Text>
            {myClasses.length > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countBadgeTxt}>{myClasses.length}</Text>
              </View>
            )}
          </View>

          {myClasses.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIconWrap}>
                <MaterialIcons name="event-busy" size={32} color="#CBD5E1" />
              </View>
              <Text style={s.emptyTitle}>No classes assigned</Text>
              <Text style={s.emptyDesc}>Ask your dean to assign classes to your account.</Text>
            </View>
          ) : (
            myClasses.map((cls, idx) => {
              const palette = [
                { bg: '#EEF2FF', ic: '#4F46E5', accent: '#6366F1' },
                { bg: '#ECFDF5', ic: '#059669', accent: '#10B981' },
                { bg: '#FEF3C7', ic: '#D97706', accent: '#F59E0B' },
                { bg: '#FDF2F8', ic: '#9D174D', accent: '#DB2777' },
              ][idx % 4];
              const rate = cls.attendanceRate || 0;
              const rateColor = rate >= 80 ? '#10B981' : rate >= 60 ? '#F59E0B' : '#EF4444';

              return (
                <Pressable
                  key={cls.id}
                  style={({ pressed }) => [s.classCard, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
                  onPress={() => router.push('/(staff)/attendance' as any)}
                >
                  {/* Left accent bar */}
                  <View style={[s.classAccentBar, { backgroundColor: palette.accent }]} />

                  <View style={[s.classIconWrap, { backgroundColor: palette.bg }]}>
                    <MaterialIcons name="class" size={22} color={palette.ic} />
                  </View>

                  <View style={s.classInfo}>
                    <Text style={s.classSection}>{cls.section} · {cls.year}</Text>
                    <Text style={s.className}>{cls.name}</Text>
                    <View style={s.classMeta}>
                      <MaterialIcons name="people" size={12} color="#94A3B8" />
                      <Text style={s.classMetaTxt}>{cls.studentCount} Students</Text>
                    </View>
                  </View>

                  {/* Attendance rate */}
                  <View style={s.classRateWrap}>
                    <Text style={[s.classRate, { color: rateColor }]}>{rate}%</Text>
                    <Text style={s.classRateLbl}>ATTEND.</Text>
                  </View>

                  <View style={s.arrowBtn}>
                    <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── RECENT ACTIVITY ── */}
        <View style={s.sectionWrap}>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          <View style={s.actCard}>
            {recentActivity.length === 0 ? (
              <View style={s.actEmpty}>
                <MaterialIcons name="history" size={28} color="#CBD5E1" />
                <Text style={s.actEmptyTxt}>No recent activity yet.</Text>
              </View>
            ) : (
              recentActivity.map((act, i) => (
                <View
                  key={act.id || i}
                  style={[s.actRow, i < recentActivity.length - 1 && s.actDivider]}
                >
                  <View style={s.actIconWrap}>
                    <MaterialIcons name="description" size={15} color="#4F46E5" />
                  </View>
                  <View style={s.actContent}>
                    <Text style={s.actMsg} numberOfLines={2}>{act.message}</Text>
                    <Text style={s.actTime}>{timeAgo(act.timestamp)}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color="#E2E8F0" />
                </View>
              ))
            )}
          </View>
        </View>

      </ScrollView>


    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FF' },

  // ── Hero Header ──
  header: {
    paddingBottom: 40, paddingHorizontal: 20,
    overflow: 'hidden',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  blob1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -40,
  },
  blob2: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: 0, left: -30,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  brandName: { fontSize: 15, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  bellWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  bellDot: {
    position: 'absolute', top: 8, right: 9,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#060D1F',
  },

  greetingRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, marginTop: 4,
  },
  greetingBlock: { flex: 1 },
  dateLabel: { 
    fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '800', 
    letterSpacing: 1, marginTop: 8 
  },
  greeting: { fontSize: 18, fontWeight: '400', color: 'rgba(255,255,255,0.8)' },
  greetingName: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },

  statsRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  gaugeCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    alignItems: 'center', justifyContent: 'center',
    aspectRatio: 1,
  },
  miniCol: { flex: 1, gap: 10 },
  miniCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    gap: 3,
  },
  miniIconBg: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  miniVal: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  miniLbl: { fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: 1.2 },

  statusPillRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  viewCalLink: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '800', letterSpacing: 1 },

  // ── Quick Actions ──
  sectionWrap: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  countBadge: {
    backgroundColor: '#4F46E5', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 12,
  },
  countBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#FFF' },

  qaRow: { flexDirection: 'row', gap: 10 },
  qaBtn: { flex: 1, alignItems: 'center', gap: 7 },
  qaIcon: {
    width: 54, height: 54, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  qaLabel: { fontSize: 10, fontWeight: '700', color: '#475569', textAlign: 'center' },

  // ── Class Cards ──
  emptyCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 32,
    alignItems: 'center', gap: 8, ...shadows.sm,
  },
  emptyIconWrap: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptyDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  classCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 20,
    padding: 14, marginBottom: 10,
    gap: 12, overflow: 'hidden',
    ...shadows.sm,
  },
  classAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 4,
  },
  classIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginLeft: 6,
  },
  classInfo: { flex: 1 },
  classSection: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 },
  className: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
  classMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  classMetaTxt: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  classRateWrap: { alignItems: 'center' },
  classRate: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  classRateLbl: { fontSize: 8, color: '#CBD5E1', fontWeight: '700', letterSpacing: 1 },
  arrowBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Activity ──
  actCard: {
    backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden',
    ...shadows.sm,
  },
  actEmpty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  actEmptyTxt: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  actRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  actDivider: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  actIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  actContent: { flex: 1 },
  actMsg: { fontSize: 13, fontWeight: '600', color: '#0F172A', lineHeight: 19 },
  actTime: { fontSize: 10, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  // ── FAB ──
  fab: {
    position: 'absolute', bottom: 90, right: 20,
    width: 58, height: 58, borderRadius: 20,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 12,
  },
  fabGrad: {
    flex: 1, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
});

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { dataService, ClassData } from '../../services/dataService';
import { ClassCard } from '../../components/ui/ClassCard';
import { StatCard } from '../../components/ui/StatCard';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

export default function DeanDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const classData = await dataService.getClasses(user?.department);
      setClasses(classData);
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
        dataService.subscribeToTable('classes', loadData),
        dataService.subscribeToTable('students', loadData),
      ];

      return () => {
        subsRef.current.forEach(s => s.unsubscribe());
        subsRef.current = [];
      };
    }, [user, loadData])
  );

  const totalStudents = classes.reduce((sum, cls) => sum + cls.studentCount, 0);

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
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Welcome Back</Text>
            <Text style={styles.userName}>{user?.name}</Text>
            <View style={styles.roleBadge}>
              <MaterialIcons name="verified" size={14} color={colors.dean} />
              <Text style={styles.roleText}>{(user?.department || 'General')} Dean</Text>
            </View>
          </View>
          <View style={styles.avatarContainer}>
            {user?.profileImage === null ? (
              <MaterialIcons name="account-circle" size={44} color="rgba(255,255,255,0.6)" />
            ) : (
              <Image 
                source={user?.profileImage ? { uri: user.profileImage } : require('../../assets/images/profile_image.png')} 
                style={styles.avatarImage} 
              />
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Department Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="class"
            label="Active Classes"
            value={classes.length}
            color={colors.dean}
            bgColor={colors.deanLight}
          />
          <StatCard
            icon="people"
            label="Total Students"
            value={totalStudents}
            color={colors.info}
            bgColor={colors.infoLight}
          />
        </View>

        <Text style={styles.sectionTitle}>Department Classes</Text>
        {classes.map((classItem) => (
          <ClassCard
            key={classItem.id}
            name={classItem.name}
            advisor={classItem.advisor}
            studentCount={classItem.studentCount}
            attendanceRate={classItem.attendanceRate}
            onPress={() => router.push({
              pathname: '/class-detail/[id]',
              params: { id: classItem.id }
            })}
          />
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
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  greeting: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  userName: {
    ...typography.h1,
    fontSize: 24,
    color: '#FFFFFF',
    marginVertical: spacing.xs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  roleText: {
    ...typography.label,
    fontSize: 11,
    color: colors.dean,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
});

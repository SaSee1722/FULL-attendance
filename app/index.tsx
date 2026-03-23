import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { colors, typography } from '../constants/theme';

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        if (user) {
          // Route based on user role
          switch (user.role) {
            case 'admin':
              router.replace('/(admin)');
              break;
            case 'dean':
              router.replace('/(dean)');
              break;
            case 'staff':
              router.replace('/(staff)');
              break;
            default:
              router.replace('/auth/login');
          }
        } else {
          router.replace('/auth/login');
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [user, loading, router]);

  return (
    <LinearGradient
      colors={['#6366F1', '#8B5CF6', '#EC4899']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="school" size={80} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Smart Attendance</Text>
        <Text style={styles.subtitle}>Professional Student Management System</Text>
        <View style={styles.loader}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotDelay1]} />
          <View style={[styles.dot, styles.dotDelay2]} />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 48,
  },
  loader: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  dotDelay1: {
    opacity: 0.7,
  },
  dotDelay2: {
    opacity: 0.4,
  },
});

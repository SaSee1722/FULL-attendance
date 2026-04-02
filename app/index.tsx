import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { typography, spacing, shadows, colors } from '../constants/theme';

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;
  const loadingProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(loadingProgress, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: false,
      }),
    ]).start();

    if (!loading) {
      const timer = setTimeout(() => {
        if (user) {
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
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [user, loading, router, fadeAnim, scaleAnim, translateYAnim, loadingProgress]);

  const progressWidth = loadingProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.admin, colors.adminDark, '#1E1B4B']}
        style={styles.background}
      >
        <Animated.View 
          style={[
            styles.content,
            { 
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: translateYAnim }
              ] 
            }
          ]}
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoGlow} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.05)']}
              style={styles.logoOuter}
            >
              <View style={styles.logoInner}>
                <MaterialIcons name="auto-awesome" size={64} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </View>
          
          <Text style={styles.title}>GOAT Attendance</Text>
          <Text style={styles.subtitle}>Streamlining Excellence in Education</Text>
          
          <View style={styles.loaderContainer}>
            <View style={styles.loaderTrack}>
              <Animated.View style={[styles.loaderProgress, { width: progressWidth }]} />
            </View>
            <Text style={styles.loadingText}>Securely connecting to environment...</Text>
          </View>
        </Animated.View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>v1.2.0 • Powered by DeepMind</Text>
        </View>
      </LinearGradient>
      
      <View style={[styles.decorativeCircle, { top: -50, right: -50, width: 240, height: 240, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
      <View style={[styles.decorativeCircle, { bottom: -120, left: -80, width: 320, height: 320, backgroundColor: 'rgba(255,255,255,0.03)' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.xxl,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: spacing.xxl,
  },
  logoGlow: {
    position: 'absolute',
    top: '20%',
    left: '20%',
    right: '20%',
    bottom: '20%',
    backgroundColor: '#FFFFFF',
    borderRadius: 60,
    opacity: 0.15,
    transform: [{ scale: 1.5 }],
  },
  logoOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...shadows.lg,
  },
  logoInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    ...typography.h1,
    color: '#FFFFFF',
    fontSize: 32,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: spacing.xs,
    fontSize: 14,
    fontWeight: '500',
  },
  loaderContainer: {
    width: '80%',
    marginTop: spacing.xxxl * 2,
    alignItems: 'center',
  },
  loaderTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  loaderProgress: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  loadingText: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  versionContainer: {
    position: 'absolute',
    bottom: spacing.xxl,
  },
  versionText: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 200,
  },
});

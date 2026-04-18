import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { shadows } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const loadingProgress = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequence individual animations for a more cinematic feel
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 30,
        useNativeDriver: true,
      }),
      Animated.timing(loadingProgress, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ])
    ]).start();

    if (!loading) {
      const timer = setTimeout(() => {
        const nextPath = user ? (
          user.role === 'admin' ? '/(admin)' :
          user.role === 'hod' ? '/(hod)' : '/(staff)'
        ) : '/auth/login';
        
        router.replace(nextPath as any);
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [user, loading, router, fadeAnim, scaleAnim, loadingProgress, textOpacity]);

  const progressWidth = loadingProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <LinearGradient
        colors={['#020617', '#0F172A', '#1E293B']}
        style={styles.background}
      >
        {/* Decorative Background Elements */}
        <View style={styles.ambientGlow} />
        
        <Animated.View 
          style={[
            styles.content,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }] 
            }
          ]}
        >
          <View style={styles.logoWrapper}>
            <View style={styles.glassContainer}>
              <Image 
                source={require('../assets/images/logo.png')} 
                style={styles.logoImage} 
                resizeMode="contain" 
              />
            </View>
          </View>
          
          <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
            <Text style={styles.brandName}>AttendX</Text>
            <View style={styles.taglineWrapper}>
              <View style={styles.taglineLine} />
              <Text style={styles.tagline}>INTELLIGENT PRESENCE</Text>
              <View style={styles.taglineLine} />
            </View>
          </Animated.View>
          
          <View style={styles.loadingWrapper}>
            <View style={styles.loadingTrack}>
              <Animated.View style={[styles.loadingBar, { width: progressWidth }]} />
            </View>
            <Text style={styles.loadingStatus}>Initializing secure session...</Text>
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SYSTEM v1.2.0</Text>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>SECURED BY ATTENDX</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    top: '20%',
    width: width * 1.5,
    height: width,
    backgroundColor: '#3B82F6',
    borderRadius: 500,
    opacity: 0.05,
    transform: [{ scale: 1.5 }],
  },
  content: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  logoWrapper: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  glassContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...shadows.lg,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  taglineWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  taglineLine: {
    width: 20,
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.5)',
  },
  tagline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 4,
  },
  loadingWrapper: {
    width: '100%',
    marginTop: 80,
    alignItems: 'center',
  },
  loadingTrack: {
    width: '70%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  loadingStatus: {
    marginTop: 16,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.2)',
    letterSpacing: 1,
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

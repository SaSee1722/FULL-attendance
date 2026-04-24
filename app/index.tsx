import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Quick fade + scale in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    if (!loading) {
      // Navigate after exactly 1 second
      const timer = setTimeout(() => {
        const nextPath = user
          ? user.role === 'admin'
            ? '/(admin)'
            : user.role === 'hod'
            ? '/(hod)'
            : '/(staff)'
          : '/auth/login';

        router.replace(nextPath as any);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, loading, router, fadeAnim, scaleAnim, textOpacity]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['#020617', '#0F172A', '#1E293B']}
        style={styles.background}
      >
        {/* Subtle ambient glow */}
        <View style={styles.ambientGlow} />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Logo container — sophisticated circular design */}
          <View style={styles.logoWrapper}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../assets/images/applogo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* App name + tagline */}
          <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
            <Text style={styles.brandName}>AttendX</Text>
            <View style={styles.taglineWrapper}>
              <View style={styles.taglineLine} />
              <Text style={styles.tagline}>INTELLIGENT PRESENCE</Text>
              <View style={styles.taglineLine} />
            </View>
            <Text style={styles.description}>
              Smart attendance management for schools.{`\n`}Efficient, Reliable, and Professional.
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Footer — professionally highlighted */}
        <Animated.View style={[styles.footer, { opacity: textOpacity }]}>
          <View style={styles.footerSeparator} />
          <Text style={styles.footerText}>DEVELOPED BY ZENLABS</Text>
        </Animated.View>
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
    marginBottom: 40,
    // Layered shadows for depth
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 20,
  },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    overflow: 'hidden',
  },
  logoImage: {
    width: '85%',
    height: '85%',
    backgroundColor: '#FFFFFF',
    transform: [{ translateX: 6 }], // Nudge right to center the off-center source image
  },
  description: {
    marginTop: 18,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.4,
    paddingHorizontal: 30,
  },
  footer: {
    position: 'absolute',
    bottom: 54,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerSeparator: {
    width: 30,
    height: 2,
    backgroundColor: '#3B82F6',
    borderRadius: 1,
    marginBottom: 12,
  },
  footerText: {
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 2,
    fontWeight: '700',
    opacity: 0.8,
  },
  brandName: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  taglineWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 15,
  },
  taglineLine: {
    width: 25,
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.6)',
  },
  tagline: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 5,
  },
});

import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadows } from '../../constants/theme';

export default function DeanLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 60 + insets.bottom,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    ...shadows.lg,
    paddingBottom: insets.bottom,
    paddingTop: 8,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: colors.primaryBlue,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarShowLabel: false,
        tabBarIconStyle: { width: 44, height: 44, marginTop: 0 },
        tabBarBackground: () => null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.activeTabIcon]}>
              <MaterialIcons name="home" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="management"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.activeTabIcon]}>
              <MaterialIcons name="manage-accounts" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.activeTabIcon]}>
              <MaterialIcons name="assessment" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.activeTabIcon]}>
              <MaterialIcons name="person" size={24} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  activeTabIcon: {
    backgroundColor: `${colors.primaryBlue}12`,
  },
});

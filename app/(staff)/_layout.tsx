import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, StyleSheet } from 'react-native';

export default function StaffLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'ios' ? insets.bottom : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 0,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E8EEFF',
          shadowColor: '#4F46E5',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 16,
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[s.icon, focused && s.iconActive]}>
              <MaterialIcons name="grid-view" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, focused }) => (
            <View style={[s.icon, focused && s.iconActive]}>
              <Ionicons
                name={focused ? 'school' : 'school-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <View style={[s.icon, focused && s.iconActive]}>
              <MaterialIcons name="bar-chart" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[s.icon, focused && s.iconActive]}>
              <MaterialIcons
                name={focused ? 'person' : 'person-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  icon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  iconActive: {
    backgroundColor: '#EEF2FF',
  },
});

import { Tabs, Redirect } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../hooks/useAuth';

const HomeIcon = ({ active, color }: { active: boolean; color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Svg>
);

const AttendanceIcon = ({ active, color }: { active: boolean; color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <Path d="M9 2h6" />
    <Path d="M12 2v2" />
    <Path d="M15 2v2" />
    <Path d="M9 2v2" />
    <Path d="M8 11h8" />
    <Path d="M8 15h8" />
    <Path d="M8 19h5" />
  </Svg>
);

const ReportsIcon = ({ active, color }: { active: boolean; color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 3v18h18" />
    <Path d="M18 17V9" />
    <Path d="M13 17V5" />
    <Path d="M8 17v-3" />
  </Svg>
);

const ProfileIcon = ({ active, color }: { active: boolean; color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </Svg>
);

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBarContainer}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const renderIcon = () => {
            const color = isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)';
            switch (route.name) {
              case 'index': return <HomeIcon active={isFocused} color={color} />;
              case 'attendance': return <AttendanceIcon active={isFocused} color={color} />;
              case 'reports': return <ReportsIcon active={isFocused} color={color} />;
              case 'profile': return <ProfileIcon active={isFocused} color={color} />;
              default: return null;
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              {renderIcon()}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function StaffLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    width: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

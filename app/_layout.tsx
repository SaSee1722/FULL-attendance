import { AlertProvider } from '@/components/ui/alert';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { OfflineBanner } from '../components/OfflineBanner';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="auth/login" />
              <Stack.Screen name="auth/signup" />
              <Stack.Screen name="(admin)" />
              <Stack.Screen name="(hod)" />
              <Stack.Screen name="(staff)" />
              <Stack.Screen name="class-detail/[id]" />
            </Stack>
            {/* Global offline banner — overlays all screens */}
            <OfflineBanner />
          </View>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}

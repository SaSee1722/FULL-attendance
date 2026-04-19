import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineQueue } from '../services/offlineQueue';
import { dataService } from '../services/dataService';

interface OfflineBannerProps {
  onSyncComplete?: (synced: number) => void;
}

export function OfflineBanner({ onSyncComplete }: OfflineBannerProps) {
  const { isOnline, isChecking } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const [pendingCount, setPendingCount] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);
  const prevOnlineRef = useRef<boolean | null>(null);

  // Slide banner in/out
  useEffect(() => {
    if (isChecking) return;
    Animated.spring(slideAnim, {
      toValue: isOnline ? -60 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [isOnline, isChecking, slideAnim]);

  // Refresh pending count periodically
  useEffect(() => {
    const refresh = async () => {
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isChecking) return;
    if (isOnline && prevOnlineRef.current === false) {
      // Just came back online
      handleSync();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, isChecking]);

  const handleSync = async () => {
    if (syncing || pendingCount === 0) return;
    setSyncing(true);
    try {
      // Get the user's real profile ID for proper attribution
      const profile = await dataService.getCurrentProfile();
      const profileId = profile?.id || '';
      const { synced } = await offlineQueue.syncToServer(profileId);
      if (synced > 0) {
        setPendingCount(0);
        onSyncComplete?.(synced);
      }
    } finally {
      setSyncing(false);
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);
    }
  };

  if (isChecking || isOnline) return null;

  return (
    <Animated.View style={[s.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={s.row}>
        <View style={s.leftRow}>
          <View style={s.dot} />
          <Ionicons name="cloud-offline-outline" size={16} color="#FFF" />
          <View style={s.textBlock}>
            <Text style={s.title}>You're Offline</Text>
            {pendingCount > 0 && (
              <Text style={s.sub}>{pendingCount} record{pendingCount !== 1 ? 's' : ''} pending sync</Text>
            )}
          </View>
        </View>
        {pendingCount > 0 && (
          <Pressable style={[s.syncBtn, syncing && { opacity: 0.6 }]} onPress={handleSync} disabled={syncing}>
            <Text style={s.syncTxt}>{syncing ? 'Syncing…' : 'Retry'}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    // Pulse effect via opacity animation would need Animated.Value
  },
  textBlock: {
    marginLeft: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  sub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    marginTop: 1,
  },
  syncBtn: {
    backgroundColor: '#4F7FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  syncTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
});

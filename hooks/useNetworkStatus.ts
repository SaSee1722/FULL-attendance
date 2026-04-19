import { useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isChecking: boolean;
  lastOnlineAt: Date | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);
  const prevOnline = useRef(true);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      setIsChecking(false);
      if (online && !prevOnline.current) {
        setLastOnlineAt(new Date());
      }
      prevOnline.current = online;
    });

    // Fetch current state immediately
    NetInfo.fetch().then((state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      setIsChecking(false);
      if (online) setLastOnlineAt(new Date());
    });

    return () => unsubscribe();
  }, []);

  return { isOnline, isChecking, lastOnlineAt };
}

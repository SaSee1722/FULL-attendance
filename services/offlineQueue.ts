/**
 * Offline Queue Service
 * 
 * Stores attendance records locally when the device is offline.
 * Syncs them to Supabase automatically when connectivity is restored.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const QUEUE_KEY = 'offline_attendance_queue';
const PERSIST_CACHE_KEY = 'offline_data_cache';

export interface QueuedAttendanceRecord {
  id: string; // local unique ID
  studentId: string;
  classId: string;
  date: string;
  status: 'present' | 'absent' | 'on-duty' | 'unapproved';
  markedBy: string;
  queuedAt: string;
  retryCount: number;
}

// ─── Persistent Data Cache ────────────────────────────────────────────────────
// Persists fetched data to AsyncStorage so it survives app restarts offline.

export const persistentCache = {
  async set(key: string, data: any): Promise<void> {
    try {
      const cacheStr = await AsyncStorage.getItem(PERSIST_CACHE_KEY);
      const cache = cacheStr ? JSON.parse(cacheStr) : {};
      cache[key] = { data, savedAt: Date.now() };
      await AsyncStorage.setItem(PERSIST_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('[PersistentCache] set error:', e);
    }
  },

  async get(key: string, maxAgeMs = 24 * 60 * 60 * 1000): Promise<any | null> {
    try {
      const cacheStr = await AsyncStorage.getItem(PERSIST_CACHE_KEY);
      if (!cacheStr) return null;
      const cache = JSON.parse(cacheStr);
      const entry = cache[key];
      if (!entry) return null;
      // Return stale data if within maxAge (default: 24 hours)
      if (Date.now() - entry.savedAt > maxAgeMs) return null;
      return entry.data;
    } catch (e) {
      console.warn('[PersistentCache] get error:', e);
      return null;
    }
  },

  async getStale(key: string): Promise<any | null> {
    // Get data regardless of age (for offline fallback)
    try {
      const cacheStr = await AsyncStorage.getItem(PERSIST_CACHE_KEY);
      if (!cacheStr) return null;
      const cache = JSON.parse(cacheStr);
      return cache[key]?.data ?? null;
    } catch (e) {
      return null;
    }
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(PERSIST_CACHE_KEY);
  },
};

// ─── Offline Queue ────────────────────────────────────────────────────────────

export const offlineQueue = {
  async getQueue(): Promise<QueuedAttendanceRecord[]> {
    try {
      const str = await AsyncStorage.getItem(QUEUE_KEY);
      return str ? JSON.parse(str) : [];
    } catch {
      return [];
    }
  },

  async addRecords(records: Omit<QueuedAttendanceRecord, 'id' | 'queuedAt' | 'retryCount'>[]): Promise<void> {
    try {
      const queue = await this.getQueue();
      const now = new Date().toISOString();

      records.forEach((r) => {
        // Remove any existing record for same student+date to avoid duplicates
        const existingIdx = queue.findIndex(
          (q) => q.studentId === r.studentId && q.date === r.date
        );
        if (existingIdx >= 0) {
          queue.splice(existingIdx, 1);
        }
        queue.push({
          ...r,
          id: `${r.studentId}_${r.date}_${Date.now()}`,
          queuedAt: now,
          retryCount: 0,
        });
      });

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log(`[OfflineQueue] Queued ${records.length} records. Total: ${queue.length}`);
    } catch (e) {
      console.error('[OfflineQueue] addRecords error:', e);
    }
  },

  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },

  async syncToServer(markedByProfileId: string): Promise<{ synced: number; failed: number }> {
    const queue = await this.getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    console.log(`[OfflineQueue] Syncing ${queue.length} queued records...`);

    const now = new Date().toISOString();
    const toSync = queue.map((r) => ({
      student_id: r.studentId,
      class_id: r.classId,
      status: r.status,
      date: r.date,
      marked_by: r.markedBy || markedByProfileId,
      timestamp: now,
    }));

    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert(toSync, { onConflict: 'student_id,date' });

      if (error) {
        console.error('[OfflineQueue] Sync failed:', error);
        // Increment retry count
        const updated = queue.map((r) => ({ ...r, retryCount: r.retryCount + 1 }));
        // Remove records that have failed 5+ times
        const remaining = updated.filter((r) => r.retryCount < 5);
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
        return { synced: 0, failed: queue.length };
      }

      // Success — clear the queue
      await AsyncStorage.removeItem(QUEUE_KEY);
      console.log(`[OfflineQueue] ✅ Synced ${queue.length} records`);
      return { synced: queue.length, failed: 0 };
    } catch (e) {
      console.error('[OfflineQueue] syncToServer exception:', e);
      return { synced: 0, failed: queue.length };
    }
  },

  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },
};

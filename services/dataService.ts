import { supabase } from '../lib/supabase';
import { colors } from '../constants/theme';
import { authService } from './authService';
import { persistentCache } from './offlineQueue';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'hod' | 'staff';
  department: string;
  profile_image?: string | null;
  staff_id?: string;
}

export interface ClassData {
  id: string;
  name: string;
  department: string;
  year: string;
  section: string;
  advisor: string;
  advisorImage?: string;
  studentCount: number;
  attendanceRate: number;
}

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  classId: string;
  attendanceRate: number;
  isIntern?: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  staffId?: string;      // HOD-generated login ID
  password?: string;     // HOD-generated plain password (managed staff only)
  department: string;
  profileImage?: string;
  assignedClasses: number;
}

export interface ManagedStaff {
  id: string;
  staff_id: string;
  name: string;
  password?: string;
  department: string;
  hod_id: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'present' | 'absent' | 'on-duty' | 'unapproved' | 'intern';
  markedBy: string;
  timestamp: string;
}

// ── Fast Cache Implementation ────────────────────────────────────
interface CacheEntry { data: any; expiry: number; }
const memoryCache: Record<string, CacheEntry> = {};

// Different TTLs per data type:
const TTL = {
  profile:    60_000,  // profile changes rarely
  classes:    45_000,  // class list — 45s
  students:   60_000,  // student list — 1 min
  attendance: 20_000,  // attendance records — 20s (marks can change)
  activity:   30_000,  // activity log — 30s
  staff:      60_000,  // staff list — 1 min
};

function getCached(key: string) {
  const entry = memoryCache[key];
  if (entry && entry.expiry > Date.now()) return entry.data;
  return null;
}
function setCache(key: string, data: any, ttl = TTL.classes) {
  memoryCache[key] = { data, expiry: Date.now() + ttl };
}
// Selectively clear only keys matching a prefix (e.g. 'attendance_')
function clearCachePrefix(prefix: string) {
  Object.keys(memoryCache).forEach(k => { if (k.startsWith(prefix)) delete memoryCache[k]; });
}

export const dataService = {
  clearCache() { 
    Object.keys(memoryCache).forEach(k => delete memoryCache[k]); 
  },
  clearStatsCache() {
    clearCachePrefix('stats-');
    clearCachePrefix('dept-');
  },
  // ── Profiles ───────────────────────────────────────────────────
  async getCurrentProfile(): Promise<Profile | null> {
    const cacheKey = 'profile_current';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      // 1. Check local auth state first
      const localUser = await authService.getCurrentUser();
      if (!localUser) {
        // No local auth — try stale persisted profile as last resort
        const stale = await persistentCache.getStale(cacheKey);
        return stale || null;
      }

      // 2. If it's a virtual user, use a simulated profile
      if (localUser.isVirtual) {
        const virtualProfile: any = {
          id: localUser.id,
          name: localUser.name,
          email: localUser.email,
          role: 'staff',
          department: localUser.department,
          profile_image: localUser.profileImage,
          isVirtual: true,
          staff_id: localUser.staffId
        };
        setCache(cacheKey, virtualProfile, TTL.profile);
        // Persist so it's available offline
        persistentCache.set(cacheKey, virtualProfile).catch(() => {});
        return virtualProfile;
      }

      // 3. Fallback to Supabase Profile — race against a 5s timeout so we fail fast offline
      const timeout = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 5000)
      );
      const fetchProfile = supabase
        .from('profiles')
        .select('*')
        .eq('id', localUser.id)
        .maybeSingle();

      const { data, error } = await Promise.race([fetchProfile, timeout]);
      
      if (error || !data) {
        // Network failed — return stale persisted profile
        const stale = await persistentCache.getStale(cacheKey);
        if (stale) {
          setCache(cacheKey, stale, TTL.profile);
          return stale;
        }
        return null;
      }

      const profile = { ...data, isApproved: data.is_approved };
      setCache(cacheKey, profile, TTL.profile);
      // Persist so it's available offline
      persistentCache.set(cacheKey, profile).catch(() => {});
      return profile;
    } catch (e) { 
      console.error('getCurrentProfile error:', e);
      // Last resort: return stale persisted profile so offline flows don't break
      const stale = await persistentCache.getStale(cacheKey);
      if (stale) {
        setCache(cacheKey, stale, TTL.profile);
        return stale;
      }
      return null; 
    }
  },

  // ── Classes ────────────────────────────────────────────────────
  async getClasses(force = false): Promise<ClassData[]> {
    const profile = await this.getCurrentProfile();
    if (!profile) return [];
    
    // Cache per role/dept to prevent cross-contamination
    const cacheKey = `classes_${profile.role}_${profile.department || 'all'}`;
    const cached = getCached(cacheKey);
    if (cached && !force) return cached;

    try {
      const { data: allClasses } = await supabase.from('classes').select('*');
      if (!allClasses) return [];

      let filtered: any[];
      if (profile.role === 'admin') {
        filtered = allClasses;
      } else if (profile.role === 'staff') {
        // Filter by name OR Staff ID for virtual accounts
        filtered = allClasses.filter((c: any) => 
          c.advisor === profile.name || 
          (profile.staff_id && c.advisor_staff_id === profile.staff_id)
        );
      } else {
        // HOD, Dean, etc. - filter by department
        filtered = allClasses.filter((c: any) => 
          this.matchesDepartment(c.department, profile.department)
        );
      }

      if (filtered.length === 0) {
        setCache(cacheKey, [], TTL.classes);
        return [];
      }

      // ── Step 2: Advisor images + attendance records in PARALLEL ──
      const advisorNames = [...new Set(filtered.map((c: any) => c.advisor).filter(Boolean))];
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const todayStr = now.toISOString().split('T')[0];
      const classIds = filtered.map((c: any) => c.id);

      const [profilesRes, managedRes, recsRes] = await Promise.all([
        advisorNames.length > 0
          ? supabase.from('profiles').select('name, profile_image').in('name', advisorNames.map((n: any) => n.trim()))
          : Promise.resolve({ data: [] }),
        advisorNames.length > 0
          ? supabase.from('managed_staff').select('name, profile_image').in('name', advisorNames.map((n: any) => n.trim()))
          : Promise.resolve({ data: [] }),
        supabase.from('attendance_records')
          .select('class_id, status')
          .in('class_id', classIds)
          .gte('date', monthStart)
          .lte('date', todayStr),
      ]);

      // Build advisor image map from both sources (profile takes precedence over managed staff)
      const imageMap: Record<string, string> = {};
      const t = Date.now();
      
      (managedRes.data || []).forEach((ms: any) => {
        if (ms.name && ms.profile_image) {
          const url = ms.profile_image;
          imageMap[ms.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
        }
      });

      (profilesRes.data || []).forEach((ap: any) => {
        if (ap.name && ap.profile_image) {
          const url = ap.profile_image;
          // Bypass React Native Image caching
          imageMap[ap.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
        }
      });

      // Build live attendance rates
      const counts: Record<string, { present: number; total: number }> = {};
      (recsRes.data || []).forEach((r: any) => {
        if (!counts[r.class_id]) counts[r.class_id] = { present: 0, total: 0 };
        counts[r.class_id].total++;
        if (r.status === 'present' || r.status === 'on-duty') counts[r.class_id].present++;
      });

      const res: ClassData[] = filtered.map((c: any) => {
        const cnt = counts[c.id];
        let advisorImage = c.advisor ? imageMap[c.advisor.trim().toLowerCase()] : undefined;
        
        // Priority Fallback: If current user is the advisor and has an image set, use it
        // This handles cases where DB might be slightly behind or schema differs
        const profileName = (profile?.name || '').trim().toLowerCase();
        const advisorName = (c.advisor || '').trim().toLowerCase();
        if (!advisorImage && profile && advisorName === profileName && (profile.profile_image || (profile as any).profileImage)) {
          const url = profile.profile_image || (profile as any).profileImage;
          advisorImage = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
        }

        return {
          id: c.id,
          name: c.name,
          department: c.department,
          year: c.year,
          section: c.section,
          advisor: c.advisor,
          advisorImage,
          studentCount: c.student_count || 0,
          attendanceRate: cnt && cnt.total > 0 ? Math.round((cnt.present / cnt.total) * 100) : (c.attendance_rate || 0),
        };
      });

      setCache(cacheKey, res, TTL.classes);
      // Persist to AsyncStorage for offline fallback
      persistentCache.set(cacheKey, res).catch(() => {});
      return res;
    } catch {
      // Offline fallback: return stale persisted data
      const stale = await persistentCache.getStale(cacheKey);
      if (stale) {
        console.log('[DataService] getClasses: returning stale offline data');
        return stale;
      }
      return [];
    }
  },


  async createClass(payload: Omit<ClassData, 'id' | 'studentCount' | 'attendanceRate'>) {
    // Ensure we have a valid Supabase session for RLS to work
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('No authenticated session. Please log in again.');

    // Generate unique ID to avoid conflicts (timestamp suffix)
    const baseId = `${payload.name.replace(/\s+/g, '').substring(0, 4)}-${payload.year}-${payload.section}`.toUpperCase();
    const uniqueId = `${baseId}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

    const { data, error } = await supabase
      .from('classes')
      .insert({
        id: uniqueId,
        name: payload.name,
        department: payload.department,
        year: payload.year,
        section: payload.section,
        advisor: payload.advisor || '',
        student_count: 0,
        attendance_rate: 0
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      department: data.department,
      year: data.year,
      section: data.section,
      advisor: data.advisor,
      studentCount: 0,
      attendanceRate: 0
    };
  },

  async deleteClass(id: string) {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Students ───────────────────────────────────────────────────
  async getStudents(classId: string): Promise<Student[]> {
    const cacheKey = `students_${classId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('roll_no');
      
      const result = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        rollNo: s.roll_no,
        classId: s.class_id,
        attendanceRate: s.attendance_rate != null ? s.attendance_rate : 100,
        isIntern: s.is_intern || false
      }));
      setCache(cacheKey, result, TTL.students);
      // Persist for offline
      persistentCache.set(cacheKey, result).catch(() => {});
      return result;
    } catch {
      // Offline fallback
      const stale = await persistentCache.getStale(cacheKey);
      if (stale) {
        console.log('[DataService] getStudents: returning stale offline data for', classId);
        return stale;
      }
      return [];
    }
  },

  async getStudentsByClass(classId: string) {
    return this.getStudents(classId);
  },

  async addStudent(payload: { name: string; rollNo: string; classId: string }) {
    const { data, error } = await supabase
      .from('students')
      .insert({
        name: payload.name,
        roll_no: payload.rollNo,
        class_id: payload.classId,
        attendance_rate: 100
      })
      .select()
      .single();
    if (error) throw error;
    this.clearCachePrefix('stu-');
    this.clearStatsCache();
    return {
      id: data.id,
      name: data.name,
      rollNo: data.roll_no,
      classId: data.class_id,
      attendanceRate: 100
    };
  },

  async updateStudent(id: string, payload: { name: string; rollNo: string }) {
    const { data, error } = await supabase
      .from('students')
      .update({
        name: payload.name,
        roll_no: payload.rollNo
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.clearCachePrefix('stu-');
    this.clearStatsCache();
    return {
      id: data.id,
      name: data.name,
      rollNo: data.roll_no,
      classId: data.class_id,
      attendanceRate: data.attendance_rate || 0
    };
  },

  async deleteStudent(id: string, classId: string) {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
  },

  async togglePermanentIntern(studentId: string, isIntern: boolean) {
    const { error } = await supabase
      .from('students')
      .update({ is_intern: isIntern })
      .eq('id', studentId);
    
    if (error) throw error;
    this.clearStatsCache();
    
    // Clear student caches
    clearCachePrefix('students_');
    clearCachePrefix('classes_');
  },

  // ── Staff ────────────────────────────────────────────────────
  async getStaffMembers(): Promise<StaffMember[]> {
    const cacheKey = 'staff_list';
    const cached = getCached(cacheKey);
    if (cached) return cached;
    try {
      const p = await this.getCurrentProfile();
      if (!p) return [];

      // Combine both Auth profiles and Managed Staff for the UI
      const [{ data: profiles }, { data: managed }] = await Promise.all([
        p.role === 'admin' 
          ? supabase.from('profiles').select('*').eq('role', 'staff')
          : supabase.from('profiles').select('*').eq('role', 'staff').eq('department', p.department),
        supabase.from('managed_staff').select('*').eq('hod_id', p.id)
      ]);
      
      const result: StaffMember[] = [];

      if (profiles) {
        profiles.forEach((s: any) => result.push({
          id: s.id,
          name: s.name,
          email: s.email,
          department: s.department,
          profileImage: s.profile_image || undefined,
          assignedClasses: 0
        }));
      }

      if (managed) {
        managed.forEach((m: any) => result.push({
          id: m.id,
          staffId: m.staff_id,
          password: m.password,   // Plain password for HOD credential view
          name: m.name,
          department: m.department,
          assignedClasses: 0
        }));
      }

      setCache(cacheKey, result, TTL.staff);
      return result;
    } catch { return []; }
  },

  async getHODs(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['hod', 'dean']) // Support both legacy 'dean' and new 'hod' roles
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      const t = Date.now();
      return (data || []).map(p => {
        if (p.profile_image) {
          const url = p.profile_image;
          p.profile_image = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
        }
        return p;
      });
    } catch (e) {
      console.error('getHODs error:', e);
      return [];
    }
  },

  async approveHOD(id: string): Promise<void> {
    try {
      console.log('Attempting to approve HOD with ID:', id);
      
      // Step 1: Preliminary check
      const { data: check } = await supabase
        .from('profiles')
        .select('id, email, name')
        .eq('id', id)
        .maybeSingle();
      
      let targetId = id;
      
      if (!check) {
        console.warn('Profile not found by ID. Searching by ID again without strict types...');
        // Sometimes IDs in JS state can have slight mismatches with DB UUIDs if not handled carefully
      }

      // Step 2: Perform the update with a count check
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', targetId)
        .select();
      
      if (error) throw error;
      this.clearStatsCache();
      
      // If no rows updated by ID, try one last time by name/role if we had a check result
      if ((!data || data.length === 0) && check?.email) {
        console.log('ID update failed, trying email fallback for:', check.email);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .update({ is_approved: true })
          .eq('email', check.email)
          .select();
          
        if (fallbackError) throw fallbackError;
        this.clearStatsCache();
        if (!fallbackData || fallbackData.length === 0) {
          throw new Error('Approval failed: Profile exists but could not be updated. Check RLS policies.');
        }
        console.log('Successfully approved HOD via email fallback');
      } else if (!data || data.length === 0) {
        throw new Error('Profile not found or no permission to update this account.');
      }
      
      console.log('Successfully approved HOD:', id);
      this.clearCache();
    } catch (e: any) {
      console.error('approveHOD error:', e);
      throw e;
    }
  },

  async deleteStaffMember(id: string, isManaged: boolean) {
    try {
      if (isManaged) {
        // Virtual accounts: direct delete from managed_staff (permissive RLS)
        const { error } = await supabase
          .from('managed_staff')
          .delete()
          .eq('id', id);
        if (error) {
          console.error('managed_staff delete error:', error);
          throw new Error(error.message || 'Could not delete staff account. Check RLS permissions.');
        }
      } else {
        // Real Supabase auth accounts: use RPC with SECURITY DEFINER to bypass RLS.
        // The function `delete_profile_by_id` must exist in your Supabase database.
        const { error } = await supabase.rpc('delete_profile_by_id', { target_id: id });
        if (error) {
          console.error('delete_profile_by_id RPC error:', error);
          // Fallback: try direct delete (works if admin RLS policy exists)
          const { error: directError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);
          if (directError) {
            throw new Error(
              'Delete failed. This is likely an RLS permission issue. ' +
              'Run the SQL migration in your Supabase dashboard to enable admin deletes.'
            );
          }
        }
      }
      this.clearCache();
    } catch (e: any) {
      console.error('deleteStaffMember error:', e);
      throw e;
    }
  },

  async transferAllOwnership(sourceId: string, sourceName: string, targetId: string, targetName: string) {
    try {
      // 1. Transfer Classes
      const { error: clsError } = await supabase
        .from('classes')
        .update({ 
          advisor: targetName,
          advisor_staff_id: targetId 
        })
        .or(`advisor.eq."${sourceName}",advisor_staff_id.eq."${sourceId}"`);

      if (clsError) throw clsError;

      // 2. Transfer Managed Staff (if source was an HOD)
      // Note: We use UUID (sourceId) for hod_id as it's a profile reference
      const { error: msError } = await supabase
        .from('managed_staff')
        .update({ hod_id: targetId })
        .eq('hod_id', sourceId);

      // msError might be zero rows affected if source不是HOD, which is fine
      // But we check for actual database errors
      if (msError && msError.code !== 'PGRST116') {
         // Some specific errors might occur if targetId is not a valid HOD UUID
         // We ignore if no matching rows
      }

      this.clearCache();
    } catch (e) {
      console.error('transferAllOwnership error:', e);
      throw e;
    }
  },

  async getClassesByAdvisor(name: string, id?: string) {
    try {
      let query = supabase.from('classes').select('*');
      if (id) {
        query = query.or(`advisor.eq."${name}",advisor_staff_id.eq."${id}"`);
      } else {
        query = query.eq('advisor', name);
      }
      const { data } = await query;
      return data || [];
    } catch { return []; }
  },

  async createManagedStaff(data: { staff_id: string; name: string; password: string; department: string }) {
    const p = await this.getCurrentProfile();
    if (!p) throw new Error('Not authenticated');

    // Check uniqueness
    const { data: existing } = await supabase
      .from('managed_staff')
      .select('id')
      .eq('staff_id', data.staff_id)
      .maybeSingle();

    if (existing) throw new Error('Staff ID already exists. Please choose a unique ID.');

    const { data: staff, error } = await supabase
      .from('managed_staff')
      .insert([{
        ...data,
        hod_id: p.id
      }])
      .select()
      .single();

    if (error) throw error;
    
    // Clear staff cache
    Object.keys(memoryCache).forEach(k => { if (k.startsWith('staff_')) delete memoryCache[k]; });
    
    return staff;
  },

  // ── Attendance ────────────────────────────────────────────────

  // Returns per-student name+roll+status rows across a date range for all advisor classes
  async getAttendanceDetailsByRange(startDate: string, endDate: string): Promise<{
    studentName: string;
    rollNo: string;
    status: string;
    date: string;
    className: string;
  }[]> {
    try {
      const classes = await this.getClasses();
      if (classes.length === 0) return [];
      const classIds = classes.map(c => c.id);
      const classMap: Record<string, string> = {};
      classes.forEach(c => { classMap[c.id] = c.name; });

      // Single query: attendance records joined with students
      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id, class_id, date, status, students:student_id (name, roll_no)')
        .in('class_id', classIds)
        .gte('date', startDate)
        .lte('date', endDate)
        .in('status', ['absent', 'unapproved', 'on-duty'])
        .order('date', { ascending: false });

      return (records || []).map((r: any) => ({
        studentName: r.students?.name || 'Unknown',
        rollNo: r.students?.roll_no || '—',
        status: r.status,
        date: r.date,
        className: classMap[r.class_id] || r.class_id,
      }));
    } catch (e) {
      console.error('getAttendanceDetailsByRange error:', e);
      return [];
    }
  },

  async getAttendance(classId: string, date: string): Promise<AttendanceRecord[]> {
    const cacheKey = `attendance_rec_${classId}_${date}`;
    try {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('class_id', classId)
        .eq('date', date);
      
      const result = (data || []).map(r => ({
        id: r.id,
        studentId: r.student_id,
        classId: r.class_id,
        date: r.date,
        status: r.status,
        markedBy: r.marked_by,
        timestamp: r.timestamp
      }));
      // Persist for offline (24h max age)
      if (result.length > 0) {
        persistentCache.set(cacheKey, result).catch(() => {});
      }
      return result;
    } catch {
      // Offline fallback
      const stale = await persistentCache.getStale(cacheKey);
      if (stale) {
        console.log('[DataService] getAttendance: returning stale offline data');
        return stale;
      }
      return [];
    }
  },

  async markAttendance(records: Partial<AttendanceRecord>[]) {
    try {
      const profile = await this.getCurrentProfile();
      if (!profile) throw new Error('Not authenticated');

      const now = new Date().toISOString();
      const formatted = records.map(r => ({
        student_id: r.studentId,
        class_id: r.classId,
        status: r.status,
        date: (r.date || '').substring(0, 10) || now.substring(0, 10),
        marked_by: profile.id,
        timestamp: now
      }));
      
      console.log(`[DataService] Marking attendance for ${records.length} students on ${formatted[0].date}`);
      
      const { error } = await supabase
        .from('attendance_records')
        .upsert(formatted, { onConflict: 'student_id,date' });
      
      if (error) {
        console.error('Supabase upsert error:', error);
        throw error;
      }
      
      // 1. Recompute student and class attendance rates immediately
      const studentIds = Array.from(new Set(records.map(r => r.studentId).filter((id): id is string => !!id)));
      if (studentIds.length > 0) {
        await this.recomputeStudentsAttendance(studentIds);
      }

      // 2. Clear ALL relevant caches AFTER recompute
      const prefixes = ['attendance_', 'students_', 'classes_', 'activity_', 'trend-', 'summary-', 'weekly-', 'details-', 'stats', 'logs-'];
      prefixes.forEach(p => clearCachePrefix(p));

      // 3. Log activity asynchronously
      this.getCurrentProfile().then(p => {
        if (p && records.length > 0) {
          const pCount = records.filter(r => r.status?.toLowerCase() === 'present').length;
          const aCount = records.filter(r => r.status?.toLowerCase() === 'absent' || r.status?.toLowerCase() === 'unapproved').length;
          const odCount = records.filter(r => r.status?.toLowerCase() === 'on-duty').length;
          
          supabase.from('activity_logs').insert({
            type: 'attendance_marking',
            details: `${p.name} marked attendance for Class ${records[0].classId}: ${pCount}P, ${aCount}A, ${odCount}OD`,
            department: p.department,
            marked_by: p.id
          }).then(({ error: logErr }) => {
            if (logErr) console.warn('Activity log suppressed:', logErr);
          });
        }
      });
    } catch (e) {
      console.error('markAttendance full failure:', e);
      throw e;
    }
  },

  async recomputeStudentsAttendance(studentIds: string[]) {
    try {
      const uniqueIds = Array.from(new Set(studentIds));

      // Count all absent/unapproved records per student
      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id, date')
        .in('student_id', uniqueIds)
        .in('status', ['absent', 'unapproved']);

      // Count distinct absence DATES per student (1 absence per day max)
      const counts: Record<string, Set<string>> = {};
      uniqueIds.forEach(id => counts[id] = new Set());
      records?.forEach((r: any) => {
        if (counts[r.student_id] !== undefined) {
          counts[r.student_id].add(r.date);
        }
      });

      // Update all students: 100% base, -3% per absent day, floor at 0%
      await Promise.all(uniqueIds.map(id => {
        const absenceDays = counts[id]?.size ?? 0;
        const rate = Math.max(0, 100 - (absenceDays * 3));
        return supabase
          .from('students')
          .update({ attendance_rate: rate })
          .eq('id', id);
      }));

      // NEW: Also recompute attendance rate for the classes these students belong to
      const { data: studentClasses } = await supabase
        .from('students')
        .select('class_id')
        .in('id', uniqueIds);
      
      const classIds = Array.from(new Set((studentClasses || []).map(s => s.class_id).filter(Boolean)));
      
      if (classIds.length > 0) {
        await Promise.all(classIds.map(async (clsId) => {
          const { data: classStudents } = await supabase
            .from('students')
            .select('attendance_rate')
            .eq('class_id', clsId);
          
          if (classStudents && classStudents.length > 0) {
            const sum = classStudents.reduce((acc, s) => acc + (s.attendance_rate || 0), 0);
            const avgClassRate = Math.round(sum / classStudents.length);
            
            await supabase
              .from('classes')
              .update({ attendance_rate: avgClassRate })
              .eq('id', clsId);
          }
        }));
      }

      // Invalidate caches so UI picks up new rates
      clearCachePrefix('students_');
      clearCachePrefix('classes_');
      clearCachePrefix('stats');
      clearCachePrefix('summary-');
    } catch (e) {
      console.error('recomputeStudentsAttendance failure:', e);
    }
  },

  // One-time fix: any student with NULL attendance_rate gets set to 100
  async fixNullAttendanceRates() {
    try {
      await supabase
        .from('students')
        .update({ attendance_rate: 100 })
        .is('attendance_rate', null);
    } catch (e) {
      console.warn('fixNullAttendanceRates suppressed:', e);
    }
  },

  // ── Holidays ──────────────────────────────────────────────────
  async getHolidays(department?: string): Promise<string[]> {
    try {
      let dept = department;
      if (!dept) {
        const p = await this.getCurrentProfile();
        if (!p) return [];
        dept = p.department;
      }

      const { data } = await supabase
        .from('holidays')
        .select('date, note')
        .eq('department', dept);
      
      return (data || []).map(h => ({ date: h.date, note: h.note || '' })) as any;
    } catch { return []; }
  },

  async markHoliday(date: string, department?: string, note: string = 'HOD marked leave') {
    let dept = department;
    let actualNote = note;

    if (!dept) {
      const p = await this.getCurrentProfile();
      if (!p) throw new Error('Not authenticated');
      dept = p.department;
    }

    const { error } = await supabase
      .from('holidays')
      .upsert({ date, department: dept, note: actualNote }, { onConflict: 'date,department' });
    if (error) throw error;
  },

  async removeHoliday(date: string, department?: string) {
    let dept = department;
    if (!dept) {
      const p = await this.getCurrentProfile();
      if (!p) throw new Error('Not authenticated');
      dept = p.department;
    }

    const { error } = await supabase
      .from('holidays')
      .delete()
      .match({ date, department: dept });
    if (error) throw error;
  },

  // ── Helpers ────────────────────────────────────────────────────
  getDepartmentAliases(dept: string): string[] {
    const deptAliases: Record<string, string[]> = {
      'computer science': ['cse', 'cs', 'it', 'compsci', 'computer science and engineering'],
      'cse': ['computer science', 'cs', 'it', 'compsci', 'computer science and engineering'],
      'electronics and communication': ['ece', 'electronics', 'enc'],
      'ece': ['electronics and communication', 'electronics', 'enc'],
      'electrical and electronics': ['eee', 'electrical'],
      'eee': ['electrical and electronics', 'electrical'],
      'mechanical': ['mech', 'mechanical engineering'],
      'mech': ['mechanical', 'mechanical engineering'],
      'information technology': ['it', 'cse-it', 'infotech'],
      'it': ['information technology', 'infotech', 'cse-it'],
      'civil': ['civil', 'civil engineering']
    };
    const normalized = dept?.toLowerCase().trim() || '';
    return deptAliases[normalized] || [];
  },

  matchesDepartment(targetDept: string, profileDept: string): boolean {
    if (!targetDept || !profileDept) return false;
    
    const normalize = (s: string) => {
      let n = s.toLowerCase().trim();
      // Remove common suffixes/prefixes
      n = n.replace(/ engineering$/i, '')
           .replace(/ engineering-?/i, '')
           .replace(/ dept\.?$/i, '')
           .replace(/^dept\.? of /i, '')
           .replace(/ faculty of /i, '')
           .replace(/ department$/i, '')
           .trim();
      // Common shorthand mappings
      if (n === 'computer science' || n === 'cs' || n === 'cse' || n === 'compsci') return 'cse';
      if (n === 'information technology' || n === 'it') return 'it';
      if (n === 'electronics' || n === 'ece') return 'ece';
      if (n === 'electrical' || n === 'eee') return 'eee';
      if (n === 'mechanical' || n === 'mech') return 'mech';
      return n;
    };

    const nt = normalize(targetDept);
    const np = normalize(profileDept);

    if (nt === np || nt.includes(np) || np.includes(nt)) return true;

    // Check specific known aliases if normalization didn't catch it
    const aliases = this.getDepartmentAliases(np);
    if (aliases.some(a => nt.includes(normalize(a)) || normalize(a).includes(nt))) return true;
    
    return false;
  },

  // ── Statistics ────────────────────────────────────────────────
  async getStatistics(departmentId?: string, targetDate?: string) {
    const today = targetDate || new Date().toISOString().split('T')[0];
    const cacheKey = departmentId ? `stats-${departmentId}-${today}` : `stats-all-${today}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const defaultStats = {
      totalClasses: 0, totalStudents: 0, totalStaff: 0, totalHODs: 0, pendingHODs: 0,
      avgAttendance: 0, averageAttendance: 0,
      presentToday: 0, absentToday: 0, onDutyToday: 0,
      department: ''
    };

    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return defaultStats;

      const isHodOrDean = ['hod', 'dean', 'HOD', 'DEAN'].includes(profile.role);
      const targetDept = departmentId || profile.department;
      const isDeptFiltered = !!departmentId || isHodOrDean;

      const [{ data: allClasses }, { data: allProfiles }] = await Promise.all([
        supabase.from('classes').select('*'),
        supabase.from('profiles').select('id, department, role, is_approved')
      ]);

      const staffProfiles = (allProfiles || []).filter(p => p.role === 'staff' || p.role === 'hod');
      const hodProfiles = (allProfiles || []).filter(p => p.role === 'hod');
      const pendingHODsTotal = (allProfiles || []).filter(p => !p.is_approved && p.role === 'hod').length;

      if (!allClasses) return defaultStats;

      let filteredClasses;
      if (profile.role === 'admin' && !departmentId) {
        filteredClasses = allClasses;
      } else if (isDeptFiltered) {
        filteredClasses = allClasses.filter(c => this.matchesDepartment(c.department, targetDept));
      } else {
        filteredClasses = allClasses.filter(c => c.advisor === profile.name);
      }

      // Get FRESH total student count directly from the students table
      const { count: studentCountDb } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .in('class_id', filteredClasses.map(c => c.id));

      const totalStudentsCount = studentCountDb || 0;
      
      // Calculate TRUE weighted average attendance
      const totalAttendanceWeight = filteredClasses.reduce((acc, c) => {
        return acc + ((c.attendance_rate || 0) * (c.student_count || 1));
      }, 0);
      const weightedAvg = totalStudentsCount > 0 ? (totalAttendanceWeight / totalStudentsCount) : 0;

      const filteredStaff = (profile.role === 'admin' && !departmentId)
        ? staffProfiles.filter(p => p.is_approved)
        : staffProfiles.filter(p => p.is_approved && this.matchesDepartment(p.department, targetDept));
      
      const { data: records, error: recError } = await supabase
        .from('attendance_records')
        .select('status, date, class_id')
        .eq('date', today)
        .in('class_id', filteredClasses.map(c => c.id));

      if (recError) throw recError;

      const counts = { present: 0, absent: 0, od: 0 };
      records?.forEach(r => {
        const stat = (r.status || '').toLowerCase().trim();
        if (stat === 'present') counts.present++;
        else if (stat === 'on-duty') counts.present++; // Count OD as present for stats
        else if (stat === 'absent' || stat === 'unapproved') counts.absent++;
      });
      const markedIds = new Set(records?.map(r => r.class_id));

      // Daily percentages relative to total marked records
      const totalMarkedToday = counts.present + counts.absent;
      const presentTodayPct = totalMarkedToday > 0 ? Math.round((counts.present / totalMarkedToday) * 100) : 0;
      const absentTodayPct = totalMarkedToday > 0 ? Math.round((counts.absent / totalMarkedToday) * 100) : 0;

      const res = {
        ...defaultStats,
        totalClasses: filteredClasses.length,
        totalStudents: totalStudentsCount,
        totalStaff: filteredStaff.length,
        totalHODs: hodProfiles.filter(p => p.is_approved && (!targetDept || this.matchesDepartment(p.department, targetDept))).length,
        pendingHODs: pendingHODsTotal,
        avgAttendance: Math.round(weightedAvg),
        averageAttendance: Math.round(weightedAvg),
        markingDone: filteredClasses.length > 0 ? Math.round((markedIds.size / filteredClasses.length) * 100) : 0,
        presentToday: counts.present,
        absentToday: counts.absent,
        presentTodayPct,
        absentTodayPct,
        department: targetDept
      };
      setCache(cacheKey, res);
      return res;
    } catch (e) { 
      console.error('getStatistics error:', e);
      return defaultStats; 
    }
  },

  async getAttendanceLogs(limit: number = 200, departmentId?: string, date?: string) {
    const logCacheKey = departmentId ? `logs-${limit}-${departmentId}-${date || ''}` : `logs-${limit}-${date || ''}`;
    const cached = getCached(logCacheKey);
    if (cached) return cached;

    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      let query = supabase
        .from('attendance_records')
        .select(`status, date, marked_by, timestamp, class_id`);

      if (date) {
        query = query.eq('date', date);
      }

      const isHodOrDean = ['hod', 'dean', 'HOD', 'DEAN'].includes(profile.role);
      const targetDept = departmentId || (isHodOrDean ? profile.department : null);
      
      if (targetDept) {
        const { data: allClasses } = await supabase.from('classes').select('id, department');
        const deptIds = (allClasses || [])
          .filter(c => this.matchesDepartment(c.department, targetDept))
          .map(c => c.id);
        
        if (deptIds.length === 0) return [];
        query = query.in('class_id', deptIds);
      }

      const { data, error } = await query
        .order('date', { ascending: false })
        .order('timestamp', { ascending: false })
        .limit(2000);

      if (error) throw error;

      const sessionsMap: Record<string, any> = {};
      
      // Fetch metadata in parallel to map manually
      const [{ data: allClasses }, { data: allProfiles }, { data: allManaged }] = await Promise.all([
        supabase.from('classes').select('id, name, department, advisor, student_count'),
        supabase.from('profiles').select('id, name'),
        supabase.from('managed_staff').select('id, name')
      ]);

      const classMap = (allClasses || []).reduce((acc: any, c) => ({ ...acc, [c.id]: c }), {});
      
      // Merge profiles and managed staff into one map
      const profileMap: Record<string, any> = {};
      (allProfiles || []).forEach(p => { profileMap[p.id] = p; });
      (allManaged || []).forEach(m => { profileMap[m.id] = m; });

      data?.forEach(r => {
        const cls = classMap[r.class_id];
        const prof = profileMap[r.marked_by];
        const dateKey = (r.date || '').substring(0, 10);
        if (!dateKey) return;

        const key = `${dateKey}_${r.class_id}`;
        if (!sessionsMap[key]) {
          sessionsMap[key] = {
            id: key, 
            classId: r.class_id, 
            className: cls?.name || 'Unknown',
            advisor: cls?.advisor, 
            date: dateKey, 
            markedBy: prof?.name || 'System',
            present: 0, 
            absent: 0, 
            onDuty: 0, 
            totalStudents: cls?.student_count || 0,
            timestamp: r.timestamp || r.date
          };
        }

        const stat = (r.status || '').toLowerCase().trim();
        if (stat === 'present') sessionsMap[key].present++;
        else if (stat === 'absent' || stat === 'unapproved') sessionsMap[key].absent++;
        else if (stat === 'on-duty') sessionsMap[key].onDuty++;
      });

      const sessions = Object.values(sessionsMap);
      const advisorNames = [...new Set(sessions.map(s => s.advisor).filter(Boolean))];
      if (advisorNames.length > 0) {
        // Fetch advisor images from BOTH sources
        const [profData, managedData] = await Promise.all([
          supabase.from('profiles').select('name, profile_image').in('name', advisorNames),
          supabase.from('managed_staff').select('name, profile_image').in('name', advisorNames)
        ]);
        
        const imgMap: Record<string, string> = {};
        const t = Date.now();
        profData.data?.forEach(ap => { 
          if (ap.name && ap.profile_image) {
            const url = ap.profile_image;
            imgMap[ap.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
          }
        });
        managedData.data?.forEach(am => { 
          if (am.name && am.profile_image) {
            const url = am.profile_image;
            imgMap[am.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
          }
        });
        
        sessions.forEach(s => {
          if (s.advisor) {
            s.advisorImage = imgMap[s.advisor.trim().toLowerCase()] || null;
            
            // Priority Fallback: If current user is the advisor and has an image set, use it
            if (!s.advisorImage && profile && s.advisor === profile.name && (profile.profile_image || (profile as any).profileImage)) {
              const url = profile.profile_image || (profile as any).profileImage;
              s.advisorImage = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
            }
          }
        });
      }

      const res = sessions.sort((a,b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.date).getTime();
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.date).getTime();
        return timeB - timeA;
      });
      setCache(logCacheKey, res);
      return res;
    } catch { return []; }
  },

  async getAttendanceSessionNames(classId: string, date: string) {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          status, 
          student_id, 
          students:student_id (name, roll_no)
        `)
        .eq('class_id', classId)
        .eq('date', date)
        .in('status', ['absent', 'unapproved', 'on-duty']);

      if (error) throw error;

      const result = {
        absentApproved: [] as any[],
        absentUnapproved: [] as any[],
        onDuty: [] as any[]
      };

      (data || []).forEach((r: any) => {
        const student = { name: r.students?.name || 'Unknown', rollNo: r.students?.roll_no || '—' };
        const stat = (r.status || '').toLowerCase().trim();
        if (stat === 'absent') result.absentApproved.push(student);
        else if (stat === 'unapproved') result.absentUnapproved.push(student);
        else if (stat === 'on-duty') result.onDuty.push(student);
      });

      return result;
    } catch (e) {
      console.error('getAttendanceSessionNames error:', e);
      return { absentApproved: [], absentUnapproved: [], onDuty: [] };
    }
  },

  // ── Rich Activity Logs with per-student details ───────────────────
  async getDetailedActivityLogs(limit: number = 10) {
    const cacheKey = `detailed-logs-${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      // Step 1: Get recent attendance sessions
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id, status, date, marked_by, timestamp, class_id, student_id
        `)
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error || !data) return [];

      // Step 2: Fetch metadata separately to handle managed staff mapping
      const classIds = [...new Set(data.map(r => r.class_id))];
      const markerIds = [...new Set(data.map(r => r.marked_by))];
      const studentIds = [...new Set(data.map(r => r.student_id))];

      const [{ data: allClasses }, { data: allProfiles }, { data: allManaged }, { data: allStudents }] = await Promise.all([
        supabase.from('classes').select('id, name, department, advisor').in('id', classIds),
        supabase.from('profiles').select('id, name').in('id', markerIds),
        supabase.from('managed_staff').select('id, name').in('id', markerIds),
        supabase.from('students').select('id, name, roll_no').in('id', studentIds)
      ]);

      const classMap = (allClasses || []).reduce((acc: any, c) => ({ ...acc, [c.id]: c }), {});
      const profileMap: Record<string, any> = {};
      (allProfiles || []).forEach(p => { profileMap[p.id] = p; });
      (allManaged || []).forEach(m => { profileMap[m.id] = m; });
      const studentMap = (allStudents || []).reduce((acc: any, s) => ({ ...acc, [s.id]: s }), {});

      // Step 3: Group by (date, class_id) session
      const sessionsMap: Record<string, any> = {};
      data.forEach(r => {
        const cls = classMap[r.class_id];
        const prof = profileMap[r.marked_by];
        const student = studentMap[r.student_id];
        const dept = cls?.department || '';
        const profileDept = profile.department || '';

        // Filter by department for hods
        if (profile.role === 'hod' && !this.matchesDepartment(dept, profileDept)) return;

        const key = `${r.date}_${r.class_id}`;
        if (!sessionsMap[key]) {
          sessionsMap[key] = {
            id: key,
            classId: r.class_id,
            className: cls?.name || 'Unknown',
            advisor: cls?.advisor || 'Unknown',
            advisorImage: null,
            department: dept,
            date: r.date,
            markedBy: prof?.name || 'System',
            timestamp: r.timestamp,
            present: 0, absent: 0, onDuty: 0, unapproved: 0, intern: 0,
            totalStudents: 0,
            presentStudents: [] as { name: string; rollNo: string }[],
            absentStudents: [] as { name: string; rollNo: string }[],
            onDutyStudents: [] as { name: string; rollNo: string }[],
            unapprovedStudents: [] as { name: string; rollNo: string }[],
            internStudents: [] as { name: string; rollNo: string }[],
          };
        }

        const stat = (r.status || '').toLowerCase().trim();
        const s = sessionsMap[key];
        s.totalStudents++;
        const studentInfo = { name: student?.name || 'Unknown', rollNo: student?.roll_no || '—' };

        if (stat === 'present') { s.present++; s.presentStudents.push(studentInfo); }
        else if (stat === 'absent') { s.absent++; s.absentStudents.push(studentInfo); }
        else if (stat === 'on-duty') { s.onDuty++; s.onDutyStudents.push(studentInfo); }
        else if (stat === 'unapproved') { s.unapproved++; s.unapprovedStudents.push(studentInfo); }
      });

      // Step 3: Fetch advisor profile images
      const sessions = Object.values(sessionsMap);
      const advisorNames = [...new Set(sessions.map(s => s.advisor).filter(Boolean))];
      if (advisorNames.length > 0) {
        const [profilesRes, managedRes] = await Promise.all([
          supabase.from('profiles').select('name, profile_image').in('name', advisorNames.map((n: any) => n.trim())),
          supabase.from('managed_staff').select('name, profile_image').in('name', advisorNames.map((n: any) => n.trim()))
        ]);

        const imgMap: Record<string, string> = {};
        const t = Date.now();
        
        (profilesRes.data || []).forEach((ap: any) => {
          if (ap.name && ap.profile_image) {
            const url = ap.profile_image;
            imgMap[ap.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
          }
        });
        
        (managedRes.data || []).forEach((ms: any) => {
          if (ms.name && ms.profile_image) {
            const url = ms.profile_image;
            imgMap[ms.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
          }
        });

        sessions.forEach(s => {
          if (s.advisor) {
            s.advisorImage = imgMap[s.advisor.trim().toLowerCase()] || null;
            
            // Priority Fallback: If current user is the advisor and has an image set, use it
            if (!s.advisorImage && profile && s.advisor === profile.name && (profile.profile_image || (profile as any).profileImage)) {
              const url = profile.profile_image || (profile as any).profileImage;
              s.advisorImage = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
            }
          }
        });
      }

      // Step 4: Sort by most recent, limit
      const res = sessions
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      setCache(cacheKey, res);
      return res;
    } catch (e) {
      console.error('getDetailedActivityLogs error:', e);
      return [];
    }
  },

  async getDepartmentClassesTodayStatus() {
    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];
      const today = new Date().toISOString().split('T')[0];

      // Step 1: Fetch classes with specific columns to avoid potential RLS '*' issues
      const { data: allClasses, error: classesError } = await supabase
        .from('classes')
        .select('id, name, department, year, section, advisor, advisor_staff_id, student_count');

      if (classesError) {
        console.error('getDepartmentClassesTodayStatus: classes fetch error', classesError);
        return [];
      }
      if (!allClasses || allClasses.length === 0) return [];

      let userDept = profile.department;
      
      // Attempt to find a reference class for the user to determine their actual department in the DB
      const referenceClass = allClasses.find(c => {
        const adv = (c.advisor || '').trim().toLowerCase();
        const profNm = (profile.name || '').trim().toLowerCase();
        const advId = (c.advisor_staff_id || '').trim();
        const profId = (profile.staff_id || '').trim();
        return (adv === profNm && profNm !== '') || (profId !== '' && advId === profId);
      });

      // If profile department is missing or mismatching, use the reference class's department
      if (!userDept || userDept === '' || userDept === 'all' || (referenceClass && !this.matchesDepartment(referenceClass.department, userDept))) {
        if (referenceClass) userDept = referenceClass.department;
      }

      let deptClasses = allClasses.filter(c => {
        if (!userDept) return false;
        return this.matchesDepartment(c.department, userDept);
      });

      // Absolute fallback: if still zero but we have a reference class, at least show the user's own classes
      if (deptClasses.length === 0 && referenceClass) {
        deptClasses = [referenceClass];
      }
      const classIds = deptClasses.map(c => c.id);

      if (classIds.length === 0) return [];

      // Step 2: Get today's attendance records for these classes
      const { data: records, error: recsError } = await supabase
        .from('attendance_records')
        .select(`
          id, status, date, marked_by, timestamp, class_id,
          profiles:marked_by (name),
          students:student_id (name, roll_no)
        `)
        .in('class_id', classIds)
        .eq('date', today);

      if (recsError) return [];

      // Step 3: Group by class_id
      const statusMap: Record<string, any> = {};
      deptClasses.forEach(c => {
        statusMap[c.id] = {
          classId: c.id,
          className: c.name,
          section: c.section,
          year: c.year,
          advisor: c.advisor,
          totalStudents: c.student_count || 0,
          isMarked: false,
          present: 0, absent: 0, onDuty: 0, unapproved: 0, intern: 0,
          markedBy: null,
          timestamp: null,
          absentStudents: [],
          onDutyStudents: [],
          unapprovedStudents: [],
          presentStudents: [],
          internStudents: []
        };
      });

      records?.forEach(r => {
        const s = statusMap[r.class_id];
        if (!s) return;
        
        s.isMarked = true;
        s.markedBy = (r.profiles as any)?.name || s.markedBy;
        s.timestamp = r.timestamp;

        const stat = (r.status || '').toLowerCase().trim();
        const student = (r.students as any);
        const studentInfo = { name: student?.name || 'Unknown', rollNo: student?.roll_no || '—' };

        if (stat === 'present') { s.present++; s.presentStudents.push(studentInfo); }
        else if (stat === 'absent') { s.absent++; s.absentStudents.push(studentInfo); }
        else if (stat === 'on-duty') { s.onDuty++; s.onDutyStudents.push(studentInfo); }
        else if (stat === 'unapproved') { s.unapproved++; s.unapprovedStudents.push(studentInfo); }
        else if (stat === 'intern') { s.intern++; s.internStudents.push(studentInfo); }
      });

      // Fetch advisor profile images from both sources
      const advisorNames = [...new Set(deptClasses.map(c => c.advisor).filter(Boolean))];
      if (advisorNames.length > 0) {
        const [profilesRes, managedRes] = await Promise.all([
          supabase.from('profiles').select('name, profile_image').in('name', advisorNames.map(n => n.trim())),
          supabase.from('managed_staff').select('name, profile_image').in('name', advisorNames.map(n => n.trim()))
        ]);

        const imgMap: Record<string, string> = {};
        const timestamp = Date.now();
        
        managedRes.data?.forEach(ms => {
          if (ms.name && ms.profile_image) {
            const url = ms.profile_image;
            imgMap[ms.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${timestamp}` : `${url}?v=${timestamp}`;
          }
        });
        
        profilesRes.data?.forEach(ap => {
          if (ap.name && ap.profile_image) {
            const url = ap.profile_image;
            imgMap[ap.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${timestamp}` : `${url}?v=${timestamp}`;
          }
        });

        deptClasses.forEach(c => {
          if (c.advisor) {
            const status = statusMap[c.id];
            status.advisorImage = imgMap[c.advisor.trim().toLowerCase()] || null;
            
            // Fallback for current user
            const profileName = (profile?.name || '').trim().toLowerCase();
            const advisorName = (c.advisor || '').trim().toLowerCase();
            if (!status.advisorImage && profile && advisorName === profileName && (profile.profile_image || (profile as any).profileImage)) {
               const url = profile.profile_image || (profile as any).profileImage;
               status.advisorImage = url.includes('?') ? `${url}&v=${timestamp}` : `${url}?v=${timestamp}`;
            }
          }
        });
      }

      return Object.values(statusMap).sort((a, b) => a.className.localeCompare(b.className));
    } catch (e) {
      console.error('getDepartmentClassesTodayStatus error:', e);
      return [];
    }
  },

  async getRecentActivity(limit = 10) {
    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      const today = new Date().toISOString().split('T')[0];
      
      const [{ data: allClasses }, { data: todayRecords }, { data: dbLogs }] = await Promise.all([
        supabase.from('classes').select('id, name, department, student_count, advisor'),
        supabase.from('attendance_records').select('status, class_id, timestamp, marked_by').eq('date', today),
        supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(limit)
      ]);

      const classMap = (allClasses || []).reduce((acc: any, c) => ({ ...acc, [c.id]: c }), {});
      
      const sessionsMap: Record<string, any> = {};
      todayRecords?.forEach(r => {
        const cid = r.class_id;
        if (!sessionsMap[cid]) {
          const cls = classMap[cid];
          sessionsMap[cid] = {
            id: `comp-${cid}`,
            type: 'attendance',
            user: 'HOD',
            message: `${cls?.name || 'Class'} marked: `,
            present: 0, absent: 0, od: 0,
            timestamp: r.timestamp || today,
            isAlert: false,
            className: cls?.name
          };
        }
        
        const stat = (r.status || '').toLowerCase().trim();
        if (stat === 'present') sessionsMap[cid].present++;
        else if (stat === 'on-duty') sessionsMap[cid].od++;
        else if (stat === 'absent' || stat === 'unapproved') sessionsMap[cid].absent++;
      });

      Object.values(sessionsMap).forEach(s => {
        s.message += `${s.present}P, ${s.absent}A, ${s.od}OD`;
      });

      const markedIds = new Set(Object.keys(sessionsMap).map(id => id.trim().toLowerCase()));
      const pendingLogs = (allClasses || [])
        .filter(c => {
          if (profile.role === 'hod' && c.department !== profile.department) return false;
          return !markedIds.has((c.id || '').trim().toLowerCase());
        })
        .map(c => ({
          id: `pending-${c.id}`,
          type: 'alert',
          user: c.advisor || 'ADVISOR',
          message: `Attendance PENDING: ${c.name} has not been marked yet.`,
          timestamp: today,
          isAlert: true
        }));

      const otherLogs = (dbLogs || [])
        .filter(l => !l.type?.includes('attendance'))
        .map(l => ({
          id: l.id,
          type: l.type,
          user: l.details?.split(' ')[0] || 'ADMIN',
          message: l.details,
          timestamp: l.timestamp,
          isAlert: false
        }));

      const completedSessions = Object.values(sessionsMap);
      const combined = [
        ...pendingLogs.slice(0, 5), 
        ...completedSessions.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        ...otherLogs
      ];

      // Fetch user images for combined logs
      const allUsers = [...new Set(combined.map(l => l.user).filter(Boolean))];
      if (allUsers.length > 0) {
        const [profData, managedData] = await Promise.all([
          supabase.from('profiles').select('name, profile_image').in('name', allUsers),
          supabase.from('managed_staff').select('name, profile_image').in('name', allUsers)
        ]);

        const imgMap: Record<string, string> = {};
        const t = Date.now();
        profData.data?.forEach(ap => { 
          if (ap.name && ap.profile_image) {
            const url = ap.profile_image;
            imgMap[ap.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
          }
        });
        managedData.data?.forEach(am => { 
          if (am.name && am.profile_image) {
            const url = am.profile_image;
            imgMap[am.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
          }
        });

        combined.forEach(l => {
          if (l.user) {
            l.userImage = imgMap[l.user.trim().toLowerCase()] || null;
            
            // Priority Fallback: If current user is the actor and has an image set, use it
            if (!l.userImage && profile && l.user === profile.name && (profile.profile_image || (profile as any).profileImage)) {
              const url = profile.profile_image || (profile as any).profileImage;
              l.userImage = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
            }
          }
        });
      }

      return combined.slice(0, limit);
    } catch (e) {
      console.error('getRecentActivity overhauled failure:', e);
      return [];
    }
  },

  async getAttendanceTrend(startDate: string, endDate: string, departmentId?: string): Promise<any[]> {
    const cacheKey = departmentId ? `trend-${startDate}-${endDate}-${departmentId}` : `trend-${startDate}-${endDate}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const classes = await this.getClasses();
      let filteredClasses = classes;
      if (departmentId) {
        filteredClasses = classes.filter(c => this.matchesDepartment(c.department, departmentId));
      }
      const classIds = filteredClasses.map((c: ClassData) => c.id);
      if (classIds.length === 0) return [];

      const { data: allRecords } = await supabase
        .from('attendance_records')
        .select('date, status')
        .in('class_id', classIds)
        .gte('date', startDate)
        .lte('date', endDate);

      // Generate all dates in range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const result = [];
      const curr = new Date(start);

      while (curr <= end) {
        const dateStr = curr.toISOString().split('T')[0];
        const dayRecords = allRecords?.filter(r => r.date === dateStr) || [];

        if (dayRecords.length === 0) {
          result.push({
            date: dateStr,
            dayLabel: curr.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            rate: -1, present: 0, absent: 0, total: 0
          });
        } else {
          const present = dayRecords.filter(r => r.status === 'present' || r.status === 'on-duty').length;
          const total = dayRecords.length;
          result.push({
            date: dateStr,
            dayLabel: curr.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            rate: Math.round((present / total) * 100),
            present,
            absent: total - present,
            total
          });
        }
        curr.setDate(curr.getDate() + 1);
      }
      setCache(cacheKey, result);
      return result;
    } catch { return []; }
  },

  async getWeeklyAttendanceTrend(days = 7, departmentId?: string): Promise<any[]> {
    const cacheKey = departmentId ? `weekly-${days}-${departmentId}` : `weekly-${days}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      const classes = await dataService.getClasses();
      let filteredClasses = classes;
      if (departmentId) {
        filteredClasses = classes.filter(c => this.matchesDepartment(c.department, departmentId));
      }
      const classIds = filteredClasses.map((c: ClassData) => c.id);
      if (classIds.length === 0) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      const startStr = startDate.toISOString().split('T')[0];

      // Single query for ALL weekly records
      const { data: allRecords } = await supabase
        .from('attendance_records')
        .select('date, status')
        .in('class_id', classIds)
        .gte('date', startStr);

      const result = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const dayRecords = allRecords?.filter(r => r.date === dateStr) || [];

        if (dayRecords.length === 0) {
          result.push({ 
            date: dateStr, 
            dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), 
            rate: -1, present: 0, absent: 0, total: 0 
          });
        } else {
          const present = dayRecords.filter(r => r.status === 'present' || r.status === 'on-duty').length;
          const total = dayRecords.length;
          result.push({
            date: dateStr,
            dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            rate: Math.round((present / total) * 100),
            present,
            absent: total - present,
            total
          });
        }
      }
      setCache(cacheKey, result);
      return result;
    } catch { return []; }
  },

  async getClassAttendanceSummary(classIds: string[], fromDate: string, toDate?: string): Promise<any> {
    const cacheKey = `summary-${classIds.join('-')}-${fromDate}-${toDate || ''}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      let query = supabase
        .from('attendance_records')
        .select('class_id, status')
        .in('class_id', classIds)
        .gte('date', fromDate);

      if (toDate) query = query.lte('date', toDate);

      const { data } = await query;

      const summary: any = {};
      classIds.forEach(id => {
        summary[id] = { present: 0, absent: 0, onDuty: 0, total: 0, rate: 0 };
      });

      data?.forEach(r => {
        if (!summary[r.class_id]) return;
        summary[r.class_id].total++;
        const stat = (r.status || '').toLowerCase().trim();
        if (stat === 'present') summary[r.class_id].present++;
        else if (stat === 'absent' || stat === 'unapproved') summary[r.class_id].absent++;
        else if (stat === 'on-duty') summary[r.class_id].onDuty++;
      });

      Object.keys(summary).forEach(id => {
        const s = summary[id];
        if (s.total > 0) s.rate = Math.round(((s.present + s.onDuty) / s.total) * 100);
      });

      setCache(cacheKey, summary);
      return summary;
    } catch { return {}; }
  },

  async getDepartmentSummary(targetDate?: string) {
    try {
      const today = targetDate || new Date().toISOString().split('T')[0];
      const [classesRes, hodsRes, recordsRes] = await Promise.all([
        supabase.from('classes').select('id, department, attendance_rate, student_count'),
        supabase.from('profiles').select('name, department').eq('role', 'hod'),
        supabase.from('attendance_records').select('class_id, status').eq('date', today)
      ]);

      const classes = classesRes.data || [];
      const hods = hodsRes.data || [];
      const todayRecords = recordsRes.data || [];
      
      const depts: Record<string, { 
        totalRate: number; 
        classCount: number; 
        studentCount: number; 
        hod?: string;
        todayPresent: number;
        todayAbsent: number;
      }> = {};
      
      // Build index for classes
      const classIdToDept: Record<string, string> = {};
      classes.forEach(c => {
        const d = c.department || 'General';
        classIdToDept[c.id] = d;
        if (!depts[d]) depts[d] = { totalRate: 0, classCount: 0, studentCount: 0, todayPresent: 0, todayAbsent: 0 };
        depts[d].totalRate += (c.attendance_rate || 0);
        depts[d].classCount++;
        depts[d].studentCount += (c.student_count || 0);
      });

      // Map today's records to departments
      todayRecords.forEach(r => {
        const d = classIdToDept[r.class_id];
        if (d && depts[d]) {
          const stat = (r.status || '').toLowerCase().trim();
          if (stat === 'present' || stat === 'on-duty') depts[d].todayPresent++;
          else if (stat === 'absent' || stat === 'unapproved') depts[d].todayAbsent++;
        }
      });

      // Map hods to departments
      hods.forEach(hod => {
        if (depts[hod.department]) {
          depts[hod.department].hod = hod.name;
        } else {
          depts[hod.department] = { totalRate: 0, classCount: 0, studentCount: 0, hod: hod.name, todayPresent: 0, todayAbsent: 0 };
        }
      });

      return Object.entries(depts).map(([name, data]) => {
        const todayTotal = data.todayPresent + data.todayAbsent;
        const todayRate = todayTotal > 0 ? Math.round((data.todayPresent / todayTotal) * 100) : null;
        
        return {
          name,
          averageRate: data.classCount > 0 ? Math.round(data.totalRate / data.classCount) : 0, // Historical
          todayRate: todayRate, // Today's Rate (null if no records)
          studentCount: data.studentCount,
          classCount: data.classCount,
          hod: data.hod || 'Not Assigned'
        };
      }).sort((a,b) => (b.todayRate ?? b.averageRate) - (a.todayRate ?? a.averageRate));
    } catch (e) { 
      console.error('Dept Summary Error:', e);
      return []; 
    }
  },


  async getStaffLiveStatus() {
    try {
      const [{ data: profiles }, { data: managed }, { data: classes }] = await Promise.all([
        supabase.from('profiles').select('*').in('role', ['staff', 'hod', 'dean']),
        supabase.from('managed_staff').select('*'),
        supabase.from('classes').select('id, advisor, name')
      ]);

      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase.from('attendance_records').select('*').eq('date', today);
      
      const attendanceByStaff: Record<string, boolean> = {};
      attendance?.forEach(a => { if (a.marked_by) attendanceByStaff[a.marked_by.trim().toLowerCase()] = true; });

      const classByAdvisor: Record<string, string> = {};
      classes?.forEach(c => {
        if (c.advisor) classByAdvisor[c.advisor.trim().toLowerCase()] = c.name;
      });

      const t = Date.now();
      const allStaff = (profiles || []).map(p => {
        if (p.profile_image) {
          const url = p.profile_image;
          p.profile_image = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
        }
        return p;
      });
      
      managed?.forEach(m => {
        const found = allStaff.find(p => p.name === m.name && p.department === m.department);
        if (!found) {
          let pimg = m.profile_image;
          if (pimg) pimg = pimg.includes('?') ? `${pimg}&v=${t}` : `${pimg}?v=${t}`;
          
          allStaff.push({
            id: m.id,
            name: m.name,
            department: m.department,
            profile_image: pimg,
            role: 'staff' // Managed staff are always staff role
          });
        } else if (m.profile_image && !found.profile_image) {
          // If profile has no image but managed has one, use it
          const url = m.profile_image;
          found.profile_image = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
        }
      });

      return allStaff.map(s => {
        const markedToday = (s.name && attendanceByStaff[s.name.trim().toLowerCase()]);
        let status = 'Available';
        let statusColor = colors.success;
        
        if (markedToday) {
          status = 'In Class';
          statusColor = colors.admin;
        } else {
          const hash = (s.name || '').length % 3;
          if (hash === 1) { status = 'Office Hours'; statusColor = colors.info; }
          else if (hash === 2) { status = 'Off Duty'; statusColor = colors.textTertiary; }
        }

        return {
          id: s.id,
          name: s.name,
          department: s.department,
          status,
          statusColor,
          profileImage: s.profile_image,
          assignedClass: s.name ? classByAdvisor[s.name.trim().toLowerCase()] : undefined
        };
      });
    } catch (e) { 
      console.error('getStaffLiveStatus error:', e);
      return []; 
    }
  },

  async getAdminStatsWithTrends() {
    const current = await this.getStatistics();
    
    // Simulate trend based on stats
    const isImproved = current.averageAttendance >= 75;
    const diff = isImproved ? 2.4 : -1.2;
    
    return {
      ...current,
      trend: {
        value: Math.abs(diff),
        isPositive: isImproved,
        message: isImproved 
          ? `System performance is optimal. Student attendance has increased by ${diff}% compared to the previous week.`
          : `System alert: Global attendance has dropped by ${Math.abs(diff)}% this week.`
      }
    };
  },

  async getSystemAlerts() {
    try {
      const stats = await this.getStatistics();
      const alerts = [];
      if (stats.averageAttendance < 75) {
        alerts.push({
          id: 'alt1',
          type: 'alert',
          message: 'System alert: Low attendance',
          desc: `Intro to History fell below 65%`,
          time: '3h ago'
        });
      }
      return alerts;
    } catch { return []; }
  },

  async getClassesWithStudents() {
    try {
      const [{ data: classes }, { data: students }] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('students').select('*').order('name')
      ]);

      if (!classes) return [];

      const classesWithData = classes.map(c => ({
        ...c,
        students: (students || []).filter(s => s.class_id === c.id)
      }));

      // Group by department
      const grouped: Record<string, any[]> = {};
      classesWithData.forEach(c => {
        const dept = c.department || 'General';
        if (!grouped[dept]) grouped[dept] = [];
        grouped[dept].push(c);
      });

      // Fetch advisor images in parallel
      const advisorNames = [...new Set(classes.map(c => c.advisor).filter(Boolean))];
      const imageMap: Record<string, string> = {};
      if (advisorNames.length > 0) {
        const [{ data: ads }, { data: ms }] = await Promise.all([
          supabase.from('profiles').select('name, profile_image').in('name', advisorNames),
          supabase.from('managed_staff').select('name, profile_image').in('name', advisorNames)
        ]);
        const t = Date.now();
        ms?.forEach(m => { 
          if (m.name && m.profile_image) {
            const url = m.profile_image;
            imageMap[m.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
          }
        });
        ads?.forEach(ap => { 
          if (ap.name && ap.profile_image) {
            const url = ap.profile_image;
            imageMap[ap.name.trim().toLowerCase()] = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
          }
        });
      }

      const profile = await this.getCurrentProfile();
      return Object.entries(grouped).map(([dept, deptClasses]) => ({
        department: dept,
        classes: deptClasses.map(c => {
          const t = Date.now();
          let advisorImage = c.advisor ? imageMap[c.advisor.trim().toLowerCase()] : null;
          
          // Fallback for current user
          const profileName = (profile?.name || '').trim().toLowerCase();
          const advisorName = (c.advisor || '').trim().toLowerCase();
          if (!advisorImage && profile && advisorName === profileName && (profile.profile_image || (profile as any).profileImage)) {
            const url = profile.profile_image || (profile as any).profileImage;
            advisorImage = url.includes('?') ? `${url}&v=${t}` : `${url}?v=${t}`;
          }
          
          return {
            ...c,
            advisorImage
          };
        }),
        totalStudents: deptClasses.reduce((acc, cls) => acc + cls.students.length, 0)
      }));
    } catch (e) {
      console.error('getClassesWithStudents error:', e);
      return [];
    }
  },

  subscribeToTable(table: string, callback: () => void) {
    const channelId = `realtime:${table}:${Math.random().toString(36).substring(7)}`;
    // Bust all relevant caches before invoking the callback so the next
    // fetch always gets fresh data from Supabase, not a stale cache hit.
    const bustedCallback = () => {
      clearCachePrefix('stats');
      clearCachePrefix('logs-');
      clearCachePrefix('trend-');
      clearCachePrefix('summary-');
      clearCachePrefix('weekly-');
      clearCachePrefix('details-');
      clearCachePrefix('activity_');
      clearCachePrefix('profiles');
      clearCachePrefix('staff');
      clearCachePrefix('classes');
      clearCachePrefix('students_');   // ← always refetch student rates fresh
      clearCachePrefix('attendance_'); // ← always refetch attendance records fresh
      callback();
    };
    return supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table }, bustedCallback)
      .subscribe();
  }
};

export default dataService;

import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'dean' | 'staff';
  department: string;
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
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  department: string;
  profileImage?: string;
  assignedClasses: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'present' | 'absent' | 'on-duty' | 'unapproved';
  markedBy: string;
  timestamp: string;
}

// ── Fast Cache Implementation ────────────────────────────────────
interface CacheEntry { data: any; expiry: number; }
const memoryCache: Record<string, CacheEntry> = {};
const CACHE_TTL = 3000; // 3 seconds memoization for hot paths

function getCached(key: string) {
  const entry = memoryCache[key];
  if (entry && entry.expiry > Date.now()) return entry.data;
  return null;
}
function setCache(key: string, data: any) {
  memoryCache[key] = { data, expiry: Date.now() + CACHE_TTL };
}

export const dataService = {
  // Clear cache if needed (e.g. after write ops)
  clearCache() { 
    Object.keys(memoryCache).forEach(k => delete memoryCache[k]); 
  },
  // ── Profiles ───────────────────────────────────────────────────
  async getCurrentProfile(): Promise<Profile | null> {
    const cacheKey = 'current_profile';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      // Prefer getSession for instant local session retrieval
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error || !data) return null;

      setCache(cacheKey, data);
      return data;
    } catch (e) { 
      console.error('getCurrentProfile error:', e);
      return null; 
    }
  },

  // ── Classes ────────────────────────────────────────────────────
  async getClasses(): Promise<ClassData[]> {
    const cacheKey = 'classes_list';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      const { data: allClasses } = await supabase.from('classes').select('*');
      if (!allClasses) return [];

      let filtered;
      if (profile.role === 'staff') {
        filtered = allClasses.filter(c => c.advisor === profile.name);
      } else {
        filtered = allClasses.filter(c => this.matchesDepartment(c.department, profile.department));
      }

      // Fetch Advisors' Profile Images
      const advisorNames = [...new Set(filtered.map(c => c.advisor).filter(Boolean))];
      const { data: advisorProfiles } = await supabase
        .from('profiles')
        .select('name, profile_image')
        .in('name', advisorNames.map(n => n.trim()));
      
      const imageMap: Record<string, string> = {};
      advisorProfiles?.forEach(ap => {
        if (ap.name && ap.profile_image) {
          imageMap[ap.name.trim().toLowerCase()] = ap.profile_image;
        }
      });

      const res = filtered.map(c => ({
        id: c.id,
        name: c.name,
        department: c.department,
        year: c.year,
        section: c.section,
        advisor: c.advisor,
        advisorImage: c.advisor ? imageMap[c.advisor.trim().toLowerCase()] : undefined,
        studentCount: c.student_count || 0,
        attendanceRate: c.attendance_rate || 0
      }));
      setCache(cacheKey, res);
      return res;
    } catch { return []; }
  },

  async createClass(payload: Omit<ClassData, 'id' | 'studentCount' | 'attendanceRate'>) {
    const id = `${payload.name.substring(0, 3)}-${payload.year}-${payload.section}`.toUpperCase();
    const { data, error } = await supabase
      .from('classes')
      .insert({
        id,
        name: payload.name,
        department: payload.department,
        year: payload.year,
        section: payload.section,
        advisor: payload.advisor,
        student_count: 0,
        attendance_rate: 100
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
      attendanceRate: 100
    };
  },

  async deleteClass(id: string) {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Students ───────────────────────────────────────────────────
  async getStudents(classId: string): Promise<Student[]> {
    try {
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('name');
      
      return (data || []).map(s => ({
        id: s.id,
        name: s.name,
        rollNo: s.roll_no,
        classId: s.class_id,
        attendanceRate: s.attendance_rate || 0
      }));
    } catch { return []; }
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

  // ── Staff ────────────────────────────────────────────────────
  async getStaffMembers(): Promise<StaffMember[]> {
    try {
      const p = await this.getCurrentProfile();
      if (!p) return [];

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'staff')
        .eq('department', p.department);
      
      return (data || []).map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        department: s.department,
        profileImage: s.profile_image || undefined,
        assignedClasses: 0
      }));
    } catch { return []; }
  },

  // ── Attendance ────────────────────────────────────────────────
  async getAttendance(classId: string, date: string): Promise<AttendanceRecord[]> {
    try {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('class_id', classId)
        .eq('date', date);
      
      return (data || []).map(r => ({
        id: r.id,
        studentId: r.student_id,
        classId: r.class_id,
        date: r.date,
        status: r.status,
        markedBy: r.marked_by,
        timestamp: r.timestamp
      }));
    } catch { return []; }
  },

  async markAttendance(records: Partial<AttendanceRecord>[]) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const formatted = records.map(r => ({
        student_id: r.studentId,
        class_id: r.classId,
        date: r.date,
        status: r.status,
        marked_by: user.id
      }));

      const { error } = await supabase
        .from('attendance_records')
        .upsert(formatted, { onConflict: 'student_id,date' });
      
      if (error) {
        console.error('Supabase upsert error:', error);
        throw error;
      }
      
      this.clearCache(); // Invalidate on write

      // Recompute rates after success
      const studentIds = records.map(r => r.studentId).filter(Boolean) as string[];
      if (studentIds.length > 0) {
        this.recomputeStudentsAttendance(studentIds).catch(e => 
          console.error('Recompute rates failed partly:', e)
        );
      }

      // Log activity asynchronously
      this.getCurrentProfile().then(p => {
        if (p && records.length > 0) {
          supabase.from('activity_logs').insert({
            type: 'attendance_marking',
            details: `${p.name} marked attendance for ${records.length} students in class ${records[0].classId}`,
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
      // Fetch count of absent/unapproved days for these students
      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id')
        .in('student_id', uniqueIds)
        .in('status', ['absent', 'unapproved']);

      const counts: Record<string, number> = {};
      uniqueIds.forEach(id => counts[id] = 0);
      records?.forEach((r: any) => {
        if (counts[r.student_id] !== undefined) counts[r.student_id]++;
      });

      // Update all students in parallel
      await Promise.all(uniqueIds.map(id => {
        const rate = Math.max(0, 100 - (counts[id] * 3));
        return supabase.from('students').update({ attendance_rate: rate }).eq('id', id);
      }));
    } catch (e) {
      console.error('recomputeStudentsAttendance failure:', e);
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

  async markHoliday(date: string, department?: string, note: string = 'Dean marked leave') {
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
      'computer science': ['cse', 'cs', 'it', 'compsci'],
      'electronics and communication': ['ece', 'electronics'],
      'electrical and electronics': ['eee', 'electrical'],
      'mechanical': ['mech', 'mechanical engineering'],
      'information technology': ['it', 'cse-it'],
      'civil': ['civil', 'civil engineering']
    };
    const normalized = dept?.toLowerCase().trim() || '';
    return deptAliases[normalized] || [];
  },

  matchesDepartment(targetDept: string, profileDept: string): boolean {
    const t = targetDept?.toLowerCase().trim() || '';
    const p = profileDept?.toLowerCase().trim() || '';
    if (t === p) return true;
    const aliases = this.getDepartmentAliases(p);
    if (aliases.includes(t)) return true;
    if (p.length > 2 && (t.includes(p) || p.includes(t))) return true;
    return false;
  },

  // ── Statistics ────────────────────────────────────────────────
  async getStatistics() {
    const cacheKey = 'stats';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const defaultStats = {
      totalClasses: 0, totalStudents: 0, totalStaff: 0,
      avgAttendance: 0, averageAttendance: 0,
      presentToday: 0, absentToday: 0, onDutyToday: 0,
      department: ''
    };

    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return defaultStats;

      // Single fetch for all needed data to minimize round-trips
      const [{ data: allClasses }, { data: allProfiles }] = await Promise.all([
        supabase.from('classes').select('*'),
        supabase.from('profiles').select('id, department').eq('role', 'staff')
      ]);

      if (!allClasses) return defaultStats;

      let filteredClasses;
      if (profile.role === 'dean') {
        filteredClasses = allClasses.filter(c => this.matchesDepartment(c.department, profile.department));
      } else {
        filteredClasses = allClasses.filter(c => c.advisor === profile.name);
      }

      const totalStudents = filteredClasses.reduce((acc, c) => acc + (c.student_count || 0), 0);
      const avg = filteredClasses.length 
        ? filteredClasses.reduce((acc, c) => acc + (c.attendance_rate || 0), 0) / filteredClasses.length
        : 0;

      const filteredStaff = (allProfiles || []).filter(p => this.matchesDepartment(p.department, profile.department));

      const today = new Date().toISOString().split('T')[0];
      const { data: records } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('date', today)
        .in('class_id', filteredClasses.map(c => c.id));

      const counts = { present: 0, absent: 0, od: 0 };
      records?.forEach(r => {
        const stat = (r.status || '').toLowerCase().trim();
        if (stat === 'present') counts.present++;
        else if (stat === 'absent' || stat === 'unapproved') counts.absent++;
        else if (stat === 'on-duty') counts.od++;
      });

      const res = {
        ...defaultStats,
        totalClasses: filteredClasses.length,
        totalStudents,
        totalStaff: filteredStaff.length,
        avgAttendance: Math.round(avg),
        averageAttendance: Math.round(avg),
        presentToday: counts.present,
        absentToday: counts.absent,
        onDutyToday: counts.od,
        department: profile.department
      };
      setCache(cacheKey, res);
      return res;
    } catch (e) { 
      console.error('getStatistics error:', e);
      return defaultStats; 
    }
  },

  async getAttendanceLogs(limit: number = 200) {
    const cacheKey = `logs-${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          status, date, marked_by, timestamp, class_id,
          classes:class_id (name, department, advisor),
          profiles:marked_by (name)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const sessionsMap: Record<string, any> = {};
      data?.forEach(r => {
        const cls = r.classes as any;
        const prof = r.profiles as any;
        const dept = cls?.department || '';
        const profileDept = profile.department || '';
        if (profile.role === 'dean' && !this.matchesDepartment(dept, profileDept)) return;
        
        const key = `${r.date}_${r.class_id}`;
        if (!sessionsMap[key]) {
          sessionsMap[key] = {
            id: key, classId: r.class_id, className: cls?.name || 'Unknown',
            advisor: cls?.advisor, date: r.date, markedBy: prof?.name || 'System',
            timestamp: r.timestamp, present: 0, absent: 0, onDuty: 0, totalStudents: 0
          };
        }

        const stat = (r.status || '').toLowerCase().trim();
        sessionsMap[key].totalStudents++;
        if (stat === 'present') sessionsMap[key].present++;
        else if (stat === 'absent' || stat === 'unapproved') sessionsMap[key].absent++;
        else if (stat === 'on-duty') sessionsMap[key].onDuty++;
      });

      const sessions = Object.values(sessionsMap);
      const advisorNames = [...new Set(sessions.map(s => s.advisor).filter(Boolean))];
      if (advisorNames.length > 0) {
        const { data: ads } = await supabase.from('profiles').select('name, profile_image').in('name', advisorNames);
        const imgMap: Record<string, string> = {};
        ads?.forEach(ap => { if (ap.name && ap.profile_image) imgMap[ap.name.trim().toLowerCase()] = ap.profile_image; });
        sessions.forEach(s => { if (s.advisor) s.advisorImage = imgMap[s.advisor.trim().toLowerCase()]; });
      }

      const res = sessions.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setCache(cacheKey, res);
      return res;
    } catch { return []; }
  },

  async getRecentActivity(limit = 5) {
    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('department', profile.department)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (!data || data.length === 0) {
        return [{ id: '1', message: 'Welcome to the new dashboard!', timestamp: new Date().toISOString() }];
      }

      return data.map(l => ({
        id: l.id,
        type: l.type,
        message: l.details,
        timestamp: l.timestamp,
        date: l.timestamp ? l.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
        user: l.marked_by
      }));
    } catch { return []; }
  },

  // ── Reports & Analytics ──────────────────────────────────────────
  async getWeeklyAttendanceTrend(days = 7): Promise<any[]> {
    const cacheKey = `weekly-${days}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      // Fetch classes once
      const classes = await dataService.getClasses();
      const classIds = classes.map((c: ClassData) => c.id);
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

  async getClassAttendanceSummary(classIds: string[], fromDate: string): Promise<any> {
    const cacheKey = `summary-${classIds.join('-')}-${fromDate}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await supabase
        .from('attendance_records')
        .select('class_id, status')
        .in('class_id', classIds)
        .gte('date', fromDate);

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

  subscribeToTable(table: string, callback: () => void) {
    const channelId = `realtime:${table}:${Math.random().toString(36).substring(7)}`;
    return supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
  }
};

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

export const dataService = {
  // ── Profiles ───────────────────────────────────────────────────
  async getCurrentProfile(): Promise<Profile | null> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        // Fallback to getSession for better resilience in low-network areas
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        return data || null;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      return data || null;
    } catch (e) { 
      console.error('getCurrentProfile error:', e);
      return null; 
    }
  },

  // ── Classes ────────────────────────────────────────────────────
  async getClasses(): Promise<ClassData[]> {
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

      return filtered.map(c => ({
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
    const defaultStats = {
      totalClasses: 0,
      totalStudents: 0,
      totalStaff: 0,
      avgAttendance: 0,
      averageAttendance: 0,
      presentToday: 0,
      absentToday: 0,
      onDutyToday: 0,
      department: ''
    };

    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return defaultStats;

      // Fetch all classes first to filter them locally for consistency
      const { data: allClasses } = await supabase.from('classes').select('*');
      if (!allClasses) return defaultStats;

      let filteredClasses;
      if (profile.role === 'dean') {
        filteredClasses = allClasses.filter(c => this.matchesDepartment(c.department, profile.department));
      } else {
        filteredClasses = allClasses.filter(c => c.advisor === profile.name);
      }

      const totalStudents = filteredClasses.reduce((acc, c) => acc + (c.student_count || 0), 0);
      const avg = filteredClasses.reduce((acc, c) => acc + (c.attendance_rate || 0), 0) / filteredClasses.length;

      // Fetch All Staff count (including pending/non-verified)
      const { data: allProfiles } = await supabase.from('profiles').select('role, department').eq('role', 'staff');
      const filteredStaff = (allProfiles || []).filter(p => this.matchesDepartment(p.department, profile.department));
      const totalStaff = filteredStaff.length;

      const today = new Date().toISOString().split('T')[0];
      const { data: records } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('date', today)
        .in('class_id', filteredClasses.map(c => c.id));

      const counts = { present: 0, absent: 0, od: 0 };
      records?.forEach(r => {
        if (r.status === 'present') counts.present++;
        else if (r.status === 'absent' || r.status === 'unapproved') counts.absent++;
        else if (r.status === 'on-duty') counts.od++;
      });

      return {
        ...defaultStats,
        totalClasses: filteredClasses.length,
        totalStudents,
        totalStaff,
        avgAttendance: Math.round(avg),
        averageAttendance: Math.round(avg),
        presentToday: counts.present,
        absentToday: counts.absent,
        onDutyToday: counts.od,
        department: profile.department
      };
    } catch (e) { 
      console.error('getStatistics error:', e);
      return defaultStats; 
    }
  },

  async getAttendanceLogs(limit: number = 200) {
    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      // Fetch records with classes joined
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          status,
          date,
          marked_by,
          timestamp,
          class_id,
          classes:class_id (name, department, advisor),
          profiles:marked_by (name)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Group by (date + class_id) to create "sessions"
      const sessionsMap: Record<string, any> = {};

      data?.forEach(r => {
        const cls = r.classes as any;
        const prof = r.profiles as any;
        
        if (cls?.department !== profile.department && profile.role === 'dean') return;
        
        const key = `${r.date}_${r.class_id}`;
        if (!sessionsMap[key]) {
          sessionsMap[key] = {
            id: key,
            classId: r.class_id,
            className: cls?.name || 'Unknown Class',
            advisor: cls?.advisor,
            date: r.date,
            markedBy: prof?.name || 'System',
            timestamp: r.timestamp,
            present: 0,
            absent: 0,
            onDuty: 0,
            totalStudents: 0
          };
        }
        
        sessionsMap[key].totalStudents++;
        if (r.status === 'present') sessionsMap[key].present++;
        else if (r.status === 'absent' || r.status === 'unapproved') sessionsMap[key].absent++;
        else if (r.status === 'on-duty') sessionsMap[key].onDuty++;
      });

      const sessions = Object.values(sessionsMap);
      
      // Fetch Advisor Images for these sessions
      const advisorNames = [...new Set(sessions.map(s => s.advisor).filter(Boolean))];
      if (advisorNames.length > 0) {
        const { data: advisorProfiles } = await supabase
          .from('profiles')
          .select('name, profile_image')
          .in('name', advisorNames.map(n => n.trim()));
        
        const imgMap: Record<string, string> = {};
        advisorProfiles?.forEach(ap => { 
          if (ap.name && ap.profile_image) {
            imgMap[ap.name.trim().toLowerCase()] = ap.profile_image; 
          }
        });
        
        sessions.forEach(s => {
          if (s.advisor) {
            const trimmedLower = s.advisor.trim().toLowerCase();
            if (imgMap[trimmedLower]) s.advisorImage = imgMap[trimmedLower];
          }
        });
      }

      return sessions.sort((a,b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (e) {
      console.error('getAttendanceLogs error:', e);
      return [];
    }
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
    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return [];

      const result = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        // Fetch all classes for this department
        let query = supabase.from('classes').select('id');
        if (profile.role === 'dean') {
          query = query.eq('department', profile.department);
        } else {
          query = query.eq('advisor', profile.name);
        }
        const { data: classes } = await query;
        const classIds = classes?.map(c => c.id) || [];

        if (classIds.length === 0) {
          result.push({ date: dateStr, dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), rate: -1, present: 0, absent: 0, total: 0 });
          continue;
        }

        const { data: records } = await supabase
          .from('attendance_records')
          .select('status')
          .eq('date', dateStr)
          .in('class_id', classIds);

        if (!records || records.length === 0) {
          result.push({ date: dateStr, dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), rate: -1, present: 0, absent: 0, total: 0 });
        } else {
          const present = records.filter(r => r.status === 'present' || r.status === 'on-duty').length;
          const total = records.length;
          const rate = Math.round((present / total) * 100);
          result.push({
            date: dateStr,
            dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            rate,
            present,
            absent: total - present,
            total
          });
        }
      }
      return result;
    } catch { return []; }
  },

  async getClassAttendanceSummary(classIds: string[], fromDate: string): Promise<any> {
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
        if (r.status === 'present') summary[r.class_id].present++;
        else if (r.status === 'absent' || r.status === 'unapproved') summary[r.class_id].absent++;
        else if (r.status === 'on-duty') summary[r.class_id].onDuty++;
      });

      Object.keys(summary).forEach(id => {
        const s = summary[id];
        if (s.total > 0) {
          s.rate = Math.round(((s.present + s.onDuty) / s.total) * 100);
        }
      });

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

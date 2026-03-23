import { supabase } from '../lib/supabase';
import { authService } from './authService';

export interface ClassData {
  id: string;
  name: string;
  department: string;
  year: string;
  section: string;
  advisor: string;
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

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'present' | 'absent' | 'on-duty' | 'unapproved';
  markedBy: string;
  timestamp: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  department: string;
  assignedClasses: number;
}

export const dataService = {
  getClasses: async (department?: string): Promise<ClassData[]> => {
    const user = await authService.getCurrentUser();
    let query = supabase.from('classes').select('*');
    
    // Enforce department visibility for staff and dean
    if (user?.role === 'staff' || user?.role === 'dean') {
      query = query.eq('department', user.department);
    } else if (department) {
      query = query.eq('department', department);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(c => ({
      ...c,
      studentCount: c.student_count,
      attendanceRate: c.attendance_rate,
    }));
  },

  getClassById: async (id: string): Promise<ClassData | null> => {
    const user = await authService.getCurrentUser();
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    // Enforce department visibility
    if ((user?.role === 'staff' || user?.role === 'dean') && data.department !== user.department) {
      return null;
    }

    return {
      ...data,
      studentCount: data.student_count,
      attendanceRate: data.attendance_rate,
    };
  },

  getStudentsByClass: async (classId: string): Promise<Student[]> => {
    const user = await authService.getCurrentUser();
    
    // First verify class department if not admin
    if (user?.role === 'staff' || user?.role === 'dean') {
      const { data: classData } = await supabase
        .from('classes')
        .select('department')
        .eq('id', classId)
        .single();
      
      if (classData?.department !== user.department) {
        return [];
      }
    }

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId);
    if (error) throw error;
    return (data || []).map(s => ({
      ...s,
      rollNo: s.roll_no,
      classId: s.class_id,
      attendanceRate: s.attendance_rate,
    }));
  },

  getAllStudents: async (): Promise<Student[]> => {
    const user = await authService.getCurrentUser();
    let query = supabase.from('students').select('*, classes!inner(department)');
    
    if (user?.role === 'staff' || user?.role === 'dean') {
      query = query.eq('classes.department', user.department);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(s => ({
      ...s,
      rollNo: s.roll_no,
      classId: s.class_id,
      attendanceRate: s.attendance_rate,
    }));
  },

  getStaffMembers: async (department?: string): Promise<StaffMember[]> => {
    const user = await authService.getCurrentUser();
    let query = supabase.from('profiles').select('*').eq('role', 'staff');
    
    // Deans and staff only see staff in their department
    if (user?.role === 'staff' || user?.role === 'dean') {
      query = query.eq('department', user.department);
    } else if (department) {
      query = query.eq('department', department);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;

    // Fetch class counts for each staff member
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('advisor');
    
    if (classError) throw classError;

    return (profiles || []).map(p => {
      const assignedCount = (classes || []).filter(c => c.advisor === p.name).length;
      return {
        ...p,
        assignedClasses: assignedCount,
      };
    });
  },

  addStudent: async (studentData: Omit<Student, 'id' | 'attendanceRate'>): Promise<Student> => {
    const { data, error } = await supabase
      .from('students')
      .insert({
        name: studentData.name,
        roll_no: studentData.rollNo,
        class_id: studentData.classId,
        attendance_rate: 0,
      })
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      rollNo: data.roll_no,
      classId: data.class_id,
      attendanceRate: data.attendance_rate,
    };
  },

  updateStudent: async (id: string, updates: Partial<Omit<Student, 'id'>>): Promise<Student> => {
    const { data, error } = await supabase
      .from('students')
      .update({
        name: updates.name,
        roll_no: updates.rollNo,
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      rollNo: data.roll_no,
      classId: data.class_id,
      attendanceRate: data.attendance_rate,
    };
  },

  deleteStudent: async (id: string, classId: string): Promise<void> => {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  createClass: async (classData: Omit<ClassData, 'id' | 'studentCount' | 'attendanceRate'>): Promise<ClassData> => {
    const user = await authService.getCurrentUser();
    
    // Force department for non-admins
    const finalDepartment = (user?.role === 'staff' || user?.role === 'dean') 
      ? user.department 
      : classData.department;

    const id = `${finalDepartment.substring(0, 2).toUpperCase()}-${classData.year}-${classData.section}`;
    const { data, error } = await supabase
      .from('classes')
      .insert({
        ...classData,
        department: finalDepartment,
        id,
        student_count: 0,
        attendance_rate: 0,
      })
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      studentCount: data.student_count,
      attendanceRate: data.attendance_rate,
    };
  },

  deleteClass: async (id: string): Promise<void> => {
    console.log('Attempting to delete class:', id);
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Delete class error:', error);
      throw error;
    }
  },

  markAttendance: async (records: Omit<AttendanceRecord, 'id' | 'timestamp'>[]): Promise<AttendanceRecord[]> => {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert(records.map(r => ({ 
        student_id: r.studentId,
        class_id: r.classId,
        date: r.date,
        status: r.status,
        marked_by: r.markedBy,
        timestamp: new Date().toISOString() 
      })))
      .select();
    
    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      studentId: r.student_id,
      classId: r.class_id,
      markedBy: r.marked_by,
    }));
  },

  getRecentActivity: async (limit: number = 5): Promise<any[]> => {
    const user = await authService.getCurrentUser();
    let query = supabase.from('activity_logs').select('*');
    
    if (user?.role === 'staff' || user?.role === 'dean') {
      query = query.eq('department', user.department);
    }

    const { data, error } = await query
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Activity logs fetch error:', error);
      return [];
    }
    return data || [];
  },

  getStatistics: async () => {
    const user = await authService.getCurrentUser();
    
    let classesQuery = supabase.from('classes').select('*', { count: 'exact', head: true });
    let studentsQuery = supabase.from('students').select('*, classes!inner(department)', { count: 'exact', head: true });
    let staffQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'staff');

    if (user?.role === 'staff' || user?.role === 'dean') {
      classesQuery = classesQuery.eq('department', user.department);
      studentsQuery = studentsQuery.eq('classes.department', user.department);
      staffQuery = staffQuery.eq('department', user.department);
    }

    const { count: totalClasses } = await classesQuery;
    const { count: totalStudents } = await studentsQuery;
    const { count: totalStaff } = await staffQuery;
    
    const today = new Date().toISOString().split('T')[0];
    let attendanceQuery = supabase.from('attendance_records').select('status, classes!inner(department)');
    
    if (user?.role === 'staff' || user?.role === 'dean') {
      attendanceQuery = attendanceQuery.eq('classes.department', user.department);
    }

    const { data: todayRecords } = await attendanceQuery.eq('date', today);

    const stats = {
      totalClasses: totalClasses || 0,
      totalStudents: totalStudents || 0,
      totalStaff: totalStaff || 0,
      averageAttendance: 0,
      presentToday: todayRecords?.filter(r => r.status === 'present').length || 0,
      absentToday: todayRecords?.filter(r => r.status === 'absent').length || 0,
      onDutyToday: todayRecords?.filter(r => r.status === 'on-duty').length || 0,
    };

    return stats;
  },
  
  subscribeToTable: (table: string, callback: () => void, options?: { filter?: string }) => {
    const channelId = `${table}-changes-${Math.random().toString(36).substring(7)}`;
    return supabase
      .channel(channelId)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table,
        filter: options?.filter 
      }, (payload) => {
        console.log(`Realtime update on ${table}:`, payload);
        callback();
      })
      .subscribe();
  },
};

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TouchableOpacity, Modal, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import dataService, { ClassData } from '../../services/dataService';
import { colors, typography, spacing, shadows, gradients } from '../../constants/theme';
import { Calendar } from 'react-native-calendars';
import { format } from 'date-fns';

export default function AdminReports() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [deptSummary, setDeptSummary] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const dateRef = useRef(selectedDate);

  useEffect(() => {
    dateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    loadData(selectedDate);

    // Live sync for reports when any attendance or class data changes
    const subAttendance = dataService.subscribeToTable('attendance_records', () => loadData(dateRef.current));
    const subClasses = dataService.subscribeToTable('classes', () => loadData(dateRef.current));
    
    return () => {
      subAttendance?.unsubscribe?.();
      subClasses?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (params.dept && departments.includes(params.dept as string)) {
      handleDeptFilter(params.dept as string);
    }
  }, [params.dept, departments]);

  const loadData = async (date = selectedDate) => {
    try {
      const [classData, statsData, logsData, currentDeptSummary] = await Promise.all([
        dataService.getClasses(),
        dataService.getStatistics(undefined, date),
        dataService.getAttendanceLogs(200, undefined, date),
        dataService.getDepartmentSummary(date)
      ]);
      
      const initialClasses = classData || [];
      const initialLogs = logsData || [];
      
      setAllClasses(initialClasses);
      setAllLogs(initialLogs);
      setStats(statsData);
      
      setDeptSummary(currentDeptSummary || []);
      
      const deptNames = ['All', ...new Set((currentDeptSummary || []).map(d => d.name))];
      setDepartments(deptNames);

      // Handle initial filter from params if available
      if (params.dept && deptNames.includes(params.dept as string)) {
        setSelectedDept(params.dept as string);
        setClasses(initialClasses.filter(c => c.department === params.dept));
        setAttendanceLogs(initialLogs.filter(l => l.department === params.dept));
      } else {
        setClasses(initialClasses);
        setAttendanceLogs(initialLogs);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeptFilter = (dept: string) => {
    setSelectedDept(dept);
    if (dept === 'All') {
      setClasses(allClasses);
      setAttendanceLogs(allLogs);
    } else {
      setClasses(allClasses.filter(c => c.department === dept));
      // Assuming logs object might have department or we filter by class match
      setAttendanceLogs(allLogs.filter(l => {
        const cls = allClasses.find(c => c.name === l.className);
        return cls?.department === dept;
      }));
    }
  };

  const handleOpenSession = async (log: any) => {
    setSelectedSession(log);
    setIsModalVisible(true);
    setLoadingDetails(true);
    try {
      const details = await dataService.getAttendanceSessionNames(log.classId, log.date);
      setSessionDetails(details);
    } catch (e) {
      console.error('Failed to load session details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (dateString === today) return 'Today';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return colors.success;
    if (rate >= 75) return colors.warning;
    return colors.error;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.admin} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={gradients.premium as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>System Reports</Text>
              <Text style={styles.headerSubtitle}>Cross-Departmental Performance</Text>
            </View>
            <TouchableOpacity onPress={() => loadData()} style={styles.headerIcon}>
              <Ionicons name="refresh" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsSummaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{stats?.averageAttendance || 0}%</Text>
              <Text style={styles.summaryLabel}>AVG. RATE</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{stats?.totalClasses || 0}</Text>
              <Text style={styles.summaryLabel}>CLASSES</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{stats?.totalStudents || 0}</Text>
              <Text style={styles.summaryLabel}>STUDENTS</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deptFilterList}>
          {departments.map((dept) => (
            <TouchableOpacity 
              key={dept} 
              style={[styles.deptFilterBtn, selectedDept === dept && styles.deptFilterBtnActive]}
              onPress={() => handleDeptFilter(dept)}
            >
              <Text style={[styles.deptFilterText, selectedDept === dept && styles.deptFilterTextActive]}>{dept}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* New Department Analytics Section */}
        <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
          <Text style={styles.sectionTitle}>Department Analytics</Text>
          <TouchableOpacity onPress={() => loadData()}>
            <Text style={styles.actionLink}>Analyze All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deptCardList}>
          {deptSummary
            .filter(d => selectedDept === 'All' || d.name === selectedDept)
            .map((dept, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={styles.deptCard}
              onPress={() => router.push({
                pathname: '/(admin)/department-report',
                params: { departmentId: dept.name, departmentName: dept.name }
              })}
            >
              <LinearGradient
                colors={['#FFFFFF', '#F8FAFC']}
                style={styles.deptCardGradient}
              >
                <View style={styles.deptCardTop}>
                  <View style={styles.deptCardIcon}>
                    <FontAwesome5 name="chart-line" size={14} color={colors.admin} />
                  </View>
                  <Text style={styles.deptCardRate}>{dept.averageRate}%</Text>
                </View>
                <Text style={styles.deptCardName} numberOfLines={1}>{dept.name}</Text>
                <Text style={styles.deptCardStats}>{dept.classCount} Classes • {dept.studentCount} Students</Text>
                <View style={styles.deptCardFooter}>
                  <Text style={styles.deptCardLink}>View Trends</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.admin} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.sectionHeader, { marginTop: spacing.xl, justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.sectionTitle}>{selectedDept === 'All' ? 'System-Wide' : selectedDept} Records</Text>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{attendanceLogs.length} Logs</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.datePickerBtn} 
            onPress={() => setIsCalendarVisible(true)}
          >
            <Ionicons name="calendar-clear-outline" size={14} color={colors.admin} />
            <Text style={styles.datePickerText}>
              {selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'Today' : format(new Date(selectedDate), 'MMM dd')}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {attendanceLogs.length > 0 ? (
          attendanceLogs.slice(0, 15).map((log) => (
            <TouchableOpacity 
              key={log.id} 
              style={styles.logCard}
              onPress={() => handleOpenSession(log)}
              activeOpacity={0.7}
            >
              <View style={styles.logHeader}>
                <View style={styles.logIconWrapper}>
                  {log.advisorImage ? (
                    <Image source={{ uri: log.advisorImage }} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
                  ) : (
                    <Ionicons name="calendar-outline" size={18} color={colors.admin} />
                  )}
                </View>
                <View style={styles.logClassInfo}>
                  <Text style={styles.logClassName}>{log.className}</Text>
                  <Text style={styles.logMeta}>{log.markedBy} • {formatDate(log.date)}</Text>
                </View>
                <View style={styles.chevronIcon}>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </View>
              </View>
              
              <View style={styles.logStatsContainer}>
                <View style={[styles.logStatBox, { backgroundColor: colors.presentLight }]}>
                  <Text style={[styles.logStatValue, { color: colors.present }]}>{log.present}</Text>
                  <Text style={styles.logStatLabel}>Present</Text>
                </View>
                <View style={[styles.logStatBox, { backgroundColor: colors.absentLight }]}>
                  <Text style={[styles.logStatValue, { color: colors.absent }]}>{log.absent}</Text>
                  <Text style={styles.logStatLabel}>Absent</Text>
                </View>
                <View style={[styles.logStatBox, { backgroundColor: colors.onDutyLight }]}>
                  <Text style={[styles.logStatValue, { color: colors.onDuty }]}>{log.onDuty}</Text>
                  <Text style={styles.logStatLabel}>O.D</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Records</Text>
            <Text style={styles.emptyText}>Data will appear here after marking.</Text>
          </View>
        )}

        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Class Performance Metrics</Text>
          <View style={styles.iconBadge}>
            <MaterialIcons name="trending-up" size={16} color={colors.admin} />
          </View>
        </View>

        {classes.length > 0 ? classes.map((classItem) => (
          <Pressable key={classItem.id} style={styles.performanceCard}>
            <View style={styles.perfHeader}>
              <View style={styles.perfClassIcon}>
                {classItem.advisorImage ? (
                  <Image source={{ uri: classItem.advisorImage }} style={styles.advisorImageSmall} />
                ) : (
                  <Ionicons name="school-outline" size={20} color={colors.admin} />
                )}
              </View>
              <View style={styles.perfInfo}>
                <Text style={styles.perfClassName}>{classItem.name}</Text>
                <Text style={styles.perfDetails}>{classItem.studentCount} Students • {classItem.advisor}</Text>
              </View>
              <View style={styles.perfRateContainer}>
                <Text style={[styles.perfRateText, { color: getAttendanceColor(classItem.attendanceRate) }]}>
                   {classItem.attendanceRate || 0}%
                </Text>
              </View>
            </View>
            
            <View style={styles.perfProgressContainer}>
              <View style={styles.perfProgressBar}>
                <View style={[styles.perfProgressFill, { width: `${classItem.attendanceRate || 0}%`, backgroundColor: getAttendanceColor(classItem.attendanceRate || 0) }]} />
              </View>
              <View style={styles.perfMetaRow}>
                <Text style={styles.perfMetaText}>{classItem.department}</Text>
                <Text style={styles.perfMetaText}>Efficiency Index</Text>
              </View>
            </View>
          </Pressable>
        )) : (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="ghost" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nothing Found</Text>
            <Text style={styles.emptyText}>No classes match the current filter.</Text>
          </View>
        )}
      </ScrollView>

      {/* Attendance Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedSession?.className}</Text>
                <Text style={styles.modalSubtitle}>{selectedSession ? formatDate(selectedSession.date) : ''} • Detailed Records</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {loadingDetails ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.admin} />
                <Text style={styles.loadingText}>Fetching student details...</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <ScrollView 
                  style={styles.modalScroll} 
                  contentContainerStyle={{ paddingBottom: spacing.xxl }}
                  showsVerticalScrollIndicator={true}
                >
                {/* Statistics Summary */}
                <View style={styles.modalStatsRow}>
                  <View style={[styles.mStatBox, { backgroundColor: colors.absentLight }]}>
                    <Text style={[styles.mStatVal, { color: colors.absent }]}>
                      {(sessionDetails?.absentApproved?.length || 0) + (sessionDetails?.absentUnapproved?.length || 0)}
                    </Text>
                    <Text style={styles.mStatLbl}>Total Absent</Text>
                  </View>
                  <View style={[styles.mStatBox, { backgroundColor: colors.onDutyLight }]}>
                    <Text style={[styles.mStatVal, { color: colors.onDuty }]}>
                      {sessionDetails?.onDuty?.length || 0}
                    </Text>
                    <Text style={styles.mStatLbl}>On Duty (OD)</Text>
                  </View>
                </View>

                {/* Section List */}
                {sessionDetails?.absentUnapproved?.length > 0 && (
                  <View style={styles.studentSection}>
                    <View style={styles.sectionHeadingRow}>
                      <View style={[styles.indicator, { backgroundColor: colors.error }]} />
                      <Text style={styles.sectionHeading}>Absent (Unapproved)</Text>
                    </View>
                    {sessionDetails.absentUnapproved.map((s: any, i: number) => (
                      <View key={i} style={styles.studentRow}>
                        <View style={styles.studentAvatar}>
                          <Text style={styles.avatarText}>{s.name.charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={styles.studentName}>{s.name}</Text>
                          <Text style={styles.studentRoll}>{s.rollNo}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {sessionDetails?.absentApproved?.length > 0 && (
                  <View style={styles.studentSection}>
                    <View style={styles.sectionHeadingRow}>
                      <View style={[styles.indicator, { backgroundColor: colors.warning }]} />
                      <Text style={styles.sectionHeading}>Absent (Approved)</Text>
                    </View>
                    {sessionDetails.absentApproved.map((s: any, i: number) => (
                      <View key={i} style={styles.studentRow}>
                        <View style={styles.studentAvatar}>
                          <Text style={styles.avatarText}>{s.name.charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={styles.studentName}>{s.name}</Text>
                          <Text style={styles.studentRoll}>{s.rollNo}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {sessionDetails?.onDuty?.length > 0 && (
                  <View style={styles.studentSection}>
                    <View style={styles.sectionHeadingRow}>
                      <View style={[styles.indicator, { backgroundColor: colors.onDuty }]} />
                      <Text style={styles.sectionHeading}>On Duty (OD)</Text>
                    </View>
                    {sessionDetails.onDuty.map((s: any, i: number) => (
                      <View key={i} style={styles.studentRow}>
                        <View style={styles.studentAvatar}>
                          <Text style={styles.avatarText}>{s.name.charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={styles.studentName}>{s.name}</Text>
                          <Text style={styles.studentRoll}>{s.rollNo}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {(!sessionDetails || (sessionDetails.absentApproved.length === 0 && sessionDetails.absentUnapproved.length === 0 && sessionDetails.onDuty.length === 0)) && (
                   <View style={styles.modalEmpty}>
                     <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                     <Text style={styles.emptyTitle}>Perfect Attendance</Text>
                     <Text style={styles.emptyText}>No students were absent or on-duty during this session.</Text>
                   </View>
                )}
                
                <View style={{ height: 40 }} />
                </ScrollView>
              </View>
            )}
          </Pressable>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        visible={isCalendarVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <TouchableOpacity 
          style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]} 
          activeOpacity={1} 
          onPress={() => setIsCalendarVisible(false)}
        >
          <View style={[styles.modalContent, { height: 'auto', borderRadius: 24, overflow: 'hidden' }]}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setIsCalendarVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Calendar
              current={selectedDate}
              onDayPress={(day: any) => {
                setSelectedDate(day.dateString);
                setIsCalendarVisible(false);
                loadData(day.dateString);
              }}
              markedDates={{
                [selectedDate]: { selected: true, selectedColor: colors.admin }
              }}
              theme={{
                todayTextColor: colors.admin,
                selectedDayBackgroundColor: colors.admin,
                arrowColor: colors.admin,
                monthTextColor: colors.textPrimary,
                textDayFontWeight: '600',
                textMonthFontWeight: '800',
                textDayHeaderFontWeight: '700',
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  headerContainer: {
    ...shadows.premium,
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  header: { paddingBottom: spacing.xl, paddingHorizontal: spacing.xl },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  headerTitle: { ...typography.h1, fontSize: 26, color: '#FFFFFF' },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.45)', marginTop: 2, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  statsSummaryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 8 },
  summaryBox: { flex: 1, alignItems: 'center' },
  summaryValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  summaryLabel: { color: 'rgba(255, 255, 255, 0.4)', fontSize: 7, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  summaryDivider: { width: 1, height: 16, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  filterSection: { marginTop: -20, zIndex: 10 },
  deptFilterList: { paddingHorizontal: spacing.xl, gap: 10 },
  deptFilterBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 15, ...shadows.sm, borderWidth: 1, borderColor: '#F0F0F0' },
  deptFilterBtnActive: { backgroundColor: colors.admin, borderColor: colors.admin },
  deptFilterText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  deptFilterTextActive: { color: '#FFFFFF' },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  badgeCount: { backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, ...shadows.sm },
  badgeText: { ...typography.label, fontSize: 9, color: colors.admin, fontWeight: '900' },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...shadows.sm,
  },
  datePickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  iconBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', ...shadows.sm },
  logCard: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
  logHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  logIconWrapper: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.softGray, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  logClassInfo: { flex: 1 },
  logClassName: { ...typography.bodySemibold, color: colors.textPrimary, fontSize: 15 },
  logMeta: { ...typography.caption, color: colors.textTertiary, marginTop: 1, fontSize: 11, fontWeight: '700' },
  logStatsContainer: { flexDirection: 'row', gap: 10 },
  logStatBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 12 },
  logStatValue: { fontSize: 16, fontWeight: '900' },
  logStatLabel: { fontSize: 8, fontWeight: '800', opacity: 0.6, marginTop: 1 },
  performanceCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm },
  perfHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  perfClassIcon: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    backgroundColor: colors.softGray, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: spacing.md,
    overflow: 'hidden'
  },
  advisorImageSmall: {
    width: '100%',
    height: '100%',
  },
  perfInfo: { flex: 1 },
  perfClassName: { ...typography.bodySemibold, fontSize: 15, color: colors.textPrimary },
  perfDetails: { ...typography.caption, fontSize: 11, color: colors.textTertiary, marginTop: 1, fontWeight: '700' },
  perfRateContainer: { backgroundColor: colors.softGray, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  perfRateText: { fontWeight: '900', fontSize: 14 },
  perfProgressContainer: { marginTop: spacing.xs },
  perfProgressBar: { height: 6, backgroundColor: colors.softGray, borderRadius: 10, overflow: 'hidden' },
  perfProgressFill: { height: '100%', borderRadius: 10 },
  perfMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  perfMetaText: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' },
  emptyContainer: { alignItems: 'center', padding: spacing.xl, backgroundColor: '#FFF', borderRadius: 24, ...shadows.sm, marginVertical: spacing.md, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border },
  emptyTitle: { ...typography.h3, fontSize: 16, marginTop: spacing.md, color: colors.textPrimary },
  emptyText: { ...typography.body, fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: 2 },
  actionLink: { fontSize: 11, fontWeight: '800', color: colors.admin },
  deptCardList: { paddingRight: spacing.xl, gap: 12, marginBottom: spacing.lg },
  deptCard: { width: 160, borderRadius: 20, ...shadows.sm, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
  deptCardGradient: { padding: 15, flex: 1 },
  deptCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  deptCardIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  deptCardRate: { fontSize: 14, fontWeight: '900', color: colors.textPrimary },
  deptCardName: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  deptCardStats: { fontSize: 9, color: colors.textTertiary, fontWeight: '700' },
  deptCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  deptCardLink: { fontSize: 10, fontWeight: '800', color: colors.admin, textTransform: 'uppercase' },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary },
  modalSubtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 4, fontWeight: '700' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoading: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 12,
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  modalStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.xl,
  },
  mStatBox: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  mStatVal: { fontSize: 24, fontWeight: '900' },
  mStatLbl: { fontSize: 10, fontWeight: '800', opacity: 0.6, marginTop: 4, textTransform: 'uppercase' },
  studentSection: {
    marginBottom: spacing.xl,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 8,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  sectionHeading: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  studentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.admin,
  },
  studentName: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  studentRoll: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '600',
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  chevronIcon: {
    marginLeft: spacing.sm,
  },
});

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator, Modal, Alert, FlatList, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { dataService } from '../../services/dataService';
import { colors, typography, spacing, shadows } from '../../constants/theme';
import { useAlert } from '@/components/ui/alert';

export default function AdminStaffDirectory() {
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [hods, setHods] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Staff');
  const [departments, setDepartments] = useState<string[]>(['All Staff']);
  const [activeTab, setActiveTab] = useState<'staff' | 'hods'>('staff');
  
  // Management State
  const [manageModal, setManageModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [hasResponsibilities, setHasResponsibilities] = useState(false);
  const [personActionsLoading, setPersonActionsLoading] = useState(false);

  // Filtered list of people who can take over responsibilities
  const filteredRecipients = useMemo(() => {
    if (!selectedPerson) return [];
    
    // Always filter by same department
    const sameDept = selectedPerson.department;
    
    if (activeTab === 'staff') {
      // Show staff in same dept, prioritizing unassigned ones
      return allStaff
        .filter(p => p.id !== selectedPerson.id && p.department === sameDept)
        .sort((a, b) => {
          if (!a.assignedClass && b.assignedClass) return -1;
          if (a.assignedClass && !b.assignedClass) return 1;
          return 0;
        });
    } else {
      // Transferring an HOD: Show other HODs in same dept
      return hods.filter(p => 
        p.id !== selectedPerson.id && 
        p.department === sameDept
      );
    }
  }, [allStaff, hods, selectedPerson, activeTab]);

  // Modern Reactive Filtering with useMemo to avoid state synchronization issues
  const filteredStaff = useMemo(() => {
    // For Advisors tab, we show "staff" role people + HODs who are actively assigned to a class
    let base = activeTab === 'staff' 
      ? allStaff.filter(s => s.role === 'staff' || s.assignedClass) 
      : hods;
    let filtered = base;
    
    if (selectedDept !== 'All Staff') {
      filtered = filtered.filter(s => s.department === selectedDept);
    }
    
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(s => 
        (s.name || '').toLowerCase().includes(term) ||
        (s.department || '').toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [allStaff, hods, activeTab, search, selectedDept]);

  useEffect(() => {
    loadStaff();

    // Global Real-time Listener for Staff/HOD directory
    const channel = supabase
      .channel('staff_directory_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            const role = updated.role === 'dean' ? 'hod' : updated.role;
            if (role === 'hod') {
              setHods(prev => prev.map(h => String(h.id) === String(updated.id) ? { ...h, ...updated } : h));
            } else if (role === 'staff') {
              setAllStaff(prev => prev.map(s => String(s.id) === String(updated.id) ? { ...s, ...updated } : s));
            }
          } else {
            loadStaff(false);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classes' },
        () => loadStaff(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'managed_staff' },
        () => loadStaff(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStaff = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [staffList, hodList] = await Promise.all([
        dataService.getStaffLiveStatus(),
        dataService.getHODs()
      ]);
      setAllStaff(staffList);
      setHods(hodList);
      
      const depts = ['All Staff', ...new Set(staffList.map((s: any) => s.department))];
      setDepartments(depts);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Filtering is now handled by useMemo above for better reactivity

  const handleSearch = (text: string) => setSearch(text);
  const handleDeptFilter = (dept: string) => setSelectedDept(dept);
  const handleTabChange = (tab: 'staff' | 'hods') => setActiveTab(tab);

  const handleApprove = async (id: string, name: string) => {
    try {
      setHods(prev => prev.map(h => String(h.id) === String(id) ? { ...h, is_approved: true } : h));
      await dataService.approveHOD(id);
      showAlert('Account Approved', `HOD ${name} has been approved successfully.`);
    } catch (error) {
      console.error(error);
      showAlert('Approval Failed', 'Something went wrong while approving the HOD.');
      loadStaff();
    }
  };

  const openManagement = async (person: any) => {
    setSelectedPerson(person);
    setManageModal(true);
    setPersonActionsLoading(true);
    try {
      // Check if they have classes or managed staff
      const classes = await dataService.getClassesByAdvisor(person.name, person.staffId || person.id);
      setHasResponsibilities(classes.length > 0);
    } catch (e) {
      console.error(e);
    } finally {
      setPersonActionsLoading(false);
    }
  };

  const requestDeletion = () => {
    if (hasResponsibilities) {
      showAlert('Cannot Delete', `${selectedPerson.name} still has active responsibilities. Please transfer ownership of their classes first.`);
      return;
    }

    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete ${selectedPerson.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const isManaged = !!selectedPerson.staffId;
              await dataService.deleteStaffMember(selectedPerson.id, isManaged);
              setManageModal(false);
              showAlert('Deleted', 'Account has been removed.');
              loadStaff();
            } catch (e: any) {
              showAlert('Error', e.message || 'Failed to delete account.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleTransfer = async (target: any) => {
    if (!selectedPerson || !target) return;
    
    Alert.alert(
      'Confirm Transfer',
      `Transfer all classes and responsibilities from ${selectedPerson.name} to ${target.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            try {
              setTransferLoading(true);
              await dataService.transferAllOwnership(
                selectedPerson.staffId || selectedPerson.id,
                selectedPerson.name,
                target.staffId || target.id,
                target.name
              );
              setTransferModal(false);
              setManageModal(false);
              showAlert('Success', `Ownership transferred to ${target.name} successfully.`);
              loadStaff();
            } catch (e: any) {
              showAlert('Transfer Failed', e.message || 'Something went wrong.');
            } finally {
              setTransferLoading(false);
            }
          }
        }
      ]
    );
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
      <LinearGradient colors={['#F8F9FA', '#F1F5F9']} style={styles.background}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={styles.headerSubtitle}>INSTITUTIONAL DIRECTORY</Text>
          <Text style={styles.headerTitle}>Faculty & Staff</Text>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'staff' && styles.tabActive]}
              onPress={() => handleTabChange('staff')}
            >
              <Text style={[styles.tabText, activeTab === 'staff' && styles.tabTextActive]}>Advisors</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'hods' && styles.tabActive]}
              onPress={() => handleTabChange('hods')}
            >
              <Text style={[styles.tabText, activeTab === 'hods' && styles.tabTextActive]}>HODs</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or department..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={handleSearch}
            />
          </View>

          {activeTab === 'staff' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
              {departments.map((dept) => (
                <TouchableOpacity
                  key={dept}
                  onPress={() => handleDeptFilter(dept)}
                  style={[styles.filterBtn, selectedDept === dept && styles.filterBtnActive]}
                >
                  <Text style={[styles.filterText, selectedDept === dept && styles.filterTextActive]}>{dept}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <ScrollView 
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100, paddingTop: activeTab === 'hods' ? spacing.lg : 0 }]}
          showsVerticalScrollIndicator={false}
        >
          {(() => {
            const grouped = filteredStaff.reduce((acc: any, item: any) => {
              const dept = item.department || 'Other';
              if (!acc[dept]) acc[dept] = [];
              acc[dept].push(item);
              return acc;
            }, {});

            const sortedDepts = Object.keys(grouped).sort();

            return sortedDepts.map(dept => (
              <View key={dept} style={styles.deptSection}>
                <View style={styles.deptHeaderContainer}>
                  <Text style={styles.deptHeaderText}>{dept.toUpperCase()}</Text>
                  <View style={styles.deptHeaderLine} />
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{grouped[dept].length}</Text>
                  </View>
                </View>

                {grouped[dept].map((staff: any) => (
                  <View key={staff.id} style={styles.staffCard}>
                    <View style={styles.staffMain}>
                      <View style={styles.imageOverlay}>
                        {staff.profile_image || staff.profileImage ? (
                          <Image source={{ uri: staff.profile_image || staff.profileImage }} style={styles.staffImage} />
                        ) : (
                          <View style={[styles.staffImagePlaceholder, { backgroundColor: colors.softGray }]}>
                            <Ionicons name="person" size={24} color={colors.textTertiary} />
                          </View>
                        )}
                        {activeTab === 'staff' && (
                          <View style={[styles.onlineDot, { backgroundColor: staff.statusColor }]} />
                        )}
                      </View>
                      
                      <View style={styles.staffInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.staffName}>{staff.name}</Text>
                        </View>
                        <View style={styles.statusRow}>
                          {activeTab === 'staff' ? (
                            <>
                              <View style={[styles.statusIndicator, { backgroundColor: staff.statusColor }]} />
                              <Text style={[styles.statusText, { color: staff.status === 'In Class' ? colors.admin : colors.textSecondary }]}>
                                {staff.status.toUpperCase()}
                              </Text>
                            </>
                          ) : (
                            <Text style={[styles.statusText, { color: staff.is_approved ? colors.success : colors.warning }]}>
                              {staff.is_approved ? 'APPROVED' : 'PENDING APPROVAL'}
                            </Text>
                          )}
                        </View>
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {!staff.is_approved && activeTab === 'hods' && (
                          <TouchableOpacity 
                            style={styles.approveButton} 
                            onPress={() => handleApprove(staff.id, staff.name)}
                          >
                            <MaterialIcons name="check-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
                            <Text style={styles.approveButtonText}>Approve</Text>
                          </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity 
                          style={styles.actionIconButton}
                          onPress={() => openManagement(staff)}
                        >
                          <Ionicons name="ellipsis-vertical" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.divider} />
                    
                    <View style={styles.staffFooter}>
                      <View>
                        <Text style={styles.footerLabel}>{activeTab === 'hods' ? 'DESIGNATION' : 'ASSIGNED CLASS'}</Text>
                        <Text style={styles.footerValue}>
                          {activeTab === 'hods' ? 'Head of Department' : (staff.assignedClass || 'Not Assigned')}
                        </Text>
                      </View>
                      <View style={styles.deptIcon}>
                         <FontAwesome5 name={activeTab === 'hods' ? "user-shield" : "chalkboard-teacher"} size={14} color={colors.textTertiary} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ));
          })()}

          {filteredStaff.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No Staff Found</Text>
              <Text style={styles.emptyText}>Try searching with a different name or ID.</Text>
            </View>
          )}
        </ScrollView>

      </LinearGradient>

      {/* Management Modal */}
      <Modal
        visible={manageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setManageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismiss} 
            activeOpacity={1} 
            onPress={() => setManageModal(false)} 
          />
          <View style={styles.manageCard}>
            <View style={styles.manageHeader}>
              <Text style={styles.manageTitle}>Manage Account</Text>
              <Text style={styles.manageSubtitle}>{selectedPerson?.name}</Text>
            </View>

            <View style={styles.manageBody}>
              {personActionsLoading ? (
                <ActivityIndicator color={colors.admin} />
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.manageBtn}
                    onPress={() => {
                      setManageModal(false);
                      setTransferModal(true);
                    }}
                  >
                    <View style={[styles.manageIcon, { backgroundColor: '#EFF6FF' }]}>
                      <MaterialIcons name="swap-horiz" size={24} color="#2563EB" />
                    </View>
                    <View style={styles.manageBtnInfo}>
                      <Text style={styles.manageBtnTitle}>Transfer Ownership</Text>
                      <Text style={styles.manageBtnDesc}>Move classes and staff to another person</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.manageBtn, { marginTop: spacing.md }]}
                    onPress={requestDeletion}
                  >
                    <View style={[styles.manageIcon, { backgroundColor: '#FEF2F2' }]}>
                      <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
                    </View>
                    <View style={styles.manageBtnInfo}>
                      <Text style={[styles.manageBtnTitle, { color: '#EF4444' }]}>Delete Account</Text>
                      <Text style={styles.manageBtnDesc}>Permanently remove from system</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TouchableOpacity 
              style={styles.closeManageBtn}
              onPress={() => setManageModal(false)}
            >
              <Text style={styles.closeManageText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        visible={transferModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.transferContainer}>
          <View style={styles.transferHeader}>
            <TouchableOpacity onPress={() => setTransferModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.transferTitle}>
              {activeTab === 'staff' ? 'Transfer Classes' : 'Transfer HOD Duties'}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <View style={styles.transferInfo}>
            <Text style={styles.transferInfoText}>
              {activeTab === 'staff' 
                ? `Select an unassigned advisor in ${selectedPerson?.department} to take over classes.`
                : `Select another HOD in ${selectedPerson?.department} to manage their staff and records.`}
            </Text>
          </View>

          <FlatList
            data={filteredRecipients}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.transferList}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.recipientCard}
                onPress={() => handleTransfer(item)}
              >
                <View style={styles.recipientInfo}>
                  <Text style={styles.recipientName}>{item.name}</Text>
                  <Text style={styles.recipientRole}>
                    {item.role === 'hod' || item.role === 'dean' 
                      ? 'HOD Member' 
                      : item.assignedClass ? `Assigned to ${item.assignedClass}` : 'Available Advisor'}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="shuffle" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Available Recipients</Text>
                <Text style={styles.emptyText}>There are no other staff members in this department to transfer to.</Text>
              </View>
            }
          />
          
          {transferLoading && (
            <View style={styles.transferOverlay}>
              <ActivityIndicator size="large" color={colors.admin} />
              <Text style={styles.transferLoadingText}>Transferring duties...</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1 },
  approveButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    ...shadows.sm,
  },
  approveButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  headerSubtitle: { ...typography.caption, color: colors.admin, fontWeight: '900', letterSpacing: 1 },
  headerTitle: { ...typography.h1, fontSize: 28, color: colors.textPrimary, marginTop: 4 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    height: 50,
    marginTop: spacing.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  filterList: { paddingVertical: spacing.lg, gap: 10 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...shadows.sm,
  },
  filterBtnActive: { backgroundColor: colors.admin, borderColor: colors.admin },
  filterText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  filterTextActive: { color: '#FFF' },
  listContent: { paddingHorizontal: spacing.xl, gap: spacing.md },
  staffCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: spacing.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  staffMain: { flexDirection: 'row', alignItems: 'center' },
  imageOverlay: { position: 'relative' },
  staffImage: { width: 64, height: 64, borderRadius: 16 },
  staffImagePlaceholder: { width: 64, height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  onlineDot: { 
    position: 'absolute', 
    bottom: -2, 
    right: -2, 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    borderWidth: 3, 
    borderColor: '#FFF' 
  },
  staffInfo: { flex: 1, marginLeft: spacing.lg },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  staffName: { ...typography.h3, fontSize: 16, color: colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: spacing.md },
  staffFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { fontSize: 9, fontWeight: '900', color: colors.textTertiary, letterSpacing: 0.5 },
  footerValue: { fontSize: 13, fontWeight: '800', color: colors.admin, marginTop: 2 },
  deptIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { ...typography.h3, marginTop: spacing.md, color: colors.textPrimary },
  emptyText: { ...typography.body, color: colors.textTertiary, textAlign: 'center' },
  deptSection: {
    marginBottom: spacing.xl,
  },
  deptHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  deptHeaderText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textTertiary,
    letterSpacing: 1.5,
  },
  deptHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: spacing.md,
  },
  countBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: spacing.lg,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFF',
    ...shadows.sm,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.admin,
  },
  approveBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  approveBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.admin,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  actionIconButton: {
    padding: 8,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  manageCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
  },
  manageHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  manageTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  manageSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  manageBody: {
    marginBottom: spacing.xl,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  manageIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  manageBtnInfo: {
    flex: 1,
  },
  manageBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  manageBtnDesc: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  closeManageBtn: {
    alignItems: 'center',
    padding: spacing.md,
  },
  closeManageText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  transferContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  transferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cancelText: {
    fontSize: 15,
    color: colors.admin,
    fontWeight: '600',
  },
  transferTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  transferInfo: {
    padding: spacing.lg,
    backgroundColor: '#EFF6FF',
    margin: spacing.lg,
    borderRadius: 12,
  },
  transferInfoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  transferList: {
    paddingHorizontal: spacing.xl,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  recipientRole: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
    fontWeight: '600',
  },
  transferOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferLoadingText: {
    marginTop: spacing.md,
    fontSize: 15,
    fontWeight: '600',
    color: colors.admin,
  },
});

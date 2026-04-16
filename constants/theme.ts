export const colors = {
  // Core Brand Palette
  navyDeep: '#0a192f',
  primaryBlue: '#1152d4',
  pureWhite: '#ffffff',
  softGray: '#f8f9fa',
  accentBlue: '#2563eb', // A slightly brighter blue for interactions
  
  // Refined Base colors
  background: '#f8f9fa',
  surface: '#ffffff',
  surfaceSecondary: '#f1f5f9',
  border: '#e2e8f0',
  
  // Text
  textPrimary: '#0a192f', // Using navyDeep for text
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  
  // Brand colors by role (Matching Primary Blue for all mostly, but subtle variations if needed)
  admin: '#0a192f',
  adminLight: '#f1f5f9',
  adminDark: '#050c18',
  hod: '#1152d4',
  hodLight: '#eff6ff',
  hodDark: '#0e41a9',
  staff: '#1152d4', 
  staffLight: '#eff6ff',
  staffDark: '#0e41a9',
  
  // Status colors
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  
  // Attendance status
  present: '#10b981',
  presentLight: '#d1fae5',
  absent: '#ef4444',
  absentLight: '#fee2e2',
  onDuty: '#3b82f6',
  onDutyLight: '#dbeafe',
  unapproved: '#f59e0b',
  unapprovedLight: '#fef3c7',

  // Glassmorphism supports
  glassWhite: 'rgba(255, 255, 255, 0.15)',
  glassDark: 'rgba(10, 25, 47, 0.1)',
  overlay: 'rgba(10, 25, 47, 0.4)',
  
  // Custom Gradients for Stats
  gradientBlue: ['#4F7FFF', '#2563EB'],
  gradientGreen: ['#34D399', '#10B981'],
  gradientRed: ['#F87171', '#EF4444'],
  gradientOrange: ['#FBBF24', '#F59E0B'],
};

export const gradients = {
  admin: [colors.admin, colors.adminDark],
  hod: ['#0F172A', '#1E293B'],
  staff: ['#1152D4', '#0E41A9'],
  surface: ['#FFFFFF', '#F8FAFC'],
  glass: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.05)'],
  premium: ['#0F172A', '#111827', '#1E293B'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.75,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.25,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  bodySemibold: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: '#64748B', // Slate 500
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  small: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
};

export const borderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  lg: {
    shadowColor: colors.admin,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  premium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.12,
    shadowRadius: 35,
    elevation: 15,
  }
};

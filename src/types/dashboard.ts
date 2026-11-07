export type AppointmentSummary = {
  total: number;
  booked: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  today: number;
};

export type StaffSummary = {
  total: number;
  active: number;
  distributionByRole?: Record<string, number>;
};

export type AttendanceSummary = {
  todayDate: string;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  totalMarkedToday: number;
  attendancePercentage: number;
};

export type InventorySummary = {
  totalItems: number;
  availableStock: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalCategories: number;
  totalSuppliers: number;
};

export type RecentActivity = {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  actor?: string;
};

export type DashboardSummary = {
  appointments: AppointmentSummary;
  staff: StaffSummary;
  attendance: AttendanceSummary;
  inventory: InventorySummary;
  recentActivities: RecentActivity[];
};

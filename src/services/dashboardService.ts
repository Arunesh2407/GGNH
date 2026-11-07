import { apiClient } from "@/services/apiClient";
import type {
  AppointmentSummary,
  AttendanceSummary,
  DashboardSummary,
  InventorySummary,
  RecentActivity,
  StaffSummary,
} from "@/types/dashboard";

export type {
  AppointmentSummary,
  AttendanceSummary,
  DashboardSummary,
  InventorySummary,
  RecentActivity,
  StaffSummary,
};

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    return apiClient.get<DashboardSummary>("/dashboard/summary");
  },
};


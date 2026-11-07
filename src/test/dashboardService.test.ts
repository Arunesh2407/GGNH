import { describe, it, expect, vi, beforeEach } from "vitest";
import { dashboardService, type DashboardSummary } from "@/services/dashboardService";
import { apiClient } from "@/services/apiClient";

describe("dashboardService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches dashboard summary via GET /dashboard/summary", async () => {
    const mockSummary: DashboardSummary = {
      appointments: {
        total: 25,
        booked: 8,
        completed: 17,
        cancelled: 0,
        today: 3,
      },
      staff: {
        total: 10,
        active: 10,
      },
      attendance: {
        todayDate: "2026-11-06",
        presentToday: 9,
        absentToday: 1,
        onLeaveToday: 0,
        totalMarkedToday: 10,
        attendancePercentage: 90.0,
      },
      inventory: {
        totalItems: 40,
        lowStockItems: 3,
        totalCategories: 6,
        totalSuppliers: 4,
      },
      recentActivities: [
        {
          id: "act-1",
          type: "APPOINTMENT",
          title: "Appointment: Ramesh Kumar",
          description: "Status: BOOKED",
          timestamp: "2026-11-06T10:00:00Z",
        },
      ],
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockSummary);

    const result = await dashboardService.getSummary();
    expect(apiClient.get).toHaveBeenCalledWith("/dashboard/summary");
    expect(result.appointments.booked).toBe(8);
    expect(result.attendance.attendancePercentage).toBe(90.0);
    expect(result.inventory.lowStockItems).toBe(3);
    expect(result.recentActivities).toHaveLength(1);
  });
});


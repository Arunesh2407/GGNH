package com.ggnh.hub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardSummaryResponse {
    private AppointmentSummary appointments;
    private StaffSummary staff;
    private AttendanceSummary attendance;
    private InventorySummary inventory;
    private List<RecentActivityDto> recentActivities;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AppointmentSummary {
        private long total;
        private long booked;
        private long pending;
        private long confirmed;
        private long completed;
        private long cancelled;
        private long today;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StaffSummary {
        private long total;
        private long active;
        private Map<String, Long> distributionByRole;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttendanceSummary {
        private String todayDate;
        private long presentToday;
        private long absentToday;
        private long onLeaveToday;
        private long totalMarkedToday;
        private double attendancePercentage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InventorySummary {
        private long totalItems;
        private long availableStock;
        private long lowStockItems;
        private long outOfStockItems;
        private long totalCategories;
        private long totalSuppliers;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentActivityDto {
        private String id;
        private String type; // APPOINTMENT, STAFF, ATTENDANCE, INVENTORY, ACCESS
        private String title;
        private String description;
        private String timestamp;
        private String actor;
    }
}

package com.ggnh.hub.service;

import com.ggnh.hub.dto.DashboardSummaryResponse;
import com.ggnh.hub.entity.*;
import com.ggnh.hub.entity.enums.AppointmentStatus;
import com.ggnh.hub.entity.enums.AttendanceStatus;
import com.ggnh.hub.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final AppointmentRepository appointmentRepository;
    private final StaffRepository staffRepository;
    private final AttendanceRepository attendanceRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final InventoryCategoryRepository inventoryCategoryRepository;
    private final SupplierRepository supplierRepository;
    private final StockReceiptRepository stockReceiptRepository;
    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getDashboardSummary() {
        LocalDate today = LocalDate.now();
        OffsetDateTime startOfToday = today.atStartOfDay().atOffset(ZoneOffset.UTC);

        // 1. Appointments Breakdown
        long totalAppointments = appointmentRepository.count();
        long bookedAppointments = appointmentRepository.countByStatus(AppointmentStatus.BOOKED);
        long pendingAppointments = bookedAppointments; // 'booked' and 'pending' denote initial booked state
        long confirmedAppointments = appointmentRepository.countByStatus(AppointmentStatus.CONFIRMED);
        long completedAppointments = appointmentRepository.countByStatus(AppointmentStatus.COMPLETED);
        long cancelledAppointments = appointmentRepository.countByStatus(AppointmentStatus.CANCELLED);

        List<Appointment> recentAppointments = appointmentRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 50)).getContent();
        long todayAppointments = recentAppointments.stream()
                .filter(a -> (a.getAppointmentDate() != null && a.getAppointmentDate().equals(today)) ||
                             (a.getCreatedAt() != null && a.getCreatedAt().isAfter(startOfToday)))
                .count();

        DashboardSummaryResponse.AppointmentSummary appointmentSummary = DashboardSummaryResponse.AppointmentSummary.builder()
                .total(totalAppointments)
                .booked(bookedAppointments)
                .pending(pendingAppointments)
                .confirmed(confirmedAppointments)
                .completed(completedAppointments)
                .cancelled(cancelledAppointments)
                .today(todayAppointments)
                .build();

        // 2. Staff Breakdown & Distribution
        List<Staff> allStaff = staffRepository.findAll();
        long totalStaff = allStaff.size();
        long activeStaff = allStaff.stream().filter(Staff::isActive).count();

        Map<String, Long> distributionByRole = allStaff.stream()
                .filter(Staff::isActive)
                .collect(Collectors.groupingBy(s -> (s.getRole() != null && !s.getRole().isBlank()) ? s.getRole().trim() : "Other", Collectors.counting()));

        DashboardSummaryResponse.StaffSummary staffSummary = DashboardSummaryResponse.StaffSummary.builder()
                .total(totalStaff)
                .active(activeStaff)
                .distributionByRole(distributionByRole)
                .build();

        // 3. Attendance
        List<Attendance> todayAttendance = attendanceRepository.findByAttendanceDate(today);
        long presentToday = 0;
        long absentToday = 0;
        long onLeaveToday = 0;

        for (Attendance att : todayAttendance) {
            if (att.getStatus() == AttendanceStatus.PRESENT || att.getStatus() == AttendanceStatus.HALF_TIME || att.getStatus() == AttendanceStatus.OVER_TIME) {
                presentToday++;
            } else if (att.getStatus() == AttendanceStatus.ABSENT) {
                absentToday++;
            } else if (att.getStatus() == AttendanceStatus.LEAVE) {
                onLeaveToday++;
            }
        }

        long totalMarkedToday = todayAttendance.size();
        double attendancePercentage = totalMarkedToday > 0
                ? Math.round(((double) presentToday / totalMarkedToday) * 1000.0) / 10.0
                : 0.0;

        DashboardSummaryResponse.AttendanceSummary attendanceSummary = DashboardSummaryResponse.AttendanceSummary.builder()
                .todayDate(today.toString())
                .presentToday(presentToday)
                .absentToday(absentToday)
                .onLeaveToday(onLeaveToday)
                .totalMarkedToday(totalMarkedToday)
                .attendancePercentage(attendancePercentage)
                .build();

        // 4. Inventory Stock Health
        List<InventoryItem> items = inventoryItemRepository.findAll();
        long totalItems = items.size();
        long availableStock = items.stream().mapToLong(InventoryItem::getCurrentStock).sum();
        long lowStockItems = items.stream()
                .filter(i -> i.getCurrentStock() <= i.getReorderLevel() && i.getCurrentStock() > 0)
                .count();
        long outOfStockItems = items.stream()
                .filter(i -> i.getCurrentStock() <= 0)
                .count();
        long totalCategories = inventoryCategoryRepository.count();
        long totalSuppliers = supplierRepository.count();

        DashboardSummaryResponse.InventorySummary inventorySummary = DashboardSummaryResponse.InventorySummary.builder()
                .totalItems(totalItems)
                .availableStock(availableStock)
                .lowStockItems(lowStockItems)
                .outOfStockItems(outOfStockItems)
                .totalCategories(totalCategories)
                .totalSuppliers(totalSuppliers)
                .build();

        // 5. Recent Activity: Audit Logs + Real Operations
        List<DashboardSummaryResponse.RecentActivityDto> activities = new ArrayList<>();

        List<AuditLog> auditLogs = auditLogRepository.findTop10ByOrderByCreatedAtDesc();
        for (AuditLog logEntry : auditLogs) {
            String timeStr = logEntry.getCreatedAt() != null ? logEntry.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : "";
            activities.add(DashboardSummaryResponse.RecentActivityDto.builder()
                    .id("audit-" + logEntry.getId())
                    .type(logEntry.getModule())
                    .title(formatActionTitle(logEntry.getAction(), logEntry.getModule()))
                    .description(logEntry.getDetails() != null ? logEntry.getDetails() : "")
                    .timestamp(timeStr)
                    .actor(logEntry.getActingUser())
                    .build());
        }

        // If audit logs are sparse, fallback to recent top appointments & receipts
        if (activities.size() < 5) {
            List<Appointment> topAppointments = appointmentRepository.findTop5ByOrderByCreatedAtDesc();
            for (Appointment a : topAppointments) {
                String timeStr = a.getCreatedAt() != null ? a.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : "";
                activities.add(DashboardSummaryResponse.RecentActivityDto.builder()
                        .id("appt-" + a.getId())
                        .type("APPOINTMENT")
                        .title("Appointment: " + a.getPatientName())
                        .description("Status: " + a.getStatus() + (a.getDoctorName() != null ? " with " + a.getDoctorName() : ""))
                        .timestamp(timeStr)
                        .actor(a.getPatientEmail() != null ? a.getPatientEmail() : "Patient")
                        .build());
            }
        }

        activities.sort(Comparator.comparing(DashboardSummaryResponse.RecentActivityDto::getTimestamp, Comparator.reverseOrder()));

        List<DashboardSummaryResponse.RecentActivityDto> trimmedActivities = activities.stream()
                .limit(10)
                .toList();

        return DashboardSummaryResponse.builder()
                .appointments(appointmentSummary)
                .staff(staffSummary)
                .attendance(attendanceSummary)
                .inventory(inventorySummary)
                .recentActivities(trimmedActivities)
                .build();
    }

    private String formatActionTitle(String action, String module) {
        if (action == null) return module;
        return action.replace('_', ' ');
    }
}

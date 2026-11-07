package com.ggnh.hub.entity;

import com.ggnh.hub.entity.enums.AttendanceStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "attendance",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_attendance_staff_date", columnNames = {"staff_id", "attendance_date"})
    },
    indexes = {
        @Index(name = "idx_attendance_date", columnList = "attendance_date")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull(message = "Staff reference is required")
    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "staff_id", nullable = false)
    private Staff staff;

    @NotNull(message = "Attendance date is required")
    @Column(name = "attendance_date", nullable = false)
    private LocalDate attendanceDate;

    @NotNull(message = "Status is required")
    @Column(name = "status", nullable = false, length = 30)
    private AttendanceStatus status;

    @Column(name = "check_in_time")
    private OffsetDateTime checkInTime;

    @Column(name = "check_out_time")
    private OffsetDateTime checkOutTime;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "corrected_by")
    private String correctedBy;

    @Column(name = "corrected_at")
    private OffsetDateTime correctedAt;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private OffsetDateTime recordedAt;

    @PrePersist
    protected void onCreate() {
        if (recordedAt == null) {
            recordedAt = OffsetDateTime.now();
        }
    }

    public String getDate() {
        return attendanceDate != null ? attendanceDate.toString() : null;
    }

    public UUID getStaffId() {
        return staff != null ? staff.getId() : null;
    }

    public String getStaffName() {
        return staff != null ? staff.getName() : null;
    }
}

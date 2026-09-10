package com.ggnh.hub.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Entity
@Table(
    name = "attendance",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"date", "staffId"})
    },
    indexes = {
        @Index(name = "idx_attendance_date", columnList = "date"),
        @Index(name = "idx_attendance_staff_date", columnList = "staffId, date")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attendance {

    @Id
    private String id; // Format: {date}_{staffId}

    @NotBlank(message = "Date is required")
    @Column(nullable = false)
    private String date; // YYYY-MM-DD

    @NotBlank(message = "Staff ID is required")
    @Column(nullable = false)
    private String staffId;

    @NotBlank(message = "Status is required")
    @Column(nullable = false)
    private String status; // present, absent, leave, off, half-time, over-time
}

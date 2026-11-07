package com.ggnh.hub.dto;

import com.ggnh.hub.entity.enums.AttendanceStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceRecordResponse {
    private UUID id;
    private UUID staffId;
    private String staffName;
    private String staffRole;
    private LocalDate attendanceDate;
    private AttendanceStatus status;
    private OffsetDateTime checkInTime;
    private OffsetDateTime checkOutTime;
    private String notes;
    private String correctedBy;
    private OffsetDateTime correctedAt;
    private OffsetDateTime recordedAt;
}


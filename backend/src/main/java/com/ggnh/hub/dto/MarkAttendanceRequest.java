package com.ggnh.hub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarkAttendanceRequest {

    @NotBlank(message = "Date is required")
    private String date;

    @NotNull(message = "Staff ID is required")
    private UUID staffId;

    @NotBlank(message = "Status is required")
    private String status;

    private String notes;
}

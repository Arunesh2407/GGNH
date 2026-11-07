package com.ggnh.hub.dto;

import com.fasterxml.jackson.annotation.JsonGetter;
import com.ggnh.hub.entity.enums.AppointmentStatus;
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
public class AppointmentResponse {

    private UUID id;
    private String name;
    private String email;
    private String phone;
    private String doctor;
    private String message;
    private LocalDate appointmentDate;
    private String timeSlot;
    private AppointmentStatus status;
    private OffsetDateTime createdAt;
    private OffsetDateTime completedAt;
    private OffsetDateTime updatedAt;

    @JsonGetter("patientName")
    public String getPatientName() {
        return name;
    }

    @JsonGetter("patientPhone")
    public String getPatientPhone() {
        return phone;
    }

    @JsonGetter("patientEmail")
    public String getPatientEmail() {
        return email;
    }

    @JsonGetter("doctorName")
    public String getDoctorName() {
        return doctor;
    }
}

package com.ggnh.hub.entity;

import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.ggnh.hub.entity.enums.AppointmentStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "appointments",
    indexes = {
        @Index(name = "idx_appointments_status", columnList = "status"),
        @Index(name = "idx_appointments_created_at", columnList = "created_at DESC"),
        @Index(name = "idx_appointments_date", columnList = "appointment_date")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Appointment {

    @Id
    @AssignedOrRandomUuid
    private UUID id;

    @NotBlank(message = "Patient name is required")
    @Column(name = "patient_name", nullable = false, length = 200)
    private String patientName;

    @Column(name = "patient_email", length = 255)
    private String patientEmail;

    @NotBlank(message = "Patient phone is required")
    @Column(name = "patient_phone", nullable = false, length = 50)
    private String patientPhone;

    @Column(name = "doctor_name", length = 150)
    private String doctorName;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "appointment_date")
    private LocalDate appointmentDate;

    @Column(name = "time_slot", length = 50)
    private String timeSlot;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private AppointmentStatus status = AppointmentStatus.BOOKED;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (status == null) {
            status = AppointmentStatus.BOOKED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // JSON alias accessors for existing frontend / controller compatibility
    @JsonGetter("name")
    public String getName() {
        return patientName;
    }

    @JsonSetter("name")
    public void setName(String name) {
        this.patientName = name;
    }

    @JsonGetter("email")
    public String getEmail() {
        return patientEmail;
    }

    @JsonSetter("email")
    public void setEmail(String email) {
        this.patientEmail = email;
    }

    @JsonGetter("phone")
    public String getPhone() {
        return patientPhone;
    }

    @JsonSetter("phone")
    public void setPhone(String phone) {
        this.patientPhone = phone;
    }

    @JsonGetter("doctor")
    public String getDoctor() {
        return doctorName;
    }

    @JsonSetter("doctor")
    public void setDoctor(String doctor) {
        this.doctorName = doctor;
    }
}

package com.ggnh.hub.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "appointments",
    indexes = {
        @Index(name = "idx_appointment_created_at", columnList = "createdAt DESC"),
        @Index(name = "idx_appointment_status", columnList = "status")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Appointment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @NotBlank(message = "Name is required")
    @Column(nullable = false)
    private String name;

    @NotBlank(message = "Email is required")
    @Column(nullable = false)
    private String email;

    @NotBlank(message = "Phone is required")
    @Column(nullable = false)
    private String phone;

    @NotBlank(message = "Doctor is required")
    @Column(nullable = false)
    private String doctor;

    @Column(columnDefinition = "TEXT")
    private String message;

    @NotBlank(message = "Status is required")
    @Column(nullable = false)
    private String status; // booked, completed

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = "booked";
        }
    }
}

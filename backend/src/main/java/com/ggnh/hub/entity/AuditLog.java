package com.ggnh.hub.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "audit_logs",
    indexes = {
        @Index(name = "idx_audit_logs_module", columnList = "module"),
        @Index(name = "idx_audit_logs_created_at", columnList = "created_at DESC"),
        @Index(name = "idx_audit_logs_acting_user", columnList = "acting_user")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank(message = "Acting user is required")
    @Column(name = "acting_user", nullable = false)
    private String actingUser;

    @NotBlank(message = "Action is required")
    @Column(name = "action", nullable = false, length = 60)
    private String action;

    @NotBlank(message = "Module is required")
    @Column(name = "module", nullable = false, length = 50)
    private String module;

    @Column(name = "record_id", length = 100)
    private String recordId;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}


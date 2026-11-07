package com.ggnh.hub.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_permissions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPermission {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "manage_attendance", nullable = false)
    @Builder.Default
    private boolean manageAttendance = false;

    @Column(name = "manage_appointments", nullable = false)
    @Builder.Default
    private boolean manageAppointments = false;

    @Column(name = "manage_users", nullable = false)
    @Builder.Default
    private boolean manageUsers = false;

    @Column(name = "manage_inventory", nullable = false)
    @Builder.Default
    private boolean manageInventory = false;

    @Column(name = "manage_inventory_reports", nullable = false)
    @Builder.Default
    private boolean manageInventoryReports = false;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onPersistOrUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}


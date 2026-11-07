package com.ggnh.hub.entity;

import com.ggnh.hub.entity.enums.LedgerAction;
import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "inventory_ledger",
    indexes = {
        @Index(name = "idx_inventory_ledger_item_created", columnList = "item_id, created_at DESC"),
        @Index(name = "idx_inventory_ledger_source", columnList = "source_type, source_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryLedger {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull(message = "Item reference is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private InventoryItem item;

    @NotNull(message = "Action is required")
    @Column(nullable = false, length = 30)
    private LedgerAction action;

    @Column(nullable = false)
    private int quantity;

    @Min(value = 0, message = "Balance after cannot be negative")
    @Column(name = "balance_after", nullable = false)
    private int balanceAfter;

    @Column(name = "source_id")
    private UUID sourceId;

    @NotBlank(message = "Source type is required")
    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @NotBlank(message = "Creator identifier is required")
    @Column(name = "created_by", nullable = false, length = 255)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}


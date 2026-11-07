package com.ggnh.hub.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "inventory_items",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_inventory_items_sku", columnNames = {"sku"})
    },
    indexes = {
        @Index(name = "idx_inventory_items_category", columnList = "category_id"),
        @Index(name = "idx_inventory_items_supplier", columnList = "default_supplier_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank(message = "Item name is required")
    @Column(nullable = false, length = 200)
    private String name;

    @NotBlank(message = "SKU is required")
    @Column(nullable = false, unique = true, length = 50)
    private String sku;

    @Column(columnDefinition = "TEXT")
    private String description;

    @NotNull(message = "Category is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private InventoryCategory category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "default_supplier_id")
    private Supplier defaultSupplier;

    @NotBlank(message = "Unit of measure is required")
    @Column(nullable = false, length = 30)
    private String unit;

    @Min(value = 0, message = "Reorder level cannot be negative")
    @Column(name = "reorder_level", nullable = false)
    @Builder.Default
    private int reorderLevel = 0;

    @Min(value = 0, message = "Current stock cannot be negative")
    @Column(name = "current_stock", nullable = false)
    @Builder.Default
    private int currentStock = 0;

    @Version
    @Column(name = "version", nullable = false)
    @Builder.Default
    private Long version = 0L;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

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
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}

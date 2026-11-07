package com.ggnh.hub.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "stock_receipt_items",
    indexes = {
        @Index(name = "idx_stock_receipt_items_receipt", columnList = "receipt_id"),
        @Index(name = "idx_stock_receipt_items_item", columnList = "item_id"),
        @Index(name = "idx_stock_receipt_items_batch", columnList = "batch_no")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockReceiptItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull(message = "Receipt reference is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receipt_id", nullable = false)
    private StockReceipt receipt;

    @NotNull(message = "Item reference is required")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private InventoryItem item;

    @Min(value = 1, message = "Quantity must be greater than zero")
    @Column(nullable = false)
    private int quantity;

    @NotNull(message = "Unit cost is required")
    @DecimalMin(value = "0.00", message = "Unit cost cannot be negative")
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal unitCost = BigDecimal.ZERO;

    @NotBlank(message = "Batch number is required")
    @Column(name = "batch_no", nullable = false, length = 100)
    private String batchNo;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}


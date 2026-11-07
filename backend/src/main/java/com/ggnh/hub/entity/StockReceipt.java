package com.ggnh.hub.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
    name = "stock_receipts",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_stock_receipts_number", columnNames = {"receipt_number"})
    },
    indexes = {
        @Index(name = "idx_stock_receipts_supplier", columnList = "supplier_id"),
        @Index(name = "idx_stock_receipts_received_date", columnList = "received_date DESC")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockReceipt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank(message = "Receipt number is required")
    @Column(name = "receipt_number", nullable = false, unique = true, length = 50)
    private String receiptNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @NotNull(message = "Received date is required")
    @Column(name = "received_date", nullable = false)
    private LocalDate receivedDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @NotBlank(message = "Receiver identifier is required")
    @Column(name = "received_by", nullable = false, length = 255)
    private String receivedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @OneToMany(mappedBy = "receipt", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<StockReceiptItem> items = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}


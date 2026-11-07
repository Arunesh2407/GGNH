package com.ggnh.hub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockReceiptResponse {
    private UUID id;
    private String receiptNumber;
    private UUID itemId;
    private String itemName;
    private UUID supplierId;
    private String supplierName;
    private int quantity;
    private BigDecimal unitCost;
    private String batchNo;
    private LocalDate expiryDate;
    private LocalDate receivedDate;
    private String notes;
    private String receivedBy;
    private OffsetDateTime createdAt;
}


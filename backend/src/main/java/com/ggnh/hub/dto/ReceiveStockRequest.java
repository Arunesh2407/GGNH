package com.ggnh.hub.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReceiveStockRequest {
    @NotNull(message = "Item ID is required")
    private UUID itemId;

    private UUID supplierId;

    @Min(value = 1, message = "Quantity must be at least 1")
    private int quantity;

    @NotNull(message = "Unit cost is required")
    @DecimalMin(value = "0.00", message = "Unit cost cannot be negative")
    private BigDecimal unitCost;

    @NotBlank(message = "Batch number is required")
    private String batchNo;

    private LocalDate expiryDate;

    @NotNull(message = "Received date is required")
    private LocalDate receivedDate;

    private String notes;
}


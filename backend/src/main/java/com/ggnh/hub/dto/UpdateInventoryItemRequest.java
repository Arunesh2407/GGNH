package com.ggnh.hub.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateInventoryItemRequest {
    @NotBlank(message = "Item name is required")
    private String name;

    @NotBlank(message = "SKU is required")
    private String sku;

    private String description;

    @NotNull(message = "Category ID is required")
    private UUID categoryId;

    @NotBlank(message = "Unit of measure is required")
    private String unit;

    @Min(value = 0, message = "Reorder level cannot be negative")
    private int reorderLevel;

    private UUID supplierId;
    private boolean isActive;
}

package com.ggnh.hub.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryItemResponse {
    private UUID id;
    private String name;
    private String sku;
    private String description;
    private UUID categoryId;
    private String categoryName;
    private String unit;
    private int reorderLevel;
    private int currentStock;
    private UUID supplierId;
    private String supplierName;

    @JsonProperty("isActive")
    private boolean isActive;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}

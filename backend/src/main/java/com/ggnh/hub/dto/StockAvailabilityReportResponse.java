package com.ggnh.hub.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockAvailabilityReportResponse {
    private UUID itemId;
    private String itemName;
    private String sku;
    private String categoryName;
    private String unit;
    private int currentStock;
    private int reorderLevel;

    @JsonProperty("isLowStock")
    private boolean isLowStock;
}

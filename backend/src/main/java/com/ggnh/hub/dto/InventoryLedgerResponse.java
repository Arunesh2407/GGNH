package com.ggnh.hub.dto;

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
public class InventoryLedgerResponse {
    private UUID id;
    private UUID itemId;
    private String itemName;
    private String itemSku;
    private String action;
    private int quantity;
    private int balanceAfter;
    private String sourceType;
    private String notes;
    private String createdBy;
    private OffsetDateTime createdAt;
}


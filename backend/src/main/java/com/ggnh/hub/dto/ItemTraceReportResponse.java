package com.ggnh.hub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ItemTraceReportResponse {
    private UUID itemId;
    private String itemName;
    private List<ItemTraceRowDto> rows;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemTraceRowDto {
        private OffsetDateTime date;
        private String action;
        private int quantity;
        private int balanceAfter;
        private String sourceRef;
        private String notes;
        private String actor;
    }
}


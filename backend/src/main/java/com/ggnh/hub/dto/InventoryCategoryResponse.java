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
public class InventoryCategoryResponse {
    private UUID id;
    private String name;
    private String code;
    private String description;

    @JsonProperty("isActive")
    private boolean isActive;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}

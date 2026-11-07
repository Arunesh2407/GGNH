package com.ggnh.hub.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSupplierRequest {
    @NotBlank(message = "Supplier name is required")
    private String name;

    @NotBlank(message = "Supplier code is required")
    private String code;

    private String contactPerson;
    private String email;
    private String phone;
    private String address;
    private Boolean isActive;
}


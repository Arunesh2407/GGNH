package com.ggnh.hub.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserAccessRequest {
    @NotBlank(message = "Role is required")
    private String role;

    private UserPermissionsDto permissions;
}

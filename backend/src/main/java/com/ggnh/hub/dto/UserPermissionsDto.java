package com.ggnh.hub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserPermissionsDto {
    private boolean manageAttendance;
    private boolean manageAppointments;
    private boolean manageUsers;
    private boolean manageInventory;
    private boolean manageInventoryReports;
}

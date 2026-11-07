package com.ggnh.hub.controller;

import com.ggnh.hub.entity.Staff;
import com.ggnh.hub.security.model.FirebaseUserDetails;
import com.ggnh.hub.service.StaffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staffService;

    @GetMapping
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE') or hasAuthority('PERM_MANAGE_USERS')")
    public ResponseEntity<List<Staff>> getAllStaff(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) Boolean isActive
    ) {
        if (search != null || role != null || department != null || isActive != null) {
            return ResponseEntity.ok(staffService.searchStaff(search, role, department, isActive));
        }
        return ResponseEntity.ok(staffService.getAllStaff());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE') or hasAuthority('PERM_MANAGE_USERS')")
    public ResponseEntity<Staff> getStaffById(@PathVariable UUID id) {
        return staffService.getStaffById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE') or hasAuthority('PERM_MANAGE_USERS')")
    public ResponseEntity<Staff> createStaff(
            @Valid @RequestBody Staff staff,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Admin";
        Staff saved = staffService.createStaff(staff, actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE') or hasAuthority('PERM_MANAGE_USERS')")
    public ResponseEntity<Staff> updateStaff(
            @PathVariable UUID id,
            @Valid @RequestBody Staff staffDetails,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Admin";
        return staffService.updateStaff(id, staffDetails, actor)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_USERS')")
    public ResponseEntity<Staff> updateStaffStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, Boolean> body,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        Boolean active = body.getOrDefault("active", true);
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Admin";
        return staffService.toggleStaffStatus(id, active, actor)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/link-user/{userId}")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_USERS')")
    public ResponseEntity<Staff> linkUser(
            @PathVariable UUID id,
            @PathVariable UUID userId,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Admin";
        return staffService.linkStaffUser(id, userId, actor)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE') or hasAuthority('PERM_MANAGE_USERS')")
    public ResponseEntity<Void> deleteStaff(
            @PathVariable UUID id,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Admin";
        if (!staffService.deleteStaff(id, actor)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}

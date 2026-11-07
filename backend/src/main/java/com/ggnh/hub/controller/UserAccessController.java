package com.ggnh.hub.controller;

import com.ggnh.hub.dto.UpdateUserAccessRequest;
import com.ggnh.hub.dto.UpdateUserStatusRequest;
import com.ggnh.hub.dto.UserProfileResponse;
import com.ggnh.hub.dto.UserPermissionsDto;
import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.UserPermission;
import com.ggnh.hub.repository.RoleRepository;
import com.ggnh.hub.repository.UserPermissionRepository;
import com.ggnh.hub.repository.UserRepository;
import com.ggnh.hub.security.model.FirebaseUserDetails;
import com.ggnh.hub.security.service.UserSecurityService;
import com.ggnh.hub.service.AuditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserAccessController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserPermissionRepository userPermissionRepository;
    private final UserSecurityService userSecurityService;
    private final AuditService auditService;

    /**
     * Lists all application users and their access configurations.
     */
    @GetMapping
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_USERS')")
    public ResponseEntity<List<UserProfileResponse>> listUsers() {
        List<UserProfileResponse> profiles = userRepository.findAll().stream()
                .map(userSecurityService::toProfileResponse)
                .toList();
        return ResponseEntity.ok(profiles);
    }

    /**
     * Approves (activates) or deactivates a user account.
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_USERS')")
    @Transactional
    public ResponseEntity<UserProfileResponse> updateUserStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserStatusRequest request,
            @AuthenticationPrincipal FirebaseUserDetails currentAdmin
    ) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + id));

        // SEC-03: Validate business rules for status update
        userSecurityService.validateStatusUpdate(currentAdmin, user, request.getActive());

        user.setActive(request.getActive());
        User saved = userRepository.save(user);

        String adminEmail = (currentAdmin != null && currentAdmin.getEmail() != null) ? currentAdmin.getEmail() : "Admin";
        auditService.record(
                adminEmail,
                "ACCESS",
                "USER_STATUS_UPDATED",
                user.getId().toString(),
                "User " + user.getEmail() + " status updated to active=" + request.getActive()
        );

        log.info("User '{}' status updated to active={}", user.getEmail(), request.getActive());
        return ResponseEntity.ok(userSecurityService.toProfileResponse(saved));
    }

    /**
     * Updates a user's role and granular permissions.
     */
    @PutMapping("/{id}/access")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_USERS')")
    @Transactional
    public ResponseEntity<UserProfileResponse> updateUserAccess(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserAccessRequest request,
            @AuthenticationPrincipal FirebaseUserDetails currentAdmin
    ) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + id));

        String targetRoleName = request.getRole().trim().toLowerCase();

        // SEC-02: Validate business rules for access update (prohibit self-escalation and unauthorized owner management)
        userSecurityService.validateAccessUpdate(currentAdmin, user, targetRoleName, request.getPermissions());

        Role role = roleRepository.findByName(targetRoleName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role not found: " + targetRoleName));

        Set<Role> roles = new HashSet<>();
        roles.add(role);
        user.setRoles(roles);

        // Update or create permissions
        UserPermissionsDto permDto = request.getPermissions();
        if (permDto == null) {
            permDto = userSecurityService.calculateDefaultPermissionsForRoles(Set.of(targetRoleName));
        }

        UserPermission userPerm = user.getPermissions();
        if (userPerm == null) {
            userPerm = UserPermission.builder()
                    .user(user)
                    .build();
            user.setPermissions(userPerm);
        }

        userPerm.setManageAttendance(permDto.isManageAttendance());
        userPerm.setManageAppointments(permDto.isManageAppointments());
        userPerm.setManageUsers(permDto.isManageUsers());
        userPerm.setManageInventory(permDto.isManageInventory());
        userPerm.setManageInventoryReports(permDto.isManageInventoryReports());

        User saved = userRepository.save(user);

        String adminEmail = (currentAdmin != null && currentAdmin.getEmail() != null) ? currentAdmin.getEmail() : "Admin";
        auditService.record(
                adminEmail,
                "ACCESS",
                "USER_ACCESS_UPDATED",
                user.getId().toString(),
                "User " + user.getEmail() + " assigned role '" + targetRoleName + "'"
        );

        log.info("User '{}' access updated to role '{}'", user.getEmail(), targetRoleName);

        return ResponseEntity.ok(userSecurityService.toProfileResponse(saved));
    }
}

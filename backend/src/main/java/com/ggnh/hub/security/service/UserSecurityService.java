package com.ggnh.hub.security.service;

import com.ggnh.hub.dto.UserPermissionsDto;
import com.ggnh.hub.dto.UserProfileResponse;
import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.UserPermission;
import com.ggnh.hub.repository.UserRepository;
import com.ggnh.hub.security.firebase.FirebaseTokenHolder;
import com.ggnh.hub.security.model.FirebaseUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserSecurityService {

    private final UserRepository userRepository;

    @Transactional
    public Optional<User> findAndLinkUser(FirebaseTokenHolder tokenHolder) {
        String uid = tokenHolder.getUid();
        String email = tokenHolder.getEmail();

        Optional<User> byUid = userRepository.findByFirebaseUid(uid);
        if (byUid.isPresent()) {
            User user = byUid.get();
            if (email != null && !email.isBlank()) {
                Optional<User> byEmail = userRepository.findByEmailIgnoreCase(email.trim());
                if (byEmail.isPresent() && !byEmail.get().getId().equals(user.getId())) {
                    log.error("Identity conflict: UID '{}' is linked to user '{}', but token has email '{}' belonging to user '{}'",
                            uid, user.getEmail(), email, byEmail.get().getEmail());
                    return Optional.empty();
                }
            }
            return byUid;
        }

        if (email != null && !email.isBlank()) {
            Optional<User> byEmail = userRepository.findByEmailIgnoreCase(email.trim());
            if (byEmail.isPresent()) {
                User user = byEmail.get();
                if (user.getFirebaseUid() == null || user.getFirebaseUid().isBlank()) {
                    // SEC-01: Require email_verified == true before automatic identity linking
                    if (!tokenHolder.isEmailVerified()) {
                        log.warn("Refusing to link unverified Firebase email '{}' (UID '{}') to database user", email, uid);
                        return Optional.empty();
                    }
                    // Ensure the UID is not already linked to another user
                    if (userRepository.findByFirebaseUid(uid).isPresent()) {
                        log.error("Refusing to link UID '{}' to user '{}' because UID is already in use", uid, email);
                        return Optional.empty();
                    }
                    // Safe automatic identity linking for existing accounts
                    log.info("Linking Firebase UID '{}' to existing database user '{}'", uid, email);
                    user.setFirebaseUid(uid);
                    return Optional.of(userRepository.save(user));
                } else if (!user.getFirebaseUid().equals(uid)) {
                    log.error("Identity conflict: email '{}' already mapped to UID '{}', but received UID '{}'",
                            email, user.getFirebaseUid(), uid);
                    return Optional.empty();
                }
                return Optional.of(user);
            }
        }

        return Optional.empty();
    }

    /**
     * SEC-03: Business layer validation for account status updates (activation/deactivation).
     */
    public void validateStatusUpdate(FirebaseUserDetails currentAdmin, User targetUser, boolean newActive) {
        if (currentAdmin == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated session.");
        }

        // Safeguard: An administrator cannot deactivate their own account
        if (currentAdmin.getId().equals(targetUser.getId()) && !newActive) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Administrators cannot deactivate their own account.");
        }

        boolean isTargetOwner = targetUser.getRoles().stream()
                .anyMatch(r -> "owner".equalsIgnoreCase(r.getName()));

        if (isTargetOwner && !newActive) {
            // Only an owner may deactivate another owner
            if (!currentAdmin.getRoles().contains("owner")) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only an owner can modify or deactivate an owner account.");
            }

            // Prevent deactivating the last active owner
            long activeOwners = userRepository.countActiveOwners();
            if (targetUser.isActive() && activeOwners <= 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate the last active owner.");
            }
        }
    }

    /**
     * SEC-02: Business layer validation for access updates (role/permissions).
     */
    public void validateAccessUpdate(FirebaseUserDetails currentAdmin, User targetUser, String newRole, UserPermissionsDto newPermissions) {
        if (currentAdmin == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated session.");
        }

        // Self-permission escalation safeguard: Administrators cannot modify their own roles or permissions
        if (currentAdmin.getId().equals(targetUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrators cannot modify their own roles or permissions.");
        }

        boolean isTargetOwner = targetUser.getRoles().stream()
                .anyMatch(r -> "owner".equalsIgnoreCase(r.getName()));

        // Non-owners cannot modify an owner account
        if (isTargetOwner && !currentAdmin.getRoles().contains("owner")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only an existing owner can modify an owner's access or role.");
        }

        // Non-owners cannot grant the owner role
        if ("owner".equalsIgnoreCase(newRole) && !currentAdmin.getRoles().contains("owner")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only an existing owner can grant the owner role.");
        }
    }

    public UserPermissionsDto resolveEffectivePermissions(User user) {
        Set<String> roleNames = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet());

        // Super administrator / Owner has full privileges
        if (roleNames.contains("owner")) {
            return UserPermissionsDto.builder()
                    .manageAttendance(true)
                    .manageAppointments(true)
                    .manageUsers(true)
                    .manageInventory(true)
                    .manageInventoryReports(true)
                    .build();
        }

        UserPermission customPermissions = user.getPermissions();
        if (customPermissions != null) {
            return UserPermissionsDto.builder()
                    .manageAttendance(customPermissions.isManageAttendance())
                    .manageAppointments(customPermissions.isManageAppointments())
                    .manageUsers(customPermissions.isManageUsers())
                    .manageInventory(customPermissions.isManageInventory())
                    .manageInventoryReports(customPermissions.isManageInventoryReports())
                    .build();
        }

        // Compute defaults based on assigned roles
        return calculateDefaultPermissionsForRoles(roleNames);
    }

    public UserPermissionsDto calculateDefaultPermissionsForRoles(Set<String> roleNames) {
        boolean attendance = false;
        boolean appointments = false;
        boolean users = false;
        boolean inventory = false;
        boolean reports = false;

        for (String role : roleNames) {
            String normalized = role.trim().toLowerCase();
            switch (normalized) {
                case "owner" -> {
                    attendance = true;
                    appointments = true;
                    users = true;
                    inventory = true;
                    reports = true;
                }
                case "editor" -> {
                    attendance = true;
                    appointments = true;
                    inventory = true;
                    reports = true;
                }
                case "store-manager", "store_manager" -> {
                    inventory = true;
                    reports = true;
                }
                case "department-head", "department_head", "auditor" -> {
                    reports = true;
                }
                case "viewer" -> {
                    // viewer has no management permissions by default
                }
            }
        }

        return UserPermissionsDto.builder()
                .manageAttendance(attendance)
                .manageAppointments(appointments)
                .manageUsers(users)
                .manageInventory(inventory)
                .manageInventoryReports(reports)
                .build();
    }

    public Set<GrantedAuthority> buildAuthorities(User user, UserPermissionsDto permissions) {
        Set<GrantedAuthority> authorities = new HashSet<>();

        // Role authorities
        for (Role role : user.getRoles()) {
            String rawName = role.getName();
            // e.g. ROLE_owner, ROLE_OWNER
            authorities.add(new SimpleGrantedAuthority("ROLE_" + rawName.toLowerCase()));
            authorities.add(new SimpleGrantedAuthority("ROLE_" + rawName.toUpperCase().replace('-', '_')));
        }

        // Granular permission authorities
        if (permissions.isManageAttendance()) {
            authorities.add(new SimpleGrantedAuthority("PERM_MANAGE_ATTENDANCE"));
            authorities.add(new SimpleGrantedAuthority("manage-attendance"));
        }
        if (permissions.isManageAppointments()) {
            authorities.add(new SimpleGrantedAuthority("PERM_MANAGE_APPOINTMENTS"));
            authorities.add(new SimpleGrantedAuthority("manage-appointments"));
        }
        if (permissions.isManageUsers()) {
            authorities.add(new SimpleGrantedAuthority("PERM_MANAGE_USERS"));
            authorities.add(new SimpleGrantedAuthority("manage-users"));
        }
        if (permissions.isManageInventory()) {
            authorities.add(new SimpleGrantedAuthority("PERM_MANAGE_INVENTORY"));
            authorities.add(new SimpleGrantedAuthority("manage-inventory"));
        }
        if (permissions.isManageInventoryReports()) {
            authorities.add(new SimpleGrantedAuthority("PERM_MANAGE_INVENTORY_REPORTS"));
            authorities.add(new SimpleGrantedAuthority("view-inventory-reports"));
        }

        return authorities;
    }

    public UserProfileResponse toProfileResponse(User user) {
        UserPermissionsDto permissions = resolveEffectivePermissions(user);
        Set<String> roleNames = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet());

        return UserProfileResponse.builder()
                .id(user.getId())
                .firebaseUid(user.getFirebaseUid())
                .email(user.getEmail())
                .isActive(user.isActive())
                .roles(roleNames)
                .permissions(permissions)
                .build();
    }
}

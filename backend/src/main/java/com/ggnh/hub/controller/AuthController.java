package com.ggnh.hub.controller;

import com.ggnh.hub.dto.UserProfileResponse;
import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.UserPermission;
import com.ggnh.hub.repository.RoleRepository;
import com.ggnh.hub.repository.UserRepository;
import com.ggnh.hub.security.filter.FirebaseAuthenticationFilter;
import com.ggnh.hub.security.firebase.FirebaseTokenHolder;
import com.ggnh.hub.security.model.FirebaseUserDetails;
import com.ggnh.hub.security.service.UserSecurityService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserSecurityService userSecurityService;

    /**
     * Returns the authenticated user's profile and effective permissions from PostgreSQL.
     */
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        if (principal == null || principal.getId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated session.");
        }

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found in database."));

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User account is pending approval.");
        }

        return ResponseEntity.ok(userSecurityService.toProfileResponse(user));
    }

    /**
     * Provisions a new user account linked to a verified Firebase identity.
     * The account is created inactive by default with the least-privileged role (viewer).
     * Client-submitted roles/permissions are never accepted.
     */
    @PostMapping(path = {"/register", "/sync"})
    @Transactional
    public ResponseEntity<UserProfileResponse> registerOrSync(HttpServletRequest request) {
        FirebaseTokenHolder tokenHolder = (FirebaseTokenHolder) request.getAttribute(
                FirebaseAuthenticationFilter.FIREBASE_TOKEN_ATTRIBUTE
        );

        if (tokenHolder == null || tokenHolder.getUid() == null || tokenHolder.getUid().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Valid Firebase ID token in Authorization header is required to provision an account."
            );
        }

        String uid = tokenHolder.getUid();
        String email = tokenHolder.getEmail();

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Firebase token must contain an email address."
            );
        }

        // SEC-01: Enforce verified email requirement for registration and sync
        if (!tokenHolder.isEmailVerified()) {
            log.warn("Refusing registration/sync for unverified email '{}' (UID '{}')", email, uid);
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Email address must be verified before account registration or synchronization."
            );
        }

        String normalizedEmail = email.trim().toLowerCase();

        // 1. Check if user already exists by Firebase UID
        Optional<User> existingByUid = userRepository.findByFirebaseUid(uid);
        if (existingByUid.isPresent()) {
            User user = existingByUid.get();
            Optional<User> byEmail = userRepository.findByEmailIgnoreCase(normalizedEmail);
            if (byEmail.isPresent() && !byEmail.get().getId().equals(user.getId())) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Identity conflict: Firebase UID is already associated with another user account."
                );
            }
            log.info("User with Firebase UID '{}' already exists. Returning current profile.", uid);
            return ResponseEntity.ok(userSecurityService.toProfileResponse(user));
        }

        // 2. Check if user already exists by email (link if UID is not set)
        Optional<User> existingByEmail = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (existingByEmail.isPresent()) {
            User user = existingByEmail.get();
            if (user.getFirebaseUid() == null || user.getFirebaseUid().isBlank()) {
                if (userRepository.findByFirebaseUid(uid).isPresent()) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Firebase UID is already associated with a different user account."
                    );
                }
                log.info("Linking existing user '{}' to Firebase UID '{}'", normalizedEmail, uid);
                user.setFirebaseUid(uid);
                User saved = userRepository.save(user);
                return ResponseEntity.ok(userSecurityService.toProfileResponse(saved));
            } else if (!user.getFirebaseUid().equals(uid)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Email is already associated with a different Firebase account."
                );
            }
            return ResponseEntity.ok(userSecurityService.toProfileResponse(user));
        }

        // 3. Provision new inactive user with least-privileged role 'viewer'
        Role viewerRole = roleRepository.findByName("viewer")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("viewer")
                        .description("Read-only access across clinical and administrative views")
                        .build()));

        Set<Role> roles = new HashSet<>();
        roles.add(viewerRole);

        User newUser = User.builder()
                .firebaseUid(uid)
                .email(normalizedEmail)
                .isActive(false) // Always inactive by default pending administrative approval
                .createdBy("firebase-register")
                .roles(roles)
                .build();

        UserPermission permissions = UserPermission.builder()
                .user(newUser)
                .manageAttendance(false)
                .manageAppointments(false)
                .manageUsers(false)
                .manageInventory(false)
                .manageInventoryReports(false)
                .build();

        newUser.setPermissions(permissions);

        User savedUser = userRepository.save(newUser);
        log.info("Provisioned new pending account for '{}' (UID: {})", normalizedEmail, uid);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userSecurityService.toProfileResponse(savedUser));
    }
}

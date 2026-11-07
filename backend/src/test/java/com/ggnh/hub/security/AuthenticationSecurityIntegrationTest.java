package com.ggnh.hub.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ggnh.hub.dto.UpdateUserAccessRequest;
import com.ggnh.hub.dto.UpdateUserStatusRequest;
import com.ggnh.hub.dto.UserPermissionsDto;
import com.ggnh.hub.entity.Appointment;
import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.UserPermission;
import com.ggnh.hub.repository.AppointmentRepository;
import com.ggnh.hub.repository.RoleRepository;
import com.ggnh.hub.repository.UserPermissionRepository;
import com.ggnh.hub.repository.UserRepository;
import com.ggnh.hub.security.firebase.FirebaseTokenHolder;
import com.ggnh.hub.security.firebase.FirebaseTokenVerifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AuthenticationSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserPermissionRepository userPermissionRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private com.ggnh.hub.repository.AppointmentIdempotencyRepository idempotencyRepository;

    @Autowired
    private com.ggnh.hub.repository.AppointmentOutboxRepository outboxRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private Role ownerRole;
    private Role editorRole;
    private Role viewerRole;

    @BeforeEach
    void setup() {
        userPermissionRepository.deleteAll();
        userRepository.deleteAll();
        outboxRepository.deleteAll();
        idempotencyRepository.deleteAll();
        appointmentRepository.deleteAll();

        ownerRole = roleRepository.findByName("owner")
                .orElseGet(() -> roleRepository.save(Role.builder().name("owner").description("Owner").build()));
        editorRole = roleRepository.findByName("editor")
                .orElseGet(() -> roleRepository.save(Role.builder().name("editor").description("Editor").build()));
        viewerRole = roleRepository.findByName("viewer")
                .orElseGet(() -> roleRepository.save(Role.builder().name("viewer").description("Viewer").build()));
    }

    private User createDatabaseUser(String email, String firebaseUid, boolean active, Role role) {
        Set<Role> roles = new HashSet<>();
        if (role != null) {
            roles.add(role);
        }

        User user = User.builder()
                .email(email)
                .firebaseUid(firebaseUid)
                .isActive(active)
                .roles(roles)
                .createdBy("test-setup")
                .build();

        return userRepository.save(user);
    }

    private FirebaseTokenHolder buildMockTokenHolder(String uid, String email) {
        return FirebaseTokenHolder.builder()
                .uid(uid)
                .email(email)
                .emailVerified(true)
                .claims(Collections.emptyMap())
                .build();
    }

    // 1. Valid Firebase identity mapped to an active database user -> 200 OK
    @Test
    @DisplayName("Scenario 1: Valid Firebase identity mapped to an active user can access /auth/me")
    void validFirebaseIdentity_ActiveUser_ReturnsOk() throws Exception {
        String token = "valid-active-token";
        String uid = "firebase-uid-active-1";
        String email = "active@ggnh.org";

        createDatabaseUser(email, uid, true, editorRole);

        when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildMockTokenHolder(uid, email));

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is(email)))
                .andExpect(jsonPath("$.firebaseUid", is(uid)))
                .andExpect(jsonPath("$.active", is(true)))
                .andExpect(jsonPath("$.roles", hasItem("editor")))
                .andExpect(jsonPath("$.permissions.manageAttendance", is(true)))
                .andExpect(jsonPath("$.permissions.manageUsers", is(false)));
    }

    // 2. Invalid Firebase token rejected -> 401 Unauthorized
    @Test
    @DisplayName("Scenario 2: Invalid Firebase token is rejected with 401 Unauthorized")
    void invalidFirebaseToken_ReturnsUnauthorized() throws Exception {
        String invalidToken = "invalid-token";
        when(tokenVerifier.verifyToken(eq(invalidToken)))
                .thenThrow(new IllegalArgumentException("Malformed token signature"));

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + invalidToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")))
                .andExpect(jsonPath("$.message", containsString("Invalid, expired, or revoked Firebase token")));
    }

    // 3. Expired or revoked token rejected -> 401 Unauthorized
    @Test
    @DisplayName("Scenario 3: Expired or revoked Firebase token is rejected with 401 Unauthorized")
    void expiredOrRevokedToken_ReturnsUnauthorized() throws Exception {
        String expiredToken = "expired-token";
        when(tokenVerifier.verifyToken(eq(expiredToken)))
                .thenThrow(new SecurityException("Firebase ID token has expired"));

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")))
                .andExpect(jsonPath("$.message", containsString("Firebase ID token has expired")));
    }

    // 4. Unknown Firebase UID rejected -> 401 Unauthorized
    @Test
    @DisplayName("Scenario 4: Valid Firebase token with unknown UID in database is rejected with 401")
    void unknownFirebaseUid_ReturnsUnauthorized() throws Exception {
        String token = "unknown-user-token";
        String unknownUid = "firebase-uid-unknown-999";
        String email = "stranger@external.com";

        when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildMockTokenHolder(unknownUid, email));

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("Unauthorized")))
                .andExpect(jsonPath("$.message", containsString("User account not found in database")));
    }

    // 5. Inactive user rejected -> 403 Forbidden
    @Test
    @DisplayName("Scenario 5: Inactive or unapproved user is rejected with 403 Forbidden")
    void inactiveUser_ReturnsForbidden() throws Exception {
        String token = "inactive-user-token";
        String uid = "firebase-uid-inactive-1";
        String email = "pending@ggnh.org";

        createDatabaseUser(email, uid, false, viewerRole);

        when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildMockTokenHolder(uid, email));

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", is("Forbidden")))
                .andExpect(jsonPath("$.message", containsString("Account pending approval or inactive")));
    }

    // 6. Active user with correct role can access an authorized endpoint -> 200 OK
    @Test
    @DisplayName("Scenario 6: Active user with owner role can access admin /users endpoint")
    void activeUserWithRole_CanAccessAuthorizedEndpoint() throws Exception {
        String token = "owner-token";
        String uid = "firebase-uid-owner";
        String email = "owner@ggnh.org";

        createDatabaseUser(email, uid, true, ownerRole);

        when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildMockTokenHolder(uid, email));

        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(Iterable.class)));
    }

    // 7. Active user without required permission receives 403 Forbidden
    @Test
    @DisplayName("Scenario 7: Active user without required permission receives 403 Forbidden on protected endpoint")
    void activeUserWithoutPermission_ReceivesForbidden() throws Exception {
        String token = "viewer-token";
        String uid = "firebase-uid-viewer";
        String email = "viewer@ggnh.org";

        createDatabaseUser(email, uid, true, viewerRole);

        when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildMockTokenHolder(uid, email));

        // Viewer does not have PERM_MANAGE_USERS or role 'owner'
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", is("Forbidden")));
    }

    // 8. Public endpoints remain accessible without Authorization header
    @Test
    @DisplayName("Scenario 8: Public endpoint /appointments is accessible without Authorization header")
    void publicEndpoints_AccessibleWithoutAuth() throws Exception {
        Appointment appointment = Appointment.builder()
                .patientName("Jane Doe")
                .patientEmail("jane@example.com")
                .patientPhone("1234567890")
                .doctorName("Dr. Smith")
                .message("Routine checkup")
                .build();

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", java.util.UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(appointment)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.patientName", is("Jane Doe")));
    }

    // 9. Client-supplied roles cannot override database permissions
    @Test
    @DisplayName("Scenario 9: Client-supplied roles in claims or register request cannot elevate database privileges")
    void clientSuppliedRoles_CannotOverrideDatabasePermissions() throws Exception {
        String token = "client-elevation-token";
        String uid = "firebase-uid-elevation";
        String email = "hacker@test.com";

        // Client attempts to send 'role: owner' in custom claims
        FirebaseTokenHolder tokenWithFakeClaims = FirebaseTokenHolder.builder()
                .uid(uid)
                .email(email)
                .emailVerified(true)
                .claims(Map.of("role", "owner", "admin", true))
                .build();

        when(tokenVerifier.verifyToken(eq(token))).thenReturn(tokenWithFakeClaims);

        // Self-register via /auth/register
        mockMvc.perform(post("/auth/register")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roles", hasItem("viewer"))) // Must be viewer, not owner
                .andExpect(jsonPath("$.active", is(false)))        // Inactive by default
                .andExpect(jsonPath("$.permissions.manageUsers", is(false)));
    }

    // 10. Authentication context is cleared between requests
    @Test
    @DisplayName("Scenario 10: SecurityContext is completely cleared between requests")
    void securityContext_ClearedBetweenRequests() throws Exception {
        String token = "valid-cleared-token";
        String uid = "firebase-uid-cleared";
        String email = "cleared@ggnh.org";

        createDatabaseUser(email, uid, true, editorRole);
        when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildMockTokenHolder(uid, email));

        // First request with token succeeds
        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Context holder must be null on current thread
        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "SecurityContextHolder should be empty after request processing finishes");

        // Subsequent request without token must fail
        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    // Additional: Automatic linking by verified email when firebase_uid is not set
    @Test
    @DisplayName("Additional: User with pre-existing email in DB is safely linked to new Firebase UID")
    void automaticUidLinking_ForExistingEmail() throws Exception {
        String token = "link-token";
        String uid = "new-firebase-uid-456";
        String email = "legacy@ggnh.org";

        // Create pre-existing user without Firebase UID
        createDatabaseUser(email, null, true, editorRole);
        when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildMockTokenHolder(uid, email));

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firebaseUid", is(uid)))
                .andExpect(jsonPath("$.email", is(email)));
    }

    // Additional: User Access Controller approval flow
    @Test
    @DisplayName("Additional: Owner can approve user and modify access")
    void ownerCanApproveAndModifyUserAccess() throws Exception {
        String ownerToken = "owner-admin-token";
        String ownerUid = "owner-uid-1";
        String ownerEmail = "owner@ggnh.org";
        User ownerUser = createDatabaseUser(ownerEmail, ownerUid, true, ownerRole);

        String pendingUid = "pending-uid-2";
        String pendingEmail = "pending-user@ggnh.org";
        User pendingUser = createDatabaseUser(pendingEmail, pendingUid, false, viewerRole);

        when(tokenVerifier.verifyToken(eq(ownerToken))).thenReturn(buildMockTokenHolder(ownerUid, ownerEmail));

        // 1. Approve user (PATCH /users/{id}/status)
        UpdateUserStatusRequest statusRequest = new UpdateUserStatusRequest(true);
        mockMvc.perform(patch("/users/" + pendingUser.getId() + "/status")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active", is(true)));

        // 2. Change role and granular permissions (PUT /users/{id}/access)
        UpdateUserAccessRequest accessRequest = new UpdateUserAccessRequest(
                "editor",
                UserPermissionsDto.builder().manageAttendance(true).manageAppointments(true).build()
        );
        mockMvc.perform(put("/users/" + pendingUser.getId() + "/access")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(accessRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles", hasItem("editor")))
                .andExpect(jsonPath("$.permissions.manageAttendance", is(true)));
    }
}


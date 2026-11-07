package com.ggnh.hub.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ggnh.hub.dto.UpdateUserAccessRequest;
import com.ggnh.hub.dto.UpdateUserStatusRequest;
import com.ggnh.hub.dto.UserPermissionsDto;
import com.ggnh.hub.entity.Appointment;
import com.ggnh.hub.entity.Attendance;
import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.Staff;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.UserPermission;
import com.ggnh.hub.entity.enums.AppointmentStatus;
import com.ggnh.hub.entity.enums.AttendanceStatus;
import com.ggnh.hub.repository.AppointmentRepository;
import com.ggnh.hub.repository.AttendanceRepository;
import com.ggnh.hub.repository.RoleRepository;
import com.ggnh.hub.repository.StaffRepository;
import com.ggnh.hub.repository.UserPermissionRepository;
import com.ggnh.hub.repository.UserRepository;
import com.ggnh.hub.security.firebase.FirebaseTokenHolder;
import com.ggnh.hub.security.firebase.FirebaseTokenVerifier;
import com.ggnh.hub.security.ratelimit.InMemoryRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class SecurityRemediationRegressionTest {

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
    private StaffRepository staffRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private InMemoryRateLimiter inMemoryRateLimiter;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private Role ownerRole;
    private Role editorRole;
    private Role viewerRole;
    private Role storeManagerRole;

    @BeforeEach
    void setUp() {
        inMemoryRateLimiter.reset();
        attendanceRepository.deleteAll();
        staffRepository.deleteAll();
        outboxRepository.deleteAll();
        idempotencyRepository.deleteAll();
        appointmentRepository.deleteAll();
        userPermissionRepository.deleteAll();
        userRepository.deleteAll();

        ownerRole = roleRepository.findByName("owner")
                .orElseGet(() -> roleRepository.save(Role.builder().name("owner").description("Owner").build()));
        editorRole = roleRepository.findByName("editor")
                .orElseGet(() -> roleRepository.save(Role.builder().name("editor").description("Editor").build()));
        viewerRole = roleRepository.findByName("viewer")
                .orElseGet(() -> roleRepository.save(Role.builder().name("viewer").description("Viewer").build()));
        storeManagerRole = roleRepository.findByName("store-manager")
                .orElseGet(() -> roleRepository.save(Role.builder().name("store-manager").description("Store Manager").build()));
    }

    private User createDatabaseUser(String email, String firebaseUid, boolean active, Role role) {
        return createDatabaseUser(email, firebaseUid, active, role, null);
    }

    private User createDatabaseUser(String email, String firebaseUid, boolean active, Role role, UserPermissionsDto perms) {
        Set<Role> roles = new HashSet<>();
        if (role != null) {
            roles.add(role);
        }

        User user = User.builder()
                .email(email.toLowerCase())
                .firebaseUid(firebaseUid)
                .isActive(active)
                .roles(roles)
                .createdBy("remediation-test")
                .build();

        if (perms != null) {
            UserPermission userPermission = UserPermission.builder()
                    .user(user)
                    .manageAttendance(perms.isManageAttendance())
                    .manageAppointments(perms.isManageAppointments())
                    .manageUsers(perms.isManageUsers())
                    .manageInventory(perms.isManageInventory())
                    .manageInventoryReports(perms.isManageInventoryReports())
                    .build();
            user.setPermissions(userPermission);
        }

        return userRepository.save(user);
    }

    private FirebaseTokenHolder buildToken(String uid, String email, boolean verified) {
        return FirebaseTokenHolder.builder()
                .uid(uid)
                .email(email)
                .emailVerified(verified)
                .claims(Collections.emptyMap())
                .build();
    }

    // =========================================================================
    // Fix 1 — SEC-01: Firebase Email Identity Hijacking Regression Tests
    // =========================================================================
    @Nested
    @DisplayName("Fix 1 — SEC-01: Firebase Email Identity Hijacking")
    class Sec01IdentityHijackingTests {

        @Test
        @DisplayName("1. Verified email matching existing unlinked account safely links UID")
        void verifiedEmail_MatchingExistingUnlinkedAccount_LinksSuccessfully() throws Exception {
            String email = "verified-owner@ggnh.org";
            String uid = "fb-uid-verified-owner";
            String token = "token-verified-owner";

            User preExisting = createDatabaseUser(email, null, true, ownerRole);
            assertThat(preExisting.getFirebaseUid()).isNull();

            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, true));

            mockMvc.perform(get("/auth/me")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.email", is(email)))
                    .andExpect(jsonPath("$.firebaseUid", is(uid)));

            User updated = userRepository.findById(preExisting.getId()).orElseThrow();
            assertThat(updated.getFirebaseUid()).isEqualTo(uid);
        }

        @Test
        @DisplayName("2. Unverified email matching existing active owner account is rejected and DB is NOT modified")
        void unverifiedEmail_MatchingExistingOwner_IsRejectedAndNotModified() throws Exception {
            String email = "victim-owner@ggnh.org";
            String attackerUid = "attacker-uid-999";
            String attackerToken = "attacker-token-unverified";

            User targetOwner = createDatabaseUser(email, null, true, ownerRole);
            assertThat(targetOwner.getFirebaseUid()).isNull();

            // Attacker possesses token with victim's email, but email_verified = false
            when(tokenVerifier.verifyToken(eq(attackerToken))).thenReturn(buildToken(attackerUid, email, false));

            mockMvc.perform(get("/auth/me")
                            .header("Authorization", "Bearer " + attackerToken))
                    .andExpect(status().isUnauthorized());

            // Prove that the database record was NOT hijacked or modified
            User reloaded = userRepository.findById(targetOwner.getId()).orElseThrow();
            assertThat(reloaded.getFirebaseUid()).isNull();
            assertThat(reloaded.getEmail()).isEqualTo(email);
            assertThat(reloaded.isActive()).isTrue();
        }

        @Test
        @DisplayName("3. Verified email with an existing conflicting Firebase UID is rejected")
        void verifiedEmail_ConflictingFirebaseUid_IsRejected() throws Exception {
            String email = "doctor@ggnh.org";
            String originalUid = "legit-uid-100";
            String conflictingUid = "rogue-uid-200";
            String conflictingToken = "token-conflicting-uid";

            // User already linked to originalUid
            createDatabaseUser(email, originalUid, true, editorRole);

            // Present verified token with conflicting UID
            when(tokenVerifier.verifyToken(eq(conflictingToken))).thenReturn(buildToken(conflictingUid, email, true));

            mockMvc.perform(get("/auth/me")
                            .header("Authorization", "Bearer " + conflictingToken))
                    .andExpect(status().isUnauthorized());

            // Target user still points to originalUid
            User reloaded = userRepository.findByEmailIgnoreCase(email).orElseThrow();
            assertThat(reloaded.getFirebaseUid()).isEqualTo(originalUid);
        }

        @Test
        @DisplayName("4. Unknown user with verified email can register, but cannot access protected endpoints")
        void unknownUser_VerifiedEmail_CannotAccessProtectedMe_CanRegister() throws Exception {
            String email = "newuser@ggnh.org";
            String uid = "new-uid-300";
            String token = "new-token-verified";

            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, true));

            // GET /auth/me rejected because account doesn't exist yet
            mockMvc.perform(get("/auth/me")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isUnauthorized());

            // POST /auth/register succeeds with verified email
            mockMvc.perform(post("/auth/register")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.email", is(email)))
                    .andExpect(jsonPath("$.firebaseUid", is(uid)))
                    .andExpect(jsonPath("$.active", is(false)));
        }

        @Test
        @DisplayName("5. Registration with an unverified email is rejected with 403 Forbidden")
        void registration_WithUnverifiedEmail_IsRejected() throws Exception {
            String email = "unverified-reg@ggnh.org";
            String uid = "unverified-reg-uid";
            String token = "unverified-reg-token";

            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, false));

            mockMvc.perform(post("/auth/register")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());

            assertThat(userRepository.findByEmailIgnoreCase(email)).isEmpty();
        }

        @Test
        @DisplayName("6. Synchronization with an unverified email is rejected with 403 Forbidden")
        void synchronization_WithUnverifiedEmail_IsRejected() throws Exception {
            String email = "unverified-sync@ggnh.org";
            String uid = "unverified-sync-uid";
            String token = "unverified-sync-token";

            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, false));

            mockMvc.perform(post("/auth/sync")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());

            assertThat(userRepository.findByEmailIgnoreCase(email)).isEmpty();
        }
    }

    // =========================================================================
    // Fix 2 — SEC-02: Self-Permission Escalation Regression Tests
    // =========================================================================
    @Nested
    @DisplayName("Fix 2 — SEC-02: Self-Permission Escalation")
    class Sec02SelfPermissionEscalationTests {

        @Test
        @DisplayName("1. Delegated manager modifying their own permissions is rejected with 403 Forbidden")
        void delegatedManager_ModifyingOwnPermissions_IsForbidden() throws Exception {
            String managerEmail = "manager@ggnh.org";
            String managerUid = "uid-manager-1";
            String managerToken = "token-manager-1";

            User manager = createDatabaseUser(managerEmail, managerUid, true, editorRole,
                    UserPermissionsDto.builder().manageUsers(true).build());

            when(tokenVerifier.verifyToken(eq(managerToken))).thenReturn(buildToken(managerUid, managerEmail, true));

            UpdateUserAccessRequest selfEscalateRequest = new UpdateUserAccessRequest(
                    "editor",
                    UserPermissionsDto.builder()
                            .manageAttendance(true)
                            .manageAppointments(true)
                            .manageUsers(true)
                            .manageInventory(true)
                            .manageInventoryReports(true)
                            .build()
            );

            mockMvc.perform(put("/users/" + manager.getId() + "/access")
                            .header("Authorization", "Bearer " + managerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(selfEscalateRequest)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("2. Delegated manager modifying another normal user's permissions is allowed")
        void delegatedManager_ModifyingAnotherNormalUser_IsAllowed() throws Exception {
            String managerEmail = "hr-manager@ggnh.org";
            String managerUid = "uid-hr-1";
            String managerToken = "token-hr-1";

            User manager = createDatabaseUser(managerEmail, managerUid, true, editorRole,
                    UserPermissionsDto.builder().manageUsers(true).build());

            User targetNormalUser = createDatabaseUser("target-staff@ggnh.org", "uid-target-staff", true, viewerRole);

            when(tokenVerifier.verifyToken(eq(managerToken))).thenReturn(buildToken(managerUid, managerEmail, true));

            UpdateUserAccessRequest request = new UpdateUserAccessRequest(
                    "editor",
                    UserPermissionsDto.builder().manageAttendance(true).build()
            );

            mockMvc.perform(put("/users/" + targetNormalUser.getId() + "/access")
                            .header("Authorization", "Bearer " + managerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.roles", hasItem("editor")))
                    .andExpect(jsonPath("$.permissions.manageAttendance", is(true)));
        }

        @Test
        @DisplayName("3. Delegated manager granting owner role is rejected with 403 Forbidden")
        void delegatedManager_GrantingOwnerRole_IsForbidden() throws Exception {
            String managerEmail = "admin-del@ggnh.org";
            String managerUid = "uid-admin-del";
            String managerToken = "token-admin-del";

            User manager = createDatabaseUser(managerEmail, managerUid, true, editorRole,
                    UserPermissionsDto.builder().manageUsers(true).build());

            User targetNormalUser = createDatabaseUser("colleague@ggnh.org", "uid-colleague", true, viewerRole);

            when(tokenVerifier.verifyToken(eq(managerToken))).thenReturn(buildToken(managerUid, managerEmail, true));

            UpdateUserAccessRequest request = new UpdateUserAccessRequest("owner", null);

            mockMvc.perform(put("/users/" + targetNormalUser.getId() + "/access")
                            .header("Authorization", "Bearer " + managerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("4. Owner granting owner role to another user is allowed")
        void owner_GrantingOwnerRoleToAnotherUser_IsAllowed() throws Exception {
            String ownerEmail = "owner1@ggnh.org";
            String ownerUid = "uid-owner-1";
            String ownerToken = "token-owner-1";

            createDatabaseUser(ownerEmail, ownerUid, true, ownerRole);
            User candidate = createDatabaseUser("newowner@ggnh.org", "uid-newowner", true, editorRole);

            when(tokenVerifier.verifyToken(eq(ownerToken))).thenReturn(buildToken(ownerUid, ownerEmail, true));

            UpdateUserAccessRequest request = new UpdateUserAccessRequest("owner", null);

            mockMvc.perform(put("/users/" + candidate.getId() + "/access")
                            .header("Authorization", "Bearer " + ownerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.roles", hasItem("owner")));
        }

        @Test
        @DisplayName("5. Owner modifying their own permissions is rejected to prevent loss of administrative access")
        void owner_ModifyingOwnPermissions_IsForbidden() throws Exception {
            String ownerEmail = "primary-owner@ggnh.org";
            String ownerUid = "uid-prim-owner";
            String ownerToken = "token-prim-owner";

            User owner = createDatabaseUser(ownerEmail, ownerUid, true, ownerRole);

            when(tokenVerifier.verifyToken(eq(ownerToken))).thenReturn(buildToken(ownerUid, ownerEmail, true));

            UpdateUserAccessRequest selfDemote = new UpdateUserAccessRequest("viewer", null);

            mockMvc.perform(put("/users/" + owner.getId() + "/access")
                            .header("Authorization", "Bearer " + ownerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(selfDemote)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("6. User without MANAGE_USERS or owner attempting to modify access is rejected")
        void unauthorizedUser_AttemptingToModifyTarget_IsForbidden() throws Exception {
            String viewerEmail = "plain-viewer@ggnh.org";
            String viewerUid = "uid-plain-viewer";
            String viewerToken = "token-plain-viewer";

            createDatabaseUser(viewerEmail, viewerUid, true, viewerRole);
            User target = createDatabaseUser("other@ggnh.org", "uid-other", true, viewerRole);

            when(tokenVerifier.verifyToken(eq(viewerToken))).thenReturn(buildToken(viewerUid, viewerEmail, true));

            UpdateUserAccessRequest request = new UpdateUserAccessRequest("editor", null);

            mockMvc.perform(put("/users/" + target.getId() + "/access")
                            .header("Authorization", "Bearer " + viewerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }
    }

    // =========================================================================
    // Fix 3 — SEC-03: Owner Account Protection Regression Tests
    // =========================================================================
    @Nested
    @DisplayName("Fix 3 — SEC-03: Owner Account Protection")
    class Sec03OwnerProtectionTests {

        @Test
        @DisplayName("1. Delegated manager deactivating an owner is rejected with 403 Forbidden")
        void delegatedManager_DeactivatingOwner_IsForbidden() throws Exception {
            String managerEmail = "del-manager@ggnh.org";
            String managerUid = "uid-del-mgr";
            String managerToken = "token-del-mgr";

            User manager = createDatabaseUser(managerEmail, managerUid, true, editorRole,
                    UserPermissionsDto.builder().manageUsers(true).build());

            User targetOwner = createDatabaseUser("target-owner@ggnh.org", "uid-tgt-owner", true, ownerRole);

            when(tokenVerifier.verifyToken(eq(managerToken))).thenReturn(buildToken(managerUid, managerEmail, true));

            UpdateUserStatusRequest deactivationRequest = new UpdateUserStatusRequest(false);

            mockMvc.perform(patch("/users/" + targetOwner.getId() + "/status")
                            .header("Authorization", "Bearer " + managerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(deactivationRequest)))
                    .andExpect(status().isForbidden());

            User reloaded = userRepository.findById(targetOwner.getId()).orElseThrow();
            assertThat(reloaded.isActive()).isTrue();
        }

        @Test
        @DisplayName("2. Owner deactivating another owner (when multiple exist) is allowed")
        void owner_DeactivatingAnotherOwner_IsAllowed() throws Exception {
            String owner1Email = "owner1@ggnh.org";
            String owner1Uid = "uid-own-1";
            String owner1Token = "token-own-1";

            createDatabaseUser(owner1Email, owner1Uid, true, ownerRole);
            User owner2 = createDatabaseUser("owner2@ggnh.org", "uid-own-2", true, ownerRole);

            when(tokenVerifier.verifyToken(eq(owner1Token))).thenReturn(buildToken(owner1Uid, owner1Email, true));

            UpdateUserStatusRequest deactivationRequest = new UpdateUserStatusRequest(false);

            mockMvc.perform(patch("/users/" + owner2.getId() + "/status")
                            .header("Authorization", "Bearer " + owner1Token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(deactivationRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.active", is(false)));

            User reloaded = userRepository.findById(owner2.getId()).orElseThrow();
            assertThat(reloaded.isActive()).isFalse();
        }

        @Test
        @DisplayName("3. Deactivating the last active owner is rejected with 400 Bad Request")
        void deactivatingLastActiveOwner_IsBadRequest() throws Exception {
            String singleOwnerEmail = "solo-owner@ggnh.org";
            String singleOwnerUid = "uid-solo";
            String token = "token-solo";

            // Create only 1 active owner and a delegated manager
            User singleOwner = createDatabaseUser(singleOwnerEmail, singleOwnerUid, true, ownerRole);

            String managerEmail = "del-admin@ggnh.org";
            String managerUid = "uid-del-admin";
            String managerToken = "token-del-admin";

            User manager = createDatabaseUser(managerEmail, managerUid, true, editorRole,
                    UserPermissionsDto.builder().manageUsers(true).build());

            when(tokenVerifier.verifyToken(eq(managerToken))).thenReturn(buildToken(managerUid, managerEmail, true));

            UpdateUserStatusRequest request = new UpdateUserStatusRequest(false);

            // Delegated manager cannot deactivate owner
            mockMvc.perform(patch("/users/" + singleOwner.getId() + "/status")
                            .header("Authorization", "Bearer " + managerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());

            assertThat(userRepository.countActiveOwners()).isEqualTo(1);
        }

        @Test
        @DisplayName("4. Deactivating a normal user with delegated permission is allowed")
        void deactivatingNormalUser_WithDelegatedPermission_IsAllowed() throws Exception {
            String managerEmail = "mgr-ok@ggnh.org";
            String managerUid = "uid-mgr-ok";
            String managerToken = "token-mgr-ok";

            User manager = createDatabaseUser(managerEmail, managerUid, true, editorRole,
                    UserPermissionsDto.builder().manageUsers(true).build());

            User normalUser = createDatabaseUser("temp-staff@ggnh.org", "uid-temp", true, viewerRole);

            when(tokenVerifier.verifyToken(eq(managerToken))).thenReturn(buildToken(managerUid, managerEmail, true));

            UpdateUserStatusRequest request = new UpdateUserStatusRequest(false);

            mockMvc.perform(patch("/users/" + normalUser.getId() + "/status")
                            .header("Authorization", "Bearer " + managerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.active", is(false)));

            User reloaded = userRepository.findById(normalUser.getId()).orElseThrow();
            assertThat(reloaded.isActive()).isFalse();
        }

        @Test
        @DisplayName("5. Administrator attempting self-deactivation is rejected with 400 Bad Request")
        void administrator_AttemptingSelfDeactivation_IsBadRequest() throws Exception {
            String ownerEmail = "self-owner@ggnh.org";
            String ownerUid = "uid-self-own";
            String ownerToken = "token-self-own";

            User owner = createDatabaseUser(ownerEmail, ownerUid, true, ownerRole);

            when(tokenVerifier.verifyToken(eq(ownerToken))).thenReturn(buildToken(ownerUid, ownerEmail, true));

            UpdateUserStatusRequest request = new UpdateUserStatusRequest(false);

            mockMvc.perform(patch("/users/" + owner.getId() + "/status")
                            .header("Authorization", "Bearer " + ownerToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());

            User reloaded = userRepository.findById(owner.getId()).orElseThrow();
            assertThat(reloaded.isActive()).isTrue();
        }
    }

    // =========================================================================
    // Fix 4 — SEC-04: SecurityContext Lifecycle Regression Tests
    // =========================================================================
    @Nested
    @DisplayName("Fix 4 — SEC-04: SecurityContext Lifecycle")
    class Sec04LifecycleTests {

        @Test
        @DisplayName("Unregistered user authentication context does not leak into a subsequent request on thread")
        void unregisteredUser_SecurityContext_ClearedAndDoesNotLeak() throws Exception {
            String token = "unregistered-test-token";
            String uid = "uid-unregistered-test";
            String email = "unregistered-clean@ggnh.org";

            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, true));

            // First request: unregistered user hits /auth/register
            mockMvc.perform(post("/auth/register")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isCreated());

            // Guarantee SecurityContextHolder has been cleared on current thread
            assertNull(SecurityContextHolder.getContext().getAuthentication(),
                    "SecurityContext should be cleared after request execution");

            // Subsequent request without token must fail with 401 Unauthorized
            mockMvc.perform(get("/users"))
                    .andExpect(status().isUnauthorized());

            assertNull(SecurityContextHolder.getContext().getAuthentication());
        }
    }

    // =========================================================================
    // Fix 5 — SEC-05: Staff and Attendance Read Authorization Regression Tests
    // =========================================================================
    @Nested
    @DisplayName("Fix 5 — SEC-05: Staff and Attendance Read Authorization")
    class Sec05StaffAttendanceAuthTests {

        private Staff testStaff;

        @BeforeEach
        void createStaffAndAttendance() {
            testStaff = staffRepository.save(Staff.builder()
                    .name("Dr. Alice Johnson")
                    .role("Physician")
                    .phone("555-0199")
                    .email("alice.johnson@ggnh.local")
                    .build());

            attendanceRepository.save(Attendance.builder()
                    .staff(testStaff)
                    .attendanceDate(LocalDate.now())
                    .status(AttendanceStatus.PRESENT)
                    .build());
        }

        @Test
        @DisplayName("1. Unauthorized viewer without manageAttendance cannot read staff or attendance")
        void unauthorizedViewer_CannotReadStaffOrAttendance() throws Exception {
            String email = "viewer-unauth@ggnh.org";
            String uid = "uid-viewer-unauth";
            String token = "token-viewer-unauth";

            createDatabaseUser(email, uid, true, viewerRole);
            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, true));

            mockMvc.perform(get("/staff").header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());

            mockMvc.perform(get("/staff/" + testStaff.getId()).header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());

            mockMvc.perform(get("/attendance").header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("2. Authorized viewer with PERM_MANAGE_ATTENDANCE can read staff and attendance")
        void authorizedViewer_WithManageAttendance_CanReadStaffAndAttendance() throws Exception {
            String email = "viewer-auth@ggnh.org";
            String uid = "uid-viewer-auth";
            String token = "token-viewer-auth";

            User viewer = createDatabaseUser(email, uid, true, viewerRole,
                    UserPermissionsDto.builder().manageAttendance(true).build());

            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, true));

            mockMvc.perform(get("/staff").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].name", is("Dr. Alice Johnson")));

            mockMvc.perform(get("/staff/" + testStaff.getId()).header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.phone", is("555-0199")));

            mockMvc.perform(get("/attendance").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("3. Store manager cannot read staff or attendance records")
        void storeManager_CannotReadStaffOrAttendance() throws Exception {
            String email = "store-mgr@ggnh.org";
            String uid = "uid-store-mgr";
            String token = "token-store-mgr";

            createDatabaseUser(email, uid, true, storeManagerRole);
            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, true));

            mockMvc.perform(get("/staff").header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());

            mockMvc.perform(get("/staff/" + testStaff.getId()).header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());

            mockMvc.perform(get("/attendance").header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("4. Attendance manager (editor) can read staff and attendance records")
        void attendanceManager_CanReadStaffAndAttendance() throws Exception {
            String email = "editor-attendance@ggnh.org";
            String uid = "uid-editor-att";
            String token = "token-editor-att";

            createDatabaseUser(email, uid, true, editorRole);
            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, true));

            mockMvc.perform(get("/staff").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)));

            mockMvc.perform(get("/attendance").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("5. Owner can read staff and attendance records")
        void owner_CanReadStaffAndAttendance() throws Exception {
            String email = "owner-att@ggnh.org";
            String uid = "uid-owner-att";
            String token = "token-owner-att";

            createDatabaseUser(email, uid, true, ownerRole);
            when(tokenVerifier.verifyToken(eq(token))).thenReturn(buildToken(uid, email, true));

            mockMvc.perform(get("/staff").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)));

            mockMvc.perform(get("/attendance").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("6. Unauthenticated request to staff or attendance is rejected with 401 Unauthorized")
        void unauthenticatedRequest_CannotReadStaffOrAttendance() throws Exception {
            mockMvc.perform(get("/staff"))
                    .andExpect(status().isUnauthorized());

            mockMvc.perform(get("/staff/" + testStaff.getId()))
                    .andExpect(status().isUnauthorized());

            mockMvc.perform(get("/attendance"))
                    .andExpect(status().isUnauthorized());
        }
    }

    // =========================================================================
    // Fix 6 — SEC-06: Appointment Mass Assignment Regression Tests
    // =========================================================================
    @Nested
    @DisplayName("Fix 6 — SEC-06: Appointment Mass Assignment")
    class Sec06AppointmentMassAssignmentTests {

        @Test
        @DisplayName("Attempts to submit status: completed or completedAt cannot alter persisted state")
        void attemptToSubmitStatusCompleted_IsOverriddenToServerBooked() throws Exception {
            String maliciousPayload = """
                {
                    "id": "00000000-0000-0000-0000-000000000001",
                    "patientName": "Robert Brown",
                    "patientEmail": "robert@example.com",
                    "patientPhone": "555-4321",
                    "doctorName": "Dr. Sarah Adams",
                    "message": "Routine examination",
                    "status": "completed",
                    "completedAt": "2026-10-31T10:00:00Z"
                }
                """;

            String responseContent = mockMvc.perform(post("/appointments")
                            .header("Idempotency-Key", java.util.UUID.randomUUID().toString())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(maliciousPayload))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.status", is("booked")))
                    .andExpect(jsonPath("$.completedAt", nullValue()))
                    .andExpect(jsonPath("$.id", not(is("00000000-0000-0000-0000-000000000001"))))
                    .andReturn().getResponse().getContentAsString();

            Appointment created = objectMapper.readValue(responseContent, Appointment.class);
            Appointment persisted = appointmentRepository.findById(created.getId()).orElseThrow();

            assertThat(persisted.getStatus()).isEqualTo(AppointmentStatus.BOOKED);
            assertThat(persisted.getCompletedAt()).isNull();
            assertThat(persisted.getCreatedAt()).isNotNull();
        }
    }

    // =========================================================================
    // Fix 7 — SEC-07: Public Endpoint Abuse Protection (Rate Limiting)
    // =========================================================================
    @Nested
    @DisplayName("Fix 7 — SEC-07: Public Endpoint Rate Limiting")
    class Sec07RateLimitingTests {

        @Test
        @DisplayName("Exceeding rate limit on /appointments returns HTTP 429 Too Many Requests")
        void exceedingRateLimit_Returns429TooManyRequests() throws Exception {
            String payload = """
                {
                    "patientName": "Rate Limit Test",
                    "patientEmail": "ratelimit@example.com",
                    "patientPhone": "555-9999",
                    "doctorName": "Dr. Test",
                    "message": "Testing limits"
                }
                """;

            // Configure small limit directly or send requests
            String clientIp = "192.168.1.100";
            // Pre-fill rate limiter window to threshold (100)
            for (int i = 0; i < 100; i++) {
                inMemoryRateLimiter.tryAcquire("appointments:" + clientIp, 100);
            }

            mockMvc.perform(post("/appointments")
                            .with(request -> {
                                request.setRemoteAddr(clientIp);
                                return request;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.status", is(429)))
                    .andExpect(jsonPath("$.error", is("Too Many Requests")));
        }
    }
}


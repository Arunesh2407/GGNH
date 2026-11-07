package com.ggnh.hub.appointment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ggnh.hub.dto.CreateAppointmentRequest;
import com.ggnh.hub.entity.Appointment;
import com.ggnh.hub.entity.AppointmentIdempotency;
import com.ggnh.hub.entity.AppointmentOutbox;
import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.enums.AppointmentStatus;
import com.ggnh.hub.repository.*;
import com.ggnh.hub.security.firebase.FirebaseTokenHolder;
import com.ggnh.hub.security.firebase.FirebaseTokenVerifier;
import com.ggnh.hub.service.outbox.AppointmentOutboxWorker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AppointmentManagementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private AppointmentIdempotencyRepository idempotencyRepository;

    @Autowired
    private AppointmentOutboxRepository outboxRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserPermissionRepository userPermissionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppointmentOutboxWorker outboxWorker;

    @Autowired
    private com.ggnh.hub.service.outbox.AppointmentOutboxTransactionHelper transactionHelper;

    @Autowired
    private com.ggnh.hub.service.AppointmentService appointmentService;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private Role ownerRole;
    private Role viewerRole;

    @BeforeEach
    void setup() {
        outboxRepository.deleteAll();
        idempotencyRepository.deleteAll();
        appointmentRepository.deleteAll();
        userPermissionRepository.deleteAll();
        userRepository.deleteAll();

        ownerRole = roleRepository.findByName("owner")
                .orElseGet(() -> roleRepository.save(Role.builder().name("owner").description("Owner").build()));
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

    // =========================================================================
    // 1. Public Appointment Creation & Idempotency Tests
    // =========================================================================

    @Test
    @DisplayName("Public Booking: Valid payload with Idempotency-Key returns 201 Created, sets BOOKED status, and atomically creates Outbox and Idempotency records")
    void publicBooking_ValidPayload_Returns201CreatedAndPersistsOutboxAndIdempotency() throws Exception {
        UUID key = UUID.randomUUID();
        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("Aarav Sharma")
                .patientPhone("+91 98765 43210")
                .patientEmail("aarav@example.com")
                .doctorName("Dr. Vikas Gupta")
                .message("Consultation for recurrent headache")
                .build();

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.name", is("Aarav Sharma")))
                .andExpect(jsonPath("$.phone", is("+91 98765 43210")))
                .andExpect(jsonPath("$.email", is("aarav@example.com")))
                .andExpect(jsonPath("$.doctor", is("Dr. Vikas Gupta")))
                .andExpect(jsonPath("$.status", is("booked")))
                .andExpect(jsonPath("$.completedAt", nullValue()))
                .andExpect(jsonPath("$.createdAt", notNullValue()))
                .andExpect(jsonPath("$.updatedAt", notNullValue()));

        // Verify Domain Entity
        List<Appointment> all = appointmentRepository.findAll();
        assertThat(all).hasSize(1);
        Appointment saved = all.get(0);
        assertThat(saved.getPatientName()).isEqualTo("Aarav Sharma");
        assertThat(saved.getStatus()).isEqualTo(AppointmentStatus.BOOKED);
        assertThat(saved.getCompletedAt()).isNull();

        // Verify Idempotency Record
        AppointmentIdempotency idempotency = idempotencyRepository.findById(key).orElseThrow();
        assertThat(idempotency.getStatus()).isEqualTo("COMPLETED");
        assertThat(idempotency.getAppointmentId()).isEqualTo(saved.getId());
        assertThat(idempotency.getResponsePayload()).contains("Aarav Sharma");

        // Verify Transactional Outbox Record
        List<AppointmentOutbox> outboxList = outboxRepository.findByAppointmentId(saved.getId());
        assertThat(outboxList).hasSize(1);
        AppointmentOutbox outbox = outboxList.get(0);
        assertThat(outbox.getStatus()).isEqualTo("PENDING");
        assertThat(outbox.getChannel()).isEqualTo("EMAIL");
        assertThat(outbox.getEventType()).isEqualTo("APPOINTMENT_REQUESTED");
        assertThat(outbox.getPayload()).contains(saved.getId().toString());
        // Verify phone masking in outbox payload
        assertThat(outbox.getPayload()).contains("***3210");
    }

    @Test
    @DisplayName("Public Booking: Missing Idempotency-Key header returns 400 Bad Request")
    void publicBooking_MissingIdempotencyKey_Returns400BadRequest() throws Exception {
        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("Meera Patel")
                .patientPhone("+91 98765 11111")
                .build();

        mockMvc.perform(post("/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        assertThat(appointmentRepository.count()).isZero();
    }

    @Test
    @DisplayName("Public Booking: Invalid UUID format for Idempotency-Key header returns 400 Bad Request")
    void publicBooking_InvalidUuidIdempotencyKey_Returns400BadRequest() throws Exception {
        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("Meera Patel")
                .patientPhone("+91 98765 11111")
                .build();

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", "not-a-valid-uuid")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        assertThat(appointmentRepository.count()).isZero();
    }

    @Test
    @DisplayName("Public Booking: Invalid payload (blank name) returns 400 Bad Request")
    void publicBooking_InvalidPayloadBlankName_Returns400BadRequest() throws Exception {
        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("   ")
                .patientPhone("+91 98765 22222")
                .build();

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        assertThat(appointmentRepository.count()).isZero();
    }

    @Test
    @DisplayName("Public Booking: Repeated request with the same Idempotency-Key returns stored result without creating duplicate records")
    void publicBooking_RepeatedIdempotencyKey_ReturnsStoredResult() throws Exception {
        UUID key = UUID.randomUUID();
        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("Rohan Verma")
                .patientPhone("+91 98765 33333")
                .doctorName("Dr. Vikas Gupta")
                .build();

        // First attempt -> 201 Created
        String firstResponse = mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        // Second attempt with exact same key -> Returns identical response
        String secondResponse = mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        com.ggnh.hub.dto.AppointmentResponse first = objectMapper.readValue(firstResponse, com.ggnh.hub.dto.AppointmentResponse.class);
        com.ggnh.hub.dto.AppointmentResponse second = objectMapper.readValue(secondResponse, com.ggnh.hub.dto.AppointmentResponse.class);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getName()).isEqualTo(first.getName());
        assertThat(second.getStatus()).isEqualTo(first.getStatus());
        assertThat(second.getCreatedAt().toInstant()).isEqualTo(first.getCreatedAt().toInstant());
        // Ensure no duplicate entity or outbox row was created
        assertThat(appointmentRepository.count()).isEqualTo(1);
        assertThat(outboxRepository.count()).isEqualTo(1);
        assertThat(idempotencyRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("Public Booking: Concurrent request with same active PROCESSING key returns 409 Conflict")
    void publicBooking_ConcurrentProcessingKey_Returns409Conflict() throws Exception {
        UUID key = UUID.randomUUID();

        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("Concurrent Caller")
                .patientPhone("+91 98765 44444")
                .build();

        // Simulate an in-flight transaction holding PROCESSING state with matching request hash
        idempotencyRepository.saveAndFlush(AppointmentIdempotency.builder()
                .key(key)
                .requestHash(appointmentService.computeRequestHash(request))
                .status("PROCESSING")
                .createdAt(OffsetDateTime.now())
                .expiresAt(OffsetDateTime.now().plusHours(24))
                .build());

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict());

        assertThat(appointmentRepository.count()).isZero();
    }

    @Test
    @DisplayName("Public Booking: Client-supplied ID, status, and completedAt are strictly ignored and overridden")
    void publicBooking_ClientSuppliedPrivilegedFields_AreIgnored() throws Exception {
        UUID key = UUID.randomUUID();
        String maliciousPayload = """
                {
                    "id": "11111111-2222-3333-4444-555555555555",
                    "patientName": "Privilege Escalation Test",
                    "patientPhone": "+91 99999 88888",
                    "status": "completed",
                    "completedAt": "2026-01-01T00:00:00Z"
                }
                """;

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(maliciousPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", not(is("11111111-2222-3333-4444-555555555555"))))
                .andExpect(jsonPath("$.status", is("booked")))
                .andExpect(jsonPath("$.completedAt", nullValue()));

        Appointment saved = appointmentRepository.findAll().get(0);
        assertThat(saved.getStatus()).isEqualTo(AppointmentStatus.BOOKED);
        assertThat(saved.getCompletedAt()).isNull();
    }

    @Test
    @DisplayName("Public Booking: Optional email and doctor name are handled correctly (null email, default doctor)")
    void publicBooking_OptionalEmailAndDoctor_HandledGracefully() throws Exception {
        UUID key = UUID.randomUUID();
        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("Sunita Devi")
                .patientPhone("+91 91234 56789")
                .patientEmail("Not provided") // Legacy frontend fallback
                .doctorName("")               // Blank doctor
                .message("Not provided")
                .build();

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email", nullValue()))
                .andExpect(jsonPath("$.doctor", is("Not selected")))
                .andExpect(jsonPath("$.message", nullValue()));

        Appointment saved = appointmentRepository.findAll().get(0);
        assertThat(saved.getPatientEmail()).isNull();
        assertThat(saved.getDoctorName()).isEqualTo("Not selected");
        assertThat(saved.getMessage()).isNull();
    }

    // =========================================================================
    // 2. Staff Appointment Listing & Authorization Tests
    // =========================================================================

    @Test
    @DisplayName("Staff Listing: Unauthenticated access returns 401 Unauthorized")
    void staffListing_Unauthenticated_Returns401Unauthorized() throws Exception {
        mockMvc.perform(get("/appointments"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Staff Listing: Viewer without PERM_MANAGE_APPOINTMENTS returns 403 Forbidden")
    void staffListing_ViewerWithoutPermission_Returns403Forbidden() throws Exception {
        String token = "viewer-token";
        String uid = "uid-viewer-1";
        String email = "viewer@ggnh.org";

        createDatabaseUser(email, uid, true, viewerRole);
        when(tokenVerifier.verifyToken(eq(token))).thenReturn(
                FirebaseTokenHolder.builder().uid(uid).email(email).emailVerified(true).claims(Collections.emptyMap()).build()
        );

        mockMvc.perform(get("/appointments")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Staff Listing: Authorized owner receives paginated response with default size 50 and correct sorting")
    void staffListing_AuthorizedOwner_ReturnsPaginatedResponse() throws Exception {
        String token = "owner-token";
        String uid = "uid-owner-1";
        String email = "owner@ggnh.org";

        createDatabaseUser(email, uid, true, ownerRole);
        when(tokenVerifier.verifyToken(eq(token))).thenReturn(
                FirebaseTokenHolder.builder().uid(uid).email(email).emailVerified(true).claims(Collections.emptyMap()).build()
        );

        // Seed 3 appointments with explicit timestamps
        OffsetDateTime t1 = OffsetDateTime.now().minusHours(2);
        OffsetDateTime t2 = OffsetDateTime.now().minusHours(1);
        OffsetDateTime t3 = OffsetDateTime.now();

        appointmentRepository.save(Appointment.builder().patientName("Patient 1").patientPhone("111").createdAt(t1).updatedAt(t1).status(AppointmentStatus.BOOKED).build());
        appointmentRepository.save(Appointment.builder().patientName("Patient 2").patientPhone("222").createdAt(t2).updatedAt(t2).status(AppointmentStatus.COMPLETED).build());
        appointmentRepository.save(Appointment.builder().patientName("Patient 3").patientPhone("333").createdAt(t3).updatedAt(t3).status(AppointmentStatus.BOOKED).build());

        mockMvc.perform(get("/appointments")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page", is(0)))
                .andExpect(jsonPath("$.size", is(50)))
                .andExpect(jsonPath("$.totalElements", is(3)))
                .andExpect(jsonPath("$.totalPages", is(1)))
                .andExpect(jsonPath("$.content", hasSize(3)))
                // Verify sort order: t3 (Patient 3) must be first
                .andExpect(jsonPath("$.content[0].name", is("Patient 3")))
                .andExpect(jsonPath("$.content[1].name", is("Patient 2")))
                .andExpect(jsonPath("$.content[2].name", is("Patient 1")));
    }

    @Test
    @DisplayName("Staff Listing: Supports pagination and status filtering")
    void staffListing_PaginationAndFiltering_WorksCorrectly() throws Exception {
        String token = "owner-token";
        String uid = "uid-owner-1";
        String email = "owner@ggnh.org";

        createDatabaseUser(email, uid, true, ownerRole);
        when(tokenVerifier.verifyToken(eq(token))).thenReturn(
                FirebaseTokenHolder.builder().uid(uid).email(email).emailVerified(true).claims(Collections.emptyMap()).build()
        );

        OffsetDateTime now = OffsetDateTime.now();
        appointmentRepository.save(Appointment.builder().patientName("Booked 1").patientPhone("111").createdAt(now.minusMinutes(4)).updatedAt(now).status(AppointmentStatus.BOOKED).build());
        appointmentRepository.save(Appointment.builder().patientName("Booked 2").patientPhone("222").createdAt(now.minusMinutes(3)).updatedAt(now).status(AppointmentStatus.BOOKED).build());
        appointmentRepository.save(Appointment.builder().patientName("Booked 3").patientPhone("333").createdAt(now.minusMinutes(2)).updatedAt(now).status(AppointmentStatus.BOOKED).build());
        appointmentRepository.save(Appointment.builder().patientName("Completed 1").patientPhone("444").createdAt(now.minusMinutes(1)).updatedAt(now).status(AppointmentStatus.COMPLETED).build());

        // Query status=booked with page=0, size=2
        mockMvc.perform(get("/appointments")
                        .param("page", "0")
                        .param("size", "2")
                        .param("status", "booked")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements", is(3)))
                .andExpect(jsonPath("$.totalPages", is(2)))
                .andExpect(jsonPath("$.content[0].name", is("Booked 3")))
                .andExpect(jsonPath("$.content[1].name", is("Booked 2")));
    }

    // =========================================================================
    // 3. Appointment Details & Completion Tests
    // =========================================================================

    @Test
    @DisplayName("Appointment Details: Authorized staff can retrieve appointment by ID")
    void appointmentDetails_AuthorizedStaff_ReturnsAppointment() throws Exception {
        String token = "owner-token";
        String uid = "uid-owner-1";
        String email = "owner@ggnh.org";

        createDatabaseUser(email, uid, true, ownerRole);
        when(tokenVerifier.verifyToken(eq(token))).thenReturn(
                FirebaseTokenHolder.builder().uid(uid).email(email).emailVerified(true).claims(Collections.emptyMap()).build()
        );

        Appointment saved = appointmentRepository.save(Appointment.builder()
                .patientName("Vikram Singh")
                .patientPhone("+91 90000 11111")
                .status(AppointmentStatus.BOOKED)
                .build());

        mockMvc.perform(get("/appointments/{id}", saved.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(saved.getId().toString())))
                .andExpect(jsonPath("$.name", is("Vikram Singh")));
    }

    @Test
    @DisplayName("Appointment Details: Unknown ID returns 404 Not Found")
    void appointmentDetails_UnknownId_Returns404() throws Exception {
        String token = "owner-token";
        String uid = "uid-owner-1";
        String email = "owner@ggnh.org";

        createDatabaseUser(email, uid, true, ownerRole);
        when(tokenVerifier.verifyToken(eq(token))).thenReturn(
                FirebaseTokenHolder.builder().uid(uid).email(email).emailVerified(true).claims(Collections.emptyMap()).build()
        );

        mockMvc.perform(get("/appointments/{id}", UUID.randomUUID())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Mark Complete: Authorized staff marks appointment complete and stamps completedAt and updatedAt")
    void markComplete_AuthorizedStaff_TransitionsStatus() throws Exception {
        String token = "owner-token";
        String uid = "uid-owner-1";
        String email = "owner@ggnh.org";

        createDatabaseUser(email, uid, true, ownerRole);
        when(tokenVerifier.verifyToken(eq(token))).thenReturn(
                FirebaseTokenHolder.builder().uid(uid).email(email).emailVerified(true).claims(Collections.emptyMap()).build()
        );

        Appointment saved = appointmentRepository.save(Appointment.builder()
                .patientName("Geeta Sharma")
                .patientPhone("+91 90000 22222")
                .status(AppointmentStatus.BOOKED)
                .build());

        mockMvc.perform(patch("/appointments/{id}/complete", saved.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(saved.getId().toString())))
                .andExpect(jsonPath("$.status", is("completed")))
                .andExpect(jsonPath("$.completedAt", notNullValue()))
                .andExpect(jsonPath("$.updatedAt", notNullValue()));

        Appointment updated = appointmentRepository.findById(saved.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(AppointmentStatus.COMPLETED);
        assertThat(updated.getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("Mark Complete: Attempting to complete a CANCELLED appointment returns 409 Conflict")
    void markComplete_CancelledAppointment_Returns409Conflict() throws Exception {
        String token = "owner-token";
        String uid = "uid-owner-1";
        String email = "owner@ggnh.org";

        createDatabaseUser(email, uid, true, ownerRole);
        when(tokenVerifier.verifyToken(eq(token))).thenReturn(
                FirebaseTokenHolder.builder().uid(uid).email(email).emailVerified(true).claims(Collections.emptyMap()).build()
        );

        Appointment saved = appointmentRepository.save(Appointment.builder()
                .patientName("Cancelled Patient")
                .patientPhone("+91 90000 33333")
                .status(AppointmentStatus.CANCELLED)
                .build());

        mockMvc.perform(patch("/appointments/{id}/complete", saved.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
    }

    private Appointment createTestAppointment(String name, String phone) {
        OffsetDateTime now = OffsetDateTime.now();
        return appointmentRepository.save(Appointment.builder()
                .patientName(name)
                .patientPhone(phone)
                .status(AppointmentStatus.BOOKED)
                .createdAt(now)
                .updatedAt(now)
                .build());
    }

    // =========================================================================
    // 4. Transactional Outbox Worker & Crash Recovery Tests
    // =========================================================================

    @Test
    @DisplayName("Outbox Worker: Unconfigured email transport increments attempts, sets FAILED and schedules exponential backoff")
    void outboxWorker_UnconfiguredEmail_TransitionsToFailedWithBackoff() {
        OffsetDateTime now = OffsetDateTime.now();
        Appointment appointment = createTestAppointment("Outbox Test Patient", "+91 98765 11100");
        AppointmentOutbox outbox = outboxRepository.save(AppointmentOutbox.builder()
                .appointmentId(appointment.getId())
                .eventType("APPOINTMENT_REQUESTED")
                .channel("EMAIL")
                .payload("{\"test\": true}")
                .status("PENDING")
                .attempts(0)
                .maxAttempts(5)
                .nextAttemptAt(now.minusSeconds(10))
                .build());

        // Execute processing batch synchronously
        outboxWorker.processBatch();

        AppointmentOutbox updated = outboxRepository.findById(outbox.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo("FAILED");
        assertThat(updated.getAttempts()).isEqualTo(1);
        assertThat(updated.getLastError()).contains("Clinic email notification service is unconfigured or disabled");
        assertThat(updated.getNextAttemptAt()).isAfter(now);
    }

    @Test
    @DisplayName("Outbox Worker: Reaching maximum attempts moves event to DEAD_LETTER")
    void outboxWorker_MaxAttemptsExceeded_MovesToDeadLetter() {
        OffsetDateTime now = OffsetDateTime.now();
        Appointment appointment = createTestAppointment("Dead Letter Patient", "+91 98765 11101");
        AppointmentOutbox outbox = outboxRepository.save(AppointmentOutbox.builder()
                .appointmentId(appointment.getId())
                .eventType("APPOINTMENT_REQUESTED")
                .channel("EMAIL")
                .payload("{\"test\": true}")
                .status("FAILED")
                .attempts(4)
                .maxAttempts(5)
                .nextAttemptAt(now.minusSeconds(10))
                .build());

        outboxWorker.processBatch();

        AppointmentOutbox updated = outboxRepository.findById(outbox.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo("DEAD_LETTER");
        assertThat(updated.getAttempts()).isEqualTo(5);
    }

    @Test
    @DisplayName("Outbox Worker: Recovers abandoned PROCESSING record where lease timed out after worker crash")
    void outboxWorker_AbandonedLease_RecoversRecordToFailed() {
        OffsetDateTime now = OffsetDateTime.now();
        Appointment appointment = createTestAppointment("Lease Recovery Patient", "+91 98765 11102");
        // Record stuck in PROCESSING for 10 minutes (lease timeout is 5 mins = 300s)
        AppointmentOutbox abandoned = outboxRepository.save(AppointmentOutbox.builder()
                .appointmentId(appointment.getId())
                .eventType("APPOINTMENT_REQUESTED")
                .channel("EMAIL")
                .payload("{\"test\": true}")
                .status("PROCESSING")
                .lockedAt(now.minusMinutes(10))
                .attempts(1)
                .maxAttempts(5)
                .nextAttemptAt(now.minusMinutes(10))
                .build());

        outboxWorker.processBatch();

        AppointmentOutbox recovered = outboxRepository.findById(abandoned.getId()).orElseThrow();
        // Recovery increments attempts to 2 and sets status to FAILED
        assertThat(recovered.getStatus()).isEqualTo("FAILED");
        assertThat(recovered.getAttempts()).isEqualTo(2);
        assertThat(recovered.getLockedAt()).isNull();
        assertThat(recovered.getLastError()).contains("Recovered from abandoned lease timeout");
        assertThat(recovered.getNextAttemptAt()).isAfter(now);
    }

    @Test
    @DisplayName("Idempotency Fingerprint: Reusing same key with a different payload returns 409 Conflict")
    void publicBooking_ReusedKeyWithDifferentPayload_Returns409Conflict() throws Exception {
        UUID key = UUID.randomUUID();
        CreateAppointmentRequest initialRequest = CreateAppointmentRequest.builder()
                .patientName("Original Patient")
                .patientPhone("+91 98765 11111")
                .doctorName("Dr. Vikas Gupta")
                .build();

        // 1. Initial request succeeds
        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(initialRequest)))
                .andExpect(status().isCreated());

        // 2. Reusing same key with a different patient name/phone -> 409 Conflict
        CreateAppointmentRequest alteredRequest = CreateAppointmentRequest.builder()
                .patientName("Altered Patient Name")
                .patientPhone("+91 98765 99999")
                .doctorName("Dr. Shefali Gupta")
                .build();

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(alteredRequest)))
                .andExpect(status().isConflict())
                .andExpect(status().reason("Idempotency-Key has already been used for a different appointment request"));

        // Confirm database still contains only 1 appointment and 1 outbox record
        assertThat(appointmentRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("Fingerprint Canonicalization: Whitespace normalization produces identical hash")
    void requestFingerprint_WhitespaceNormalization_ProducesIdenticalHash() {
        CreateAppointmentRequest req1 = CreateAppointmentRequest.builder()
                .patientName("Sunita Verma")
                .patientPhone("+91 98765 11111")
                .doctorName("Dr. Vikas Gupta")
                .patientEmail("sunita@example.com")
                .message("Routine checkup")
                .build();

        CreateAppointmentRequest req2 = CreateAppointmentRequest.builder()
                .patientName("  Sunita Verma  ")
                .patientPhone("  +91 98765 11111  ")
                .doctorName("  Dr. Vikas Gupta  ")
                .patientEmail("  SUNITA@EXAMPLE.COM  ")
                .message("  Routine checkup  ")
                .build();

        String hash1 = appointmentService.computeRequestHash(req1);
        String hash2 = appointmentService.computeRequestHash(req2);
        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    @DisplayName("Fingerprint Canonicalization: Null vs empty string normalization produces identical hash")
    void requestFingerprint_NullVsEmpty_ProducesIdenticalHash() {
        CreateAppointmentRequest req1 = CreateAppointmentRequest.builder()
                .patientName("Test Patient")
                .patientPhone("+91 98765 22222")
                .doctorName(null)
                .patientEmail(null)
                .message(null)
                .build();

        CreateAppointmentRequest req2 = CreateAppointmentRequest.builder()
                .patientName("Test Patient")
                .patientPhone("+91 98765 22222")
                .doctorName("")
                .patientEmail("")
                .message("")
                .build();

        String hash1 = appointmentService.computeRequestHash(req1);
        String hash2 = appointmentService.computeRequestHash(req2);
        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    @DisplayName("Fingerprint Canonicalization: Separator and control characters do not cause delimiter collisions")
    void requestFingerprint_SeparatorCharacters_NoDelimiterCollisions() {
        // Two payloads where delimiter-based concatenation like 'A|B' would collide
        CreateAppointmentRequest req1 = CreateAppointmentRequest.builder()
                .patientName("User|WithPipe")
                .patientPhone("1234567")
                .build();

        CreateAppointmentRequest req2 = CreateAppointmentRequest.builder()
                .patientName("User")
                .patientPhone("WithPipe|1234567")
                .build();

        String hash1 = appointmentService.computeRequestHash(req1);
        String hash2 = appointmentService.computeRequestHash(req2);
        assertThat(hash1).isNotEqualTo(hash2);
    }

    @Test
    @DisplayName("Fingerprint Canonicalization: Distinct payloads produce distinct hashes")
    void requestFingerprint_DistinctPayloads_ProduceDistinctHashes() {
        CreateAppointmentRequest req1 = CreateAppointmentRequest.builder()
                .patientName("Patient One")
                .patientPhone("+91 98765 33333")
                .build();

        CreateAppointmentRequest req2 = CreateAppointmentRequest.builder()
                .patientName("Patient Two")
                .patientPhone("+91 98765 33333")
                .build();

        String hash1 = appointmentService.computeRequestHash(req1);
        String hash2 = appointmentService.computeRequestHash(req2);
        assertThat(hash1).isNotEqualTo(hash2);
    }

    @Test
    @DisplayName("Public Booking Concurrency: Racing requests with same key and payload safely resolve winner without rollback-only errors")
    void publicBooking_ConcurrentRacingRequests_OneWinnerAndReplayWithoutRollbackError() throws Exception {
        UUID key = UUID.randomUUID();
        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("Racing Caller")
                .patientPhone("+91 98765 44444")
                .doctorName("Dr. Vikas Gupta")
                .build();

        int threadCount = 2;
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(threadCount);
        java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(threadCount);
        List<com.ggnh.hub.dto.AppointmentResponse> responses = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    com.ggnh.hub.dto.AppointmentResponse res = appointmentService.createAppointment(request, key.toString());
                    responses.add(res);
                } catch (Throwable t) {
                    errors.add(t);
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean finished = latch.await(10, java.util.concurrent.TimeUnit.SECONDS);
        executor.shutdown();
        assertThat(finished).isTrue();
        assertThat(errors).isEmpty();
        assertThat(responses).hasSize(2);
        // Both threads received the exact same appointment ID
        assertThat(responses.get(0).getId()).isEqualTo(responses.get(1).getId());
        assertThat(appointmentRepository.count()).isEqualTo(1);
        assertThat(idempotencyRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("Referential Integrity: Deleting an appointment with outbox events is blocked by ON DELETE RESTRICT")
    void referentialIntegrity_DeletingAppointmentWithOutbox_FailsWithRestrict() {
        OffsetDateTime now = OffsetDateTime.now();
        Appointment appointment = appointmentRepository.save(Appointment.builder()
                .patientName("Integrity Test Patient")
                .patientPhone("+91 98765 77777")
                .status(AppointmentStatus.BOOKED)
                .createdAt(now)
                .updatedAt(now)
                .build());

        outboxRepository.save(AppointmentOutbox.builder()
                .appointmentId(appointment.getId())
                .eventType("APPOINTMENT_REQUESTED")
                .channel("EMAIL")
                .payload("{\"test\": true}")
                .status("PENDING")
                .attempts(0)
                .maxAttempts(5)
                .nextAttemptAt(now)
                .createdAt(now)
                .build());

        // Attempting to delete the parent appointment must violate foreign key ON DELETE RESTRICT
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> {
            appointmentRepository.delete(appointment);
            appointmentRepository.flush();
        }).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Referential Integrity: Deleting an appointment with idempotency history is blocked by ON DELETE RESTRICT")
    void referentialIntegrity_DeletingAppointmentWithIdempotency_FailsWithRestrict() {
        OffsetDateTime now = OffsetDateTime.now();
        Appointment appointment = appointmentRepository.save(Appointment.builder()
                .patientName("Idempotency Integrity Patient")
                .patientPhone("+91 98765 66666")
                .status(AppointmentStatus.BOOKED)
                .createdAt(now)
                .updatedAt(now)
                .build());

        idempotencyRepository.saveAndFlush(AppointmentIdempotency.builder()
                .key(UUID.randomUUID())
                .appointmentId(appointment.getId())
                .requestHash("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
                .status("COMPLETED")
                .responsePayload("{}")
                .createdAt(now)
                .expiresAt(now.plusHours(24))
                .build());

        // Attempting to delete the parent appointment must violate foreign key ON DELETE RESTRICT
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> {
            appointmentRepository.delete(appointment);
            appointmentRepository.flush();
        }).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Outbox Concurrency: Multiple competing workers process batch without double claims")
    void outboxWorker_MultipleWorkersCompeting_AtomicallyClaimAndProcessWithoutDuplicates() throws Exception {
        OffsetDateTime now = OffsetDateTime.now();
        int recordCount = 10;
        List<UUID> outboxIds = new ArrayList<>();

        for (int i = 0; i < recordCount; i++) {
            Appointment appointment = createTestAppointment("Worker Concurrency Patient " + i, "+91 98765 11" + (i < 10 ? "0" + i : i));
            AppointmentOutbox record = outboxRepository.save(AppointmentOutbox.builder()
                    .appointmentId(appointment.getId())
                    .eventType("APPOINTMENT_REQUESTED")
                    .channel("EMAIL")
                    .payload("{\"workerTestIndex\": " + i + "}")
                    .status("PENDING")
                    .attempts(0)
                    .maxAttempts(5)
                    .nextAttemptAt(now.minusSeconds(10))
                    .createdAt(now.minusSeconds(10))
                    .build());
            outboxIds.add(record.getId());
        }

        // Launch 4 concurrent worker threads competing to process the same 10 records
        int threadCount = 4;
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(threadCount);
        java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    outboxWorker.processBatch();
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean finished = latch.await(15, java.util.concurrent.TimeUnit.SECONDS);
        executor.shutdown();
        assertThat(finished).isTrue();

        // Verify every record was processed (transitioned from PENDING to FAILED due to unconfigured email)
        List<AppointmentOutbox> allProcessed = outboxRepository.findAllById(outboxIds);
        assertThat(allProcessed).hasSize(recordCount);
        for (AppointmentOutbox processed : allProcessed) {
            // Because each record was claimed exactly once by one worker, attempt count must be exactly 1
            assertThat(processed.getStatus()).isEqualTo("FAILED");
            assertThat(processed.getAttempts()).isEqualTo(1);
            assertThat(processed.getLockedAt()).isNull();
        }
    }

    @Test
    @DisplayName("Outbox Reliability: Simulates post-send crash and documents duplicate delivery limitation (at-least-once)")
    void outboxWorker_DuplicateDeliveryLimitation_DocumentedAndVerified() {
        OffsetDateTime now = OffsetDateTime.now();
        Appointment appointment = createTestAppointment("Duplicate Delivery Patient", "+91 98765 11999");
        // Simulate a record where external delivery took place, but worker crashed before recording SENT
        AppointmentOutbox inFlight = outboxRepository.save(AppointmentOutbox.builder()
                .appointmentId(appointment.getId())
                .eventType("APPOINTMENT_REQUESTED")
                .channel("EMAIL")
                .payload("{\"message\": \"External email was sent before crash\"}")
                .status("PROCESSING")
                .lockedAt(now.minusMinutes(10)) // Lease has expired
                .attempts(1)
                .maxAttempts(5)
                .nextAttemptAt(now.minusMinutes(10))
                .createdAt(now.minusMinutes(10))
                .build());

        // Process batch -> Expired lease is safely recovered to FAILED for retry
        outboxWorker.processBatch();

        AppointmentOutbox recovered = outboxRepository.findById(inFlight.getId()).orElseThrow();
        assertThat(recovered.getStatus()).isEqualTo("FAILED");
        assertThat(recovered.getAttempts()).isEqualTo(2);
        assertThat(recovered.getLastError()).contains("Recovered from abandoned lease timeout");
    }

    @Test
    @DisplayName("Outbox Lease Fencing: Worker with expired lease token cannot overwrite state reclaimed by another worker")
    void outboxWorker_ExpiredLeaseOwnerCannotOverwriteReclaimedJob() {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime tenMinutesAgo = now.minusMinutes(10);
        Appointment appointment = createTestAppointment("Fencing Test Patient", "+91 98765 11888");
        AppointmentOutbox outbox = outboxRepository.save(AppointmentOutbox.builder()
                .appointmentId(appointment.getId())
                .eventType("APPOINTMENT_REQUESTED")
                .channel("EMAIL")
                .payload("{\"test\": true}")
                .status("PENDING")
                .attempts(0)
                .maxAttempts(5)
                .nextAttemptAt(tenMinutesAgo.minusMinutes(1))
                .build());

        // 1. Worker A claims the record at tenMinutesAgo and gets leaseTokenA
        Optional<AppointmentOutbox> claimedByA = transactionHelper.claimRecord(outbox.getId(), tenMinutesAgo);
        assertThat(claimedByA).isPresent();
        UUID leaseTokenA = claimedByA.get().getLeaseToken();
        assertThat(leaseTokenA).isNotNull();

        // 2. Lease expires and is recovered by lease cleaner (clearing leaseTokenA)
        int recovered = transactionHelper.recoverStaleLeases(now.minusMinutes(5), now);
        assertThat(recovered).isEqualTo(1);

        // 3. Worker B claims the record after backoff and gets leaseTokenB
        Optional<AppointmentOutbox> claimedByB = transactionHelper.claimRecord(outbox.getId(), now.plusSeconds(10));
        assertThat(claimedByB).isPresent();
        UUID leaseTokenB = claimedByB.get().getLeaseToken();
        assertThat(leaseTokenB).isNotEqualTo(leaseTokenA);

        // 4. Slow Worker A wakes up and attempts to commit success with its old leaseTokenA
        boolean workerASuccess = transactionHelper.recordSuccess(outbox.getId(), leaseTokenA, OffsetDateTime.now());
        assertThat(workerASuccess).isFalse();

        // Verify the job was NOT marked SENT by Worker A; Worker B's lease is preserved!
        AppointmentOutbox current = outboxRepository.findById(outbox.getId()).orElseThrow();
        assertThat(current.getStatus()).isEqualTo("PROCESSING");
        assertThat(current.getLeaseToken()).isEqualTo(leaseTokenB);

        // 5. Worker B commits success with its valid leaseTokenB
        boolean workerBSuccess = transactionHelper.recordSuccess(outbox.getId(), leaseTokenB, OffsetDateTime.now());
        assertThat(workerBSuccess).isTrue();

        AppointmentOutbox finalState = outboxRepository.findById(outbox.getId()).orElseThrow();
        assertThat(finalState.getStatus()).isEqualTo("SENT");
        assertThat(finalState.getLeaseToken()).isNull();
    }
}

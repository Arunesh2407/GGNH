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
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Task 5.4: Clean PostgreSQL Appointment Launch Integration Tests
 * Verifies that the appointment management system functions cleanly from scratch
 * with zero historical Appwrite data and an empty appointment database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class CleanAppointmentLaunchIntegrationTest {

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

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private Role ownerRole;
    private Role viewerRole;

    @BeforeEach
    void setUp() {
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
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();

        return userRepository.save(user);
    }

    @Test
    @DisplayName("1. Clean Start: Database tables start empty with zero records")
    void cleanLaunch_DatabaseStartsEmpty() {
        assertThat(appointmentRepository.count()).isEqualTo(0);
        assertThat(idempotencyRepository.count()).isEqualTo(0);
        assertThat(outboxRepository.count()).isEqualTo(0);
    }

    @Test
    @DisplayName("2. Staff Listing When Empty: Returns 200 OK with totalElements = 0 and empty content")
    void cleanLaunch_StaffListingWhenEmpty_Returns200WithEmptyContent() throws Exception {
        createDatabaseUser("owner@ggnh.org", "fb-owner-uid-clean", true, ownerRole);

        when(tokenVerifier.verifyToken("owner-token"))
                .thenReturn(FirebaseTokenHolder.builder()
                        .uid("fb-owner-uid-clean")
                        .email("owner@ggnh.org")
                        .emailVerified(true)
                        .build());

        mockMvc.perform(get("/appointments")
                        .header("Authorization", "Bearer owner-token")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0))
                .andExpect(jsonPath("$.last").value(true))
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    @DisplayName("3. First Public Booking: Successfully books appointment, assigns random UUID, and populates outbox")
    void cleanLaunch_FirstPublicBooking_SucceedsWith201AndGeneratedRandomUuid() throws Exception {
        UUID idempotencyKey = UUID.randomUUID();

        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("Aarav Sharma")
                .patientPhone("+91 9876543210")
                .patientEmail("aarav@example.com")
                .doctorName("Dr. Vikas Gupta")
                .message("Initial clean consultation")
                .build();

        MvcResult result = mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", idempotencyKey.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Aarav Sharma"))
                .andExpect(jsonPath("$.phone").value("+91 9876543210"))
                .andExpect(jsonPath("$.email").value("aarav@example.com"))
                .andExpect(jsonPath("$.doctor").value("Dr. Vikas Gupta"))
                .andExpect(jsonPath("$.status").value("booked"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.completedAt").isEmpty())
                .andReturn();

        // Verify entity persisted in PostgreSQL
        List<Appointment> appointments = appointmentRepository.findAll();
        assertThat(appointments).hasSize(1);
        Appointment savedAppt = appointments.get(0);
        assertThat(savedAppt.getPatientName()).isEqualTo("Aarav Sharma");
        assertThat(savedAppt.getStatus()).isEqualTo(AppointmentStatus.BOOKED);

        // Verify idempotency record persisted
        Optional<AppointmentIdempotency> idempotencyOpt = idempotencyRepository.findById(idempotencyKey);
        assertThat(idempotencyOpt).isPresent();
        assertThat(idempotencyOpt.get().getStatus()).isEqualTo("COMPLETED");

        // Verify transactional outbox event created
        List<AppointmentOutbox> outboxEvents = outboxRepository.findAll();
        assertThat(outboxEvents).hasSize(1);
        assertThat(outboxEvents.get(0).getStatus()).isEqualTo("PENDING");
        assertThat(outboxEvents.get(0).getAppointmentId()).isEqualTo(savedAppt.getId());
    }

    @Test
    @DisplayName("4. Repeated Request with Same Key: Returns stored response without duplicate database rows")
    void cleanLaunch_RepeatedRequestWithSameKey_ReturnsOriginalResponseWithoutDuplicateRows() throws Exception {
        UUID idempotencyKey = UUID.randomUUID();

        CreateAppointmentRequest request = CreateAppointmentRequest.builder()
                .patientName("Kavita Nair")
                .patientPhone("+91 9876543211")
                .patientEmail("kavita@example.com")
                .build();

        // First attempt
        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", idempotencyKey.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        assertThat(appointmentRepository.count()).isEqualTo(1);

        // Repeated request with same idempotency key and same payload
        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", idempotencyKey.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Kavita Nair"));

        // Row count remains exactly 1
        assertThat(appointmentRepository.count()).isEqualTo(1);
        assertThat(idempotencyRepository.count()).isEqualTo(1);
        assertThat(outboxRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("5. Key Reused with Different Payload: Returns 409 Conflict")
    void cleanLaunch_KeyReusedWithDifferentPayload_Returns409Conflict() throws Exception {
        UUID idempotencyKey = UUID.randomUUID();

        CreateAppointmentRequest request1 = CreateAppointmentRequest.builder()
                .patientName("Original Patient")
                .patientPhone("+91 9876543212")
                .build();

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", idempotencyKey.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request1)))
                .andExpect(status().isCreated());

        // Same key, different name
        CreateAppointmentRequest request2 = CreateAppointmentRequest.builder()
                .patientName("Different Patient Name")
                .patientPhone("+91 9876543212")
                .build();

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", idempotencyKey.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request2)))
                .andExpect(status().isConflict());

        assertThat(appointmentRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("6. Staff Listing After Booking: Returns updated list and correct pagination metadata")
    void cleanLaunch_StaffListingAfterNewBooking_ReturnsUpdatedListAndPagination() throws Exception {
        createDatabaseUser("owner@ggnh.org", "fb-owner-uid-clean", true, ownerRole);

        when(tokenVerifier.verifyToken("owner-token"))
                .thenReturn(FirebaseTokenHolder.builder()
                        .uid("fb-owner-uid-clean")
                        .email("owner@ggnh.org")
                        .emailVerified(true)
                        .build());

        // Book 2 new appointments
        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(CreateAppointmentRequest.builder()
                                .patientName("Patient One")
                                .patientPhone("9876543201")
                                .build())))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(CreateAppointmentRequest.builder()
                                .patientName("Patient Two")
                                .patientPhone("9876543202")
                                .build())))
                .andExpect(status().isCreated());

        // Staff listing reflects both new appointments
        mockMvc.perform(get("/appointments")
                        .header("Authorization", "Bearer owner-token")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    @DisplayName("7. Staff Completes Appointment: Transitions status to COMPLETED and stamps timestamps")
    void cleanLaunch_StaffCompletesAppointment_TransitionsStatusAndStampsCompletedAt() throws Exception {
        createDatabaseUser("owner@ggnh.org", "fb-owner-uid-clean", true, ownerRole);

        when(tokenVerifier.verifyToken("owner-token"))
                .thenReturn(FirebaseTokenHolder.builder()
                        .uid("fb-owner-uid-clean")
                        .email("owner@ggnh.org")
                        .emailVerified(true)
                        .build());

        // Book an appointment
        UUID idempotencyKey = UUID.randomUUID();
        MvcResult bookResult = mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", idempotencyKey.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(CreateAppointmentRequest.builder()
                                .patientName("Patient to Complete")
                                .patientPhone("9876543203")
                                .build())))
                .andExpect(status().isCreated())
                .andReturn();

        String appointmentId = objectMapper.readTree(bookResult.getResponse().getContentAsString()).get("id").asText();

        // Complete the appointment
        mockMvc.perform(patch("/appointments/" + appointmentId + "/complete")
                        .header("Authorization", "Bearer owner-token")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(appointmentId))
                .andExpect(jsonPath("$.status").value("completed"))
                .andExpect(jsonPath("$.completedAt").isNotEmpty());

        // Verify entity updated in PostgreSQL
        Appointment completedAppt = appointmentRepository.findById(UUID.fromString(appointmentId)).orElseThrow();
        assertThat(completedAppt.getStatus()).isEqualTo(AppointmentStatus.COMPLETED);
        assertThat(completedAppt.getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("8. Transactional Outbox Worker: Processes pending events with lease safety")
    void cleanLaunch_TransactionalOutbox_WorkerProcessesEvent() throws Exception {
        // Book an appointment to generate outbox event
        mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(CreateAppointmentRequest.builder()
                                .patientName("Outbox Patient")
                                .patientPhone("9876543204")
                                .build())))
                .andExpect(status().isCreated());

        List<AppointmentOutbox> events = outboxRepository.findAll();
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getStatus()).isEqualTo("PENDING");

        // Execute outbox worker
        outboxWorker.processBatch();

        // Worker attempts processing; since notification channels are not live in test, status records attempt
        AppointmentOutbox processed = outboxRepository.findById(events.get(0).getId()).orElseThrow();
        assertThat(processed.getAttempts()).isGreaterThan(0);
    }

    @Test
    @DisplayName("9. Authorization Boundaries: Anonymous receives 401, unauthorized role receives 403")
    void cleanLaunch_Authorization_AnonymousAndUnauthorizedRejected() throws Exception {
        createDatabaseUser("viewer@ggnh.org", "fb-viewer-uid-clean", true, viewerRole);

        when(tokenVerifier.verifyToken("viewer-token"))
                .thenReturn(FirebaseTokenHolder.builder()
                        .uid("fb-viewer-uid-clean")
                        .email("viewer@ggnh.org")
                        .emailVerified(true)
                        .build());

        // Anonymous -> 401
        mockMvc.perform(get("/appointments")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());

        // Viewer without PERM_MANAGE_APPOINTMENTS -> 403
        mockMvc.perform(get("/appointments")
                        .header("Authorization", "Bearer viewer-token")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }
}

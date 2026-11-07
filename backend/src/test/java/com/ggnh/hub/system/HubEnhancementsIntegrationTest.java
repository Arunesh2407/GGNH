package com.ggnh.hub.system;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ggnh.hub.dto.AdjustStockRequest;
import com.ggnh.hub.dto.CreateAppointmentRequest;
import com.ggnh.hub.dto.MarkAttendanceRequest;
import com.ggnh.hub.entity.*;
import com.ggnh.hub.entity.enums.AppointmentStatus;
import com.ggnh.hub.entity.enums.AttendanceStatus;
import com.ggnh.hub.repository.*;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
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
public class HubEnhancementsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StaffRepository staffRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

    @Autowired
    private InventoryCategoryRepository categoryRepository;

    @Autowired
    private InventoryLedgerRepository ledgerRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

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

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String OWNER_TOKEN = "Bearer token-owner";
    private static final String PATIENT_TOKEN = "Bearer token-patient";
    private static final String OTHER_PATIENT_TOKEN = "Bearer token-other-patient";

    private User ownerUser;
    private User patientUser;
    private User otherPatientUser;

    @BeforeEach
    void setUp() throws Exception {
        // Clear in order
        auditLogRepository.deleteAll();
        attendanceRepository.deleteAll();
        staffRepository.deleteAll();
        ledgerRepository.deleteAll();
        itemRepository.deleteAll();
        categoryRepository.deleteAll();
        idempotencyRepository.deleteAll();
        outboxRepository.deleteAll();
        appointmentRepository.deleteAll();
        userPermissionRepository.deleteAll();
        userRepository.deleteAll();

        // 1. Setup roles
        Role ownerRole = roleRepository.findByName("owner")
                .orElseGet(() -> roleRepository.save(Role.builder().name("owner").description("Owner").build()));
        Role patientRole = roleRepository.findByName("patient")
                .orElseGet(() -> roleRepository.save(Role.builder().name("patient").description("Patient").build()));

        // 2. Setup owner
        ownerUser = userRepository.save(User.builder()
                .email("owner@ggnh.org")
                .firebaseUid("uid-owner-123")
                .isActive(true)
                .roles(Set.of(ownerRole))
                .build());

        // 3. Setup patients
        patientUser = userRepository.save(User.builder()
                .email("patient.alice@example.com")
                .firebaseUid("uid-patient-alice")
                .isActive(true)
                .roles(Set.of(patientRole))
                .build());

        otherPatientUser = userRepository.save(User.builder()
                .email("patient.bob@example.com")
                .firebaseUid("uid-patient-bob")
                .isActive(true)
                .roles(Set.of(patientRole))
                .build());

        // 4. Mock token verifications
        when(tokenVerifier.verifyToken(eq("token-owner")))
                .thenReturn(FirebaseTokenHolder.builder().uid("uid-owner-123").email("owner@ggnh.org").emailVerified(true).build());

        when(tokenVerifier.verifyToken(eq("token-patient")))
                .thenReturn(FirebaseTokenHolder.builder().uid("uid-patient-alice").email("patient.alice@example.com").emailVerified(true).build());

        when(tokenVerifier.verifyToken(eq("token-other-patient")))
                .thenReturn(FirebaseTokenHolder.builder().uid("uid-patient-bob").email("patient.bob@example.com").emailVerified(true).build());
    }

    // ==========================================
    // 1. Staff Management & Audit
    // ==========================================

    @Test
    @DisplayName("Staff Management: Create staff with department/designation and verify audit log")
    void testStaffManagement_CreateSearchAndAudit() throws Exception {
        Staff staff = Staff.builder()
                .name("Nurse Florence")
                .role("Registered Nurse")
                .department("Emergency")
                .designation("Senior Staff Nurse")
                .phone("+91-9876543210")
                .email("florence@ggnh.org")
                .employmentStatus("FULL_TIME")
                .joiningDate(LocalDate.of(2025, 1, 15))
                .build();

        String responseJson = mockMvc.perform(post("/staff")
                        .header("Authorization", OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(staff)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name", is("Nurse Florence")))
                .andExpect(jsonPath("$.department", is("Emergency")))
                .andExpect(jsonPath("$.designation", is("Senior Staff Nurse")))
                .andReturn().getResponse().getContentAsString();

        Staff createdStaff = objectMapper.readValue(responseJson, Staff.class);

        // Search staff
        mockMvc.perform(get("/staff")
                        .header("Authorization", OWNER_TOKEN)
                        .param("search", "florence")
                        .param("department", "Emergency"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name", is("Nurse Florence")));

        // Toggle status
        mockMvc.perform(patch("/staff/" + createdStaff.getId() + "/status")
                        .header("Authorization", OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active", is(false)));

        // Verify audit logs were persisted
        List<AuditLog> auditLogs = auditLogRepository.findAll();
        assertThat(auditLogs).isNotEmpty();
        assertThat(auditLogs.stream().anyMatch(l -> "STAFF_CREATED".equals(l.getAction()))).isTrue();
        assertThat(auditLogs.stream().anyMatch(l -> "STAFF_STATUS_CHANGED".equals(l.getAction()))).isTrue();
    }

    // ==========================================
    // 2. Attendance Check-in / Check-out & Prevention of Duplicates
    // ==========================================

    @Test
    @DisplayName("Attendance: Check-in, duplicate check-in rejection, and check-out")
    void testAttendance_CheckInAndCheckOut() throws Exception {
        Staff staff = staffRepository.save(Staff.builder()
                .name("Dr. Rahul Sharma")
                .role("Physician")
                .department("Cardiology")
                .email("rahul.sharma@ggnh.org")
                .user(ownerUser)
                .build());

        // 1. Staff check in
        mockMvc.perform(post("/attendance/check-in")
                        .header("Authorization", OWNER_TOKEN)
                        .param("staffId", staff.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("present")))
                .andExpect(jsonPath("$.checkInTime").isNotEmpty());

        // 2. Duplicate check-in fails with 409 Conflict
        mockMvc.perform(post("/attendance/check-in")
                        .header("Authorization", OWNER_TOKEN)
                        .param("staffId", staff.getId().toString()))
                .andExpect(status().isConflict());

        // 3. Staff check out
        mockMvc.perform(post("/attendance/check-out")
                        .header("Authorization", OWNER_TOKEN)
                        .param("staffId", staff.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkOutTime").isNotEmpty());

        // 4. Duplicate check-out fails with 409 Conflict
        mockMvc.perform(post("/attendance/check-out")
                        .header("Authorization", OWNER_TOKEN)
                        .param("staffId", staff.getId().toString()))
                .andExpect(status().isConflict());

        // 5. Admin can mark/correct attendance with notes
        MarkAttendanceRequest markReq = MarkAttendanceRequest.builder()
                .date(LocalDate.now().toString())
                .staffId(staff.getId())
                .status("over-time")
                .notes("Covered emergency night shift")
                .build();

        mockMvc.perform(post("/attendance/mark")
                        .header("Authorization", OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(markReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("over-time")));
    }

    // ==========================================
    // 3. Inventory Stock Adjustment & Negative Stock Prevention
    // ==========================================

    @Test
    @DisplayName("Inventory: Adjust stock, prevent negative stock, and record audit ledger")
    void testInventory_AdjustStockAndNegativeCheck() throws Exception {
        InventoryCategory category = categoryRepository.save(InventoryCategory.builder()
                .name("Pharmaceuticals")
                .code("PHARM-01")
                .build());

        InventoryItem item = itemRepository.save(InventoryItem.builder()
                .name("Paracetamol 500mg")
                .sku("MED-PCM-500")
                .description("Antipyretic and analgesic tablets")
                .category(category)
                .unit("Strip")
                .reorderLevel(10)
                .currentStock(50)
                .build());

        // 1. Issue 20 units -> new balance = 30
        AdjustStockRequest issueReq = AdjustStockRequest.builder()
                .itemId(item.getId())
                .action("issue")
                .quantity(20)
                .notes("Dispatched to Ward A")
                .build();

        mockMvc.perform(post("/inventory/adjust")
                        .header("Authorization", OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(issueReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStock", is(30)));

        // 2. Attempt to issue 40 units (more than available 30) -> 400 Bad Request
        AdjustStockRequest excessiveIssue = AdjustStockRequest.builder()
                .itemId(item.getId())
                .action("issue")
                .quantity(40)
                .notes("Excessive request")
                .build();

        mockMvc.perform(post("/inventory/adjust")
                        .header("Authorization", OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(excessiveIssue)))
                .andExpect(status().isBadRequest());

        // 3. Verify ledger transactions recorded
        mockMvc.perform(get("/inventory/ledger")
                        .header("Authorization", OWNER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].action", is("issue")))
                .andExpect(jsonPath("$[0].quantity", is(-20)))
                .andExpect(jsonPath("$[0].balanceAfter", is(30)));
    }

    // ==========================================
    // 4. Appointment Lifecycle & Patient Self-Service Isolation
    // ==========================================

    @Test
    @DisplayName("Appointments: Public booking with date/slot, confirmation, patient cancellation and isolation")
    void testAppointment_LifecycleAndPatientIsolation() throws Exception {
        // 1. Public booking with date & slot
        CreateAppointmentRequest booking = CreateAppointmentRequest.builder()
                .patientName("Alice Smith")
                .patientPhone("+91-9998887770")
                .patientEmail("patient.alice@example.com")
                .doctorName("Dr. Vikas Gupta")
                .message("Routine general health checkup")
                .appointmentDate(LocalDate.now().plusDays(2))
                .timeSlot("10:00 AM - 11:00 AM")
                .build();

        UUID key = UUID.randomUUID();
        String resJson = mockMvc.perform(post("/appointments")
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(booking)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("booked")))
                .andExpect(jsonPath("$.appointmentDate", is(LocalDate.now().plusDays(2).toString())))
                .andExpect(jsonPath("$.timeSlot", is("10:00 AM - 11:00 AM")))
                .andReturn().getResponse().getContentAsString();

        Appointment appt = objectMapper.readValue(resJson, Appointment.class);

        // 2. Staff confirms appointment
        mockMvc.perform(patch("/appointments/" + appt.getId() + "/confirm")
                        .header("Authorization", OWNER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("confirmed")));

        // 3. Patient Alice views her appointments
        mockMvc.perform(get("/appointments/my")
                        .header("Authorization", PATIENT_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(appt.getId().toString())));

        // 4. Unauthorized patient Bob tries to cancel Alice's appointment -> 403 Forbidden
        mockMvc.perform(patch("/appointments/" + appt.getId() + "/cancel")
                        .header("Authorization", OTHER_PATIENT_TOKEN))
                .andExpect(status().isForbidden());

        // 5. Patient Alice cancels her own appointment -> 200 OK
        mockMvc.perform(patch("/appointments/" + appt.getId() + "/cancel")
                        .header("Authorization", PATIENT_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("cancelled")));
    }

    // ==========================================
    // 5. Dashboard Summary Complete Operational Metrics
    // ==========================================

    @Test
    @DisplayName("Dashboard: Real operational summary including appointments, staff, inventory and audit activity")
    void testDashboard_Summary() throws Exception {
        mockMvc.perform(get("/dashboard/summary")
                        .header("Authorization", OWNER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appointments").exists())
                .andExpect(jsonPath("$.staff").exists())
                .andExpect(jsonPath("$.attendance").exists())
                .andExpect(jsonPath("$.inventory").exists())
                .andExpect(jsonPath("$.recentActivities").isArray());
    }
}

package com.ggnh.hub.dashboard;

import com.ggnh.hub.dto.DashboardSummaryResponse;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class DashboardIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private AppointmentIdempotencyRepository idempotencyRepository;

    @Autowired
    private AppointmentOutboxRepository outboxRepository;

    @Autowired
    private StaffRepository staffRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

    @Autowired
    private InventoryCategoryRepository categoryRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private StockReceiptRepository receiptRepository;

    @Autowired
    private StockReceiptItemRepository receiptItemRepository;

    @Autowired
    private InventoryLedgerRepository ledgerRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserPermissionRepository userPermissionRepository;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String AUTH_TOKEN = "staff-auth-token";

    @BeforeEach
    void setUp() throws Exception {
        attendanceRepository.deleteAll();
        staffRepository.deleteAll();
        idempotencyRepository.deleteAll();
        outboxRepository.deleteAll();
        appointmentRepository.deleteAll();
        ledgerRepository.deleteAll();
        receiptItemRepository.deleteAll();
        receiptRepository.deleteAll();
        itemRepository.deleteAll();
        categoryRepository.deleteAll();
        supplierRepository.deleteAll();
        userRepository.deleteAll();

        Role editorRole = roleRepository.findByName("editor")
                .orElseGet(() -> roleRepository.save(new Role(null, "editor", "Editor")));

        User user = User.builder()
                .email("staff@ggnh.org")
                .firebaseUid("staff-uid")
                .isActive(true)
                .roles(new HashSet<>(Set.of(editorRole)))
                .build();

        UserPermission perm = UserPermission.builder()
                .user(user)
                .manageAttendance(true)
                .manageAppointments(true)
                .manageUsers(false)
                .manageInventory(true)
                .manageInventoryReports(true)
                .build();
        user.setPermissions(perm);
        userRepository.save(user);

        when(tokenVerifier.verifyToken(AUTH_TOKEN))
                .thenReturn(FirebaseTokenHolder.builder()
                        .uid("staff-uid")
                        .email("staff@ggnh.org")
                        .emailVerified(true)
                        .build());
    }

    @Test
    @DisplayName("GET /dashboard/summary returns populated metrics and statistics")
    void testGetDashboardSummary() throws Exception {
        // Seed appointment
        Appointment appt = Appointment.builder()
                .patientName("Aarav Mehta")
                .patientPhone("9876543210")
                .patientEmail("aarav@example.com")
                .doctorName("Dr. Vikas Gupta")
                .status(AppointmentStatus.BOOKED)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
        appointmentRepository.save(appt);

        // Seed staff & attendance
        Staff staffMember = Staff.builder()
                .name("Nurse Suman")
                .role("Head Nurse")
                .phone("9876500001")
                .email("suman@ggnh.org")
                .isActive(true)
                .build();
        Staff savedStaff = staffRepository.save(staffMember);

        Attendance att = Attendance.builder()
                .staff(savedStaff)
                .attendanceDate(LocalDate.now())
                .status(AttendanceStatus.PRESENT)
                .build();
        attendanceRepository.save(att);

        // Seed category & item
        InventoryCategory cat = categoryRepository.save(InventoryCategory.builder()
                .name("General Supplies")
                .code("GEN")
                .isActive(true)
                .build());

        itemRepository.save(InventoryItem.builder()
                .name("Latex Gloves L")
                .sku("GLV-L")
                .category(cat)
                .unit("box")
                .reorderLevel(15)
                .currentStock(5) // low stock
                .isActive(true)
                .build());

        mockMvc.perform(get("/dashboard/summary")
                        .header("Authorization", "Bearer " + AUTH_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appointments.total").value(1))
                .andExpect(jsonPath("$.appointments.booked").value(1))
                .andExpect(jsonPath("$.staff.total").value(1))
                .andExpect(jsonPath("$.staff.active").value(1))
                .andExpect(jsonPath("$.attendance.presentToday").value(1))
                .andExpect(jsonPath("$.attendance.attendancePercentage").value(100.0))
                .andExpect(jsonPath("$.inventory.totalItems").value(1))
                .andExpect(jsonPath("$.inventory.lowStockItems").value(1))
                .andExpect(jsonPath("$.recentActivities", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("Unauthenticated request to /dashboard/summary is rejected with 401")
    void testUnauthenticatedSummary() throws Exception {
        mockMvc.perform(get("/dashboard/summary"))
                .andExpect(status().isUnauthorized());
    }
}

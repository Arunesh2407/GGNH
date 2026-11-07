package com.ggnh.hub;

import com.ggnh.hub.entity.*;
import com.ggnh.hub.entity.enums.AppointmentStatus;
import com.ggnh.hub.entity.enums.AttendanceStatus;
import com.ggnh.hub.entity.enums.LedgerAction;
import com.ggnh.hub.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class RepositoryIntegrationTest {

    @Autowired
    private StaffRepository staffRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private InventoryCategoryRepository categoryRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

    @Autowired
    private StockReceiptRepository receiptRepository;

    @Autowired
    private InventoryLedgerRepository ledgerRepository;

    @Test
    @DisplayName("Should persist and retrieve staff and relational attendance")
    void shouldPersistStaffAndAttendance() {
        Staff staff = Staff.builder()
                .name("Nurse Jane Doe")
                .role("Registered Nurse")
                .email("jane.doe@ggnh.internal")
                .phone("+919876543210")
                .build();
        Staff savedStaff = staffRepository.save(staff);
        assertThat(savedStaff.getId()).isNotNull();

        LocalDate today = LocalDate.now();
        Attendance attendance = Attendance.builder()
                .staff(savedStaff)
                .attendanceDate(today)
                .status(AttendanceStatus.PRESENT)
                .build();
        Attendance savedAttendance = attendanceRepository.save(attendance);
        assertThat(savedAttendance.getId()).isNotNull();

        List<Attendance> records = attendanceRepository.findByAttendanceDate(today);
        assertThat(records).hasSize(1);
        assertThat(records.get(0).getStaff().getName()).isEqualTo("Nurse Jane Doe");
        assertThat(records.get(0).getStatus()).isEqualTo(AttendanceStatus.PRESENT);
    }

    @Test
    @DisplayName("Should persist appointment and triage status")
    void shouldPersistAppointment() {
        Appointment appointment = Appointment.builder()
                .patientName("John Smith")
                .patientEmail("john.smith@example.com")
                .patientPhone("+919876543211")
                .doctorName("Dr. Sarah Wilson")
                .message("Routine elderly health checkup")
                .status(AppointmentStatus.BOOKED)
                .build();

        Appointment saved = appointmentRepository.save(appointment);
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(AppointmentStatus.BOOKED);
        assertThat(saved.getPatientName()).isEqualTo("John Smith");
    }

    @Test
    @DisplayName("Should persist user, roles, and granular permissions")
    void shouldPersistUserWithRolesAndPermissions() {
        Role role = roleRepository.findByName("owner")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("owner")
                        .description("Super Administrator")
                        .build()));

        User user = User.builder()
                .email("admin@ggnh.internal")
                .passwordHash("$2a$12$DummyHashedPasswordForTest")
                .isActive(true)
                .roles(Set.of(role))
                .build();

        UserPermission permission = UserPermission.builder()
                .user(user)
                .manageAttendance(true)
                .manageAppointments(true)
                .manageUsers(true)
                .manageInventory(true)
                .manageInventoryReports(true)
                .build();
        user.setPermissions(permission);

        User savedUser = userRepository.save(user);
        assertThat(savedUser.getId()).isNotNull();

        Optional<User> retrieved = userRepository.findByEmail("admin@ggnh.internal");
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getRoles()).hasSize(1);
        assertThat(retrieved.get().getPermissions().isManageUsers()).isTrue();
    }

    @Test
    @DisplayName("Should persist inventory category, supplier, items, receipts, and ledger")
    void shouldPersistCompleteInventoryLifecycle() {
        InventoryCategory category = categoryRepository.save(InventoryCategory.builder()
                .name("Medical Supplies")
                .code("MED-SUP")
                .description("Bandages, syringes, and clinical consumables")
                .build());

        Supplier supplier = supplierRepository.save(Supplier.builder()
                .name("Apex Pharma Ltd")
                .code("SUP-APEX")
                .contactPerson("Rajesh Kumar")
                .email("orders@apexpharma.internal")
                .phone("+911122334455")
                .build());

        InventoryItem item = itemRepository.save(InventoryItem.builder()
                .name("Sterile Syringe 5ml")
                .sku("SYR-5ML-001")
                .category(category)
                .defaultSupplier(supplier)
                .unit("box")
                .reorderLevel(10)
                .currentStock(50)
                .build());

        assertThat(item.getId()).isNotNull();
        assertThat(item.getVersion()).isEqualTo(0L);

        StockReceipt receipt = StockReceipt.builder()
                .receiptNumber("REC-2026-0001")
                .supplier(supplier)
                .receivedDate(LocalDate.now())
                .receivedBy("store.manager@ggnh.internal")
                .notes("Standard monthly replenishment")
                .build();

        StockReceiptItem receiptItem = StockReceiptItem.builder()
                .receipt(receipt)
                .item(item)
                .quantity(20)
                .unitCost(new BigDecimal("150.50"))
                .batchNo("BATCH-2026-A")
                .expiryDate(LocalDate.now().plusYears(2))
                .build();
        receipt.getItems().add(receiptItem);

        StockReceipt savedReceipt = receiptRepository.save(receipt);
        assertThat(savedReceipt.getId()).isNotNull();
        assertThat(savedReceipt.getItems()).hasSize(1);

        InventoryLedger ledgerEntry = ledgerRepository.save(InventoryLedger.builder()
                .item(item)
                .action(LedgerAction.RECEIVE)
                .quantity(20)
                .balanceAfter(70)
                .sourceId(savedReceipt.getId())
                .sourceType("stock-receipt")
                .notes("Receipt REC-2026-0001 inward movement")
                .createdBy("store.manager@ggnh.internal")
                .build());

        assertThat(ledgerEntry.getId()).isNotNull();
        assertThat(ledgerEntry.getAction()).isEqualTo(LedgerAction.RECEIVE);
        assertThat(ledgerEntry.getBalanceAfter()).isEqualTo(70);
    }
}


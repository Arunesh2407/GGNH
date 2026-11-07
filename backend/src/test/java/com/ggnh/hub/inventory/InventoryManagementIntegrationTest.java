package com.ggnh.hub.inventory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ggnh.hub.dto.*;
import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.UserPermission;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class InventoryManagementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InventoryCategoryRepository categoryRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

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

    private static final String OWNER_TOKEN = "owner-token";
    private static final String VIEWER_TOKEN = "viewer-token";

    @BeforeEach
    void setUp() throws Exception {
        // Clean inventory tables in FK order
        ledgerRepository.deleteAll();
        receiptItemRepository.deleteAll();
        receiptRepository.deleteAll();
        itemRepository.deleteAll();
        categoryRepository.deleteAll();
        supplierRepository.deleteAll();

        // Setup users
        userPermissionRepository.deleteAll();
        userRepository.deleteAll();

        Role ownerRole = roleRepository.findByName("owner")
                .orElseGet(() -> roleRepository.save(new Role(null, "owner", "Owner")));

        Role viewerRole = roleRepository.findByName("viewer")
                .orElseGet(() -> roleRepository.save(new Role(null, "viewer", "Viewer")));

        User owner = User.builder()
                .email("owner@ggnh.org")
                .firebaseUid("owner-uid")
                .isActive(true)
                .roles(new HashSet<>(Set.of(ownerRole)))
                .build();

        UserPermission ownerPerm = UserPermission.builder()
                .user(owner)
                .manageAttendance(true)
                .manageAppointments(true)
                .manageUsers(true)
                .manageInventory(true)
                .manageInventoryReports(true)
                .build();
        owner.setPermissions(ownerPerm);
        userRepository.save(owner);

        User viewer = User.builder()
                .email("viewer@ggnh.org")
                .firebaseUid("viewer-uid")
                .isActive(true)
                .roles(new HashSet<>(Set.of(viewerRole)))
                .build();

        UserPermission viewerPerm = UserPermission.builder()
                .user(viewer)
                .manageAttendance(false)
                .manageAppointments(false)
                .manageUsers(false)
                .manageInventory(false)
                .manageInventoryReports(false)
                .build();
        viewer.setPermissions(viewerPerm);
        userRepository.save(viewer);

        when(tokenVerifier.verifyToken(OWNER_TOKEN))
                .thenReturn(FirebaseTokenHolder.builder()
                        .uid("owner-uid")
                        .email("owner@ggnh.org")
                        .emailVerified(true)
                        .build());

        when(tokenVerifier.verifyToken(VIEWER_TOKEN))
                .thenReturn(FirebaseTokenHolder.builder()
                        .uid("viewer-uid")
                        .email("viewer@ggnh.org")
                        .emailVerified(true)
                        .build());
    }

    @Test
    @DisplayName("Category lifecycle: create, list, and update")
    void testCategoryLifecycle() throws Exception {
        CreateInventoryCategoryRequest createReq = CreateInventoryCategoryRequest.builder()
                .name("Pharmaceuticals")
                .code("PHARM")
                .description("Prescription medications")
                .isActive(true)
                .build();

        String res = mockMvc.perform(post("/inventory/categories")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.code").value("PHARM"))
                .andReturn().getResponse().getContentAsString();

        InventoryCategoryResponse created = objectMapper.readValue(res, InventoryCategoryResponse.class);

        // List
        mockMvc.perform(get("/inventory/categories")
                        .header("Authorization", "Bearer " + OWNER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("Pharmaceuticals"));

        // Update
        UpdateInventoryCategoryRequest updateReq = UpdateInventoryCategoryRequest.builder()
                .name("Medicines & Pharmaceuticals")
                .code("PHARM")
                .description("Updated description")
                .isActive(true)
                .build();

        mockMvc.perform(put("/inventory/categories/" + created.getId())
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Medicines & Pharmaceuticals"));
    }

    @Test
    @DisplayName("Stock receiving atomically updates item currentStock and appends ledger record")
    void testStockReceivingAndLedger() throws Exception {
        // 1. Create category
        CreateInventoryCategoryRequest catReq = CreateInventoryCategoryRequest.builder()
                .name("Surgical Supplies")
                .code("SURG")
                .isActive(true)
                .build();
        String catRes = mockMvc.perform(post("/inventory/categories")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(catReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        InventoryCategoryResponse cat = objectMapper.readValue(catRes, InventoryCategoryResponse.class);

        // 2. Create supplier
        CreateSupplierRequest supReq = CreateSupplierRequest.builder()
                .name("MedTech Corp")
                .code("MEDTECH")
                .email("sales@medtech.com")
                .phone("1234567890")
                .isActive(true)
                .build();
        String supRes = mockMvc.perform(post("/inventory/suppliers")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(supReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        SupplierResponse sup = objectMapper.readValue(supRes, SupplierResponse.class);

        // 3. Create item
        CreateInventoryItemRequest itemReq = CreateInventoryItemRequest.builder()
                .name("Disposable Syringes 5ml")
                .sku("SYR-5ML")
                .categoryId(cat.getId())
                .supplierId(sup.getId())
                .unit("box")
                .reorderLevel(10)
                .isActive(true)
                .build();
        String itemRes = mockMvc.perform(post("/inventory/items")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(itemReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.currentStock").value(0))
                .andReturn().getResponse().getContentAsString();
        InventoryItemResponse item = objectMapper.readValue(itemRes, InventoryItemResponse.class);

        // 4. Receive stock (qty = 50)
        ReceiveStockRequest receiveReq = ReceiveStockRequest.builder()
                .itemId(item.getId())
                .supplierId(sup.getId())
                .quantity(50)
                .unitCost(new BigDecimal("12.50"))
                .batchNo("BATCH-2026-001")
                .receivedDate(LocalDate.now())
                .notes("Initial shipment")
                .build();

        mockMvc.perform(post("/inventory/stock-receipts")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(receiveReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.receiptNumber").isNotEmpty())
                .andExpect(jsonPath("$.quantity").value(50));

        // 5. Verify item currentStock is updated to 50
        mockMvc.perform(get("/inventory/items/" + item.getId())
                        .header("Authorization", "Bearer " + OWNER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStock").value(50));

        // 6. Verify stock availability report
        mockMvc.perform(get("/inventory/reports/stock-availability")
                        .header("Authorization", "Bearer " + OWNER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].currentStock").value(50))
                .andExpect(jsonPath("$[0].isLowStock").value(false));

        // 7. Verify item trace report
        mockMvc.perform(get("/inventory/reports/trace/" + item.getId())
                        .header("Authorization", "Bearer " + OWNER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows", hasSize(1)))
                .andExpect(jsonPath("$.rows[0].quantity").value(50))
                .andExpect(jsonPath("$.rows[0].balanceAfter").value(50));
    }

    @Test
    @DisplayName("Viewer role without inventory permission is denied access to management endpoints")
    void testViewerUnauthorized() throws Exception {
        CreateInventoryCategoryRequest req = CreateInventoryCategoryRequest.builder()
                .name("Denied Cat")
                .code("DENIED")
                .build();

        mockMvc.perform(post("/inventory/categories")
                        .header("Authorization", "Bearer " + VIEWER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }
}

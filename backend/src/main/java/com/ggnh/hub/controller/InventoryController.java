package com.ggnh.hub.controller;

import com.ggnh.hub.dto.*;
import com.ggnh.hub.security.model.FirebaseUserDetails;
import com.ggnh.hub.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    // ==========================================
    // 1. Categories
    // ==========================================

    @GetMapping("/categories")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY') or hasAuthority('PERM_MANAGE_INVENTORY_REPORTS') or hasAuthority('view-inventory-reports')")
    public ResponseEntity<List<InventoryCategoryResponse>> listCategories() {
        return ResponseEntity.ok(inventoryService.listCategories());
    }

    @GetMapping("/categories/{id}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<InventoryCategoryResponse> getCategory(@PathVariable UUID id) {
        return ResponseEntity.ok(inventoryService.getCategory(id));
    }

    @PostMapping("/categories")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<InventoryCategoryResponse> createCategory(
            @Valid @RequestBody CreateInventoryCategoryRequest request,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createCategory(request, actor));
    }

    @PutMapping("/categories/{id}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<InventoryCategoryResponse> updateCategory(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateInventoryCategoryRequest request,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        return ResponseEntity.ok(inventoryService.updateCategory(id, request, actor));
    }

    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<Void> deleteCategory(
            @PathVariable UUID id,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        inventoryService.deleteCategory(id, actor);
        return ResponseEntity.noContent().build();
    }

    // ==========================================
    // 2. Suppliers
    // ==========================================

    @GetMapping("/suppliers")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY') or hasAuthority('PERM_MANAGE_INVENTORY_REPORTS') or hasAuthority('view-inventory-reports')")
    public ResponseEntity<List<SupplierResponse>> listSuppliers() {
        return ResponseEntity.ok(inventoryService.listSuppliers());
    }

    @GetMapping("/suppliers/{id}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<SupplierResponse> getSupplier(@PathVariable UUID id) {
        return ResponseEntity.ok(inventoryService.getSupplier(id));
    }

    @PostMapping("/suppliers")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<SupplierResponse> createSupplier(
            @Valid @RequestBody CreateSupplierRequest request,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createSupplier(request, actor));
    }

    @PutMapping("/suppliers/{id}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<SupplierResponse> updateSupplier(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateSupplierRequest request,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        return ResponseEntity.ok(inventoryService.updateSupplier(id, request, actor));
    }

    @DeleteMapping("/suppliers/{id}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<Void> deleteSupplier(
            @PathVariable UUID id,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        inventoryService.deleteSupplier(id, actor);
        return ResponseEntity.noContent().build();
    }

    // ==========================================
    // 3. Inventory Items
    // ==========================================

    @GetMapping("/items")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY') or hasAuthority('PERM_MANAGE_INVENTORY_REPORTS') or hasAuthority('view-inventory-reports')")
    public ResponseEntity<List<InventoryItemResponse>> listItems(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) Boolean isLowStock
    ) {
        if (search != null || categoryId != null || isLowStock != null) {
            return ResponseEntity.ok(inventoryService.searchItems(search, categoryId, isLowStock));
        }
        return ResponseEntity.ok(inventoryService.listItems());
    }

    @GetMapping("/items/{id}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<InventoryItemResponse> getItem(@PathVariable UUID id) {
        return ResponseEntity.ok(inventoryService.getItem(id));
    }

    @PostMapping("/items")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<InventoryItemResponse> createItem(
            @Valid @RequestBody CreateInventoryItemRequest request,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createItem(request, actor));
    }

    @PutMapping("/items/{id}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<InventoryItemResponse> updateItem(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateInventoryItemRequest request,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        return ResponseEntity.ok(inventoryService.updateItem(id, request, actor));
    }

    @DeleteMapping("/items/{id}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<Void> deleteItem(
            @PathVariable UUID id,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        inventoryService.deleteItem(id, actor);
        return ResponseEntity.noContent().build();
    }

    // ==========================================
    // 4. Stock Receiving & Adjustment
    // ==========================================

    @GetMapping("/stock-receipts")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<List<StockReceiptResponse>> listStockReceipts() {
        return ResponseEntity.ok(inventoryService.listStockReceipts());
    }

    @PostMapping("/stock-receipts")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<StockReceiptResponse> receiveStock(
            @Valid @RequestBody ReceiveStockRequest request,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.receiveStock(request, actor));
    }

    @PostMapping("/adjust")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY')")
    public ResponseEntity<InventoryItemResponse> adjustStock(
            @Valid @RequestBody AdjustStockRequest request,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        return ResponseEntity.ok(inventoryService.adjustStock(request, actor));
    }

    @GetMapping("/ledger")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasAuthority('PERM_MANAGE_INVENTORY') or hasAuthority('PERM_MANAGE_INVENTORY_REPORTS') or hasAuthority('view-inventory-reports')")
    public ResponseEntity<List<InventoryLedgerResponse>> listTransactions(
            @RequestParam(defaultValue = "50") int limit
    ) {
        return ResponseEntity.ok(inventoryService.listTransactions(limit));
    }

    // ==========================================
    // 5. Reports
    // ==========================================

    @GetMapping("/reports/stock-availability")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasRole('auditor') or hasAuthority('PERM_MANAGE_INVENTORY') or hasAuthority('PERM_MANAGE_INVENTORY_REPORTS') or hasAuthority('view-inventory-reports')")
    public ResponseEntity<List<StockAvailabilityReportResponse>> getStockAvailabilityReport() {
        return ResponseEntity.ok(inventoryService.getStockAvailabilityReport());
    }

    @GetMapping("/reports/trace/{itemId}")
    @PreAuthorize("hasRole('owner') or hasRole('store-manager') or hasRole('auditor') or hasAuthority('PERM_MANAGE_INVENTORY') or hasAuthority('PERM_MANAGE_INVENTORY_REPORTS') or hasAuthority('view-inventory-reports')")
    public ResponseEntity<ItemTraceReportResponse> getItemTraceReport(@PathVariable UUID itemId) {
        return ResponseEntity.ok(inventoryService.getItemTraceReport(itemId));
    }
}

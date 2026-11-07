package com.ggnh.hub.service;

import com.ggnh.hub.dto.*;
import com.ggnh.hub.entity.*;
import com.ggnh.hub.entity.enums.LedgerAction;
import com.ggnh.hub.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryCategoryRepository categoryRepository;
    private final SupplierRepository supplierRepository;
    private final InventoryItemRepository itemRepository;
    private final StockReceiptRepository receiptRepository;
    private final StockReceiptItemRepository receiptItemRepository;
    private final InventoryLedgerRepository ledgerRepository;
    private final AuditService auditService;

    // ==========================================
    // 1. Categories
    // ==========================================

    @Transactional(readOnly = true)
    public List<InventoryCategoryResponse> listCategories() {
        return categoryRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(this::toCategoryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryCategoryResponse getCategory(UUID id) {
        return categoryRepository.findById(id)
                .map(this::toCategoryResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found: " + id));
    }

    @Transactional
    public InventoryCategoryResponse createCategory(CreateInventoryCategoryRequest request) {
        return createCategory(request, "Staff");
    }

    @Transactional
    public InventoryCategoryResponse createCategory(CreateInventoryCategoryRequest request, String actor) {
        String code = request.getCode().trim().toUpperCase(Locale.ROOT);
        String name = request.getName().trim();

        if (categoryRepository.existsByCode(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category code already exists: " + code);
        }
        if (categoryRepository.existsByName(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category name already exists: " + name);
        }

        InventoryCategory category = InventoryCategory.builder()
                .name(name)
                .code(code)
                .description(request.getDescription() != null ? request.getDescription().trim() : "")
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        InventoryCategory saved = categoryRepository.save(category);
        auditService.record(actor, "INVENTORY", "CATEGORY_CREATED", saved.getId().toString(), "Created category: " + saved.getName());
        return toCategoryResponse(saved);
    }

    @Transactional
    public InventoryCategoryResponse updateCategory(UUID id, UpdateInventoryCategoryRequest request) {
        return updateCategory(id, request, "Staff");
    }

    @Transactional
    public InventoryCategoryResponse updateCategory(UUID id, UpdateInventoryCategoryRequest request, String actor) {
        InventoryCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found: " + id));

        String code = request.getCode().trim().toUpperCase(Locale.ROOT);
        String name = request.getName().trim();

        if (!category.getCode().equalsIgnoreCase(code) && categoryRepository.existsByCode(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category code already exists: " + code);
        }
        if (!category.getName().equalsIgnoreCase(name) && categoryRepository.existsByName(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category name already exists: " + name);
        }

        category.setName(name);
        category.setCode(code);
        category.setDescription(request.getDescription() != null ? request.getDescription().trim() : "");
        category.setActive(request.isActive());

        InventoryCategory saved = categoryRepository.save(category);
        auditService.record(actor, "INVENTORY", "CATEGORY_UPDATED", saved.getId().toString(), "Updated category: " + saved.getName());
        return toCategoryResponse(saved);
    }

    @Transactional
    public void deleteCategory(UUID id) {
        deleteCategory(id, "Staff");
    }

    @Transactional
    public void deleteCategory(UUID id, String actor) {
        if (!categoryRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found: " + id);
        }
        List<InventoryItem> items = itemRepository.findByCategoryId(id);
        if (!items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot delete category that is referenced by inventory items");
        }
        categoryRepository.deleteById(id);
        auditService.record(actor, "INVENTORY", "CATEGORY_DELETED", id.toString(), "Deleted inventory category");
    }

    // ==========================================
    // 2. Suppliers
    // ==========================================

    @Transactional(readOnly = true)
    public List<SupplierResponse> listSuppliers() {
        return supplierRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(this::toSupplierResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierResponse getSupplier(UUID id) {
        return supplierRepository.findById(id)
                .map(this::toSupplierResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Supplier not found: " + id));
    }

    @Transactional
    public SupplierResponse createSupplier(CreateSupplierRequest request) {
        return createSupplier(request, "Staff");
    }

    @Transactional
    public SupplierResponse createSupplier(CreateSupplierRequest request, String actor) {
        String code = request.getCode().trim().toUpperCase(Locale.ROOT);
        String name = request.getName().trim();

        if (supplierRepository.existsByCode(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Supplier code already exists: " + code);
        }

        Supplier supplier = Supplier.builder()
                .name(name)
                .code(code)
                .contactPerson(request.getContactPerson() != null ? request.getContactPerson().trim() : "")
                .email(request.getEmail() != null ? request.getEmail().trim().toLowerCase(Locale.ROOT) : "")
                .phone(request.getPhone() != null ? request.getPhone().trim() : "")
                .address(request.getAddress() != null ? request.getAddress().trim() : "")
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        Supplier saved = supplierRepository.save(supplier);
        auditService.record(actor, "INVENTORY", "SUPPLIER_CREATED", saved.getId().toString(), "Created supplier: " + saved.getName());
        return toSupplierResponse(saved);
    }

    @Transactional
    public SupplierResponse updateSupplier(UUID id, UpdateSupplierRequest request) {
        return updateSupplier(id, request, "Staff");
    }

    @Transactional
    public SupplierResponse updateSupplier(UUID id, UpdateSupplierRequest request, String actor) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Supplier not found: " + id));

        String code = request.getCode().trim().toUpperCase(Locale.ROOT);
        String name = request.getName().trim();

        if (!supplier.getCode().equalsIgnoreCase(code) && supplierRepository.existsByCode(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Supplier code already exists: " + code);
        }

        supplier.setName(name);
        supplier.setCode(code);
        supplier.setContactPerson(request.getContactPerson() != null ? request.getContactPerson().trim() : "");
        supplier.setEmail(request.getEmail() != null ? request.getEmail().trim().toLowerCase(Locale.ROOT) : "");
        supplier.setPhone(request.getPhone() != null ? request.getPhone().trim() : "");
        supplier.setAddress(request.getAddress() != null ? request.getAddress().trim() : "");
        supplier.setActive(request.isActive());

        Supplier saved = supplierRepository.save(supplier);
        auditService.record(actor, "INVENTORY", "SUPPLIER_UPDATED", saved.getId().toString(), "Updated supplier: " + saved.getName());
        return toSupplierResponse(saved);
    }

    @Transactional
    public void deleteSupplier(UUID id) {
        deleteSupplier(id, "Staff");
    }

    @Transactional
    public void deleteSupplier(UUID id, String actor) {
        if (!supplierRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Supplier not found: " + id);
        }
        supplierRepository.deleteById(id);
        auditService.record(actor, "INVENTORY", "SUPPLIER_DELETED", id.toString(), "Deleted supplier");
    }

    // ==========================================
    // 3. Inventory Items
    // ==========================================

    @Transactional(readOnly = true)
    public List<InventoryItemResponse> listItems() {
        return itemRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(this::toItemResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InventoryItemResponse> searchItems(String search, UUID categoryId, Boolean isLowStock) {
        List<InventoryItem> items = itemRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        return items.stream()
                .filter(i -> {
                    if (search != null && !search.isBlank()) {
                        String q = search.trim().toLowerCase();
                        boolean match = i.getName().toLowerCase().contains(q) ||
                                        i.getSku().toLowerCase().contains(q);
                        if (!match) return false;
                    }
                    if (categoryId != null && (i.getCategory() == null || !i.getCategory().getId().equals(categoryId))) {
                        return false;
                    }
                    if (isLowStock != null && isLowStock && (i.getCurrentStock() > i.getReorderLevel())) {
                        return false;
                    }
                    return true;
                })
                .map(this::toItemResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryItemResponse getItem(UUID id) {
        return itemRepository.findById(id)
                .map(this::toItemResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found: " + id));
    }

    @Transactional
    public InventoryItemResponse createItem(CreateInventoryItemRequest request) {
        return createItem(request, "Staff");
    }

    @Transactional
    public InventoryItemResponse createItem(CreateInventoryItemRequest request, String actor) {
        String sku = request.getSku().trim().toUpperCase(Locale.ROOT);
        if (itemRepository.existsBySku(sku)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SKU already exists: " + sku);
        }

        InventoryCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found: " + request.getCategoryId()));

        Supplier supplier = null;
        if (request.getSupplierId() != null) {
            supplier = supplierRepository.findById(request.getSupplierId())
                    .orElse(null);
        }

        InventoryItem item = InventoryItem.builder()
                .name(request.getName().trim())
                .sku(sku)
                .description(request.getDescription() != null ? request.getDescription().trim() : "")
                .category(category)
                .defaultSupplier(supplier)
                .unit(request.getUnit().trim())
                .reorderLevel(request.getReorderLevel())
                .currentStock(0)
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        InventoryItem saved = itemRepository.save(item);
        auditService.record(actor, "INVENTORY", "ITEM_CREATED", saved.getId().toString(), "Created item: " + saved.getName() + " (" + saved.getSku() + ")");
        return toItemResponse(saved);
    }

    @Transactional
    public InventoryItemResponse updateItem(UUID id, UpdateInventoryItemRequest request) {
        return updateItem(id, request, "Staff");
    }

    @Transactional
    public InventoryItemResponse updateItem(UUID id, UpdateInventoryItemRequest request, String actor) {
        InventoryItem item = itemRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found: " + id));

        String sku = request.getSku().trim().toUpperCase(Locale.ROOT);
        if (!item.getSku().equalsIgnoreCase(sku) && itemRepository.existsBySku(sku)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SKU already exists: " + sku);
        }

        InventoryCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found: " + request.getCategoryId()));

        Supplier supplier = null;
        if (request.getSupplierId() != null) {
            supplier = supplierRepository.findById(request.getSupplierId())
                    .orElse(null);
        }

        item.setName(request.getName().trim());
        item.setSku(sku);
        item.setDescription(request.getDescription() != null ? request.getDescription().trim() : "");
        item.setCategory(category);
        item.setDefaultSupplier(supplier);
        item.setUnit(request.getUnit().trim());
        item.setReorderLevel(request.getReorderLevel());
        item.setActive(request.isActive());

        InventoryItem saved = itemRepository.save(item);
        auditService.record(actor, "INVENTORY", "ITEM_UPDATED", saved.getId().toString(), "Updated item: " + saved.getName());
        return toItemResponse(saved);
    }

    @Transactional
    public void deleteItem(UUID id) {
        deleteItem(id, "Staff");
    }

    @Transactional
    public void deleteItem(UUID id, String actor) {
        if (!itemRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found: " + id);
        }
        itemRepository.deleteById(id);
        auditService.record(actor, "INVENTORY", "ITEM_DELETED", id.toString(), "Deleted inventory item");
    }

    // ==========================================
    // 4. Stock Receiving & Adjustment
    // ==========================================

    @Transactional(readOnly = true)
    public List<StockReceiptResponse> listStockReceipts() {
        return receiptRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(this::toReceiptResponse)
                .toList();
    }

    @Transactional
    public StockReceiptResponse receiveStock(ReceiveStockRequest request, String receivedBy) {
        InventoryItem item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found: " + request.getItemId()));

        Supplier supplier = null;
        if (request.getSupplierId() != null) {
            supplier = supplierRepository.findById(request.getSupplierId()).orElse(null);
        }

        String receiptNumber = "REC-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase(Locale.ROOT);

        StockReceipt receipt = StockReceipt.builder()
                .receiptNumber(receiptNumber)
                .supplier(supplier)
                .receivedDate(request.getReceivedDate())
                .notes(request.getNotes() != null ? request.getNotes().trim() : "")
                .receivedBy(receivedBy != null && !receivedBy.isBlank() ? receivedBy.trim() : "Staff")
                .build();

        StockReceiptItem receiptItem = StockReceiptItem.builder()
                .receipt(receipt)
                .item(item)
                .quantity(request.getQuantity())
                .unitCost(request.getUnitCost())
                .batchNo(request.getBatchNo().trim())
                .expiryDate(request.getExpiryDate())
                .build();

        receipt.getItems().add(receiptItem);
        StockReceipt savedReceipt = receiptRepository.save(receipt);

        int nextStock = item.getCurrentStock() + request.getQuantity();
        item.setCurrentStock(nextStock);
        itemRepository.save(item);

        InventoryLedger ledger = InventoryLedger.builder()
                .item(item)
                .action(LedgerAction.RECEIVE)
                .quantity(request.getQuantity())
                .balanceAfter(nextStock)
                .sourceId(savedReceipt.getId())
                .sourceType("stock-receipt")
                .notes(request.getNotes() != null ? request.getNotes().trim() : "")
                .createdBy(receipt.getReceivedBy())
                .build();

        ledgerRepository.save(ledger);

        auditService.record(
                receipt.getReceivedBy(),
                "INVENTORY",
                "STOCK_RECEIVED",
                item.getId().toString(),
                "Received " + request.getQuantity() + " " + item.getUnit() + " of " + item.getName() + " (Batch: " + request.getBatchNo() + ")"
        );

        log.info("Received stock for item '{}' (+{}), new balance: {}", item.getName(), request.getQuantity(), nextStock);
        return toReceiptResponse(savedReceipt);
    }

    @Transactional
    public InventoryItemResponse adjustStock(AdjustStockRequest request, String actor) {
        InventoryItem item = itemRepository.findById(request.getItemId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found: " + request.getItemId()));

        LedgerAction action = LedgerAction.fromValue(request.getAction());
        int qty = request.getQuantity();
        int current = item.getCurrentStock();
        int nextStock;
        int ledgerQty;
        String sourceType;

        if (action == LedgerAction.ISSUE) {
            if (current < qty) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient stock: requested " + qty + ", but only " + current + " available");
            }
            nextStock = current - qty;
            ledgerQty = -qty;
            sourceType = "stock-issue";
        } else if (action == LedgerAction.WASTE) {
            if (current < qty) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient stock: cannot waste " + qty + ", only " + current + " available");
            }
            nextStock = current - qty;
            ledgerQty = -qty;
            sourceType = "manual-adjustment";
        } else if (action == LedgerAction.RETURN) {
            nextStock = current + qty;
            ledgerQty = qty;
            sourceType = "stock-adjustment";
        } else { // ADJUST
            // For general adjustment, qty can be treated as positive increment
            nextStock = current + qty;
            ledgerQty = qty;
            sourceType = "stock-adjustment";
        }

        item.setCurrentStock(nextStock);
        itemRepository.save(item);

        InventoryLedger ledger = InventoryLedger.builder()
                .item(item)
                .action(action)
                .quantity(ledgerQty)
                .balanceAfter(nextStock)
                .sourceType(sourceType)
                .notes(request.getNotes() != null ? request.getNotes().trim() : "")
                .createdBy(actor != null && !actor.isBlank() ? actor.trim() : "Staff")
                .build();

        ledgerRepository.save(ledger);

        auditService.record(
                actor,
                "INVENTORY",
                "STOCK_ADJUSTED",
                item.getId().toString(),
                "Stock " + action.getValue() + " of " + qty + " " + item.getUnit() + " for " + item.getName() + " (Balance: " + nextStock + ")"
        );

        log.info("Adjusted stock for item '{}' ({}{}), new balance: {} by {}", item.getName(), ledgerQty > 0 ? "+" : "", ledgerQty, nextStock, actor);
        return toItemResponse(item);
    }

    @Transactional(readOnly = true)
    public List<InventoryLedgerResponse> listTransactions(int limit) {
        int boundedLimit = Math.min(100, Math.max(1, limit));
        Page<InventoryLedger> page = ledgerRepository.findAllByOrderByCreatedAtDesc(
                PageRequest.of(0, boundedLimit, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        return page.getContent().stream()
                .map(l -> InventoryLedgerResponse.builder()
                        .id(l.getId())
                        .itemId(l.getItem() != null ? l.getItem().getId() : null)
                        .itemName(l.getItem() != null ? l.getItem().getName() : "Item")
                        .itemSku(l.getItem() != null ? l.getItem().getSku() : "")
                        .action(l.getAction() != null ? l.getAction().getValue() : "")
                        .quantity(l.getQuantity())
                        .balanceAfter(l.getBalanceAfter())
                        .sourceType(l.getSourceType())
                        .notes(l.getNotes())
                        .createdBy(l.getCreatedBy())
                        .createdAt(l.getCreatedAt())
                        .build())
                .toList();
    }

    // ==========================================
    // 5. Reports
    // ==========================================

    @Transactional(readOnly = true)
    public List<StockAvailabilityReportResponse> getStockAvailabilityReport() {
        return itemRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(item -> StockAvailabilityReportResponse.builder()
                        .itemId(item.getId())
                        .itemName(item.getName())
                        .sku(item.getSku())
                        .categoryName(item.getCategory() != null ? item.getCategory().getName() : "Unassigned")
                        .unit(item.getUnit())
                        .currentStock(item.getCurrentStock())
                        .reorderLevel(item.getReorderLevel())
                        .isLowStock(item.getCurrentStock() <= item.getReorderLevel())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public ItemTraceReportResponse getItemTraceReport(UUID itemId) {
        InventoryItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found: " + itemId));

        List<InventoryLedger> ledgerEntries = ledgerRepository.findByItemIdOrderByCreatedAtDesc(itemId);

        Map<UUID, StockReceipt> receiptMap = new HashMap<>();
        for (InventoryLedger entry : ledgerEntries) {
            if (entry.getSourceId() != null && "stock-receipt".equalsIgnoreCase(entry.getSourceType())) {
                if (!receiptMap.containsKey(entry.getSourceId())) {
                    receiptRepository.findById(entry.getSourceId()).ifPresent(r -> receiptMap.put(entry.getSourceId(), r));
                }
            }
        }

        List<ItemTraceReportResponse.ItemTraceRowDto> rows = ledgerEntries.stream()
                .map(entry -> {
                    String sourceRef = entry.getSourceId() != null ? entry.getSourceId().toString() : "N/A";
                    if (entry.getSourceId() != null && receiptMap.containsKey(entry.getSourceId())) {
                        StockReceipt r = receiptMap.get(entry.getSourceId());
                        sourceRef = r.getReceiptNumber();
                    }
                    return ItemTraceReportResponse.ItemTraceRowDto.builder()
                            .date(entry.getCreatedAt())
                            .action(entry.getAction() != null ? entry.getAction().getValue() : "receive")
                            .quantity(entry.getQuantity())
                            .balanceAfter(entry.getBalanceAfter())
                            .sourceRef(sourceRef)
                            .notes(entry.getNotes() != null ? entry.getNotes() : "")
                            .actor(entry.getCreatedBy())
                            .build();
                })
                .toList();

        return ItemTraceReportResponse.builder()
                .itemId(item.getId())
                .itemName(item.getName())
                .rows(rows)
                .build();
    }

    // ==========================================
    // Response Mappers
    // ==========================================

    private InventoryCategoryResponse toCategoryResponse(InventoryCategory c) {
        return InventoryCategoryResponse.builder()
                .id(c.getId())
                .name(c.getName())
                .code(c.getCode())
                .description(c.getDescription())
                .isActive(c.isActive())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    private SupplierResponse toSupplierResponse(Supplier s) {
        return SupplierResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .code(s.getCode())
                .contactPerson(s.getContactPerson())
                .email(s.getEmail())
                .phone(s.getPhone())
                .address(s.getAddress())
                .isActive(s.isActive())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }

    public InventoryItemResponse toItemResponse(InventoryItem i) {
        return InventoryItemResponse.builder()
                .id(i.getId())
                .name(i.getName())
                .sku(i.getSku())
                .description(i.getDescription())
                .categoryId(i.getCategory() != null ? i.getCategory().getId() : null)
                .categoryName(i.getCategory() != null ? i.getCategory().getName() : null)
                .unit(i.getUnit())
                .reorderLevel(i.getReorderLevel())
                .currentStock(i.getCurrentStock())
                .supplierId(i.getDefaultSupplier() != null ? i.getDefaultSupplier().getId() : null)
                .supplierName(i.getDefaultSupplier() != null ? i.getDefaultSupplier().getName() : null)
                .isActive(i.isActive())
                .createdAt(i.getCreatedAt())
                .updatedAt(i.getUpdatedAt())
                .build();
    }

    public StockReceiptResponse toReceiptResponse(StockReceipt r) {
        StockReceiptItem firstItem = r.getItems().isEmpty() ? null : r.getItems().get(0);
        return StockReceiptResponse.builder()
                .id(r.getId())
                .receiptNumber(r.getReceiptNumber())
                .itemId(firstItem != null && firstItem.getItem() != null ? firstItem.getItem().getId() : null)
                .itemName(firstItem != null && firstItem.getItem() != null ? firstItem.getItem().getName() : "Item")
                .supplierId(r.getSupplier() != null ? r.getSupplier().getId() : null)
                .supplierName(r.getSupplier() != null ? r.getSupplier().getName() : "")
                .quantity(firstItem != null ? firstItem.getQuantity() : 0)
                .unitCost(firstItem != null ? firstItem.getUnitCost() : null)
                .batchNo(firstItem != null ? firstItem.getBatchNo() : "")
                .expiryDate(firstItem != null ? firstItem.getExpiryDate() : null)
                .receivedDate(r.getReceivedDate())
                .notes(r.getNotes())
                .receivedBy(r.getReceivedBy())
                .createdAt(r.getCreatedAt())
                .build();
    }
}

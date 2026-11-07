import { describe, it, expect, vi, beforeEach } from "vitest";
import { inventoryService } from "@/services/inventoryService";
import { apiClient } from "@/services/apiClient";

describe("inventoryService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists categories via GET /inventory/categories", async () => {
    const mockCategories = [
      { id: "c-1", name: "Surgical", code: "SURG", isActive: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    ];
    vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockCategories);

    const result = await inventoryService.listCategories();
    expect(apiClient.get).toHaveBeenCalledWith("/inventory/categories");
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("SURG");
  });

  it("creates category via POST /inventory/categories", async () => {
    const input = { name: "Dental", code: "DENT", description: "Dental supplies" };
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({ id: "c-2", ...input, isActive: true });

    const created = await inventoryService.createCategory(input);
    expect(apiClient.post).toHaveBeenCalledWith("/inventory/categories", {
      name: "Dental",
      code: "DENT",
      description: "Dental supplies",
      isActive: true,
    });
    expect(created.id).toBe("c-2");
  });

  it("receives stock via POST /inventory/stock-receipts", async () => {
    const receiveInput = {
      itemId: "item-1",
      supplierId: "sup-1",
      quantity: 100,
      unitCost: 5.5,
      batchNo: "BATCH-001",
      receivedDate: "2026-11-06",
      receivedBy: "Admin",
    };
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      id: "rec-1",
      receiptNumber: "REC-12345",
      ...receiveInput,
      createdAt: "2026-11-06T10:00:00Z",
    });

    const receipt = await inventoryService.receiveStock(receiveInput);
    expect(apiClient.post).toHaveBeenCalledWith("/inventory/stock-receipts", {
      itemId: "item-1",
      supplierId: "sup-1",
      quantity: 100,
      unitCost: 5.5,
      batchNo: "BATCH-001",
      expiryDate: null,
      receivedDate: "2026-11-06",
      notes: "",
    });
    expect(receipt.receiptNumber).toBe("REC-12345");
  });

  it("gets stock availability report via GET /inventory/reports/stock-availability", async () => {
    const mockReport = [
      { itemId: "item-1", itemName: "Gloves", sku: "GLV", categoryName: "General", unit: "box", currentStock: 2, reorderLevel: 10, isLowStock: true },
    ];
    vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockReport);

    const report = await inventoryService.getStockAvailabilityReport();
    expect(apiClient.get).toHaveBeenCalledWith("/inventory/reports/stock-availability");
    expect(report[0].isLowStock).toBe(true);
  });

  it("gets item trace report via GET /inventory/reports/trace/:itemId", async () => {
    const mockTrace = {
      itemId: "item-1",
      itemName: "Gloves",
      rows: [
        { date: "2026-11-06T10:00:00Z", action: "receive", quantity: 50, balanceAfter: 50, sourceRef: "REC-001", notes: "Initial", actor: "Staff" },
      ],
    };
    vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockTrace);

    const trace = await inventoryService.getItemTraceReport("item-1");
    expect(apiClient.get).toHaveBeenCalledWith("/inventory/reports/trace/item-1");
    expect(trace.rows).toHaveLength(1);
    expect(trace.rows[0].balanceAfter).toBe(50);
  });
});


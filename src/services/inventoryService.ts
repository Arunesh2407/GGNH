import { apiClient } from "@/services/apiClient";
import type {
  InventoryCategory,
  InventoryItem,
  InventoryLedgerEntry,
  ItemTraceRow,
  StockAvailabilityRow,
  StockReceipt,
  Supplier,
} from "@/types/inventory";

export const inventoryService = {
  isMasterConfigured: true,
  isStockConfigured: true,

  async listCategories(): Promise<InventoryCategory[]> {
    return apiClient.get<InventoryCategory[]>("/inventory/categories");
  },

  async createCategory(input: {
    name: string;
    code: string;
    description?: string;
    isActive?: boolean;
  }): Promise<InventoryCategory> {
    return apiClient.post<InventoryCategory>("/inventory/categories", {
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      description: input.description?.trim() || "",
      isActive: input.isActive ?? true,
    });
  },

  async updateCategory(
    id: string,
    input: {
      name: string;
      code: string;
      description?: string;
      isActive: boolean;
    },
  ): Promise<InventoryCategory> {
    return apiClient.put<InventoryCategory>(`/inventory/categories/${id}`, {
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      description: input.description?.trim() || "",
      isActive: input.isActive,
    });
  },

  async removeCategory(id: string): Promise<void> {
    await apiClient.delete(`/inventory/categories/${id}`);
  },

  async listSuppliers(): Promise<Supplier[]> {
    return apiClient.get<Supplier[]>("/inventory/suppliers");
  },

  async createSupplier(input: {
    name: string;
    code: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    isActive?: boolean;
  }): Promise<Supplier> {
    return apiClient.post<Supplier>("/inventory/suppliers", {
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      contactPerson: input.contactPerson?.trim() || "",
      email: input.email?.trim() || "",
      phone: input.phone?.trim() || "",
      address: input.address?.trim() || "",
      isActive: input.isActive ?? true,
    });
  },

  async updateSupplier(
    id: string,
    input: {
      name: string;
      code: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      isActive: boolean;
    },
  ): Promise<Supplier> {
    return apiClient.put<Supplier>(`/inventory/suppliers/${id}`, {
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      contactPerson: input.contactPerson?.trim() || "",
      email: input.email?.trim() || "",
      phone: input.phone?.trim() || "",
      address: input.address?.trim() || "",
      isActive: input.isActive,
    });
  },

  async removeSupplier(id: string): Promise<void> {
    await apiClient.delete(`/inventory/suppliers/${id}`);
  },

  async listItems(): Promise<InventoryItem[]> {
    return apiClient.get<InventoryItem[]>("/inventory/items");
  },

  async searchItems(options?: {
    search?: string;
    categoryId?: string;
    isLowStock?: boolean;
  }): Promise<InventoryItem[]> {
    const params: Record<string, string | boolean> = {};
    if (options?.search) params.search = options.search;
    if (options?.categoryId) params.categoryId = options.categoryId;
    if (options?.isLowStock !== undefined) params.isLowStock = options.isLowStock;

    return apiClient.get<InventoryItem[]>("/inventory/items", { params });
  },

  async createItem(input: {
    name: string;
    sku: string;
    description?: string;
    categoryId: string;
    categoryName?: string;
    unit: string;
    reorderLevel: number;
    supplierId?: string;
    supplierName?: string;
    isActive?: boolean;
  }): Promise<InventoryItem> {
    return apiClient.post<InventoryItem>("/inventory/items", {
      name: input.name.trim(),
      sku: input.sku.trim().toUpperCase(),
      description: input.description?.trim() || "",
      categoryId: input.categoryId,
      unit: input.unit.trim(),
      reorderLevel: Number(input.reorderLevel || 0),
      supplierId: input.supplierId || null,
      isActive: input.isActive ?? true,
    });
  },

  async updateItem(
    id: string,
    input: {
      name: string;
      sku: string;
      description?: string;
      categoryId: string;
      categoryName?: string;
      unit: string;
      reorderLevel: number;
      supplierId?: string;
      supplierName?: string;
      isActive: boolean;
    },
  ): Promise<InventoryItem> {
    return apiClient.put<InventoryItem>(`/inventory/items/${id}`, {
      name: input.name.trim(),
      sku: input.sku.trim().toUpperCase(),
      description: input.description?.trim() || "",
      categoryId: input.categoryId,
      unit: input.unit.trim(),
      reorderLevel: Number(input.reorderLevel || 0),
      supplierId: input.supplierId || null,
      isActive: input.isActive,
    });
  },

  async removeItem(id: string): Promise<void> {
    await apiClient.delete(`/inventory/items/${id}`);
  },

  async listStockReceipts(): Promise<StockReceipt[]> {
    return apiClient.get<StockReceipt[]>("/inventory/stock-receipts");
  },

  async receiveStock(input: {
    itemId: string;
    supplierId?: string;
    quantity: number;
    unitCost: number;
    batchNo: string;
    expiryDate?: string;
    receivedDate: string;
    notes?: string;
    receivedBy: string;
  }): Promise<StockReceipt> {
    return apiClient.post<StockReceipt>("/inventory/stock-receipts", {
      itemId: input.itemId,
      supplierId: input.supplierId || null,
      quantity: Number(input.quantity || 0),
      unitCost: Number(input.unitCost || 0),
      batchNo: input.batchNo.trim(),
      expiryDate: input.expiryDate || null,
      receivedDate: input.receivedDate,
      notes: input.notes?.trim() || "",
    });
  },

  async adjustStock(input: {
    itemId: string;
    action: "issue" | "waste" | "adjust" | "return";
    quantity: number;
    notes?: string;
  }): Promise<InventoryLedgerEntry> {
    return apiClient.post<InventoryLedgerEntry>("/inventory/adjust", {
      itemId: input.itemId,
      action: input.action,
      quantity: Number(input.quantity),
      notes: input.notes?.trim() || undefined,
    });
  },

  async listTransactions(limit: number = 50): Promise<InventoryLedgerEntry[]> {
    return apiClient.get<InventoryLedgerEntry[]>("/inventory/ledger", {
      params: { limit },
    });
  },

  async getStockAvailabilityReport(): Promise<StockAvailabilityRow[]> {
    return apiClient.get<StockAvailabilityRow[]>("/inventory/reports/stock-availability");
  },

  async getItemTraceReport(itemId: string): Promise<{
    itemId: string;
    itemName: string;
    rows: ItemTraceRow[];
  }> {
    return apiClient.get<{
      itemId: string;
      itemName: string;
      rows: ItemTraceRow[];
    }>(`/inventory/reports/trace/${itemId}`);
  },

  async getItemLookupOptions(): Promise<
    {
      id: string;
      label: string;
      category: string;
      unit: string;
      currentStock: number;
      supplierId?: string;
    }[]
  > {
    const items = await this.listItems();
    return items.map((item) => ({
      id: item.id,
      label: `${item.name} (${item.sku})`,
      category: item.categoryName || "Unassigned",
      unit: item.unit,
      currentStock: item.currentStock,
      supplierId: item.supplierId,
    }));
  },
};

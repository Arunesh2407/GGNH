import { ID, Query, type Models } from "appwrite";
import {
  appwriteConfig,
  appwriteDatabases,
  isInventoryMasterStorageConfigured,
  isStockReceivingStorageConfigured,
} from "@/lib/appwrite";
import type {
  InventoryCategory,
  InventoryItem,
  InventoryLedgerEntry,
  ItemTraceRow,
  StockAvailabilityRow,
  StockReceipt,
  Supplier,
} from "@/types/inventory";

type CategoryDocument = Models.Document & {
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
};

type SupplierDocument = Models.Document & {
  name: string;
  code: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
};

type ItemDocument = Models.Document & {
  name: string;
  sku: string;
  categoryId: string;
  categoryName?: string;
  unit: string;
  reorderLevel: number;
  currentStock: number;
  supplierId?: string;
  supplierName?: string;
  isActive: boolean;
};

type StockReceiptDocument = Models.Document & {
  itemId: string;
  itemName?: string;
  supplierId?: string;
  supplierName?: string;
  quantity: number;
  unitCost: number;
  batchNo: string;
  expiryDate?: string;
  receivedDate: string;
  notes?: string;
  receivedBy: string;
};

type LedgerDocument = Models.Document & {
  itemId: string;
  action: "receive";
  quantity: number;
  balanceAfter: number;
  sourceId: string;
  sourceType: "stock-receipt";
  notes?: string;
  createdBy: string;
};

const assertMasterConfigured = () => {
  if (!isInventoryMasterStorageConfigured) {
    throw new Error(
      "Inventory master collections are not configured. Add VITE_APPWRITE_INVENTORY_CATEGORY_COLLECTION_ID, VITE_APPWRITE_INVENTORY_ITEM_COLLECTION_ID, and VITE_APPWRITE_INVENTORY_SUPPLIER_COLLECTION_ID.",
    );
  }
};

const assertStockConfigured = () => {
  if (!isStockReceivingStorageConfigured) {
    throw new Error(
      "Stock receiving collections are not configured. Add VITE_APPWRITE_INVENTORY_STOCK_RECEIPT_COLLECTION_ID and VITE_APPWRITE_INVENTORY_STOCK_LEDGER_COLLECTION_ID.",
    );
  }
};

const toCategory = (document: CategoryDocument): InventoryCategory => ({
  id: document.$id,
  name: document.name,
  code: document.code,
  description: document.description,
  isActive: Boolean(document.isActive),
  createdAt: document.$createdAt,
  updatedAt: document.$updatedAt,
});

const toSupplier = (document: SupplierDocument): Supplier => ({
  id: document.$id,
  name: document.name,
  code: document.code,
  contactPerson: document.contactPerson,
  email: document.email,
  phone: document.phone,
  address: document.address,
  isActive: Boolean(document.isActive),
  createdAt: document.$createdAt,
  updatedAt: document.$updatedAt,
});

const toItem = (document: ItemDocument): InventoryItem => ({
  id: document.$id,
  name: document.name,
  sku: document.sku,
  categoryId: document.categoryId,
  categoryName: document.categoryName,
  unit: document.unit,
  reorderLevel: Number(document.reorderLevel ?? 0),
  currentStock: Number(document.currentStock ?? 0),
  supplierId: document.supplierId,
  supplierName: document.supplierName,
  isActive: Boolean(document.isActive),
  createdAt: document.$createdAt,
  updatedAt: document.$updatedAt,
});

const toReceipt = (document: StockReceiptDocument): StockReceipt => ({
  id: document.$id,
  itemId: document.itemId,
  itemName: document.itemName,
  supplierId: document.supplierId,
  supplierName: document.supplierName,
  quantity: Number(document.quantity ?? 0),
  unitCost: Number(document.unitCost ?? 0),
  batchNo: document.batchNo,
  expiryDate: document.expiryDate,
  receivedDate: document.receivedDate,
  notes: document.notes,
  receivedBy: document.receivedBy,
  createdAt: document.$createdAt,
});

const toLedger = (document: LedgerDocument): InventoryLedgerEntry => ({
  id: document.$id,
  itemId: document.itemId,
  action: "receive",
  quantity: Number(document.quantity ?? 0),
  balanceAfter: Number(document.balanceAfter ?? 0),
  sourceId: document.sourceId,
  sourceType: "stock-receipt",
  notes: document.notes,
  createdBy: document.createdBy,
  createdAt: document.$createdAt,
});

const getItemsIndexedById = async () => {
  const items = await inventoryService.listItems();
  return new Map(items.map((item) => [item.id, item]));
};

const getCategoriesIndexedById = async () => {
  const categories = await inventoryService.listCategories();
  return new Map(categories.map((category) => [category.id, category]));
};

export const inventoryService = {
  isMasterConfigured: isInventoryMasterStorageConfigured,
  isStockConfigured: isStockReceivingStorageConfigured,

  async listCategories() {
    assertMasterConfigured();

    const response = await appwriteDatabases.listDocuments<CategoryDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryCategoryCollectionId,
      [Query.orderAsc("name"), Query.limit(5000)],
    );

    return response.documents.map(toCategory);
  },

  async createCategory(input: {
    name: string;
    code: string;
    description?: string;
    isActive?: boolean;
  }) {
    assertMasterConfigured();

    const response = await appwriteDatabases.createDocument<CategoryDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryCategoryCollectionId,
      ID.unique(),
      {
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        description: input.description?.trim() || "",
        isActive: input.isActive ?? true,
      },
    );

    return toCategory(response);
  },

  async updateCategory(
    id: string,
    input: {
      name: string;
      code: string;
      description?: string;
      isActive: boolean;
    },
  ) {
    assertMasterConfigured();

    const response = await appwriteDatabases.updateDocument<CategoryDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryCategoryCollectionId,
      id,
      {
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        description: input.description?.trim() || "",
        isActive: input.isActive,
      },
    );

    return toCategory(response);
  },

  async removeCategory(id: string) {
    assertMasterConfigured();
    await appwriteDatabases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryCategoryCollectionId,
      id,
    );
  },

  async listSuppliers() {
    assertMasterConfigured();

    const response = await appwriteDatabases.listDocuments<SupplierDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventorySupplierCollectionId,
      [Query.orderAsc("name"), Query.limit(5000)],
    );

    return response.documents.map(toSupplier);
  },

  async createSupplier(input: {
    name: string;
    code: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    isActive?: boolean;
  }) {
    assertMasterConfigured();

    const response = await appwriteDatabases.createDocument<SupplierDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventorySupplierCollectionId,
      ID.unique(),
      {
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        contactPerson: input.contactPerson?.trim() || "",
        email: input.email?.trim() || "",
        phone: input.phone?.trim() || "",
        address: input.address?.trim() || "",
        isActive: input.isActive ?? true,
      },
    );

    return toSupplier(response);
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
  ) {
    assertMasterConfigured();

    const response = await appwriteDatabases.updateDocument<SupplierDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventorySupplierCollectionId,
      id,
      {
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        contactPerson: input.contactPerson?.trim() || "",
        email: input.email?.trim() || "",
        phone: input.phone?.trim() || "",
        address: input.address?.trim() || "",
        isActive: input.isActive,
      },
    );

    return toSupplier(response);
  },

  async removeSupplier(id: string) {
    assertMasterConfigured();
    await appwriteDatabases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.inventorySupplierCollectionId,
      id,
    );
  },

  async listItems() {
    assertMasterConfigured();

    const response = await appwriteDatabases.listDocuments<ItemDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryItemCollectionId,
      [Query.orderAsc("name"), Query.limit(5000)],
    );

    return response.documents.map(toItem);
  },

  async createItem(input: {
    name: string;
    sku: string;
    categoryId: string;
    categoryName?: string;
    unit: string;
    reorderLevel: number;
    supplierId?: string;
    supplierName?: string;
    isActive?: boolean;
  }) {
    assertMasterConfigured();

    const response = await appwriteDatabases.createDocument<ItemDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryItemCollectionId,
      ID.unique(),
      {
        name: input.name.trim(),
        sku: input.sku.trim().toUpperCase(),
        categoryId: input.categoryId,
        categoryName: input.categoryName || "",
        unit: input.unit.trim(),
        reorderLevel: Number(input.reorderLevel || 0),
        currentStock: 0,
        supplierId: input.supplierId || "",
        supplierName: input.supplierName || "",
        isActive: input.isActive ?? true,
      },
    );

    return toItem(response);
  },

  async updateItem(
    id: string,
    input: {
      name: string;
      sku: string;
      categoryId: string;
      categoryName?: string;
      unit: string;
      reorderLevel: number;
      supplierId?: string;
      supplierName?: string;
      isActive: boolean;
    },
  ) {
    assertMasterConfigured();

    const existing = await appwriteDatabases.getDocument<ItemDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryItemCollectionId,
      id,
    );

    const response = await appwriteDatabases.updateDocument<ItemDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryItemCollectionId,
      id,
      {
        name: input.name.trim(),
        sku: input.sku.trim().toUpperCase(),
        categoryId: input.categoryId,
        categoryName: input.categoryName || "",
        unit: input.unit.trim(),
        reorderLevel: Number(input.reorderLevel || 0),
        currentStock: Number(existing.currentStock || 0),
        supplierId: input.supplierId || "",
        supplierName: input.supplierName || "",
        isActive: input.isActive,
      },
    );

    return toItem(response);
  },

  async removeItem(id: string) {
    assertMasterConfigured();
    await appwriteDatabases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryItemCollectionId,
      id,
    );
  },

  async listStockReceipts() {
    assertMasterConfigured();
    assertStockConfigured();

    const response =
      await appwriteDatabases.listDocuments<StockReceiptDocument>(
        appwriteConfig.databaseId,
        appwriteConfig.inventoryStockReceiptCollectionId,
        [Query.orderDesc("$createdAt"), Query.limit(5000)],
      );

    return response.documents.map(toReceipt);
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
  }) {
    assertMasterConfigured();
    assertStockConfigured();

    const item = await appwriteDatabases.getDocument<ItemDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryItemCollectionId,
      input.itemId,
    );

    const supplier = input.supplierId
      ? await appwriteDatabases.getDocument<SupplierDocument>(
          appwriteConfig.databaseId,
          appwriteConfig.inventorySupplierCollectionId,
          input.supplierId,
        )
      : null;

    const receipt =
      await appwriteDatabases.createDocument<StockReceiptDocument>(
        appwriteConfig.databaseId,
        appwriteConfig.inventoryStockReceiptCollectionId,
        ID.unique(),
        {
          itemId: input.itemId,
          itemName: item.name,
          supplierId: input.supplierId || "",
          supplierName: supplier?.name || "",
          quantity: Number(input.quantity || 0),
          unitCost: Number(input.unitCost || 0),
          batchNo: input.batchNo.trim(),
          expiryDate: input.expiryDate || "",
          receivedDate: input.receivedDate,
          notes: input.notes?.trim() || "",
          receivedBy: input.receivedBy,
        },
      );

    const nextStock =
      Number(item.currentStock || 0) + Number(input.quantity || 0);

    await appwriteDatabases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryItemCollectionId,
      item.$id,
      {
        currentStock: nextStock,
      },
    );

    await appwriteDatabases.createDocument<LedgerDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.inventoryStockLedgerCollectionId,
      ID.unique(),
      {
        itemId: item.$id,
        action: "receive",
        quantity: Number(input.quantity || 0),
        balanceAfter: nextStock,
        sourceId: receipt.$id,
        sourceType: "stock-receipt",
        notes: input.notes?.trim() || "",
        createdBy: input.receivedBy,
      },
    );

    return toReceipt(receipt);
  },

  async getStockAvailabilityReport() {
    assertMasterConfigured();

    const [items, categories] = await Promise.all([
      inventoryService.listItems(),
      inventoryService.listCategories(),
    ]);

    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );

    const rows: StockAvailabilityRow[] = items.map((item) => {
      const categoryName =
        item.categoryName ||
        categoriesById.get(item.categoryId)?.name ||
        "Unknown";

      return {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        categoryName,
        unit: item.unit,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
        isLowStock: item.currentStock <= item.reorderLevel,
      };
    });

    return rows.sort((first, second) =>
      first.itemName.localeCompare(second.itemName),
    );
  },

  async getItemTraceReport(itemId: string) {
    assertMasterConfigured();
    assertStockConfigured();

    const [itemsById, receipts, ledger] = await Promise.all([
      getItemsIndexedById(),
      appwriteDatabases.listDocuments<StockReceiptDocument>(
        appwriteConfig.databaseId,
        appwriteConfig.inventoryStockReceiptCollectionId,
        [
          Query.equal("itemId", itemId),
          Query.orderDesc("$createdAt"),
          Query.limit(5000),
        ],
      ),
      appwriteDatabases.listDocuments<LedgerDocument>(
        appwriteConfig.databaseId,
        appwriteConfig.inventoryStockLedgerCollectionId,
        [
          Query.equal("itemId", itemId),
          Query.orderDesc("$createdAt"),
          Query.limit(5000),
        ],
      ),
    ]);

    const receiptById = new Map(
      receipts.documents.map((entry) => [entry.$id, toReceipt(entry)]),
    );
    const itemName = itemsById.get(itemId)?.name ?? "Unknown Item";

    const rows: ItemTraceRow[] = ledger.documents.map((entry) => {
      const mappedLedger = toLedger(entry);
      const sourceReceipt = receiptById.get(mappedLedger.sourceId);

      return {
        date: mappedLedger.createdAt,
        action: mappedLedger.action,
        quantity: mappedLedger.quantity,
        balanceAfter: mappedLedger.balanceAfter,
        sourceRef: sourceReceipt?.batchNo ?? mappedLedger.sourceId,
        notes: mappedLedger.notes || "",
        actor: mappedLedger.createdBy,
      };
    });

    return {
      itemId,
      itemName,
      rows,
    };
  },

  async getItemLookupOptions() {
    const [items, categories] = await Promise.all([
      inventoryService.listItems(),
      getCategoriesIndexedById(),
    ]);

    return items.map((item) => ({
      id: item.id,
      label: `${item.name} (${item.sku})`,
      category: categories.get(item.categoryId)?.name || "Unknown",
      unit: item.unit,
      currentStock: item.currentStock,
      supplierId: item.supplierId,
    }));
  },
};

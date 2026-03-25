export type InventoryCategory = {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  code: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItem = {
  id: string;
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
  createdAt: string;
  updatedAt: string;
};

export type StockReceipt = {
  id: string;
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
  createdAt: string;
};

export type InventoryLedgerEntry = {
  id: string;
  itemId: string;
  action: "receive";
  quantity: number;
  balanceAfter: number;
  sourceId: string;
  sourceType: "stock-receipt";
  notes?: string;
  createdBy: string;
  createdAt: string;
};

export type StockAvailabilityRow = {
  itemId: string;
  itemName: string;
  sku: string;
  categoryName: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  isLowStock: boolean;
};

export type ItemTraceRow = {
  date: string;
  action: string;
  quantity: number;
  balanceAfter: number;
  sourceRef: string;
  notes: string;
  actor: string;
};

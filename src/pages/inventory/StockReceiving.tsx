import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { inventoryService } from "@/services/inventoryService";
import type { InventoryItem, StockReceipt, Supplier } from "@/types/inventory";

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const initialForm = {
  itemId: "",
  supplierId: "",
  quantity: 1,
  unitCost: 0,
  batchNo: "",
  expiryDate: "",
  receivedDate: todayIsoDate(),
  notes: "",
};

const StockReceiving = () => {
  const { userEmail, canManageInventory } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    if (
      !inventoryService.isMasterConfigured ||
      !inventoryService.isStockConfigured
    ) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [loadedItems, loadedSuppliers, loadedReceipts] = await Promise.all([
        inventoryService.listItems(),
        inventoryService.listSuppliers(),
        inventoryService.listStockReceipts(),
      ]);

      setItems(loadedItems);
      setSuppliers(loadedSuppliers);
      setReceipts(loadedReceipts);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to load stock receiving data.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageInventory) {
      toast.error("Your account has read-only access for inventory.");
      return;
    }

    if (!form.itemId || !form.batchNo.trim() || form.quantity <= 0) {
      toast.error("Item, quantity, and batch number are required.");
      return;
    }

    setIsSaving(true);

    try {
      await inventoryService.receiveStock({
        itemId: form.itemId,
        supplierId: form.supplierId || undefined,
        quantity: Number(form.quantity),
        unitCost: Number(form.unitCost),
        batchNo: form.batchNo,
        expiryDate: form.expiryDate || undefined,
        receivedDate: form.receivedDate,
        notes: form.notes,
        receivedBy: userEmail || "system",
      });

      setForm(initialForm);
      toast.success("Stock received successfully.");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save stock receipt.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Stock Receiving</CardTitle>
            <CardDescription>
              Record inward stock with batch, cost, expiry, and receipt date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.itemId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    itemId: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              >
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.sku})
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.supplierId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    supplierId: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              >
                <option value="">Supplier (optional)</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                value={String(form.quantity)}
                placeholder="Quantity"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    quantity: Number(event.target.value || 0),
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={String(form.unitCost)}
                placeholder="Unit cost"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    unitCost: Number(event.target.value || 0),
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                value={form.batchNo}
                placeholder="Batch no"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    batchNo: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                type="date"
                value={form.receivedDate}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    receivedDate: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    expiryDate: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                value={form.notes}
                placeholder="Notes"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    notes: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Button type="submit" disabled={!canManageInventory || isSaving}>
                <Plus className="w-4 h-4" />
                Receive Stock
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Recent Receipts</CardTitle>
              <CardDescription>
                Latest stock inward transactions.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadData()}
              disabled={isLoading || isSaving}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading receipts...
              </div>
            ) : (
              <div className="rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>{receipt.receivedDate}</TableCell>
                        <TableCell>
                          {receipt.itemName || receipt.itemId}
                        </TableCell>
                        <TableCell>{receipt.batchNo}</TableCell>
                        <TableCell>{receipt.quantity}</TableCell>
                        <TableCell>{receipt.supplierName || "-"}</TableCell>
                        <TableCell>{receipt.expiryDate || "-"}</TableCell>
                        <TableCell>{receipt.receivedBy}</TableCell>
                      </TableRow>
                    ))}
                    {receipts.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground"
                        >
                          No stock receipts found.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default StockReceiving;

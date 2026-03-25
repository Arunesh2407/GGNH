import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type {
  InventoryCategory,
  InventoryItem,
  Supplier,
} from "@/types/inventory";

const initialForm = {
  name: "",
  sku: "",
  categoryId: "",
  unit: "",
  reorderLevel: 0,
  supplierId: "",
  isActive: true,
};

const ItemMaster = () => {
  const { canManageInventory } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  );

  const loadData = async () => {
    if (!inventoryService.isMasterConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [loadedItems, loadedCategories, loadedSuppliers] =
        await Promise.all([
          inventoryService.listItems(),
          inventoryService.listCategories(),
          inventoryService.listSuppliers(),
        ]);

      setItems(loadedItems);
      setCategories(loadedCategories);
      setSuppliers(loadedSuppliers);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load item master.",
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

    if (
      !form.name.trim() ||
      !form.sku.trim() ||
      !form.categoryId ||
      !form.unit.trim()
    ) {
      toast.error("Name, SKU, category, and unit are required.");
      return;
    }

    setIsSaving(true);

    try {
      const categoryName = categoryById.get(form.categoryId)?.name;
      const supplierName = form.supplierId
        ? supplierById.get(form.supplierId)?.name
        : undefined;

      if (editingId) {
        await inventoryService.updateItem(editingId, {
          ...form,
          categoryName,
          supplierName,
        });
        toast.success("Item updated.");
      } else {
        await inventoryService.createItem({
          ...form,
          categoryName,
          supplierName,
        });
        toast.success("Item created.");
      }

      setForm(initialForm);
      setEditingId(null);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save item.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      sku: item.sku,
      categoryId: item.categoryId,
      unit: item.unit,
      reorderLevel: item.reorderLevel,
      supplierId: item.supplierId || "",
      isActive: item.isActive,
    });
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!canManageInventory) {
      toast.error("Your account has read-only access for inventory.");
      return;
    }

    if (!window.confirm(`Delete item ${item.name}?`)) {
      return;
    }

    setIsSaving(true);

    try {
      await inventoryService.removeItem(item.id);
      toast.success("Item removed.");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove item.",
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
            <CardTitle>Item Master</CardTitle>
            <CardDescription>
              Define stockable items with category, unit, reorder level, and
              preferred supplier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-2">
              <Input
                value={form.name}
                placeholder="Item name"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                value={form.sku}
                placeholder="SKU"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    sku: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.categoryId}
                disabled={!canManageInventory}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    categoryId: event.target.value,
                  }))
                }
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Input
                value={form.unit}
                placeholder="Unit (pcs, box, bottle)"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    unit: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                type="number"
                min={0}
                value={String(form.reorderLevel)}
                placeholder="Reorder level"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    reorderLevel: Number(event.target.value || 0),
                  }))
                }
                disabled={!canManageInventory}
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.supplierId}
                disabled={!canManageInventory}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    supplierId: event.target.value,
                  }))
                }
              >
                <option value="">Preferred supplier (optional)</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <label className="h-10 px-3 rounded-md border border-input bg-background flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  disabled={!canManageInventory}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Active
              </label>
              <Button type="submit" disabled={!canManageInventory || isSaving}>
                <Plus className="w-4 h-4" />
                {editingId ? "Update" : "Add"} Item
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                Current item master with stock position.
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
                Loading items...
              </div>
            ) : (
              <div className="rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Reorder</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>{item.categoryName || "-"}</TableCell>
                        <TableCell>
                          <span
                            className={
                              item.currentStock <= item.reorderLevel
                                ? "text-red-700 font-semibold"
                                : ""
                            }
                          >
                            {item.currentStock} {item.unit}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.reorderLevel} {item.unit}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.isActive ? "secondary" : "outline"}
                          >
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canManageInventory}
                              onClick={() => handleEdit(item)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={!canManageInventory}
                              onClick={() => void handleDelete(item)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground"
                        >
                          No items found.
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

export default ItemMaster;

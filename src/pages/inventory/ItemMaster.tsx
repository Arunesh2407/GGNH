import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  description: "",
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

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Stock Adjustment Dialog state
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustAction, setAdjustAction] = useState<"issue" | "waste" | "adjust" | "return">("issue");
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Delete item state
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);

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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !searchTerm.trim() ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory =
        categoryFilter === "ALL" || item.categoryId === categoryFilter;

      const matchesLowStock = !lowStockOnly || item.currentStock <= item.reorderLevel;

      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [items, searchTerm, categoryFilter, lowStockOnly]);

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
          description: form.description.trim() || undefined,
          categoryName,
          supplierName,
        });
        toast.success("Item updated.");
      } else {
        await inventoryService.createItem({
          ...form,
          description: form.description.trim() || undefined,
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
      description: item.description || "",
      categoryId: item.categoryId,
      unit: item.unit,
      reorderLevel: item.reorderLevel,
      supplierId: item.supplierId || "",
      isActive: item.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    if (!canManageInventory) {
      toast.error("Your account has read-only access for inventory.");
      return;
    }

    setIsSaving(true);
    try {
      await inventoryService.removeItem(deletingItem.id);
      toast.success(`Removed item ${deletingItem.name}`);
      setDeletingItem(null);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove item.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;

    if (adjustQty <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }

    if ((adjustAction === "issue" || adjustAction === "waste") && adjustQty > adjustItem.currentStock) {
      toast.error(`Cannot ${adjustAction} ${adjustQty} units. Current stock is only ${adjustItem.currentStock} ${adjustItem.unit}`);
      return;
    }

    setIsAdjusting(true);
    try {
      await inventoryService.adjustStock({
        itemId: adjustItem.id,
        action: adjustAction,
        quantity: adjustQty,
        notes: adjustNotes.trim() || undefined,
      });
      toast.success(`Stock adjusted successfully for ${adjustItem.name}`);
      setAdjustItem(null);
      setAdjustNotes("");
      setAdjustQty(1);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to adjust stock";
      toast.error(msg);
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Create / Edit Item Form */}
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Item" : "Item Master"}</CardTitle>
            <CardDescription>
              Define stockable items with category, unit, reorder level, and
              preferred supplier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid md:grid-cols-4 gap-2">
                <Input
                  value={form.name}
                  placeholder="Item name *"
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
                  placeholder="SKU *"
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
                  <option value="">Select category *</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <Input
                  value={form.unit}
                  placeholder="Unit (pcs, box, bottle) *"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      unit: event.target.value,
                    }))
                  }
                  disabled={!canManageInventory}
                />
              </div>

              <div className="grid md:grid-cols-4 gap-2">
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
                <Input
                  value={form.description}
                  placeholder="Description / specification (optional)"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  disabled={!canManageInventory}
                />
                <div className="flex gap-2">
                  <label className="h-10 px-3 rounded-md border border-input bg-background flex items-center gap-2 text-sm shrink-0">
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
                  <Button type="submit" className="flex-1" disabled={!canManageInventory || isSaving}>
                    <Plus className="w-4 h-4" />
                    {editingId ? "Update" : "Add"} Item
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setForm(initialForm);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Filter and Table Card */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Items Directory</CardTitle>
              <CardDescription>
                Current item master with real-time stock positions and stock adjustment actions.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadData()}
              disabled={isLoading || isSaving}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search item name, SKU, description..."
                  className="pl-9 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-56">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="h-10 px-3 rounded-md border border-input bg-background flex items-center gap-2 text-sm cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                />
                <span className="text-destructive font-medium">Low Stock Only</span>
              </label>
            </div>

            {isLoading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Loading items...
              </div>
            ) : (
              <div className="rounded-md border bg-background overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item / Details</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Stock Level</TableHead>
                      <TableHead>Reorder Threshold</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const isLowStock = item.currentStock <= item.reorderLevel;

                      return (
                        <TableRow key={item.id} className="hover:bg-muted/40">
                          <TableCell className="font-medium">
                            <div className="text-foreground">{item.name}</div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {item.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {item.sku}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.categoryName || "-"}</TableCell>
                          <TableCell>
                            <span
                              className={
                                isLowStock
                                  ? "text-destructive font-semibold flex items-center gap-1"
                                  : "font-medium"
                              }
                            >
                              {isLowStock && <AlertTriangle className="w-3.5 h-3.5" />}
                              {item.currentStock} {item.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.reorderLevel} {item.unit}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={item.isActive ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {item.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canManageInventory && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                                  title="Adjust Stock"
                                  onClick={() => {
                                    setAdjustItem(item);
                                    setAdjustAction("issue");
                                    setAdjustQty(1);
                                    setAdjustNotes("");
                                  }}
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5" />
                                  Adjust
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                disabled={!canManageInventory}
                                onClick={() => handleEdit(item)}
                                title="Edit Item"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 w-8 p-0"
                                disabled={!canManageInventory}
                                onClick={() => setDeletingItem(item)}
                                title="Delete Item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          No items found matching criteria.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock Adjustment Dialog */}
        <Dialog open={!!adjustItem} onOpenChange={(open) => !open && setAdjustItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Adjust Stock: {adjustItem?.name}
              </DialogTitle>
              <DialogDescription>
                Record stock movement (issue, waste, adjust count, or return). Balance will update immediately with full audit ledger tracking.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAdjustStock} className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <strong className="text-foreground">
                    {adjustItem?.currentStock} {adjustItem?.unit}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SKU:</span>
                  <span className="font-mono text-foreground">{adjustItem?.sku}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjust-action">Movement Type *</Label>
                <Select
                  value={adjustAction}
                  onValueChange={(val: "issue" | "waste" | "adjust" | "return") => setAdjustAction(val)}
                >
                  <SelectTrigger id="adjust-action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="issue">Issue (Dispense to Ward / Patient)</SelectItem>
                    <SelectItem value="waste">Waste (Expired / Damaged Disposal)</SelectItem>
                    <SelectItem value="adjust">Adjustment (Audit Correction)</SelectItem>
                    <SelectItem value="return">Return (Unused Item Return)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjust-qty">
                  Quantity ({adjustItem?.unit}) *
                </Label>
                <Input
                  id="adjust-qty"
                  type="number"
                  min={1}
                  max={
                    adjustAction === "issue" || adjustAction === "waste"
                      ? adjustItem?.currentStock || 1
                      : 100000
                  }
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value || 0))}
                />
                {(adjustAction === "issue" || adjustAction === "waste") && adjustItem && (
                  <p className="text-[11px] text-muted-foreground">
                    Max allowable: {adjustItem.currentStock} {adjustItem.unit}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjust-notes">Reason / Notes</Label>
                <Input
                  id="adjust-notes"
                  placeholder="e.g. Dispensed to ICU, Damaged in transit, etc."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustItem(null)}
                  disabled={isAdjusting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isAdjusting}>
                  {isAdjusting ? "Recording..." : "Apply Adjustment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Alert */}
        <AlertDialog
          open={!!deletingItem}
          onOpenChange={(open) => !open && setDeletingItem(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete Inventory Item
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deletingItem?.name}</strong> ({deletingItem?.sku})?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleDelete()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
};

export default ItemMaster;

import { FormEvent, useEffect, useState } from "react";
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
import type { Supplier } from "@/types/inventory";

const initialForm = {
  name: "",
  code: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  isActive: true,
};

const Suppliers = () => {
  const { canManageInventory } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSuppliers = async () => {
    if (!inventoryService.isMasterConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await inventoryService.listSuppliers();
      setSuppliers(response);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load suppliers.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageInventory) {
      toast.error("Your account has read-only access for inventory.");
      return;
    }

    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Supplier name and code are required.");
      return;
    }

    setIsSaving(true);

    try {
      if (editingId) {
        await inventoryService.updateSupplier(editingId, form);
        toast.success("Supplier updated.");
      } else {
        await inventoryService.createSupplier(form);
        toast.success("Supplier created.");
      }

      setForm(initialForm);
      setEditingId(null);
      await loadSuppliers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save supplier.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      code: supplier.code,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      isActive: supplier.isActive,
    });
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!canManageInventory) {
      toast.error("Your account has read-only access for inventory.");
      return;
    }

    if (!window.confirm(`Delete supplier ${supplier.name}?`)) {
      return;
    }

    setIsSaving(true);

    try {
      await inventoryService.removeSupplier(supplier.id);
      toast.success("Supplier removed.");
      await loadSuppliers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove supplier.",
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
            <CardTitle>Suppliers</CardTitle>
            <CardDescription>
              Maintain supplier master and contact information for procurement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-2">
              <Input
                value={form.name}
                placeholder="Supplier name"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                value={form.code}
                placeholder="Code"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    code: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                value={form.contactPerson}
                placeholder="Contact person"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    contactPerson: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                value={form.email}
                placeholder="Email"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    email: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                value={form.phone}
                placeholder="Phone"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
              <Input
                value={form.address}
                placeholder="Address"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    address: event.target.value,
                  }))
                }
                disabled={!canManageInventory}
              />
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
              <Button type="submit" disabled={isSaving || !canManageInventory}>
                <Plus className="w-4 h-4" />
                {editingId ? "Update" : "Add"} Supplier
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Supplier List</CardTitle>
              <CardDescription>
                Used in item master setup and stock receiving.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadSuppliers()}
              disabled={isLoading || isSaving}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading suppliers...
              </div>
            ) : (
              <div className="rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">
                          {supplier.name}
                        </TableCell>
                        <TableCell>{supplier.code}</TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            <div>{supplier.contactPerson || "-"}</div>
                            <div>{supplier.phone || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              supplier.isActive ? "secondary" : "outline"
                            }
                          >
                            {supplier.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(supplier)}
                              disabled={!canManageInventory}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void handleDelete(supplier)}
                              disabled={!canManageInventory}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {suppliers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          No suppliers found.
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

export default Suppliers;

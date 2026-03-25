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
import type { InventoryCategory } from "@/types/inventory";

const initialForm = {
  name: "",
  code: "",
  description: "",
  isActive: true,
};

const ItemCategories = () => {
  const { canManageInventory } = useAuth();
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = async () => {
    if (!inventoryService.isMasterConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await inventoryService.listCategories();
      setCategories(response);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load categories.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageInventory) {
      toast.error("Your account has read-only access for inventory.");
      return;
    }

    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required.");
      return;
    }

    setIsSaving(true);

    try {
      if (editingId) {
        await inventoryService.updateCategory(editingId, form);
        toast.success("Category updated.");
      } else {
        await inventoryService.createCategory(form);
        toast.success("Category created.");
      }

      setForm(initialForm);
      setEditingId(null);
      await loadCategories();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save category.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (category: InventoryCategory) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      code: category.code,
      description: category.description || "",
      isActive: category.isActive,
    });
  };

  const handleDelete = async (category: InventoryCategory) => {
    if (!canManageInventory) {
      toast.error("Your account has read-only access for inventory.");
      return;
    }

    if (!window.confirm(`Delete category ${category.name}?`)) {
      return;
    }

    setIsSaving(true);

    try {
      await inventoryService.removeCategory(category.id);
      toast.success("Category removed.");
      await loadCategories();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove category.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!inventoryService.isMasterConfigured) {
    return (
      <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Item Categories</CardTitle>
              <CardDescription>
                Configure inventory collections to enable category management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Add inventory collection IDs in your environment for categories,
                items, and suppliers.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Item Categories</CardTitle>
            <CardDescription>
              Create category master records used by item registration and
              reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-2">
              <Input
                value={form.name}
                placeholder="Category name"
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
                value={form.description}
                placeholder="Description (optional)"
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
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
              <div className="md:col-span-4 flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={isSaving || !canManageInventory}
                >
                  <Plus className="w-4 h-4" />
                  {editingId ? "Update" : "Add"} Category
                </Button>
                {editingId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(initialForm);
                    }}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Categories</CardTitle>
              <CardDescription>
                Active and inactive category records.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadCategories()}
              disabled={isLoading || isSaving}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading categories...
              </div>
            ) : (
              <div className="rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">
                          {category.name}
                        </TableCell>
                        <TableCell>{category.code}</TableCell>
                        <TableCell>{category.description || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              category.isActive ? "secondary" : "outline"
                            }
                          >
                            {category.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canManageInventory}
                              onClick={() => handleEdit(category)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={!canManageInventory}
                              onClick={() => void handleDelete(category)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {categories.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          No categories found.
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

export default ItemCategories;

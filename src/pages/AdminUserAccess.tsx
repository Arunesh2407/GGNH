import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Shield, Trash2 } from "lucide-react";
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
import {
  accessControlService,
  type UserAccessRecord,
  type UserAccessRole,
} from "@/services/accessControlService";

const roleBadgeVariant: Record<
  UserAccessRole,
  "default" | "secondary" | "outline"
> = {
  owner: "default",
  editor: "secondary",
  viewer: "outline",
};

const defaultFormState = {
  email: "",
  role: "viewer" as UserAccessRole,
  isActive: true,
};

const AdminUserAccess = () => {
  const { userEmail } = useAuth();
  const [records, setRecords] = useState<UserAccessRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(defaultFormState);

  const loadUsers = useCallback(async () => {
    if (!accessControlService.isConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const users = await accessControlService.listUsers();
      setRecords(users);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load user access records.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleCreateOrUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = form.email.trim().toLowerCase();

    if (!email) {
      toast.error("Email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setIsSaving(true);

    try {
      await accessControlService.upsertUser({
        email,
        role: form.role,
        isActive: form.isActive,
        updatedBy: userEmail || "system",
      });
      toast.success("User access saved.");
      setForm(defaultFormState);
      await loadUsers();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save user access.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickUpdate = async (
    record: UserAccessRecord,
    updates: Partial<Pick<UserAccessRecord, "role" | "isActive">>,
  ) => {
    const nextRole = updates.role ?? record.role;
    const nextActive = updates.isActive ?? record.isActive;

    if (record.email === userEmail.toLowerCase() && !nextActive) {
      toast.error("You cannot deactivate your own account.");
      return;
    }

    if (record.email === userEmail.toLowerCase() && nextRole !== "owner") {
      toast.error("You cannot demote your own owner account.");
      return;
    }

    setIsSaving(true);

    try {
      await accessControlService.upsertUser({
        email: record.email,
        role: nextRole,
        isActive: nextActive,
        updatedBy: userEmail || "system",
      });
      toast.success("Permissions updated.");
      await loadUsers();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update user permissions.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (record: UserAccessRecord) => {
    if (record.email === userEmail.toLowerCase()) {
      toast.error("You cannot remove your own owner record.");
      return;
    }

    if (!window.confirm(`Remove access record for ${record.email}?`)) {
      return;
    }

    setIsSaving(true);

    try {
      await accessControlService.removeUserById(record.id);
      toast.success("User access removed.");
      await loadUsers();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to remove user access.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!accessControlService.isConfigured) {
    return (
      <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>User Access Control</CardTitle>
              <CardDescription>
                Configure Appwrite user access collection to enable permission
                management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Add VITE_APPWRITE_USER_ACCESS_COLLECTION_ID in your environment,
                then create a collection with fields: email (string), role
                (string), isActive (boolean), updatedBy (string), updatedAt
                (string).
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
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-5 h-5" />
              User Access Control
            </CardTitle>
            <CardDescription>
              Add login users, assign role permissions, and enable or disable
              account access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateOrUpdate}
              className="grid md:grid-cols-4 gap-2"
            >
              <Input
                placeholder="user@email.com"
                value={form.email}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    email: event.target.value,
                  }))
                }
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.role}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    role: event.target.value as UserAccessRole,
                  }))
                }
              >
                <option value="owner">Owner</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <label className="h-10 px-3 rounded-md border border-input bg-background flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Active access
              </label>
              <Button type="submit" disabled={isSaving}>
                <Plus className="w-4 h-4" />
                Save User
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Managed Users</CardTitle>
              <CardDescription>
                Owner can change role, disable access, or remove access records.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadUsers()}
              disabled={isLoading || isSaving}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading user access records...
              </div>
            ) : (
              <div className="overflow-auto rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Updated By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
                      const isSelf = record.email === userEmail.toLowerCase();

                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant={roleBadgeVariant[record.role]}>
                              {record.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.isActive ? "secondary" : "outline"
                              }
                            >
                              {record.isActive ? "Active" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.updatedBy || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                value={record.role}
                                disabled={isSaving}
                                onChange={(event) =>
                                  void handleQuickUpdate(record, {
                                    role: event.target.value as UserAccessRole,
                                  })
                                }
                              >
                                <option value="owner">Owner</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  isSaving || (isSelf && record.isActive)
                                }
                                onClick={() =>
                                  void handleQuickUpdate(record, {
                                    isActive: !record.isActive,
                                  })
                                }
                              >
                                {record.isActive ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isSaving || isSelf}
                                onClick={() => void handleDelete(record)}
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {records.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          No user access records found. Add one above.
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

export default AdminUserAccess;

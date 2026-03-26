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
  getDefaultPermissionsForRole,
  type UserPermissions,
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
  "store-manager": "secondary",
  "department-head": "outline",
  auditor: "outline",
};

const defaultFormState = {
  email: "",
  role: "viewer" as Exclude<UserAccessRole, "owner">,
  permissions: getDefaultPermissionsForRole("viewer"),
  isActive: true,
};

const AdminUserAccess = () => {
  const { userEmail, canEditUsers } = useAuth();
  const [records, setRecords] = useState<UserAccessRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(defaultFormState);

  const handleFormPermissionChange = (
    permission: keyof UserPermissions,
    value: boolean,
  ) => {
    setForm((previous) => ({
      ...previous,
      permissions: {
        ...previous.permissions,
        [permission]: value,
      },
    }));
  };

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

    if (!canEditUsers) {
      toast.error("Your account has read-only access for this module.");
      return;
    }

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
        permissions: form.permissions,
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
    updates: Partial<
      Pick<UserAccessRecord, "role" | "isActive" | "permissions">
    >,
  ) => {
    if (!canEditUsers) {
      toast.error("Your account has read-only access for this module.");
      return;
    }

    const nextRole = updates.role ?? record.role;
    const nextActive = updates.isActive ?? record.isActive;
    const nextPermissions = updates.permissions
      ? updates.permissions
      : updates.role
        ? getDefaultPermissionsForRole(nextRole)
        : record.permissions;
    const isSelf = record.email === userEmail.toLowerCase();

    if (isSelf && !nextActive) {
      toast.error("You cannot deactivate your own account.");
      return;
    }

    if (isSelf && record.role === "owner" && nextRole !== "owner") {
      toast.error("You cannot demote your own owner account.");
      return;
    }

    if (
      isSelf &&
      record.permissions.manageUsers &&
      !nextPermissions.manageUsers
    ) {
      toast.error("You cannot remove your own access-control permission.");
      return;
    }

    setIsSaving(true);

    try {
      await accessControlService.upsertUser({
        email: record.email,
        role: nextRole,
        isActive: nextActive,
        permissions: nextPermissions,
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
    if (!canEditUsers) {
      toast.error("Your account has read-only access for this module.");
      return;
    }

    if (record.email === userEmail.toLowerCase()) {
      toast.error("You cannot remove your own owner record.");
      return;
    }

    if (
      !window.confirm(
        `Delete ${record.email} from Firebase auth, Firestore, and access control?`,
      )
    ) {
      return;
    }

    setIsSaving(true);

    try {
      await accessControlService.removeUserEverywhere({
        accessRecordId: record.id,
        email: record.email,
        deletedBy: userEmail || "system",
      });
      toast.success(
        "User removed from Firebase, Firestore, and access control.",
      );
      await loadUsers();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete user account across systems.";
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
                (string), isActive (boolean), manageAttendance (boolean,
                optional), manageAppointments (boolean, optional), manageUsers
                (boolean, optional), manageInventory (boolean, optional),
                manageInventoryReports (boolean, optional), updatedBy (string),
                updatedAt (string).
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
              Add login users, assign specific module permissions, and enable or
              disable account access. Owner role is reserved for super admin
              emails only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canEditUsers ? (
              <div className="mb-3 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                You have read-only access to this page.
              </div>
            ) : null}
            <form
              onSubmit={handleCreateOrUpdate}
              className="grid md:grid-cols-4 gap-2"
            >
              <Input
                placeholder="user@email.com"
                value={form.email}
                disabled={!canEditUsers}
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
                disabled={!canEditUsers}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    role: event.target.value as Exclude<
                      UserAccessRole,
                      "owner"
                    >,
                    permissions: getDefaultPermissionsForRole(
                      event.target.value as Exclude<UserAccessRole, "owner">,
                    ),
                  }))
                }
              >
                <option value="editor">Editor</option>
                <option value="store-manager">Store Manager</option>
                <option value="department-head">Department Head</option>
                <option value="auditor">Auditor</option>
                <option value="viewer">Viewer</option>
              </select>
              <div className="md:col-span-4 rounded-md border border-input bg-background p-3 text-sm space-y-2">
                <p className="font-medium">Specific Permissions</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.permissions.manageAttendance}
                    disabled={!canEditUsers}
                    onChange={(event) =>
                      handleFormPermissionChange(
                        "manageAttendance",
                        event.target.checked,
                      )
                    }
                  />
                  Manage attendance
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.permissions.manageAppointments}
                    disabled={!canEditUsers}
                    onChange={(event) =>
                      handleFormPermissionChange(
                        "manageAppointments",
                        event.target.checked,
                      )
                    }
                  />
                  Manage appointments
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.permissions.manageUsers}
                    disabled={!canEditUsers}
                    onChange={(event) =>
                      handleFormPermissionChange(
                        "manageUsers",
                        event.target.checked,
                      )
                    }
                  />
                  Manage access control
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.permissions.manageInventory}
                    disabled={!canEditUsers}
                    onChange={(event) =>
                      handleFormPermissionChange(
                        "manageInventory",
                        event.target.checked,
                      )
                    }
                  />
                  Manage inventory
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.permissions.manageInventoryReports}
                    disabled={!canEditUsers}
                    onChange={(event) =>
                      handleFormPermissionChange(
                        "manageInventoryReports",
                        event.target.checked,
                      )
                    }
                  />
                  View inventory reports
                </label>
              </div>
              <label className="h-10 px-3 rounded-md border border-input bg-background flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  disabled={!canEditUsers}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Active access
              </label>
              <Button type="submit" disabled={isSaving || !canEditUsers}>
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
              <div className="rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
                      const isSelf = record.email === userEmail.toLowerCase();
                      const isOwnerRole = record.role === "owner";

                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium break-all">
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
                          <TableCell>
                            <div className="space-y-2 text-sm">
                              <label className="flex items-center justify-between gap-3">
                                <span>Attendance</span>
                                <input
                                  type="checkbox"
                                  checked={record.permissions.manageAttendance}
                                  disabled={
                                    isSaving || isOwnerRole || !canEditUsers
                                  }
                                  onChange={(event) =>
                                    void handleQuickUpdate(record, {
                                      permissions: {
                                        ...record.permissions,
                                        manageAttendance: event.target.checked,
                                      },
                                    })
                                  }
                                />
                              </label>
                              <label className="flex items-center justify-between gap-3">
                                <span>Appointments</span>
                                <input
                                  type="checkbox"
                                  checked={
                                    record.permissions.manageAppointments
                                  }
                                  disabled={
                                    isSaving || isOwnerRole || !canEditUsers
                                  }
                                  onChange={(event) =>
                                    void handleQuickUpdate(record, {
                                      permissions: {
                                        ...record.permissions,
                                        manageAppointments:
                                          event.target.checked,
                                      },
                                    })
                                  }
                                />
                              </label>
                              <label className="flex items-center justify-between gap-3">
                                <span>Access Control</span>
                                <input
                                  type="checkbox"
                                  checked={record.permissions.manageUsers}
                                  disabled={
                                    isSaving || isOwnerRole || !canEditUsers
                                  }
                                  onChange={(event) =>
                                    void handleQuickUpdate(record, {
                                      permissions: {
                                        ...record.permissions,
                                        manageUsers: event.target.checked,
                                      },
                                    })
                                  }
                                />
                              </label>
                              <label className="flex items-center justify-between gap-3">
                                <span>Inventory</span>
                                <input
                                  type="checkbox"
                                  checked={record.permissions.manageInventory}
                                  disabled={
                                    isSaving || isOwnerRole || !canEditUsers
                                  }
                                  onChange={(event) =>
                                    void handleQuickUpdate(record, {
                                      permissions: {
                                        ...record.permissions,
                                        manageInventory: event.target.checked,
                                      },
                                    })
                                  }
                                />
                              </label>
                              <label className="flex items-center justify-between gap-3">
                                <span>Reports</span>
                                <input
                                  type="checkbox"
                                  checked={
                                    record.permissions.manageInventoryReports
                                  }
                                  disabled={
                                    isSaving || isOwnerRole || !canEditUsers
                                  }
                                  onChange={(event) =>
                                    void handleQuickUpdate(record, {
                                      permissions: {
                                        ...record.permissions,
                                        manageInventoryReports:
                                          event.target.checked,
                                      },
                                    })
                                  }
                                />
                              </label>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              <select
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={record.role}
                                disabled={
                                  isSaving || isOwnerRole || !canEditUsers
                                }
                                onChange={(event) =>
                                  void handleQuickUpdate(record, {
                                    role: event.target.value as UserAccessRole,
                                  })
                                }
                              >
                                <option value="editor">Editor</option>
                                <option value="store-manager">
                                  Store Manager
                                </option>
                                <option value="department-head">
                                  Department Head
                                </option>
                                <option value="auditor">Auditor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                disabled={
                                  isSaving ||
                                  (isSelf && record.isActive) ||
                                  !canEditUsers
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
                                className="w-full"
                                disabled={isSaving || isSelf || !canEditUsers}
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

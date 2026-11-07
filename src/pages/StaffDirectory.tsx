import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { staffService, type StaffSearchParams } from "@/services/staffService";
import type { StaffMember } from "@/types/attendance";

const DEPARTMENTS = [
  "Emergency",
  "Cardiology",
  "Neurology",
  "General Medicine",
  "Geriatrics",
  "Orthopedics",
  "Nursing",
  "Administration",
  "Pharmacy",
  "Laboratory",
];

const ROLES = [
  "Physician",
  "Senior Physician",
  "Registered Nurse",
  "Charge Nurse",
  "Nursing Assistant",
  "Physical Therapist",
  "Pharmacist",
  "Lab Technician",
  "Administrator",
];

const EMPLOYMENT_STATUSES = [
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "ON_CALL", label: "On Call" },
];

export default function StaffDirectory() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create / Edit modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Registered Nurse",
    department: "Nursing",
    designation: "",
    employmentStatus: "FULL_TIME",
    joiningDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation dialogs
  const [confirmToggleMember, setConfirmToggleMember] = useState<StaffMember | null>(null);
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<StaffMember | null>(null);

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: StaffSearchParams = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (departmentFilter !== "ALL") params.department = departmentFilter;
      if (roleFilter !== "ALL") params.role = roleFilter;
      if (statusFilter === "ACTIVE") params.isActive = true;
      if (statusFilter === "INACTIVE") params.isActive = false;

      const data = await staffService.getAllStaff(params);
      setStaffList(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load staff list";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, departmentFilter, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchStaff();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchStaff]);

  const handleOpenCreate = () => {
    setEditingStaff(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "Registered Nurse",
      department: "Nursing",
      designation: "",
      employmentStatus: "FULL_TIME",
      joiningDate: new Date().toISOString().split("T")[0],
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      department: member.department || "Nursing",
      designation: member.designation || "",
      employmentStatus: member.employmentStatus || "FULL_TIME",
      joiningDate: member.joiningDate || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.role.trim()) {
      toast.error("Staff name and role are required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingStaff) {
        await staffService.updateStaff(editingStaff.id, {
          name: formData.name.trim(),
          role: formData.role.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          department: formData.department.trim(),
          designation: formData.designation.trim(),
          employmentStatus: formData.employmentStatus,
          joiningDate: formData.joiningDate || undefined,
          isActive: editingStaff.isActive,
        });
        toast.success(`Updated staff profile for ${formData.name}`);
      } else {
        await staffService.createStaff({
          name: formData.name.trim(),
          role: formData.role.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          department: formData.department.trim(),
          designation: formData.designation.trim(),
          employmentStatus: formData.employmentStatus,
          joiningDate: formData.joiningDate || undefined,
        });
        toast.success(`Registered new staff member ${formData.name}`);
      }
      setIsDialogOpen(false);
      void fetchStaff();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save staff profile";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmToggleMember) return;
    const targetStatus = !confirmToggleMember.isActive;
    try {
      await staffService.toggleStatus(confirmToggleMember.id, targetStatus);
      toast.success(
        `Staff member ${confirmToggleMember.name} is now ${targetStatus ? "Active" : "Inactive"}`
      );
      setConfirmToggleMember(null);
      void fetchStaff();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update staff status";
      toast.error(message);
    }
  };

  const handleDeleteStaff = async () => {
    if (!confirmDeleteMember) return;
    try {
      await staffService.deleteStaff(confirmDeleteMember.id);
      toast.success(`Removed staff member ${confirmDeleteMember.name}`);
      setConfirmDeleteMember(null);
      void fetchStaff();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove staff member";
      toast.error(message);
    }
  };

  const activeCount = staffList.filter((s) => s.isActive).length;

  return (
    <main className="min-h-screen pt-28 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
              <Badge variant="secondary" className="px-2.5 py-0.5">
                {activeCount} Active / {staffList.length} Total
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Hospital personnel directory, role assignments, department staffing, and accounts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchStaff()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleOpenCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Staff Member
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => void fetchStaff()}>
              Retry
            </Button>
          </div>
        )}

        {/* Filter Toolbar */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone..."
                  className="pl-9 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Department: All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Departments</SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Role: All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Roles</SelectItem>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Status: All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active Only</SelectItem>
                    <SelectItem value="INACTIVE">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Staff Directory
            </CardTitle>
            <CardDescription className="text-xs">
              Showing {staffList.length} staff member{staffList.length === 1 ? "" : "s"} matching criteria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                Loading personnel records...
              </div>
            ) : staffList.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No staff members found matching your search and filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Department / Role</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Employment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffList.map((member) => (
                      <TableRow key={member.id} className="hover:bg-muted/40">
                        <TableCell>
                          <div className="font-semibold text-sm text-foreground">{member.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {member.designation || member.role}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{member.department || "General"}</div>
                          <Badge variant="outline" className="text-[11px] mt-0.5">
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-xs">
                            {member.email && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Mail className="w-3.5 h-3.5 text-primary" />
                                <span>{member.email}</span>
                              </div>
                            )}
                            {member.phone && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Phone className="w-3.5 h-3.5 text-primary" />
                                <span>{member.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs capitalize font-medium">
                            {member.employmentStatus?.replace("_", " ").toLowerCase() || "Full Time"}
                          </div>
                          {member.joiningDate && (
                            <div className="text-[11px] text-muted-foreground">
                              Joined {member.joiningDate}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.isActive ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Edit Profile"
                              onClick={() => handleOpenEdit(member)}
                            >
                              <Edit2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title={member.isActive ? "Deactivate Account" : "Activate Account"}
                              onClick={() => setConfirmToggleMember(member)}
                            >
                              {member.isActive ? (
                                <UserMinus className="w-4 h-4 text-amber-600" />
                              ) : (
                                <UserCheck className="w-4 h-4 text-emerald-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                              title="Delete Record"
                              onClick={() => setConfirmDeleteMember(member)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingStaff ? "Edit Staff Profile" : "Register New Staff Member"}
              </DialogTitle>
              <DialogDescription>
                Provide staff contact info, hospital role, and department designation.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="staff-name">Full Name *</Label>
                  <Input
                    id="staff-name"
                    required
                    placeholder="e.g. Dr. Florence Nightingale"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="staff-email">Work Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    placeholder="name@ggnh.org"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="staff-phone">Phone Number</Label>
                  <Input
                    id="staff-phone"
                    placeholder="+91-9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="staff-role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(val) => setFormData({ ...formData, role: val })}
                  >
                    <SelectTrigger id="staff-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="staff-dept">Department</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(val) => setFormData({ ...formData, department: val })}
                  >
                    <SelectTrigger id="staff-dept">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="staff-desig">Designation</Label>
                  <Input
                    id="staff-desig"
                    placeholder="e.g. Senior Charge Nurse"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="staff-status">Employment Type</Label>
                  <Select
                    value={formData.employmentStatus}
                    onValueChange={(val) => setFormData({ ...formData, employmentStatus: val })}
                  >
                    <SelectTrigger id="staff-status">
                      <SelectValue placeholder="Select employment status" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_STATUSES.map((st) => (
                        <SelectItem key={st.value} value={st.value}>
                          {st.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="staff-joining">Joining Date</Label>
                  <Input
                    id="staff-joining"
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingStaff ? "Save Changes" : "Register Staff"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog for Status Toggle */}
        <AlertDialog
          open={!!confirmToggleMember}
          onOpenChange={(open) => !open && setConfirmToggleMember(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmToggleMember?.isActive ? "Deactivate Staff Account" : "Activate Staff Account"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmToggleMember?.isActive
                  ? `Are you sure you want to deactivate ${confirmToggleMember?.name}? They will no longer be considered active for scheduling and assignments.`
                  : `Are you sure you want to reactivate ${confirmToggleMember?.name}?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleToggleStatus()}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirmation Dialog for Delete */}
        <AlertDialog
          open={!!confirmDeleteMember}
          onOpenChange={(open) => !open && setConfirmDeleteMember(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Remove Staff Member
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently remove {confirmDeleteMember?.name} from the staff directory? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleDeleteStaff()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}


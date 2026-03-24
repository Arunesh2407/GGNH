import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
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
import {
  type AttendanceStatus,
  type StaffMember,
  useAttendance,
} from "@/context/AttendanceContext";
import { useAuth } from "@/context/AuthContext";

const statusOptions: AttendanceStatus[] = ["present", "absent", "leave", "off"];

const statusClasses: Record<AttendanceStatus, string> = {
  present: "bg-emerald-100 text-emerald-700 border-emerald-300",
  absent: "bg-rose-100 text-rose-700 border-rose-300",
  leave: "bg-amber-100 text-amber-700 border-amber-300",
  off: "bg-slate-100 text-slate-700 border-slate-300",
};

const toTitleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const getTodayDate = () => new Date().toISOString().split("T")[0];

const blankStaff = {
  name: "",
  role: "",
  phone: "",
  email: "",
};

const AdminAttendance = () => {
  const { logout } = useAuth();
  const {
    staff,
    addStaff,
    updateStaff,
    removeStaff,
    markAttendance,
    getAttendance,
  } = useAttendance();

  const [selectedDate, setSelectedDate] = useState(getTodayDate);
  const [editMode, setEditMode] = useState(false);
  const [newStaff, setNewStaff] = useState(blankStaff);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState(blankStaff);

  const attendanceSummary = useMemo(() => {
    const summary = {
      present: 0,
      absent: 0,
      leave: 0,
      off: 0,
    };

    staff.forEach((member) => {
      const status = getAttendance(selectedDate, member.id);
      summary[status] += 1;
    });

    return summary;
  }, [staff, selectedDate, getAttendance]);

  const onStaffFieldChange = (
    setter: React.Dispatch<React.SetStateAction<typeof blankStaff>>,
    field: keyof typeof blankStaff,
    value: string,
  ) => {
    setter((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddStaff = () => {
    if (!newStaff.name.trim() || !newStaff.role.trim()) {
      toast.error("Name and role are required to add a staff member.");
      return;
    }

    addStaff({
      name: newStaff.name.trim(),
      role: newStaff.role.trim(),
      phone: newStaff.phone.trim(),
      email: newStaff.email.trim(),
    });
    setNewStaff(blankStaff);
    toast.success("Staff member added.");
  };

  const startEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setEditingStaff({
      name: member.name,
      role: member.role,
      phone: member.phone,
      email: member.email,
    });
  };

  const saveEdit = (id: string) => {
    if (!editingStaff.name.trim() || !editingStaff.role.trim()) {
      toast.error("Name and role are required.");
      return;
    }

    updateStaff(id, {
      name: editingStaff.name.trim(),
      role: editingStaff.role.trim(),
      phone: editingStaff.phone.trim(),
      email: editingStaff.email.trim(),
    });
    setEditingId(null);
    setEditingStaff(blankStaff);
    toast.success("Staff member updated.");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingStaff(blankStaff);
  };

  const handleDelete = (id: string) => {
    const confirmed = window.confirm("Remove this staff member?");
    if (!confirmed) {
      return;
    }

    removeStaff(id);
    if (editingId === id) {
      cancelEdit();
    }
    toast.success("Staff member removed.");
  };

  return (
    <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl">
                Staff Attendance Dashboard
              </CardTitle>
              <CardDescription>
                Mark daily attendance and manage staff details in edit mode.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/">
                <Button variant="outline">Public Site</Button>
              </Link>
              <Button
                variant={editMode ? "default" : "outline"}
                onClick={() => {
                  setEditMode((prev) => !prev);
                  setEditingId(null);
                }}
              >
                <UserCog className="w-4 h-4" />
                {editMode ? "Exit Edit Mode" : "Edit Mode"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  logout();
                  toast.success("You are logged out.");
                }}
              >
                Logout
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label
                  htmlFor="attendance-date"
                  className="text-sm font-medium"
                >
                  Attendance Date
                </label>
                <Input
                  id="attendance-date"
                  type="date"
                  className="mt-1 w-full sm:w-60"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="rounded-md border bg-emerald-50 px-3 py-2">
                  Present:{" "}
                  <span className="font-semibold">
                    {attendanceSummary.present}
                  </span>
                </div>
                <div className="rounded-md border bg-rose-50 px-3 py-2">
                  Absent:{" "}
                  <span className="font-semibold">
                    {attendanceSummary.absent}
                  </span>
                </div>
                <div className="rounded-md border bg-amber-50 px-3 py-2">
                  Leave:{" "}
                  <span className="font-semibold">
                    {attendanceSummary.leave}
                  </span>
                </div>
                <div className="rounded-md border bg-slate-50 px-3 py-2">
                  Off:{" "}
                  <span className="font-semibold">{attendanceSummary.off}</span>
                </div>
              </div>
            </div>

            {editMode ? (
              <div className="rounded-lg border bg-background p-4">
                <h3 className="font-semibold mb-3">Add Staff Member</h3>
                <div className="grid md:grid-cols-4 gap-2">
                  <Input
                    placeholder="Name"
                    value={newStaff.name}
                    onChange={(event) =>
                      onStaffFieldChange(
                        setNewStaff,
                        "name",
                        event.target.value,
                      )
                    }
                  />
                  <Input
                    placeholder="Role"
                    value={newStaff.role}
                    onChange={(event) =>
                      onStaffFieldChange(
                        setNewStaff,
                        "role",
                        event.target.value,
                      )
                    }
                  />
                  <Input
                    placeholder="Phone"
                    value={newStaff.phone}
                    onChange={(event) =>
                      onStaffFieldChange(
                        setNewStaff,
                        "phone",
                        event.target.value,
                      )
                    }
                  />
                  <Input
                    placeholder="Email"
                    value={newStaff.email}
                    onChange={(event) =>
                      onStaffFieldChange(
                        setNewStaff,
                        "email",
                        event.target.value,
                      )
                    }
                  />
                </div>
                <Button className="mt-3" onClick={handleAddStaff}>
                  <Plus className="w-4 h-4" />
                  Add Staff
                </Button>
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Attendance</TableHead>
                  {editMode ? (
                    <TableHead className="w-44">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => {
                  const status = getAttendance(selectedDate, member.id);
                  const isEditing = editMode && editingId === member.id;

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {isEditing ? (
                          <Input
                            value={editingStaff.name}
                            onChange={(event) =>
                              onStaffFieldChange(
                                setEditingStaff,
                                "name",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          member.name
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editingStaff.role}
                            onChange={(event) =>
                              onStaffFieldChange(
                                setEditingStaff,
                                "role",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          member.role
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editingStaff.phone}
                            onChange={(event) =>
                              onStaffFieldChange(
                                setEditingStaff,
                                "phone",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          member.phone || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editingStaff.email}
                            onChange={(event) =>
                              onStaffFieldChange(
                                setEditingStaff,
                                "email",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          member.email || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {statusOptions.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() =>
                                markAttendance(selectedDate, member.id, option)
                              }
                              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                status === option
                                  ? statusClasses[option]
                                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
                              }`}
                            >
                              {toTitleCase(option)}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                      {editMode ? (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => saveEdit(member.id)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEdit(member)}
                              >
                                <Pencil className="w-4 h-4" />
                                Edit
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(member.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}

                {staff.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="text-center text-muted-foreground"
                      colSpan={editMode ? 6 : 5}
                    >
                      No staff members yet. Turn on edit mode to add staff.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AdminAttendance;

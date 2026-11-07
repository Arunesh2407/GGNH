import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  RefreshCw,
  Search,
  XCircle,
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
import {
  appointmentService,
  type Appointment,
} from "@/services/appointmentService";
import { ApiError } from "@/services/apiClient";

const formatDateTime = (iso?: string | null) => {
  if (!iso) {
    return "-";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const StaffAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Confirmation dialogs
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await appointmentService.getAppointments();
      setAppointments(response);
      setError("");
    } catch (loadError: unknown) {
      // Clear data to prevent exposing protected patient information on auth failure
      setAppointments([]);
      if (loadError instanceof ApiError) {
        if (loadError.isUnauthorized) {
          setError("Session expired. Please log in again to view appointments.");
        } else if (loadError.isForbidden) {
          setError(
            "Access denied. You do not have permission to manage appointments."
          );
        } else {
          setError(loadError.message || "Unable to load appointments.");
        }
      } else if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("Unable to load appointments.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      const matchesSearch =
        !searchTerm.trim() ||
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.phone.includes(searchTerm) ||
        (app.doctor && app.doctor.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (app.email && app.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesDate =
        !dateFilter ||
        (app.appointmentDate && app.appointmentDate === dateFilter) ||
        app.createdAt.startsWith(dateFilter);

      return matchesSearch && matchesDate;
    });
  }, [appointments, searchTerm, dateFilter]);

  const bookedAppointments = useMemo(
    () =>
      filteredAppointments.filter(
        (appointment) =>
          appointment.status === "booked" ||
          appointment.status === "pending" ||
          appointment.status === "confirmed"
      ),
    [filteredAppointments]
  );

  const completedAppointments = useMemo(
    () =>
      filteredAppointments.filter(
        (appointment) =>
          appointment.status === "completed" || appointment.status === "cancelled"
      ),
    [filteredAppointments]
  );

  const confirmAppointment = async (id: string) => {
    setIsUpdating(true);
    try {
      const updated = await appointmentService.confirmAppointment(id);
      setAppointments((prev) =>
        prev.map((app) => (app.id === id ? updated : app))
      );
      toast.success("Appointment confirmed successfully");
      setError("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to confirm appointment";
      toast.error(msg);
      setError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellingAppt) return;
    setIsUpdating(true);
    try {
      const updated = await appointmentService.cancelAppointment(cancellingAppt.id);
      setAppointments((prev) =>
        prev.map((app) => (app.id === cancellingAppt.id ? updated : app))
      );
      toast.success("Appointment cancelled");
      setCancellingAppt(null);
      setError("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to cancel appointment";
      toast.error(msg);
      setError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const markCompleted = async (id: string) => {
    setIsUpdating(true);
    try {
      const updated = await appointmentService.completeAppointment(id);
      // Avoid unnecessary repeated requests by updating state in-place
      setAppointments((prev) =>
        prev.map((app) => (app.id === id ? updated : app))
      );
      setError("");
    } catch (updateError: unknown) {
      if (updateError instanceof ApiError) {
        if (updateError.status === 404) {
          setError("Appointment not found or already deleted.");
        } else if (updateError.status === 409) {
          setError("Appointment is already completed or cancelled.");
        } else if (updateError.isForbidden) {
          setError(
            "Access denied. You do not have permission to complete appointments."
          );
        } else if (updateError.isUnauthorized) {
          setError("Session expired. Please log in again.");
        } else {
          setError(
            updateError.message || "Unable to update appointment status."
          );
        }
      } else if (updateError instanceof Error) {
        setError(updateError.message);
      } else {
        setError("Unable to update appointment status.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs">
            Confirmed
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-xs">
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="text-xs">
            Cancelled
          </Badge>
        );
      case "pending":
      case "booked":
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs">
            Booked
          </Badge>
        );
    }
  };

  return (
    <main className="min-h-screen pt-28 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="text-2xl">Appointments</CardTitle>
              <CardDescription>
                Manage booked appointments, confirm schedules, and track completed visits.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || isUpdating}
              onClick={() => void loadAppointments()}
              title="Refresh appointment list"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4 h-7 text-xs border-amber-400 text-amber-900 hover:bg-amber-100"
                  onClick={() => void loadAppointments()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm text-sm">
              <div className="rounded-md border bg-primary/5 px-3 py-2">
                Booked:{" "}
                <span className="font-semibold">
                  {bookedAppointments.length}
                </span>
              </div>
              <div className="rounded-md border bg-emerald-50 px-3 py-2">
                Completed:{" "}
                <span className="font-semibold">
                  {completedAppointments.length}
                </span>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search patient name, phone, doctor..."
                  className="pl-9 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-56">
                <Input
                  type="date"
                  placeholder="Filter by date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
              {(searchTerm || dateFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setDateFilter("");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Booked / Pending / Confirmed Appointments */}
            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Booked Appointments
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Details</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Date / Slot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead className="w-48 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookedAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">
                        <div className="text-foreground">{appointment.name || "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {appointment.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{appointment.doctor || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {appointment.appointmentDate || "Not scheduled"}
                        </div>
                        {appointment.timeSlot && (
                          <div className="text-xs text-muted-foreground">
                            {appointment.timeSlot}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">
                        {getStatusBadge(appointment.status)}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(appointment.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {appointment.status.toLowerCase() !== "confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              disabled={isUpdating}
                              onClick={() => confirmAppointment(appointment.id)}
                            >
                              Confirm
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="text-xs h-8"
                            disabled={isUpdating}
                            onClick={() => markCompleted(appointment.id)}
                          >
                            Mark Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-8 text-destructive hover:bg-destructive/10"
                            disabled={isUpdating}
                            onClick={() => setCancellingAppt(appointment)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bookedAppointments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        {isLoading
                          ? "Loading appointments..."
                          : "No booked appointments."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </section>

            {/* Completed / Cancelled Appointments */}
            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4" />
                Completed Appointments
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Details</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Date / Slot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">
                        <div className="text-foreground">{appointment.name || "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {appointment.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{appointment.doctor || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {appointment.appointmentDate || "-"}
                        </div>
                        {appointment.timeSlot && (
                          <div className="text-xs text-muted-foreground">
                            {appointment.timeSlot}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">
                        {getStatusBadge(appointment.status)}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(appointment.completedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {completedAppointments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground"
                      >
                        {isLoading
                          ? "Loading appointments..."
                          : "No completed appointments."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </section>
          </CardContent>
        </Card>

        {/* Cancellation Confirmation Dialog */}
        <AlertDialog
          open={!!cancellingAppt}
          onOpenChange={(open) => !open && setCancellingAppt(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Cancel Appointment
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel the appointment for{" "}
                <strong>{cancellingAppt?.name}</strong> with{" "}
                <strong>{cancellingAppt?.doctor || "the clinic"}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Active</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleCancel()}
              >
                Confirm Cancellation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
};

export default StaffAppointments;

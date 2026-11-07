import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  Clock,
  Plus,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { appointmentService } from "@/services/appointmentService";
import type { Appointment } from "@/types/appointment";

export default function MyAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation state
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchMyAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await appointmentService.getMyAppointments();
      setAppointments(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load appointments";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMyAppointments();
  }, [fetchMyAppointments]);

  const handleCancel = async () => {
    if (!cancellingAppt) return;
    setIsCancelling(true);
    try {
      await appointmentService.cancelAppointment(cancellingAppt.id);
      toast.success("Your appointment has been cancelled.");
      setCancellingAppt(null);
      void fetchMyAppointments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel appointment";
      toast.error(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
            Confirmed
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">
            Completed
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "pending":
      case "booked":
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
            Pending Confirmation
          </Badge>
        );
    }
  };

  return (
    <main className="min-h-screen pt-28 pb-16 px-4 bg-muted/30">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">My Appointments</h1>
              <Badge variant="secondary" className="px-2.5 py-0.5">
                {appointments.length} Total
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              View your scheduled consultations, track status, and manage visits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchMyAppointments()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link to="/contact">
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Book New Appointment
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => void fetchMyAppointments()}>
              Retry
            </Button>
          </div>
        )}

        {/* List of Appointments */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="py-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              Loading your appointments...
            </Card>
          ) : appointments.length === 0 ? (
            <Card className="p-8 text-center space-y-4 border-dashed">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <CalendarClock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-base">No appointments booked yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  You do not have any past or upcoming appointments linked to your account.
                </p>
              </div>
              <Link to="/contact">
                <Button size="sm" className="gap-2 mt-2">
                  <Calendar className="w-4 h-4" />
                  Schedule Your Consultation
                </Button>
              </Link>
            </Card>
          ) : (
            appointments.map((appt) => {
              const canCancel =
                appt.status.toLowerCase() === "pending" ||
                appt.status.toLowerCase() === "booked" ||
                appt.status.toLowerCase() === "confirmed";

              return (
                <Card key={appt.id} className="shadow-sm hover:border-primary/40 transition-all">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold">
                          {appt.doctor || "Medical Consultation"}
                        </CardTitle>
                        {getStatusBadge(appt.status)}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        Booked on{" "}
                        {new Date(appt.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </CardDescription>
                    </div>

                    {canCancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
                        onClick={() => setCancellingAppt(appt)}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm bg-muted/40 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span>Date: </span>
                        <strong className="text-foreground">
                          {appt.appointmentDate || "Scheduled upon review"}
                        </strong>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span>Time Slot: </span>
                        <strong className="text-foreground">
                          {appt.timeSlot || "Standard Clinic Hours"}
                        </strong>
                      </div>
                    </div>

                    {appt.message && (
                      <div className="text-xs text-muted-foreground bg-background border p-2.5 rounded-md">
                        <span className="font-medium text-foreground">Reason for Visit: </span>
                        {appt.message}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Cancellation Confirmation */}
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
                Are you sure you want to cancel your appointment with{" "}
                <strong>{cancellingAppt?.doctor || "the clinic"}</strong> on{" "}
                <strong>{cancellingAppt?.appointmentDate || "the scheduled date"}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCancelling}>Keep Appointment</AlertDialogCancel>
              <AlertDialogAction
                disabled={isCancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleCancel()}
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}


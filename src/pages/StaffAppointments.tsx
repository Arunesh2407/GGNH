import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  appointmentService,
  type Appointment,
} from "@/services/appointmentService";

const formatDateTime = (iso: string) => {
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

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        const response = await appointmentService.getAppointments();
        setAppointments(response);
        setError("");
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError("Unable to load appointments.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadAppointments();
  }, []);

  const bookedAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === "booked"),
    [appointments],
  );

  const completedAppointments = useMemo(
    () =>
      appointments.filter((appointment) => appointment.status === "completed"),
    [appointments],
  );

  const markCompleted = async (id: string) => {
    setIsUpdating(true);

    try {
      const next = await appointmentService.markCompleted(id);
      setAppointments(next);
      setError("");
    } catch (updateError) {
      if (updateError instanceof Error) {
        setError(updateError.message);
      } else {
        setError("Unable to update appointment status.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <main className="min-h-screen pt-28 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Appointments</CardTitle>
            <CardDescription>
              Manage booked appointments and track completed visits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            ) : null}

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

            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Booked Appointments
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead className="w-36">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookedAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">
                        {appointment.name}
                      </TableCell>
                      <TableCell>{appointment.phone}</TableCell>
                      <TableCell>{appointment.doctor}</TableCell>
                      <TableCell>{appointment.status}</TableCell>
                      <TableCell>
                        {formatDateTime(appointment.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => markCompleted(appointment.id)}
                        >
                          Mark Complete
                        </Button>
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

            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4" />
                Completed Appointments
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">
                        {appointment.name}
                      </TableCell>
                      <TableCell>{appointment.phone}</TableCell>
                      <TableCell>{appointment.doctor}</TableCell>
                      <TableCell>{appointment.status}</TableCell>
                      <TableCell>
                        {formatDateTime(appointment.completedAt ?? "")}
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
      </div>
    </main>
  );
};

export default StaffAppointments;

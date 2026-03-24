import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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
import { useAttendance } from "@/context/AttendanceContext";

const toTitleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getTodayDate = () => formatLocalDate(new Date());

const getDatesInRange = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
    dates.push(formatLocalDate(date));
  }

  return dates;
};

const AdminAttendanceReport = () => {
  const { staff, attendanceByDate, isLoading, error } = useAttendance();
  const [timelineStartDate, setTimelineStartDate] = useState(getTodayDate);
  const [timelineEndDate, setTimelineEndDate] = useState(getTodayDate);

  const timelineDates = useMemo(() => {
    if (
      !timelineStartDate ||
      !timelineEndDate ||
      timelineStartDate > timelineEndDate
    ) {
      return [];
    }

    return getDatesInRange(timelineStartDate, timelineEndDate);
  }, [timelineStartDate, timelineEndDate]);

  const rows = useMemo(() => {
    if (timelineDates.length === 0) {
      return [];
    }

    return staff.map((member) => {
      const statuses = timelineDates.map(
        (date) => attendanceByDate[date]?.[member.id] ?? "",
      );

      const presentDays = statuses.filter(
        (status) => status === "present",
      ).length;
      const attendancePercentage = (
        (presentDays / timelineDates.length) *
        100
      ).toFixed(1);

      return {
        id: member.id,
        name: member.name,
        phone: member.phone || "-",
        email: member.email || "-",
        statuses,
        attendancePercentage: `${attendancePercentage}%`,
      };
    });
  }, [staff, attendanceByDate, timelineDates]);

  if (isLoading) {
    return (
      <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground">
          Loading timeline report...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-36 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl">
                Attendance Timeline Report
              </CardTitle>
              <CardDescription>
                View attendance of all staff members for a custom timeline.
              </CardDescription>
            </div>
            <Link to="/staff/attendance">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <div>
                <label
                  htmlFor="timeline-start-date"
                  className="text-sm font-medium"
                >
                  Timeline Start
                </label>
                <Input
                  id="timeline-start-date"
                  type="date"
                  className="mt-1 w-full sm:w-44"
                  value={timelineStartDate}
                  onChange={(event) => setTimelineStartDate(event.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="timeline-end-date"
                  className="text-sm font-medium"
                >
                  Timeline End
                </label>
                <Input
                  id="timeline-end-date"
                  type="date"
                  className="mt-1 w-full sm:w-44"
                  value={timelineEndDate}
                  onChange={(event) => setTimelineEndDate(event.target.value)}
                />
              </div>
            </div>

            {timelineStartDate > timelineEndDate ? (
              <div className="text-sm text-rose-600">
                Start date cannot be after end date.
              </div>
            ) : null}

            <div className="overflow-auto rounded-md border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    {timelineDates.map((date) => (
                      <TableHead key={date}>{date}</TableHead>
                    ))}
                    <TableHead>Total %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      {row.statuses.map((status, index) => (
                        <TableCell key={`${row.id}-${timelineDates[index]}`}>
                          {status ? toTitleCase(status) : ""}
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold">
                        {row.attendancePercentage}
                      </TableCell>
                    </TableRow>
                  ))}

                  {staff.length === 0 ? (
                    <TableRow>
                      <TableCell
                        className="text-center text-muted-foreground"
                        colSpan={timelineDates.length + 4}
                      >
                        No staff members found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AdminAttendanceReport;

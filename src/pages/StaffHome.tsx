import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  LockKeyhole,
  LogIn,
  LogOut,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  dashboardService,
  type DashboardSummary,
} from "@/services/dashboardService";
import { attendanceService } from "@/services/attendanceService";

const StaffHome = () => {
  const {
    userEmail,
    role,
    canManageAttendance,
    canManageAppointments,
    canManageUsers,
    canManageInventory,
    canViewInventoryReports,
  } = useAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAttendanceSubmitting, setIsAttendanceSubmitting] = useState(false);

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getSummary();
      setSummary(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard statistics";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const handleQuickCheckIn = async () => {
    setIsAttendanceSubmitting(true);
    try {
      await attendanceService.checkIn();
      toast.success("Checked in successfully for today!");
      void fetchSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check in";
      toast.error(msg);
    } finally {
      setIsAttendanceSubmitting(false);
    }
  };

  const handleQuickCheckOut = async () => {
    setIsAttendanceSubmitting(true);
    try {
      await attendanceService.checkOut();
      toast.success("Checked out successfully for today!");
      void fetchSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check out";
      toast.error(msg);
    } finally {
      setIsAttendanceSubmitting(false);
    }
  };

  const navigationOptions = [
    ...(canManageAppointments
      ? [
          {
            title: "Appointments",
            description: "View booked appointments, confirm schedules, and mark completions.",
            to: "/staff/appointments",
            icon: ClipboardList,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-500/10",
          },
        ]
      : []),
    ...(canManageAttendance
      ? [
          {
            title: "Staff Attendance",
            description: "Record daily attendance, view roster, and inspect attendance history.",
            to: "/staff/attendance",
            icon: UserCheck,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
          },
        ]
      : []),
    ...(canManageUsers
      ? [
          {
            title: "Staff Management",
            description: "Personnel directory, assignments, role permissions, and accounts.",
            to: "/staff/members",
            icon: Users,
            color: "text-teal-600 dark:text-teal-400",
            bg: "bg-teal-500/10",
          },
        ]
      : []),
    ...(canManageInventory
      ? [
          {
            title: "Inventory & Supplies",
            description: "Manage medical items, categories, suppliers, and stock adjustments.",
            to: "/staff/inventory",
            icon: Boxes,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10",
          },
        ]
      : []),
    ...(canViewInventoryReports && !canManageInventory
      ? [
          {
            title: "Inventory Reports",
            description: "View stock availability and item audit ledger tracing.",
            to: "/staff/inventory/reports",
            icon: FileSearch,
            color: "text-indigo-600 dark:text-indigo-400",
            bg: "bg-indigo-500/10",
          },
        ]
      : []),
    ...(canManageUsers
      ? [
          {
            title: "User Access Control",
            description: "Manage system accounts, assign RBAC roles, and granular permissions.",
            to: "/staff/access-control",
            icon: LockKeyhole,
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-500/10",
          },
        ]
      : []),
  ];

  const formatActivityTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <main className="min-h-screen pt-28 pb-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
              <Badge variant="secondary" className="capitalize text-xs font-semibold px-2 py-0.5">
                {role || "Staff"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Operational overview and centralized management for GG Nursing Home Hub.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick check-in / check-out */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleQuickCheckIn()}
              disabled={isAttendanceSubmitting}
              className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <LogIn className="w-3.5 h-3.5" />
              Check In
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleQuickCheckOut()}
              disabled={isAttendanceSubmitting}
              className="gap-1.5 text-xs text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              Check Out
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchSummary()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => void fetchSummary()}>
              Retry
            </Button>
          </div>
        )}

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Appointments */}
          <Card className="shadow-sm border-border/70">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Appointments
              </CardTitle>
              <div className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <CalendarClock className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? summary.appointments.booked : "—"}
                <span className="text-xs font-normal text-muted-foreground ml-2">pending</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>{summary?.appointments.completed ?? 0} completed</span>
                <span>{summary?.appointments.today ?? 0} today</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Staff */}
          <Card className="shadow-sm border-border/70">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Staff
              </CardTitle>
              <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? summary.staff.total : "—"}
                <span className="text-xs font-normal text-muted-foreground ml-2">members</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span>{summary?.staff.active ?? 0} active in system</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Attendance Summary */}
          <Card className="shadow-sm border-border/70">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Attendance Today
              </CardTitle>
              <div className="w-8 h-8 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <CalendarCheck2 className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? `${summary.attendance.attendancePercentage}%` : "—"}
              </div>
              <div className="mt-2">
                <Progress
                  value={summary?.attendance.attendancePercentage ?? 0}
                  className="h-1.5"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex justify-between">
                <span>{summary?.attendance.presentToday ?? 0} present</span>
                <span>{summary?.attendance.absentToday ?? 0} absent</span>
                <span>{summary?.attendance.onLeaveToday ?? 0} leave</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Inventory Low Stock */}
          <Card className="shadow-sm border-border/70">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inventory Items
              </CardTitle>
              <div className="w-8 h-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <span>{summary ? summary.inventory.totalItems : "—"}</span>
                {summary && summary.inventory.lowStockItems > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {summary.inventory.lowStockItems} low stock
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex justify-between">
                <span>{summary?.inventory.totalCategories ?? 0} categories</span>
                <span>{summary?.inventory.totalSuppliers ?? 0} suppliers</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Two-Column Operational Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operations Summaries (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Operational Information Banner */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Operational Status & Summaries
                </CardTitle>
                <CardDescription>
                  Real-time status of nursing home clinical and administrative modules.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Appointment Status Breakdown */}
                  <div className="p-4 rounded-lg bg-muted/40 border border-border/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">Appointments Queue</span>
                      <Link to="/staff/appointments" className="text-xs text-primary hover:underline">
                        Manage &rarr;
                      </Link>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Pending / Booked</span>
                        <span className="font-medium text-amber-600">{summary?.appointments.booked ?? 0}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Completed</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {summary?.appointments.completed ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Total Bookings</span>
                        <span className="font-medium">{summary?.appointments.total ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Breakdown */}
                  <div className="p-4 rounded-lg bg-muted/40 border border-border/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">Today&apos;s Attendance</span>
                      <Link to="/staff/attendance" className="text-xs text-primary hover:underline">
                        Mark &rarr;
                      </Link>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">On Duty (Present)</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {summary?.attendance.presentToday ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Absent</span>
                        <span className="font-medium text-destructive">
                          {summary?.attendance.absentToday ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">On Leave</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {summary?.attendance.onLeaveToday ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Staff Distribution by Role */}
                {summary?.staff?.distributionByRole && Object.keys(summary.staff.distributionByRole).length > 0 && (
                  <div className="p-4 rounded-lg bg-muted/40 border border-border/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">Staff by Role</span>
                      <Link to="/staff/members" className="text-xs text-primary hover:underline">
                        Directory &rarr;
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {Object.entries(summary.staff.distributionByRole).map(([roleName, count]) => (
                        <Badge key={roleName} variant="outline" className="text-xs py-1 px-2.5 bg-background">
                          <span className="font-medium mr-1.5">{roleName}:</span>
                          <span className="font-bold text-primary">{count}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inventory Health Indicator */}
                <div className="p-4 rounded-lg bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Medical Supplies & Inventory Status</div>
                      <div className="text-xs text-muted-foreground">
                        {summary?.inventory.lowStockItems === 0
                          ? "All stock levels are currently above reorder thresholds."
                          : `${summary?.inventory.lowStockItems ?? 0} item(s) are at or below reorder level and require replenishment.`}
                      </div>
                    </div>
                  </div>
                  {canManageInventory && (
                    <div className="flex gap-2">
                      <Link to="/staff/inventory/items">
                        <Button size="sm" variant="outline" className="text-xs shrink-0">
                          Manage Items
                        </Button>
                      </Link>
                      <Link to="/staff/inventory/stock-receiving">
                        <Button size="sm" className="text-xs shrink-0">
                          Receive Stock
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Navigation Shortcuts */}
            <div>
              <h2 className="text-base font-semibold mb-3">Management Modules</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {navigationOptions.map((option) => (
                  <Link key={option.title} to={option.to} className="group">
                    <Card className="h-full transition-all hover:shadow-md hover:border-primary/40 group-hover:bg-muted/20">
                      <CardHeader className="flex flex-row items-center gap-3 py-3 px-4">
                        <div className={`w-9 h-9 rounded-md ${option.bg} ${option.color} flex items-center justify-center shrink-0`}>
                          <option.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">
                            {option.title}
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-1 mt-0.5">
                            {option.description}
                          </CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Recent Activity Feed (1 col) */}
          <div className="space-y-6">
            <Card className="shadow-sm h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Recent System Activity
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time operational audit log from backend services.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {isLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Loading recent activity...
                  </div>
                ) : !summary?.recentActivities || summary.recentActivities.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No recent activity recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 text-xs">
                    {summary.recentActivities.map((activity) => (
                      <div key={activity.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground truncate">
                            {activity.title}
                          </span>
                          <Badge
                            variant={activity.type === "APPOINTMENT" ? "secondary" : "outline"}
                            className="text-[10px] px-1 py-0 shrink-0"
                          >
                            {activity.type}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground truncate">{activity.description}</p>
                        <span className="text-[10px] text-muted-foreground/70 block">
                          {formatActivityTime(activity.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
};

export default StaffHome;

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Boxes,
  ClipboardList,
  FileSearch,
  Home,
  LockKeyhole,
  LogOut,
  Menu,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const StaffNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    logout,
    canManageAttendance,
    canManageAppointments,
    canManageUsers,
    canManageInventory,
    canViewInventoryReports,
  } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === "/staff") {
      return location.pathname === "/staff";
    }

    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { to: "/staff", label: "Home", icon: Home },
    ...(canManageAttendance
      ? [{ to: "/staff/attendance", label: "Attendance", icon: UserCheck }]
      : []),
    ...(canManageAppointments
      ? [
          {
            to: "/staff/appointments",
            label: "Appointments",
            icon: ClipboardList,
          },
        ]
      : []),
    ...(canManageUsers
      ? [
          {
            to: "/staff/access-control",
            label: "Access",
            icon: LockKeyhole,
          },
        ]
      : []),
    ...(canManageInventory
      ? [
          {
            to: "/staff/inventory",
            label: "Inventory",
            icon: Boxes,
          },
        ]
      : []),
    ...(!canManageInventory && canViewInventoryReports
      ? [
          {
            to: "/staff/inventory/reports",
            label: "Inventory Reports",
            icon: FileSearch,
          },
        ]
      : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-primary/10 bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-16 md:h-[72px] flex items-center justify-between gap-3">
          <Link
            to="/staff"
            className="flex items-center gap-2.5 min-w-0"
            aria-label="Staff dashboard home"
          >
            <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-tight text-muted-foreground">
                Logged In
              </p>
              <p className="font-semibold leading-tight text-foreground truncate">
                Staff Workspace
              </p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 p-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button size="sm" variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>

          <button
            type="button"
            className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-xl border border-border bg-background/80 text-foreground"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {mobileOpen ? (
          <div className="md:hidden pb-4">
            <div className="rounded-2xl border border-border bg-background p-2 space-y-1 shadow-sm">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}

              <Button
                type="button"
                variant="destructive"
                className="w-full justify-center mt-2"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
};

export default StaffNavbar;

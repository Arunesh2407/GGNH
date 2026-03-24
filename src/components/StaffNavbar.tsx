import { Link, useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, Home, LogOut, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const StaffNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isActive = (path: string) => {
    if (path === "/staff") {
      return location.pathname === "/staff";
    }

    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-card/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link
          to="/staff"
          className="font-semibold text-foreground whitespace-nowrap"
        >
          Staff Panel
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/staff">
            <Button
              variant={isActive("/staff") ? "default" : "outline"}
              size="sm"
            >
              <Home className="w-4 h-4" />
              Home
            </Button>
          </Link>
          <Link to="/staff/attendance">
            <Button
              variant={isActive("/staff/attendance") ? "default" : "outline"}
              size="sm"
            >
              <UserCheck className="w-4 h-4" />
              Attendance
            </Button>
          </Link>
          <Link to="/staff/appointments">
            <Button
              variant={isActive("/staff/appointments") ? "default" : "outline"}
              size="sm"
            >
              <ClipboardList className="w-4 h-4" />
              Appointments
            </Button>
          </Link>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              await logout();
              navigate("/admin/login", { replace: true });
            }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default StaffNavbar;

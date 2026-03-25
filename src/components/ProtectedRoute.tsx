import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type ProtectedRouteProps = {
  children: JSX.Element;
  requiredAccess?:
    | "authenticated"
    | "manage-attendance"
    | "manage-appointments"
    | "manage-users"
    | "manage-inventory"
    | "view-inventory-reports";
};

const ProtectedRoute = ({
  children,
  requiredAccess = "authenticated",
}: ProtectedRouteProps) => {
  const {
    isAuthenticated,
    isLoading,
    canManageAttendance,
    canManageAppointments,
    canManageUsers,
    canManageInventory,
    canViewInventoryReports,
  } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="pt-40 text-center text-muted-foreground">
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
    );
  }

  if (requiredAccess === "manage-users" && !canManageUsers) {
    return <Navigate to="/staff" replace />;
  }

  if (requiredAccess === "manage-attendance" && !canManageAttendance) {
    return <Navigate to="/staff" replace />;
  }

  if (requiredAccess === "manage-appointments" && !canManageAppointments) {
    return <Navigate to="/staff" replace />;
  }

  if (requiredAccess === "manage-inventory" && !canManageInventory) {
    return <Navigate to="/staff" replace />;
  }

  if (requiredAccess === "view-inventory-reports" && !canViewInventoryReports) {
    return <Navigate to="/staff" replace />;
  }

  return children;
};

export default ProtectedRoute;

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type ProtectedRouteProps = {
  children: JSX.Element;
  requiredAccess?: "authenticated" | "edit-attendance" | "manage-users";
};

const ProtectedRoute = ({
  children,
  requiredAccess = "authenticated",
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, canEditAttendance, canManageUsers } =
    useAuth();
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

  if (requiredAccess === "edit-attendance" && !canEditAttendance) {
    return <Navigate to="/staff/attendance" replace />;
  }

  return children;
};

export default ProtectedRoute;

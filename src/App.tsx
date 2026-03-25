import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import ScrollToTop from "@/components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import PublicLayout from "@/components/layout/PublicLayout";
import StaffLayout from "@/components/layout/StaffLayout";
import { AttendanceProvider } from "@/context/AttendanceContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Index from "./pages/Index.tsx";
import About from "./pages/About.tsx";
import Services from "./pages/Services.tsx";
import Doctors from "./pages/Doctors.tsx";
import Contact from "./pages/Contact.tsx";
import Gallery from "./pages/Gallery.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import AdminRegister from "./pages/AdminRegister.tsx";
import AdminAttendance from "./pages/AdminAttendance.tsx";
import AdminAttendanceReport from "./pages/AdminAttendanceReport.tsx";
import StaffHome from "./pages/StaffHome.tsx";
import StaffAppointments from "./pages/StaffAppointments.tsx";
import AdminUserAccess from "./pages/AdminUserAccess.tsx";
import InventoryHome from "./pages/inventory/InventoryHome.tsx";
import ItemCategories from "./pages/inventory/ItemCategories.tsx";
import ItemMaster from "./pages/inventory/ItemMaster.tsx";
import Suppliers from "./pages/inventory/Suppliers.tsx";
import StockReceiving from "./pages/inventory/StockReceiving.tsx";
import InventoryReports from "./pages/inventory/InventoryReports.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const SessionTimeoutWarning = () => {
  const { isInactivityWarningVisible, extendSession, logout } = useAuth();

  return (
    <AlertDialog open={isInactivityWarningVisible}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Expiring Soon</AlertDialogTitle>
          <AlertDialogDescription>
            You have been inactive for a while. You will be logged out in 5
            minutes unless you stay signed in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={extendSession}>
            Stay Logged In
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void logout();
            }}
          >
            Logout Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AttendanceProvider>
          <SessionTimeoutWarning />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/about" element={<About />} />
                <Route path="/services" element={<Services />} />
                <Route path="/doctors" element={<Doctors />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/register" element={<AdminRegister />} />
              </Route>

              <Route
                path="/staff"
                element={
                  <ProtectedRoute>
                    <StaffLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<StaffHome />} />
                <Route
                  path="attendance"
                  element={
                    <ProtectedRoute requiredAccess="manage-attendance">
                      <AdminAttendance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="attendance/report"
                  element={
                    <ProtectedRoute requiredAccess="manage-attendance">
                      <AdminAttendanceReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="appointments"
                  element={
                    <ProtectedRoute requiredAccess="manage-appointments">
                      <StaffAppointments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="access-control"
                  element={
                    <ProtectedRoute requiredAccess="manage-users">
                      <AdminUserAccess />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="inventory"
                  element={
                    <ProtectedRoute requiredAccess="manage-inventory">
                      <InventoryHome />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="inventory/categories"
                  element={
                    <ProtectedRoute requiredAccess="manage-inventory">
                      <ItemCategories />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="inventory/items"
                  element={
                    <ProtectedRoute requiredAccess="manage-inventory">
                      <ItemMaster />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="inventory/suppliers"
                  element={
                    <ProtectedRoute requiredAccess="manage-inventory">
                      <Suppliers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="inventory/stock-receiving"
                  element={
                    <ProtectedRoute requiredAccess="manage-inventory">
                      <StockReceiving />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="inventory/reports"
                  element={
                    <ProtectedRoute requiredAccess="view-inventory-reports">
                      <InventoryReports />
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route
                path="/admin/attendance"
                element={<Navigate to="/staff/attendance" replace />}
              />
              <Route
                path="/admin/attendance/report"
                element={<Navigate to="/staff/attendance/report" replace />}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AttendanceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import PublicLayout from "@/components/layout/PublicLayout";
import StaffLayout from "@/components/layout/StaffLayout";
import { AttendanceProvider } from "@/context/AttendanceContext";
import { AuthProvider } from "@/context/AuthContext";
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
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AttendanceProvider>
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

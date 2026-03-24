import { Outlet } from "react-router-dom";
import StaffNavbar from "@/components/StaffNavbar";

const StaffLayout = () => {
  return (
    <>
      <StaffNavbar />
      <Outlet />
    </>
  );
};

export default StaffLayout;

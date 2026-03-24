import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingActionBar from "@/components/FloatingActionBar";

const PublicLayout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
      <FloatingActionBar />
    </>
  );
};

export default PublicLayout;

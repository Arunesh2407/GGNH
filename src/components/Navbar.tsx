import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Phone,
  MapPin,
  Mail,
  ChevronDown,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const departments = [
  { to: "/services#general-medicine", label: "General Medicine" },
  { to: "/services#general-surgery", label: "General Surgery" },
  { to: "/services#orthopaedics", label: "Orthopaedics" },
  { to: "/services#ophthalmology", label: "Ophthalmology" },
  { to: "/services#pathology", label: "Pathology" },
  { to: "/services#plastic-surgery", label: "Plastic Surgery" },
  { to: "/services#radiodiagnosis", label: "Radiodiagnosis" },
  { to: "/services#neurosurgery", label: "Neurosurgery" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [mobileDeptOpen, setMobileDeptOpen] = useState(false);
  const location = useLocation();
  const deptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setDeptOpen(false);
    setMobileDeptOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) {
        setDeptOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-2 flex justify-between items-center text-sm">
          <div className="hidden md:flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            <span>G G Nursing Home, Bargawan, Katni (M.P) – 483501</span>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <a
              href="mailto:ggnhkatni@gmail.com"
              className="hidden sm:flex items-center gap-1 hover:underline"
            >
              <Mail className="w-3.5 h-3.5" /> ggnhkatni@gmail.com
            </a>
            <a
              href="tel:07622229250"
              className="flex items-center gap-1.5 font-semibold hover:underline"
            >
              <Phone className="w-3.5 h-3.5" /> Call 24/7: 07622-229250
            </a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div
        className={`transition-all duration-300 ${
          scrolled
            ? "bg-card/98 backdrop-blur-lg shadow-md border-b border-border"
            : "bg-card shadow-sm"
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:h-[72px]">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <img
                src="/images/logo.png"
                alt="G G Nursing Home logo"
                className="w-11 h-11 object-contain rounded-full bg-white p-0.5 border border-border/40"
              />
              <div>
                <span className="font-bold text-lg tracking-tight text-foreground leading-none">
                  G G Nursing Home
                </span>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  NABH Pre-accredited Hospital
                </p>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-0.5">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/")
                    ? "text-primary bg-primary/8"
                    : "text-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                Home
              </Link>

              <Link
                to="/about"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/about")
                    ? "text-primary bg-primary/8"
                    : "text-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                About Us
              </Link>

              {/* Departments dropdown */}
              <div ref={deptRef} className="relative">
                <button
                  onClick={() => setDeptOpen(!deptOpen)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive("/services")
                      ? "text-primary bg-primary/8"
                      : "text-foreground hover:text-primary hover:bg-primary/5"
                  }`}
                >
                  Departments{" "}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${deptOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {deptOpen && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-card rounded-lg shadow-xl border border-border py-2 animate-fade-in">
                    {departments.map((dept) => (
                      <Link
                        key={dept.label}
                        to={dept.to}
                        className="block px-4 py-2.5 text-sm text-foreground hover:bg-primary/5 hover:text-primary transition-colors"
                      >
                        {dept.label}
                      </Link>
                    ))}
                    <div className="border-t border-border mt-1 pt-1">
                      <Link
                        to="/services"
                        className="block px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                      >
                        View All Departments →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <Link
                to="/doctors"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/doctors")
                    ? "text-primary bg-primary/8"
                    : "text-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                Doctors
              </Link>

              <Link
                to="/gallery"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/gallery")
                    ? "text-primary bg-primary/8"
                    : "text-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                Gallery
              </Link>

              <Link
                to="/contact"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/contact")
                    ? "text-primary bg-primary/8"
                    : "text-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                Contact Us
              </Link>
            </div>

            {/* Right side */}
            <div className="hidden lg:flex items-center gap-2">
              <Link to="/contact">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-5">
                  Book An Appointment →
                </Button>
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 rounded-md text-foreground hover:bg-muted active:scale-95 transition-transform"
            >
              {isOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="lg:hidden bg-card border-t border-border shadow-lg animate-fade-in">
          <div className="container mx-auto px-4 py-4 space-y-1">
            <Link
              to="/"
              className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive("/") ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Home
            </Link>
            <Link
              to="/about"
              className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive("/about") ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              About Us
            </Link>
            <div>
              <button
                onClick={() => setMobileDeptOpen(!mobileDeptOpen)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Departments{" "}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${mobileDeptOpen ? "rotate-180" : ""}`}
                />
              </button>
              {mobileDeptOpen && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {departments.map((dept) => (
                    <Link
                      key={dept.label}
                      to={dept.to}
                      className="block px-3 py-2 text-sm text-muted-foreground hover:text-primary"
                    >
                      {dept.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link
              to="/doctors"
              className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive("/doctors") ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Doctors
            </Link>
            <Link
              to="/gallery"
              className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive("/gallery") ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Gallery
            </Link>
            <Link
              to="/contact"
              className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive("/contact") ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              Contact Us
            </Link>
            <Link to="/contact" className="block pt-2">
              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                Book An Appointment →
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

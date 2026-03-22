import { useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Footer = () => {
  return (
    <footer className="bg-[hsl(200,30%,10%)] text-white">
      {/* Appointment strip */}
      <div className="bg-accent">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-accent-foreground font-semibold text-center md:text-left">
            We always support in emergencies, contact us immediately if you are
            experiencing any serious health problems.
          </p>
          <Link to="/contact">
            <Button
              variant="outline"
              className="border-accent-foreground/30 text-orange-500 hover:bg-accent-foreground/10 font-semibold whitespace-nowrap"
            >
              Request An Appointment
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Logo & about */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-base">
                  GG
                </span>
              </div>
              <div>
                <span className="font-bold text-lg">G G Nursing Home</span>
                <p className="text-xs text-white/50">NABH Pre-accredited</p>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              50 Bedded Hospital serving the people of Katni for over 20 years
              with trusted, compassionate healthcare. Registered for Ayushman
              Bharat, ESIC, Railway Hospital.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Quick Links</h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              {[
                { to: "/about", label: "About Us" },
                { to: "/services", label: "Departments" },
                { to: "/doctors", label: "Our Doctors" },
                { to: "/contact", label: "Contact Us" },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Departments */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Departments</h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              {[
                "Orthopaedics",
                "Ophthalmology",
                "General Surgery",
                "General Medicine",
                "Neurosurgery",
                "Pathology",
                "Radiodiagnosis",
                "Plastic Surgery",
              ].map((dept) => (
                <li key={dept}>
                  <Link
                    to="/services"
                    className="hover:text-accent transition-colors"
                  >
                    {dept}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4 text-white">
              Contact G G Nursing Home
            </h4>
            <ul className="space-y-3 text-sm text-white/60">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                Madan Mohan Choubey Ward, Bargawan, Katni (M.P) – 483501
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 text-accent" />
                <a
                  href="tel:07622229250"
                  className="hover:text-accent transition-colors"
                >
                  07622-229250
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0 text-accent" />
                <a
                  href="mailto:ggnhkatni@gmail.com"
                  className="hover:text-accent transition-colors"
                >
                  ggnhkatni@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0 text-accent" />
                24×7 Emergency Services
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-white/40">
          <span>
            © {new Date().getFullYear()} G G Nursing Home Pvt. Ltd. All rights
            reserved.
          </span>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-white/70">
              Privacy Policy
            </Link>
            <Link to="/about" className="hover:text-white/70">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

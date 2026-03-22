import { Calendar, Phone, MessageCircle, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const FloatingActionBar = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-primary text-primary-foreground shadow-[0_-2px_10px_rgba(0,0,0,0.15)]">
      <div className="grid grid-cols-4">
        <Link
          to="/contact"
          className="flex flex-col items-center justify-center py-2.5 gap-0.5 hover:bg-primary/80 active:scale-95 transition-all"
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] font-medium">Appt.</span>
        </Link>
        <a
          href="tel:07622229250"
          className="flex flex-col items-center justify-center py-2.5 gap-0.5 hover:bg-primary/80 active:scale-95 transition-all"
        >
          <Phone className="w-5 h-5" />
          <span className="text-[10px] font-medium">Call</span>
        </a>
        <a
          href="https://wa.me/917622229250?text=Hello!"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center py-2.5 gap-0.5 hover:bg-primary/80 active:scale-95 transition-all"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium">WhatsApp</span>
        </a>
        <a
          href="https://maps.google.com/?q=G+G+Nursing+Home+Katni"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center py-2.5 gap-0.5 hover:bg-primary/80 active:scale-95 transition-all"
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] font-medium">Direction</span>
        </a>
      </div>
    </div>
  );
};

export default FloatingActionBar;

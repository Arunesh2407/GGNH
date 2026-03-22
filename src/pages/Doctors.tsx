import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";
import { ArrowRight } from "lucide-react";

const doctors = [
  {
    name: "Dr. Vikas Gupta",
    qualification: "MBBS, MS (Ortho)",
    specialization: "Orthopaedics",
    image: "/images/consultants/dr-vikas-gupta.jpg",
    description:
      "Orthopaedic surgery facility specializing in joint replacement, arthroscopy, and trauma care.",
    procedures: [
      "ACL/PCL Reconstruction Surgery",
      "Hand Surgery",
      "All Types of Trauma",
      "Knee Replacement Surgery",
      "Shoulder Replacement Surgery",
      "Hip Replacement Surgery",
      "Knee Arthroscopy",
      "Shoulder Arthroscopy",
      "Ankle Repair",
      "Spinal Surgeries",
      "Joint Fusion",
      "Fracture Fixation With Implants",
    ],
  },
  {
    name: "Dr. Shefali Gupta",
    qualification: "MBBS, MS (Ophtho)",
    specialization: "Ophthalmology",
    image: "/images/consultants/dr-shefali-gupta.jpg",
    description:
      "Ophthalmic surgery facility covering cataract, glaucoma, laser, and corneal procedures.",
    procedures: [
      "Laser Eye Surgery",
      "Cataract Surgery",
      "Glaucoma Surgery",
      "Refractive Surgery",
      "Corneal Surgery",
      "Vitreoretinal Surgery",
      "Eye Muscle Surgery",
      "Trauma Repair",
      "Oculoplastic Surgery",
      "Eyelid Surgery",
      "Entropion Repair",
      "Ectropion Repair",
    ],
  },
  {
    name: "Consultant Physician",
    qualification: "MD (Medicine)",
    specialization: "General Medicine",
    image: null,
    description:
      "Medical/conservative treatment facility for all types of fevers, infections, diabetes, hypertension, and critical care.",
    procedures: [
      "Complicated Malaria",
      "All Types of Fever",
      "Diabetic Ketoacidosis / Diabetes",
      "Common & Severe Infections",
      "Abdominal Pain",
      "High Blood Pressure",
      "Severe Sepsis",
      "Dengue Fever",
      "Acute Gastroenteritis",
      "Viral & Chronic Hepatitis",
      "Bronchiectasis",
      "Seizures",
      "Pneumothorax",
    ],
  },
];

const Doctors = () => {
  return (
    <div className="min-h-screen">
      {/* Hero banner */}
      <section
        className="relative pt-32 pb-16 md:pt-40 md:pb-20"
        style={{ background: "var(--hero-gradient)" }}
      >
        <div className="container mx-auto px-4 relative z-10">
          <ScrollReveal>
            <h1 className="heading-display text-4xl md:text-5xl font-bold text-white mb-3">
              Our <span className="text-accent">Doctors</span>
            </h1>
            <p className="text-white/80 text-lg max-w-xl">
              Experienced specialists delivering trusted care at G G Nursing
              Home.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Doctors */}
      <section className="section-padding">
        <div className="container mx-auto px-4">
          <div className="space-y-8">
            {doctors.map((doc, i) => (
              <ScrollReveal key={doc.name} delay={i * 100}>
                <div className="bg-card rounded-xl shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow duration-300 overflow-hidden">
                  <div className="grid md:grid-cols-[280px_1fr] gap-0">
                    {/* Photo */}
                    <div className="bg-primary/5 flex items-center justify-center p-8 md:p-0">
                      {doc.image ? (
                        <img
                          src={doc.image}
                          alt={doc.name}
                          className="w-48 h-48 md:w-full md:h-full object-cover rounded-xl md:rounded-none"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-48 h-48 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-bold text-4xl">
                            {doc.name
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-6 md:p-8">
                      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                        <div>
                          <h2 className="heading-display text-xl md:text-2xl font-bold text-foreground">
                            {doc.name}
                          </h2>
                          <p className="text-primary font-medium">
                            {doc.specialization}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {doc.qualification}
                          </p>
                        </div>
                        <Link to="/contact">
                          <Button
                            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                            size="sm"
                          >
                            Book Appointment
                          </Button>
                        </Link>
                      </div>

                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {doc.description}
                      </p>

                      <h4 className="text-sm font-semibold text-foreground mb-2">
                        Procedures & Treatments
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {doc.procedures.map((proc) => (
                          <span
                            key={proc}
                            className="text-xs bg-primary/5 text-primary border border-primary/15 px-2 py-1 rounded-full font-medium"
                          >
                            {proc}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
      <div className="h-14 lg:hidden" />
    </div>
  );
};

export default Doctors;

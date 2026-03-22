import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";
import { ArrowRight, Stethoscope, Scissors, Bone, Eye, FlaskConical, Syringe, ScanLine, Brain } from "lucide-react";

const services = [
  {
    id: "general-medicine",
    icon: Stethoscope,
    name: "General Medicine",
    description: "Comprehensive non-surgical management for acute and chronic medical conditions, including infections, metabolic disorders, respiratory illnesses, and critical care emergencies.",
    procedures: [
      "Complicated Malaria", "All Types of Fever", "Diabetes & Diabetic Ketoacidosis",
      "Common & Severe Infections", "High Blood Pressure", "Severe Sepsis",
      "Dengue Fever", "Acute Gastroenteritis", "Viral & Chronic Hepatitis",
      "Bronchiectasis", "Chronic Pancreatitis", "Seizures", "Pneumothorax",
    ],
  },
  {
    id: "general-surgery",
    icon: Scissors,
    name: "General Surgery",
    description: "Comprehensive surgical care using both traditional and minimally invasive techniques with a focus on safety, faster recovery, and optimal outcomes.",
    procedures: [
      "Appendectomy", "Cholecystectomy", "Hernia Repair", "Breast Biopsy",
      "Lumpectomy", "Hemorrhoidectomy", "Anti-Reflux Surgery", "Laparoscopy",
      "Colon & Rectal Surgery", "Prostatectomy", "Splenectomy", "Hysterectomy",
    ],
  },
  {
    id: "orthopaedics",
    icon: Bone,
    name: "Orthopaedics",
    description: "Comprehensive care for bones, joints, ligaments, and spine conditions — from trauma and fracture management to advanced joint replacement and minimally invasive arthroscopic procedures.",
    procedures: [
      "ACL/PCL Reconstruction", "Hand Surgery", "Trauma Care", "Knee Replacement",
      "Shoulder Replacement", "Hip Replacement", "Knee Arthroscopy",
      "Shoulder Arthroscopy", "Ankle Repair", "Spinal Surgeries",
      "Joint Fusion", "Fracture Fixation with Implants",
    ],
  },
  {
    id: "ophthalmology",
    icon: Eye,
    name: "Ophthalmology",
    description: "Advanced diagnostic and surgical care for eye disorders, focusing on vision preservation, correction, and restoration using modern surgical and laser techniques.",
    procedures: [
      "Laser Eye Surgery", "Cataract Surgery", "Glaucoma Surgery",
      "Refractive Surgery", "Corneal Surgery", "Vitreoretinal Surgery",
      "Eye Muscle Surgery", "Trauma Repair", "Oculoplastic Surgery",
      "Eyelid Surgery", "Entropion Repair", "Ectropion Repair",
    ],
  },
  {
    id: "pathology",
    icon: FlaskConical,
    name: "Pathology",
    description: "Comprehensive laboratory testing and diagnostic reporting services to support accurate diagnosis and effective treatment planning.",
    procedures: ["Blood Tests", "Urine Analysis", "Biopsy Examination", "Microbiology Tests", "Biochemistry", "Hematology"],
  },
  {
    id: "plastic-surgery",
    icon: Syringe,
    name: "Plastic Surgery",
    description: "Deals with oro-maxillary and cosmetic surgeries, providing reconstructive and aesthetic procedures.",
    procedures: ["Oro-Maxillary Surgery", "Cosmetic Procedures", "Reconstructive Surgery", "Burn Management", "Scar Revision", "Skin Grafting"],
  },
  {
    id: "radiodiagnosis",
    icon: ScanLine,
    name: "Radiodiagnosis",
    description: "X-ray, ultrasound, and imaging services for accurate diagnosis and treatment monitoring.",
    procedures: ["Digital X-Ray", "Ultrasonography", "Doppler Studies", "Contrast Studies", "Portable X-Ray", "Imaging Reports"],
  },
  {
    id: "neurosurgery",
    icon: Brain,
    name: "Neurosurgery",
    description: "Deals with all types of spinal traumas, compressions, and neurological surgical conditions.",
    procedures: ["Spinal Trauma Management", "Spinal Decompression", "Disc Surgery", "Head Injury Management", "Brain Tumor Surgery", "Nerve Repair"],
  },
];

const Services = () => {
  return (
    <div className="min-h-screen">
      {/* Hero banner */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-20" style={{ background: "var(--hero-gradient)" }}>
        <div className="container mx-auto px-4 relative z-10">
          <ScrollReveal>
            <h1 className="heading-display text-4xl md:text-5xl font-bold text-white mb-3">
              Our <span className="text-accent">Departments</span>
            </h1>
            <p className="text-white/80 text-lg max-w-xl">
              8 specialized departments delivering comprehensive medical care.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Services grid */}
      <section className="section-padding">
        <div className="container mx-auto px-4">
          <div className="space-y-6">
            {services.map((service, i) => (
              <ScrollReveal key={service.name} delay={i * 50}>
                <div id={service.id} className="scroll-mt-32 bg-card rounded-xl shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow duration-300 overflow-hidden border-l-4 border-primary">
                  <div className="p-6 md:p-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <service.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="heading-display text-xl md:text-2xl font-bold text-foreground">
                          {service.name}
                        </h2>
                        <p className="text-muted-foreground leading-relaxed mt-1 max-w-2xl">
                          {service.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-0 md:ml-16">
                      {service.procedures.map((proc) => (
                        <span key={proc} className="text-xs bg-primary/5 text-primary border border-primary/15 px-2.5 py-1 rounded-full font-medium">
                          {proc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding-sm" style={{ background: "var(--hero-gradient)" }}>
        <div className="container mx-auto px-4 text-center text-white">
          <ScrollReveal>
            <h2 className="heading-display text-2xl md:text-3xl font-bold mb-4">Need Expert Care?</h2>
            <Link to="/contact">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
                Book Appointment <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </ScrollReveal>
        </div>
      </section>
      <div className="h-14 lg:hidden" />
    </div>
  );
};

export default Services;

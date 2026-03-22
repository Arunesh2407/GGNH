import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";
import {
  Phone,
  ArrowRight,
  Stethoscope,
  Eye,
  Bone,
  Syringe,
  FlaskConical,
  Brain,
  ScanLine,
  Scissors,
  Shield,
  Bed,
  Clock,
  Award,
  Play,
  CheckCircle,
  ClipboardList,
  UserCheck,
  HeartPulse,
  Users,
} from "lucide-react";

const departments = [
  {
    icon: Stethoscope,
    name: "General Medicine",
    desc: "Diagnosis and medical treatment for adults.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Scissors,
    name: "General Surgery",
    desc: "Common surgical procedures and consultations.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Bone,
    name: "Orthopaedics",
    desc: "Bone, joint, and spine care.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Eye,
    name: "Ophthalmology",
    desc: "Eye checkups, vision care, and procedures.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: FlaskConical,
    name: "Pathology",
    desc: "Lab tests and diagnostic reporting.",
    color: "bg-rose-50 text-rose-600",
  },
  {
    icon: Syringe,
    name: "Plastic Surgery",
    desc: "Oro-maxillary and cosmetic surgeries.",
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    icon: ScanLine,
    name: "Radiodiagnosis",
    desc: "X-ray, ultrasound, and imaging services.",
    color: "bg-orange-50 text-orange-600",
  },
  {
    icon: Brain,
    name: "Neurosurgery",
    desc: "Spinal traumas and compressions.",
    color: "bg-pink-50 text-pink-600",
  },
];

const doctors = [
  {
    name: "Dr. Vikas Gupta",
    qualification: "MBBS, MS (Ortho)",
    specialization: "Orthopaedics",
    image: "/images/consultants/dr-vikas-gupta.jpg",
  },
  {
    name: "Dr. Shefali Gupta",
    qualification: "MBBS, MS (Ophtho)",
    specialization: "Ophthalmology",
    image: "/images/consultants/dr-shefali-gupta.jpg",
  },
];

const stats = [
  { value: "50+", label: "Hospital Beds", icon: Bed },
  { value: "20+", label: "Years of Excellence", icon: Award },
  { value: "6", label: "Bedded ICU", icon: HeartPulse },
  { value: "8", label: "Departments", icon: Users },
];

const processSteps = [
  {
    num: 1,
    title: "Book Your Appointment",
    desc: "Schedule a visit online or call us directly.",
    icon: ClipboardList,
  },
  {
    num: 2,
    title: "Consult Our Specialist",
    desc: "Meet experienced doctors for diagnosis.",
    icon: UserCheck,
  },
  {
    num: 3,
    title: "Get Your Treatment",
    desc: "Receive personalized care and treatment.",
    icon: HeartPulse,
  },
  {
    num: 4,
    title: "Recovery & Follow-up",
    desc: "We ensure complete recovery with follow-ups.",
    icon: CheckCircle,
  },
];

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section - Full screen with video placeholder */}
      <section
        className="relative min-h-screen flex items-center"
        style={{ background: "var(--hero-gradient)" }}
      >
        <div className="absolute inset-0">
          <img
            src="/images/hospital-1.jpg"
            alt="G G Nursing Home"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-transparent" />
        </div>

        {/* Video play placeholder */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          {/* placeholder for future video */}
        </div>

        <div className="container mx-auto px-4 relative z-10 pt-36 pb-24">
          <div className="max-w-2xl">
            <ScrollReveal>
              <h1 className="heading-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.05]">
                The Best Multi Speciality Hospital.{" "}
                <span className="text-accent">G G Nursing Home</span> in Katni
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="mt-6 text-lg md:text-xl text-white/80 max-w-xl leading-relaxed">
                NABH Pre-accredited • 50 Bedded Hospital • Serving for 20+ Years
                with compassionate, evidence-based medical care.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={300}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/contact">
                  <Button
                    size="lg"
                    className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base px-7 h-12"
                  >
                    Book Appointment <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <a href="tel:07622229250">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-orange-500 text-orange-500 hover:bg-orange-500/10 h-12 px-6"
                  >
                    <Phone className="w-4 h-4 mr-2" /> 07622-229250
                  </Button>
                </a>
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* Video placeholder button overlay */}
        <div className="absolute right-8 lg:right-24 top-1/2 -translate-y-1/2 hidden lg:flex">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors group">
            <Play className="w-8 h-8 text-white ml-1 group-hover:scale-110 transition-transform" />
          </div>
        </div>
      </section>

      {/* Centres of Excellence / Departments */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4">
          <SectionHeading
            label="8 Departments of Excellence"
            title={
              <>
                Departments of Excellence at{" "}
                <span className="text-accent">G G Nursing Home</span>
              </>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {departments.map((dept, i) => (
              <ScrollReveal key={dept.name} delay={i * 70}>
                <Link to="/services">
                  <div className="group bg-card rounded-xl overflow-hidden shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all duration-300 cursor-pointer h-full active:scale-[0.97]">
                    <div className="h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative overflow-hidden">
                      <dept.icon className="w-16 h-16 text-primary/30 group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute bottom-3 left-3 w-10 h-10 rounded-lg bg-card shadow-md flex items-center justify-center">
                        <dept.icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                        {dept.name}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {dept.desc}
                      </p>
                      <span className="inline-flex items-center gap-1 text-sm text-primary font-medium mt-3 group-hover:gap-2 transition-all">
                        Details <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/services">
              <Button variant="outline" size="lg" className="font-semibold">
                View All 8 Departments <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section with Stats Ticker */}
      <section className="section-padding">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <ScrollReveal>
              <div>
                <span className="text-sm font-semibold text-primary tracking-wide uppercase">
                  About G G Nursing Home
                </span>
                <h2 className="heading-display text-3xl md:text-4xl font-bold text-foreground mt-2 mb-2">
                  <span className="text-accent">20+</span> Golden Years of
                  Excellence in Healthcare
                </h2>
                <div className="rounded-2xl overflow-hidden shadow-[var(--card-shadow-hover)] mt-6">
                  <img
                    src="/images/hospital-1.jpg"
                    alt="G G Nursing Home Building"
                    className="w-full h-72 object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={150}>
              <p className="text-muted-foreground leading-relaxed mb-4">
                G G Nursing Home (Unit of G G Nursing Home Pvt. Ltd) is situated
                at Madan Mohan Choubey Ward, Bargawan, Katni (M.P). It is NABH
                Pre-accredited and a 50 Bedded hospital including 6 Bedded ICU,
                Private Deluxe wards and general wards with all modern
                facilities.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Registered for NPCBVI, Ayushman Bharat (AB-PMJAY), ESIC, Railway
                Hospital, and many TPA companies. Serving the community of Katni
                and surrounding districts for over 20 years.
              </p>
              <Link to="/about">
                <Button variant="outline" className="font-semibold">
                  The G G Story <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Scrolling Stats Ticker */}
      <section className="bg-primary py-5 overflow-hidden">
        <div className="ticker-scroll flex gap-12 whitespace-nowrap">
          {[...stats, ...stats, ...stats].map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-primary-foreground"
            >
              <stat.icon className="w-5 h-5 text-accent" />
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-sm text-primary-foreground/80">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Counter Stats */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                value: "50+",
                label: "Hospital Beds",
                desc: "Including ICU, Deluxe & General wards",
              },
              {
                value: "20+",
                label: "Years of Service",
                desc: "Trusted healthcare since 2004",
              },
              {
                value: "8",
                label: "Departments",
                desc: "Comprehensive medical specialties",
              },
              {
                value: "24×7",
                label: "Emergency Care",
                desc: "Round-the-clock trauma services",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 100}>
                <div className="text-center p-6">
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                    {item.value}
                  </div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">
                    {item.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Healthcare Process Steps */}
      <section className="section-padding">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-4">
              <span className="text-sm font-semibold text-accent tracking-wide uppercase">
                Your Health Care Process
              </span>
            </div>
          </ScrollReveal>
          <SectionHeading
            title={
              <>
                We Work to Achieve{" "}
                <span className="text-accent">Better Health</span> Outcomes One
                Step at a Time
              </>
            }
            description="We will work with you to develop individualised care plans, including management of chronic diseases."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            {processSteps.map((step, i) => (
              <ScrollReveal key={step.num} delay={i * 120}>
                <div className="relative group">
                  <div className="bg-card rounded-xl p-6 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all duration-300 h-full text-center">
                    <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold group-hover:bg-accent transition-colors duration-300">
                      {step.num}
                    </div>
                    <h3 className="font-semibold text-foreground mb-2 leading-snug">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Doctors */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4">
          <SectionHeading
            label="Our Consultants"
            title="Experienced Specialists"
            description="Expert doctors delivering trusted care at G G Nursing Home"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {doctors.map((doc, i) => (
              <ScrollReveal key={doc.name} delay={i * 120}>
                <div className="bg-card rounded-xl overflow-hidden shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all duration-300 group">
                  <div className="h-64 overflow-hidden">
                    <img
                      src={doc.image}
                      alt={doc.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5 text-center">
                    <h3 className="font-semibold text-lg text-foreground">
                      {doc.name}
                    </h3>
                    <p className="text-sm text-primary font-medium">
                      {doc.specialization}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {doc.qualification}
                    </p>
                    <Link
                      to={`/contact?doctor=${encodeURIComponent(doc.name)}`}
                      className="block mt-4"
                    >
                      <Button
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                        size="sm"
                      >
                        Book Appointment
                      </Button>
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/doctors">
              <Button variant="outline" size="lg" className="font-semibold">
                View All Doctors <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Emergency CTA */}
      <section
        className="section-padding-sm"
        style={{ background: "var(--hero-gradient)" }}
      >
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center text-white">
              <h2 className="heading-display text-2xl md:text-3xl font-bold mb-3">
                24×7 Emergency & Trauma Care
              </h2>
              <p className="text-white/80 mb-6 max-w-lg mx-auto">
                Our emergency department is always ready to provide immediate
                medical attention.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a href="tel:07622229250">
                  <Button
                    size="lg"
                    className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
                  >
                    <Phone className="w-4 h-4 mr-2" /> Call Now: 07622-229250
                  </Button>
                </a>
                <Link to="/contact">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-orange-500 text-orange-500 hover:bg-orange-500/10 h-12 px-6"
                  >
                    Request Appointment
                  </Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Bottom spacing for mobile action bar */}
      <div className="h-14 lg:hidden" />
    </div>
  );
};

export default Index;

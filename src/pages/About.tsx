import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ScrollReveal from "@/components/ScrollReveal";
import SectionHeading from "@/components/SectionHeading";
import {
  Bed,
  Shield,
  Clock,
  Users,
  Target,
  Heart,
  ArrowRight,
  Award,
  CheckCircle,
} from "lucide-react";

const About = () => {
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
              About <span className="text-accent">G G Nursing Home</span>
            </h1>
            <p className="text-white/80 text-lg max-w-xl">
              20+ years of trusted healthcare services in Katni, Madhya Pradesh.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Main about */}
      <section className="section-padding">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <ScrollReveal>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl overflow-hidden shadow-[var(--card-shadow-hover)]">
                  <img
                    src="/images/hospital-1.jpg"
                    alt="G G Nursing Home Building"
                    className="w-full h-52 object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="rounded-xl overflow-hidden shadow-[var(--card-shadow-hover)] mt-8">
                  <img
                    src="/images/hospital-2.jpg"
                    alt="G G Nursing Home"
                    className="w-full h-52 object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <span className="text-sm font-semibold text-primary tracking-wide uppercase">
                Who We Are
              </span>
              <h2 className="heading-display text-3xl font-bold text-foreground mt-2 mb-4">
                Serving Katni with{" "}
                <span className="text-accent">Compassionate Care</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                G G Nursing Home (Unit of G G Nursing Home Pvt. Ltd) is situated
                at Madan Mohan Choubey Ward, Bargawan, Katni (M.P) and has been
                authorized the Allopathy system of medicine. G.G. Nursing Home
                is NABH Pre-accredited and a 50 Bedded hospital (including 6
                Bedded ICU, Private Deluxe wards and general wards with all
                facilities).
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Departments include Orthopaedics, Ophthalmology, General
                Medicine, General Surgery, Pathology, Physiotherapy and
                Radiology. The hospital has been providing services for the last
                20 years.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Registered for NPCBVI (National Programme For Control Of
                Blindness & Visual Impairment), Ayushman Bharat – Jan Arogya
                Yojna (AB-PMJAY), Employees' State Insurance Corporation (ESIC),
                Railway Hospital, and many TPA companies.
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  "NABH Pre-accredited",
                  "Ayushman Bharat",
                  "ESIC",
                  "Railway Hospital",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-full"
                  >
                    <CheckCircle className="w-3 h-3" /> {tag}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4">
          <SectionHeading
            label="Infrastructure"
            title={
              <>
                World-Class <span className="text-accent">Facilities</span>
              </>
            }
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Bed,
                title: "50 Beds",
                desc: "General, Deluxe & ICU wards",
              },
              {
                icon: Shield,
                title: "6 Bed ICU",
                desc: "Advanced monitoring equipment",
              },
              {
                icon: Clock,
                title: "24×7 Emergency",
                desc: "Round-the-clock trauma care",
              },
              {
                icon: Users,
                title: "Modern OT",
                desc: "Fully equipped operation theatres",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 80}>
                <div className="bg-card rounded-xl p-6 text-center shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow duration-300 h-full">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="section-padding">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            <ScrollReveal>
              <div className="bg-card rounded-xl p-8 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow h-full border-t-4 border-primary">
                <Target className="w-8 h-8 text-primary mb-4" />
                <h3 className="heading-display text-2xl font-bold text-foreground mb-4">
                  Our Mission
                </h3>
                <blockquote className="border-l-4 border-accent pl-4 text-muted-foreground italic leading-relaxed">
                  "Faithful to our tradition, we provide the highest possible
                  standard of care and treatment in a professional and
                  compassionate manner to every person who avails of our
                  services"
                </blockquote>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className="bg-card rounded-xl p-8 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow h-full border-t-4 border-accent">
                <Heart className="w-8 h-8 text-accent mb-4" />
                <h3 className="heading-display text-2xl font-bold text-foreground mb-4">
                  Vision & Values
                </h3>
                <ul className="space-y-3 text-muted-foreground text-sm leading-relaxed">
                  {[
                    "Build a first class patient focused service based on high quality and evidence based practice.",
                    "Provide services as close to the patient as possible, in a well-managed environment.",
                    "Promote a culture that ensures high quality care is provided.",
                    "Ensure decisions regarding delivery of care are patient focused and evidence based.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="section-padding-sm"
        style={{ background: "var(--hero-gradient)" }}
      >
        <div className="container mx-auto px-4 text-center text-white">
          <ScrollReveal>
            <h2 className="heading-display text-2xl md:text-3xl font-bold mb-4">
              Need a Consultation?
            </h2>
            <Link to="/contact">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
              >
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

export default About;

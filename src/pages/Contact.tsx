import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ScrollReveal from "@/components/ScrollReveal";
import { Phone, Mail, MapPin, Clock, Send, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", department: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setSending(true);
    setTimeout(() => {
      toast({ title: "Message Sent!", description: "We will get back to you shortly." });
      setForm({ name: "", email: "", phone: "", department: "", message: "" });
      setSending(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen">
      {/* Hero banner */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-20" style={{ background: "var(--hero-gradient)" }}>
        <div className="container mx-auto px-4 relative z-10">
          <ScrollReveal>
            <h1 className="heading-display text-4xl md:text-5xl font-bold text-white mb-3">
              Contact <span className="text-accent">Us</span>
            </h1>
            <p className="text-white/80 text-lg max-w-xl">
              Book an appointment or reach out for any queries.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-10">
            {/* Contact Info - Left */}
            <div className="lg:col-span-2">
              <ScrollReveal>
                <h2 className="heading-display text-2xl font-bold text-foreground mb-6">
                  Contact <span className="text-accent">G G Nursing Home</span>
                </h2>
                <div className="space-y-4">
                  {[
                    { icon: MapPin, label: "Address", value: "Madan Mohan Choubey Ward, Bargawan, Katni (M.P) – 483501" },
                    { icon: Phone, label: "Phone", value: "07622-229250", href: "tel:07622229250" },
                    { icon: Mail, label: "Email", value: "ggnhkatni@gmail.com", href: "mailto:ggnhkatni@gmail.com" },
                    { icon: Clock, label: "Emergency", value: "24×7 Emergency & Trauma Care Available" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-4 p-4 bg-card rounded-xl shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground text-sm">{item.label}</h4>
                        {item.href ? (
                          <a href={item.href} className="text-muted-foreground text-sm hover:text-primary transition-colors">
                            {item.value}
                          </a>
                        ) : (
                          <p className="text-muted-foreground text-sm">{item.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Map */}
                <div className="rounded-xl overflow-hidden shadow-[var(--card-shadow)] h-64 mt-6">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3648.8!2d80.4!3d23.83!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sKatni%2C+Madhya+Pradesh!5e0!3m2!1sen!2sin!4v1600000000000"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="G G Nursing Home Location"
                  />
                </div>
              </ScrollReveal>
            </div>

            {/* Form - Right */}
            <div className="lg:col-span-3">
              <ScrollReveal delay={150}>
                <div className="bg-card rounded-xl p-6 md:p-8 shadow-[var(--card-shadow)] border-t-4 border-primary">
                  <h3 className="heading-display text-xl font-bold text-foreground mb-2">
                    Book an Appointment
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">Fill the form below and our team will reach out to confirm your appointment.</p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Full Name *</label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" maxLength={100} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Phone *</label>
                        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" maxLength={15} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" maxLength={255} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Department</label>
                        <select
                          value={form.department}
                          onChange={(e) => setForm({ ...form, department: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Select Department</option>
                          <option>General Medicine</option>
                          <option>General Surgery</option>
                          <option>Orthopaedics</option>
                          <option>Ophthalmology</option>
                          <option>Pathology</option>
                          <option>Plastic Surgery</option>
                          <option>Radiodiagnosis</option>
                          <option>Neurosurgery</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Message *</label>
                      <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Describe your concern or preferred appointment time..." rows={4} maxLength={1000} />
                    </div>
                    <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-11" disabled={sending}>
                      {sending ? "Sending..." : <><Send className="w-4 h-4 mr-2" /> Send Message</>}
                    </Button>
                  </form>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>
      <div className="h-14 lg:hidden" />
    </div>
  );
};

export default Contact;

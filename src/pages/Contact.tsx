import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ScrollReveal from "@/components/ScrollReveal";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { appointmentService, generateUuid } from "@/services/appointmentService";
import { ApiError } from "@/services/apiClient";

const DOCTOR_OPTIONS = [
  "Dr. Vikas Gupta",
  "Dr. Shefali Gupta",
  "Consultant Physician",
  "Don't know",
];

const TIME_SLOTS = [
  "09:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 01:00 PM",
  "02:00 PM - 03:00 PM",
  "03:00 PM - 04:00 PM",
  "05:00 PM - 06:00 PM",
  "06:00 PM - 07:00 PM",
];

const Contact = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    doctor: "",
    appointmentDate: "",
    timeSlot: "",
    message: "",
  });
  const [sending, setSending] = useState(false);

  // Idempotency tracking refs: preserve key across retries of identical payload;
  // generate a new key if fields change or on a fresh submission.
  const currentIdempotencyKeyRef = useRef<string | null>(null);
  const lastSubmittedPayloadRef = useRef<string | null>(null);

  useEffect(() => {
    const doctorFromQuery = searchParams.get("doctor");
    if (doctorFromQuery && DOCTOR_OPTIONS.includes(doctorFromQuery)) {
      setForm((prev) => ({ ...prev, doctor: doctorFromQuery }));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) {
      return;
    }

    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    const trimmedEmail = form.email.trim().toLowerCase();
    const trimmedDoctor = form.doctor.trim();
    const trimmedMessage = form.message.trim();

    if (!trimmedName || !trimmedPhone) {
      toast({
        title: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    // Build payload signature to distinguish retries from edits
    const payloadSignature = JSON.stringify({
      name: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
      doctor: trimmedDoctor,
      appointmentDate: form.appointmentDate || undefined,
      timeSlot: form.timeSlot || undefined,
      message: trimmedMessage,
    });

    // If payload is unchanged from previous failed attempt, reuse the existing idempotency key.
    // If fields were modified or this is a new submission, generate a new UUID.
    if (
      !currentIdempotencyKeyRef.current ||
      lastSubmittedPayloadRef.current !== payloadSignature
    ) {
      currentIdempotencyKeyRef.current = generateUuid();
      lastSubmittedPayloadRef.current = payloadSignature;
    }

    const idempotencyKey = currentIdempotencyKeyRef.current;
    setSending(true);

    try {
      const inputObj: {
        name: string;
        phone: string;
        email?: string;
        doctor?: string;
        appointmentDate?: string;
        timeSlot?: string;
        message?: string;
      } = {
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail || undefined,
        doctor: trimmedDoctor || undefined,
        message: trimmedMessage || undefined,
      };
      if (form.appointmentDate) inputObj.appointmentDate = form.appointmentDate;
      if (form.timeSlot) inputObj.timeSlot = form.timeSlot;

      await appointmentService.addAppointment(
        inputObj,
        idempotencyKey
      );

      // On successful submission, clear tracking so next submission gets a fresh key
      currentIdempotencyKeyRef.current = null;
      lastSubmittedPayloadRef.current = null;

      toast({
        title: "Appointment Request Sent!",
        description: "You will recieve a call within 24 hours",
      });

      setForm({
        name: "",
        email: "",
        phone: "",
        doctor: "",
        appointmentDate: "",
        timeSlot: "",
        message: "",
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          toast({
            title: "Invalid appointment details",
            description:
              err.message || "Please check your information and try again.",
            variant: "destructive",
          });
        } else if (err.status === 409) {
          toast({
            title: "Appointment in progress",
            description:
              "This appointment request has already been submitted or is being processed.",
          });
        } else if (err.status === 429) {
          toast({
            title: "Too many requests",
            description:
              "Please wait a moment before trying to submit another appointment.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Unable to send appointment",
            description: "Please try again or call 07622-229250.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Unable to send appointment",
          description: "Please try again or call 07622-229250.",
          variant: "destructive",
        });
      }
    } finally {
      setSending(false);
    }
  };

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
                    {
                      icon: MapPin,
                      label: "Address",
                      value:
                        "Madan Mohan Choubey Ward, Bargawan, Katni (M.P) – 483501",
                    },
                    {
                      icon: Phone,
                      label: "Phone",
                      value: "07622-229250",
                      href: "tel:07622229250",
                    },
                    {
                      icon: Mail,
                      label: "Email",
                      value: "ggnhkatni@gmail.com",
                      href: "mailto:ggnhkatni@gmail.com",
                    },
                    {
                      icon: Clock,
                      label: "Emergency",
                      value: "24×7 Emergency & Trauma Care Available",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start gap-4 p-4 bg-card rounded-xl shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground text-sm">
                          {item.label}
                        </h4>
                        {item.href ? (
                          <a
                            href={item.href}
                            className="text-muted-foreground text-sm hover:text-primary transition-colors"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            {item.value}
                          </p>
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
                  <p className="text-sm text-muted-foreground mb-6">
                    Fill the form below and our team will reach out to confirm
                    your appointment.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          Full Name *
                        </label>
                        <Input
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          placeholder="Your full name"
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          Phone *
                        </label>
                        <Input
                          value={form.phone}
                          onChange={(e) =>
                            setForm({ ...form, phone: e.target.value })
                          }
                          placeholder="+91 XXXXX XXXXX"
                          maxLength={15}
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          Email
                        </label>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
                          placeholder="your@email.com"
                          maxLength={255}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          Doctor
                        </label>
                        <select
                          value={form.doctor}
                          onChange={(e) =>
                            setForm({ ...form, doctor: e.target.value })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Select Doctor</option>
                          {DOCTOR_OPTIONS.map((doctor) => (
                            <option key={doctor}>{doctor}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          Preferred Date
                        </label>
                        <Input
                          type="date"
                          value={form.appointmentDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) =>
                            setForm({ ...form, appointmentDate: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          Preferred Time Slot
                        </label>
                        <Input
                          placeholder="e.g. 10:00 AM - 11:00 AM"
                          value={form.timeSlot}
                          onChange={(e) =>
                            setForm({ ...form, timeSlot: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">
                        Message
                      </label>
                      <Textarea
                        value={form.message}
                        onChange={(e) =>
                          setForm({ ...form, message: e.target.value })
                        }
                        placeholder="Describe your concern or preferred appointment time..."
                        rows={4}
                        maxLength={1000}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-11"
                      disabled={sending}
                    >
                      {sending ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" /> Send Message
                        </>
                      )}
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

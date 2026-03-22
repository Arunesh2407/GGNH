import { ReactNode } from "react";
import ScrollReveal from "./ScrollReveal";

interface SectionHeadingProps {
  label?: string;
  title: ReactNode;
  description?: string;
  centered?: boolean;
}

const SectionHeading = ({ label, title, description, centered = true }: SectionHeadingProps) => {
  return (
    <ScrollReveal className={`mb-12 ${centered ? "text-center" : ""}`}>
      {label && (
        <span className="text-sm font-semibold text-primary tracking-wide uppercase">
          {label}
        </span>
      )}
      <h2 className="heading-display text-3xl md:text-4xl font-bold text-foreground mt-2 leading-[1.15]">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
          {description}
        </p>
      )}
    </ScrollReveal>
  );
};

export default SectionHeading;

"use client";

/**
 * Presentational only, but must stay a Client Component: several marketing views that import
 * `Section` are client modules (`PlatformEnterpriseView`, vertical marketing views, etc.).
 * Next.js forbids importing a Server Component from a Client Component.
 */
import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
}

export function Section({ children, className, id, "aria-labelledby": ariaLabelledBy }: SectionProps) {
  return (
    <section id={id} aria-labelledby={ariaLabelledBy} className={cn("mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24", className)}>
      {children}
    </section>
  );
}

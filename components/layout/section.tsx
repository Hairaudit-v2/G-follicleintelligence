"use client";

import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
}

export function Section({ children, className }: SectionProps) {
  return (
    <section className={cn("mx-auto max-w-6xl px-6 py-16 md:py-20", className)}>
      {children}
    </section>
  );
}

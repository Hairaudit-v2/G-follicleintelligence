import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { NetworkCard } from "./Card";

export type NetworkTestimonialCardProps = {
  quote: ReactNode;
  attribution: ReactNode;
  role?: ReactNode;
  logo?: ReactNode;
  className?: string;
};

export function NetworkTestimonialCard({ quote, attribution, role, logo, className }: NetworkTestimonialCardProps) {
  return (
    <NetworkCard variant="glass" className={cn(className)}>
      {logo ? <div className="mb-5 text-muted-foreground">{logo}</div> : null}
      <blockquote className="font-display text-lg font-medium leading-relaxed text-foreground sm:text-xl">{quote}</blockquote>
      <footer className="mt-6 border-t border-white/[0.06] pt-4 text-sm">
        <div className="font-semibold text-foreground">{attribution}</div>
        {role ? <div className="mt-1 text-muted-foreground">{role}</div> : null}
      </footer>
    </NetworkCard>
  );
}

"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type EcosystemSite = "hli" | "hairaudit" | "follicleintelligence";

const ECOSYSTEM_LINKS: { id: EcosystemSite; label: string; href: string }[] = [
  { id: "hli", label: "Hair Longevity Institute", href: "https://hairlongevityinstitute.com" },
  { id: "hairaudit", label: "HairAudit", href: "https://hairaudit.com" },
  {
    id: "follicleintelligence",
    label: "Follicle Intelligence",
    href: "https://www.follicleintelligence.ai",
  },
];

export interface HairEcosystemNavProps {
  /** Which site is currently active for active-state styling */
  currentSite?: EcosystemSite;
  className?: string;
}

export function HairEcosystemNav({ currentSite, className }: HairEcosystemNavProps) {
  return (
    <nav
      aria-label="Hair Intelligence Ecosystem"
      className={cn(
        "border-b border-border/40 bg-background/70 backdrop-blur-sm",
        "flex items-center justify-between gap-4 overflow-x-auto px-4 py-2 md:px-6",
        className
      )}
    >
      <span
        className="min-w-0 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/90"
        aria-hidden
      >
        Part of the Hair Intelligence Ecosystem
      </span>
      <div className="flex min-w-0 flex-1 justify-end gap-1 overflow-x-auto md:gap-2 md:flex-initial">
        {ECOSYSTEM_LINKS.map((item) => {
          const isCurrent = currentSite === item.id;
          const isExternal = !isCurrent;

          return (
            <Link
              key={item.id}
              href={item.href}
              {...(isExternal && {
                target: "_blank",
                rel: "noopener noreferrer",
              })}
              className={cn(
                "whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                isCurrent
                  ? "text-foreground/95 underline decoration-primary/60 decoration-2 underline-offset-2"
                  : "text-muted-foreground hover:text-foreground/80"
              )}
              aria-current={isCurrent ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

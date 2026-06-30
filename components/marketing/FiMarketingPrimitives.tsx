import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const sectionHeadingToneStyles = {
  default: {
    eyebrow: "text-amber-200/75",
    rule: "from-amber-300/70 via-amber-400/25",
  },
  audit: {
    eyebrow: "text-cyan-200/72",
    rule: "from-cyan-300/55 via-cyan-400/18",
  },
  intelligence: {
    eyebrow: "text-violet-200/72",
    rule: "from-violet-300/55 via-fuchsia-400/22",
  },
} as const;

export type SectionHeadingTone = keyof typeof sectionHeadingToneStyles;

export function SectionHeading({
  id,
  title,
  description,
  eyebrow,
  tone = "default",
}: {
  id: string;
  title: string;
  description?: string;
  eyebrow?: string;
  tone?: SectionHeadingTone;
}) {
  const toneClass = sectionHeadingToneStyles[tone];
  return (
    <header className="max-w-4xl">
      {eyebrow ? (
        <div>
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.26em]",
              toneClass.eyebrow
            )}
          >
            {eyebrow}
          </p>
          <div
            className={cn("mt-3 h-px w-14 bg-gradient-to-r to-transparent", toneClass.rule)}
            aria-hidden
          />
        </div>
      ) : null}
      <h2
        id={id}
        className={cn(
          "max-w-[52rem] font-display font-semibold tracking-tight text-foreground text-balance",
          eyebrow
            ? "mt-5 text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
            : "text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-5 max-w-3xl text-base leading-[1.65] text-muted-foreground sm:text-lg md:leading-relaxed">
          {description}
        </p>
      ) : null}
    </header>
  );
}

const glassVariants = {
  default:
    "border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-white/[0.015] shadow-[0_20px_56px_rgb(0_0_0_/0.4),inset_0_1px_0_rgb(255_255_255_/0.06)] hover:border-white/[0.12]",
  os: "border-white/[0.06] bg-gradient-to-b from-white/[0.11] via-white/[0.04] to-[rgb(4_8_14_/0.55)] shadow-[0_20px_56px_rgb(0_0_0_/0.45),inset_0_1px_0_rgb(255_255_255_/0.08)] ring-1 ring-inset ring-white/[0.05] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/25 hover:shadow-[0_26px_72px_rgb(212_175_55_/0.1),inset_0_1px_0_rgb(255_255_255_/0.09)]",
  problem:
    "border-amber-400/[0.09] bg-gradient-to-br from-white/[0.06] to-amber-950/[0.08] shadow-[0_16px_48px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] hover:border-amber-400/18",
} as const;

export type GlassVariant = keyof typeof glassVariants;

export function GlassCard({
  className,
  children,
  variant = "default",
}: {
  className?: string;
  children: ReactNode;
  variant?: GlassVariant;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.35rem] border p-5 backdrop-blur-md sm:p-6",
        glassVariants[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

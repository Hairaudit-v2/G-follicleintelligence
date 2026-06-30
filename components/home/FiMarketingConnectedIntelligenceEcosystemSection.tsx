"use client";

import { motion, useReducedMotion } from "framer-motion";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";
import { cn } from "@/lib/utils";

const c = HOME_PAGE_CONTENT.connectedIntelligenceEcosystem;

function EcosystemSystemCard({
  index,
  name,
  label,
  description,
}: {
  index: number;
  name: string;
  label: string;
  description: string;
}) {
  return (
    <GlassCard
      variant="os"
      className="group relative z-10 flex h-full flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/22"
    >
      <div className="flex items-center border-b border-white/[0.07] pb-3">
        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/55">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="ml-auto h-px w-12 bg-gradient-to-r from-amber-400/45 to-transparent"
          aria-hidden
        />
      </div>
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-amber-100/95 transition-colors group-hover:text-amber-50">
        {name}
      </p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/65">
        {label}
      </p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </GlassCard>
  );
}

function ConnectedEcosystemGrid() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mt-12 sm:mt-14">
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.75rem] border border-amber-400/12 p-5 sm:rounded-[2rem] sm:p-8 md:p-10",
          "bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.12),transparent_50%),linear-gradient(180deg,rgb(255_255_255_/0.045),transparent)]",
          "shadow-[0_24px_80px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)]"
        )}
      >
        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full text-primary"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line
            x1="25"
            y1="25"
            x2="75"
            y2="25"
            stroke="rgb(212 175 55 / 0.12)"
            strokeWidth="0.35"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="25"
            y1="75"
            x2="75"
            y2="75"
            stroke="rgb(212 175 55 / 0.12)"
            strokeWidth="0.35"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="25"
            y1="25"
            x2="25"
            y2="75"
            stroke="rgb(212 175 55 / 0.12)"
            strokeWidth="0.35"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="75"
            y1="25"
            x2="75"
            y2="75"
            stroke="rgb(212 175 55 / 0.12)"
            strokeWidth="0.35"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="25"
            y1="25"
            x2="75"
            y2="75"
            stroke="rgb(212 175 55 / 0.08)"
            strokeWidth="0.25"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="75"
            y1="25"
            x2="25"
            y2="75"
            stroke="rgb(212 175 55 / 0.08)"
            strokeWidth="0.25"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="50"
            y1="50"
            x2="25"
            y2="25"
            stroke="currentColor"
            strokeWidth="0.28"
            strokeDasharray="0.85 2"
            vectorEffect="non-scaling-stroke"
            className={
              reduceMotion
                ? "text-primary/20"
                : "fi-hero-network-line-out text-primary/35 [animation-duration:3.2s]"
            }
          />
          <line
            x1="50"
            y1="50"
            x2="75"
            y2="25"
            stroke="currentColor"
            strokeWidth="0.28"
            strokeDasharray="0.85 2"
            vectorEffect="non-scaling-stroke"
            className={
              reduceMotion
                ? "text-primary/20"
                : "fi-hero-network-line-in text-primary/35 [animation-duration:2.8s]"
            }
          />
          <line
            x1="50"
            y1="50"
            x2="25"
            y2="75"
            stroke="currentColor"
            strokeWidth="0.28"
            strokeDasharray="0.85 2"
            vectorEffect="non-scaling-stroke"
            className={
              reduceMotion
                ? "text-primary/20"
                : "fi-hero-network-line-out text-primary/35 [animation-duration:3.6s]"
            }
          />
          <line
            x1="50"
            y1="50"
            x2="75"
            y2="75"
            stroke="currentColor"
            strokeWidth="0.28"
            strokeDasharray="0.85 2"
            vectorEffect="non-scaling-stroke"
            className={
              reduceMotion
                ? "text-primary/20"
                : "fi-hero-network-line-in text-primary/35 [animation-duration:3s]"
            }
          />
        </svg>

        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/20 bg-[rgb(6_10_18_/0.85)] shadow-[0_0_32px_rgb(212_175_55_/0.12)] sm:h-20 sm:w-20"
        />

        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
          animate={reduceMotion ? {} : { scale: [1, 1.04, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          <div className="h-3 w-3 rounded-full bg-amber-400/55 shadow-[0_0_20px_rgb(212_175_55_/0.45)]" />
        </motion.div>

        <p className="relative z-10 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
          Connected intelligence substrate
        </p>

        <ul className="relative z-10 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:mt-10 lg:gap-6">
          {c.cards.map((card, index) => (
            <li key={card.name}>
              <EcosystemSystemCard
                index={index}
                name={card.name}
                label={card.label}
                description={card.description}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function FiMarketingConnectedIntelligenceEcosystemSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${c.id}-heading`}
          eyebrow={c.storyEyebrow}
          title={c.headline}
          description={c.subtext}
          tone="intelligence"
        />
        <ConnectedEcosystemGrid />

        <div className="mx-auto mt-14 max-w-4xl text-center sm:mt-16 md:mt-20">
          <p className="font-display text-2xl font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-3xl md:text-[2.125rem] md:leading-[1.2]">
            {c.closingStatement.line1}
          </p>
          <p className="mt-4 font-display text-2xl font-semibold tracking-tight text-amber-100/95 sm:mt-5 sm:text-3xl md:text-[2.125rem]">
            {c.closingStatement.line2}
          </p>
        </div>
      </FadeIn>
    </Section>
  );
}

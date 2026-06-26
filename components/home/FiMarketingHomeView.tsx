"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_V5_CONTENT } from "@/lib/marketing/homePageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

const c = HOME_V5_CONTENT;

function HeroMetricsRow() {
  return (
    <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {c.hero.metrics.map((metric, index) => (
        <GlassCard key={metric.label} className="border-white/[0.07] !p-5 sm:!p-6">
          <FadeIn delay={0.03 * index}>
            {metric.value ? (
              <>
                <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {metric.value}
                </p>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {metric.label}
                </p>
              </>
            ) : (
              <p className="font-display text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
                {metric.label}
              </p>
            )}
          </FadeIn>
        </GlassCard>
      ))}
    </div>
  );
}

function FragmentationCard({
  card,
  index,
}: {
  card: (typeof c.fragmentation.cards)[number];
  index: number;
}) {
  return (
    <FadeIn delay={0.03 * (index % 6)}>
      <div className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-transparent p-5 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/20 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/55">
          {String(index + 1).padStart(2, "0")}
        </p>
        <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-foreground">{card.category}</h3>
        <ul className="mt-5 space-y-2">
          {card.items.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 text-sm text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </FadeIn>
  );
}

function PlatformSystemCard({
  system,
  index,
}: {
  system: (typeof c.platformSystems.systems)[number];
  index: number;
}) {
  return (
    <FadeIn delay={0.02 * (index % 8)}>
      <GlassCard
        variant="os"
        className="group flex h-full flex-col border-white/[0.06] p-6 transition-[border-color,transform,box-shadow] duration-300 hover:border-amber-400/20 sm:p-7"
      >
        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/45">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          {system.name}
        </h3>
        <p className="mt-4 flex-1 text-sm leading-[1.7] text-muted-foreground">{system.description}</p>
      </GlassCard>
    </FadeIn>
  );
}

function ComparisonColumn({
  title,
  items,
  variant,
}: {
  title: string;
  items: readonly string[];
  variant: "generic" | "fi";
}) {
  return (
    <GlassCard
      variant={variant === "fi" ? "os" : "default"}
      className={cn(
        "h-full border-white/[0.07] !p-7 sm:!p-8",
        variant === "fi" && "border-amber-400/15"
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.2em]",
          variant === "fi" ? "text-amber-200/75" : "text-muted-foreground"
        )}
      >
        {variant === "fi" ? "Clinical intelligence platform" : "Horizontal software"}
      </p>
      <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h3>
      <ul className="mt-6 space-y-2.5">
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-snug",
              variant === "fi"
                ? "border-amber-400/12 bg-amber-950/15 text-foreground/95"
                : "border-white/[0.06] bg-black/15 text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "mt-2 h-1 w-1 shrink-0 rounded-full",
                variant === "fi" ? "bg-amber-400/80" : "bg-white/30"
              )}
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

function CapabilityCard({ label, index }: { label: string; index: number }) {
  return (
    <FadeIn delay={0.025 * (index % 7)}>
      <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent p-5 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/18 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </p>
        <p className="mt-3 font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">{label}</p>
      </div>
    </FadeIn>
  );
}

function SectionClosingStatement({ children }: { children: string }) {
  return (
    <p className="mt-14 max-w-4xl font-display text-xl font-semibold leading-[1.5] tracking-tight text-foreground text-balance sm:mt-16 sm:text-2xl md:text-[1.75rem] md:leading-[1.55]">
      {children}
    </p>
  );
}

export function FiMarketingHomeView() {
  return (
    <>
      {/* Section 1 — Hero */}
      <section
        id={c.hero.id}
        aria-labelledby="hero-heading"
        className="relative overflow-hidden border-b border-border/40 bg-[#040810]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_-10%,rgb(212_175_55_/0.14),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,hsl(var(--primary)/0.1),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28 md:py-36">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-amber-200/80">{c.hero.eyebrow}</p>
            <div className="mt-4 h-px w-16 bg-gradient-to-r from-amber-300/60 via-amber-400/20 to-transparent" aria-hidden />
            <h1
              id="hero-heading"
              className="mt-8 max-w-5xl font-display text-[2.25rem] font-semibold leading-[1.06] tracking-tight text-foreground text-balance sm:text-5xl md:text-[3.25rem] md:leading-[1.05]"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-10 max-w-3xl text-lg leading-[1.75] text-foreground/82 sm:text-xl sm:leading-[1.8]">
              {c.hero.subheadline}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Button asChild size="lg" className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[12rem]")}>
                <Link href={c.hero.primaryCta.href}>
                  {c.hero.primaryCta.label}
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem]")}>
                <Link href={c.hero.secondaryCta.href}>
                  {c.hero.secondaryCta.label}
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                </Link>
              </Button>
            </div>

            <HeroMetricsRow />
          </FadeIn>
        </div>
      </section>

      {/* Section 2 — Industry fragmentation */}
      <Section
        id={c.fragmentation.id}
        className="border-b border-border/40 bg-background py-24 sm:py-28 md:py-32"
        aria-labelledby={`${c.fragmentation.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.fragmentation.id}-heading`}
            eyebrow={c.fragmentation.eyebrow}
            title={c.fragmentation.headline}
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.fragmentation.cards.map((card, index) => (
              <FragmentationCard key={card.category} card={card} index={index} />
            ))}
          </div>
          <SectionClosingStatement>{c.fragmentation.closingStatement}</SectionClosingStatement>
        </FadeIn>
      </Section>

      {/* Section 3 — Platform systems */}
      <Section
        id={c.platformSystems.id}
        className="border-b border-border/40 bg-muted/[0.04] py-24 sm:py-28 md:py-32"
        aria-labelledby={`${c.platformSystems.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.platformSystems.id}-heading`}
            eyebrow={c.platformSystems.eyebrow}
            title={c.platformSystems.headline}
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.platformSystems.systems.map((system, index) => (
              <PlatformSystemCard key={system.name} system={system} index={index} />
            ))}
          </div>
        </FadeIn>
      </Section>

      {/* Section 4 — Differentiation */}
      <Section
        id={c.differentiation.id}
        className="border-b border-border/40 bg-background py-24 sm:py-28 md:py-32"
        aria-labelledby={`${c.differentiation.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.differentiation.id}-heading`}
            eyebrow={c.differentiation.eyebrow}
            title={c.differentiation.headline}
          />
          <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8">
            <ComparisonColumn
              title={c.differentiation.genericSoftware.title}
              items={c.differentiation.genericSoftware.items}
              variant="generic"
            />
            <ComparisonColumn
              title={c.differentiation.follicleIntelligence.title}
              items={c.differentiation.follicleIntelligence.items}
              variant="fi"
            />
          </div>
          <SectionClosingStatement>{c.differentiation.closingStatement}</SectionClosingStatement>
        </FadeIn>
      </Section>

      {/* Section 5 — Surgery intelligence */}
      <Section
        id={c.surgeryIntelligence.id}
        className="border-b border-border/40 bg-gradient-to-b from-[#040810] via-background to-background py-24 sm:py-28 md:py-32"
        aria-labelledby={`${c.surgeryIntelligence.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.surgeryIntelligence.id}-heading`}
            eyebrow={c.surgeryIntelligence.eyebrow}
            title={c.surgeryIntelligence.headline}
            tone="audit"
          />
          <GlassCard
            variant="os"
            className="mt-14 overflow-hidden border-cyan-400/15 !p-0 shadow-[0_32px_100px_rgb(0_0_0_/0.45),inset_0_1px_0_rgb(255_255_255_/0.08)]"
          >
            <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
              {c.surgeryIntelligence.metrics.map((metric, index) => (
                <div key={metric} className="bg-[#040810] px-6 py-5 sm:px-8 sm:py-6">
                  <p className="font-mono text-[10px] tabular-nums text-cyan-200/50">{String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-2 text-sm font-medium leading-snug text-foreground/92">{metric}</p>
                </div>
              ))}
            </div>
          </GlassCard>
          <SectionClosingStatement>{c.surgeryIntelligence.closingStatement}</SectionClosingStatement>
        </FadeIn>
      </Section>

      {/* Section 6 — Outcome intelligence */}
      <Section
        id={c.outcomeIntelligence.id}
        className="border-b border-border/40 bg-muted/[0.04] py-24 sm:py-28 md:py-32"
        aria-labelledby={`${c.outcomeIntelligence.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.outcomeIntelligence.id}-heading`}
            eyebrow={c.outcomeIntelligence.eyebrow}
            title={c.outcomeIntelligence.headline}
            tone="intelligence"
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.outcomeIntelligence.capabilities.map((capability, index) => (
              <CapabilityCard key={capability} label={capability} index={index} />
            ))}
          </div>
          <SectionClosingStatement>{c.outcomeIntelligence.closingStatement}</SectionClosingStatement>
        </FadeIn>
      </Section>

      {/* Section 7 — Staff intelligence */}
      <Section
        id={c.staffIntelligence.id}
        className="border-b border-border/40 bg-background py-24 sm:py-28 md:py-32"
        aria-labelledby={`${c.staffIntelligence.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.staffIntelligence.id}-heading`}
            eyebrow={c.staffIntelligence.eyebrow}
            title={c.staffIntelligence.headline}
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {c.staffIntelligence.capabilities.map((capability, index) => (
              <CapabilityCard key={capability} label={capability} index={index} />
            ))}
          </div>
          <SectionClosingStatement>{c.staffIntelligence.closingStatement}</SectionClosingStatement>
        </FadeIn>
      </Section>

      {/* Section 8 — Future vision */}
      <section
        id={c.futureVision.id}
        className="relative overflow-hidden bg-[#040810] py-28 sm:py-36 md:py-44"
        aria-labelledby={`${c.futureVision.id}-heading`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(212_175_55_/0.1),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgb(167_139_250_/0.06),transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/70">{c.futureVision.eyebrow}</p>
            <div className="mt-4 h-px w-16 bg-gradient-to-r from-amber-300/50 to-transparent" aria-hidden />
            <h2
              id={`${c.futureVision.id}-heading`}
              className="mt-8 max-w-4xl font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl md:text-5xl md:leading-[1.1]"
            >
              {c.futureVision.headline}
            </h2>
            <p className="mt-10 max-w-3xl text-lg leading-[1.75] text-foreground/82 sm:text-xl sm:leading-[1.8]">
              {c.futureVision.body}
            </p>
            <div className="mt-16 space-y-2 border-t border-white/[0.08] pt-12">
              {c.futureVision.footerLines.map((line) => (
                <p key={line} className="font-display text-base font-medium tracking-tight text-muted-foreground sm:text-lg">
                  {line}
                </p>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import {
  LEADFLOW_PAGE_CONTENT,
  type LeadFlowCapabilityMaturity,
} from "@/lib/marketing/leadFlowPageContent";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, CheckCircle2, Shield } from "lucide-react";

const c = LEADFLOW_PAGE_CONTENT;

const MATURITY_STYLES: Record<
  LeadFlowCapabilityMaturity,
  { badge: string; dot: string }
> = {
  "Operational Pilot": {
    badge: "border-sky-400/30 bg-sky-950/35 text-sky-100/95",
    dot: "bg-sky-400",
  },
  Expanding: {
    badge: "border-amber-400/30 bg-amber-950/30 text-amber-100/95",
    dot: "bg-amber-300",
  },
  Future: {
    badge: "border-violet-400/30 bg-violet-950/30 text-violet-100/95",
    dot: "bg-violet-400",
  },
};

function MaturityBadge({ maturity }: { maturity: LeadFlowCapabilityMaturity }) {
  const styles = MATURITY_STYLES[maturity];
  return (
    <span
      role="status"
      aria-label={`Maturity: ${maturity}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] sm:text-[10px]",
        styles.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)} aria-hidden />
      {maturity}
    </span>
  );
}

function HeroCtas({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      <Button asChild size="lg" className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[12rem]")}>
        <Link href={c.hero.primaryCta.href}>
          {c.hero.primaryCta.label}
          <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem]")}
      >
        <Link href={c.hero.secondaryCta.href}>{c.hero.secondaryCta.label}</Link>
      </Button>
      <Link
        href={c.hero.tertiaryCta.href}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/85 transition-colors hover:text-amber-50 sm:ml-1"
      >
        {c.hero.tertiaryCta.label}
        <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
      </Link>
    </div>
  );
}

export function LeadFlowMarketingView() {
  return (
    <>
      {/* Hero */}
      <section
        id={c.hero.id}
        aria-labelledby="leadflow-hero-heading"
        className="relative overflow-hidden border-b border-border/40 bg-[#040810]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_-10%,rgb(212_175_55_/0.14),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,hsl(var(--primary)/0.1),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28 md:py-36">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/80">
              {c.hero.eyebrow}
            </p>
            <div
              className="mt-4 h-px w-16 bg-gradient-to-r from-amber-300/60 via-amber-400/20 to-transparent"
              aria-hidden
            />
            <h1
              id="leadflow-hero-heading"
              className="mt-8 max-w-5xl font-display text-[2.15rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance sm:text-5xl md:text-[3.15rem] md:leading-[1.05]"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-[1.75] text-foreground/85 sm:text-xl sm:leading-[1.8]">
              {c.hero.subheadline}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {c.hero.supporting}
            </p>
            <p className="mt-4 max-w-3xl text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {c.hero.supportingSecondary}
            </p>

            <div className="mt-8 max-w-3xl rounded-2xl border border-sky-400/15 bg-sky-950/20 px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-wrap items-center gap-3">
                <MaturityBadge maturity="Operational Pilot" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/70">
                  Availability
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/88 sm:text-[0.95rem]">
                {c.hero.maturityBody}
              </p>
            </div>

            <HeroCtas className="mt-10" />
          </FadeIn>
        </div>
      </section>

      {/* Problem */}
      <Section
        id={c.problem.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby="leadflow-problem-heading"
      >
        <FadeIn>
          <SectionHeading
            id="leadflow-problem-heading"
            eyebrow={c.problem.eyebrow}
            title={c.problem.headline}
            description={c.problem.intro}
          />
          <blockquote className="mt-10 max-w-3xl border-l-2 border-amber-400/35 pl-5 font-display text-xl font-semibold leading-snug tracking-tight text-foreground/95 sm:text-2xl">
            {c.problem.quote}
          </blockquote>
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2">
            {c.problem.problems.map((item, index) => (
              <li key={item.title}>
                <FadeIn delay={0.03 * (index % 8)}>
                  <GlassCard variant="problem" className="h-full !p-5 sm:!p-6">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/50">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-[1.7] text-muted-foreground">{item.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      {/* Capabilities */}
      <Section
        id={c.capabilities.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby="leadflow-capabilities-heading"
      >
        <FadeIn>
          <SectionHeading
            id="leadflow-capabilities-heading"
            eyebrow={c.capabilities.eyebrow}
            title={c.capabilities.headline}
            description={c.capabilities.intro}
          />
          <div className="mt-8 flex flex-wrap gap-3">
            {c.capabilities.maturityLegend.map((item) => (
              <div
                key={item.label}
                className="max-w-xs rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3"
              >
                <MaturityBadge maturity={item.label} />
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.meaning}</p>
              </div>
            ))}
          </div>
          <ul className="mt-12 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
            {c.capabilities.items.map((item, index) => (
              <li key={item.title}>
                <FadeIn delay={0.025 * (index % 9)}>
                  <GlassCard variant="os" className="flex h-full flex-col border-white/[0.06] !p-5 sm:!p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                        {item.title}
                      </h3>
                      <MaturityBadge maturity={item.maturity} />
                    </div>
                    <p className="mt-4 flex-1 text-sm leading-[1.7] text-muted-foreground">
                      {item.body}
                    </p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      {/* Connected journey */}
      <Section
        id={c.journey.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby="leadflow-journey-heading"
      >
        <FadeIn>
          <SectionHeading
            id="leadflow-journey-heading"
            eyebrow={c.journey.eyebrow}
            title={c.journey.headline}
            description={c.journey.intro}
            tone="audit"
          />
          <ol className="mt-12 flex list-none flex-col gap-0 p-0 md:flex-row md:items-stretch md:gap-0">
            {c.journey.steps.map((step, index) => (
              <li key={step.label} className="relative flex flex-1 flex-col md:min-w-0">
                <FadeIn delay={0.04 * index}>
                  <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent px-5 py-6 sm:px-6">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/60">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground">
                      {step.label}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </FadeIn>
                {index < c.journey.steps.length - 1 ? (
                  <div
                    className="flex justify-center py-2 text-amber-300/45 md:absolute md:right-0 md:top-1/2 md:z-10 md:-translate-y-1/2 md:translate-x-1/2 md:py-0"
                    aria-hidden
                  >
                    <ArrowDown className="h-5 w-5 md:hidden" />
                    <ArrowRight className="hidden h-5 w-5 md:block" />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-10 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {c.journey.modulesNote}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {c.journey.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-foreground/90 transition-colors hover:border-amber-400/25 hover:text-amber-50"
              >
                {link.label}
                <ArrowRight className="h-3 w-3 opacity-70" aria-hidden />
              </Link>
            ))}
          </div>
        </FadeIn>
      </Section>

      {/* HubSpot pathway */}
      <Section
        id={c.hubspot.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby="leadflow-hubspot-heading"
      >
        <FadeIn>
          <SectionHeading
            id="leadflow-hubspot-heading"
            eyebrow={c.hubspot.eyebrow}
            title={c.hubspot.headline}
            description={c.hubspot.intro}
          />
          <p className="mt-8 max-w-3xl font-display text-xl font-semibold tracking-tight text-amber-100/90 sm:text-2xl">
            {c.hubspot.clinicLine}
          </p>
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2">
            {c.hubspot.modes.map((mode, index) => (
              <li key={mode.title}>
                <FadeIn delay={0.04 * index}>
                  <GlassCard className="h-full border-white/[0.07] !p-6">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/65">
                      {String(index + 1).padStart(2, "0")} · Mode
                    </p>
                    <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground">
                      {mode.title}
                    </h3>
                    <p className="mt-3 text-sm leading-[1.7] text-muted-foreground">{mode.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {c.hubspot.scopeNote}
          </p>
        </FadeIn>
      </Section>

      {/* Controlled transition */}
      <Section
        id={c.migration.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby="leadflow-migration-heading"
      >
        <FadeIn>
          <SectionHeading
            id="leadflow-migration-heading"
            eyebrow={c.migration.eyebrow}
            title={c.migration.headline}
            description={c.migration.intro}
            tone="audit"
          />
          <ul className="mt-12 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.migration.safeguards.map((item, index) => (
              <li key={item}>
                <FadeIn delay={0.02 * (index % 9)}>
                  <div className="flex h-full items-start gap-3 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-4">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" aria-hidden />
                    <span className="text-sm leading-relaxed text-foreground/90">{item}</span>
                  </div>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      {/* Value after conversion */}
      <Section
        id={c.valueAfter.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby="leadflow-value-heading"
      >
        <FadeIn>
          <SectionHeading
            id="leadflow-value-heading"
            eyebrow={c.valueAfter.eyebrow}
            title={c.valueAfter.headline}
            description={c.valueAfter.intro}
            tone="intelligence"
          />
          <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200/70">
            {c.valueAfter.questionsEyebrow}
          </p>
          <ul className="mt-6 grid list-none gap-3 p-0 md:grid-cols-2">
            {c.valueAfter.questions.map((q, index) => (
              <li key={q}>
                <FadeIn delay={0.03 * index}>
                  <div className="flex items-start gap-3 rounded-2xl border border-violet-400/12 bg-violet-950/15 px-4 py-4">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/80"
                      aria-hidden
                    />
                    <span className="text-sm leading-relaxed text-foreground/90">{q}</span>
                  </div>
                </FadeIn>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {c.valueAfter.intelligenceNote}
          </p>
        </FadeIn>
      </Section>

      {/* Closing */}
      <section
        id={c.closing.id}
        className="relative overflow-hidden bg-[#040810] py-24 sm:py-32 md:py-40"
        aria-labelledby="leadflow-closing-heading"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(212_175_55_/0.12),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-200/75">
              {c.closing.eyebrow}
            </p>
            <div
              className="mt-5 h-px w-20 bg-gradient-to-r from-amber-300/50 to-transparent"
              aria-hidden
            />
            <h2
              id="leadflow-closing-heading"
              className="mt-10 max-w-4xl font-display text-3xl font-semibold leading-[1.1] tracking-tight text-foreground text-balance sm:text-4xl md:text-5xl"
            >
              {c.closing.headline}
            </h2>
            <p className="mt-8 max-w-2xl text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {c.closing.body}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                asChild
                size="lg"
                className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[12rem]")}
              >
                <Link href={c.closing.primaryCta.href}>
                  {c.closing.primaryCta.label}
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem]")}
              >
                <Link href={c.closing.secondaryCta.href}>{c.closing.secondaryCta.label}</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

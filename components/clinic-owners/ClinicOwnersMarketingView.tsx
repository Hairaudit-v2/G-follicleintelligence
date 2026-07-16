"use client";

import Link from "next/link";

import { Section } from "@/components/layout/section";
import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import {
  CLINIC_OWNERS_PAGE_CONTENT,
  type ClinicOwnerVisibilityMaturity,
} from "@/lib/marketing/clinicOwnersPageContent";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ChevronRight, Shield } from "lucide-react";

const c = CLINIC_OWNERS_PAGE_CONTENT;

const MATURITY_STYLES: Record<ClinicOwnerVisibilityMaturity, { badge: string; dot: string }> = {
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

function MaturityBadge({ maturity }: { maturity: ClinicOwnerVisibilityMaturity }) {
  const styles = MATURITY_STYLES[maturity];
  return (
    <span
      role="status"
      aria-label={`Status: ${maturity}`}
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

function HeroCtas() {
  return (
    <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <Button
        asChild
        size="lg"
        className={cn(
          MARKETING_CTA_PRIMARY_CLASS,
          "min-w-[12rem] shadow-[0_18px_52px_rgb(212_175_55_/0.16),inset_0_1px_0_rgb(255_255_255_/0.12)]"
        )}
      >
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
        <Link href={c.hero.secondaryCta.href}>
          {c.hero.secondaryCta.label}
          <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        </Link>
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

export function ClinicOwnersMarketingView() {
  return (
    <>
      {/* Hero */}
      <section
        id={c.hero.id}
        aria-labelledby={`${c.hero.id}-heading`}
        className="fi-grid relative overflow-hidden border-b border-border/50 bg-[rgb(3_5_12_/0.55)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_8%_0%,rgb(212_175_55_/0.18),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_92%_12%,hsl(var(--primary)/0.14),transparent_44%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/[0.12] to-background" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
          <FadeIn>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-200/85 sm:text-[11px]">
              {c.hero.eyebrow}
            </p>
            <div
              className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/65 via-amber-400/22 to-transparent"
              aria-hidden
            />
            <h1
              id={`${c.hero.id}-heading`}
              className="mt-5 max-w-4xl font-display text-[2.05rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance sm:text-4xl md:text-5xl md:leading-[1.06] lg:max-w-5xl"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-foreground/85 sm:text-lg md:text-xl md:leading-relaxed">
              {c.hero.subtext}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {c.hero.supporting}
            </p>
            <p className="mt-6 text-sm font-medium text-amber-100/80">{c.hero.trustLine}</p>
            <HeroCtas />
          </FadeIn>
        </div>
      </section>

      {/* Problem */}
      <Section
        id={c.problem.id}
        className="scroll-mt-28 border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.05] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.problem.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.problem.id}-heading`}
            eyebrow={c.problem.eyebrow}
            title={c.problem.headline}
            description={c.problem.intro}
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.problem.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 5)}>
                  <GlassCard
                    variant="problem"
                    className="flex h-full flex-col border-amber-400/[0.07]"
                  >
                    <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
                      {card.body}
                    </p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      {/* Owner outcomes */}
      <Section
        id={c.outcomes.id}
        className="scroll-mt-28 border-b border-border/50 bg-muted/[0.03] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.outcomes.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.outcomes.id}-heading`}
            eyebrow={c.outcomes.eyebrow}
            title={c.outcomes.headline}
            description={c.outcomes.intro}
          />
          <ul className="mt-12 grid list-none gap-5 p-0 md:grid-cols-2">
            {c.outcomes.items.map((item, i) => (
              <li key={item.title}>
                <FadeIn delay={0.04 * (i % 6)}>
                  <GlassCard variant="os" className="h-full border-white/[0.07] !p-6 sm:!p-7">
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-amber-950/30 font-mono text-sm font-semibold text-amber-100">
                        {item.letter}
                      </span>
                      <div>
                        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground md:text-xl">
                          {item.title}
                        </h3>
                        <p className="mt-3 text-sm leading-[1.7] text-muted-foreground">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      {/* Connected systems (no fixed count) */}
      <Section
        id={c.systems.id}
        className="scroll-mt-28 border-b border-border/50 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.systems.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.systems.id}-heading`}
            eyebrow={c.systems.eyebrow}
            title={c.systems.headline}
            description={c.systems.intro}
          />
          <div className="mt-12 space-y-8">
            {c.systems.groups.map((group, gi) => (
              <FadeIn key={group.title} delay={0.03 * gi}>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/70">
                    {group.title}
                  </h3>
                  <ul className="mt-4 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {group.systems.map((sys) => (
                      <li key={sys.name}>
                        <GlassCard className="h-full border-white/[0.07] !p-5">
                          <p className="font-display text-lg font-semibold tracking-tight text-foreground">
                            {sys.name}
                          </p>
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {sys.body}
                          </p>
                        </GlassCard>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      </Section>

      {/* Journey */}
      <Section
        id={c.journey.id}
        className="scroll-mt-28 border-b border-border/50 bg-muted/[0.03] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.journey.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.journey.id}-heading`}
            eyebrow={c.journey.eyebrow}
            title={c.journey.headline}
            tone="audit"
          />
          <ol className="mt-12 flex list-none flex-col gap-3 p-0 md:flex-row md:items-stretch">
            {c.journey.steps.map((step, index) => (
              <li key={step.label} className="relative flex flex-1 flex-col md:min-w-0">
                <FadeIn delay={0.04 * index}>
                  <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent px-5 py-6">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/60">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground">
                      {step.label}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </FadeIn>
                {index < c.journey.steps.length - 1 ? (
                  <div
                    className="flex justify-center py-1 text-amber-300/45 md:absolute md:right-0 md:top-1/2 md:z-10 md:-translate-y-1/2 md:translate-x-1/2 md:py-0"
                    aria-hidden
                  >
                    <ArrowDown className="h-5 w-5 md:hidden" />
                    <ArrowRight className="hidden h-5 w-5 md:block" />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </FadeIn>
      </Section>

      {/* Progressive adoption */}
      <Section
        id={c.adoption.id}
        className="scroll-mt-28 border-b border-border/50 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.adoption.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.adoption.id}-heading`}
            eyebrow={c.adoption.eyebrow}
            title={c.adoption.headline}
            description={c.adoption.intro}
          />
          <p className="mt-6 max-w-3xl font-display text-xl font-semibold tracking-tight text-amber-100/90 sm:text-2xl">
            {c.adoption.clinicLine}
          </p>
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2">
            {c.adoption.modes.map((mode, index) => (
              <li key={mode.title}>
                <FadeIn delay={0.04 * index}>
                  <GlassCard className="h-full border-white/[0.07] !p-6">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/65">
                      {String(index + 1).padStart(2, "0")} · Mode
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
                      {mode.title}
                    </h3>
                    <p className="mt-3 text-sm leading-[1.7] text-muted-foreground">{mode.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {c.adoption.hubspotNote}
          </p>
        </FadeIn>
      </Section>

      {/* Migration risk */}
      <Section
        id={c.migration.id}
        className="scroll-mt-28 border-b border-border/50 bg-muted/[0.03] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.migration.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.migration.id}-heading`}
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

      {/* Owner visibility */}
      <Section
        id={c.visibility.id}
        className="scroll-mt-28 border-b border-border/50 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.visibility.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.visibility.id}-heading`}
            eyebrow={c.visibility.eyebrow}
            title={c.visibility.headline}
            description={c.visibility.intro}
          />
          <div className="mt-8 flex flex-wrap gap-3">
            {c.visibility.legend.map((item) => (
              <div
                key={item.label}
                className="max-w-xs rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3"
              >
                <MaturityBadge maturity={item.label} />
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.meaning}</p>
              </div>
            ))}
          </div>
          <ul className="mt-12 grid list-none gap-5 p-0 lg:grid-cols-2 xl:grid-cols-3">
            {c.visibility.categories.map((cat, i) => (
              <li key={cat.title}>
                <FadeIn delay={0.03 * i}>
                  <GlassCard className="flex h-full flex-col border-white/[0.07] !p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                        {cat.title}
                      </h3>
                      <MaturityBadge maturity={cat.maturity} />
                    </div>
                    <ul className="mt-5 space-y-2">
                      {cat.items.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2 text-sm leading-snug text-muted-foreground"
                        >
                          <span
                            className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400/55"
                            aria-hidden
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      {/* Multi-site */}
      <Section
        id={c.multiSite.id}
        className="scroll-mt-28 border-b border-border/50 bg-muted/[0.03] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.multiSite.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.multiSite.id}-heading`}
            eyebrow={c.multiSite.eyebrow}
            title={c.multiSite.headline}
            description={c.multiSite.intro}
          />
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.multiSite.benefits.map((benefit) => (
              <li
                key={benefit}
                className="rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                {benefit}
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      {/* Compound value */}
      <Section
        id={c.compoundValue.id}
        className="scroll-mt-28 border-b border-border/50 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.compoundValue.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.compoundValue.id}-heading`}
            eyebrow={c.compoundValue.eyebrow}
            title={c.compoundValue.headline}
            description={c.compoundValue.intro}
            tone="intelligence"
          />
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2">
            {c.compoundValue.points.map((point) => (
              <li
                key={point}
                className="rounded-xl border border-violet-400/12 bg-violet-950/15 px-4 py-3 text-sm text-foreground/90"
              >
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-3xl font-display text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">
            {c.compoundValue.closing}
          </p>
        </FadeIn>
      </Section>

      {/* Maturity honesty */}
      <Section
        id={c.maturity.id}
        className="scroll-mt-28 border-b border-border/50 bg-muted/[0.03] py-16 sm:py-20"
        aria-labelledby={`${c.maturity.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.maturity.id}-heading`}
            eyebrow={c.maturity.eyebrow}
            title={c.maturity.headline}
          />
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {c.maturity.body}
          </p>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {c.maturity.statuses.join(" · ")}
          </p>
          <Link
            href={c.maturity.cta.href}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/90 transition-colors hover:text-amber-50"
          >
            {c.maturity.cta.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </FadeIn>
      </Section>

      {/* Closing CTA */}
      <section
        id={c.finalCta.id}
        className="border-t border-border/50 bg-gradient-to-b from-background to-muted/[0.1] pb-20 pt-14 sm:pb-24 sm:pt-16 md:pt-20"
        aria-labelledby={`${c.finalCta.id}-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="rounded-[1.75rem] border border-white/[0.1] bg-gradient-to-br from-white/[0.05] via-white/[0.015] to-transparent p-7 shadow-[0_28px_90px_rgb(0_0_0_/0.45),inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-md sm:rounded-[2rem] sm:p-10 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
                    {c.finalCta.eyebrow}
                  </p>
                  <div
                    className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/65 via-amber-400/22 to-transparent"
                    aria-hidden
                  />
                  <h2
                    id={`${c.finalCta.id}-heading`}
                    className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance md:text-4xl"
                  >
                    {c.finalCta.headline}
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {c.finalCta.body}
                  </p>
                </div>
                <div className="flex w-full max-w-md flex-col gap-3 lg:max-w-none lg:justify-self-end">
                  <Button asChild size="lg" className={MARKETING_CTA_PRIMARY_CLASS}>
                    <Link href={c.finalCta.primaryCta.href}>
                      {c.finalCta.primaryCta.label}
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className={MARKETING_CTA_SECONDARY_CLASS}
                  >
                    <Link href={c.finalCta.secondaryCta.href}>
                      {c.finalCta.secondaryCta.label}
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    </Link>
                  </Button>
                  <Link
                    href={c.finalCta.tertiaryCta.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/85 transition-colors hover:text-amber-50"
                  >
                    {c.finalCta.tertiaryCta.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

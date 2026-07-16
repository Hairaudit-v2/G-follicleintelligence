"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import {
  HUBSPOT_MIGRATION_PAGE_CONTENT,
  type MigrationScopeStatus,
} from "@/lib/marketing/hubspotMigrationPageContent";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, CheckCircle2, Shield } from "lucide-react";

const c = HUBSPOT_MIGRATION_PAGE_CONTENT;

const SCOPE_STYLES: Record<MigrationScopeStatus, string> = {
  Supported: "border-emerald-400/30 bg-emerald-950/30 text-emerald-100/95",
  "Supported with scope review": "border-sky-400/30 bg-sky-950/30 text-sky-100/95",
  "Not currently included": "border-white/15 bg-white/[0.04] text-foreground/85",
  "Future consideration": "border-violet-400/30 bg-violet-950/30 text-violet-100/95",
};

function ScopeBadge({ status }: { status: MigrationScopeStatus }) {
  return (
    <span
      role="status"
      aria-label={`Status: ${status}`}
      className={cn(
        "inline-flex max-w-full rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] sm:text-[10px]",
        SCOPE_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

function HeroCtas() {
  return (
    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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

export function HubspotMigrationMarketingView() {
  return (
    <>
      <section
        id={c.hero.id}
        aria-labelledby="hubspot-migration-hero-heading"
        className="relative overflow-hidden border-b border-border/40 bg-[#040810]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_-10%,rgb(212_175_55_/0.14),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,hsl(var(--primary)/0.1),transparent_40%)]" />
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
              id="hubspot-migration-hero-heading"
              className="mt-8 max-w-5xl font-display text-[2.1rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance sm:text-5xl md:text-[3.1rem] md:leading-[1.05]"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-[1.75] text-foreground/85 sm:text-xl">
              {c.hero.subheadline}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {c.hero.supporting}
            </p>
            <p className="mt-6 text-sm font-medium text-amber-100/80">{c.hero.scopeLine}</p>
            <HeroCtas />
          </FadeIn>
        </div>
      </section>

      <Section
        id={c.whyBeyond.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="why-beyond-heading"
      >
        <FadeIn>
          <SectionHeading
            id="why-beyond-heading"
            eyebrow={c.whyBeyond.eyebrow}
            title={c.whyBeyond.headline}
            description={c.whyBeyond.intro}
          />
          <blockquote className="mt-10 max-w-3xl border-l-2 border-amber-400/35 pl-5 font-display text-xl font-semibold leading-snug text-foreground/95 sm:text-2xl">
            {c.whyBeyond.quote}
          </blockquote>
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2">
            {c.whyBeyond.fragmentation.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                {item}
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.beyondCrm.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="beyond-crm-heading"
      >
        <FadeIn>
          <SectionHeading
            id="beyond-crm-heading"
            eyebrow={c.beyondCrm.eyebrow}
            title={c.beyondCrm.headline}
            description={c.beyondCrm.intro}
            tone="audit"
          />
          <ol className="mt-12 flex list-none flex-col gap-3 p-0 md:flex-row md:items-stretch">
            {c.beyondCrm.steps.map((step, index) => (
              <li key={step.label} className="relative flex flex-1 flex-col md:min-w-0">
                <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent px-5 py-6">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/60">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 font-display text-xl font-semibold text-foreground">
                    {step.label}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p>
                </div>
                {index < c.beyondCrm.steps.length - 1 ? (
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
          <p className="mt-8 max-w-3xl text-sm text-muted-foreground">{c.beyondCrm.maturityNote}</p>
        </FadeIn>
      </Section>

      <Section
        id={c.modes.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="modes-heading"
      >
        <FadeIn>
          <SectionHeading
            id="modes-heading"
            eyebrow={c.modes.eyebrow}
            title={c.modes.headline}
          />
          <p className="mt-6 max-w-3xl font-display text-xl font-semibold tracking-tight text-amber-100/90 sm:text-2xl">
            {c.modes.clinicLine}
          </p>
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2">
            {c.modes.items.map((mode, index) => (
              <li key={mode.title}>
                <FadeIn delay={0.04 * index}>
                  <GlassCard className="h-full border-white/[0.07] !p-6">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/65">
                      {String(index + 1).padStart(2, "0")} · Mode
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-semibold text-foreground">
                      {mode.title}
                    </h3>
                    <p className="mt-3 text-sm leading-[1.7] text-muted-foreground">{mode.body}</p>
                    <p className="mt-4 text-xs leading-relaxed text-amber-100/75">
                      Suitable for: {mode.suitable}
                    </p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.stages.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="stages-heading"
      >
        <FadeIn>
          <SectionHeading
            id="stages-heading"
            eyebrow={c.stages.eyebrow}
            title={c.stages.headline}
            tone="audit"
          />
          <ol className="mt-12 space-y-4">
            {c.stages.items.map((stage, index) => (
              <li key={stage.title}>
                <FadeIn delay={0.03 * index}>
                  <div className="flex gap-4 rounded-2xl border border-white/[0.07] bg-black/15 px-5 py-5 sm:gap-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-amber-950/30 font-mono text-sm font-semibold text-amber-100">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-foreground">
                        {stage.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {stage.body}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              </li>
            ))}
          </ol>
        </FadeIn>
      </Section>

      <Section
        id={c.scope.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="scope-heading"
      >
        <FadeIn>
          <SectionHeading
            id="scope-heading"
            eyebrow={c.scope.eyebrow}
            title={c.scope.headline}
            description={c.scope.intro}
          />
          <div className="mt-10 overflow-x-auto rounded-[1.35rem] border border-white/[0.08]">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Public HubSpot migration scope by data category and support status
              </caption>
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                  <th scope="col" className="px-4 py-3 font-semibold text-foreground">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-foreground">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-foreground">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.scope.rows.map((row) => (
                  <tr key={row.item} className="border-b border-white/[0.06] last:border-0">
                    <th
                      scope="row"
                      className="px-4 py-3 align-top font-medium text-foreground/95"
                    >
                      {row.item}
                    </th>
                    <td className="px-4 py-3 align-top">
                      <ScopeBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {row.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile-friendly stacked alternative for small screens is covered by horizontal scroll + min-width */}
        </FadeIn>
      </Section>

      <Section
        id={c.identity.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="identity-heading"
      >
        <FadeIn>
          <SectionHeading
            id="identity-heading"
            eyebrow={c.identity.eyebrow}
            title={c.identity.headline}
            description={c.identity.intro}
          />
          <div className="mt-8 flex flex-wrap gap-2">
            {c.identity.distinguishes.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-xs font-medium text-foreground/90"
              >
                {item}
              </span>
            ))}
          </div>
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2">
            {c.identity.principles.map((p) => (
              <li
                key={p}
                className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {c.identity.closing}
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.coexistence.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="coexistence-heading"
      >
        <FadeIn>
          <SectionHeading
            id="coexistence-heading"
            eyebrow={c.coexistence.eyebrow}
            title={c.coexistence.headline}
            description={c.coexistence.intro}
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <GlassCard className="border-white/[0.07] !p-6">
              <h3 className="font-display text-lg font-semibold text-foreground">
                HubSpot may temporarily retain
              </h3>
              <ul className="mt-5 space-y-2">
                {c.coexistence.hubspotMayRetain.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard className="border-amber-400/15 !p-6">
              <h3 className="font-display text-lg font-semibold text-foreground">
                FI may become responsible for
              </h3>
              <ul className="mt-5 space-y-2">
                {c.coexistence.fiMayOwn.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.readiness.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="readiness-heading"
      >
        <FadeIn>
          <SectionHeading
            id="readiness-heading"
            eyebrow={c.readiness.eyebrow}
            title={c.readiness.headline}
          />
          <ul className="mt-10 space-y-3">
            {c.readiness.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.outcomes.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="outcomes-heading"
      >
        <FadeIn>
          <SectionHeading
            id="outcomes-heading"
            eyebrow={c.outcomes.eyebrow}
            title={c.outcomes.headline}
            description={c.outcomes.intro}
          />
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.outcomes.items.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                {item}
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.evidence.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-16 sm:py-20"
        aria-labelledby="evidence-heading"
      >
        <FadeIn>
          <SectionHeading
            id="evidence-heading"
            eyebrow={c.evidence.eyebrow}
            title={c.evidence.headline}
          />
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground">
            {c.evidence.body}
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground/90">{c.evidence.note}</p>
        </FadeIn>
      </Section>

      <Section
        id={c.comparison.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="comparison-heading"
      >
        <FadeIn>
          <SectionHeading
            id="comparison-heading"
            eyebrow={c.comparison.eyebrow}
            title={c.comparison.headline}
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <GlassCard className="border-white/[0.07] !p-6">
              <h3 className="font-display text-xl font-semibold text-foreground">
                {c.comparison.hubspot.title}
              </h3>
              <ul className="mt-5 space-y-2">
                {c.comparison.hubspot.items.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard className="border-amber-400/15 !p-6">
              <h3 className="font-display text-xl font-semibold text-foreground">
                {c.comparison.fi.title}
              </h3>
              <ul className="mt-5 space-y-2">
                {c.comparison.fi.items.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {c.comparison.honesty}
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.faq.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="faq-heading"
      >
        <FadeIn>
          <SectionHeading id="faq-heading" eyebrow={c.faq.eyebrow} title={c.faq.headline} />
          <div className="mt-10 space-y-3">
            {c.faq.items.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-white/[0.08] bg-black/15 px-5 py-4"
              >
                <summary className="cursor-pointer list-none font-display text-base font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {item.q}
                    <span className="text-amber-200/70 transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </FadeIn>
      </Section>

      <section
        id={c.closing.id}
        className="relative overflow-hidden bg-[#040810] py-24 sm:py-32"
        aria-labelledby="migration-closing-heading"
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
              id="migration-closing-heading"
              className="mt-10 max-w-4xl font-display text-3xl font-semibold leading-[1.1] tracking-tight text-foreground text-balance sm:text-4xl md:text-5xl"
            >
              {c.closing.headline}
            </h2>
            <p className="mt-8 max-w-2xl text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {c.closing.body}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild size="lg" className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[12rem]")}>
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
              <Link
                href={c.closing.tertiaryCta.href}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/85 transition-colors hover:text-amber-50"
              >
                {c.closing.tertiaryCta.label}
                <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

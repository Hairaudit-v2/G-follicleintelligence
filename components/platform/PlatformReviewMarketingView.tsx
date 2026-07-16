"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { PlatformReviewEnquiryForm } from "@/components/platform/PlatformReviewEnquiryForm";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { PLATFORM_REVIEW_PAGE_CONTENT } from "@/lib/marketing/platformReviewPageContent";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ShieldAlert } from "lucide-react";

const c = PLATFORM_REVIEW_PAGE_CONTENT;

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

export function PlatformReviewMarketingView() {
  return (
    <>
      <section
        id={c.hero.id}
        aria-labelledby="platform-review-hero-heading"
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
              id="platform-review-hero-heading"
              className="mt-8 max-w-5xl font-display text-[2.15rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance sm:text-5xl md:text-[3.15rem] md:leading-[1.05]"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-[1.75] text-foreground/85 sm:text-xl">
              {c.hero.subheadline}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {c.hero.supporting}
            </p>
            <p className="mt-6 text-sm font-medium text-amber-100/80">{c.hero.trustLine}</p>
            <HeroCtas />
          </FadeIn>
        </div>
      </section>

      <Section
        id={c.positioning.id}
        className="border-b border-border/40 bg-background py-16 sm:py-20"
        aria-labelledby="positioning-heading"
      >
        <FadeIn>
          <h2 id="positioning-heading" className="sr-only">
            Review positioning
          </h2>
          <p className="max-w-3xl font-display text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">
            {c.positioning.body}
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.audiences.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="audiences-heading"
      >
        <FadeIn>
          <SectionHeading
            id="audiences-heading"
            eyebrow={c.audiences.eyebrow}
            title={c.audiences.headline}
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.audiences.items.map((item, index) => (
              <li key={item.title}>
                <FadeIn delay={0.03 * index}>
                  <GlassCard className="h-full border-white/[0.07] !p-6">
                    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
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

      <Section
        id={c.reviewAreas.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="review-areas-heading"
      >
        <FadeIn>
          <SectionHeading
            id="review-areas-heading"
            eyebrow={c.reviewAreas.eyebrow}
            title={c.reviewAreas.headline}
            description={c.reviewAreas.intro}
          />
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.reviewAreas.areas.map((area) => (
              <li
                key={area}
                className="rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                {area}
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {c.reviewAreas.statusNote}
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.adoption.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="adoption-heading"
      >
        <FadeIn>
          <SectionHeading
            id="adoption-heading"
            eyebrow={c.adoption.eyebrow}
            title={c.adoption.headline}
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
                      {String(index + 1).padStart(2, "0")}
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
        </FadeIn>
      </Section>

      <Section
        id={c.process.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="process-heading"
      >
        <FadeIn>
          <SectionHeading
            id="process-heading"
            eyebrow={c.process.eyebrow}
            title={c.process.headline}
            tone="audit"
          />
          <ol className="mt-12 space-y-4">
            {c.process.steps.map((step, index) => (
              <li key={step.title}>
                <FadeIn delay={0.04 * index}>
                  <div className="flex gap-4 rounded-2xl border border-white/[0.07] bg-black/15 px-5 py-5 sm:gap-5 sm:px-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-amber-950/30 font-mono text-sm font-semibold text-amber-100">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {c.process.notPromised}
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.trust.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="trust-heading"
      >
        <FadeIn>
          <SectionHeading
            id="trust-heading"
            eyebrow={c.trust.eyebrow}
            title={c.trust.headline}
          />
          <ul className="mt-10 space-y-3">
            {c.trust.points.map((point) => (
              <li
                key={point}
                className="rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm leading-relaxed text-foreground/90"
              >
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-950/20 px-5 py-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300/90" aria-hidden />
            <p className="text-sm leading-relaxed text-amber-50/95">{c.trust.warning}</p>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Read our{" "}
            <Link
              href={c.trust.privacyHref}
              className="font-semibold text-amber-100/90 underline decoration-amber-400/40 underline-offset-2 hover:text-amber-50"
            >
              privacy policy
            </Link>
            .
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.form.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby="form-heading"
      >
        <FadeIn>
          <SectionHeading
            id="form-heading"
            eyebrow={c.form.eyebrow}
            title={c.form.headline}
            description={c.form.intro}
          />
          <div className="mt-12">
            <PlatformReviewEnquiryForm />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

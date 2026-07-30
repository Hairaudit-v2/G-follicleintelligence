"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { PatientAppPhoneScreenshot } from "@/components/marketing/PatientAppPhoneScreenshot";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { PATIENT_APP_PAGE_CONTENT } from "@/lib/marketing/patientAppPageContent";
import {
  PATIENT_APP_DEMO_DATA_NOTE,
  PATIENT_APP_PUBLIC_SCREENSHOTS,
  PATIENT_APP_SCREENSHOTS,
} from "@/lib/marketing/patientAppScreenshots";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Shield } from "lucide-react";

const c = PATIENT_APP_PAGE_CONTENT;

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
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-200/85 transition-colors hover:text-cyan-50 sm:ml-1"
      >
        {c.hero.tertiaryCta.label}
        <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
      </Link>
    </div>
  );
}

function StatusBadge() {
  return (
    <span
      role="status"
      aria-label={`Status: ${c.hero.maturityLabel}`}
      className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-100/95 sm:text-[10px]"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" aria-hidden />
      {c.hero.maturityLabel}
    </span>
  );
}

export function PatientAppMarketingView() {
  return (
    <>
      <section
        id={c.hero.id}
        aria-labelledby="patient-app-hero-heading"
        className="relative overflow-hidden border-b border-border/40 bg-[#040810]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_-10%,rgb(212_175_55_/0.14),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,hsl(var(--primary)/0.12),transparent_42%)]" />
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
              id="patient-app-hero-heading"
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
              {c.hero.clinicLine}
            </p>

            <div className="mt-8 max-w-3xl rounded-2xl border border-sky-400/15 bg-sky-950/20 px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/70">
                  Availability
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/88 sm:text-[0.95rem]">
                {c.hero.maturityBody}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {c.hero.availabilityNote}
              </p>
            </div>

            <HeroCtas className="mt-10" />
          </FadeIn>
        </div>
      </section>

      <Section
        id="naming-distinction"
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-16 sm:py-20"
        aria-labelledby="naming-heading"
      >
        <FadeIn>
          <SectionHeading
            id="naming-heading"
            eyebrow="Architecture distinction"
            title="PatientOS and the FI Patient App are not the same product."
            description={c.hero.strategicLine}
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <GlassCard variant="os" className="!p-5 sm:!p-6">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
                {c.naming.patientOs}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {c.naming.patientOsDefinition}
              </p>
            </GlassCard>
            <GlassCard variant="os" className="!p-5 sm:!p-6">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
                {c.naming.productName}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {c.naming.patientAppDefinition}
              </p>
            </GlassCard>
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.problem.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby="patient-problem-heading"
      >
        <FadeIn>
          <SectionHeading
            id="patient-problem-heading"
            eyebrow={c.problem.eyebrow}
            title={c.problem.headline}
            description={c.problem.intro}
          />
          <div className="mt-8 flex flex-wrap gap-2">
            {c.problem.channels.map((channel) => (
              <span
                key={channel}
                className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-xs text-foreground/85"
              >
                {channel}
              </span>
            ))}
          </div>
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.problem.consequences.map((item, index) => (
              <li key={item.title}>
                <FadeIn delay={0.03 * (index % 6)}>
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

      <Section
        id={c.nextStep.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="next-step-heading"
      >
        <FadeIn>
          <SectionHeading
            id="next-step-heading"
            eyebrow={c.nextStep.eyebrow}
            title={c.nextStep.headline}
            description={c.nextStep.body}
          />
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.nextStep.examples.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300/85" aria-hidden />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.screenshots.id}
        className="scroll-mt-28 border-b border-border/40 bg-[radial-gradient(ellipse_at_50%_0%,rgb(42_168_220_/0.06),transparent_50%),rgb(3_5_10)] py-16 sm:py-20 md:py-24"
        aria-labelledby="patient-app-screens-heading"
      >
        <FadeIn>
          <SectionHeading
            id="patient-app-screens-heading"
            eyebrow={c.screenshots.eyebrow}
            title={c.screenshots.headline}
            description={c.screenshots.description}
          />
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PATIENT_APP_PUBLIC_SCREENSHOTS.map((id, index) => (
              <PatientAppPhoneScreenshot
                key={id}
                asset={PATIENT_APP_SCREENSHOTS[id]}
                priority={index < 2}
              />
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">{PATIENT_APP_DEMO_DATA_NOTE}</p>
          <p className="mt-2 text-center text-xs text-muted-foreground/80">{c.screenshots.demoNote}</p>
        </FadeIn>
      </Section>

      <Section
        id={c.actionCentre.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="action-centre-heading"
      >
        <FadeIn>
          <SectionHeading
            id="action-centre-heading"
            eyebrow={c.actionCentre.eyebrow}
            title={c.actionCentre.headline}
            description={c.actionCentre.body}
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <GlassCard variant="os" className="!p-5 sm:!p-6">
              <h3 className="font-display text-lg font-semibold text-foreground">Patient benefits</h3>
              <ul className="mt-4 space-y-2">
                {c.actionCentre.patientBenefits.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard variant="os" className="!p-5 sm:!p-6">
              <h3 className="font-display text-lg font-semibold text-foreground">Clinic benefits</h3>
              <ul className="mt-4 space-y-2">
                {c.actionCentre.clinicBenefits.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300/80" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.timeline.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="timeline-heading"
      >
        <FadeIn>
          <SectionHeading
            id="timeline-heading"
            eyebrow={c.timeline.eyebrow}
            title={c.timeline.headline}
            description={c.timeline.body}
          />
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2">
            {c.timeline.points.map((point) => (
              <li
                key={point}
                className="rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-sm text-muted-foreground">{c.timeline.caveat}</p>
        </FadeIn>
      </Section>

      <Section
        id={c.connectedElements.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="connected-elements-heading"
      >
        <FadeIn>
          <SectionHeading
            id="connected-elements-heading"
            eyebrow={c.connectedElements.eyebrow}
            title={c.connectedElements.headline}
            description={c.connectedElements.intro}
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {c.connectedElements.items.map((item) => (
              <GlassCard key={item.title} variant="os" className="!p-5 sm:!p-6">
                <h3 className="font-display text-lg font-semibold text-foreground">{item.title}</h3>
                <ul className="mt-4 space-y-2">
                  {item.points.map((point) => (
                    <li key={point} className="text-sm leading-relaxed text-muted-foreground">
                      {point}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
            {c.connectedElements.limitations}
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.notifications.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="notifications-heading"
      >
        <FadeIn>
          <SectionHeading
            id="notifications-heading"
            eyebrow={c.notifications.eyebrow}
            title={c.notifications.headline}
            description={c.notifications.body}
          />
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2">
            {c.notifications.benefits.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300/85" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-sm text-muted-foreground">{c.notifications.caveat}</p>
        </FadeIn>
      </Section>

      <Section
        id={c.connectedOs.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="connected-os-heading"
      >
        <FadeIn>
          <SectionHeading
            id="connected-os-heading"
            eyebrow={c.connectedOs.eyebrow}
            title={c.connectedOs.headline}
            description={c.connectedOs.body}
          />
          <div className="mt-8 flex flex-wrap gap-2">
            {c.connectedOs.systems.map((system) => (
              <span
                key={system}
                className="rounded-full border border-cyan-400/15 bg-cyan-950/20 px-3 py-1.5 text-xs font-medium text-cyan-100/90"
              >
                {system}
              </span>
            ))}
          </div>
          <ol className="mt-10 space-y-3">
            {c.connectedOs.sequence.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3 text-sm text-foreground/90"
              >
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </FadeIn>
      </Section>

      <Section
        id={c.patientBenefits.id}
        className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24"
        aria-labelledby="patient-benefits-heading"
      >
        <FadeIn>
          <SectionHeading
            id="patient-benefits-heading"
            eyebrow={c.patientBenefits.eyebrow}
            title={c.patientBenefits.headline}
          />
          <ul className="mt-10 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
            {c.patientBenefits.items.map((item) => (
              <li key={item.title}>
                <GlassCard variant="os" className="h-full !p-5 sm:!p-6">
                  <h3 className="font-display text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </GlassCard>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.clinicBenefits.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="clinic-benefits-heading"
      >
        <FadeIn>
          <SectionHeading
            id="clinic-benefits-heading"
            eyebrow={c.clinicBenefits.eyebrow}
            title={c.clinicBenefits.headline}
          />
          <ul className="mt-10 grid list-none gap-4 p-0 md:grid-cols-2">
            {c.clinicBenefits.items.map((item) => (
              <li key={item.title}>
                <GlassCard variant="os" className="h-full !p-5 sm:!p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-foreground">{item.title}</h3>
                    {item.future ? (
                      <span className="rounded-full border border-violet-400/30 bg-violet-950/30 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-100/95">
                        Future expansion
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </GlassCard>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.pilot.id}
        className="scroll-mt-28 border-b border-border/40 bg-sky-950/10 py-20 sm:py-24"
        aria-labelledby="pilot-heading"
      >
        <FadeIn>
          <div className="mb-6 flex items-center gap-3">
            <Shield className="h-5 w-5 text-sky-300/90" aria-hidden />
            <StatusBadge />
          </div>
          <SectionHeading
            id="pilot-heading"
            eyebrow={c.pilot.eyebrow}
            title={c.pilot.headline}
            description={c.pilot.intro}
          />
          <ul className="mt-10 grid list-none gap-3 p-0 sm:grid-cols-2">
            {c.pilot.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 rounded-xl border border-sky-400/15 bg-sky-950/20 px-4 py-3 text-sm text-foreground/90"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300/85" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-muted-foreground">
            {c.pilot.noSelfRegister}
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.faq.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24"
        aria-labelledby="faq-heading"
      >
        <FadeIn>
          <SectionHeading
            id="faq-heading"
            eyebrow={c.faq.eyebrow}
            title={c.faq.headline}
          />
          <div className="mt-10 space-y-3">
            {c.faq.items.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-white/[0.08] bg-black/15 px-5 py-4 open:bg-black/25"
              >
                <summary className="cursor-pointer list-none font-display text-base font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {item.q}
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.closing.id}
        className="scroll-mt-28 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.08),transparent_55%),rgb(4_8_16)] py-20 sm:py-24 md:py-28"
        aria-labelledby="closing-heading"
      >
        <FadeIn>
          <SectionHeading
            id="closing-heading"
            eyebrow={c.closing.eyebrow}
            title={c.closing.headline}
            description={c.closing.body}
          />
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
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

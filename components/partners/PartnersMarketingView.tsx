"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { Section } from "@/components/layout/section";
import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { PARTNERS_PAGE_CONTENT } from "@/lib/marketing/partnersPageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";

const c = PARTNERS_PAGE_CONTENT;

function polarToPct(index: number, total: number, radiusPct: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: 50 + radiusPct * Math.cos(angle),
    y: 50 + radiusPct * Math.sin(angle),
  };
}

function EcosystemNetworkViz({ nodes }: { nodes: readonly string[] }) {
  const reduceMotion = useReducedMotion();

  const layout = useMemo(
    () =>
      nodes.map((label, i) => ({
        label,
        ...polarToPct(i, nodes.length, 36),
        delay: i * 0.08,
      })),
    [nodes]
  );

  return (
    <div
      className="relative mx-auto w-full max-w-[min(100%,520px)]"
      role="img"
      aria-label="Global intelligence network connecting clinics, surgeons, educators, researchers, patients, and industry partners."
    >
      <div className="relative aspect-square min-h-[300px] w-full overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_40%,rgb(212_175_55_/0.14),transparent_55%),linear-gradient(180deg,rgb(255_255_255_/0.04),transparent)] shadow-[0_24px_80px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:min-h-[340px]">
        <svg className="absolute inset-0 h-full w-full text-amber-400" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden>
          {layout.map((n) => (
            <g key={n.label}>
              <line x1="50" y1="50" x2={n.x} y2={n.y} stroke="rgb(212 175 55 / 0.12)" strokeWidth="0.45" vectorEffect="non-scaling-stroke" />
              <line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="currentColor"
                strokeWidth="0.3"
                strokeDasharray="0.8 2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={reduceMotion ? "text-amber-400/30" : "fi-hero-network-line-out text-amber-400/45 [animation-duration:3.2s]"}
              />
            </g>
          ))}
        </svg>

        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-full border border-amber-400/30 bg-[rgb(8_12_20_/0.92)] px-4 py-2.5 text-center shadow-[0_0_32px_rgb(212_175_55_/0.18),inset_0_1px_0_rgb(255_255_255_/0.08)] sm:px-5 sm:py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-200/70 sm:text-[10px]">Central</p>
            <p className="mt-0.5 font-display text-[0.7rem] font-semibold leading-tight text-foreground sm:text-sm">Intelligence Network</p>
          </div>
        </div>

        {layout.map((n) => (
          <motion.div
            key={n.label}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: n.delay, duration: 0.45, ease: "easeOut" }}
          >
            <div className="rounded-lg border border-white/[0.08] bg-[rgb(10_14_22_/0.88)] px-2.5 py-1.5 text-center shadow-[0_8px_24px_rgb(0_0_0_/0.35)] backdrop-blur-sm sm:px-3 sm:py-2">
              <p className="whitespace-nowrap text-[0.65rem] font-medium text-foreground/90 sm:text-xs">{n.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function TrainingPathwayViz({ steps }: { steps: readonly string[] }) {
  return (
    <div className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.12),transparent_50%),linear-gradient(180deg,rgb(255_255_255_/0.045),transparent)] p-5 shadow-[0_24px_80px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:mt-14 sm:rounded-[2rem] sm:p-8 md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-amber-400/25 via-amber-400/10 to-transparent"
        style={{ transform: "translateX(-50%)" }}
      />
      <p className="relative text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
        Education infrastructure pathway
      </p>
      <div className="relative mt-10 space-y-8">
        {steps.map((step, index) => (
          <div key={step} className="relative flex flex-col items-center">
            <GlassCard variant="default" className="w-full max-w-md border-amber-400/10 !p-4 text-center sm:!p-5">
              <span className="font-mono text-[9px] font-semibold uppercase tabular-nums tracking-[0.18em] text-amber-200/55">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-sm font-medium leading-snug text-foreground sm:text-[0.9375rem]">{step}</p>
            </GlassCard>
            {index < steps.length - 1 ? (
              <ChevronDown className="mt-4 h-4 w-4 text-amber-400/45" strokeWidth={2} aria-hidden />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function BenefitCard({ title, body }: { title: string; body: string }) {
  return (
    <GlassCard variant="default" className="flex h-full flex-col border-amber-400/10">
      <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">{body}</p>
    </GlassCard>
  );
}

export function PartnersMarketingView() {
  return (
    <>
      <section
        id={c.hero.id}
        aria-labelledby={`${c.hero.id}-heading`}
        className="fi-grid relative overflow-hidden border-b border-border/50 bg-[rgb(4_6_12_/0.35)]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.45] [mask-image:radial-gradient(ellipse_at_50%_40%,black_20%,transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_-8%,rgb(212_175_55_/0.22),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_95%_5%,hsl(var(--primary)/0.16),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_88%,rgb(0_0_0_/0.6),transparent_52%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/[0.06] to-background" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
          <FadeIn>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-200/90 sm:text-[11px]">{c.hero.eyebrow}</p>
            <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent" aria-hidden />
            <h1
              id={`${c.hero.id}-heading`}
              className="mt-5 max-w-4xl font-display text-[2.1rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance drop-shadow-[0_2px_36px_rgb(0_0_0_/0.45)] sm:text-4xl md:text-5xl md:leading-[1.06] lg:max-w-5xl"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-foreground/88 sm:text-lg md:text-xl md:leading-relaxed">
              {c.hero.subheadline}
            </p>
            <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.hero.supportingCopy.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Button
                asChild
                size="lg"
                className={cn(
                  MARKETING_CTA_PRIMARY_CLASS,
                  "min-w-[12rem] shadow-[0_18px_52px_rgb(212_175_55_/0.18),inset_0_1px_0_rgb(255_255_255_/0.14)]"
                )}
              >
                <Link href={c.hero.primaryCta.href}>
                  {c.hero.primaryCta.label}
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem]")}>
                <Link href={c.hero.secondaryCta.href}>
                  {c.hero.secondaryCta.label}
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                </Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      <Section
        id={c.whyPartnerships.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.whyPartnerships.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.whyPartnerships.id}-heading`}
            eyebrow={c.whyPartnerships.eyebrow}
            title={c.whyPartnerships.headline}
            description={c.whyPartnerships.description}
            tone="intelligence"
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5">
            {c.whyPartnerships.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 2)}>
                  <BenefitCard title={card.title} body={card.body} />
                </FadeIn>
              </li>
            ))}
          </ul>
          <GlassCard className="mx-auto mt-12 max-w-3xl border-amber-400/14">
            <p className="text-center text-base leading-relaxed text-foreground sm:text-lg">{c.whyPartnerships.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.whoWePartnerWith.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.whoWePartnerWith.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.whoWePartnerWith.id}-heading`}
            eyebrow={c.whoWePartnerWith.eyebrow}
            title={c.whoWePartnerWith.headline}
            description={c.whoWePartnerWith.description}
          />
          <ul className="mt-12 grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {c.whoWePartnerWith.categories.map((category, i) => (
              <li key={category}>
                <FadeIn delay={0.03 * (i % 5)}>
                  <GlassCard
                    variant="default"
                    className="flex h-full min-h-[5rem] items-center justify-center border-amber-400/10 !p-4 text-center sm:!p-5"
                  >
                    <p className="text-sm font-medium leading-snug text-foreground sm:text-[0.9375rem]">{category}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.clinicGroupPartnerships.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.clinicGroupPartnerships.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.clinicGroupPartnerships.id}-heading`}
            eyebrow={c.clinicGroupPartnerships.eyebrow}
            title={c.clinicGroupPartnerships.headline}
            description={c.clinicGroupPartnerships.description}
            tone="intelligence"
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {c.clinicGroupPartnerships.benefits.map((benefit, i) => (
              <li key={benefit.title}>
                <FadeIn delay={0.04 * (i % 3)}>
                  <BenefitCard title={benefit.title} body={benefit.body} />
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.educationPartnerships.id}
        className="border-b border-border/50 bg-muted/[0.05] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.educationPartnerships.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.educationPartnerships.id}-heading`}
            eyebrow={c.educationPartnerships.eyebrow}
            title={c.educationPartnerships.headline}
            description={c.educationPartnerships.description}
          />
          <TrainingPathwayViz steps={c.educationPartnerships.infrastructure} />
        </FadeIn>
      </Section>

      <Section
        id={c.researchPartnerships.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.researchPartnerships.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.researchPartnerships.id}-heading`}
            eyebrow={c.researchPartnerships.eyebrow}
            title={c.researchPartnerships.headline}
            description={c.researchPartnerships.description}
            tone="intelligence"
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {c.researchPartnerships.opportunities.map((item, i) => (
              <li key={item.title}>
                <FadeIn delay={0.04 * (i % 3)}>
                  <BenefitCard title={item.title} body={item.body} />
                </FadeIn>
              </li>
            ))}
          </ul>
          <GlassCard className="mx-auto mt-12 max-w-3xl border-amber-400/14">
            <p className="text-center text-base leading-relaxed text-foreground sm:text-lg">{c.researchPartnerships.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.deviceTechnologyPartnerships.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.deviceTechnologyPartnerships.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.deviceTechnologyPartnerships.id}-heading`}
            eyebrow={c.deviceTechnologyPartnerships.eyebrow}
            title={c.deviceTechnologyPartnerships.headline}
            description={c.deviceTechnologyPartnerships.description}
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {c.deviceTechnologyPartnerships.opportunities.map((item, i) => (
              <li key={item.title}>
                <FadeIn delay={0.04 * (i % 3)}>
                  <BenefitCard title={item.title} body={item.body} />
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.globalStandardisation.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.globalStandardisation.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.globalStandardisation.id}-heading`}
            eyebrow={c.globalStandardisation.eyebrow}
            title={c.globalStandardisation.headline}
            description={c.globalStandardisation.description}
            tone="intelligence"
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {c.globalStandardisation.standards.map((item, i) => (
              <li key={item.title}>
                <FadeIn delay={0.04 * (i % 3)}>
                  <BenefitCard title={item.title} body={item.body} />
                </FadeIn>
              </li>
            ))}
          </ul>
          <GlassCard className="mx-auto mt-12 max-w-3xl border-amber-400/14">
            <p className="text-center text-base leading-relaxed text-foreground sm:text-lg">{c.globalStandardisation.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.longTermVision.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.longTermVision.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.longTermVision.id}-heading`}
            eyebrow={c.longTermVision.eyebrow}
            title={c.longTermVision.headline}
            description={c.longTermVision.description}
            tone="intelligence"
          />
          <div className="mt-12 flex flex-col items-center gap-10 lg:gap-12">
            <EcosystemNetworkViz nodes={c.longTermVision.participants} />
            <GlassCard className="max-w-3xl border-amber-400/14 text-center">
              <p className="text-base leading-relaxed text-foreground sm:text-lg">{c.longTermVision.closingStatement}</p>
            </GlassCard>
          </div>
        </FadeIn>
      </Section>

      <section
        id={c.finalCta.id}
        className="border-t border-border/50 bg-gradient-to-b from-background to-muted/[0.12] pb-20 pt-14 sm:pb-24 sm:pt-16 md:pt-20"
        aria-labelledby={`${c.finalCta.id}-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="rounded-[1.75rem] border border-amber-400/18 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-7 shadow-[0_28px_90px_rgb(0_0_0_/0.48),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:rounded-[2rem] sm:p-10 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/85">{c.finalCta.eyebrow}</p>
                  <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent" aria-hidden />
                  <h2
                    id={`${c.finalCta.id}-heading`}
                    className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance md:text-4xl lg:text-5xl"
                  >
                    {c.finalCta.headline}
                  </h2>
                  <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {c.finalCta.supportingCopy.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
                <div className="flex w-full max-w-md flex-col gap-3 lg:max-w-none lg:justify-self-end">
                  <Button asChild size="lg" className={MARKETING_CTA_PRIMARY_CLASS}>
                    <Link href={c.finalCta.primaryCta.href}>
                      {c.finalCta.primaryCta.label}
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className={MARKETING_CTA_SECONDARY_CLASS}>
                    <Link href={c.finalCta.secondaryCta.href}>
                      {c.finalCta.secondaryCta.label}
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

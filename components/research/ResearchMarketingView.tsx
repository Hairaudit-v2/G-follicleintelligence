"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { Section } from "@/components/layout/section";
import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { RESEARCH_PAGE_CONTENT } from "@/lib/marketing/researchPageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

const c = RESEARCH_PAGE_CONTENT;

function polarToPct(index: number, total: number, radiusPct: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: 50 + radiusPct * Math.cos(angle),
    y: 50 + radiusPct * Math.sin(angle),
  };
}

function ResearchNetworkViz({ nodes, centerLabel }: { nodes: readonly string[]; centerLabel: string }) {
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
      aria-label={`Multicentre research network: ${nodes.join(", ")} connected to a central ${centerLabel}.`}
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
            <p className="mt-0.5 font-display text-[0.7rem] font-semibold leading-tight text-foreground sm:text-sm">{centerLabel}</p>
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

function TitleBodyCards({ items }: { items: readonly { title: string; body: string }[] }) {
  return (
    <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {items.map((item, i) => (
        <li key={item.title}>
          <FadeIn delay={0.04 * (i % 3)}>
            <GlassCard variant="problem" className="group flex h-full flex-col transition-[border-color,transform] duration-300 hover:-translate-y-0.5">
              <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">{item.body}</p>
            </GlassCard>
          </FadeIn>
        </li>
      ))}
    </ul>
  );
}

function DomainCards({ items }: { items: readonly { title: string; body: string }[] }) {
  return (
    <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {items.map((item, i) => (
        <li key={item.title}>
          <FadeIn delay={0.03 * (i % 4)}>
            <GlassCard variant="default" className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/18">
              <span className="font-mono text-[9px] font-semibold uppercase tabular-nums tracking-[0.16em] text-amber-200/45">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-sm font-semibold leading-snug text-foreground sm:text-base">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </GlassCard>
          </FadeIn>
        </li>
      ))}
    </ul>
  );
}

function MetricGrid({ items, columns = 4 }: { items: readonly string[]; columns?: 2 | 3 | 4 }) {
  const gridClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <ul className={cn("mt-12 grid list-none gap-3 p-0 sm:gap-4", gridClass)}>
      {items.map((item, i) => (
        <li key={item}>
          <FadeIn delay={0.03 * (i % 4)}>
            <GlassCard className="group flex h-full flex-col border-white/[0.07] !p-4 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/18 sm:!p-5">
              <span className="font-mono text-[9px] font-semibold uppercase tabular-nums tracking-[0.16em] text-amber-200/45">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-sm font-medium leading-snug text-foreground sm:text-[0.9375rem]">{item}</p>
            </GlassCard>
          </FadeIn>
        </li>
      ))}
    </ul>
  );
}

function IntelligenceCapabilityCards({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {items.map((item, i) => (
        <li key={item}>
          <FadeIn delay={0.04 * (i % 4)}>
            <GlassCard
              variant="default"
              className="group flex h-full flex-col border-violet-500/[0.08] bg-gradient-to-br from-white/[0.04] via-slate-950/[0.04] to-violet-950/[0.05] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-violet-400/18"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-violet-400/20 bg-violet-950/[0.2] text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-200/70"
                >
                  AI
                </span>
                <p className="text-sm font-medium leading-relaxed text-foreground sm:text-[0.9375rem]">{item}</p>
              </div>
            </GlassCard>
          </FadeIn>
        </li>
      ))}
    </ul>
  );
}

function BenchmarkCategoryCards({
  categories,
}: {
  categories: readonly { title: string; items: readonly string[] }[];
}) {
  return (
    <ul className="mt-12 grid list-none gap-5 p-0 sm:grid-cols-2 lg:gap-6">
      {categories.map((category, i) => (
        <li key={category.title}>
          <FadeIn delay={0.05 * (i % 2)}>
            <GlassCard variant="os" className="flex h-full flex-col border-white/[0.07]">
              <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">{category.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {category.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400/55" />
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </FadeIn>
        </li>
      ))}
    </ul>
  );
}

function GovernancePrinciples({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-12 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
      {items.map((item, i) => (
        <li key={item}>
          <FadeIn delay={0.03 * (i % 4)}>
            <GlassCard variant="default" className="flex h-full flex-col border-cyan-500/[0.08] bg-gradient-to-br from-white/[0.04] via-slate-950/[0.04] to-cyan-950/[0.04]">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-950/[0.2] text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-200/70"
                >
                  ✓
                </span>
                <p className="text-sm font-medium leading-relaxed text-foreground sm:text-[0.9375rem]">{item}</p>
              </div>
            </GlassCard>
          </FadeIn>
        </li>
      ))}
    </ul>
  );
}

export function ResearchMarketingView() {
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
        id={c.evidenceGap.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.evidenceGap.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.evidenceGap.id}-heading`}
            eyebrow={c.evidenceGap.eyebrow}
            title={c.evidenceGap.headline}
            description={c.evidenceGap.description}
          />
          <TitleBodyCards items={c.evidenceGap.cards} />
          <GlassCard className="mx-auto mt-12 max-w-3xl border-amber-400/14">
            <p className="text-center text-base leading-relaxed text-foreground sm:text-lg">{c.evidenceGap.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.researchDomains.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.researchDomains.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.researchDomains.id}-heading`} eyebrow={c.researchDomains.eyebrow} title={c.researchDomains.headline} />
          <DomainCards items={c.researchDomains.domains} />
        </FadeIn>
      </Section>

      <Section
        id={c.globalRegistry.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.globalRegistry.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.globalRegistry.id}-heading`}
            eyebrow={c.globalRegistry.eyebrow}
            title={c.globalRegistry.headline}
            description={c.globalRegistry.description}
          />
          <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">{c.globalRegistry.registryFieldsLabel}</p>
          <MetricGrid items={c.globalRegistry.registryFields} columns={3} />
          <GlassCard className="mx-auto mt-12 max-w-2xl border-amber-400/14 text-center">
            <p className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{c.globalRegistry.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.aiInfrastructure.id}
        className="border-b border-border/50 bg-muted/[0.05] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.aiInfrastructure.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.aiInfrastructure.id}-heading`}
            tone="intelligence"
            eyebrow={c.aiInfrastructure.eyebrow}
            title={c.aiInfrastructure.headline}
            description={c.aiInfrastructure.description}
          />
          <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200/75">{c.aiInfrastructure.opportunitiesLabel}</p>
          <IntelligenceCapabilityCards items={c.aiInfrastructure.opportunities} />
          <GlassCard className="mx-auto mt-12 max-w-3xl border-violet-400/14">
            <p className="text-center text-base leading-relaxed text-foreground sm:text-lg">{c.aiInfrastructure.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.benchmarking.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.benchmarking.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.benchmarking.id}-heading`}
            eyebrow={c.benchmarking.eyebrow}
            title={c.benchmarking.headline}
            description={c.benchmarking.description}
          />
          <BenchmarkCategoryCards categories={c.benchmarking.categories} />
        </FadeIn>
      </Section>

      <Section
        id={c.multicentreNetwork.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.multicentreNetwork.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.multicentreNetwork.id}-heading`}
            eyebrow={c.multicentreNetwork.eyebrow}
            title={c.multicentreNetwork.headline}
            description={c.multicentreNetwork.description}
          />
          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">{c.multicentreNetwork.capabilitiesLabel}</p>
              <ul className="mt-5 space-y-3">
                {c.multicentreNetwork.capabilities.map((capability, index) => (
                  <li key={capability}>
                    <GlassCard className="border-white/[0.07] !p-4 sm:!p-5">
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em] text-amber-200/50">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <p className="text-sm leading-relaxed text-foreground sm:text-[0.9375rem]">{capability}</p>
                      </div>
                    </GlassCard>
                  </li>
                ))}
              </ul>
            </div>
            <ResearchNetworkViz nodes={c.multicentreNetwork.networkNodes} centerLabel={c.multicentreNetwork.networkCenterLabel} />
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.governance.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.governance.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.governance.id}-heading`}
            tone="audit"
            eyebrow={c.governance.eyebrow}
            title={c.governance.headline}
            description={c.governance.description}
          />
          <GovernancePrinciples items={c.governance.principles} />
          <GlassCard className="mx-auto mt-12 max-w-3xl border-cyan-400/14">
            <p className="text-center text-base leading-relaxed text-foreground sm:text-lg">{c.governance.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.collaboration.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.collaboration.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.collaboration.id}-heading`}
            eyebrow={c.collaboration.eyebrow}
            title={c.collaboration.headline}
            description={c.collaboration.description}
          />
          <TitleBodyCards items={c.collaboration.pathways} />
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

"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { Section } from "@/components/layout/section";
import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { INVESTORS_PAGE_CONTENT } from "@/lib/marketing/investorsPageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

const c = INVESTORS_PAGE_CONTENT;

function polarToPct(index: number, total: number, radiusPct: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: 50 + radiusPct * Math.cos(angle),
    y: 50 + radiusPct * Math.sin(angle),
  };
}

function IntelligenceNetworkViz({ nodes }: { nodes: readonly string[] }) {
  const reduceMotion = useReducedMotion();

  const layout = useMemo(
    () =>
      nodes.map((label, i) => ({
        label,
        ...polarToPct(i, nodes.length, 36),
        delay: i * 0.1,
      })),
    [nodes]
  );

  return (
    <div
      className="relative mx-auto w-full max-w-[min(100%,480px)]"
      role="img"
      aria-label="Intelligence network: clinics, patients, surgeries, treatments, staff, and outcomes connected to a central learning system."
    >
      <div className="relative aspect-square min-h-[280px] w-full overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_40%,rgb(212_175_55_/0.14),transparent_55%),linear-gradient(180deg,rgb(255_255_255_/0.04),transparent)] shadow-[0_24px_80px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:min-h-[320px]">
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

function GrowthProgressionTimeline({ stages }: { stages: readonly string[] }) {
  return (
    <>
      <div className="relative mt-12 hidden lg:block">
        <div
          className="pointer-events-none absolute left-0 right-0 top-[42%] h-px bg-gradient-to-r from-transparent via-amber-400/25 to-transparent"
          aria-hidden
        />
        <div className="overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/25">
          <ol className="flex min-w-min items-stretch gap-0 px-1">
            {stages.map((stage, index) => (
              <Fragment key={stage}>
                <li className="flex w-[7.35rem] shrink-0 flex-col xl:w-[7.75rem]">
                  <GlassCard variant="default" className="h-full border-amber-400/10 !p-3.5 !shadow-[0_12px_40px_rgb(0_0_0_/0.28)] sm:!p-4">
                    <span className="font-mono text-[9px] font-semibold uppercase tabular-nums tracking-[0.18em] text-amber-200/55">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-2 text-[0.75rem] font-medium leading-snug text-foreground xl:text-[0.8125rem]">{stage}</p>
                  </GlassCard>
                </li>
                {index < stages.length - 1 ? (
                  <li className="flex w-6 shrink-0 items-center justify-center self-center pt-6 xl:w-7" aria-hidden>
                    <ChevronRight className="h-3.5 w-3.5 text-amber-400/45" strokeWidth={2} />
                  </li>
                ) : null}
              </Fragment>
            ))}
          </ol>
        </div>
      </div>

      <ol className="relative mx-auto mt-10 max-w-3xl space-y-0 border-l border-amber-400/25 pl-6 sm:mt-12 sm:pl-8 md:max-w-4xl lg:hidden">
        {stages.map((stage, index) => (
          <li key={stage} className="relative pb-7 last:pb-0 sm:pb-9">
            <span
              aria-hidden
              className="absolute -left-[19px] top-2 flex h-3 w-3 items-center justify-center rounded-full border border-amber-300/45 bg-gradient-to-br from-amber-200/55 to-amber-800/30 shadow-[0_0_16px_rgb(212_175_55_/0.35)] sm:-left-[21px]"
            />
            <GlassCard variant="default" className="border-amber-400/10 !shadow-[0_12px_40px_rgb(0_0_0_/0.28)]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">
                Stage {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-[0.95rem] font-medium leading-snug text-foreground sm:text-lg">{stage}</p>
            </GlassCard>
          </li>
        ))}
      </ol>
    </>
  );
}

function ComparisonListCard({
  title,
  items,
  variant,
}: {
  title: string;
  items: readonly string[];
  variant: "muted" | "highlight";
}) {
  const isHighlight = variant === "highlight";

  return (
    <GlassCard variant={isHighlight ? "os" : "default"} className={cn("h-full !p-5 sm:!p-6 md:!p-8", isHighlight && "border-amber-400/15")}>
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.22em]",
          isHighlight ? "text-amber-200/80" : "text-muted-foreground"
        )}
      >
        {title}
      </p>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              isHighlight
                ? "border-amber-400/12 bg-amber-950/[0.08] text-foreground/95"
                : "border-white/[0.06] bg-white/[0.02] text-muted-foreground"
            )}
          >
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

function ModuleChip({ name, variant }: { name: string; variant: "current" | "future" }) {
  const isFuture = variant === "future";

  return (
    <GlassCard
      variant={isFuture ? "default" : "os"}
      className={cn(
        "flex h-full min-h-[4.5rem] items-center justify-center !p-4 text-center",
        isFuture && "border-dashed border-amber-400/20 bg-amber-950/[0.04]"
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold uppercase tracking-[0.1em]",
          isFuture ? "text-amber-200/75" : "text-amber-100/95"
        )}
      >
        {name}
      </p>
    </GlassCard>
  );
}

export function InvestorsMarketingView() {
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
        id={c.marketOpportunity.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.marketOpportunity.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.marketOpportunity.id}-heading`}
            eyebrow={c.marketOpportunity.eyebrow}
            title={c.marketOpportunity.headline}
            description={c.marketOpportunity.description}
            tone="intelligence"
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {c.marketOpportunity.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 4)}>
                  <GlassCard variant="default" className="flex h-full flex-col border-amber-400/10">
                    <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">{card.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
          <GlassCard className="mx-auto mt-12 max-w-3xl border-amber-400/14">
            <p className="text-center text-base leading-relaxed text-foreground sm:text-lg">{c.marketOpportunity.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.fragmentation.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.fragmentation.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.fragmentation.id}-heading`}
            eyebrow={c.fragmentation.eyebrow}
            title={c.fragmentation.headline}
            description={c.fragmentation.description}
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {c.fragmentation.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 3)}>
                  <GlassCard variant="problem" className="flex h-full flex-col">
                    <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">{card.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
          <GlassCard className="mx-auto mt-12 max-w-3xl border-amber-400/14">
            <p className="text-center text-base leading-relaxed text-foreground sm:text-lg">{c.fragmentation.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.verticalInfrastructure.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.verticalInfrastructure.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.verticalInfrastructure.id}-heading`}
            eyebrow={c.verticalInfrastructure.eyebrow}
            title={c.verticalInfrastructure.headline}
            description={c.verticalInfrastructure.description}
            tone="intelligence"
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
            <ComparisonListCard
              title={c.verticalInfrastructure.horizontal.title}
              items={c.verticalInfrastructure.horizontal.items}
              variant="muted"
            />
            <ComparisonListCard
              title={c.verticalInfrastructure.vertical.title}
              items={c.verticalInfrastructure.vertical.items}
              variant="highlight"
            />
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.dataMoat.id}
        className="border-b border-border/50 bg-muted/[0.05] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.dataMoat.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.dataMoat.id}-heading`}
            eyebrow={c.dataMoat.eyebrow}
            title={c.dataMoat.headline}
            description={c.dataMoat.description}
          />
          <GrowthProgressionTimeline stages={c.dataMoat.progression} />
          <GlassCard className="mx-auto mt-12 max-w-2xl border-amber-400/14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">At scale</p>
            <p className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {c.dataMoat.closingStatement}
            </p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.networkEffects.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.networkEffects.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.networkEffects.id}-heading`}
            eyebrow={c.networkEffects.eyebrow}
            title={c.networkEffects.headline}
            description={c.networkEffects.description}
            tone="intelligence"
          />
          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">Compounding effects</p>
              <ul className="mt-5 space-y-3">
                {c.networkEffects.compoundingEffects.map((effect, index) => (
                  <li key={effect}>
                    <GlassCard className="border-white/[0.07] !p-4 sm:!p-5">
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em] text-amber-200/50">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <p className="text-sm leading-relaxed text-foreground sm:text-[0.9375rem]">{effect}</p>
                      </div>
                    </GlassCard>
                  </li>
                ))}
              </ul>
            </div>
            <IntelligenceNetworkViz nodes={c.networkEffects.networkNodes} />
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.platformEconomics.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.platformEconomics.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.platformEconomics.id}-heading`}
            eyebrow={c.platformEconomics.eyebrow}
            title={c.platformEconomics.headline}
            description={c.platformEconomics.description}
          />
          <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">
            Why retention becomes powerful
          </p>
          <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {c.platformEconomics.retentionCards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 3)}>
                  <GlassCard variant="default" className="flex h-full flex-col border-amber-400/10">
                    <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">{card.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
          <GlassCard className="mx-auto mt-12 max-w-3xl border-amber-400/14">
            <p className="text-center text-base leading-relaxed text-foreground sm:text-lg">{c.platformEconomics.closingStatement}</p>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.futureLayers.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.futureLayers.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.futureLayers.id}-heading`}
            eyebrow={c.futureLayers.eyebrow}
            title={c.futureLayers.headline}
            tone="intelligence"
          />
          <div className="mt-12 space-y-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">Current systems</p>
              <ul className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {c.futureLayers.currentSystems.map((name) => (
                  <li key={name}>
                    <ModuleChip name={name} variant="current" />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">Future systems</p>
              <ul className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
                {c.futureLayers.futureSystems.map((name) => (
                  <li key={name}>
                    <ModuleChip name={name} variant="future" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.longTermVision.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.longTermVision.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.longTermVision.id}-heading`} eyebrow={c.longTermVision.eyebrow} title={c.longTermVision.headline} />
          <GlassCard className="mt-10 max-w-3xl border-amber-400/12">
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.longTermVision.paragraphs.map((paragraph) => (
                <p key={paragraph} className={paragraph === "Our belief is simple." ? "font-medium text-foreground" : undefined}>
                  {paragraph}
                </p>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      <section
        id={c.finalStatement.id}
        className="border-t border-border/50 bg-gradient-to-b from-background to-muted/[0.12] pb-20 pt-14 sm:pb-24 sm:pt-16 md:pt-20"
        aria-labelledby={`${c.finalStatement.id}-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="rounded-[1.75rem] border border-amber-400/18 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-7 shadow-[0_28px_90px_rgb(0_0_0_/0.48),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:rounded-[2rem] sm:p-10 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/85">{c.finalStatement.eyebrow}</p>
                  <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent" aria-hidden />
                  <h2
                    id={`${c.finalStatement.id}-heading`}
                    className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance md:text-4xl lg:text-5xl"
                  >
                    {c.finalStatement.headline}
                  </h2>
                  <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {c.finalStatement.supportingCopy.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
                <div className="flex w-full max-w-md flex-col gap-3 lg:max-w-none lg:justify-self-end">
                  <Button asChild size="lg" className={MARKETING_CTA_PRIMARY_CLASS}>
                    <Link href={c.finalStatement.primaryCta.href}>
                      {c.finalStatement.primaryCta.label}
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className={MARKETING_CTA_SECONDARY_CLASS}>
                    <Link href={c.finalStatement.secondaryCta.href}>
                      {c.finalStatement.secondaryCta.label}
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

"use client";

import { Fragment } from "react";
import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { FiMarketingHealthcareStackSection } from "@/components/home/FiMarketingHealthcareStackSection";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { ECOSYSTEM_ARCHITECTURE_PAGE_CONTENT } from "@/lib/marketing/ecosystemArchitecturePageContent";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight, GitBranch } from "lucide-react";

const c = ECOSYSTEM_ARCHITECTURE_PAGE_CONTENT;
const ecosystemLayers = HOME_PAGE_CONTENT.onePlatform.layers;

/**
 * Stable anchor id for an OS module card, e.g. `PatientOS` → `patient-os`, `LeadFlow` → `leadflow`.
 * These are the link targets used by the homepage platform-system cards
 * (`/platform/ecosystem#<id>`).
 */
function moduleAnchorId(name: string): string {
  const trimmed = name.trim();
  if (/OS$/.test(trimmed)) return `${trimmed.slice(0, -2).toLowerCase()}-os`;
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function OsModuleCard({
  index,
  name,
  description,
}: {
  index: number;
  name: string;
  description: string;
}) {
  return (
    // Wrapper carries the stable anchor id + scroll offset so deep links from the homepage land
    // below the sticky header without overlap (scroll-margin causes no layout shift).
    <div id={moduleAnchorId(name)} className="h-full scroll-mt-28">
      <GlassCard
        variant="os"
        className="group flex h-full min-h-[10.5rem] flex-col sm:min-h-[11.5rem]"
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
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </GlassCard>
    </div>
  );
}

function EcosystemLayerStack() {
  let moduleIndex = 0;

  return (
    <div className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.12),transparent_50%),linear-gradient(180deg,rgb(255_255_255_/0.045),transparent)] p-5 shadow-[0_24px_80px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:mt-14 sm:rounded-[2rem] sm:p-8 md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-amber-400/25 via-amber-400/10 to-transparent"
        style={{ transform: "translateX(-50%)" }}
      />
      <p className="relative text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
        {c.architecture.caption}
      </p>
      <div className="relative mt-10 space-y-10">
        {ecosystemLayers.map((layer, bandIdx) => {
          const layerDescription =
            c.architecture.layerDescriptions[
              layer.title as keyof typeof c.architecture.layerDescriptions
            ];

          return (
            <div key={layer.title}>
              <div className="relative flex flex-col items-center">
                <span className="rounded-full border border-amber-400/20 bg-[rgb(6_10_18_/0.85)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100/90 shadow-[0_0_24px_rgb(212_175_55_/0.08)]">
                  {layer.title}
                </span>
                {layerDescription ? (
                  <p className="mt-4 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                    {layerDescription}
                  </p>
                ) : null}
                <div
                  className={cn(
                    "mt-5 grid w-full gap-3",
                    layer.modules.length === 1 && "mx-auto max-w-md",
                    layer.modules.length === 2 && "sm:grid-cols-2",
                    layer.modules.length === 3 && "sm:grid-cols-2 lg:grid-cols-3",
                    layer.modules.length >= 4 && "sm:grid-cols-2 lg:grid-cols-4"
                  )}
                >
                  {layer.modules.map((mod) => {
                    const index = moduleIndex++;
                    return (
                      <OsModuleCard
                        key={mod.name}
                        index={index}
                        name={mod.name}
                        description={mod.description}
                      />
                    );
                  })}
                </div>
              </div>
              {bandIdx < ecosystemLayers.length - 1 ? (
                <div
                  className="mx-auto mt-10 flex h-10 w-px flex-col items-center justify-center bg-gradient-to-b from-amber-400/35 via-amber-400/12 to-transparent"
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DigitalTwinTimeline({ stages }: { stages: readonly string[] }) {
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
                <li className="flex w-[7.5rem] shrink-0 flex-col xl:w-[8rem]">
                  <GlassCard
                    variant="default"
                    className="h-full border-amber-400/10 !p-3.5 !shadow-[0_12px_40px_rgb(0_0_0_/0.28)] sm:!p-4"
                  >
                    <span className="font-mono text-[9px] font-semibold uppercase tabular-nums tracking-[0.18em] text-amber-200/55">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-2 text-[0.75rem] font-medium leading-snug text-foreground xl:text-[0.8125rem]">
                      {stage}
                    </p>
                  </GlassCard>
                </li>
                {index < stages.length - 1 ? (
                  <li
                    className="flex w-6 shrink-0 items-center justify-center self-center pt-6 xl:w-7"
                    aria-hidden
                  >
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
            <GlassCard
              variant="default"
              className="border-amber-400/10 !shadow-[0_12px_40px_rgb(0_0_0_/0.28)]"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">
                Stage {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-[0.95rem] font-medium leading-snug text-foreground sm:text-lg">
                {stage}
              </p>
            </GlassCard>
          </li>
        ))}
      </ol>
    </>
  );
}

export function EcosystemArchitectureView() {
  return (
    <>
      <section
        id={c.hero.id}
        aria-labelledby={`${c.hero.id}-heading`}
        className="fi-grid relative overflow-hidden border-b border-border/50"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.45] [mask-image:radial-gradient(ellipse_at_50%_40%,black_20%,transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_-8%,rgb(212_175_55_/0.2),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_95%_5%,hsl(var(--primary)/0.18),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_88%,rgb(0_0_0_/0.55),transparent_52%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/[0.04] to-background" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
          <FadeIn>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-200/90 sm:text-[11px]">
              {c.hero.eyebrow}
            </p>
            <div
              className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent"
              aria-hidden
            />
            <h1
              id={`${c.hero.id}-heading`}
              className="mt-5 max-w-4xl font-display text-[2.1rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance drop-shadow-[0_2px_36px_rgb(0_0_0_/0.45)] sm:text-4xl md:text-5xl md:leading-[1.06] lg:max-w-5xl"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-foreground/88 sm:text-lg md:text-xl md:leading-relaxed">
              {c.hero.subheadline}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.hero.body}
            </p>
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
              <Button
                asChild
                variant="outline"
                size="lg"
                className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem]")}
              >
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
        id={c.architecture.id}
        className="scroll-mt-28 border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.architecture.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.architecture.id}-heading`}
            eyebrow={c.architecture.eyebrow}
            title={c.architecture.headline}
            description={c.architecture.intro}
          />
          <EcosystemLayerStack />
        </FadeIn>
      </Section>

      <FiMarketingHealthcareStackSection />

      <Section
        id={c.connectedIntelligence.id}
        className="border-b border-border/50 bg-muted/[0.05] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.connectedIntelligence.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.connectedIntelligence.id}-heading`}
            eyebrow={c.connectedIntelligence.eyebrow}
            title={c.connectedIntelligence.headline}
            description={c.connectedIntelligence.intro}
          />
          <ul className="mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:gap-5">
            {c.connectedIntelligence.insights.map((insight, index) => (
              <li key={insight}>
                <GlassCard className="h-full border-white/[0.07] !p-5 sm:!p-6">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-950/25">
                      <GitBranch className="h-4 w-4 text-cyan-300/80" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em] text-amber-200/50">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="mt-2 text-sm leading-relaxed text-foreground sm:text-[0.9375rem]">
                        {insight}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.digitalTwin.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.digitalTwin.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.digitalTwin.id}-heading`}
            eyebrow={c.digitalTwin.eyebrow}
            title={c.digitalTwin.headline}
            description={c.digitalTwin.intro}
          />
          <DigitalTwinTimeline stages={c.digitalTwin.stages} />
        </FadeIn>
      </Section>

      <Section
        id={c.verticalComparison.id}
        className="border-b border-border/50 bg-muted/[0.05] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.verticalComparison.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.verticalComparison.id}-heading`}
            eyebrow={c.verticalComparison.eyebrow}
            title={c.verticalComparison.headline}
            description={c.verticalComparison.intro}
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
            <GlassCard className="border-white/[0.07] !p-5 sm:!p-6 md:!p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {c.verticalComparison.horizontalCrm.title}
              </p>
              <ul className="mt-6 space-y-3">
                {c.verticalComparison.horizontalCrm.items.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-muted-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard variant="os" className="border-amber-400/15 !p-5 sm:!p-6 md:!p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/80">
                {c.verticalComparison.follicleIntelligence.title}
              </p>
              <ul className="mt-6 space-y-3">
                {c.verticalComparison.follicleIntelligence.items.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-amber-400/12 bg-amber-950/[0.08] px-4 py-3 text-sm text-foreground/95"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.finalCta.id}
        className="border-b border-border/50 bg-gradient-to-b from-muted/[0.06] via-background to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.finalCta.id}-heading`}
      >
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/75">
              {c.finalCta.eyebrow}
            </p>
            <h2
              id={`${c.finalCta.id}-heading`}
              className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl"
            >
              {c.finalCta.headline}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.finalCta.body}
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                asChild
                size="lg"
                className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[12rem]")}
              >
                <Link href={c.finalCta.cta.href}>
                  {c.finalCta.cta.label}
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

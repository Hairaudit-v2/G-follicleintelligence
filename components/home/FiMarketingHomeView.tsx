import dynamic from "next/dynamic";
import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

import { FiMarketingAuthoritySection } from "@/components/home/FiMarketingAuthoritySection";
import { FiMarketingClinicalEcosystemSection } from "@/components/home/FiMarketingClinicalEcosystemSection";
import { FiMarketingClinicsAtEveryStageSection } from "@/components/home/FiMarketingClinicsAtEveryStageSection";
import { FiMarketingEnterpriseInfrastructureSection } from "@/components/home/FiMarketingEnterpriseInfrastructureSection";
import { FiMarketingEngineeringCredibilitySection } from "@/components/home/FiMarketingEngineeringCredibilitySection";
import { FiMarketingIndustrySoftwareGapSection } from "@/components/home/FiMarketingIndustrySoftwareGapSection";
import { FiMarketingIntelligenceNetworkSection } from "@/components/home/FiMarketingIntelligenceNetworkSection";
import { FiMarketingInvestorPositioningSection } from "@/components/home/FiMarketingInvestorPositioningSection";
import { FiMarketingMoonshotSection } from "@/components/home/FiMarketingMoonshotSection";
import { FiMarketingPlatformProgressSection } from "@/components/home/FiMarketingPlatformProgressSection";
import { PartnersInvestorsStrip } from "@/components/marketing/PartnersInvestorsStrip";

const FiMarketingOsHeroVisual = dynamic(
  () =>
    import("@/components/home/FiMarketingOsHeroVisual").then((m) => ({
      default: m.FiMarketingOsHeroVisual,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="relative mx-auto aspect-[1/1.05] min-h-[300px] w-full max-w-[min(100%,560px)] animate-pulse rounded-[1.75rem] border border-amber-400/12 bg-[rgb(8_12_20_/0.92)] shadow-[0_24px_80px_rgb(0_0_0_/0.45)] sm:min-h-[360px] md:min-h-[400px]"
      />
    ),
  }
);

function ChipList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-xl border border-white/[0.06] border-l-2 border-l-amber-400/45 bg-gradient-to-r from-amber-400/[0.07] via-transparent to-transparent px-4 py-3 text-sm leading-snug text-foreground/95 shadow-[inset_0_1px_0_rgb(255_255_255_/0.04)] transition-[border-color,background-color,box-shadow] duration-200 hover:border-amber-400/30 hover:bg-amber-400/[0.06] hover:shadow-[inset_0_1px_0_rgb(255_255_255_/0.06)]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function TrainingTrackGrid({
  tracks,
  poweredByLabel,
  poweredBy,
}: {
  tracks: typeof HOME_PAGE_CONTENT.training.tracks;
  poweredByLabel: string;
  poweredBy: string;
}) {
  return (
    <div className="mt-10">
      <div className="rounded-[1.35rem] border border-amber-400/15 bg-gradient-to-br from-amber-950/[0.12] via-transparent to-transparent p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">{poweredByLabel}</p>
        <p className="mt-2 font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">{poweredBy}</p>
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tracks.map((track, i) => (
          <li key={track.title}>
            <GlassCard className="group h-full border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/20">
              <div className="flex items-start gap-3">
                <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em] text-amber-200/45">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{track.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{track.detail}</p>
                </div>
              </div>
            </GlassCard>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FiMarketingHomeView() {
  const c = HOME_PAGE_CONTENT;

  return (
    <>
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="fi-grid relative overflow-hidden border-b border-border/50"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.45] [mask-image:radial-gradient(ellipse_at_50%_40%,black_20%,transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_-8%,rgb(212_175_55_/0.2),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_95%_5%,hsl(var(--primary)/0.18),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_88%,rgb(0_0_0_/0.55),transparent_52%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgb(212_175_55_/0.06),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/[0.04] to-background" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:gap-14 sm:px-6 sm:py-24 md:grid-cols-12 md:gap-16 md:py-28">
          <FadeIn className="relative md:col-span-6 lg:col-span-5">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-3 -z-10 rounded-[1.5rem] bg-[radial-gradient(ellipse_at_25%_15%,rgb(212_175_55_/0.08),transparent_58%)] opacity-95 sm:-inset-4"
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-200/90 sm:text-[11px]">
              {c.hero.eyebrow}
            </p>
            <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent" aria-hidden />
            <h1
              id="hero-heading"
              className="mt-5 max-w-[min(100%,24rem)] font-display text-[2.25rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance drop-shadow-[0_2px_36px_rgb(0_0_0_/0.45)] sm:mt-6 sm:max-w-2xl sm:text-4xl md:text-5xl md:leading-[1.06] lg:max-w-3xl lg:text-[3.25rem]"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-foreground/88 sm:mt-6 sm:text-lg md:text-xl md:leading-relaxed">
              {c.hero.subheadline}
            </p>

            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Button asChild size="lg" className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[12rem] shadow-[0_18px_52px_rgb(212_175_55_/0.18),inset_0_1px_0_rgb(255_255_255_/0.14)]")}>
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

            <p className="mt-8 max-w-xl border-t border-white/[0.08] pt-6 text-sm leading-relaxed text-muted-foreground sm:mt-10 sm:pt-8 sm:text-base">
              {c.hero.supportingLine}
            </p>
          </FadeIn>

          <FadeIn delay={0.08} className="md:col-span-6 lg:col-span-7">
            <FiMarketingOsHeroVisual
              modules={c.hero.orbitModules}
              coreEyebrow={c.hero.coreEyebrow}
              coreTitle={c.hero.coreTitle}
            />
          </FadeIn>
        </div>
      </section>

      <FiMarketingClinicalEcosystemSection />

      <FiMarketingPlatformProgressSection />

      <FiMarketingClinicsAtEveryStageSection />

      <FiMarketingEnterpriseInfrastructureSection />

      <FiMarketingIndustrySoftwareGapSection />

      <FiMarketingIntelligenceNetworkSection />

      <Section
        id={c.industryProblem.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.industryProblem.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.industryProblem.id}-heading`}
            eyebrow={c.industryProblem.storyEyebrow}
            title={c.industryProblem.headline}
            description={c.industryProblem.subtext}
          />
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {c.industryProblem.cards.map((card) => (
              <li key={card}>
                <GlassCard variant="problem" className="h-full">
                  <p className="text-sm font-medium leading-snug text-foreground sm:text-[0.95rem]">{card}</p>
                </GlassCard>
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-3xl text-base font-medium leading-relaxed text-amber-100/90 sm:mt-12 sm:text-lg md:text-xl">
            {c.industryProblem.transition}
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.builtForOperators.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.builtForOperators.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.builtForOperators.id}-heading`}
            eyebrow={c.builtForOperators.storyEyebrow}
            title={c.builtForOperators.headline}
          />
          <ul className="mt-10 grid gap-5 sm:gap-6 md:grid-cols-2">
            {c.builtForOperators.audiences.map((a) => (
              <li key={a.headline}>
                <GlassCard className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/22">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">{a.headline}</h3>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground md:text-base">{a.outcome}</p>
                  <Link
                    href={a.cta.href}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/95 transition-colors hover:text-amber-50"
                  >
                    {a.cta.label}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </GlassCard>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.training.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.training.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.training.id}-heading`}
            eyebrow={c.training.storyEyebrow}
            title={c.training.headline}
            description={c.training.subtext}
          />
          <TrainingTrackGrid
            tracks={c.training.tracks}
            poweredByLabel={c.training.poweredByLabel}
            poweredBy={c.training.poweredBy}
          />
        </FadeIn>
      </Section>

      <Section
        id={c.auditNetwork.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.auditNetwork.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.auditNetwork.id}-heading`}
            eyebrow={c.auditNetwork.storyEyebrow}
            title={c.auditNetwork.headline}
            description={c.auditNetwork.subtext}
          />
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">
            Powered by <span className="text-foreground/95">{c.auditNetwork.poweredBy}</span>
          </p>
          <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:gap-12">
            <ul className="grid gap-3 sm:grid-cols-2">
              {c.auditNetwork.trustPillars.map((pillar) => (
                <li key={pillar.title}>
                  <GlassCard className="h-full border-amber-400/12 !p-4">
                    <p className="text-sm font-semibold text-foreground">{pillar.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{pillar.detail}</p>
                  </GlassCard>
                </li>
              ))}
            </ul>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Measurement & verification signal</p>
              <ChipList items={c.auditNetwork.metrics} />
              <div className="mt-8">
                <Button asChild size="lg" className={MARKETING_CTA_PRIMARY_CLASS}>
                  <Link href={c.auditNetwork.cta.href}>
                    {c.auditNetwork.cta.label}
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <FiMarketingMoonshotSection section={c.moonshot} />

      <FiMarketingEngineeringCredibilitySection />

      <Section
        id={c.founder.id}
        className="py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.founder.id}-heading`}
      >
        <FadeIn>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] border border-amber-400/18 bg-gradient-to-br from-[rgb(10_14_22_/0.92)] via-[rgb(8_12_18_/0.88)] to-[rgb(5_8_14_/0.95)] shadow-[0_28px_90px_rgb(0_0_0_/0.45),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:rounded-[2rem]">
            <div className="grid gap-10 p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:gap-14 md:p-12">
              <div className="relative flex flex-col justify-center border-l-2 border-amber-400/35 pl-6 md:pl-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/75">{c.founder.storyEyebrow}</p>
                <p className="mt-6 font-display text-2xl font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-3xl">
                  {c.founder.pullQuote}
                </p>
                <div className="mt-8 h-px w-16 bg-gradient-to-r from-amber-400/50 to-transparent" aria-hidden />
              </div>
              <div>
                <h2 id={`${c.founder.id}-heading`} className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  {c.founder.headline}
                </h2>
                <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-foreground md:text-lg">
                  {c.founder.body.split("\n\n").map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <FiMarketingAuthoritySection section={c.authority} />

      <FiMarketingInvestorPositioningSection />

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
                    className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance md:text-5xl"
                  >
                    {c.finalCta.headline}
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                    {c.finalCta.subtext}
                  </p>
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

      <PartnersInvestorsStrip />
    </>
  );
}

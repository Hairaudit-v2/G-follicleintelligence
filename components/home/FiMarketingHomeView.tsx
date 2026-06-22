import dynamic from "next/dynamic";
import Link from "next/link";

import { SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

import { FiMarketingClinicalEcosystemSection } from "@/components/home/FiMarketingClinicalEcosystemSection";
import { FiMarketingClinicsAtEveryStageSection } from "@/components/home/FiMarketingClinicsAtEveryStageSection";
import { FiMarketingEnterpriseInfrastructureSection } from "@/components/home/FiMarketingEnterpriseInfrastructureSection";
import { FiMarketingIndustrySoftwareGapSection } from "@/components/home/FiMarketingIndustrySoftwareGapSection";
import { FiMarketingIntelligenceNetworkSection } from "@/components/home/FiMarketingIntelligenceNetworkSection";
import { FiMarketingInvestorPositioningSection } from "@/components/home/FiMarketingInvestorPositioningSection";
import { FiMarketingPlatformProgressSection } from "@/components/home/FiMarketingPlatformProgressSection";

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
    </>
  );
}

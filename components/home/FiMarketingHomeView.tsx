import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

import { GlobalHairIntelligenceSectionPlaceholder } from "@/components/ecosystem/GlobalHairIntelligenceSectionPlaceholder";

const GlobalHairIntelligenceSectionClient = dynamic(
  () =>
    import("@/components/ecosystem/GlobalHairIntelligenceSection").then((m) => ({
      default: m.GlobalHairIntelligenceSection,
    })),
  {
    ssr: false,
    loading: () => (
      <GlobalHairIntelligenceSectionPlaceholder
        heading={HOME_PAGE_CONTENT.networkDiagram.heading}
        description={HOME_PAGE_CONTENT.networkDiagram.description}
      />
    ),
  }
);

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

/** Primary CTA — gold-forward, full width on small screens for visibility. */
const ctaPrimaryClass =
  "h-12 min-h-[48px] w-full justify-center gap-2 rounded-xl border border-amber-300/35 bg-gradient-to-b from-amber-200/[0.18] to-amber-200/[0.07] px-5 text-sm font-semibold text-foreground shadow-[0_14px_44px_rgb(212_175_55_/0.14),inset_0_1px_0_rgb(255_255_255_/0.12)] hover:from-amber-200/25 hover:to-amber-200/10 sm:h-11 sm:min-h-0 sm:w-auto sm:justify-between";

/** Secondary CTA — glass outline with gold hover affordance. */
const ctaSecondaryClass =
  "h-12 min-h-[48px] w-full justify-center gap-2 rounded-xl border border-white/12 bg-background/35 px-5 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-sm hover:border-amber-300/30 hover:bg-white/[0.04] sm:h-11 sm:min-h-0 sm:w-auto sm:justify-between";

function SectionHeading({
  id,
  title,
  description,
  eyebrow,
}: {
  id: string;
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <header className="max-w-4xl">
      {eyebrow ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-200/75">{eyebrow}</p>
          <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent" aria-hidden />
        </div>
      ) : null}
      <h2
        id={id}
        className={cn(
          "font-display font-semibold tracking-tight text-foreground text-balance",
          eyebrow ? "mt-5 text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]" : "text-3xl sm:text-4xl md:text-[2.75rem] md:leading-[1.12]"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:leading-relaxed">
          {description}
        </p>
      ) : null}
    </header>
  );
}

const glassVariants = {
  default:
    "border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-white/[0.015] shadow-[0_20px_56px_rgb(0_0_0_/0.4),inset_0_1px_0_rgb(255_255_255_/0.06)] hover:border-white/[0.12]",
  os: "border-white/[0.06] bg-gradient-to-b from-white/[0.1] via-white/[0.035] to-transparent shadow-[0_18px_52px_rgb(0_0_0_/0.42),inset_0_1px_0_rgb(255_255_255_/0.07)] ring-1 ring-inset ring-white/[0.04] transition-[border-color,box-shadow] duration-300 hover:border-amber-400/22 hover:shadow-[0_22px_64px_rgb(212_175_55_/0.08),inset_0_1px_0_rgb(255_255_255_/0.08)]",
  problem:
    "border-amber-400/[0.09] bg-gradient-to-br from-white/[0.06] to-amber-950/[0.08] shadow-[0_16px_48px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] hover:border-amber-400/18",
} as const;

type GlassVariant = keyof typeof glassVariants;

function GlassCard({
  className,
  children,
  variant = "default",
}: {
  className?: string;
  children: ReactNode;
  variant?: GlassVariant;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.35rem] border p-5 backdrop-blur-md sm:p-6",
        glassVariants[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

function OsModuleCard({ index, name, description }: { index: number; name: string; description: string }) {
  return (
    <GlassCard variant="os" className="group flex h-full flex-col">
      <div className="flex items-center border-b border-white/[0.06] pb-3">
        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/50">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="ml-auto h-px w-10 bg-gradient-to-r from-amber-400/35 to-transparent"
          aria-hidden
        />
      </div>
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-amber-100/95">{name}</p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </GlassCard>
  );
}

function ChipList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-xl border border-white/[0.06] border-l-2 border-l-amber-400/45 bg-gradient-to-r from-amber-400/[0.07] via-transparent to-transparent px-4 py-3 text-sm leading-snug text-foreground/95 shadow-[inset_0_1px_0_rgb(255_255_255_/0.04)]"
        >
          {item}
        </li>
      ))}
    </ul>
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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_-5%,rgb(212_175_55_/0.14),transparent_48%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_92%_8%,hsl(var(--primary)/0.16),transparent_44%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(0_0_0_/0.45),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:gap-14 sm:px-6 sm:py-20 md:grid-cols-12 md:gap-16 md:py-28">
          <FadeIn className="md:col-span-6 lg:col-span-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-200/90 sm:text-[11px]">
              {c.hero.eyebrow}
            </p>
            <h1
              id="hero-heading"
              className="mt-4 max-w-[22rem] font-display text-[2.125rem] font-semibold leading-[1.1] tracking-tight text-foreground text-balance drop-shadow-[0_1px_28px_rgb(0_0_0_/0.35)] sm:mt-5 sm:max-w-2xl sm:text-4xl md:text-5xl md:leading-[1.08] lg:max-w-3xl lg:text-[3.15rem]"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-foreground/90 sm:mt-6 sm:text-lg md:text-xl md:leading-relaxed">
              {c.hero.subheadline}
            </p>

            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild size="lg" className={ctaPrimaryClass}>
                <Link href={c.hero.primaryCta.href}>
                  {c.hero.primaryCta.label}
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className={ctaSecondaryClass}>
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

      <Section
        id={c.industryProblem.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.08] to-background py-16 sm:py-20 md:py-24"
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
        id={c.onePlatform.id}
        className="border-b border-border/50 bg-muted/[0.06] py-16 sm:py-20 md:py-24"
        aria-labelledby={`${c.onePlatform.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.onePlatform.id}-heading`}
            eyebrow={c.onePlatform.storyEyebrow}
            title={c.onePlatform.headline}
            description={c.onePlatform.subtext}
          />
          <div className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.1),transparent_55%),linear-gradient(180deg,rgb(255_255_255_/0.04),transparent)] p-5 shadow-[0_24px_80px_rgb(0_0_0_/0.35),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:mt-14 sm:rounded-[2rem] sm:p-8 md:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[125%] w-[125%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/12"
            />
            <ul className="relative grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {c.onePlatform.modules.map((m, index) => (
                <li key={m.name}>
                  <OsModuleCard index={index} name={m.name} description={m.description} />
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.patientJourney.id}
        className="border-b border-border/50 py-16 sm:py-20 md:py-24"
        aria-labelledby={`${c.patientJourney.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.patientJourney.id}-heading`}
            eyebrow={c.patientJourney.storyEyebrow}
            title={c.patientJourney.headline}
            description={c.patientJourney.subtext}
          />
          <ol className="relative mx-auto mt-10 max-w-3xl space-y-0 border-l border-amber-400/20 pl-6 sm:mt-12 sm:pl-8 md:max-w-4xl">
            {c.patientJourney.steps.map((step, index) => (
              <li key={step} className="relative pb-6 last:pb-0 sm:pb-8">
                <span
                  aria-hidden
                  className="absolute -left-[19px] top-2 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-amber-300/40 bg-gradient-to-br from-amber-200/50 to-amber-700/25 shadow-[0_0_14px_rgb(212_175_55_/0.28)] sm:-left-[21px] sm:h-3 sm:w-3"
                />
                <GlassCard variant="default" className="!shadow-[0_12px_40px_rgb(0_0_0_/0.28)]">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">
                    Step {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-2 text-[0.95rem] font-medium leading-snug text-foreground sm:text-lg">{step}</p>
                </GlassCard>
              </li>
            ))}
          </ol>
        </FadeIn>
      </Section>

      <Section
        id={c.builtForOperators.id}
        className="border-b border-border/50 bg-muted/[0.05] py-16 sm:py-20 md:py-24"
        aria-labelledby={`${c.builtForOperators.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.builtForOperators.id}-heading`}
            eyebrow={c.builtForOperators.storyEyebrow}
            title={c.builtForOperators.headline}
          />
          <ul className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-2">
            {c.builtForOperators.audiences.map((a) => (
              <li key={a.title}>
                <GlassCard className="h-full">
                  <h3 className="text-lg font-semibold text-foreground md:text-xl">{a.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">{a.body}</p>
                </GlassCard>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.training.id}
        className="border-b border-border/50 py-16 sm:py-20 md:py-24"
        aria-labelledby={`${c.training.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.training.id}-heading`}
            eyebrow={c.training.storyEyebrow}
            title={c.training.headline}
            description={c.training.subtext}
          />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary/90">
            Powered by <span className="text-foreground/95">{c.training.poweredBy}</span>
          </p>
          <ChipList items={c.training.tracks} />
        </FadeIn>
      </Section>

      <Section
        id={c.surgicalIntelligence.id}
        className="border-b border-border/50 bg-gradient-to-b from-muted/[0.06] to-background py-16 sm:py-20 md:py-24"
        aria-labelledby={`${c.surgicalIntelligence.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.surgicalIntelligence.id}-heading`}
            eyebrow={c.surgicalIntelligence.storyEyebrow}
            title={c.surgicalIntelligence.headline}
          />
          <ChipList items={c.surgicalIntelligence.variables} />
          <p className="mt-8 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground sm:mt-10 md:text-lg">
            {c.surgicalIntelligence.closing}
          </p>
        </FadeIn>
      </Section>

      <Section
        id={c.auditNetwork.id}
        className="border-b border-border/50 py-16 sm:py-20 md:py-24"
        aria-labelledby={`${c.auditNetwork.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.auditNetwork.id}-heading`}
            eyebrow={c.auditNetwork.storyEyebrow}
            title={c.auditNetwork.headline}
          />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary/90">
            Powered by <span className="text-foreground/95">{c.auditNetwork.poweredBy}</span>
          </p>
          <ChipList items={c.auditNetwork.metrics} />
        </FadeIn>
      </Section>

      <Section
        id={c.globalIntelligence.id}
        className="border-b border-border/50 bg-muted/[0.05] py-16 sm:py-20 md:py-24"
        aria-labelledby={`${c.globalIntelligence.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.globalIntelligence.id}-heading`}
            eyebrow={c.globalIntelligence.storyEyebrow}
            title={c.globalIntelligence.headline}
            description={c.globalIntelligence.subtext}
          />
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            {c.globalIntelligence.twinDataLabel}
          </p>
          <ChipList items={c.globalIntelligence.twinDataPoints} />
        </FadeIn>
      </Section>

      <GlobalHairIntelligenceSectionClient
        variant="follicle-intelligence"
        heading={c.networkDiagram.heading}
        description={c.networkDiagram.description}
        networkTitle={c.networkDiagram.networkTitle}
        networkFooterCaption={c.networkDiagram.networkFooterCaption}
        size="hero"
        theme="dark"
      />

      <Section
        id={c.predictiveFuture.id}
        className="border-b border-border/50 py-16 sm:py-20 md:py-24"
        aria-labelledby={`${c.predictiveFuture.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.predictiveFuture.id}-heading`}
            eyebrow={c.predictiveFuture.storyEyebrow}
            title={c.predictiveFuture.headline}
          />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {c.predictiveFuture.modelsLabel}
          </p>
          <ChipList items={c.predictiveFuture.models} />
        </FadeIn>
      </Section>

      <Section
        id={c.founder.id}
        className="py-16 sm:py-20 md:py-24"
        aria-labelledby={`${c.founder.id}-heading`}
      >
        <FadeIn>
          <GlassCard className="mx-auto max-w-4xl border-amber-400/18 !shadow-[0_28px_90px_rgb(0_0_0_/0.42)]">
            <SectionHeading
              id={`${c.founder.id}-heading`}
              eyebrow={c.founder.storyEyebrow}
              title={c.founder.headline}
            />
            <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              {c.founder.body.split("\n\n").map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      <section
        id={c.finalCta.id}
        className="border-t border-border/50 bg-gradient-to-b from-background to-muted/[0.12] pb-16 pt-12 sm:pb-20 sm:pt-16 md:pt-20"
        aria-labelledby={`${c.finalCta.id}-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="rounded-[1.75rem] border border-amber-400/18 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-7 shadow-[0_28px_90px_rgb(0_0_0_/0.48),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:rounded-[2rem] sm:p-10 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/85">Get started</p>
                  <h2
                    id={`${c.finalCta.id}-heading`}
                    className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground text-balance md:text-5xl"
                  >
                    {c.finalCta.headline}
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                    {c.finalCta.subtext}
                  </p>
                </div>
                <div className="flex w-full max-w-md flex-col gap-3 lg:max-w-none lg:justify-self-end">
                  <Button asChild size="lg" className={ctaPrimaryClass}>
                    <Link href={c.finalCta.primaryCta.href}>
                      {c.finalCta.primaryCta.label}
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className={ctaSecondaryClass}>
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

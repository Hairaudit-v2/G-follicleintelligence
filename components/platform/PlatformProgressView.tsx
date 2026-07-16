"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { PlatformProgressStatusBadge } from "@/components/platform/PlatformProgressPrimitives";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import {
  getModulesByStatuses,
  getPlatformProgressMetrics,
  getPlatformProgressSnapshot,
  PLATFORM_PROGRESS_CHANGELOG,
  PLATFORM_PROGRESS_MODULES,
  PLATFORM_PROGRESS_PAGE_CONTENT,
  PLATFORM_PROGRESS_VERIFIED_MILESTONES,
  type PlatformProgressModule,
  type PlatformProgressStatus,
} from "@/lib/marketing/platformProgressPageContent";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  GitCommitHorizontal,
  Layers3,
  Network,
  Sparkles,
  Waypoints,
} from "lucide-react";

const c = PLATFORM_PROGRESS_PAGE_CONTENT;
const snapshot = getPlatformProgressSnapshot(PLATFORM_PROGRESS_MODULES);
const platformMetrics = getPlatformProgressMetrics();

const OPERATIONAL_MODULES = getModulesByStatuses(["Deployed", "Operational Pilot"]);
const ADVANCED_BUILD_MODULES = getModulesByStatuses(["Advanced Build"]);
const IN_DEVELOPMENT_MODULES = getModulesByStatuses(["In Development"]);
const RESEARCH_MODULES = getModulesByStatuses(["Research and Future Development"]);

function ModuleStatusCard({
  module,
  index,
}: {
  module: PlatformProgressModule;
  index: number;
}) {
  return (
    <FadeIn delay={0.03 * (index % 8)}>
      <GlassCard
        variant="os"
        className="group flex h-full flex-col border-white/[0.06] p-6 transition-[border-color,transform,box-shadow] duration-300 hover:border-amber-400/20 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/45">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {module.name}
            </h3>
          </div>
          <PlatformProgressStatusBadge status={module.status} label={module.statusLabel} />
        </div>

        <p className="mt-5 flex-1 text-sm leading-[1.7] text-muted-foreground">
          {module.description}
        </p>

        {module.latestMilestone ? (
          <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Latest milestone
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              {module.latestMilestone}
            </p>
          </div>
        ) : null}

        {module.learnMoreHref ? (
          <Link
            href={module.learnMoreHref}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/95 transition-colors hover:text-amber-50"
          >
            Learn more
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ) : null}
      </GlassCard>
    </FadeIn>
  );
}

function ModuleSection({
  id,
  eyebrow,
  title,
  intro,
  modules,
  tone = "default",
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  modules: readonly PlatformProgressModule[];
  tone?: "default" | "audit" | "intelligence";
}) {
  if (modules.length === 0) return null;

  return (
    <Section
      id={id}
      className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${id}-heading`}
          eyebrow={eyebrow}
          title={title}
          description={intro}
          tone={tone === "default" ? undefined : tone}
        />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {modules.length} system{modules.length === 1 ? "" : "s"}
        </p>
        <ul className="mt-12 grid list-none gap-6 p-0 md:grid-cols-2">
          {modules.map((mod, i) => (
            <li key={mod.id} id={`progress-${mod.id}`} className="scroll-mt-28">
              <ModuleStatusCard module={mod} index={i} />
            </li>
          ))}
        </ul>
      </FadeIn>
    </Section>
  );
}

function StatusMetricsStrip() {
  return (
    <section
      id="platform-status-summary"
      className="border-b border-border/40 bg-muted/[0.04] py-14 sm:py-16"
      aria-labelledby="platform-status-summary-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <p
            id="platform-status-summary-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/75"
          >
            Status summary
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {platformMetrics.map((metric, index) => (
              <GlassCard key={metric.label} className="border-white/[0.07] !p-5 sm:!p-6">
                <FadeIn delay={0.03 * index}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    {metric.value}
                  </p>
                </FadeIn>
              </GlassCard>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function VerifiedMilestones() {
  const hubspot = c.hubspotMilestone;

  return (
    <Section
      id={c.milestones.id}
      className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
      aria-labelledby="milestones-heading"
    >
      <FadeIn>
        <SectionHeading
          id="milestones-heading"
          eyebrow={c.milestones.eyebrow}
          title={c.milestones.headline}
          description={c.milestones.intro}
        />

        <div id={hubspot.id} className="mt-12 scroll-mt-28">
          <GlassCard variant="os" className="border-amber-400/15 !p-7 sm:!p-9">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-amber-400/25 bg-amber-950/30 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/90">
                Featured milestone
              </span>
              <time
                dateTime="2026-07"
                className="font-mono text-xs tabular-nums text-muted-foreground"
              >
                {hubspot.date}
              </time>
            </div>
            <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {hubspot.heading}
            </h3>
            <p className="mt-4 max-w-3xl text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {hubspot.summary}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-foreground/85 sm:text-base">
              {hubspot.detail}
            </p>
            <Link
              href={c.ctas.tertiary.href}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/95 transition-colors hover:text-amber-50"
            >
              {c.ctas.tertiary.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </GlassCard>
        </div>

        <div className="mt-12 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgb(255_255_255_/0.035),transparent)] shadow-[0_24px_80px_rgb(0_0_0_/0.35),inset_0_1px_0_rgb(255_255_255_/0.05)]">
          <div className="border-b border-white/[0.07] px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <GitCommitHorizontal className="h-4 w-4 text-amber-300/70" aria-hidden />
                Milestone timeline
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200/55">
                {PLATFORM_PROGRESS_VERIFIED_MILESTONES.length} entries
              </p>
            </div>
          </div>

          <ol className="divide-y divide-white/[0.06]">
            {PLATFORM_PROGRESS_VERIFIED_MILESTONES.map((entry, index) => (
              <li key={entry.id}>
                <FadeIn delay={0.025 * (index % 8)}>
                  <div className="flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-8 sm:px-8 sm:py-6">
                    <time
                      dateTime={entry.date}
                      className="shrink-0 font-mono text-xs tabular-nums text-amber-200/70"
                    >
                      {entry.date}
                    </time>
                    <span className="inline-flex w-fit shrink-0 rounded-md border border-white/[0.08] bg-black/25 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200/80">
                      {entry.tag}
                    </span>
                    <p className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                      {entry.title}
                    </p>
                  </div>
                </FadeIn>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 overflow-hidden rounded-[1.75rem] border border-white/[0.06] bg-black/20">
          <div className="border-b border-white/[0.06] px-6 py-4 sm:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Extended notes
            </p>
          </div>
          <ol className="divide-y divide-white/[0.05]">
            {PLATFORM_PROGRESS_CHANGELOG.slice(0, 6).map((entry, index) => (
              <li key={entry.id}>
                <FadeIn delay={0.02 * (index % 6)}>
                  <div className="grid gap-4 px-6 py-5 sm:grid-cols-[7rem_1fr] sm:px-8 sm:py-6">
                    <div>
                      <time
                        dateTime={entry.date}
                        className="font-mono text-xs tabular-nums text-muted-foreground"
                      >
                        {entry.date}
                      </time>
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold text-foreground">
                        {entry.title}
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                        {entry.summary}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.modules.map((mod) => (
                          <span
                            key={mod}
                            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/85"
                          >
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </FadeIn>
              </li>
            ))}
          </ol>
        </div>
      </FadeIn>
    </Section>
  );
}

function AdoptionPathway() {
  return (
    <Section
      id={c.adoption.id}
      className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24 md:py-28"
      aria-labelledby="adoption-heading"
    >
      <FadeIn>
        <SectionHeading
          id="adoption-heading"
          eyebrow={c.adoption.eyebrow}
          title={c.adoption.headline}
          description={c.adoption.intro}
        />
        <p className="mt-6 max-w-3xl font-display text-xl font-semibold tracking-tight text-amber-100/90 sm:text-2xl">
          {c.adoption.clinicLine}
        </p>
        <ol className="mt-12 grid list-none gap-5 p-0 sm:grid-cols-2">
          {c.adoption.steps.map((step, index) => (
            <li key={step.title}>
              <FadeIn delay={0.04 * index}>
                <GlassCard className="h-full border-white/[0.07] !p-6 sm:!p-7">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/55">
                    Step {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-[1.7] text-muted-foreground">{step.body}</p>
                </GlassCard>
              </FadeIn>
            </li>
          ))}
        </ol>
      </FadeIn>
    </Section>
  );
}

function StrategicDirection() {
  return (
    <Section
      id={c.strategicDirection.id}
      className="scroll-mt-28 border-b border-border/40 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
      aria-labelledby="strategic-direction-heading"
    >
      <FadeIn>
        <SectionHeading
          id="strategic-direction-heading"
          eyebrow={c.strategicDirection.eyebrow}
          title={c.strategicDirection.headline}
          tone="intelligence"
        />
        <div className="mt-10 max-w-3xl space-y-5">
          {c.strategicDirection.body.map((line) => (
            <p key={line} className="text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {line}
            </p>
          ))}
        </div>
        <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2">
          {c.strategicDirection.points.map((point, index) => (
            <li key={point}>
              <FadeIn delay={0.03 * index}>
                <div className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-black/15 px-5 py-4">
                  <Network className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/80" aria-hidden />
                  <span className="text-sm leading-relaxed text-foreground/90">{point}</span>
                </div>
              </FadeIn>
            </li>
          ))}
        </ul>
      </FadeIn>
    </Section>
  );
}

function HeroCtas() {
  return (
    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <Button asChild size="lg" className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[12rem]")}>
        <Link href={c.ctas.primary.href}>
          {c.ctas.primary.label}
          <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem]")}
      >
        <Link href={c.ctas.secondary.href}>{c.ctas.secondary.label}</Link>
      </Button>
      <Link
        href={c.ctas.tertiary.href}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/85 transition-colors hover:text-amber-50 sm:ml-1"
      >
        {c.ctas.tertiary.label}
        <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
      </Link>
    </div>
  );
}

export function PlatformProgressView() {
  return (
    <>
      {/* 1. Hero + current platform position */}
      <section
        id="platform-progress-hero"
        aria-labelledby="platform-progress-hero-heading"
        className="relative overflow-hidden border-b border-border/40 bg-[#040810]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_-10%,rgb(212_175_55_/0.14),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,hsl(var(--primary)/0.1),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28 md:py-36">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-amber-200/80">
              {c.hero.eyebrow}
            </p>
            <div
              className="mt-4 h-px w-16 bg-gradient-to-r from-amber-300/60 via-amber-400/20 to-transparent"
              aria-hidden
            />
            <h1
              id="platform-progress-hero-heading"
              className="mt-8 max-w-5xl font-display text-[2.25rem] font-semibold leading-[1.06] tracking-tight text-foreground text-balance sm:text-5xl md:text-[3.25rem] md:leading-[1.05]"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-10 max-w-3xl text-lg leading-[1.75] text-foreground/82 sm:text-xl sm:leading-[1.8]">
              {c.hero.subtext}
            </p>
            <HeroCtas />
            <div className="mt-12 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">
                <Sparkles className="h-4 w-4 text-amber-300/70" aria-hidden />
                <span>
                  Updated{" "}
                  <time
                    dateTime={c.hero.lastUpdated}
                    className="font-mono tabular-nums text-foreground/90"
                  >
                    {c.hero.lastUpdated}
                  </time>
                </span>
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground/90">
                {snapshot.activeModuleCount} systems · {snapshot.deployableSurfaceCount} operational
                or pilot
              </span>
            </div>
          </FadeIn>
        </div>
      </section>

      <Section
        id={c.currentPosition.id}
        className="scroll-mt-28 border-b border-border/40 bg-background py-20 sm:py-24 md:py-28"
        aria-labelledby="current-position-heading"
      >
        <FadeIn>
          <SectionHeading
            id="current-position-heading"
            eyebrow={c.currentPosition.eyebrow}
            title={c.currentPosition.headline}
          />
          <div className="mt-10 max-w-3xl space-y-5">
            {c.currentPosition.body.map((line) => (
              <p key={line} className="text-base leading-[1.75] text-muted-foreground sm:text-lg">
                {line}
              </p>
            ))}
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {c.currentPosition.dimensions.map((dim, index) => (
              <FadeIn key={dim.title} delay={0.04 * index}>
                <GlassCard className="h-full border-white/[0.07] !p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-black/30">
                    {index === 0 ? (
                      <Waypoints className="h-5 w-5 text-amber-200/80" aria-hidden />
                    ) : index === 1 ? (
                      <Layers3 className="h-5 w-5 text-amber-200/80" aria-hidden />
                    ) : (
                      <Network className="h-5 w-5 text-amber-200/80" aria-hidden />
                    )}
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-foreground">
                    {dim.title}
                  </h3>
                  <p className="mt-3 text-sm leading-[1.7] text-muted-foreground">{dim.body}</p>
                </GlassCard>
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      </Section>

      <StatusMetricsStrip />

      {/* 2. Operational systems */}
      <ModuleSection
        id={c.operationalSystems.id}
        eyebrow={c.operationalSystems.eyebrow}
        title={c.operationalSystems.headline}
        intro={c.operationalSystems.intro}
        modules={OPERATIONAL_MODULES}
      />

      {/* 3. Advanced build */}
      <ModuleSection
        id={c.advancedBuild.id}
        eyebrow={c.advancedBuild.eyebrow}
        title={c.advancedBuild.headline}
        intro={c.advancedBuild.intro}
        modules={ADVANCED_BUILD_MODULES}
        tone="audit"
      />

      {/* In development */}
      <ModuleSection
        id={c.inDevelopment.id}
        eyebrow={c.inDevelopment.eyebrow}
        title={c.inDevelopment.headline}
        intro={c.inDevelopment.intro}
        modules={IN_DEVELOPMENT_MODULES}
      />

      {/* Research / future */}
      <ModuleSection
        id={c.researchFuture.id}
        eyebrow={c.researchFuture.eyebrow}
        title={c.researchFuture.headline}
        intro={c.researchFuture.intro}
        modules={RESEARCH_MODULES}
        tone="intelligence"
      />

      {/* 4. Recent verified milestones */}
      <VerifiedMilestones />

      {/* 5. Adoption pathway */}
      <AdoptionPathway />

      {/* 6. Strategic direction */}
      <StrategicDirection />

      {/* Closing CTAs */}
      <section
        id="platform-progress-closing"
        className="relative overflow-hidden bg-[#040810] py-24 sm:py-32 md:py-40"
        aria-labelledby="platform-progress-closing-heading"
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
              id="platform-progress-closing-heading"
              className="mt-10 max-w-4xl font-display text-3xl font-semibold leading-[1.1] tracking-tight text-foreground text-balance sm:text-4xl md:text-5xl"
            >
              {c.closing.headline}
            </h2>
            <p className="mt-8 max-w-2xl text-base leading-[1.75] text-muted-foreground sm:text-lg">
              {c.closing.body}
            </p>
            <HeroCtas />
            <p className="mt-10 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Status model:{" "}
              {(
                [
                  "Deployed",
                  "Operational Pilot",
                  "Advanced Build",
                  "In Development",
                  "Research and Future Development",
                ] as PlatformProgressStatus[]
              ).join(" · ")}
            </p>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

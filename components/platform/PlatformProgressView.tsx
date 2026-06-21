"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import {
  PlatformProgressAnimatedBar,
  PlatformProgressStatusBadge,
} from "@/components/platform/PlatformProgressPrimitives";
import { EcosystemCompletionSnapshot } from "@/components/platform/EcosystemCompletionSnapshot";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import {
  getPlatformProgressSnapshot,
  PLATFORM_PROGRESS_CHANGELOG,
  PLATFORM_PROGRESS_MODULES,
  PLATFORM_PROGRESS_PAGE_CONTENT,
  PLATFORM_PROGRESS_STATUSES,
  type PlatformProgressModule,
  type PlatformProgressStatus,
} from "@/lib/marketing/platformProgressPageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight, GitCommitHorizontal, Layers } from "lucide-react";

const c = PLATFORM_PROGRESS_PAGE_CONTENT;

function ModuleProgressCard({ module, index }: { module: PlatformProgressModule; index: number }) {
  return (
    <FadeIn delay={0.04 * (index % 4)}>
      <GlassCard
        variant="os"
        className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform,box-shadow] duration-300 hover:border-amber-400/20"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
          <div>
            <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em] text-amber-200/50">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {module.name}
            </h3>
          </div>
          <PlatformProgressStatusBadge status={module.status} />
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Completion</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {module.completionPercent}
              <span className="text-lg text-muted-foreground">%</span>
            </p>
          </div>
          <p className="max-w-none text-[10px] font-medium uppercase leading-snug tracking-[0.12em] text-amber-100/80 sm:max-w-[11rem] sm:text-right sm:text-[11px]">
            {module.stage}
          </p>
        </div>

        <div className="mt-4">
          <PlatformProgressAnimatedBar percent={module.completionPercent} status={module.status} delay={0.08 + index * 0.04} />
        </div>

        <p className="mt-5 flex-1 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
          {module.description}
        </p>

        {module.learnMoreHref ? (
          <Link
            href={module.learnMoreHref}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/95 transition-colors hover:text-amber-50"
          >
            Module surface
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : (
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            Delivery in progress
          </p>
        )}
      </GlassCard>
    </FadeIn>
  );
}

function DeliverySnapshot({ modules }: { modules: PlatformProgressModule[] }) {
  const snapshot = getPlatformProgressSnapshot(modules);

  return (
    <div className="mt-10 space-y-8">
      <EcosystemCompletionSnapshot variant="marketing" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GlassCard className="border-white/[0.07] !p-5 sm:!p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">FI OS modules tracked</p>
          <p className="mt-3 font-mono text-4xl font-semibold tabular-nums tracking-tight text-foreground">
            {snapshot.activeModuleCount}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Connected OS surfaces in the delivery registry</p>
        </GlassCard>

        <GlassCard className="border-emerald-400/10 !p-5 sm:!p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/70">Deployable surfaces</p>
          <p className="mt-3 font-mono text-4xl font-semibold tabular-nums tracking-tight text-foreground">
            {snapshot.deployableSurfaceCount}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Live, production, or pilot-ready modules</p>
        </GlassCard>

        <GlassCard className="border-cyan-400/10 !p-5 sm:!p-6 sm:col-span-2 lg:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Last updated</p>
          <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
            {snapshot.lastUpdated}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Manual registry — edit in platformProgressPageContent.ts</p>
        </GlassCard>
      </div>
    </div>
  );
}

function StatusFilterBar({
  active,
  onChange,
  counts,
}: {
  active: PlatformProgressStatus | "All";
  onChange: (value: PlatformProgressStatus | "All") => void;
  counts: Map<PlatformProgressStatus | "All", number>;
}) {
  const filters: Array<{ label: string; value: PlatformProgressStatus | "All" }> = [
    { label: "All modules", value: "All" },
    ...PLATFORM_PROGRESS_STATUSES.map((status) => ({ label: status, value: status })),
  ];

  return (
    <div className="mt-10 -mx-4 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/25">
      <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap" role="tablist" aria-label="Filter modules by status">
      {filters.map((filter) => {
        const isActive = active === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(filter.value)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-[border-color,background-color,color,box-shadow] duration-200 sm:text-[11px] sm:tracking-[0.14em]",
              isActive
                ? "border-amber-400/35 bg-amber-950/35 text-amber-50 shadow-[0_0_24px_rgb(212_175_55_/0.12)]"
                : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:border-white/[0.14] hover:text-foreground"
            )}
          >
            {filter.label}
            <span className="ml-2 font-mono tabular-nums text-[10px] opacity-70">{counts.get(filter.value) ?? 0}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function EngineeringChangelog() {
  return (
    <div className="mt-12 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgb(255_255_255_/0.04),transparent)] shadow-[0_24px_80px_rgb(0_0_0_/0.35),inset_0_1px_0_rgb(255_255_255_/0.05)]">
      <div className="border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <GitCommitHorizontal className="h-4 w-4 text-amber-300/70" aria-hidden />
            Public engineering log
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200/55">
            {PLATFORM_PROGRESS_CHANGELOG.length} entries
          </p>
        </div>
      </div>

      <ol className="divide-y divide-white/[0.06]">
        {PLATFORM_PROGRESS_CHANGELOG.map((entry, index) => (
          <li key={entry.id}>
            <FadeIn delay={0.03 * (index % 6)}>
              <div className="grid gap-4 px-5 py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[7.5rem_1fr] sm:px-6 sm:py-6">
                <div>
                  <time dateTime={entry.date} className="font-mono text-xs tabular-nums text-amber-200/75">
                    {entry.date}
                  </time>
                  <p className="mt-2 inline-flex rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200/80">
                    {entry.tag}
                  </p>
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{entry.title}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
                    {entry.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
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
  );
}

export function PlatformProgressView() {
  const [statusFilter, setStatusFilter] = useState<PlatformProgressStatus | "All">("All");

  const filterCounts = useMemo(() => {
    const counts = new Map<PlatformProgressStatus | "All", number>();
    counts.set("All", PLATFORM_PROGRESS_MODULES.length);
    for (const status of PLATFORM_PROGRESS_STATUSES) {
      counts.set(status, PLATFORM_PROGRESS_MODULES.filter((mod) => mod.status === status).length);
    }
    return counts;
  }, []);

  const filteredModules = useMemo(() => {
    if (statusFilter === "All") return PLATFORM_PROGRESS_MODULES;
    return PLATFORM_PROGRESS_MODULES.filter((mod) => mod.status === statusFilter);
  }, [statusFilter]);

  return (
    <>
      <section
        id="platform-progress-hero"
        aria-labelledby="platform-progress-hero-heading"
        className="fi-grid relative overflow-hidden border-b border-border/50"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.45] [mask-image:radial-gradient(ellipse_at_50%_40%,black_20%,transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_-8%,rgb(212_175_55_/0.18),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_95%_5%,hsl(var(--primary)/0.16),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_88%,rgb(0_0_0_/0.55),transparent_52%)]" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
          <FadeIn>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-200/90 sm:text-[11px]">
              {c.hero.eyebrow}
            </p>
            <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent" aria-hidden />
            <h1
              id="platform-progress-hero-heading"
              className="mt-5 max-w-4xl font-display text-[2.1rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance drop-shadow-[0_2px_36px_rgb(0_0_0_/0.45)] sm:text-4xl md:text-5xl md:leading-[1.06] lg:max-w-5xl"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-foreground/88 sm:text-lg md:text-xl md:leading-relaxed">
              {c.hero.subtext}
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-amber-300/75" aria-hidden />
              <span>
                Registry updated{" "}
                <time dateTime={c.hero.lastUpdated} className="font-mono tabular-nums text-foreground/90">
                  {c.hero.lastUpdated}
                </time>
              </span>
            </div>
          </FadeIn>
        </div>
      </section>

      <Section
        id="delivery-snapshot"
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby="delivery-snapshot-heading"
      >
        <FadeIn>
          <SectionHeading
            id="delivery-snapshot-heading"
            eyebrow={c.summary.eyebrow}
            title={c.summary.headline}
            description={c.summary.intro}
          />
          <DeliverySnapshot modules={PLATFORM_PROGRESS_MODULES} />
        </FadeIn>
      </Section>

      <Section
        id="module-grid"
        className="border-b border-border/50 bg-muted/[0.05] py-20 sm:py-24 md:py-28"
        aria-labelledby="module-grid-heading"
      >
        <FadeIn>
          <SectionHeading
            id="module-grid-heading"
            eyebrow={c.modules.eyebrow}
            title={c.modules.headline}
            description={c.modules.intro}
          />
          <StatusFilterBar active={statusFilter} onChange={setStatusFilter} counts={filterCounts} />
          <ul className="mt-10 grid list-none gap-6 p-0 sm:gap-8 md:grid-cols-2 xl:grid-cols-3">
            {filteredModules.map((mod, i) => (
              <li key={mod.id} id={`progress-${mod.id}`} className="scroll-mt-28">
                <ModuleProgressCard module={mod} index={i} />
              </li>
            ))}
          </ul>
          {filteredModules.length === 0 ? (
            <p className="mt-10 text-sm text-muted-foreground">No modules match this status filter.</p>
          ) : null}
        </FadeIn>
      </Section>

      <Section
        id="engineering-changelog"
        className="scroll-mt-28 border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby="engineering-changelog-heading"
      >
        <FadeIn>
          <SectionHeading
            id="engineering-changelog-heading"
            eyebrow={c.changelog.eyebrow}
            title={c.changelog.headline}
            description={c.changelog.intro}
          />
          <EngineeringChangelog />
        </FadeIn>
      </Section>

      <section
        id="platform-progress-cta"
        className="border-t border-border/50 bg-gradient-to-b from-background to-muted/[0.12] pb-20 pt-14 sm:pb-24 sm:pt-16 md:pt-20"
        aria-labelledby="platform-progress-cta-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="rounded-[1.75rem] border border-amber-400/18 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-7 shadow-[0_28px_90px_rgb(0_0_0_/0.48),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:rounded-[2rem] sm:p-10 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/85">
                    {c.finalCta.eyebrow}
                  </p>
                  <div className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent" aria-hidden />
                  <h2
                    id="platform-progress-cta-heading"
                    className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance md:text-4xl lg:text-5xl"
                  >
                    {c.finalCta.headline}
                  </h2>
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

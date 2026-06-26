"use client";

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
  getFeaturedPlatformProgressModules,
  getLatestPlatformProgressChangelogEntry,
  getPlatformProgressHomepageDescription,
  getPlatformProgressSnapshot,
  PLATFORM_PROGRESS_MODULES,
  PLATFORM_PROGRESS_PAGE_CONTENT,
} from "@/lib/marketing/platformProgressPageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, GitCommitHorizontal } from "lucide-react";

const c = PLATFORM_PROGRESS_PAGE_CONTENT.homepage;
const snapshot = getPlatformProgressSnapshot(PLATFORM_PROGRESS_MODULES);
const featuredModules = getFeaturedPlatformProgressModules();
const latestUpdate = getLatestPlatformProgressChangelogEntry();

function LatestPlatformUpdateCard() {
  if (!latestUpdate) return null;

  const { latestUpdate: latestUpdateCopy } = c;

  return (
    <FadeIn delay={0.06}>
      <GlassCard className="mt-8 border-amber-400/12 bg-[linear-gradient(135deg,rgb(212_175_55_/0.06),transparent_42%),linear-gradient(180deg,rgb(255_255_255_/0.04),transparent)] !p-5 sm:!p-6">
        <div className="flex flex-col gap-3 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <GitCommitHorizontal className="h-4 w-4 shrink-0 text-cyan-300/75" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">
              {latestUpdateCopy.title}
            </p>
          </div>
          <Link
            href={latestUpdateCopy.readFullLogHref}
            className="inline-flex items-center gap-1 self-start text-[11px] font-semibold text-cyan-200/85 transition-colors hover:text-cyan-100 sm:self-auto"
          >
            {latestUpdateCopy.readFullLogLabel}
            <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </Link>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[7rem_1fr] md:gap-6">
          <div>
            <time dateTime={latestUpdate.date} className="font-mono text-xs tabular-nums text-amber-200/75">
              {latestUpdate.date}
            </time>
            <p className="mt-2 inline-flex rounded-md border border-cyan-400/20 bg-cyan-950/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200/85">
              {latestUpdate.tag}
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {latestUpdate.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{latestUpdate.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {latestUpdate.modules.map((mod) => (
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
      </GlassCard>
    </FadeIn>
  );
}

export function FiMarketingPlatformProgressSection() {
  return (
    <Section
      id={c.id}
      className="scroll-mt-28 border-b border-border/50 bg-gradient-to-b from-muted/[0.05] via-background to-muted/[0.04] py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading id={`${c.id}-heading`} eyebrow={c.eyebrow} title={c.headline} description={getPlatformProgressHomepageDescription()} />

        <EcosystemCompletionSnapshot variant="marketing" className="mt-10" />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <GlassCard className="border-white/[0.07] !p-5 sm:!p-6">
            <p className="text-[10px] font-semibold uppercase leading-snug tracking-[0.22em] text-amber-200/70">FI OS modules tracked</p>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
              {snapshot.activeModuleCount}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Connected systems in the delivery registry</p>
          </GlassCard>
          <GlassCard className="border-white/[0.07] !p-5 sm:!p-6">
            <p className="text-[10px] font-semibold uppercase leading-snug tracking-[0.22em] text-amber-200/70">Last updated</p>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
              {snapshot.lastUpdated}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Public progress registry refresh date</p>
          </GlassCard>
        </div>

        <LatestPlatformUpdateCard />

        <div className="mt-10 overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.1),transparent_50%),linear-gradient(180deg,rgb(255_255_255_/0.04),transparent)] p-5 shadow-[0_24px_80px_rgb(0_0_0_/0.35),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:rounded-[2rem] sm:p-8">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
            Featured delivery surfaces
          </p>
          <ul className="mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:gap-5">
            {featuredModules.map((mod, index) => (
              <li key={mod.id}>
                <FadeIn delay={0.04 * index}>
                  <GlassCard variant="os" className="h-full border-white/[0.07] !p-5 sm:!p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em] text-amber-200/50">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-foreground md:text-xl">
                          {mod.name}
                        </h3>
                      </div>
                      <PlatformProgressStatusBadge status={mod.status} />
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                        {mod.completionPercent}
                        <span className="text-base text-muted-foreground">%</span>
                      </p>
                      <p className="max-w-none text-[10px] font-medium uppercase leading-snug tracking-[0.12em] text-amber-100/75 sm:max-w-[10rem] sm:text-right">
                        {mod.stage}
                      </p>
                    </div>
                    <div className="mt-3">
                      <PlatformProgressAnimatedBar
                        percent={mod.completionPercent}
                        status={mod.status}
                        delay={0.1 + index * 0.05}
                      />
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{mod.description}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Full module grid, status filters, and engineering changelog on the platform progress page.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button asChild variant="outline" size="lg" className={cn(MARKETING_CTA_SECONDARY_CLASS, "w-full sm:w-auto sm:shrink-0")}>
              <Link href={c.secondaryCta.href}>
                {c.secondaryCta.label}
                <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" className={cn(MARKETING_CTA_PRIMARY_CLASS, "w-full sm:w-auto sm:shrink-0")}>
              <Link href={c.cta.href}>
                {c.cta.label}
                <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </FadeIn>
    </Section>
  );
}

"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import {
  PlatformProgressAnimatedBar,
  PlatformProgressStatusBadge,
} from "@/components/platform/PlatformProgressPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import {
  getPlatformInfrastructureDeploymentStatus,
  getPlatformProgressMetrics,
  getPlatformProgressSnapshot,
  isPlatformInfrastructureCoreSystem,
  PLATFORM_ARCHITECTURE_STACK,
  PLATFORM_PROGRESS_CHANGELOG,
  PLATFORM_PROGRESS_DEPLOYMENT_MILESTONES,
  PLATFORM_PROGRESS_INFRASTRUCTURE_LAYERS,
  PLATFORM_PROGRESS_MODULES,
  PLATFORM_PROGRESS_PAGE_CONTENT,
  PLATFORM_PROGRESS_VIE_CAPABILITIES,
  PLATFORM_SYSTEM_ARCHITECTURE_GROUPS,
  resolvePlatformProgressModulesByName,
  type PlatformProgressModule,
  type PlatformSystemArchitectureGroup,
} from "@/lib/marketing/platformProgressPageContent";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BrainCircuit,
  GitCommitHorizontal,
  Layers3,
  Network,
  ServerCog,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

const c = PLATFORM_PROGRESS_PAGE_CONTENT;
const snapshot = getPlatformProgressSnapshot(PLATFORM_PROGRESS_MODULES);
const platformMetrics = getPlatformProgressMetrics();

function ModuleProgressCard({ module, index }: { module: PlatformProgressModule; index: number }) {
  const hidePercent = isPlatformInfrastructureCoreSystem(module.id);
  const deploymentStatus = getPlatformInfrastructureDeploymentStatus(module.id);

  return (
    <FadeIn delay={0.03 * (index % 6)}>
      <GlassCard
        variant="os"
        className="group flex h-full flex-col border-white/[0.06] p-7 transition-[border-color,transform,box-shadow] duration-300 hover:border-amber-400/20 sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em] text-amber-200/45">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground md:text-[1.65rem]">
              {module.name}
            </h3>
          </div>
          <PlatformProgressStatusBadge status={module.status} label={module.statusLabel} />
        </div>

        {hidePercent && deploymentStatus ? (
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Status
            </p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
              {deploymentStatus}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-end">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Completion
                </p>
                <p className="mt-2 font-mono text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                  {module.completionPercent}
                  <span className="text-xl text-muted-foreground">%</span>
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Infrastructure phase
                </p>
                <p className="mt-2 text-sm font-medium leading-snug text-amber-100/85">
                  {module.stage}
                </p>
              </div>
            </div>
            <div className="mt-5">
              <PlatformProgressAnimatedBar
                percent={module.completionPercent}
                status={module.status}
                delay={0.06 + index * 0.03}
                className="h-2.5"
              />
            </div>
          </>
        )}

        {hidePercent ? (
          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Infrastructure phase
            </p>
            <p className="mt-2 text-sm font-medium leading-snug text-amber-100/85">
              {module.stage}
            </p>
          </div>
        ) : null}

        {module.latestMilestone ? (
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Latest milestone
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              {module.latestMilestone}
            </p>
          </div>
        ) : null}

        <p className="mt-5 flex-1 text-sm leading-[1.7] text-muted-foreground">
          {module.description}
        </p>

        {module.learnMoreHref ? (
          <Link
            href={module.learnMoreHref}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200/95 transition-colors hover:text-amber-50"
          >
            Surface documentation
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

function IntelligenceSystemCard({
  module,
  index,
}: {
  module: PlatformProgressModule;
  index: number;
}) {
  const hidePercent = isPlatformInfrastructureCoreSystem(module.id);
  const deploymentStatus = getPlatformInfrastructureDeploymentStatus(module.id);

  return (
    <FadeIn delay={0.02 * (index % 8)}>
      <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-transparent p-5 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/20 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
            {module.name}
          </h3>
          {hidePercent && deploymentStatus ? (
            <span className="max-w-[8rem] text-right text-[10px] font-semibold uppercase leading-snug tracking-[0.12em] text-emerald-200/85">
              Deployed
            </span>
          ) : (
            <span className="font-mono text-lg font-semibold tabular-nums text-amber-200/90">
              {module.completionPercent}%
            </span>
          )}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {hidePercent && deploymentStatus
            ? deploymentStatus
            : (module.statusLabel ?? module.status)}
        </p>
        {!hidePercent ? (
          <div className="mt-4">
            <PlatformProgressAnimatedBar
              percent={module.completionPercent}
              status={module.status}
              delay={0.04 + index * 0.02}
            />
          </div>
        ) : null}
      </div>
    </FadeIn>
  );
}

function ArchitecturalSystemGroup({
  group,
  groupIndex,
}: {
  group: PlatformSystemArchitectureGroup;
  groupIndex: number;
}) {
  const modules = resolvePlatformProgressModulesByName(group.moduleNames);

  return (
    <details
      open
      className="group/arch overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-black/15"
    >
      <summary className="cursor-pointer list-none px-6 py-6 sm:px-8 sm:py-7 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/55">
              Layer {String(groupIndex + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              {group.heading}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {group.description}
            </p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {modules.length} systems
          </span>
        </div>
      </summary>
      <div className="border-t border-white/[0.06] px-4 pb-6 pt-2 sm:px-6 sm:pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {modules.map((mod, i) => (
            <IntelligenceSystemCard key={mod.id} module={mod} index={groupIndex * 5 + i} />
          ))}
        </div>
      </div>
    </details>
  );
}

function PlatformMetricsStrip() {
  return (
    <section
      id="platform-metrics"
      className="border-b border-border/40 bg-background py-16 sm:py-20"
      aria-labelledby="platform-metrics-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <SectionHeading
            id="platform-metrics-heading"
            eyebrow={c.platformMetrics.eyebrow}
            title={c.platformMetrics.headline}
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {platformMetrics.map((metric, index) => (
              <GlassCard key={metric.label} className="border-white/[0.07] !p-5 sm:!p-6">
                <FadeIn delay={0.03 * index}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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

function PlatformArchitectureStack() {
  return (
    <Section
      id="platform-architecture"
      className="border-b border-border/40 bg-muted/[0.04] py-24 sm:py-28 md:py-32"
      aria-labelledby="platform-architecture-heading"
    >
      <FadeIn>
        <SectionHeading
          id="platform-architecture-heading"
          eyebrow={c.platformArchitecture.eyebrow}
          title={c.platformArchitecture.headline}
          description={c.platformArchitecture.intro}
          tone="audit"
        />
        <div className="mt-14 space-y-3">
          {PLATFORM_ARCHITECTURE_STACK.map((layer, index) => (
            <FadeIn key={layer.id} delay={0.04 * index}>
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.05] via-white/[0.02] to-transparent">
                <div className="grid gap-4 px-5 py-5 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-8 sm:px-8 sm:py-6">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                      Stack {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-2 font-display text-lg font-semibold uppercase tracking-[0.08em] text-foreground sm:text-xl">
                      {layer.label}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {layer.systems.map((system) => (
                      <span
                        key={system}
                        className="rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-foreground/90"
                      >
                        {system}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </FadeIn>
    </Section>
  );
}

function InfrastructureLayerCard({
  layer,
  index,
  icon: Icon,
}: {
  layer: (typeof PLATFORM_PROGRESS_INFRASTRUCTURE_LAYERS)[number];
  index: number;
  icon: typeof ServerCog;
}) {
  return (
    <FadeIn delay={0.04 * index}>
      <GlassCard className="h-full border-white/[0.07] !p-7 sm:!p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/30">
            <Icon className="h-5 w-5 text-amber-200/80" aria-hidden />
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
              {layer.name}
            </h3>
            <p className="mt-1 text-sm text-amber-100/75">{layer.tagline}</p>
          </div>
        </div>
        <ul className="mt-6 space-y-2.5">
          {layer.capabilities.map((cap) => (
            <li key={cap} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400/70" aria-hidden />
              {cap}
            </li>
          ))}
        </ul>
      </GlassCard>
    </FadeIn>
  );
}

function EventBusFeaturedSection() {
  return (
    <Section
      id="platform-event-bus"
      className="border-b border-border/40 bg-gradient-to-b from-cyan-950/[0.12] via-background to-background py-24 sm:py-28 md:py-32"
      aria-labelledby="platform-event-bus-heading"
    >
      <FadeIn>
        <SectionHeading
          id="platform-event-bus-heading"
          eyebrow={c.eventBus.eyebrow}
          title={c.eventBus.headline}
          description={c.eventBus.subtitle}
          tone="audit"
        />
        <GlassCard
          variant="os"
          className="mt-14 overflow-hidden border-cyan-400/20 !p-0 shadow-[0_32px_100px_rgb(0_0_0_/0.45),inset_0_1px_0_rgb(255_255_255_/0.08)]"
        >
          <div className="border-b border-cyan-400/15 bg-gradient-to-r from-cyan-950/40 via-black/20 to-transparent px-8 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-950/50">
                <Zap className="h-7 w-7 text-cyan-300" aria-hidden />
              </div>
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                  Asynchronous backbone
                </p>
                <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Platform Event Bus
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {getPlatformInfrastructureDeploymentStatus("event-bus")}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {c.eventBus.capabilities.map((cap, index) => (
              <div key={cap} className="bg-[#040810] px-6 py-5 sm:px-8 sm:py-6">
                <p className="font-mono text-[10px] tabular-nums text-cyan-200/50">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground/92">{cap}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </FadeIn>
    </Section>
  );
}

const INFRA_ICONS = [ServerCog, Shield, Network, BrainCircuit] as const;

function DeploymentTimeline() {
  return (
    <div className="mt-14 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgb(255_255_255_/0.035),transparent)] shadow-[0_24px_80px_rgb(0_0_0_/0.35),inset_0_1px_0_rgb(255_255_255_/0.05)]">
      <div className="border-b border-white/[0.07] px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <GitCommitHorizontal className="h-4 w-4 text-amber-300/70" aria-hidden />
            Infrastructure releases
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200/55">
            {PLATFORM_PROGRESS_DEPLOYMENT_MILESTONES.length} deployments
          </p>
        </div>
      </div>

      <ol className="divide-y divide-white/[0.06]">
        {PLATFORM_PROGRESS_DEPLOYMENT_MILESTONES.map((entry, index) => (
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
  );
}

function ExtendedChangelog() {
  return (
    <div className="mt-12 overflow-hidden rounded-[1.75rem] border border-white/[0.06] bg-black/20">
      <ol className="divide-y divide-white/[0.05]">
        {PLATFORM_PROGRESS_CHANGELOG.slice(0, 8).map((entry, index) => (
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
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">
                    {entry.tag}
                  </p>
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {entry.title}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {entry.summary}
                  </p>
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
  const vieModule = PLATFORM_PROGRESS_MODULES.find((m) => m.id === "visual-intelligence-engine");

  return (
    <>
      {/* Hero */}
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
            <div className="mt-12 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">
                <Sparkles className="h-4 w-4 text-amber-300/70" aria-hidden />
                <span>
                  Registry updated{" "}
                  <time
                    dateTime={c.hero.lastUpdated}
                    className="font-mono tabular-nums text-foreground/90"
                  >
                    {c.hero.lastUpdated}
                  </time>
                </span>
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground/90">
                {snapshot.activeModuleCount} systems · {snapshot.fiOsCorePlatformPercent}% ecosystem
                completion
              </span>
            </div>
          </FadeIn>
        </div>
      </section>

      <PlatformMetricsStrip />
      <PlatformArchitectureStack />

      {/* Grouped architectural systems */}
      <Section
        id="intelligence-systems"
        className="border-b border-border/40 bg-background py-24 sm:py-28 md:py-32"
        aria-labelledby="intelligence-systems-heading"
      >
        <FadeIn>
          <SectionHeading
            id="intelligence-systems-heading"
            eyebrow={c.intelligenceSystems.eyebrow}
            title={c.intelligenceSystems.headline}
            description={c.intelligenceSystems.intro}
          />
          <div className="mt-14 space-y-6">
            {PLATFORM_SYSTEM_ARCHITECTURE_GROUPS.map((group, index) => (
              <ArchitecturalSystemGroup key={group.id} group={group} groupIndex={index} />
            ))}
          </div>
        </FadeIn>
      </Section>

      {/* Module Registry */}
      <Section
        id="module-grid"
        className="border-b border-border/40 bg-muted/[0.04] py-24 sm:py-28 md:py-32"
        aria-labelledby="module-grid-heading"
      >
        <FadeIn>
          <SectionHeading
            id="module-grid-heading"
            eyebrow={c.modules.eyebrow}
            title={c.modules.headline}
            description={c.modules.intro}
          />
          <ul className="mt-14 grid list-none gap-8 p-0 md:grid-cols-2 xl:grid-cols-2">
            {PLATFORM_PROGRESS_MODULES.map((mod, i) => (
              <li key={mod.id} id={`progress-${mod.id}`} className="scroll-mt-28">
                <ModuleProgressCard module={mod} index={i} />
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      {/* Core Infrastructure Layer */}
      <Section
        id="core-infrastructure"
        className="border-b border-border/40 bg-background py-24 sm:py-28 md:py-32"
        aria-labelledby="core-infrastructure-heading"
      >
        <FadeIn>
          <SectionHeading
            id="core-infrastructure-heading"
            eyebrow={c.infrastructureLayer.eyebrow}
            title={c.infrastructureLayer.headline}
            description={c.infrastructureLayer.intro}
            tone="audit"
          />
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {PLATFORM_PROGRESS_INFRASTRUCTURE_LAYERS.map((layer, i) => (
              <InfrastructureLayerCard
                key={layer.id}
                layer={layer}
                index={i}
                icon={INFRA_ICONS[i] ?? ServerCog}
              />
            ))}
          </div>
        </FadeIn>
      </Section>

      <EventBusFeaturedSection />

      {/* VIE Standalone */}
      <Section
        id="visual-intelligence-engine"
        className="border-b border-border/40 bg-gradient-to-b from-violet-950/[0.08] via-background to-background py-24 sm:py-28 md:py-32"
        aria-labelledby="vie-heading"
      >
        <FadeIn>
          <SectionHeading
            id="vie-heading"
            eyebrow={c.vie.eyebrow}
            title={c.vie.headline}
            description={c.vie.intro}
            tone="intelligence"
          />
          <GlassCard variant="os" className="mt-14 border-violet-400/15 !p-8 sm:!p-10 md:!p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
              <div>
                {vieModule ? (
                  <>
                    <div className="flex flex-wrap items-center gap-4">
                      <PlatformProgressStatusBadge
                        status={vieModule.status}
                        label={vieModule.statusLabel}
                      />
                      <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                        {vieModule.completionPercent}%
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-medium uppercase tracking-[0.14em] text-violet-200/75">
                      {vieModule.stage}
                    </p>
                    <p className="mt-6 text-base leading-[1.75] text-muted-foreground">
                      {vieModule.description}
                    </p>
                    {vieModule.latestMilestone ? (
                      <p className="mt-6 rounded-xl border border-violet-400/15 bg-violet-950/20 px-4 py-3 text-sm text-foreground/90">
                        Latest: {vieModule.latestMilestone}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Capabilities
                </p>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {PLATFORM_PROGRESS_VIE_CAPABILITIES.map((cap) => (
                    <li
                      key={cap}
                      className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-foreground/90"
                    >
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      {/* Engineering Deployment Timeline */}
      <Section
        id="engineering-changelog"
        className="scroll-mt-28 border-b border-border/40 py-24 sm:py-28 md:py-32"
        aria-labelledby="milestones-heading"
      >
        <FadeIn>
          <SectionHeading
            id="milestones-heading"
            eyebrow={c.milestones.eyebrow}
            title={c.milestones.headline}
            description={c.milestones.intro}
          />
          <DeploymentTimeline />
        </FadeIn>
      </Section>

      {/* Intelligence Network — manifesto */}
      <Section
        id="intelligence-network"
        className="border-b border-border/40 bg-muted/[0.04] py-28 sm:py-32 md:py-40"
        aria-labelledby="intelligence-network-heading"
      >
        <FadeIn>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-violet-200/75">
            {c.intelligenceNetwork.eyebrow}
          </p>
          <div
            className="mt-4 h-px w-16 bg-gradient-to-r from-violet-300/55 to-transparent"
            aria-hidden
          />
          <h2
            id="intelligence-network-heading"
            className="mt-8 max-w-4xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl"
          >
            {c.intelligenceNetwork.headline}
          </h2>
          <div className="mt-16 max-w-4xl space-y-5 sm:space-y-6">
            {c.intelligenceNetwork.manifesto.map((line) => (
              <p
                key={line}
                className={cn(
                  "font-display tracking-tight text-foreground",
                  line.endsWith(".") && line.length > 28
                    ? "text-2xl font-semibold leading-snug sm:text-3xl md:text-4xl"
                    : "text-xl font-medium text-foreground/88 sm:text-2xl md:text-3xl"
                )}
              >
                {line}
              </p>
            ))}
          </div>
          <div className="mt-20 max-w-4xl space-y-8 border-t border-white/[0.08] pt-16">
            <p className="font-display text-2xl font-semibold leading-[1.5] tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {c.intelligenceNetwork.closing}
            </p>
            <p className="font-display text-xl font-semibold tracking-tight text-violet-200/90 sm:text-2xl md:text-3xl">
              {c.intelligenceNetwork.closingLine}
            </p>
          </div>
        </FadeIn>
      </Section>

      {/* Defensibility */}
      <Section
        id="platform-defensibility"
        className="border-b border-border/40 bg-background py-24 sm:py-28 md:py-32"
        aria-labelledby="platform-defensibility-heading"
      >
        <FadeIn>
          <SectionHeading
            id="platform-defensibility-heading"
            eyebrow={c.defensibility.eyebrow}
            title={c.defensibility.headline}
            description={c.defensibility.intro}
          />
          <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Replicating the platform requires simultaneous expertise in
              </p>
              <ul className="mt-8 space-y-4">
                {c.defensibility.expertiseAreas.map((area) => (
                  <li
                    key={area}
                    className="flex items-start gap-4 border-b border-white/[0.06] pb-4 last:border-0 last:pb-0"
                  >
                    <Layers3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-300/70" aria-hidden />
                    <span className="font-display text-lg font-medium tracking-tight text-foreground sm:text-xl">
                      {area}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <GlassCard className="border-amber-400/12 !p-8 sm:!p-10">
              <p className="text-lg leading-[1.75] text-foreground/92 sm:text-xl">
                {c.defensibility.closing}
              </p>
            </GlassCard>
          </div>
        </FadeIn>
      </Section>

      {/* Extended Changelog */}
      <Section
        id="extended-changelog"
        className="border-b border-border/40 py-24 sm:py-28 md:py-32"
        aria-labelledby="extended-changelog-heading"
      >
        <FadeIn>
          <SectionHeading
            id="extended-changelog-heading"
            eyebrow={c.changelog.eyebrow}
            title={c.changelog.headline}
            description={c.changelog.intro}
          />
          <ExtendedChangelog />
        </FadeIn>
      </Section>

      {/* Founder conviction closing */}
      <section
        id="platform-progress-closing"
        className="relative overflow-hidden bg-[#040810] py-28 sm:py-36 md:py-44"
        aria-labelledby="platform-progress-closing-heading"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(212_175_55_/0.12),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgb(167_139_250_/0.08),transparent_40%)]" />
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
              className="mt-10 max-w-5xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-foreground text-balance sm:text-5xl md:text-[3.5rem] md:leading-[1.06]"
            >
              {c.closing.headline}
            </h2>
            <div className="mt-16 max-w-4xl space-y-8">
              {c.closing.body.map((line) => (
                <p
                  key={line}
                  className="font-display text-xl font-medium leading-[1.65] tracking-tight text-foreground/88 sm:text-2xl md:text-[1.75rem] md:leading-[1.7]"
                >
                  {line}
                </p>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

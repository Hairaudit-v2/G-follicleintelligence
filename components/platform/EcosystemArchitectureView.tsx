"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import {
  ECOSYSTEM_ARCHITECTURE_PAGE_CONTENT,
  type EcosystemArchitectureLayer,
} from "@/lib/marketing/ecosystemArchitecturePageContent";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  Globe2,
  Layers3,
  Network,
  Sparkles,
  X,
  Check,
} from "lucide-react";

const c = ECOSYSTEM_ARCHITECTURE_PAGE_CONTENT;

const LAYER_ACCENT: Record<number, string> = {
  1: "from-emerald-400/20 via-emerald-950/10",
  2: "from-sky-400/18 via-sky-950/10",
  3: "from-violet-400/20 via-violet-950/10",
  4: "from-cyan-400/18 via-cyan-950/10",
  5: "from-amber-400/22 via-amber-950/12",
  6: "from-rose-400/18 via-rose-950/10",
  7: "from-blue-400/18 via-blue-950/10",
  8: "from-lime-400/16 via-lime-950/10",
  9: "from-fuchsia-400/18 via-fuchsia-950/10",
  10: "from-indigo-400/18 via-indigo-950/10",
  11: "from-teal-400/18 via-teal-950/10",
  12: "from-amber-400/24 via-amber-950/14",
};

function ArchitectureLayerCard({ layer }: { layer: EcosystemArchitectureLayer }) {
  const accent = LAYER_ACCENT[layer.layer] ?? "from-amber-400/20 via-amber-950/10";

  return (
    <div id={layer.anchorId} className="h-full scroll-mt-28">
      <GlassCard
        variant="os"
        className={cn(
          "group relative flex h-full flex-col overflow-hidden border-white/[0.07] !p-0",
          "transition-[border-color,transform,box-shadow] duration-300",
          "hover:-translate-y-1 hover:border-amber-400/25 hover:shadow-[0_32px_88px_rgb(212_175_55_/0.12)]"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent opacity-80",
            accent
          )}
        />
        <div className="relative flex flex-1 flex-col p-5 sm:p-6 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-950/30 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.18em] text-amber-100/90">
                  Layer {String(layer.layer).padStart(2, "0")}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {layer.title}
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-amber-50 sm:text-2xl">
                {layer.module}
              </h3>
            </div>
            <span
              className="hidden h-px w-16 shrink-0 self-center bg-gradient-to-r from-amber-400/45 to-transparent sm:block"
              aria-hidden
            />
          </div>

          <ul className="mt-5 grid flex-1 gap-2 sm:grid-cols-2">
            {layer.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5 text-sm leading-snug text-muted-foreground transition-colors group-hover:border-white/[0.08] group-hover:text-foreground/90"
              >
                <span
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/55"
                  aria-hidden
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl border border-amber-400/12 bg-gradient-to-r from-amber-950/25 to-transparent px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
              Purpose
            </p>
            <p className="mt-1.5 text-sm font-medium leading-snug text-foreground/95">
              {layer.purpose}
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function HeroAudiencePills() {
  return (
    <div className="mt-10 flex flex-wrap gap-2 sm:mt-12 sm:gap-2.5">
      {c.hero.audiences.map((audience) => (
        <span
          key={audience}
          className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/90 shadow-[inset_0_1px_0_rgb(255_255_255_/0.05)] transition-colors hover:border-amber-400/20 hover:bg-amber-950/20"
        >
          {audience}
        </span>
      ))}
    </div>
  );
}

function PhilosophyPillar({
  title,
  body,
  index,
}: {
  title: string;
  body: string;
  index: number;
}) {
  const icons = [Network, BrainCircuit, Globe2] as const;
  const Icon = icons[index] ?? Sparkles;

  return (
    <GlassCard className="group h-full border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/20">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-950/25 transition-colors group-hover:border-amber-400/30">
        <Icon className="h-5 w-5 text-amber-200/80" aria-hidden />
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-foreground md:text-xl">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
        {body}
      </p>
    </GlassCard>
  );
}

function CrmComparisonColumn({
  title,
  subtitle,
  items,
  variant,
}: {
  title: string;
  subtitle: string;
  items: readonly string[];
  variant: "traditional" | "fi";
}) {
  const isFi = variant === "fi";

  return (
    <GlassCard
      variant={isFi ? "os" : "default"}
      className={cn(
        "h-full !p-6 sm:!p-7 md:!p-8",
        isFi ? "border-amber-400/15" : "border-white/[0.07]"
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.22em]",
          isFi ? "text-amber-200/75" : "text-muted-foreground"
        )}
      >
        {subtitle}
      </p>
      <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h3>
      <ul className="mt-6 space-y-2.5">
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm leading-snug",
              isFi
                ? "border-amber-400/12 bg-amber-950/15 text-foreground/95"
                : "border-white/[0.06] bg-black/15 text-muted-foreground"
            )}
          >
            {isFi ? (
              <Check className="h-4 w-4 shrink-0 text-amber-300/80" aria-hidden />
            ) : (
              <X className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
            )}
            {item}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

function LearningLoopGrid() {
  return (
    <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {c.globalNetwork.learningLoop.map((item, index) => (
        <FadeIn key={item.subject} delay={0.04 * (index % 6)}>
          <GlassCard className="group h-full border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-cyan-400/20">
            <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em] text-cyan-200/50">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="mt-3 text-base leading-relaxed text-foreground sm:text-lg">
              <span className="font-semibold text-foreground">{item.subject}</span>{" "}
              <span className="text-muted-foreground">{item.outcome}</span>
            </p>
          </GlassCard>
        </FadeIn>
      ))}
    </div>
  );
}

export function EcosystemArchitectureView() {
  return (
    <>
      {/* Hero */}
      <section
        id={c.hero.id}
        aria-labelledby={`${c.hero.id}-heading`}
        className="fi-grid relative overflow-hidden border-b border-border/50"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.45] [mask-image:radial-gradient(ellipse_at_50%_40%,black_20%,transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_-8%,rgb(212_175_55_/0.22),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_95%_5%,hsl(var(--primary)/0.18),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_88%,rgb(0_0_0_/0.55),transparent_52%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/[0.04] to-background" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-28 lg:py-32">
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
              className="mt-5 max-w-5xl font-display text-[2.15rem] font-semibold leading-[1.06] tracking-tight text-foreground text-balance drop-shadow-[0_2px_36px_rgb(0_0_0_/0.45)] sm:text-4xl md:text-5xl lg:text-[3.35rem] lg:leading-[1.04]"
            >
              {c.hero.headline}
            </h1>
            <div className="mt-7 max-w-3xl space-y-1">
              <p className="text-lg font-semibold tracking-tight text-foreground/95 sm:text-xl md:text-2xl">
                {c.hero.subheadline}
              </p>
              <p className="text-lg font-medium leading-relaxed text-amber-100/90 sm:text-xl md:text-2xl">
                {c.hero.subheadlineAccent}
              </p>
            </div>
            <p className="mt-7 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:leading-[1.7]">
              {c.hero.body}
            </p>

            <HeroAudiencePills />

            <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:mt-12 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
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

      {/* Core philosophy */}
      <Section
        id={c.philosophy.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.philosophy.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.philosophy.id}-heading`}
            eyebrow={c.philosophy.eyebrow}
            title={c.philosophy.headline}
          />
          <div className="mt-8 max-w-3xl space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {c.philosophy.paragraphs.map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
          </div>
          <ul className="mt-12 grid list-none gap-5 p-0 sm:grid-cols-3 sm:gap-6">
            {c.philosophy.pillars.map((pillar, index) => (
              <li key={pillar.title}>
                <PhilosophyPillar title={pillar.title} body={pillar.body} index={index} />
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      {/* 12-layer architecture */}
      <Section
        id={c.architecture.id}
        className="scroll-mt-28 border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-32"
        aria-labelledby={`${c.architecture.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.architecture.id}-heading`}
            eyebrow={c.architecture.eyebrow}
            title={c.architecture.headline}
            description={c.architecture.intro}
          />

          <div className="relative mt-14 overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.14),transparent_55%),linear-gradient(180deg,rgb(255_255_255_/0.045),transparent)] p-5 shadow-[0_24px_80px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:mt-16 sm:rounded-[2rem] sm:p-8 md:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-amber-400/25 via-amber-400/10 to-transparent"
              style={{ transform: "translateX(-50%)" }}
            />
            <div className="relative flex flex-col items-center gap-3 text-center">
              <Layers3 className="h-6 w-6 text-amber-300/70" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
                {c.architecture.caption}
              </p>
            </div>

            <ul className="relative mt-10 grid list-none gap-6 p-0 sm:gap-7 lg:grid-cols-2 lg:gap-8">
              {c.architecture.layers.map((layer, index) => (
                <li key={layer.layer}>
                  <FadeIn delay={0.03 * (index % 4)}>
                    <ArchitectureLayerCard layer={layer} />
                  </FadeIn>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </Section>

      {/* CRM comparison */}
      <Section
        id={c.crmComparison.id}
        className="border-b border-border/50 bg-muted/[0.05] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.crmComparison.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.crmComparison.id}-heading`}
            eyebrow={c.crmComparison.eyebrow}
            title={c.crmComparison.headline}
            description={c.crmComparison.intro}
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
            <CrmComparisonColumn
              title={c.crmComparison.traditional.title}
              subtitle={c.crmComparison.traditional.subtitle}
              items={c.crmComparison.traditional.items}
              variant="traditional"
            />
            <CrmComparisonColumn
              title={c.crmComparison.follicleIntelligence.title}
              subtitle={c.crmComparison.follicleIntelligence.subtitle}
              items={c.crmComparison.follicleIntelligence.items}
              variant="fi"
            />
          </div>

          <GlassCard
            variant="os"
            className="mt-8 border-amber-400/15 !p-6 sm:!p-8 md:mt-10"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">
              Switching economics
            </p>
            <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {c.crmComparison.switchingCost.headline}
            </h3>
            <p className="mt-4 max-w-4xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.crmComparison.switchingCost.body}
            </p>
          </GlassCard>
        </FadeIn>
      </Section>

      {/* Global intelligence network */}
      <Section
        id={c.globalNetwork.id}
        className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-[#040810] via-[#040810]/90 to-background py-20 sm:py-24 md:py-32"
        aria-labelledby={`${c.globalNetwork.id}-heading`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgb(34_211_238_/0.08),transparent_55%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgb(212_175_55_/0.08),transparent_50%)]"
        />

        <FadeIn>
          <SectionHeading
            id={`${c.globalNetwork.id}-heading`}
            eyebrow={c.globalNetwork.eyebrow}
            title={c.globalNetwork.headline}
            description={c.globalNetwork.intro}
            tone="intelligence"
          />

          <LearningLoopGrid />

          <div className="relative mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch lg:gap-8">
            <GlassCard className="border-cyan-400/12 bg-[linear-gradient(135deg,rgb(34_211_238_/0.06),transparent_55%)] !p-6 sm:!p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
                Future target
              </p>
              <p className="mt-4 font-mono text-5xl font-semibold tabular-nums tracking-tight text-foreground sm:text-6xl">
                {c.globalNetwork.target.metric}
              </p>
              <p className="mt-2 text-lg font-semibold uppercase tracking-[0.12em] text-foreground/90">
                {c.globalNetwork.target.label}
              </p>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {c.globalNetwork.target.description}
              </p>
            </GlassCard>

            <GlassCard
              variant="os"
              className="flex flex-col justify-center border-amber-400/15 !p-6 sm:!p-8"
            >
              <Sparkles className="h-6 w-6 text-amber-200/75" aria-hidden />
              <p className="mt-5 font-display text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">
                {c.globalNetwork.closingStatement}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                The AI continuously learns. Every clinic that joins strengthens predictive capability
                for the entire network — governed, structured, and built for clinical rigor.
              </p>
            </GlassCard>
          </div>
        </FadeIn>
      </Section>

      {/* Final CTA */}
      <section
        id={c.finalCta.id}
        className="border-b border-border/50 bg-gradient-to-b from-muted/[0.06] via-background to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.finalCta.id}-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="rounded-[1.75rem] border border-amber-400/18 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-7 shadow-[0_28px_90px_rgb(0_0_0_/0.48),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md sm:rounded-[2rem] sm:p-10 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/85">
                    {c.finalCta.eyebrow}
                  </p>
                  <div
                    className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent"
                    aria-hidden
                  />
                  <h2
                    id={`${c.finalCta.id}-heading`}
                    className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl"
                  >
                    {c.finalCta.headline}
                  </h2>
                  <p className="mt-4 font-display text-xl font-semibold tracking-tight text-amber-100/90 sm:text-2xl">
                    {c.finalCta.subheadline}
                  </p>
                  <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {c.finalCta.body}
                  </p>
                </div>
                <div className="flex w-full max-w-md flex-col gap-3 lg:max-w-none lg:justify-self-end">
                  <Button asChild size="lg" className={MARKETING_CTA_PRIMARY_CLASS}>
                    <Link href={c.finalCta.primaryCta.href}>
                      {c.finalCta.primaryCta.label}
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className={MARKETING_CTA_SECONDARY_CLASS}
                  >
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

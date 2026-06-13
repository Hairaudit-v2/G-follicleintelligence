"use client";

import { Fragment } from "react";
import Link from "next/link";

import { Section } from "@/components/layout/section";
import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { INTELLIGENCE_PAGE_CONTENT } from "@/lib/marketing/intelligencePageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Cpu,
  GitBranch,
  Layers,
  Network,
  Share2,
} from "lucide-react";

const c = INTELLIGENCE_PAGE_CONTENT;

/** Decorative twin / graph motif (no real data). */
function TwinSignalDecor({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none select-none font-mono text-[9px] uppercase tabular-nums tracking-[0.14em] text-violet-200/28 sm:text-[10px]",
        className
      )}
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-white/[0.04] py-1.5">
        <span className="w-10 shrink-0">TWIN</span>
        <span className="h-px flex-1 bg-gradient-to-r from-violet-400/18 to-transparent" />
        <span className="shrink-0 text-fuchsia-200/35">GRAPH</span>
      </div>
      <div className="flex items-center gap-2 border-b border-white/[0.04] py-1.5">
        <span className="w-10 shrink-0">SIG</span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
        <span className="shrink-0 text-violet-200/32">LONG</span>
      </div>
      <div className="flex items-center gap-2 border-b border-white/[0.04] py-1.5">
        <span className="w-10 shrink-0">NODE</span>
        <span className="h-px flex-1 bg-gradient-to-r from-fuchsia-400/12 to-transparent" />
        <span className="shrink-0 text-violet-200/28">PAIR</span>
      </div>
      <div className="flex items-center gap-2 py-1.5">
        <span className="w-10 shrink-0">AUD</span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/[0.04] to-transparent" />
        <span className="shrink-0 text-fuchsia-200/25">MESH</span>
      </div>
    </div>
  );
}

export function IntelligenceMarketingView() {
  const flow = [...c.connected.flow];

  return (
    <>
      <section
        id={c.hero.id}
        aria-labelledby={`${c.hero.id}-heading`}
        className="fi-grid relative overflow-hidden border-b border-border/50 bg-[rgb(2_2_10_/0.92)]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.42] [mask-image:radial-gradient(ellipse_at_50%_22%,black_16%,transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgb(139_92_246_/0.11),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_88%_8%,rgb(217_70_239_/0.08),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(0_0_0_/0.78),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255_/0.028)_1px,transparent_1px)] bg-[size:48px_100%] opacity-[0.11]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/[0.12] to-background" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
          <div className="grid gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
            <FadeIn>
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-violet-200/82 sm:text-[11px]">{c.hero.eyebrow}</p>
              <div className="mt-3 h-px w-14 bg-gradient-to-r from-violet-300/55 via-fuchsia-400/22 to-transparent" aria-hidden />
              <h1
                id={`${c.hero.id}-heading`}
                className="mt-5 max-w-4xl font-display text-[2.05rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance drop-shadow-[0_2px_36px_rgb(0_0_0_/0.55)] sm:text-4xl md:text-5xl md:leading-[1.06] lg:max-w-5xl"
              >
                {c.hero.headline}
              </h1>
              <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-foreground/85 sm:text-lg md:text-xl md:leading-relaxed">
                {c.hero.subtext}
              </p>
              <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <Button
                  asChild
                  size="lg"
                  className={cn(
                    MARKETING_CTA_PRIMARY_CLASS,
                    "min-w-[12rem] shadow-[0_18px_52px_rgb(139_92_246_/0.12),inset_0_1px_0_rgb(255_255_255_/0.1)]"
                  )}
                >
                  <Link href={c.hero.primaryCta.href}>
                    {c.hero.primaryCta.label}
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem] hover:border-violet-300/25")}
                >
                  <Link href={c.hero.secondaryCta.href}>
                    {c.hero.secondaryCta.label}
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  </Link>
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={0.08}>
              <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
                <div className="absolute -inset-3 rounded-[1.5rem] bg-gradient-to-br from-violet-500/12 via-transparent to-fuchsia-950/35 blur-2xl" aria-hidden />
                <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-gradient-to-br from-white/[0.055] via-slate-950/[0.38] to-[rgb(3_4_16_/0.94)] p-5 shadow-[0_28px_80px_rgb(0_0_0_/0.52),inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-md sm:p-6">
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2 text-violet-200/78">
                      <Network className="h-4 w-4 shrink-0 opacity-85" aria-hidden />
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]">Intelligence mesh</span>
                    </div>
                    <Cpu className="h-4 w-4 shrink-0 text-fuchsia-200/35" aria-hidden />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TwinSignalDecor />
                    <div className="hidden rounded-xl border border-dashed border-violet-400/14 bg-slate-950/[0.38] p-3 sm:block">
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-200/42">Twin signal</p>
                      <div className="mt-4 flex items-end justify-between gap-2">
                        {[40, 65, 48, 82].map((h, i) => (
                          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                            <div
                              className="w-full max-w-[2.25rem] rounded-sm bg-gradient-to-t from-violet-500/25 to-fuchsia-400/15"
                              style={{ height: `${h}px` }}
                            />
                            <span className="font-mono text-[8px] text-muted-foreground/45">D{i + 1}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/55">Illustrative only — not patient data.</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <Section
        id={c.problem.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-violet-950/[0.06] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.problem.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.problem.id}-heading`} tone="intelligence" eyebrow={c.problem.eyebrow} title={c.problem.headline} />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {c.problem.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 4)}>
                  <GlassCard
                    variant="problem"
                    className="flex h-full flex-col border-violet-500/[0.08] bg-gradient-to-br from-white/[0.045] to-violet-950/[0.08] hover:border-violet-400/18"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-semibold tabular-nums tracking-[0.12em] text-violet-200/38">DATA</span>
                      <span className="h-px flex-1 bg-gradient-to-r from-violet-400/18 to-transparent" aria-hidden />
                    </div>
                    <h3 className="mt-2.5 font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">{card.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">{card.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.hairLongevityInstitute.id}
        className="border-b border-border/50 bg-muted/[0.02] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.hairLongevityInstitute.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.hairLongevityInstitute.id}-heading`}
            tone="intelligence"
            eyebrow={c.hairLongevityInstitute.eyebrow}
            title={c.hairLongevityInstitute.headline}
          />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/18 bg-violet-500/[0.07] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100/90">
              <Layers className="h-3.5 w-3.5 opacity-80" aria-hidden />
              {c.hairLongevityInstitute.publicLabel}
            </span>
            <span className="text-sm text-muted-foreground">Diagnostic and medical-management intelligence before surgery.</span>
          </div>
          <GlassCard className="mt-8 max-w-3xl border-violet-500/[0.08] bg-gradient-to-br from-white/[0.04] via-slate-950/[0.04] to-fuchsia-950/[0.05]">
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.hairLongevityInstitute.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.patientTwin.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.patientTwin.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.patientTwin.id}-heading`} tone="intelligence" eyebrow={c.patientTwin.eyebrow} title={c.patientTwin.headline} />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {c.patientTwin.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.03 * (i % 4)}>
                  <GlassCard
                    variant="os"
                    className="flex h-full flex-col !rounded-[1.2rem] border-violet-500/[0.06] !p-5 hover:border-violet-400/22 sm:!p-5"
                  >
                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
                      <GitBranch className="h-3.5 w-3.5 shrink-0 text-fuchsia-200/40" aria-hidden />
                      <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.14em] text-violet-200/36">
                        TWIN · {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">{card.title}</h3>
                    <p className="mt-2.5 flex-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">{card.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.connected.id}
        className="border-b border-border/50 bg-gradient-to-b from-muted/[0.03] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.connected.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.connected.id}-heading`} tone="intelligence" eyebrow={c.connected.eyebrow} title={c.connected.headline} />
          <div className="mt-10">
            <div className="mb-4 flex items-center gap-2 text-violet-200/65">
              <Share2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Connected flow</span>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-stretch md:gap-x-1 md:gap-y-3">
              {flow.map((label, idx) => (
                <Fragment key={label}>
                  <GlassCard className="border-white/[0.07] px-4 py-3 md:max-w-[11.5rem] md:flex-1 lg:max-w-none lg:flex-initial">
                    <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-200/35">STEP {String(idx + 1).padStart(2, "0")}</p>
                    <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground sm:text-base">{label}</p>
                  </GlassCard>
                  {idx < flow.length - 1 ? (
                    <div
                      className="flex items-center justify-center py-0.5 md:w-7 md:shrink-0 md:self-center md:py-0"
                      aria-hidden
                    >
                      <ChevronDown className="h-5 w-5 text-violet-300/28 md:hidden" />
                      <ChevronRight className="hidden h-5 w-5 text-violet-300/28 md:block" />
                    </div>
                  ) : null}
                </Fragment>
              ))}
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.predictive.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.predictive.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.predictive.id}-heading`} tone="intelligence" eyebrow={c.predictive.eyebrow} title={c.predictive.headline} />
          <GlassCard className="mt-8 max-w-3xl border-fuchsia-500/[0.08] bg-fuchsia-950/[0.04]">
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{c.predictive.disclaimer}</p>
          </GlassCard>
          <ul className="mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {c.predictive.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 4)}>
                  <GlassCard className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-violet-400/18">
                    <div className="flex items-center gap-2 text-violet-200/55">
                      <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em]">Future models</span>
                    </div>
                    <h3 className="mt-3 font-display text-base font-semibold tracking-tight text-foreground md:text-lg">{card.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.why.id}
        className="border-b border-border/50 bg-muted/[0.025] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.why.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.why.id}-heading`} tone="intelligence" eyebrow={c.why.eyebrow} title={c.why.headline} />
          <GlassCard className="mt-10 max-w-3xl border-violet-500/[0.07] bg-gradient-to-br from-white/[0.035] to-slate-950/[0.18]">
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.why.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      <section
        id={c.finalCta.id}
        className="border-t border-border/50 bg-gradient-to-b from-background via-violet-950/[0.1] to-muted/[0.08] pb-20 pt-14 sm:pb-24 sm:pt-16 md:pt-20"
        aria-labelledby={`${c.finalCta.id}-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="rounded-[1.75rem] border border-violet-500/[0.12] bg-gradient-to-br from-white/[0.04] via-slate-950/[0.22] to-fuchsia-950/[0.07] p-7 shadow-[0_28px_90px_rgb(0_0_0_/0.5),inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-md sm:rounded-[2rem] sm:p-10 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-200/78">{c.finalCta.eyebrow}</p>
                  <div className="mt-3 h-px w-14 bg-gradient-to-r from-violet-300/50 via-fuchsia-400/18 to-transparent" aria-hidden />
                  <h2
                    id={`${c.finalCta.id}-heading`}
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
                  <Button asChild variant="outline" size="lg" className={cn(MARKETING_CTA_SECONDARY_CLASS, "hover:border-violet-300/25")}>
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

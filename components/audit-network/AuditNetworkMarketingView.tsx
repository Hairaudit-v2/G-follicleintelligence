"use client";

import Link from "next/link";

import { Section } from "@/components/layout/section";
import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { AUDIT_NETWORK_PAGE_CONTENT } from "@/lib/marketing/auditNetworkPageContent";
import { MARKETING_CTA_PRIMARY_CLASS, MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight, FileCheck2, LayoutGrid } from "lucide-react";

const c = AUDIT_NETWORK_PAGE_CONTENT;

/** Decorative “report row” for scorecard / evidence motif (no real data). */
function ReportRowDecor({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none select-none font-mono text-[9px] uppercase tabular-nums tracking-[0.14em] text-cyan-200/25 sm:text-[10px]",
        className
      )}
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-white/[0.04] py-1.5">
        <span className="w-8 shrink-0">REF</span>
        <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/12 to-transparent" />
        <span className="shrink-0 text-cyan-200/35">CAPTURE</span>
      </div>
      <div className="flex items-center gap-2 border-b border-white/[0.04] py-1.5">
        <span className="w-8 shrink-0">01</span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
        <span className="shrink-0 text-cyan-200/30">BASELINE</span>
      </div>
      <div className="flex items-center gap-2 border-b border-white/[0.04] py-1.5">
        <span className="w-8 shrink-0">02</span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/[0.05] to-transparent" />
        <span className="shrink-0 text-cyan-200/28">REVIEW</span>
      </div>
      <div className="flex items-center gap-2 py-1.5">
        <span className="w-8 shrink-0">03</span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/[0.04] to-transparent" />
        <span className="shrink-0 text-cyan-200/22">BENCH</span>
      </div>
    </div>
  );
}

export function AuditNetworkMarketingView() {
  return (
    <>
      <section
        id={c.hero.id}
        aria-labelledby={`${c.hero.id}-heading`}
        className="fi-grid relative overflow-hidden border-b border-border/50 bg-[rgb(1_3_8_/0.88)]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.38] [mask-image:radial-gradient(ellipse_at_50%_28%,black_18%,transparent_74%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgb(34_211_238_/0.09),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_92%_12%,rgb(100_116_139_/0.14),transparent_44%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(0_0_0_/0.72),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255_/0.03)_1px,transparent_1px)] bg-[size:56px_100%] opacity-[0.12]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/[0.22] to-background" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <FadeIn>
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-cyan-200/80 sm:text-[11px]">{c.hero.eyebrow}</p>
              <div className="mt-3 h-px w-14 bg-gradient-to-r from-cyan-300/60 via-cyan-400/20 to-transparent" aria-hidden />
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
                    "min-w-[12rem] shadow-[0_18px_52px_rgb(34_211_238_/0.12),inset_0_1px_0_rgb(255_255_255_/0.1)]"
                  )}
                >
                  <Link href={c.hero.primaryCta.href}>
                    {c.hero.primaryCta.label}
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem] hover:border-cyan-300/22")}>
                  <Link href={c.hero.secondaryCta.href}>
                    {c.hero.secondaryCta.label}
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  </Link>
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={0.08}>
              <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
                <div className="absolute -inset-3 rounded-[1.5rem] bg-gradient-to-br from-cyan-400/10 via-transparent to-slate-900/40 blur-2xl" aria-hidden />
                <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-gradient-to-br from-white/[0.06] via-slate-950/[0.35] to-[rgb(2_6_12_/0.92)] p-5 shadow-[0_28px_80px_rgb(0_0_0_/0.5),inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-md sm:p-6">
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2 text-cyan-200/75">
                      <FileCheck2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]">Evidence envelope</span>
                    </div>
                    <LayoutGrid className="h-4 w-4 shrink-0 text-cyan-200/35" aria-hidden />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <ReportRowDecor />
                    <div className="hidden rounded-xl border border-dashed border-cyan-400/12 bg-slate-950/[0.35] p-3 sm:block">
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-200/40">Scorecard motif</p>
                      <div className="mt-3 space-y-2">
                        {[72, 54, 88].map((w, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-5 font-mono text-[10px] text-cyan-200/25">{i + 1}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400/35 to-cyan-200/10" style={{ width: `${w}%` }} />
                            </div>
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
        className="border-b border-border/50 bg-gradient-to-b from-background via-slate-950/[0.08] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.problem.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.problem.id}-heading`} tone="audit" eyebrow={c.problem.eyebrow} title={c.problem.headline} />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {c.problem.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 4)}>
                  <GlassCard
                    variant="problem"
                    className="flex h-full flex-col border-cyan-500/[0.07] bg-gradient-to-br from-white/[0.05] to-slate-950/[0.12] hover:border-cyan-400/16"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-semibold tabular-nums tracking-[0.12em] text-cyan-200/35">ISSUE</span>
                      <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/15 to-transparent" aria-hidden />
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
        id={c.hairAudit.id}
        className="border-b border-border/50 bg-muted/[0.025] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.hairAudit.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.hairAudit.id}-heading`} tone="audit" eyebrow={c.hairAudit.eyebrow} title={c.hairAudit.headline} />
          <GlassCard className="mt-10 max-w-3xl border-cyan-500/[0.07] bg-gradient-to-br from-white/[0.04] via-slate-950/[0.04] to-cyan-950/[0.05]">
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.hairAudit.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.measures.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.measures.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.measures.id}-heading`} tone="audit" eyebrow={c.measures.eyebrow} title={c.measures.headline} />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-5">
            {c.measures.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.03 * (i % 5)}>
                  <GlassCard variant="os" className="flex h-full flex-col !rounded-[1.25rem] border-cyan-500/[0.05] !p-5 hover:border-cyan-400/22 sm:!p-5">
                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
                      <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.16em] text-cyan-200/38">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/18 via-white/[0.04] to-transparent" aria-hidden />
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
        id={c.qualityIntel.id}
        className="border-b border-border/50 bg-gradient-to-b from-muted/[0.035] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.qualityIntel.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.qualityIntel.id}-heading`} tone="audit" eyebrow={c.qualityIntel.eyebrow} title={c.qualityIntel.headline} />
          <GlassCard className="mt-10 max-w-3xl border-white/[0.07]">
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.qualityIntel.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.useCases.id}
        className="border-b border-border/50 bg-muted/[0.02] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.useCases.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.useCases.id}-heading`} tone="audit" eyebrow={c.useCases.eyebrow} title={c.useCases.headline} />
          <ul className="mt-12 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.useCases.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.05 * (i % 3)}>
                  <GlassCard className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-cyan-400/18">
                    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground md:text-xl">{card.title}</h3>
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground md:text-base">{card.body}</p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.trust.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.trust.id}-heading`}
      >
        <FadeIn>
          <SectionHeading id={`${c.trust.id}-heading`} tone="audit" eyebrow={c.trust.eyebrow} title={c.trust.headline} />
          <GlassCard className="mt-10 max-w-3xl border-cyan-500/[0.06] bg-gradient-to-br from-white/[0.035] to-slate-950/[0.2]">
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.trust.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      <section
        id={c.finalCta.id}
        className="border-t border-border/50 bg-gradient-to-b from-background via-slate-950/[0.12] to-muted/[0.08] pb-20 pt-14 sm:pb-24 sm:pt-16 md:pt-20"
        aria-labelledby={`${c.finalCta.id}-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="rounded-[1.75rem] border border-cyan-500/[0.1] bg-gradient-to-br from-white/[0.04] via-slate-950/[0.2] to-cyan-950/[0.06] p-7 shadow-[0_28px_90px_rgb(0_0_0_/0.5),inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-md sm:rounded-[2rem] sm:p-10 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/78">{c.finalCta.eyebrow}</p>
                  <div className="mt-3 h-px w-14 bg-gradient-to-r from-cyan-300/55 via-cyan-400/18 to-transparent" aria-hidden />
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
                  <Button asChild variant="outline" size="lg" className={cn(MARKETING_CTA_SECONDARY_CLASS, "hover:border-cyan-300/22")}>
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

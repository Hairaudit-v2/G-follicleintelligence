"use client";

import Link from "next/link";

import { Section } from "@/components/layout/section";
import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { ACADEMY_PAGE_CONTENT } from "@/lib/marketing/academyPageContent";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

const c = ACADEMY_PAGE_CONTENT;

export function AcademyMarketingView() {
  return (
    <>
      <section
        id={c.hero.id}
        aria-labelledby={`${c.hero.id}-heading`}
        className="fi-grid relative overflow-hidden border-b border-border/50 bg-[rgb(2_4_10_/0.72)]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.42] [mask-image:radial-gradient(ellipse_at_50%_32%,black_16%,transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgb(212_175_55_/0.16),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_88%_8%,rgb(99_102_241_/0.11),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(0_0_0_/0.68),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/[0.18] to-background" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
          <FadeIn>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-200/85 sm:text-[11px]">
              {c.hero.eyebrow}
            </p>
            <div
              className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/65 via-amber-400/22 to-transparent"
              aria-hidden
            />
            <h1
              id={`${c.hero.id}-heading`}
              className="mt-5 max-w-4xl font-display text-[2.05rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance drop-shadow-[0_2px_36px_rgb(0_0_0_/0.5)] sm:text-4xl md:text-5xl md:leading-[1.06] lg:max-w-5xl"
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
                  "min-w-[12rem] shadow-[0_18px_52px_rgb(212_175_55_/0.16),inset_0_1px_0_rgb(255_255_255_/0.12)]"
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

      <Section
        id={c.problem.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-slate-950/[0.06] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.problem.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.problem.id}-heading`}
            eyebrow={c.problem.eyebrow}
            title={c.problem.headline}
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {c.problem.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 4)}>
                  <GlassCard
                    variant="problem"
                    className="flex h-full flex-col border-amber-400/[0.07]"
                  >
                    <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
                      {card.body}
                    </p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.iihr.id}
        className="border-b border-border/50 bg-muted/[0.03] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.iihr.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.iihr.id}-heading`}
            eyebrow={c.iihr.eyebrow}
            title={c.iihr.headline}
          />
          <GlassCard className="mt-10 max-w-3xl border-white/[0.08] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-indigo-950/[0.06]">
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.iihr.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.trainingTracks.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.trainingTracks.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.trainingTracks.id}-heading`}
            eyebrow={c.trainingTracks.eyebrow}
            title={c.trainingTracks.headline}
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {c.trainingTracks.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.04 * (i % 4)}>
                  <GlassCard
                    variant="default"
                    className="flex h-full min-h-[10rem] flex-col border-white/[0.07] bg-gradient-to-br from-white/[0.045] to-transparent sm:min-h-[10.5rem]"
                  >
                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
                      <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.16em] text-indigo-200/40">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="h-px flex-1 bg-gradient-to-r from-indigo-400/20 via-amber-400/15 to-transparent"
                        aria-hidden
                      />
                    </div>
                    <h3 className="mt-3 font-display text-base font-semibold tracking-tight text-foreground md:text-lg">
                      {card.title}
                    </h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
                      {card.body}
                    </p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.competency.id}
        className="border-b border-border/50 bg-gradient-to-b from-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.competency.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.competency.id}-heading`}
            eyebrow={c.competency.eyebrow}
            title={c.competency.headline}
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-5">
            {c.competency.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.03 * (i % 5)}>
                  <GlassCard
                    variant="os"
                    className="flex h-full flex-col !rounded-[1.25rem] border-white/[0.06] !p-5 sm:!p-5"
                  >
                    <h3 className="font-display text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">
                      {card.title}
                    </h3>
                    <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {card.body}
                    </p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section
        id={c.connected.id}
        className="border-b border-border/50 bg-muted/[0.03] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.connected.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.connected.id}-heading`}
            eyebrow={c.connected.eyebrow}
            title={c.connected.headline}
          />
          <GlassCard className="mt-10 max-w-3xl border-white/[0.08]">
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.connected.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
            <ul className="mt-8 grid list-none gap-3 border-t border-white/[0.06] p-0 pt-8 sm:grid-cols-1 md:grid-cols-2">
              {c.connected.signals.map((signal) => (
                <li key={signal} className="flex gap-3 text-sm leading-snug text-foreground/90">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/45"
                    aria-hidden
                  />
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </FadeIn>
      </Section>

      <Section
        id={c.enterprise.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.enterprise.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.enterprise.id}-heading`}
            eyebrow={c.enterprise.eyebrow}
            title={c.enterprise.headline}
          />
          <ul className="mt-12 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.enterprise.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.05 * (i % 3)}>
                  <GlassCard className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/18">
                    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground md:text-xl">
                      {card.title}
                    </h3>
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground md:text-base">
                      {card.body}
                    </p>
                  </GlassCard>
                </FadeIn>
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <section
        id={c.finalCta.id}
        className="border-t border-border/50 bg-gradient-to-b from-background via-slate-950/[0.08] to-muted/[0.1] pb-20 pt-14 sm:pb-24 sm:pt-16 md:pt-20"
        aria-labelledby={`${c.finalCta.id}-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="rounded-[1.75rem] border border-white/[0.1] bg-gradient-to-br from-white/[0.05] via-indigo-950/[0.04] to-transparent p-7 shadow-[0_28px_90px_rgb(0_0_0_/0.45),inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-md sm:rounded-[2rem] sm:p-10 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
                    {c.finalCta.eyebrow}
                  </p>
                  <div
                    className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/65 via-amber-400/22 to-transparent"
                    aria-hidden
                  />
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

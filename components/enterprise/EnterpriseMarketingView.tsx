"use client";

import { Fragment } from "react";
import Link from "next/link";

import { Section } from "@/components/layout/section";
import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { ENTERPRISE_PAGE_CONTENT } from "@/lib/marketing/enterprisePageContent";
import {
  MARKETING_CTA_PRIMARY_CLASS,
  MARKETING_CTA_SECONDARY_CLASS,
} from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

const c = ENTERPRISE_PAGE_CONTENT;

function EnterpriseGovernanceBands() {
  return (
    <div className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.12),transparent_50%),linear-gradient(180deg,rgb(255_255_255_/0.045),transparent)] p-5 shadow-[0_24px_80px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:mt-14 sm:rounded-[2rem] sm:p-8 md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-amber-400/25 via-amber-400/10 to-transparent"
        style={{ transform: "translateX(-50%)" }}
      />
      <p className="relative text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
        {c.governance.diagramCaption}
      </p>
      <div className="relative mt-10 space-y-10">
        {c.governance.bands.map((band, bandIdx) => (
          <div key={band.title}>
            <div className="relative flex flex-col items-center">
              <span className="max-w-[min(100%,28rem)] text-center text-[10px] font-semibold uppercase leading-relaxed tracking-[0.22em] text-amber-100/90 sm:max-w-none">
                {band.title}
              </span>
              <p className="mt-3 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                {band.summary}
              </p>
            </div>
            {bandIdx < c.governance.bands.length - 1 ? (
              <div
                className="mx-auto mt-10 flex h-10 w-px flex-col items-center justify-center bg-gradient-to-b from-amber-400/35 via-amber-400/12 to-transparent"
                aria-hidden
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpansionStoryTimeline({ steps }: { steps: readonly string[] }) {
  return (
    <>
      <div className="relative mt-12 hidden lg:block">
        <div
          className="pointer-events-none absolute left-0 right-0 top-[42%] h-px bg-gradient-to-r from-transparent via-amber-400/25 to-transparent"
          aria-hidden
        />
        <div className="overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/25">
          <ol className="flex min-w-min items-stretch gap-0 px-1">
            {steps.map((step, index) => (
              <Fragment key={step}>
                <li className="flex w-[7.35rem] shrink-0 flex-col xl:w-[7.75rem]">
                  <GlassCard
                    variant="default"
                    className="h-full border-amber-400/10 !p-3.5 !shadow-[0_12px_40px_rgb(0_0_0_/0.28)] sm:!p-4"
                  >
                    <span className="font-mono text-[9px] font-semibold uppercase tabular-nums tracking-[0.18em] text-amber-200/55">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-2 text-[0.75rem] font-medium leading-snug text-foreground xl:text-[0.8125rem]">
                      {step}
                    </p>
                  </GlassCard>
                </li>
                {index < steps.length - 1 ? (
                  <li
                    className="flex w-6 shrink-0 items-center justify-center self-center pt-6 xl:w-7"
                    aria-hidden
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-amber-400/45" strokeWidth={2} />
                  </li>
                ) : null}
              </Fragment>
            ))}
          </ol>
        </div>
      </div>

      <ol className="relative mx-auto mt-10 max-w-3xl space-y-0 border-l border-amber-400/25 pl-6 sm:mt-12 sm:pl-8 md:max-w-4xl lg:hidden">
        {steps.map((step, index) => (
          <li key={step} className="relative pb-7 last:pb-0 sm:pb-9">
            <span
              aria-hidden
              className="absolute -left-[19px] top-2 flex h-3 w-3 items-center justify-center rounded-full border border-amber-300/45 bg-gradient-to-br from-amber-200/55 to-amber-800/30 shadow-[0_0_16px_rgb(212_175_55_/0.35)] sm:-left-[21px]"
            />
            <GlassCard
              variant="default"
              className="border-amber-400/10 !shadow-[0_12px_40px_rgb(0_0_0_/0.28)]"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">
                Stage {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-[0.95rem] font-medium leading-snug text-foreground sm:text-lg">
                {step}
              </p>
            </GlassCard>
          </li>
        ))}
      </ol>
    </>
  );
}

export function EnterpriseMarketingView() {
  return (
    <>
      <section
        id={c.hero.id}
        aria-labelledby={`${c.hero.id}-heading`}
        className="fi-grid relative overflow-hidden border-b border-border/50 bg-[rgb(4_6_12_/0.35)]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.45] [mask-image:radial-gradient(ellipse_at_50%_40%,black_20%,transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_-8%,rgb(212_175_55_/0.22),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_95%_5%,hsl(var(--primary)/0.16),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_88%,rgb(0_0_0_/0.6),transparent_52%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/[0.06] to-background" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
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
              className="mt-5 max-w-4xl font-display text-[2.1rem] font-semibold leading-[1.08] tracking-tight text-foreground text-balance drop-shadow-[0_2px_36px_rgb(0_0_0_/0.45)] sm:text-4xl md:text-5xl md:leading-[1.06] lg:max-w-5xl"
            >
              {c.hero.headline}
            </h1>
            <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-foreground/88 sm:text-lg md:text-xl md:leading-relaxed">
              {c.hero.subtext}
            </p>
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
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

      <Section
        id={c.problem.id}
        className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.06] to-background py-20 sm:py-24 md:py-28"
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
                  <GlassCard variant="problem" className="flex h-full flex-col">
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
        id={c.governance.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.governance.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.governance.id}-heading`}
            eyebrow={c.governance.eyebrow}
            title={c.governance.headline}
          />
          <EnterpriseGovernanceBands />
          <div className="mt-14 max-w-3xl">
            <GlassCard className="border-amber-400/14">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/80">
                {c.governance.valueProposition.headline}
              </p>
              <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {c.governance.valueProposition.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </GlassCard>
          </div>
        </FadeIn>
      </Section>

      <Section
        id={c.useCases.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.useCases.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.useCases.id}-heading`}
            eyebrow={c.useCases.eyebrow}
            title={c.useCases.headline}
          />
          <ul className="mt-12 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {c.useCases.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.05 * (i % 3)}>
                  <GlassCard className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-amber-400/22">
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

      <Section
        id={c.capabilities.id}
        className="border-b border-border/50 bg-gradient-to-b from-muted/[0.05] to-background py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.capabilities.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.capabilities.id}-heading`}
            eyebrow={c.capabilities.eyebrow}
            title={c.capabilities.headline}
          />
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-5">
            {c.capabilities.cards.map((card, i) => (
              <li key={card.title}>
                <FadeIn delay={0.03 * (i % 5)}>
                  <GlassCard
                    variant="os"
                    className="flex h-full min-h-[10.5rem] flex-col border-white/[0.06] sm:min-h-[11rem]"
                  >
                    <div className="flex items-center border-b border-white/[0.07] pb-3">
                      <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em] text-amber-200/50">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="ml-auto h-px w-10 bg-gradient-to-r from-amber-400/40 to-transparent"
                        aria-hidden
                      />
                    </div>
                    <p className="mt-4 text-sm font-semibold uppercase tracking-[0.1em] text-amber-100/95">
                      {card.title}
                    </p>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
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
        id={c.expansion.id}
        className="border-b border-border/50 py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.expansion.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.expansion.id}-heading`}
            eyebrow={c.expansion.eyebrow}
            title={c.expansion.headline}
          />
          <ExpansionStoryTimeline steps={c.expansion.steps} />
        </FadeIn>
      </Section>

      <Section
        id={c.whyItMatters.id}
        className="border-b border-border/50 bg-muted/[0.04] py-20 sm:py-24 md:py-28"
        aria-labelledby={`${c.whyItMatters.id}-heading`}
      >
        <FadeIn>
          <SectionHeading
            id={`${c.whyItMatters.id}-heading`}
            eyebrow={c.whyItMatters.eyebrow}
            title={c.whyItMatters.headline}
          />
          <GlassCard className="mt-10 max-w-3xl border-amber-400/12">
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {c.whyItMatters.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/85">
                    {c.finalCta.eyebrow}
                  </p>
                  <div
                    className="mt-3 h-px w-14 bg-gradient-to-r from-amber-300/70 via-amber-400/25 to-transparent"
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

"use client";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";
import { Link2 } from "lucide-react";

const c = HOME_PAGE_CONTENT.worksWithExistingSoftware;

function IntegrationBridgeVisual() {
  return (
    <div
      className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.12),transparent_50%),linear-gradient(180deg,rgb(255_255_255_/0.045),transparent)] p-5 shadow-[0_24px_80px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:mt-14 sm:rounded-[2rem] sm:p-8 md:p-10"
      aria-hidden
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-[42%] w-px bg-gradient-to-b from-amber-400/30 via-amber-400/12 to-transparent"
        style={{ transform: "translateX(-50%)" }}
      />
      <div className="pointer-events-none absolute left-[12%] right-[12%] top-[52%] h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent sm:left-[8%] sm:right-[8%]" />

      <div className="relative flex flex-col items-center">
        <div
          className="relative rounded-2xl border border-amber-400/25 bg-[rgb(6_10_18_/0.92)] px-6 py-4 shadow-[0_0_40px_rgb(212_175_55_/0.12),inset_0_1px_0_rgb(255_255_255_/0.06)] sm:px-8 sm:py-5"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10">
              <Link2 className="h-4 w-4 text-amber-200/90" strokeWidth={2} />
            </span>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-100/95 sm:text-base sm:tracking-[0.12em]">
              {c.intelligenceLayerLabel}
            </p>
          </div>
          <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Intelligence substrate above your current stack
          </p>
        </div>

        <div className="mt-6 flex h-8 w-px flex-col bg-gradient-to-b from-amber-400/40 to-amber-400/10 sm:mt-8 sm:h-10" />

        <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70 sm:mt-5">
          {c.integrationCaption}
        </p>

        <ul className="mt-5 flex flex-wrap justify-center gap-2 sm:mt-6 sm:gap-2.5">
          {c.integrationSystems.map((system) => (
            <li
              key={system}
              className="rounded-full border border-white/[0.08] bg-[rgb(8_12_20_/0.8)] px-3.5 py-1.5 text-[11px] font-medium text-foreground/90 shadow-[inset_0_1px_0_rgb(255_255_255_/0.04)] transition-[border-color,background-color] duration-200 hover:border-amber-400/25 hover:bg-amber-950/25 sm:px-4 sm:py-2 sm:text-xs"
            >
              {system}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function FiMarketingIntegrationSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-gradient-to-b from-background via-muted/[0.04] to-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${c.id}-heading`}
          eyebrow={c.storyEyebrow}
          title={c.headline}
          description={c.body}
        />

        <ul className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
          {c.principles.map((principle) => (
            <li
              key={principle}
              className="flex items-center gap-2.5 text-sm font-medium text-amber-100/90 sm:text-base"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70 shadow-[0_0_8px_rgb(212_175_55_/0.45)]"
                aria-hidden
              />
              {principle}
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-3xl text-base leading-relaxed text-muted-foreground sm:mt-10 sm:text-lg md:leading-relaxed">
          {c.supportingCopy}
        </p>

        <IntegrationBridgeVisual />

        <ul className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2">
          {c.cards.map((card, index) => (
            <li key={card.title}>
              <GlassCard variant="os" className="group h-full">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em] text-amber-200/45">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-amber-50">
                      {card.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.copy}</p>
                  </div>
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>
      </FadeIn>
    </Section>
  );
}

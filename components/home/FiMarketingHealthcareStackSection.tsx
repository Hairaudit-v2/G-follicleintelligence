"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";
import { MARKETING_CTA_SECONDARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const c = HOME_PAGE_CONTENT.healthcareInfrastructureStack;

function LayerBand({
  layer,
  bandIdx,
  totalBands,
}: {
  layer: (typeof c.layers)[number];
  bandIdx: number;
  totalBands: number;
}) {
  return (
    <div>
      <div className="relative flex flex-col items-center">
        <span className="rounded-full border border-amber-400/20 bg-[rgb(6_10_18_/0.85)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/90 shadow-[0_0_24px_rgb(212_175_55_/0.08)] sm:tracking-[0.22em]">
          {layer.title}
        </span>
        <div
          className={cn(
            "mt-5 grid w-full gap-2.5 sm:gap-3",
            layer.modules.length <= 2 && "mx-auto max-w-lg sm:grid-cols-2",
            layer.modules.length === 3 && "sm:grid-cols-3",
            layer.modules.length >= 4 && "sm:grid-cols-2 lg:grid-cols-4"
          )}
        >
          {layer.modules.map((name) => (
            <div
              key={name}
              className="rounded-xl border border-white/[0.08] bg-[rgb(8_12_20_/0.75)] px-4 py-3 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/0.04)] transition-[border-color,background-color] duration-200 hover:border-amber-400/25 hover:bg-amber-950/20"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/95 sm:text-sm sm:tracking-[0.12em]">
                {name}
              </p>
            </div>
          ))}
        </div>
      </div>
      {bandIdx < totalBands - 1 ? (
        <div
          className="mx-auto mt-8 flex h-10 w-px flex-col items-center justify-center bg-gradient-to-b from-amber-400/35 via-amber-400/12 to-transparent sm:mt-10"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export function FiMarketingHealthcareStackSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-muted/[0.05] py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${c.id}-heading`}
          eyebrow={c.storyEyebrow}
          title={c.headline}
          description={c.subtext}
        />

        <div className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.12),transparent_50%),linear-gradient(180deg,rgb(255_255_255_/0.045),transparent)] p-5 shadow-[0_24px_80px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:mt-14 sm:rounded-[2rem] sm:p-8 md:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-amber-400/25 via-amber-400/10 to-transparent"
            style={{ transform: "translateX(-50%)" }}
          />
          <p className="relative text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
            {c.caption}
          </p>
          <div className="relative mt-10 space-y-2">
            {c.layers.map((layer, bandIdx) => (
              <LayerBand
                key={layer.title}
                layer={layer}
                bandIdx={bandIdx}
                totalBands={c.layers.length}
              />
            ))}
          </div>
        </div>

        <GlassCard className="mt-8 border-cyan-400/12 bg-[linear-gradient(135deg,rgb(34_211_238_/0.05),transparent_55%)] !p-5 sm:!p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
            Enterprise deployment model
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Each layer is tenant-isolated, role-governed, and designed for multi-clinic operators
            who need infrastructure that scales without fragmenting clinical truth — the same
            architecture pattern used by serious enterprise platforms.
          </p>
        </GlassCard>

        <div className="relative mt-8 flex justify-center sm:mt-10">
          <Button
            asChild
            variant="outline"
            size="lg"
            className={cn(MARKETING_CTA_SECONDARY_CLASS, "min-w-[12rem]")}
          >
            <Link href={c.secondaryCta.href}>
              {c.secondaryCta.label}
              <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            </Link>
          </Button>
        </div>
      </FadeIn>
    </Section>
  );
}

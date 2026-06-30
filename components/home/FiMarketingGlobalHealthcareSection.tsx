"use client";

import Link from "next/link";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import {
  PlatformProgressAnimatedBar,
  PlatformProgressStatusBadge,
} from "@/components/platform/PlatformProgressPrimitives";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";
import { MARKETING_CTA_PRIMARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { PLATFORM_PROGRESS_MODULES } from "@/lib/marketing/platformProgressPageContent";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const c = HOME_PAGE_CONTENT.globalHealthcareInfrastructure;

function ModuleStatusCard({
  index,
  mod,
}: {
  index: number;
  mod: (typeof PLATFORM_PROGRESS_MODULES)[number];
}) {
  return (
    <FadeIn delay={0.03 * (index % 6)}>
      <GlassCard
        variant="os"
        className="group flex h-full flex-col border-white/[0.07] transition-[border-color,transform,box-shadow] duration-300 hover:border-amber-400/22"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-3">
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
            delay={0.06 + index * 0.03}
          />
        </div>

        <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
          {mod.description}
        </p>
      </GlassCard>
    </FadeIn>
  );
}

export function FiMarketingGlobalHealthcareSection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-gradient-to-b from-muted/[0.06] via-background to-muted/[0.04] py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${c.id}-heading`}
          eyebrow={c.storyEyebrow}
          title={c.headline}
          description={c.subtext}
        />

        <div className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.1),transparent_50%),linear-gradient(180deg,rgb(255_255_255_/0.04),transparent)] p-5 shadow-[0_24px_80px_rgb(0_0_0_/0.35),inset_0_1px_0_rgb(255_255_255_/0.05)] sm:rounded-[2rem] sm:p-8">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
            {c.gridCaption}
          </p>
          <ul className="mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PLATFORM_PROGRESS_MODULES.map((mod, index) => (
              <li key={mod.id}>
                <ModuleStatusCard index={index} mod={mod} />
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Live delivery status across every FI OS module — updated as infrastructure milestones
            ship.
          </p>
          <Button
            asChild
            size="lg"
            className={cn(MARKETING_CTA_PRIMARY_CLASS, "w-full sm:w-auto sm:shrink-0")}
          >
            <Link href={c.cta.href}>
              {c.cta.label}
              <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            </Link>
          </Button>
        </div>
      </FadeIn>
    </Section>
  );
}

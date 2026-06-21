"use client";

import { GlassCard, SectionHeading } from "@/components/marketing/FiMarketingPrimitives";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { HOME_PAGE_CONTENT } from "@/lib/marketing/homePageContent";
import { Shield, Server } from "lucide-react";

const c = HOME_PAGE_CONTENT.engineeringCredibility;

export function FiMarketingEngineeringCredibilitySection() {
  return (
    <Section
      id={c.id}
      className="border-b border-border/50 bg-gradient-to-b from-muted/[0.05] to-background py-20 sm:py-24 md:py-28"
      aria-labelledby={`${c.id}-heading`}
    >
      <FadeIn>
        <SectionHeading
          id={`${c.id}-heading`}
          eyebrow={c.storyEyebrow}
          title={c.headline}
          description={c.subtext}
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.metrics.map((metric) => (
            <GlassCard key={metric.label} className="border-white/[0.07] !p-5 sm:!p-6">
              <div className="flex items-start gap-3">
                <Server className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/70" aria-hidden />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    {metric.value}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <GlassCard className="mt-8 border-emerald-400/12 bg-[linear-gradient(135deg,rgb(52_211_153_/0.06),transparent_50%)] !p-5 sm:!p-6 md:!p-8">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300/80" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/75">Security model</p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {c.securityModel.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-foreground/90"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </GlassCard>
      </FadeIn>
    </Section>
  );
}

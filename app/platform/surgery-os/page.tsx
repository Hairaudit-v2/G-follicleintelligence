import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  HeartPulse,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "SurgeryOS: Surgical Workflow Engine for Hair Restoration Clinics | Follicle Intelligence",
  description:
    "SurgeryOS is the surgical workflow engine for modern hair restoration clinics—plan, track, document, and improve every procedure from case preparation through long-term outcome, connected to the Patient Twin and structured for measurable quality.",
};

function SectionIntro({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">{eyebrow}</p>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

const CAPABILITY_CARDS = [
  {
    icon: ClipboardList,
    title: "Case Planning",
    desc: "Planned zones, graft ranges, surgical notes, readiness status.",
  },
  {
    icon: Users,
    title: "Procedure Day",
    desc: "Surgeon, team members, timings, extraction, implantation, medications.",
  },
  {
    icon: BarChart3,
    title: "Graft Intelligence",
    desc: "Graft counts, hair counts, ratios, punch size, transection tracking.",
  },
  {
    icon: HeartPulse,
    title: "Post-Op Workflow",
    desc: "Instructions, recovery notes, complications, aftercare, satisfaction.",
  },
  {
    icon: CalendarRange,
    title: "Follow-Up Engine",
    desc: "Day 1, day 7, monthly milestones, image tracking, outcome checks.",
  },
  {
    icon: ClipboardCheck,
    title: "Outcome Readiness",
    desc: "Case completeness, missing data, audit preparation, long-term review.",
  },
] as const;

export default function SurgeryOsPage() {
  return (
    <>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_0%,hsl(var(--primary)/0.2),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_96%_12%,rgb(110_150_200_/0.11),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/70" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <FadeIn>
            <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.15rem]">
              SurgeryOS
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-foreground/92 md:text-xl md:leading-relaxed">
              The surgical workflow engine for modern hair restoration clinics.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
              Plan, track, document, and improve every procedure from case preparation to long-term outcome.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-xl px-6 shadow-[0_10px_36px_hsl(var(--primary)/0.2)]"
              >
                <Link href="/contact?intent=demo">Book Demo</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 rounded-xl border-white/10 bg-background/25 px-6 backdrop-blur-sm"
              >
                <a href="/#ecosystem" className="inline-flex items-center gap-2">
                  Explore Follicle Intelligence
                  <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
                </a>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Complexity"
            title="Hair transplant surgery is too complex for generic clinic software."
            description="Hair restoration clinics need to manage far more than appointments and notes. Every procedure involves planning zones, graft targets, donor management, team roles, extraction variables, implantation methods, medications, post-op care, follow-ups, imaging, and outcome tracking."
          />
        </FadeIn>
      </Section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro eyebrow="Workflow" title="Core capabilities" />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_CARDS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <Card className="h-full border-border/70 bg-card/60">
                <CardHeader>
                  <item.icon className="h-6 w-6 text-primary/85" aria-hidden />
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Continuity"
            title="Connected to the Patient Twin™"
            description="Every SurgeryOS case becomes part of the patient’s lifelong clinical intelligence record, connected to consultations, imaging, pathology, medications, treatments, follow-ups, and outcome data."
          />
        </FadeIn>
      </Section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Quality"
            title="Built for measurable outcomes."
            description="SurgeryOS is designed to feed AuditOS with structured surgical data, imaging evidence, follow-up milestones, and outcome markers so every procedure can be measured and improved."
          />
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Turn every procedure into structured surgical intelligence.
            </h2>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild className="rounded-xl">
                <Link href="/contact?intent=demo">Book Demo</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/platform" className="inline-flex items-center gap-2">
                  View Platform
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

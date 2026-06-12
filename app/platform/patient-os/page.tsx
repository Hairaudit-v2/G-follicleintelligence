import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Images,
  LineChart,
  Pill,
  UserCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "PatientOS: Lifelong Patient Intelligence & Clinical Journey Engine | Follicle Intelligence",
  description:
    "PatientOS is the intelligence engine powering the complete patient journey—connecting consultations, imaging, pathology, medications, surgery, treatments, follow-ups, and long-term outcomes in one lifelong Patient Twin™ record for every patient.",
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
    icon: UserCircle2,
    title: "Patient Twin™",
    desc: "One lifelong connected patient intelligence record.",
  },
  {
    icon: CalendarClock,
    title: "Clinical Timeline",
    desc: "Every consultation, treatment, surgery and follow-up connected chronologically.",
  },
  {
    icon: Pill,
    title: "Treatment Intelligence",
    desc: "PRP, exosomes, medications, treatment progression and protocols.",
  },
  {
    icon: ClipboardList,
    title: "Medical History",
    desc: "Pathology, blood markers, diagnosis history, contraindications.",
  },
  {
    icon: Images,
    title: "Imaging Archive",
    desc: "Every photo session, scalp map, annotation and progression record.",
  },
  {
    icon: LineChart,
    title: "Outcome Tracking",
    desc: "Longitudinal treatment response and patient satisfaction.",
  },
] as const;

export default function PatientOsPage() {
  return (
    <>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_0%,hsl(var(--primary)/0.2),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_96%_12%,rgb(110_150_200_/0.11),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/70" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <FadeIn>
            <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.15rem]">
              PatientOS
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-foreground/92 md:text-xl md:leading-relaxed">
              The intelligence engine powering the complete patient journey.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
              Every patient becomes a lifelong clinical intelligence record — connecting consultations, imaging,
              pathology, medications, surgery, treatments, follow-ups, and long-term outcomes.
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
                <Link href="/platform" className="inline-flex items-center gap-2">
                  Explore Platform
                  <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
                </Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Continuity"
            title="Patients are more than appointments and notes."
            description="Hair restoration clinics need to track patient history longitudinally across diagnosis, treatments, imaging progression, medications, surgery, follow-ups, and outcomes. Generic software cannot connect these systems together."
          />
        </FadeIn>
      </Section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro eyebrow="Capabilities" title="Core capabilities" />
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
            eyebrow="Ecosystem"
            title="Connected to every clinical system."
            description="PatientOS becomes the central intelligence record connecting ConsultationOS, ImagingOS, SurgeryOS, AuditOS and AnalyticsOS."
          />
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Build a lifelong intelligence record for every patient.
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

import Link from "next/link";

import { Section } from "@/components/layout/section";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  LayoutGrid,
  Users,
  Workflow,
} from "lucide-react";

export const metadata = buildPageMetadata({
  title: "ClinicOS: Operational System for Modern Hair Restoration Clinics | Follicle Intelligence",
  description:
    "ClinicOS is the operational system running the modern hair restoration clinic—scheduling, staff management, appointments, services, procedure calendars, room management, and workflow in one connected dashboard.",
  path: "/platform/clinic-os",
});

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
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

const CAPABILITY_CARDS = [
  {
    icon: CalendarClock,
    title: "Scheduling Engine",
    desc: "Capacity-aware booking, rules, and calendar coordination across the clinic.",
  },
  {
    icon: Users,
    title: "Staff Calendars",
    desc: "Roles, shifts, availability, and coverage aligned to live appointment demand.",
  },
  {
    icon: CalendarCheck,
    title: "Appointment Management",
    desc: "End-to-end appointment lifecycle from intake through check-in and completion.",
  },
  {
    icon: LayoutGrid,
    title: "Service Catalogue",
    desc: "Structured services, bundles, and pricing connected to how the clinic actually runs.",
  },
  {
    icon: CalendarRange,
    title: "Procedure Scheduling",
    desc: "Procedure calendars, blocks, and clinical day orchestration in one view.",
  },
  {
    icon: Workflow,
    title: "Operational Workflow Automation",
    desc: "Handoffs, tasks, and room flow so operations stay in sync with the clinical day.",
  },
] as const;

export default function ClinicOsPage() {
  return (
    <>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_0%,hsl(var(--primary)/0.2),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_96%_12%,rgb(110_150_200_/0.11),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/70" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <FadeIn>
            <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.15rem]">
              ClinicOS
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-foreground/92 md:text-xl md:leading-relaxed">
              Run the entire clinic from one operational dashboard.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
              Scheduling, staff management, appointments, services, procedure calendars, room
              management and operational workflow in one connected system.
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
                  View Platform
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
            eyebrow="Fragmentation"
            title="Clinic operations are fragmented."
            description="Most clinics rely on disconnected scheduling systems, staff calendars and operational tools that do not connect to the clinical workflow."
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
            eyebrow="Continuity"
            title="Operations connected directly to patient care."
            description="ClinicOS connects operational workflow directly into PatientOS, ConsultationOS and SurgeryOS."
          />
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Build a clinic that runs on connected intelligence.
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

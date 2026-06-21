import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Droplets,
  Heart,
  LineChart,
  MessagesSquare,
  Microscope,
  Pill,
  ScanLine,
} from "lucide-react";

const PAGE_TITLE =
  "Patient Twin™: Lifelong Clinical Intelligence for Every Hair Restoration Patient | Follicle Intelligence";

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description:
    "Patient Twin™ is the lifelong clinical intelligence record for every hair restoration patient—one timeline connecting consultations, imaging, pathology, medications, regenerative treatments, surgery, follow-ups, outcomes, and satisfaction across the Follicle Intelligence platform.",
  path: "/patient-twin",
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
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

const CONNECT_CARDS = [
  {
    icon: ScanLine,
    title: "Clinical imaging",
    desc: "Standardised capture, progression sets, and imaging intelligence tied to the same patient identity.",
  },
  {
    icon: MessagesSquare,
    title: "Consultations",
    desc: "Clinical reasoning, plans, quotes, and consent context preserved as structured intelligence—not lost notes.",
  },
  {
    icon: Microscope,
    title: "Pathology and blood markers",
    desc: "Laboratory and biological context that informs diagnosis, treatment selection, and longitudinal safety.",
  },
  {
    icon: Pill,
    title: "Medications",
    desc: "Protocols, adherence signals, contraindications, and changes over time in one governed record.",
  },
  {
    icon: Droplets,
    title: "PRP and exosomes",
    desc: "Regenerative treatment series, sessions, and response markers connected to the broader journey.",
  },
  {
    icon: Activity,
    title: "Surgery history",
    desc: "Procedure intelligence, milestones, and surgical episode context linked to imaging and outcomes.",
  },
  {
    icon: CalendarClock,
    title: "Follow-ups",
    desc: "Recovery checkpoints, clinical reviews, and scheduled touchpoints on a single chronological spine.",
  },
  {
    icon: LineChart,
    title: "Outcome measurements",
    desc: "Objective progression markers and comparability signals that compound as the record deepens.",
  },
  {
    icon: Heart,
    title: "Patient satisfaction",
    desc: "Experience and confidence signals alongside clinical evidence—because outcomes are human, too.",
  },
] as const;

const TIMELINE_STEPS = [
  "Baseline",
  "Diagnosis",
  "Treatment",
  "Surgery",
  "Recovery",
  "Follow-up",
  "Outcome",
  "Retention",
] as const;

const PLATFORM_LINKS = [
  { label: "PatientOS", href: "/platform/patient-os" },
  { label: "ConsultationOS", href: "/platform" },
  { label: "ImagingOS", href: "/platform/imaging-os" },
  { label: "SurgeryOS", href: "/platform/surgery-os" },
  { label: "AuditOS", href: "/platform" },
  { label: "AnalyticsOS", href: "/platform/analytics-os" },
] as const;

export default function PatientTwinPage() {
  return (
    <>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_0%,hsl(var(--primary)/0.2),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_96%_12%,rgb(110_150_200_/0.11),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/70" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/90">
              Lifelong clinical intelligence
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.15rem]">
              Patient Twin™
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-foreground/92 md:text-xl md:leading-relaxed">
              One patient. One timeline. Connected forever.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
              The Patient Twin™ connects every consultation, image, treatment, blood marker, medication, surgery,
              follow-up and outcome into one living clinical intelligence record.
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
                <Link href="/platform/patient-os" className="inline-flex items-center gap-2">
                  Explore PatientOS
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
            eyebrow="Why it matters"
            title="Hair restoration is longitudinal."
            description="Patients do not move through hair restoration in a single appointment. Their journey unfolds over months and years across diagnosis, medication, regenerative treatments, surgery, follow-up imaging and outcome review."
          />
        </FadeIn>
      </Section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro eyebrow="Continuity" title="What It Connects" />
        </FadeIn>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECT_CARDS.map((item, i) => (
            <FadeIn key={item.title} delay={0.05 * i}>
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
          <SectionIntro eyebrow="Intelligence timeline" title="A lifelong view of progression." />
        </FadeIn>
        <FadeIn delay={0.08}>
          <div className="fi-panel mt-10 overflow-x-auto rounded-2xl p-6 md:p-8">
            <div className="flex min-w-max flex-col gap-4 md:min-w-0 md:flex-row md:flex-wrap md:items-center md:gap-2 md:gap-y-4">
              {TIMELINE_STEPS.map((label, index) => (
                <div key={label} className="flex items-center gap-2 md:contents">
                  <span className="inline-flex items-center rounded-full border border-border/70 bg-background/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/90 md:px-4 md:text-[11px] md:tracking-[0.18em]">
                    {label}
                  </span>
                  {index < TIMELINE_STEPS.length - 1 ? (
                    <ArrowRight
                      className="hidden h-4 w-4 shrink-0 text-primary/50 md:block"
                      aria-hidden
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
              From first capture through retention, every stage stays attached to the same patient intelligence
              substrate—so decisions compound instead of resetting at each visit.
            </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Platform"
            title="Powered by the Follicle Intelligence platform."
            description="Patient Twin™ connects PatientOS, ConsultationOS, ImagingOS, SurgeryOS, AuditOS and AnalyticsOS—so clinical, operational, and governance-grade intelligence stays coherent as the patient record deepens."
          />
        </FadeIn>
        <FadeIn delay={0.06}>
          <div className="mt-8 flex flex-wrap gap-2">
            {PLATFORM_LINKS.map((item) => (
              <Button key={item.label} asChild variant="outline" size="sm" className="rounded-full border-border/70">
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </div>
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Create a lifelong intelligence record for every patient.
            </h2>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild className="rounded-xl">
                <Link href="/contact?intent=demo">Book Demo</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/platform/patient-os" className="inline-flex items-center gap-2">
                  Explore PatientOS
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

import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Inbox,
  Kanban,
  Share2,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LeadFlow: Patient Acquisition & CRM for Hair Restoration Clinics | Follicle Intelligence",
  description:
    "LeadFlow is the patient acquisition and CRM engine for hair restoration clinics—capture website, Meta, Google Ads, and referral leads; automate follow-ups; manage pipeline; and measure conversion connected to the patient journey.",
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
    icon: Inbox,
    title: "Lead Capture",
    desc: "Website, Meta, Google Ads, referrals, and chatbot conversations in one intake layer.",
  },
  {
    icon: Kanban,
    title: "CRM Pipeline",
    desc: "Stages, owners, and accountability from first touch through booked consultation.",
  },
  {
    icon: Zap,
    title: "Task Automation",
    desc: "Triggers, assignments, and repeatable workflows so nothing slips between systems.",
  },
  {
    icon: BellRing,
    title: "Follow-Up Engine",
    desc: "Structured sequences, reminders, and cadence for high-intent hair restoration enquiries.",
  },
  {
    icon: Share2,
    title: "Referral Tracking",
    desc: "Source attribution and partner pathways with clear lineage into the patient record.",
  },
  {
    icon: BarChart3,
    title: "Conversion Intelligence",
    desc: "Funnel analytics, cohort response, and revenue-linked conversion signals.",
  },
] as const;

export default function LeadFlowPage() {
  return (
    <>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_0%,hsl(var(--primary)/0.2),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_96%_12%,rgb(110_150_200_/0.11),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/70" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <FadeIn>
            <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.15rem]">
              LeadFlow
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-foreground/92 md:text-xl md:leading-relaxed">
              Capture, nurture and convert every patient enquiry.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
              Manage website leads, Meta leads, Google Ads, referrals, chatbot conversations, pipeline management,
              follow-ups and conversion analytics.
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
            eyebrow="Gap"
            title="Most CRM systems stop too early."
            description="Hair restoration clinics need more than pipeline management. They need CRM systems connected directly to consultations, patient records and treatment progression."
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
            eyebrow="Journey"
            title="Connected directly to the patient journey."
            description="LeadFlow connects acquisition directly into ConsultationOS, PatientOS and long-term patient progression."
          />
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Convert more enquiries into lifelong patients.
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

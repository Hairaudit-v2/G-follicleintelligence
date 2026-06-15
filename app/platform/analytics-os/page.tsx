import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import {
  ArrowRight,
  CircleDollarSign,
  Gauge,
  GitBranch,
  LineChart,
  Megaphone,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AnalyticsOS: Business Intelligence for Hair Restoration Clinics | Follicle Intelligence",
  description:
    "Business intelligence for modern hair restoration clinics—AnalyticsOS helps teams understand revenue, conversion, marketing ROI, staff productivity, surgical efficiency, and long-term clinical performance with operational intelligence across Follicle Intelligence.",
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
    icon: CircleDollarSign,
    title: "Revenue Analytics",
    desc: "Treatment mix, revenue drivers, and financial visibility across services and sites.",
  },
  {
    icon: GitBranch,
    title: "Conversion Analytics",
    desc: "Funnel clarity from enquiry through consultation, booking, and treatment.",
  },
  {
    icon: Megaphone,
    title: "Marketing ROI",
    desc: "Channel and campaign contribution without losing sight of cost and acquisition quality.",
  },
  {
    icon: Users,
    title: "Staff Productivity",
    desc: "Role-level workload, utilization, and handoffs that affect throughput and patient experience.",
  },
  {
    icon: Gauge,
    title: "Surgical Efficiency",
    desc: "Scheduling, capacity, and day-of patterns that connect the operating calendar to outcomes.",
  },
  {
    icon: LineChart,
    title: "Outcome Intelligence",
    desc: "Retention, follow-up adherence, and longitudinal clinical signal alongside commercial metrics.",
  },
] as const;

export default function AnalyticsOsPage() {
  return (
    <>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_0%,hsl(var(--primary)/0.2),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_96%_12%,rgb(110_150_200_/0.11),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/70" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <FadeIn>
            <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.15rem]">
              AnalyticsOS
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-foreground/92 md:text-xl md:leading-relaxed">
              Understand every number driving your clinic.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
              Track revenue, conversion, staff productivity, marketing ROI, patient retention, surgical efficiency and
              long-term clinical performance.
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
            eyebrow="Visibility"
            title="Clinic owners need operational intelligence."
            description="Without connected business intelligence, clinics struggle to understand what is driving growth, profitability and long-term patient outcomes."
          />
        </FadeIn>
      </Section>

      <Section className="border-b border-border/50">
        <FadeIn>
          <SectionIntro eyebrow="Analytics" title="Core capabilities" />
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
            eyebrow="Integration"
            title="Connected to the entire clinic."
            description="AnalyticsOS collects structured data from every operating system inside Follicle Intelligence to provide complete operational intelligence."
          />
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Turn clinic data into strategic decisions.
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

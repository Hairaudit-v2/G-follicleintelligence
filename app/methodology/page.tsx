import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Braces, CheckCircle2, FileSearch2, GaugeCircle, Sigma, Target } from "lucide-react";

const METHOD_STEPS = [
  {
    icon: FileSearch2,
    title: "Evidence Capture",
    desc: "Case artefacts, procedural details, and outcomes are ingested into a normalized audit-ready structure.",
  },
  {
    icon: Braces,
    title: "Data Structuring",
    desc: "Signals are standardized into machine-readable dimensions with quality checks and confidence labels.",
  },
  {
    icon: Sigma,
    title: "Intelligence Computation",
    desc: "Scoring, benchmark mapping, and variance analysis are computed across configurable cohorts.",
  },
  {
    icon: GaugeCircle,
    title: "Confidence and Integrity",
    desc: "Each output is paired with confidence indicators and evidence quality markers for review transparency.",
  },
  {
    icon: Target,
    title: "Actionable Insight Layer",
    desc: "Blind spots, training opportunities, and performance drivers are surfaced for focused improvement.",
  },
  {
    icon: CheckCircle2,
    title: "Quality Feedback Loop",
    desc: "Follow-up outcomes are re-audited to measure intervention impact and maturity over time.",
  },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Methodology"
        title="A transparent methodology for clinical audit intelligence."
        subtitle="Follicle Intelligence is designed to convert procedural evidence into structured, benchmarkable, and quality-improving intelligence."
      />
      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.22em] text-primary/85">Method Framework</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Built for repeatability, traceability, and institutional confidence.
          </h2>
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {METHOD_STEPS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <Card className="h-full border-border/70 bg-card/60">
                <CardHeader>
                  <item.icon className="h-6 w-6 text-primary/85" />
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

      <Section className="border-y border-border/40">
        <FadeIn>
          <div className="rounded-2xl border border-border/60 bg-card/60 p-8 md:p-10">
            <p className="fi-trust text-xs uppercase tracking-[0.22em]">Standards and Trust</p>
            <p className="mt-4 max-w-4xl text-muted-foreground">
              Methodology layers are aligned with standards-led audit principles and structured to
              support institutional collaboration, including IIOHR advisory alignment.
            </p>
            <div className="mt-7 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/iihr">Review IIOHR Alignment</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact?intent=institution">Discuss Institutional Participation</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

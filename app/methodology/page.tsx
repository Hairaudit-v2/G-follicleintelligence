import Link from "next/link";
import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Braces, CheckCircle2, FileSearch2, GaugeCircle, Sigma, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Methodology: Evidence, Standards & Audit Framework | Follicle Intelligence",
  description:
    "How procedural evidence becomes benchmarkable intelligence: capture, structuring, scoring, confidence, and feedback loops—aligned with IIOHR methodology and institutional review.",
};

const METHOD_STEPS = [
  {
    icon: FileSearch2,
    title: "Evidence capture",
    desc: "Case artefacts, procedural detail, and outcomes normalized into audit-ready structure—so nothing important lives only in narrative.",
  },
  {
    icon: Braces,
    title: "Structuring and comparability",
    desc: "Dimensions and signals standardized with quality checks and explicit confidence—comparability is designed, not assumed.",
  },
  {
    icon: Sigma,
    title: "Scoring and cohort mapping",
    desc: "Domain scores and variance analysis across configurable cohorts—standing becomes visible relative to peers and baselines.",
  },
  {
    icon: GaugeCircle,
    title: "Confidence and integrity",
    desc: "Outputs carry evidence density and integrity markers—reviewers know what weight to place on each conclusion.",
  },
  {
    icon: Target,
    title: "Actionable insight",
    desc: "Repeated weak domains, training priorities, and performance drivers surfaced for governance—not buried in dashboards.",
  },
  {
    icon: CheckCircle2,
    title: "Closed-loop quality",
    desc: "Follow-up and re-audit close the loop—so interventions can be measured, not merely announced.",
  },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Methodology"
        title="From evidence to defensible judgment."
        subtitle="Methodology is what turns Follicle Intelligence from software into something institutions can adopt: repeatable capture, explicit confidence, benchmark context, and review paths that align with professional standards—not opaque scoring."
      />
      <Section>
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">Method framework</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Repeatability, traceability, and institutional credibility.
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
            In a fragmented global market, methodology is the difference between marketing claims and
            reviewable quality. FI’s framework is built to support transparency and accountability: what was
            observed, how it was scored, and how it compares—so improvement and training attach to evidence.
          </p>
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
            <p className="fi-trust text-xs uppercase tracking-[0.22em]">Standards alignment</p>
            <p className="mt-4 max-w-4xl leading-relaxed text-muted-foreground">
              The methodology layer is designed to align with standards-led audit practice and institutional
              collaboration, including advisory alignment with{" "}
              <Link
                href="https://iiohr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                IIOHR
              </Link>
              . The same framework underpins{" "}
              <Link
                href="https://hairaudit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                HairAudit
              </Link>{" "}
              scoring and supports{" "}
              <Link
                href="https://hairlongevityinstitute.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Hair Longevity Institute
              </Link>{" "}
              longitudinal pathways—so surgery, biology, and professional standards reinforce one another in
              one architecture.
            </p>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              For extended discussion of evaluation in hair restoration, see our{" "}
              <Link
                href="/ai-hair-transplant-analysis"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                clinical evaluation pillar
              </Link>
              .
            </p>
            <div className="mt-7 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=institution">Review IIOHR alignment</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact?intent=institution">Institutional participation</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

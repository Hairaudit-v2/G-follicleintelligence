import type { Metadata } from "next";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { BarChart3, Cpu, GitBranch, Scale, ShieldCheck, Workflow } from "lucide-react";

export const metadata: Metadata = {
  title: "Platform: Audit, Benchmark & Governance Infrastructure | Follicle Intelligence",
  description:
    "The core platform for procedural audit scoring, cohort benchmarks, and governance—central intelligence across HairAudit, HLI, and IIOHR-connected workflows. Deploy managed, API, or white-label.",
};

const CAPABILITY_BLOCKS = [
  {
    icon: Cpu,
    title: "Central intelligence core",
    desc: "Transforms evidence from connected surfaces into consistent scores, cohort analytics, and review-ready signals—without replacing operational systems of record.",
  },
  {
    icon: BarChart3,
    title: "Benchmark and standing layer",
    desc: "Distributions, drift, and outlier logic so performance is visible relative to peers and standards—not only versus last quarter’s spreadsheet.",
  },
  {
    icon: Scale,
    title: "Audit governance",
    desc: "Structured pathways, reviewer separation, and traceability suited to institutional oversight and serious quality programs.",
  },
  {
    icon: Workflow,
    title: "Operational orchestration",
    desc: "Case lifecycle from intake through scoring, escalation, and re-assessment—so improvement loops close instead of stalling in inboxes.",
  },
  {
    icon: ShieldCheck,
    title: "Trust and evidence posture",
    desc: "Confidence, evidence density, and integrity indicators attached to outputs—so leaders know what to trust before they act or disclose.",
  },
  {
    icon: GitBranch,
    title: "Deployment patterns",
    desc: "Private, hybrid, and white-label models for multi-entity rollout—same engine, your policy envelope and brand.",
  },
];

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow="Platform"
        title="The engine for benchmarked, governable quality."
        subtitle="Follicle Intelligence is category infrastructure: the layer that turns fragmented procedural evidence into comparable scores, cohort standing, and governance actions. HairAudit is the first full production surface; HLI and IIOHR feed biology and standards signal into the same core."
      />
      <Section>
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">Capabilities</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Built for repeatability, review, and institutional adoption.
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
            Buyers get operational outcomes: clearer quality standing, faster governance decisions, and
            training priorities tied to evidence. Investors and partners should see the same architecture as
            a compounding data and workflow footprint—deeper cohorts and harder-to-replace integration over
            time.
          </p>
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_BLOCKS.map((item, i) => (
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

      <Section className="border-t border-border/40">
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">How it operates</p>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                "Evidence ingestion from clinical workflows",
                "Structuring, scoring, and confidence",
                "Benchmark comparison and cohort analytics",
                "Governance actions and training priorities",
              ].map((step, i) => (
                <div key={step} className="rounded-lg border border-border/70 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {i + 1}</p>
                  <p className="mt-3 text-sm text-foreground">{step}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Production pathways include{" "}
              <Link
                href="https://hairaudit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                HairAudit
              </Link>{" "}
              for surgical audit; integration with{" "}
              <Link
                href="https://hairlongevityinstitute.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Hair Longevity Institute
              </Link>{" "}
              for longitudinal biology; and alignment with{" "}
              <Link
                href="https://iiohr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                IIOHR
              </Link>{" "}
              for methodology, training, and standards.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=demo">Book enterprise demo</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard-demo">View intelligence layer</Link>
              </Button>
            </div>
            <EcosystemMention className="mt-8 border-t border-border/50 pt-6" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

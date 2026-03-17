import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";

export const metadata: Metadata = {
  title: "Clinical Audit & Benchmark Intelligence Platform for Clinics | Follicle Intelligence",
  description:
    "The core engine for procedural audit scoring, benchmarking, and governance. Deploy as a managed platform or API; HairAudit is the first production application built on it.",
};
import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { BarChart3, BrainCircuit, GitBranch, Scale, ShieldCheck, Workflow } from "lucide-react";

const CAPABILITY_BLOCKS = [
  {
    icon: BrainCircuit,
    title: "Intelligence Engine",
    desc: "Transforms case evidence into confidence-weighted intelligence signals across practitioner and clinic cohorts.",
  },
  {
    icon: BarChart3,
    title: "Benchmark Layer",
    desc: "Benchmark distributions, outlier identification, and trend intelligence for continuous quality improvement.",
  },
  {
    icon: Scale,
    title: "Audit Governance",
    desc: "Structured audit pathways, review controls, and decision traceability for institutional oversight.",
  },
  {
    icon: Workflow,
    title: "Operational Workflows",
    desc: "Case lifecycle orchestration from intake and scoring to quality review, actioning, and re-assessment.",
  },
  {
    icon: ShieldCheck,
    title: "Trust Indicators",
    desc: "Confidence levels, evidence density metrics, and integrity signals attached to every insight output.",
  },
  {
    icon: GitBranch,
    title: "Deployment Flexibility",
    desc: "Private, public, hybrid, and white-label deployment patterns designed for global multi-entity rollout.",
  },
];

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow="Platform"
        title="Clinical auditing and benchmark intelligence infrastructure."
        subtitle="Follicle Intelligence is the core engine. HairAudit is the first production application built on top of it."
      />
      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.22em] text-primary/85">Platform Capabilities</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Structured intelligence for quality, training, and trust.
          </h2>
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
            <p className="text-xs uppercase tracking-[0.22em] text-primary/85">How It Operates</p>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                "Case evidence ingestion",
                "Signal structuring and confidence scoring",
                "Benchmark comparison and cohort analytics",
                "Quality actions and training insight delivery",
              ].map((step, i) => (
                <div key={step} className="rounded-lg border border-border/70 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Step {i + 1}
                  </p>
                  <p className="mt-3 text-sm text-foreground">{step}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              This infrastructure powers{" "}
              <Link
                href="https://hairaudit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                HairAudit
              </Link>{" "}
              for surgical audit, integrates with{" "}
              <Link
                href="https://hairlongevityinstitute.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Hair Longevity Institute
              </Link>{" "}
              for biology and treatment pathways, and aligns with{" "}
              <Link
                href="https://iiohr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                IIOHR
              </Link>{" "}
              for training and certification.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=demo">Book Enterprise Demo</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard-demo">View Intelligence Layer</Link>
              </Button>
            </div>
            <EcosystemMention className="mt-8 pt-6 border-t border-border/50" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Microscope, ScanSearch, Target, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "HairAudit: Surgical Audit & Benchmark Surface | Follicle Intelligence",
  description:
    "HairAudit is the live application for surgical evidence, audit scoring, and benchmark visibility—powered by Follicle Intelligence and connected to HLI biology and IIOHR standards.",
};

const CAPABILITIES = [
  {
    icon: ScanSearch,
    title: "Surgical evidence, structured",
    desc: "Case-level review with domain scoring and confidence—so outcomes are comparable across operators, not only narrated.",
  },
  {
    icon: TrendingUp,
    title: "Benchmark standing",
    desc: "Visibility against configured cohorts and maturity baselines: where you lead, where you match peers, and where governance should focus.",
  },
  {
    icon: Target,
    title: "Training-aligned signals",
    desc: "Improvement guidance tied to procedural segments and recurring weak domains—aligned with standards-led development, not generic tips.",
  },
  {
    icon: Microscope,
    title: "Institution-ready outputs",
    desc: "Structured intelligence for internal quality, board-level reporting, and selective external disclosure—consistent with a serious clinical category.",
  },
];

export default function HairIntelligencePage() {
  return (
    <>
      <PageHero
        eyebrow="HairAudit"
        title="The surgical audit surface for hair restoration."
        subtitle="HairAudit is the first production application on Follicle Intelligence: the place where transplant evidence becomes scored, benchmarked, and reviewable. It is not the whole ecosystem—it is the measurement and audit front door that feeds the central layer alongside biology (HLI) and standards (IIOHR)."
      />
      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          {CAPABILITIES.map((item, i) => (
            <FadeIn key={item.title} delay={0.08 * i}>
              <Card className="h-full border-border/70 bg-card/60">
                <CardHeader>
                  <item.icon className="h-6 w-6 text-primary/85" />
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.16}>
          <div className="mt-10 rounded-xl border border-border/60 bg-card/55 p-6 md:p-8">
            <p className="fi-trust text-xs uppercase tracking-[0.24em]">Ecosystem positioning</p>
            <p className="mt-3 text-lg text-foreground font-medium">
              HairAudit = surgical evidence and audit surface. Follicle Intelligence = what learns across the system.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The same FI layer that powers HairAudit also compounds signal from{" "}
              <Link
                href="https://hairlongevityinstitute.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Hair Longevity Institute
              </Link>{" "}
              (biology and longitudinal treatment intelligence) and{" "}
              <Link
                href="https://iiohr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                IIOHR
              </Link>{" "}
              (methodology, training, standards, and governance alignment). Together they address fragmented
              quality signals: surgery, biology, and professional standards in one architecture.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              For a deeper treatment of evaluation in hair transplant care, see our{" "}
              <Link
                href="/ai-hair-transplant-analysis"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                clinical evaluation pillar
              </Link>
              .
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/dashboard-demo">View intelligence layer</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact?intent=demo">Request HairAudit demo</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

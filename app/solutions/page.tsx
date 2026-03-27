import type { Metadata } from "next";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Building2, Landmark, Network, UserCog } from "lucide-react";

export const metadata: Metadata = {
  title: "Solutions: Governance, Benchmarks & Quality Standing | Follicle Intelligence",
  description:
    "Deploy the central intelligence layer for hair restoration: benchmark visibility, evidence-based accountability, and standards-aligned review—for practices, groups, enterprises, and institutions.",
};

const SEGMENTS = [
  {
    icon: UserCog,
    title: "Surgeon-led practices",
    desc: "Defensible performance visibility: where technique is strong, where evidence is thin, and where improvement aligns with training—not guesswork.",
  },
  {
    icon: Building2,
    title: "Clinics and brands",
    desc: "Differentiate on quality that can be shown: internal assurance, cohort-relative standing, and controlled transparency where you choose to disclose.",
  },
  {
    icon: Network,
    title: "Group and network operators",
    desc: "Portfolio truth across sites: drift, convergence, and governance queues—so capital and training follow signal, not anecdotes.",
  },
  {
    icon: Landmark,
    title: "Institutions and standards partners",
    desc: "Frameworks that institutes can adopt: structured audit pathways, IIOHR-aligned methodology, and review layers that support professional credibility.",
  },
];

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="Quality infrastructure for every scale of operator."
        subtitle="Hair restoration still lacks comparable, defensible measures of technical excellence at global scale. Follicle Intelligence is the layer that makes evidence legible—so accountability, benchmarking, and improvement can attach to the work itself, not the marketing layer."
      />
      <Section>
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/90">Ecosystem context</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            One layer. Three surfaces. Compounding signal.
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
            FI learns across{" "}
            <strong className="font-medium text-foreground">HairAudit</strong> (surgical evidence and audit
            surface),{" "}
            <strong className="font-medium text-foreground">Hair Longevity Institute</strong> (biology and
            longitudinal treatment intelligence), and{" "}
            <strong className="font-medium text-foreground">IIOHR</strong> (methodology, training, standards,
            and governance alignment). Your deployment model determines how that intelligence shows up in
            your organization—without changing the underlying architecture.
          </p>
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {SEGMENTS.map((item, i) => (
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
        <FadeIn delay={0.2}>
          <div className="mt-12 rounded-xl border border-border/60 bg-card/55 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">
              Investor and buyer lens
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The same infrastructure that improves clinical standing also deepens proprietary cohorts and
              benchmark depth over time—workflow integration across audit, biology, and standards is the
              defensibility story. Solutions are how that infrastructure meets each buyer where they operate.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/contact?intent=demo">Book enterprise demo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact?intent=white-label">Discuss white-label</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/platform">Platform architecture</Link>
            </Button>
          </div>
          <EcosystemMention className="mt-8 border-t border-border/50 pt-6" />
        </FadeIn>
      </Section>
    </>
  );
}

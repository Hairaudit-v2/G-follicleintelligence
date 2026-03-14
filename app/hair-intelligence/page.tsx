import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Microscope, ScanSearch, Target, TrendingUp } from "lucide-react";

export default function HairIntelligencePage() {
  return (
    <>
      <PageHero
        eyebrow="Hair Intelligence"
        title="HairAudit: the first live intelligence application."
        subtitle="HairAudit uses Follicle Intelligence to audit outcomes, benchmark performance, and surface quality improvement opportunities in hair restoration."
      />
      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              icon: ScanSearch,
              title: "Evidence Auditing",
              desc: "Case-level evidence review with standardized analysis and confidence tracking.",
            },
            {
              icon: TrendingUp,
              title: "Benchmark Positioning",
              desc: "Performance visibility against configured cohorts and maturity benchmarks.",
            },
            {
              icon: Target,
              title: "Training Insight",
              desc: "Focused improvement guidance by procedural segment and outcome trend.",
            },
            {
              icon: Microscope,
              title: "Clinical Intelligence Depth",
              desc: "Structured outputs designed for both practitioner use and institutional reporting.",
            },
          ].map((item, i) => (
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
          <div className="mt-10 rounded-xl border border-border/60 bg-card/55 p-6">
            <p className="fi-trust text-xs uppercase tracking-[0.24em]">Core Positioning</p>
            <p className="mt-3 text-lg text-muted-foreground">
              HairAudit is the first application. Follicle Intelligence is the engine.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/dashboard-demo">View Intelligence Layer</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact?intent=demo">Request HairAudit Demo</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

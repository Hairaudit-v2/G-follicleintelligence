import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { ArrowRightLeft, HeartPulse, ScanLine, Smile, Sparkles, Syringe } from "lucide-react";

const VERTICALS = [
  {
    icon: Sparkles,
    title: "Cosmetic Surgery",
    desc: "Audit intelligence for aesthetic procedure outcomes, comparative benchmarks, and quality variance.",
  },
  {
    icon: ScanLine,
    title: "Plastic Surgery",
    desc: "Structured procedural evidence layers for case comparison and outcome standardization programs.",
  },
  {
    icon: Syringe,
    title: "Regenerative Medicine",
    desc: "Signal-led tracking for treatment outcomes, protocol consistency, and training intelligence.",
  },
  {
    icon: HeartPulse,
    title: "Dermatology",
    desc: "Longitudinal evidence modeling and benchmark views for procedural dermatology pathways.",
  },
  {
    icon: Smile,
    title: "Dental Aesthetics",
    desc: "Quality analytics for cosmetic dental interventions with benchmarking and confidence indicators.",
  },
  {
    icon: ArrowRightLeft,
    title: "Cross-Specialty Intelligence",
    desc: "Shared infrastructure enabling multi-specialty portfolios under one enterprise governance model.",
  },
];

export default function FutureVerticalsPage() {
  return (
    <>
      <PageHero
        eyebrow="Future Verticals"
        title="Hair-first today. Built for procedural medicine tomorrow."
        subtitle="HairAudit launches first in hair restoration while the Follicle Intelligence engine is architected for specialty expansion."
      />
      <Section>
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.24em] text-primary/85">Expansion Roadmap</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            One intelligence core powering multiple clinical specialties.
          </h2>
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {VERTICALS.map((vertical, i) => (
            <FadeIn key={vertical.title} delay={0.06 * i}>
              <Card className="h-full border-border/70 bg-card/60">
                <CardHeader>
                  <vertical.icon className="h-6 w-6 text-primary/85" />
                  <CardTitle className="text-lg">{vertical.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{vertical.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-y border-border/40">
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <p className="text-xs uppercase tracking-[0.24em] text-primary/85">Strategic Expansion</p>
            <p className="mt-4 max-w-4xl text-muted-foreground">
              Specialty expansion is designed as a controlled, standards-aligned rollout. Each new
              vertical inherits the same audit architecture, benchmark logic, confidence indicators,
              and governance guardrails.
            </p>
            <div className="mt-7 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=partnership">Explore Strategic Partnership</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/platform">View Platform Architecture</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

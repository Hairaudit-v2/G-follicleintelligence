import Link from "next/link";
import type { Metadata } from "next";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { ArrowRightLeft, HeartPulse, ScanLine, Smile, Sparkles, Syringe } from "lucide-react";

export const metadata: Metadata = {
  title: "Future Verticals: Beyond Hair Restoration | Follicle Intelligence",
  description:
    "Hair first with a reusable audit and benchmark architecture—disciplined expansion into adjacent procedural and aesthetic categories when methodology and evidence patterns align.",
};

const VERTICALS = [
  {
    icon: Sparkles,
    title: "Cosmetic surgery",
    desc: "Outcome and process review where procedural evidence can be structured and compared—same governance instincts as hair, different taxonomy.",
  },
  {
    icon: ScanLine,
    title: "Plastic and reconstructive",
    desc: "Multi-step workflows where case-level audit and cohort visibility support quality programs and institutional review.",
  },
  {
    icon: Syringe,
    title: "Regenerative and intervention pathways",
    desc: "Longitudinal signal and protocol consistency—adjacent to HLI-style biology intelligence with specialty-specific models.",
  },
  {
    icon: HeartPulse,
    title: "Dermatology (procedural)",
    desc: "Structured evidence and benchmark views where procedural dermatology behaves like repeatable technical work—not only chronic disease management.",
  },
  {
    icon: Smile,
    title: "Dental aesthetics",
    desc: "Quality analytics for high-stakes aesthetic intervention with comparability and confidence layers suited to professional standards.",
  },
  {
    icon: ArrowRightLeft,
    title: "Multi-specialty enterprise",
    desc: "One governance and deployment model across portfolios—so groups running multiple procedural lines do not rebuild audit infrastructure per silo.",
  },
];

export default function FutureVerticalsPage() {
  return (
    <>
      <PageHero
        eyebrow="Future verticals"
        title="Hair is the wedge—not the ceiling."
        subtitle="The Follicle Intelligence architecture is modular: audit-shaped workflows, benchmark cores, and governance patterns that transfer when evidence and standards allow. Expansion is deliberate—each vertical should earn the same methodological rigor as hair, not borrow the brand for thin adjacencies."
      />
      <Section>
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/85">Disciplined roadmap</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Reuse the engine; respect the specialty.
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
            Investors should see expansion as leverage on fixed R&amp;D: the same infrastructure compounds when
            new verticals share scoring discipline and enterprise relationships. Operators should see a
            credible path—without distracting the hair restoration mission that builds proprietary depth
            today.
          </p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/85">Strategic posture</p>
            <p className="mt-4 max-w-4xl leading-relaxed text-muted-foreground">
              Each future vertical inherits the same architectural commitments: structured evidence, benchmark
              logic, confidence posture, and governance guardrails. Rollout stays standards-aligned and
              evidence-led—so FI remains category infrastructure, not a logo stretched across unrelated
              workflows.
            </p>
            <div className="mt-7 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=partnership">Explore partnership</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/platform">Platform architecture</Link>
              </Button>
            </div>
            <EcosystemMention className="mt-8 border-t border-border/50 pt-6" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

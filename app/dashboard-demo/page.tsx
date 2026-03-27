import Link from "next/link";
import type { Metadata } from "next";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";

export const metadata: Metadata = {
  title: "Dashboard Demo: Benchmark, Governance & Quality Views | Follicle Intelligence",
  description:
    "Preview executive, clinical, and operations views: audit scores, cohort standing, governance queues, and training signal—before you deploy the central intelligence layer.",
};

export default function DashboardDemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Dashboard demo"
        title="One surface for standing, governance, and improvement."
        subtitle="Benchmarks only matter if leaders and clinicians can act on them. The Follicle Intelligence dashboard layer translates evidence into scores, cohort-relative position, review queues, and training priorities—so quality becomes operational, not buried in ad hoc reports."
      />
      <Section>
        <FadeIn>
          <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            The demo illustrates representative views: how audit output, benchmark context, and governance
            signals appear in a single command layer. Underneath, the same core connects HairAudit surgical
            evidence, HLI longitudinal biology, and IIOHR-aligned methodology—compounding intelligence across
            the ecosystem.
          </p>
        </FadeIn>
        <FadeIn delay={0.06}>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <div className="grid gap-5 md:grid-cols-3">
              {[
                ["Cohort benchmark index", "91.2 / 100", "+5.6% QoQ"],
                ["Evidence confidence", "98.4%", "Stable"],
                ["Quality opportunity signals", "37", "Prioritized"],
              ].map(([label, value, delta]) => (
                <div key={label} className="rounded-lg border border-border/70 bg-background/60 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
                  <p className="mt-1 text-sm text-primary/85">{delta}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-border/70 bg-background/60 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Representative demo grid
              </p>
              <div className="mt-4 fi-grid rounded-lg border border-border/60 p-5">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    "Practitioner and site benchmark ranking",
                    "Outcome trend and consistency views",
                    "Confidence and evidence density indicators",
                    "Training and governance opportunity clustering",
                  ].map((item) => (
                    <div key={item} className="rounded-md border border-border/60 bg-card/65 px-3 py-2 text-sm">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=demo">Book live walkthrough</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact?intent=partnership">Request strategic briefing</Link>
              </Button>
            </div>
            <EcosystemMention className="mt-8 border-t border-border/50 pt-6" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

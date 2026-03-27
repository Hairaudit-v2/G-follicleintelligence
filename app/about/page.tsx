import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";

export const metadata: Metadata = {
  title: "About Follicle Intelligence | Category Infrastructure for Hair Restoration Quality",
  description:
    "We build the central intelligence layer for transparency, accountability, and benchmark visibility in global hair restoration—powering HairAudit, connected to HLI and IIOHR, with disciplined expansion beyond hair.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Infrastructure for accountable quality—not another clinic brand."
        subtitle="Follicle Intelligence exists because hair restoration’s global quality story is still too often told without comparable evidence. We build the layer that makes technical excellence legible: audit, benchmarks, governance, and standards alignment—so institutions and markets can reward quality with something stronger than marketing."
      />
      <Section>
        <div className="max-w-3xl space-y-10">
          <FadeIn>
            <h2 className="text-xl font-semibold text-foreground">What we believe</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Transparency without structure becomes noise. Accountability without benchmarks becomes politics.
              Improvement without longitudinal and standards context becomes episodic. FI is built to connect
              surgical evidence, biological follow-up, and professional methodology—so quality can compound as
              institutional trust, not fragment across silos.
            </p>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h2 className="text-xl font-semibold text-foreground">What we build</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              The central intelligence layer: structured scoring, cohort benchmarks, governance queues, and
              reporting surfaces that enterprises and institutions can deploy, white-label, or integrate.
              We are not a clinic operator; we are the infrastructure partners use to run serious quality and
              audit programs at scale.
            </p>
          </FadeIn>
          <FadeIn delay={0.16}>
            <h2 className="text-xl font-semibold text-foreground">How the ecosystem fits</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              <Link
                href="https://hairaudit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                HairAudit
              </Link>{" "}
              is the surgical evidence and audit application.{" "}
              <Link
                href="https://hairlongevityinstitute.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Hair Longevity Institute
              </Link>{" "}
              contributes biology and longitudinal treatment intelligence.{" "}
              <Link
                href="https://iiohr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                IIOHR
              </Link>{" "}
              anchors methodology, training, standards, and governance alignment. Follicle Intelligence learns
              across all three—deepening proprietary benchmarks and review depth as participation grows.
            </p>
          </FadeIn>
          <FadeIn delay={0.24}>
            <h2 className="text-xl font-semibold text-foreground">Roadmap discipline</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Hair restoration is the first live category because the evidence and standards problem is acute
              and global. The same modular architecture is designed for disciplined expansion into adjacent
              procedural and aesthetic verticals where audit-shaped workflows apply—without diluting the core
              hair mission.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button asChild variant="outline">
                <Link href="/future-verticals">Future verticals</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact?intent=partnership">Strategic conversation</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </Section>
    </>
  );
}

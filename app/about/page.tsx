import type { Metadata } from "next";
import Link from "next/link";

import { FadeIn } from "@/components/ui/fade-in";
import { PageHero } from "@/components/layout/page-hero";

export const metadata: Metadata = {
  title: "About Us: Clinical Audit Intelligence for Hair & Procedural Medicine | Follicle Intelligence",
  description:
    "We build the intelligence layer for audit scoring, benchmarking, and quality improvement—not the clinic. Trusted by practices, groups, and enterprise operators worldwide.",
};
import { Section } from "@/components/layout/section";

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Follicle Intelligence"
        subtitle="Clinical auditing and benchmarking intelligence infrastructure for procedural medicine."
      />
      <Section>
        <div className="max-w-3xl space-y-8">
          <FadeIn>
            <h2 className="text-xl font-semibold text-foreground">Our mission</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Follicle Intelligence builds the intelligence layer for clinical auditing, benchmarking,
              and procedural quality improvement. We are not a clinic. We are the platform
              infrastructure used by clinics, groups, institutions, and enterprise operators.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="text-xl font-semibold text-foreground">What we build</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We transform surgical evidence and case data into structured intelligence. The platform
              supports auditing workflows, benchmark intelligence, quality tracking, and training
              insight generation with confidence-aware outputs and governance controls.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <h2 className="text-xl font-semibold text-foreground">How we are staged</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              <Link
                href="https://hairaudit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                HairAudit
              </Link>{" "}
              is the first application powered by Follicle Intelligence. Hair restoration is launch
              focus, with architecture designed to scale into cosmetic surgery, plastic surgery,
              regenerative medicine, dermatology, dental aesthetics, and broader procedural medicine.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              <Link
                href="https://hairlongevityinstitute.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Hair Longevity Institute
              </Link>{" "}
              (biology and treatment pathways) and{" "}
              <Link
                href="https://iiohr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                IIOHR
              </Link>{" "}
              (training and certification) complete the ecosystem.
            </p>
          </FadeIn>
        </div>
      </Section>
    </>
  );
}

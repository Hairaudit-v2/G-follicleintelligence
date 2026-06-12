import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { PlatformArchitectureMap } from "@/components/platform/PlatformArchitectureMap";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";
import { ArrowRight, CheckCircle2, GitMerge, Layers3, Shield } from "lucide-react";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "Technology: Connected Infrastructure for Hair Restoration Clinics | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "How Follicle Intelligence unifies acquisition, operations, patient intelligence, clinical workflows, imaging, surgery, outcomes, training, and analytics in one structured platform for modern hair restoration.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: "Follicle Intelligence",
    type: "website",
    images: [
      {
        url: OG_IMAGE.src,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: "Follicle Intelligence — technology and platform architecture",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.src],
  },
};

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">{eyebrow}</p>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

const GOVERNANCE_POINTS = [
  "Role-based access aligned to clinic policy and separation of duties.",
  "Audit-ready records: structured workflows with evidence trails where your program requires them.",
  "Tenant separation so group and enterprise deployments can enforce data boundaries.",
  "Responsible AI foundations: human-in-the-loop review, disclosure controls, and governance-aligned outputs—not unchecked automation in clinical pathways.",
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Technology"
        title="Technology"
        subtitle="The infrastructure layer for modern hair restoration clinics."
      />

      <Section className="border-b border-border/50 pb-12 pt-2 md:pb-14">
        <FadeIn>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Follicle Intelligence connects every operational and clinical system into one structured platform designed
            specifically for hair restoration.
          </p>
        </FadeIn>
      </Section>

      <Section className="border-b border-border/50 py-14 md:py-16">
        <FadeIn>
          <SectionIntro
            eyebrow="Architecture"
            title="One connected operating system."
            description="Each layer has a clear job in the journey—from first enquiry through long-term outcomes—so teams work from the same structured spine instead of reconciling spreadsheets and disconnected tools."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10">
          <PlatformArchitectureMap />
        </FadeIn>
      </Section>

      <Section className="border-b border-border/50 py-14 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-14">
          <FadeIn>
            <SectionIntro
              eyebrow="Intelligence core"
              title="Built around structured intelligence."
              description="Every enquiry, consultation, image, procedure, follow-up and outcome becomes structured data that can improve clinical decision-making, operational performance and long-term patient tracking."
            />
          </FadeIn>
          <FadeIn delay={0.06}>
            <div className="fi-panel rounded-[1.35rem] p-6 md:p-7">
              <Layers3 className="h-6 w-6 text-primary/85" aria-hidden />
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground md:text-base">
                The platform is designed so signals compound: operational discipline and clinical evidence reinforce
                each other in one longitudinal record, instead of fragmenting across tools that never share a common
                model of the patient or the case.
              </p>
            </div>
          </FadeIn>
        </div>
      </Section>

      <Section className="border-b border-border/50 py-14 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-14">
          <FadeIn>
            <SectionIntro
              eyebrow="Integration"
              title="Designed to integrate, then replace."
              description="Follicle Intelligence can work alongside existing CRM, booking and operational tools before becoming the clinic’s primary operating system."
            />
          </FadeIn>
          <FadeIn delay={0.06}>
            <div className="fi-panel-muted rounded-[1.35rem] p-6 md:p-7">
              <GitMerge className="h-6 w-6 text-primary/85" aria-hidden />
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground md:text-base">
                Adoption can follow your risk and change-management posture: connect critical workflows first, prove
                value with structured reporting and governance, then consolidate schedules, records, and analytics on
                the same spine when leadership and clinical teams are ready.
              </p>
              <Button asChild variant="outline" className="mt-6 rounded-xl">
                <Link href="/integration">Integration overview</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </Section>

      <Section className="border-b border-border/50 py-14 md:py-16">
        <FadeIn>
          <SectionIntro
            eyebrow="Security & governance"
            title="Built for clinical governance."
            description="Enterprise and clinical buyers should expect controls that match how hair restoration groups actually operate—not generic SaaS defaults pasted onto regulated work."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10">
          <div className="grid gap-6 lg:grid-cols-2">
            <ul className="space-y-4">
              {GOVERNANCE_POINTS.map((line) => (
                <li key={line} className="flex gap-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary/85" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col justify-between gap-6 rounded-[1.35rem] border border-border/70 bg-background/50 p-6 md:p-7">
              <div className="flex items-start gap-3">
                <Shield className="h-6 w-6 shrink-0 text-primary/85" aria-hidden />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Deeper security artefacts, data-flow detail, and procurement materials are shared through your
                  normal vendor process—this page states design intent, not a substitute for diligence.
                </p>
              </div>
              <Button asChild variant="outline" className="w-fit rounded-xl">
                <Link href="/security">Security &amp; trust</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="pb-20 pt-4 md:pb-24">
        <FadeIn>
          <div className="fi-panel rounded-[2rem] p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">Next step</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl lg:text-5xl">
                  Build your clinic on connected infrastructure.
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  See how layers map to your acquisition funnel, operating model, and clinical pathways—and how
                  governance stays explicit as you scale.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-col lg:items-stretch">
                <Button asChild size="lg" className="h-11 rounded-xl px-6 shadow-[0_10px_36px_hsl(var(--primary)/0.2)]">
                  <Link href="/contact?intent=demo">Book Demo</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 rounded-xl border-white/10 bg-background/25 px-6 backdrop-blur-sm"
                >
                  <Link href="/platform" className="inline-flex items-center justify-center gap-2">
                    Explore Platform
                    <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

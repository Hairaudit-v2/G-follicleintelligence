import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  Cloud,
  GraduationCap,
  Handshake,
  Layers,
  Link2,
  Network,
  Shield,
  Stethoscope,
  Tags,
  Users,
} from "lucide-react";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

const PAGE_TITLE = "Enterprise: Infrastructure for Large Clinic Groups & Partners | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Enterprise-grade Follicle Intelligence for multi-location groups, training institutions, surgical networks, white-label programs, and strategic partnerships—central reporting, cross-location analytics, certification networks, and private deployments.";

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
        alt: "Follicle Intelligence — enterprise infrastructure for hair restoration",
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
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

const AUDIENCE_SEGMENTS: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: Building2,
    title: "For multi-location clinic groups",
    body: "Standardize operating rhythm across brands and regions while preserving local execution. Roll out governance, imaging, and outcome workflows with a single intelligence spine so leadership sees portfolio truth, not reconciled spreadsheets.",
  },
  {
    icon: GraduationCap,
    title: "For training institutions",
    body: "Pair structured clinical workflows with measurable practice signals. Programs can align curriculum, certification pathways, and review standards to evidence that survives oversight—not slide decks that age the moment they ship.",
  },
  {
    icon: Stethoscope,
    title: "For surgical networks",
    body: "Give network operators comparable surgical evidence and benchmark context across surgeons and sites. Route exceptions, prioritize QA, and build board-ready narratives where standing, risk, and remediation stay traceable to case-level inputs.",
  },
  {
    icon: Tags,
    title: "For white-label deployments",
    body: "Run Follicle Intelligence behind your brand with disciplined disclosure separation: internal truth, cleared external language, and UX ownership where your program requires it—without rebuilding the intelligence layer from scratch.",
  },
  {
    icon: Handshake,
    title: "For strategic industry partnerships",
    body: "Embed intelligence at roadmap depth: category expansion, co-development, volume economics, and integrations that compound over time—not one-off connectors that stall when the next product cycle lands.",
  },
];

const CAPABILITY_TOPICS: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: Network,
    title: "Multi-clinic deployments",
    body: "Tenant-aware rollouts with role boundaries, separation of duties, and policy envelopes that match how groups actually govern—not a single generic admin model stretched past its limits.",
  },
  {
    icon: BarChart3,
    title: "Central reporting",
    body: "Executive and clinical leadership packs that aggregate signal with governance: what is comparable, what is internal-only, and what is cleared for external use after review.",
  },
  {
    icon: Layers,
    title: "Cross-location analytics",
    body: "Portfolio views that surface drift by region, brand, or cohort before variance becomes liability—apples-to-apples where policy allows, with explicit handling where it does not.",
  },
  {
    icon: Users,
    title: "Staff certification networks",
    body: "Connect training, remediation, and standards-aligned programs to structured evidence—so certification reflects defensible practice, not attendance alone.",
  },
  {
    icon: Shield,
    title: "Outcome benchmarking",
    body: "Cohort-relative standing with honest denominators: confidence, completeness, and transparent scoring rules so benchmarks strengthen credibility instead of eroding it.",
  },
  {
    icon: Tags,
    title: "White-label opportunities",
    body: "Branded patient and partner surfaces with a consistent intelligence backbone—scoped support, integration boundaries, and commercial alignment negotiated up front.",
  },
  {
    icon: Cloud,
    title: "Private deployments",
    body: "When procurement, jurisdiction, or risk posture requires dedicated environments, scope isolation, and operational runbooks aligned to your security review cycle.",
  },
  {
    icon: Link2,
    title: "Enterprise integrations",
    body: "CRM, scheduling, imaging, payments, and HR systems connected into one longitudinal spine—fewer swivel-chair workflows and fewer reconciliation gaps at month end.",
  },
];

const CONTACT_HREF = "/contact";

export default function EnterprisePage() {
  return (
    <>
      <PageHero
        eyebrow="Enterprise"
        title="Enterprise infrastructure for hair restoration at scale"
        subtitle="Purpose-built operating intelligence for large clinic groups, institutions, networks, white-label programs, and strategic partners who need scale without sacrificing governance."
        body="Follicle Intelligence is modular infrastructure you can deploy as a connected system: acquisition through outcomes, with audit-ready workflows and benchmark context where your program demands it."
      />

      <Section className="border-b border-border/50 py-14 md:py-16">
        <FadeIn>
          <SectionIntro
            eyebrow="Who we serve"
            title="Built for organizations that operate at scale."
            description="Whether you run a portfolio of clinics, train the next generation of specialists, coordinate a surgical network, or represent a platform partnership, the same principle applies: quality must be legible, comparable where policy allows, and governable under pressure."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {AUDIENCE_SEGMENTS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <Card className="h-full border-border/50 bg-card/50">
                <CardHeader>
                  <item.icon className="h-9 w-9 text-primary/85" aria-hidden />
                  <CardTitle className="mt-4 text-lg leading-snug">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">{item.body}</p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-b border-border/50 py-14 md:py-16">
        <FadeIn>
          <SectionIntro
            eyebrow="Capabilities"
            title="What enterprise programs discuss with us."
            description="These topics surface in almost every serious deployment conversation. Depth varies by jurisdiction, data posture, and clinical model—we scope deliberately rather than promising a one-size template."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITY_TOPICS.map((item, i) => (
            <FadeIn key={item.title} delay={0.04 * i}>
              <div className="fi-panel h-full rounded-[1.25rem] p-6">
                <item.icon className="h-6 w-6 text-primary/85" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="py-14 md:py-20">
        <FadeIn>
          <div className="relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-gradient-to-br from-card/80 via-card/40 to-background px-8 py-12 md:px-12 md:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,hsl(var(--primary)/0.12),transparent_55%)]" />
            <div className="relative mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">Next step</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Scope deployment, integrations, and governance with our team.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                Share your organization type, regions, and timeline—we route to the conversation that can answer
                procurement, clinical workflow, and partnership questions without generic noise.
              </p>
              <div className="mt-8 flex justify-center">
                <Button asChild size="lg" className="rounded-xl px-8">
                  <Link href={CONTACT_HREF}>Talk To Our Team</Link>
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

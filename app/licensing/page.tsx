import Link from "next/link";
import type { Metadata } from "next";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { ArrowRight, CheckCircle2, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Licensing: Clinic, Enterprise API & Partner Programs | Follicle Intelligence",
  description:
    "How to choose a licensing path for Follicle Intelligence: clinic programs, enterprise API and volume, and white-label partner models—aligned to the central intelligence layer and your deployment reality.",
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

/** Decision prompts — not a quiz; buyers map answers to a path with sales/engineering. */
const CHOOSE_STEPS = [
  {
    prompt: "Where does the workflow live today?",
    options: [
      "Mostly inside your own product or EHR/LIMS — you need APIs, webhooks, and predictable volume.",
      "Mostly in a clinical or operational team using FI’s surfaces — you need seats, governance, and training.",
      "You resell or embed intelligence for your customers — you need branding, packaging, and partner economics.",
    ],
  },
  {
    prompt: "Who owns integration and uptime expectations?",
    options: [
      "Your platform team owns the integration contract and SLAs — lean Enterprise API with clear rate and support tiers.",
      "Your clinical ops owns day-to-day use; IT still needs auditability — lean Clinic with documented security review.",
      "Your product org owns roadmap and customer comms — lean White-label with co-built templates and enablement.",
    ],
  },
  {
    prompt: "How deep is the intelligence layer in your story?",
    options: [
      "Back-end scoring and reporting behind your UI — API-first packaging.",
      "Visible audit and benchmark program for providers — clinic packaging with review queues and dashboards.",
      "Differentiated offering under your brand — partner program with commercial and technical alignment.",
    ],
  },
];

const TIERS = [
  {
    title: "Clinic license",
    forWho:
      "Specialist practices, trichology clinics, and single-site or small-network operators running a structured HairAudit / procedural audit program—not building a custom integration stack.",
    infrastructure:
      "You consume Follicle Intelligence as the managed central layer: ingestion, scoring, reporting, and governance surfaces without owning API middleware. Multi-tenant cloud by default; isolation and retention per agreement.",
    features: [
      "Full pipeline: evidence ingestion, scoring, reporting, and review queues",
      "Administrative dashboard for case flow and visibility",
      "Practitioner seats sized to practice scale",
      "Support and documentation appropriate to clinical operators",
    ],
    deployment: "Managed cloud (multi-tenant)",
    cta: "Request access",
    href: "/contact?intent=demo",
  },
  {
    title: "Enterprise API access",
    forWho:
      "Health systems, diagnostic platforms, labs, and product teams embedding Follicle Intelligence into existing workflows—your UX, our scoring and benchmark depth behind authenticated APIs.",
    infrastructure:
      "The same intelligence core as the managed product, exposed for your stack: REST ingestion and scoring, asynchronous jobs, webhooks, and tenant-scoped keys. Volume, regions, and dedicated options are contractual—not one-size-fits-all.",
    features: [
      "REST APIs for ingestion, scoring, and report generation",
      "Webhooks and job polling for long-running work",
      "Volume licensing and configurable rate limits",
      "Support and SLA options by agreement",
    ],
    deployment: "Cloud API or customer-influenced environments (by agreement)",
    cta: "Request access",
    href: "/contact?intent=demo",
  },
  {
    title: "White-label partner",
    forWho:
      "Software vendors, EHR/LIMS providers, and platform builders who distribute audit and benchmark capability as part of their product—your brand, shared roadmap, partner economics.",
    infrastructure:
      "Partner programs align packaging with how the central layer is embedded: branded surfaces, template and report customization, and integration support so your customers see continuity with your stack, not a bolt-on.",
    features: [
      "Branded experience: partner-controlled UI and reporting surfaces",
      "Templates and commercial packaging co-defined with your roadmap",
      "Integration support for your application stack",
      "Partner programs (enablement, commercial terms) as agreed",
    ],
    deployment: "Cloud or dedicated (by agreement)",
    cta: "Discuss partner program",
    href: "/contact?intent=white-label",
  },
];

const INFRA_ALIGNMENT = [
  {
    title: "One intelligence core",
    body: "Clinic, API, and partner paths differ in who hosts the UX and who owns integration—not in pretending to be separate products. Packaging reflects consumption model and governance.",
  },
  {
    title: "Tenant and contract boundaries",
    body: "Isolation, data residency, subprocessors, and SLAs are expressed in your agreement. This page orients buyers; it does not replace legal or security review.",
  },
];

export default function LicensingPage() {
  return (
    <>
      <PageHero
        eyebrow="Licensing"
        title="Commercial models for how you adopt the central layer."
        subtitle="Licensing maps to deployment reality: direct clinical programs, platform embedding via API, or partner distribution. The infrastructure story is consistent—managed intelligence, tenant-scoped operation, integration depth that matches your team and procurement needs."
      />

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="How to choose"
            title="How to choose the right path."
            description="Use these prompts in internal alignment and with our team—they are decision aids, not a self-serve matrix. If two paths apply, we usually start with the one that matches who owns the integration contract and customer relationship."
          />
        </FadeIn>
        <div className="mt-10 space-y-8">
          {CHOOSE_STEPS.map((block, i) => (
            <FadeIn key={block.prompt} delay={0.06 * i}>
              <div className="rounded-[1.25rem] border border-border/70 bg-card/40 px-5 py-6 md:px-7 md:py-7">
                <div className="flex items-start gap-3">
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary/85" aria-hidden />
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{block.prompt}</h3>
                    <ul className="mt-4 space-y-3">
                      {block.options.map((opt) => (
                        <li key={opt} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" aria-hidden />
                          <span>{opt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.12}>
          <p className="mt-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ArrowRight className="h-4 w-4 text-primary/70" aria-hidden />
            <span>
              Technical patterns: see{" "}
              <Link
                href="/integration"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Integration
              </Link>
              . Security and diligence: see{" "}
              <Link
                href="/security"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Security
              </Link>
              .
            </span>
          </p>
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50 pt-8 md:pt-10">
        <FadeIn>
          <SectionIntro
            eyebrow="Models"
            title="Who each model is for."
            description="Each column is a packaging and responsibility split. Features and deployment lines are representative—exact entitlements are in your order form or MSA."
          />
        </FadeIn>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {TIERS.map((tier, i) => (
            <FadeIn key={tier.title} delay={i * 0.08}>
              <Card className="flex h-full flex-col border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-xl">{tier.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-6">
                  <div>
                    <div className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-primary/80">
                      Who it&apos;s for
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{tier.forWho}</p>
                  </div>
                  <div>
                    <div className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-primary/80">
                      Infrastructure alignment
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{tier.infrastructure}</p>
                  </div>
                  <div>
                    <div className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-primary/80">
                      Included focus
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/50" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-primary/80">
                      Typical deployment
                    </div>
                    <p className="text-sm text-muted-foreground">{tier.deployment}</p>
                  </div>
                  <div className="mt-auto pt-4">
                    <Button asChild className="w-full">
                      <Link href={tier.href}>{tier.cta}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Packaging"
            title="Aligned with the infrastructure story."
            description="Licensing should read as a consumption choice on one platform—not three disconnected products."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {INFRA_ALIGNMENT.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.25rem] border border-border/70 bg-background/50 p-6">
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.1}>
          <p className="mt-10 text-sm leading-relaxed text-muted-foreground">
            Seat counts, SLAs, security exhibits, and regional terms are set in contract. For platform context, see{" "}
            <Link href="/platform" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
              Platform
            </Link>
            . Start with{" "}
            <Link href="/contact" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
              contact
            </Link>{" "}
            for a scoped conversation.
          </p>
        </FadeIn>
        <EcosystemMention className="mt-10 border-t border-border/50 pt-6" />
      </Section>
    </>
  );
}

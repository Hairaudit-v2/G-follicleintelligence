import Link from "next/link";
import type { Metadata } from "next";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";

export const metadata: Metadata = {
  title: "Licensing: Clinic, Enterprise API & Partner Programs | Follicle Intelligence",
  description:
    "Licensing models for the central intelligence layer: managed platform access, API and volume programs, and white-label partner tiers—aligned to scale and integration depth.",
};

const TIERS = [
  {
    title: "Clinic license",
    forWho: "Specialist practices, trichology clinics, and single-site operators building benchmarked quality programs",
    features: [
      "Full audit pipeline: evidence ingestion, scoring, reporting, and review queues",
      "Administrative dashboard for case management and governance visibility",
      "Practitioner seats sized to practice scale",
      "Documentation and support channels",
    ],
    deployment: "Managed cloud (multi-tenant)",
    cta: "Request access",
    href: "/contact?intent=demo",
  },
  {
    title: "Enterprise API access",
    forWho: "Health systems, platforms, and labs embedding Follicle Intelligence into existing workflows",
    features: [
      "REST APIs for ingestion, scoring, and report generation",
      "Webhooks and asynchronous job handling",
      "Volume licensing and configurable rate limits",
      "Dedicated support and SLA options by agreement",
    ],
    deployment: "Cloud API or customer-controlled environments (by agreement)",
    cta: "Request access",
    href: "/contact?intent=demo",
  },
  {
    title: "White-label partner",
    forWho: "Software vendors, EHR/LIMS providers, and platform builders embedding audit and benchmark depth",
    features: [
      "Branded experience: partner-controlled UI and reporting surfaces",
      "Custom templates and commercial packaging",
      "Integration support for your application stack",
      "Partner programs as agreed",
    ],
    deployment: "Cloud or dedicated (by agreement)",
    cta: "Request access",
    href: "/contact?intent=white-label",
  },
];

export default function LicensingPage() {
  return (
    <>
      <PageHero
        eyebrow="Licensing"
        title="Commercial models for infrastructure-scale adoption."
        subtitle="Licensing reflects how deeply Follicle Intelligence sits in your operation: managed access for clinical organizations, API programs for platforms, and white-label for partners who distribute benchmark depth as part of their product. Terms align to governance needs, volume, and deployment model."
      />
      <Section>
        <div className="grid gap-8 md:grid-cols-3">
          {TIERS.map((tier, i) => (
            <FadeIn key={tier.title} delay={i * 0.1}>
              <Card className="flex flex-col border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-xl">{tier.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-6">
                  <div>
                    <div className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-primary/80">
                      Who it&apos;s for
                    </div>
                    <p className="text-sm text-muted-foreground">{tier.forWho}</p>
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
                      Deployment
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
        <FadeIn delay={0.15}>
          <p className="mt-10 text-sm text-muted-foreground">
            Exact seat counts, SLAs, and security terms are set in contract. Start with{" "}
            <Link href="/contact" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
              contact
            </Link>{" "}
            or{" "}
            <Link href="/security" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
              security
            </Link>{" "}
            for review materials.
          </p>
        </FadeIn>
        <EcosystemMention className="mt-10 border-t border-border/50 pt-6" />
      </Section>
    </>
  );
}

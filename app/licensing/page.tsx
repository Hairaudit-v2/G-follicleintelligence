import Link from "next/link";

import { FadeIn } from "@/components/ui/fade-in";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";

export const metadata: Metadata = {
  title: "Clinic & Enterprise Licensing for Hair Audit Intelligence | Follicle Intelligence",
  description:
    "Clinic license, enterprise API access, or white-label diagnostic modules. Choose the tier that fits your scale and integration needs.",
};
import { Section } from "@/components/layout/section";

const TIERS = [
  {
    title: "Clinic License",
    forWho: "Trichology clinics, specialist practices, and small diagnostic centres",
    features: [
      "Full pipeline: blood extraction, image signals, scoring, and reporting",
      "Admin dashboard with case management and audit queue",
      "Up to 3 practitioner seats included",
      "Email support and documentation",
    ],
    deployment: "Managed cloud (multi-tenant)",
    cta: "Request Access",
    href: "/contact",
  },
  {
    title: "Enterprise API Access",
    forWho: "Health systems, telehealth platforms, and labs integrating Follicle Intelligence into existing workflows",
    features: [
      "REST APIs for extraction, scoring, and report generation",
      "Webhook notifications and async job handling",
      "Volume licensing and custom rate limits",
      "Dedicated support and SLA options",
    ],
    deployment: "Cloud API or on-premise",
    cta: "Request Access",
    href: "/contact",
  },
  {
    title: "White-Label Diagnostic Module",
    forWho: "Software vendors, EHR/LIMS providers, and platform builders who need to embed precision trichology into their products",
    features: [
      "Full white-label: no Follicle Intelligence branding in reports or UI",
      "Custom report templates and branding",
      "Direct integration into your application stack",
      "Co-marketing and partner support",
    ],
    deployment: "Cloud or on-premise (custom)",
    cta: "Request Access",
    href: "/contact",
  },
];

export default function LicensingPage() {
  return (
    <>
      <PageHero
        eyebrow="Licensing"
        title="Licensing tiers"
        subtitle="Choose the deployment model that fits your scale and integration needs."
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
                      Key features
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
        <EcosystemMention className="mt-10 pt-6 border-t border-border/50" />
      </Section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Code2, Database, Settings, Webhook } from "lucide-react";

export const metadata: Metadata = {
  title: "Integration: APIs, Events & Clinical Workflows | Follicle Intelligence",
  description:
    "Connect the central intelligence layer to EHR, LIMS, and custom stacks: APIs, webhooks, and configurable pipelines—so evidence flows in and benchmarked quality flows out.",
};

const INTEGRATIONS = [
  {
    icon: Code2,
    title: "APIs",
    desc: "Structured endpoints for ingestion, scoring, and report generation. JSON contracts, authenticated access, and rate limits suited to production workloads.",
  },
  {
    icon: Webhook,
    title: "Events and webhooks",
    desc: "Asynchronous completion signals and event-driven pipelines—so downstream systems stay in sync as cases move through audit and review.",
  },
  {
    icon: Database,
    title: "Data exchange",
    desc: "Standard-friendly outputs and schema mapping for interoperability. Batch and streaming patterns supported where deployment requires them.",
  },
  {
    icon: Settings,
    title: "Configurable pipelines",
    desc: "Module toggles, scoring weights, templates, and branding—aligned to tenant policy without forking the core engine.",
  },
];

export default function IntegrationPage() {
  return (
    <>
      <PageHero
        eyebrow="Integration"
        title="Plumbing that makes the intelligence layer stick."
        subtitle="Defensibility in this category is partly workflow depth: the more evidence routes through FI—surgical, longitudinal, standards-adjacent—the stronger benchmarks and governance become. Integration is how Follicle Intelligence becomes infrastructure inside your stack, not a side export."
      />
      <Section>
        <FadeIn>
          <p className="mb-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            HairAudit, HLI, and IIOHR-connected programs each generate signal at different edges of care. APIs and
            events let your systems feed the same central layer, preserving the ecosystem story: one
            intelligence core, multiple operational surfaces.
          </p>
        </FadeIn>
        <div className="grid gap-8 md:grid-cols-2">
          {INTEGRATIONS.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.1}>
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <item.icon className="h-10 w-10 text-primary/80" />
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.12}>
          <p className="mt-10 text-sm text-muted-foreground">
            Deployment-specific integration guides are provided during onboarding.{" "}
            <Link href="/contact?intent=demo" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
              Contact
            </Link>{" "}
            for technical scoping.
          </p>
        </FadeIn>
        <EcosystemMention className="mt-10 border-t border-border/50 pt-6" />
      </Section>
    </>
  );
}

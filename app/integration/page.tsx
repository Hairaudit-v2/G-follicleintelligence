import { FadeIn } from "@/components/ui/fade-in";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";

export const metadata: Metadata = {
  title: "EHR, LIMS & API Integration for Hair Audit Intelligence | Follicle Intelligence",
  description:
    "REST APIs, webhooks, and standard data formats. Plug audit scoring and reporting into your EHR, LIMS, or custom clinical workflows without lock-in.",
};
import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { Section } from "@/components/layout/section";
import { Code2, Webhook, Database, Settings } from "lucide-react";

const INTEGRATIONS = [
  {
    icon: Code2,
    title: "REST APIs",
    desc: "Structured endpoints for extraction, scoring, and report generation. JSON request/response. API keys and rate limits.",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    desc: "Async job completion notifications. Event-driven pipelines. Retry and DLQ support.",
  },
  {
    icon: Database,
    title: "Data formats",
    desc: "HL7 FHIR-compatible outputs. Custom schema mapping. Batch upload and export.",
  },
  {
    icon: Settings,
    title: "Configurable pipelines",
    desc: "Enable/disable modules. Custom scoring weights. Report templates and branding.",
  },
];

export default function IntegrationPage() {
  return (
    <>
      <PageHero
        eyebrow="Integration"
        title="Built for your stack"
        subtitle="REST APIs, webhooks, and flexible data formats. Integrate with existing EHR, LIMS, or custom workflows."
      />
      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          {INTEGRATIONS.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.1}>
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <item.icon className="h-10 w-10 text-primary/80" />
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{item.desc}</CardDescription>
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

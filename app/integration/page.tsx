import type { Metadata } from "next";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Code2, Database, Layers, RefreshCw, Settings, Webhook } from "lucide-react";

export const metadata: Metadata = {
  title: "Integration: APIs, Events & Enterprise Deployment Patterns | Follicle Intelligence",
  description:
    "Technical integration for Follicle Intelligence: REST APIs, webhooks, tenant isolation, and deployment patterns for health systems, platforms, and partners—aligned to procurement and security review.",
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

const SURFACE_CAPABILITIES = [
  {
    icon: Code2,
    title: "REST APIs",
    desc: "Versioned endpoints for ingestion, scoring, and report retrieval. JSON request/response contracts; authenticated access (API keys or negotiated schemes); rate limits scaled to deployment tier. Suitable for synchronous workflows and batch jobs.",
  },
  {
    icon: Webhook,
    title: "Events and webhooks",
    desc: "Completion and status callbacks so your orchestration layer stays aligned with FI case and job lifecycle—reducing polling and missed handoffs. Retry and idempotency expectations are documented per integration package.",
  },
  {
    icon: Database,
    title: "Data exchange",
    desc: "Exports and mappings for interoperability: structured outputs for downstream analytics, document generation, or archival. Batch export patterns where large backfills or migrations are required.",
  },
  {
    icon: Settings,
    title: "Tenant configuration",
    desc: "Scoring weights, cohort rules, module enablement, templates, and branding boundaries—set per tenant so enterprise policy is enforced without maintaining a fork of the engine.",
  },
];

const IMPLEMENTATION_PATTERNS = [
  {
    title: "Synchronous vs asynchronous scoring",
    body: "Simple ingest-and-score paths may complete in a single request; heavier pipelines return job identifiers and complete via webhook or polling—your integration should assume both, depending on case size and model path.",
  },
  {
    title: "Idempotency and source keys",
    body: "Producers should send stable source identifiers (case, event, upload) so replays and retries do not duplicate work. FI’s event facade is designed for idempotent processing where configured.",
  },
  {
    title: "Tenant and environment separation",
    body: "Non-production sandboxes are used for contract and UAT; production credentials and data boundaries are isolated. Exact topology (region, dedicated resources) is agreed in enterprise agreements.",
  },
  {
    title: "Upstream system of record",
    body: "FI does not replace your EHR, PACS, or HairAudit operational database—it consumes evidence and emits intelligence. Integration design should keep clinical source of truth upstream unless contractually agreed otherwise.",
  },
];

const PARTNER_MODELS = [
  {
    title: "Native HairAudit / FI-connected workflows",
    body: "Events and APIs align with HairAudit and ecosystem producers (e.g. HLI-related intake). Best when your organization already participates in the FI event model and wants minimal custom middleware.",
  },
  {
    title: "Platform or EHR-embedded",
    body: "Your application calls FI APIs from your backend; user identity and authorization are your responsibility; FI enforces tenant-scoped access. Common for telehealth, vertical SaaS, and LIMS-backed workflows.",
  },
  {
    title: "Partner OEM / white-label",
    body: "FI runs as embedded infrastructure behind your UI; commercial packaging and first-line support are typically partner-led with FI engineering for integration and escalation paths defined in agreement.",
  },
];

export default function IntegrationPage() {
  return (
    <>
      <PageHero
        eyebrow="Integration"
        title="Enterprise integration for the intelligence layer."
        subtitle="Follicle Intelligence becomes valuable when evidence and governance events flow reliably between your systems and ours. This page outlines integration surfaces, practical implementation patterns, and typical partner models—so technical and procurement audiences can scope work without guessing."
      />

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="Surfaces"
            title="What you integrate with."
            description="Four capability areas cover most enterprise needs: request/response APIs, asynchronous signals, data exchange, and tenant-level configuration. Exact endpoints, payloads, and limits are documented under NDA and in onboarding—not on this marketing page."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {SURFACE_CAPABILITIES.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.06}>
              <Card className="h-full border-border/70 bg-card/55">
                <CardHeader>
                  <item.icon className="h-9 w-9 text-primary/85" />
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Implementation"
            title="Patterns that show up in real deployments."
            description="These are not marketing differentiators—they are the questions engineering and security teams ask in week one. Addressing them early reduces rework and procurement churn."
          />
        </FadeIn>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {IMPLEMENTATION_PATTERNS.map((item, i) => (
            <FadeIn key={item.title} delay={0.05 * i}>
              <div className="rounded-[1.25rem] border border-border/70 bg-card/45 p-6">
                <div className="flex items-center gap-2 text-primary/90">
                  <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                  <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Partner and deployment models"
            title="Likely shapes of the integration—not one-size-fits-all."
            description="Your org chart and product surface determine the right model. FI stays the same substrate; boundaries and support roles change."
          />
        </FadeIn>
        <div className="mt-10 space-y-5">
          {PARTNER_MODELS.map((item, i) => (
            <FadeIn key={item.title} delay={0.05 * i}>
              <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-background/50 p-6 md:flex-row md:items-start md:gap-8">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                  <Layers className="h-5 w-5 text-primary/85" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
        <div className="mt-10 rounded-xl border border-border/60 bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Cross-boundary flows: </span>
          HairAudit, HLI, and IIOHR-connected systems each emit signal at different edges. APIs and events should
          preserve tenant and source identifiers so the same FI core can aggregate without collapsing governance
          boundaries—see{" "}
          <Link href="/platform" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
            platform
          </Link>{" "}
          for architecture context.
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Procurement"
            title="Enterprise technical review."
            description="Security questionnaires, architecture reviews, and contractual data-processing terms are handled through your procurement channel. We provide documentation appropriate to the deployment model—not generic one-pagers that overclaim."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-8 flex flex-wrap gap-4">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/security">Security posture</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/licensing">Licensing models</Link>
          </Button>
          <Button asChild className="rounded-xl">
            <Link href="/contact?intent=demo">Technical scoping call</Link>
          </Button>
        </FadeIn>
        <FadeIn delay={0.1} className="mt-8 text-sm text-muted-foreground">
          Deployment-specific integration guides and endpoint catalogs are issued after commercial alignment.{" "}
          <Link href="/contact?intent=demo" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
            Contact
          </Link>{" "}
          with your integration context (systems, regions, volume expectations).
        </FadeIn>
        <EcosystemMention className="mt-10 border-t border-border/50 pt-8" />
      </Section>
    </>
  );
}

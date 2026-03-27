import type { Metadata } from "next";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { ClipboardList, Database, FileCheck, Server, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Security, Access & Data Handling | Follicle Intelligence",
  description:
    "Security principles, access control, data handling, and enterprise review for Follicle Intelligence. Evidence and attestations provided through procurement—no inflated compliance claims on this page.",
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

const PRINCIPLES = [
  {
    title: "Least privilege by default",
    body: "Access is granted to the minimum set of functions and data required for a role. Administrative and clinical review paths can be separated so governance policy is enforceable in the product, not only on paper.",
  },
  {
    title: "Defense in depth",
    body: "Encryption, access controls, and operational monitoring stack together. No single control is described as sufficient on its own—enterprise buyers should expect layered review.",
  },
  {
    title: "Transparency in diligence",
    body: "Specific frameworks (e.g. HIPAA, SOC 2, regional equivalents) are addressed with documentation appropriate to your deployment and contract—not with generic badges that bypass your security team’s questions.",
  },
];

const ACCESS_CONTROL = [
  "Authenticated sessions for interactive use; API access via keys or negotiated schemes as defined per environment.",
  "Role-based access aligned to tenant policy—who may view cases, run scoring, approve reports, or administer users is configurable within agreed bounds.",
  "Audit logging of security-relevant access and administrative actions to support enterprise review (retention and export subject to contract).",
];

const DATA_HANDLING = [
  {
    title: "In transit",
    body: "Traffic is encrypted using TLS for client and service communication. Cipher suites and minimum versions are kept current as part of operational practice.",
  },
  {
    title: "At rest",
    body: "Stored data uses industry-standard encryption for sensitive payloads; secrets and credentials are not stored in plaintext in application configuration.",
  },
  {
    title: "Boundaries and retention",
    body: "Tenant isolation is a design requirement for multi-tenant deployment. Data retention, regional residency, and deletion timelines are set in contract and technical configuration—not implied by this page.",
  },
];

const ENTERPRISE_REVIEW = [
  {
    title: "What we typically provide in procurement",
    body: "Architecture summaries, data-flow descriptions, answers to security questionnaires where applicable, and under NDA: additional detail on controls, subprocessors, and incident response aligned to your template.",
  },
  {
    title: "What we do not claim here",
    body: "We do not list specific certification dates, report numbers, or universal HIPAA/SOC compliance on a public page—those assertions are deployment- and time-specific and belong in your vendor file after review.",
  },
];

const OPERATIONS = [
  {
    icon: Server,
    title: "Infrastructure and monitoring",
    desc: "Hosted infrastructure with monitoring and alerting appropriate to production clinical audit workloads. Dedicated or isolated environments may apply under enterprise agreements.",
  },
  {
    icon: FileCheck,
    title: "Incident response",
    desc: "Processes exist to detect, escalate, and respond to security events. Customer notification expectations are defined contractually (timelines and channels vary by tier and region).",
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Structured for enterprise review—not a marketing checklist."
        subtitle="Follicle Intelligence processes sensitive procedural and health-related data. Our posture is described in layers: principles, access, data handling, operations, and procurement—so your security and legal teams can map questions to answers without inflated compliance language on a public URL."
      />

      <Section>
        <FadeIn>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Important: </span>
            This page summarizes posture. It does not replace a completed vendor risk assessment, BAA, or
            regulatory determination for your use case. Certifications and attestations are shared under NDA during
            procurement when applicable to your deployment.
          </div>
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50 pt-8 md:pt-10">
        <FadeIn>
          <SectionIntro
            eyebrow="Principles"
            title="Security principles."
            description="These orient how we build and operate—not a substitute for your control framework."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PRINCIPLES.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.25rem] border border-border/70 bg-card/45 p-6">
                <Shield className="h-6 w-6 text-primary/85" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Access control"
            title="Who can do what."
            description="Access control is how policy becomes enforcement. FI supports tenant-scoped roles and authenticated API access—exact matrices are documented for your environment."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-8">
          <ul className="max-w-3xl space-y-3 border-l-2 border-primary/25 pl-6">
            {ACCESS_CONTROL.map((line) => (
              <li key={line} className="text-sm leading-relaxed text-muted-foreground md:text-base">
                {line}
              </li>
            ))}
          </ul>
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Data handling"
            title="Encryption, storage, and boundaries."
            description="Handling rules follow contract and deployment type. Where regional or dedicated storage is required, it is specified in agreement—not assumed from this summary."
          />
        </FadeIn>
        <div className="mt-10 space-y-5">
          {DATA_HANDLING.map((item, i) => (
            <FadeIn key={item.title} delay={0.05 * i}>
              <div className="rounded-[1.25rem] border border-border/70 bg-card/40 px-5 py-5 md:px-6 md:py-6">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary/85" aria-hidden />
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
            eyebrow="Enterprise review"
            title="Procurement and diligence."
            description="Serious buyers should expect a structured vendor review. We align with that process rather than substituting a public page for it."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {ENTERPRISE_REVIEW.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.25rem] border border-border/70 bg-background/50 p-6">
                <ClipboardList className="h-6 w-6 text-primary/85" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Operations"
            title="Infrastructure and incident response."
            description="Production operations complement preventive controls. Specific SLAs and escalation paths are contractual."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {OPERATIONS.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.08}>
              <Card className="border-border/70 bg-card/50">
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
      </Section>

      <Section className="border-t border-border/50 pb-4">
        <FadeIn>
          <div className="fi-panel rounded-[1.5rem] p-8 md:p-10">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">Contact</p>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Route security and procurement questions through your normal vendor process. For initial
                  outreach:{" "}
                  <Link
                    href="mailto:hello@follicleintelligence.ai?subject=Security%20review"
                    className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
                  >
                    hello@follicleintelligence.ai
                  </Link>
                  . Reference{" "}
                  <Link href="/integration" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
                    integration
                  </Link>{" "}
                  and{" "}
                  <Link href="/licensing" className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary">
                    licensing
                  </Link>{" "}
                  for technical and commercial context.
                </p>
              </div>
            </div>
            <EcosystemMention className="mt-8 border-t border-border/50 pt-8" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

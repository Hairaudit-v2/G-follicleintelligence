import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { AnimatedDivider } from "@/components/ui/animated-divider";
import { ArrowUpRight } from "lucide-react";

const ArchitectureDiagramDynamic = dynamic(
  () =>
    import("@/components/ui/architecture-diagram").then((m) => ({
      default: m.ArchitectureDiagram,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[320px] w-full rounded-xl border border-border/50 bg-card/40"
        aria-hidden
      />
    ),
  }
);

export const metadata: Metadata = {
  title: "Modules: Reusable Intelligence Primitives | Follicle Intelligence",
  description:
    "Composable extraction, scoring, and reporting primitives inside Follicle Intelligence—reused across HairAudit, HLI, white-label, and benchmark and governance infrastructure.",
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

const FEEDS = [
  {
    title: "HairAudit",
    body: "The live surgical audit surface runs on the same primitives: evidence normalized enough to score, explain, and benchmark across cohorts. Modules are not a separate “HairAudit product”—they are the depth HairAudit inherits from the FI stack.",
    href: "https://hairaudit.com",
    external: true,
    linkLabel: "HairAudit",
  },
  {
    title: "HLI (Hair Longevity Intelligence)",
    body: "Longitudinal biology and intake-heavy workflows still need extraction, progression logic, and governed reporting. Reuse keeps definitions aligned so surgical and longitudinal views do not drift into incompatible semantics.",
    href: "/hair-intelligence",
    external: false,
    linkLabel: "Hair intelligence",
  },
  {
    title: "White-label deployments",
    body: "Partners embed FI behind their UX; modules supply consistent engines under branded templates and tenant policy. Depth stays in the platform layer—your product owns the relationship, not a fork of the scoring stack.",
    href: "/white-label",
    external: false,
    linkLabel: "White-label",
  },
  {
    title: "Future verticals",
    body: "New categories plug into the same contract: structured inputs, scored domains, report lifecycle. Modularity is how FI scales without resetting architecture every time the market adds a surface.",
    href: "/future-verticals",
    external: false,
    linkLabel: "Future verticals",
  },
];

const WHY_MODULAR = [
  {
    title: "One benchmark vocabulary",
    body: "When extraction and scoring are shared primitives, cohorts and tiers stay comparable across sites and products—otherwise “benchmark” becomes a label without a denominator.",
  },
  {
    title: "Governance you can operationalize",
    body: "Review queues, approvals, and audit trails sit on consistent report and score objects. Modules keep those objects stable as surfaces multiply.",
  },
  {
    title: "Tenant depth without engine sprawl",
    body: "Weights, templates, and enablement vary by deployment; the engines underneath stay coherent. That is how enterprise policy and partner branding coexist with a single learning core.",
  },
];

const MODULES = [
  {
    title: "Blood Marker Intelligence Engine",
    capabilities: [
      "PDF and image lab report ingestion with multi-format support",
      "Structured biomarker extraction with units, reference ranges, and flags",
      "Confidence scoring per marker and aggregate confidence per report",
      "OCR fallback for scanned/image-based documents",
      "Normalisation to canonical marker names for downstream processing",
    ],
    explanation:
      "Parses lab outputs into structured JSON. Handles digital PDFs natively; falls back to OCR for scanned documents. Output schema includes marker name, value, unit, reference range, flag (low/normal/high), and per-marker confidence. Designed for batch processing and integration with LIMS.",
  },
  {
    title: "Image Signal Extraction Engine",
    capabilities: [
      "Scalp and hair imagery analysis with configurable resolution",
      "Extraction of visibility, redness, flaking, and lighting proxies",
      "Blur and quality assessment for input validation",
      "Donor-pattern and texture uniformity estimation",
      "Confidence-weighted outputs with summary captions",
    ],
    explanation:
      "Consumes image bytes and returns normalised signal vectors (0–1). Supports heuristic and vision-provider backends. Outputs include scalar proxies for scalp visibility, redness, flaking, lighting, and blur. Used for longitudinal tracking and as input to progression models.",
  },
  {
    title: "Progression Velocity Engine",
    capabilities: [
      "Five-domain scoring: androgen, inflammation, thyroid/metabolic, nutrients, stress",
      "Configurable weights and risk tier thresholds",
      "Explainability vectors per domain with driver attribution",
      "Integration of blood markers and image signals",
      "Overall score aggregation with tier classification (low/moderate/elevated/high)",
    ],
    explanation:
      "Combines blood marker and image signal inputs into domain-level scores. Each domain uses flag-based and range-based logic with tunable weights. Produces explainability strings for auditability. Output includes domain_scores, overall_score, risk_tier, and explainability map.",
  },
  {
    title: "Structured Reporting Engine",
    capabilities: [
      "PDF report generation with configurable templates",
      "Version control and audit trail per report",
      "Approval workflow (draft → approved → released)",
      "Signed URL generation for secure distribution",
      "Support for custom branding and layout",
    ],
    explanation:
      "Renders premium PDFs from scoring outputs and intake metadata. Reports follow a defined lifecycle with status transitions. Storage paths and versioning are tracked for compliance. Supports multi-tenant deployment with tenant-specific templates.",
  },
];

export default function ModulesPage() {
  return (
    <>
      <PageHero
        eyebrow="Platform modules"
        title="Reusable intelligence primitives—not standalone products."
        subtitle="Follicle Intelligence is benchmark, governance, and reporting infrastructure: evidence must become comparable scores and reviewable outputs at scale. These modules are the composable layer inside that architecture—extraction, progression logic, and governed reporting—so HairAudit, HLI, partners, and future verticals share depth instead of fragmenting into incompatible engines."
      />

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="Architecture"
            title="Primitives inside the FI stack."
            description="A module here is a bounded engine with a stable contract: inputs, outputs, and tunable parameters within tenant policy. They compose into pipelines; they are not marketed as separate SKUs. That distinction matters for buyers evaluating system depth versus a bundle of disconnected tools."
          />
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50 pt-8 md:pt-10">
        <FadeIn>
          <SectionIntro
            eyebrow="Consumption"
            title="How modules feed the ecosystem."
            description="The same primitives power public applications, longitudinal programs, partner deployments, and road-mapped categories—so intelligence accumulates in one place instead of siloing by brand."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {FEEDS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.25rem] border border-border/70 bg-card/45 p-6 md:p-7">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                <p className="mt-4">
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary/90"
                    >
                      {item.linkLabel}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary/90"
                    >
                      {item.linkLabel}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  )}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Design rationale"
            title="Why modular intelligence matters."
            description="Modularity here is an architectural choice in service of benchmarks and governance—not feature sprawl. It keeps the platform legible as surfaces multiply."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {WHY_MODULAR.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.25rem] border border-border/60 bg-background/50 p-6">
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Pipeline"
            title="Composition in the processing path."
            description="Deployments tune depth—full pipeline or selective components—while staying on a core that supports audit rhythm, cohort learning, and IIOHR-aligned methodology. The diagram below is the same structural story told visually; the sections that follow document each engine."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-8">
          <div className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-primary/80">
            Pipeline architecture
          </div>
          <ArchitectureDiagramDynamic />
        </FadeIn>
        <AnimatedDivider />
        <div className="space-y-0">
          {MODULES.map((module, i) => (
            <div key={module.title}>
              <FadeIn delay={i * 0.08}>
                <div className="rounded-xl border border-border/50 bg-card/50 p-8 md:p-10">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                    {module.title}
                  </h2>
                  <ul className="mt-6 space-y-3">
                    {module.capabilities.map((cap) => (
                      <li
                        key={cap}
                        className="flex items-start gap-3 text-muted-foreground before:mt-1.5 before:size-1 before:shrink-0 before:rounded-full before:bg-primary/60 before:content-['']"
                      >
                        <span className="text-sm leading-relaxed">{cap}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 border-l-2 border-primary/30 pl-4 text-sm leading-relaxed text-muted-foreground">
                    {module.explanation}
                  </p>
                </div>
              </FadeIn>
              {i < MODULES.length - 1 && <AnimatedDivider />}
            </div>
          ))}
        </div>
        <EcosystemMention className="mt-10 border-t border-border/50 pt-6" />
      </Section>
    </>
  );
}

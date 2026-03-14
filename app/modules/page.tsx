import { FadeIn } from "@/components/ui/fade-in";
import { AnimatedDivider } from "@/components/ui/animated-divider";
import { ArchitectureDiagram } from "@/components/ui/architecture-diagram";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";

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
        title="AI engine modules"
        subtitle="Four composable engines: blood marker extraction, image signal analysis, progression scoring, and structured reporting. Deploy individually or as a pipeline."
      />
      <Section>
        <FadeIn>
          <div className="mb-4 font-mono text-xs font-medium uppercase tracking-wider text-primary/80">
            Pipeline architecture
          </div>
          <ArchitectureDiagram />
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
      </Section>
    </>
  );
}

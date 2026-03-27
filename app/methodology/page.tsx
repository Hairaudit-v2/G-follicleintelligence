import Link from "next/link";
import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { Braces, CheckCircle2, FileSearch2, GaugeCircle, Sigma, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Methodology: Reviewable Audit Intelligence & IIOHR Alignment | Follicle Intelligence",
  description:
    "How FI structures evidence, weighting, confidence, benchmark context, and adjudication—so scores are reviewable, not black-box outputs. Standards alignment through IIOHR.",
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
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

function DiagramPlaceholder({ label }: { label: string }) {
  return (
    <div className="mt-8 flex min-h-[96px] flex-col items-center justify-center rounded-xl border border-dashed border-primary/20 bg-primary/5 px-4 py-5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/75">Suggested diagram</p>
      <p className="mt-2 max-w-xl text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Preserved six-stage methodology pipeline */
const METHOD_STEPS = [
  {
    icon: FileSearch2,
    title: "Evidence capture",
    desc: "Case artefacts, procedural detail, and outcomes normalized into audit-ready structure—so nothing important lives only in narrative.",
  },
  {
    icon: Braces,
    title: "Structuring and comparability",
    desc: "Dimensions and signals standardized with quality checks and explicit confidence—comparability is designed, not assumed.",
  },
  {
    icon: Sigma,
    title: "Scoring and cohort mapping",
    desc: "Domain scores and variance analysis across configurable cohorts—standing becomes visible relative to peers and baselines.",
  },
  {
    icon: GaugeCircle,
    title: "Confidence and integrity",
    desc: "Outputs carry evidence density and integrity markers—reviewers know what weight to place on each conclusion.",
  },
  {
    icon: Target,
    title: "Actionable insight",
    desc: "Repeated weak domains, training priorities, and performance drivers surfaced for governance—not buried in dashboards.",
  },
  {
    icon: CheckCircle2,
    title: "Closed-loop quality",
    desc: "Follow-up and re-audit close the loop—so interventions can be measured, not merely announced.",
  },
];

const EVIDENCE_WEIGHTING = [
  {
    title: "What “weighting” means here",
    body: "Not a hidden preference for outcomes. Weighting refers to how strongly each piece of evidence contributes to a domain score given completeness, imaging quality, documentation depth, and follow-up availability. Sparse evidence does not silently equal strong evidence—gaps are visible in the output posture, not erased in the average.",
  },
  {
    title: "Explicit handling of missing or weak inputs",
    body: "When required artefacts are absent or low quality, the system does not substitute guesswork for data. Domain-level conclusions reflect reduced support; confidence and completeness cues communicate that reduction to reviewers and downstream reporting.",
  },
];

const CONFIDENCE_INTEGRITY = [
  {
    title: "Evidence density",
    body: "Signals how much structured input supported a conclusion relative to what the methodology expects for that domain—useful for prioritizing review, not for claiming precision that the record does not support.",
  },
  {
    title: "Integrity and consistency checks",
    body: "Basic consistency rules (e.g., incompatible inputs, out-of-range values) flag items for human review where automation should not infer intent. These are guardrails, not a substitute for clinical judgment.",
  },
];

const BENCHMARK_CONTEXT = [
  {
    title: "Cohort definition",
    body: "Standing is always relative to a defined cohort or baseline: peer sets, historical internal bands, or policy targets. Rule sets are versioned where methodology changes—so a shift in “top quartile” reflects policy or membership change when applicable, not silent drift.",
  },
  {
    title: "Denominators and eligibility",
    body: "Benchmarks require clear inclusion logic. FI’s methodology treats denominator and eligibility as explicit inputs to interpretation: a score without a cohort label is an incomplete administrative object, not a public ranking.",
  },
];

const REVIEW_ADJUDICATION = [
  {
    title: "Separation of roles",
    body: "Scoring produces structured outputs; governance assigns review ownership (clinical lead, quality office, committee) per tenant policy. The methodology supports separation between who generates signal and who adjudicates exceptions—aligned with serious quality programs.",
  },
  {
    title: "States, not vibes",
    body: "Cases and reports move through defined states (e.g., draft, under review, cleared for limited disclosure). Adjudication is recorded; that record is what makes external claims defensible under scrutiny.",
  },
];

const WHY_REVIEWABLE = [
  "Inputs are structured and attributable: what was observed is distinguishable from what was inferred.",
  "Scores are decomposable into domains—reviewers can interrogate components rather than fight a single opaque number.",
  "Confidence and completeness are surfaced so “high score / low support” situations are visible before disclosure.",
  "Benchmark labels and cohort rules are explicit enough for a third party to ask: compared to whom, under what rules, as of when.",
  "Governance events (review, escalation, clearance) leave a trace suitable for institutional oversight—not merely an activity log.",
];

const CONFIDENCE_INTERPRETATION = [
  {
    label: "Higher confidence",
    text: "Generally indicates more complete, consistent evidence against methodology expectations for that domain. It does not imply clinical certainty or legal proof—it means the structured record supports the conclusion more strongly.",
  },
  {
    label: "Lower confidence",
    text: "Should trigger proportionate caution: broader review, additional documentation requests, or withholding external-facing summaries until governance clears—not automatic dismissal of the case.",
  },
  {
    label: "Not a substitute for judgment",
    text: "Confidence markers inform allocation of human attention. They do not replace professional review where policy, regulation, or ethics require it.",
  },
];

const IIOHR_ALIGNMENT = [
  "Methodology documentation and review pathways are designed to sit alongside IIOHR-aligned training and standards work—not to replace professional bodies, but to make institutional programs operable.",
  "Versioning and auditability expectations match what associations and institutes need when they adopt third-party infrastructure: explicit rules, traceable changes, and exportable review records where policy allows.",
  "Advisory alignment with IIOHR is organizational and methodological; specific certifications or endorsements are stated only where contractually and factually accurate.",
];

export default function MethodologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Methodology"
        title="Structured, reviewable intelligence—not a black-box score."
        subtitle="Enterprise buyers, standards bodies, and investors should ask the same question: can we defend how conclusions were reached? Follicle Intelligence is built so evidence, weighting, confidence, benchmark context, and adjudication are explicit—methodology is the difference between marketing claims and reviewable quality."
      />

      <Section>
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">Method framework</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Repeatability, traceability, institutional credibility.
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
            The pipeline below is stable across deployments: capture through closed-loop quality. What follows deepens each stage—how weighting, confidence, benchmarks, and review layers behave in practice.
          </p>
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {METHOD_STEPS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <Card className="h-full border-border/70 bg-card/60">
                <CardHeader>
                  <item.icon className="h-6 w-6 text-primary/85" />
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
        <DiagramPlaceholder label="End-to-end pipeline: capture → structure → score → confidence → insight → re-audit, with side branches for review and benchmark context." />
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Evidence"
            title="Evidence capture and weighting."
            description="Scores aggregate evidence; they must not pretend uniform strength where the record is uneven. Weighting logic is designed to make that unevenness legible to reviewers—not to optimize a prettier headline number."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {EVIDENCE_WEIGHTING.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.35rem] border border-border/70 bg-card/45 p-6 md:p-7">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Signal quality"
            title="Confidence and integrity markers."
            description="Outputs carry more than a scalar. Confidence and integrity dimensions exist so leaders and committees can see whether a conclusion is well-supported or thinly documented—before disclosure or training decisions harden."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {CONFIDENCE_INTEGRITY.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.35rem] border border-border/70 bg-card/45 p-6 md:p-7">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Benchmarks"
            title="Benchmark context."
            description="A number without context is not a benchmark—it is a label. Methodology requires explicit cohort membership, baselines, and versioning so standing can be interpreted and audited."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {BENCHMARK_CONTEXT.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.35rem] border border-border/70 bg-card/45 p-6 md:p-7">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        <DiagramPlaceholder label="Cohort ladder or table: score + cohort ID + rule version + effective date—ideal for trust and security reviews." />
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Governance"
            title="Review layers and adjudication."
            description="Scoring produces candidates for judgment; governance produces decisions. The methodology separates those concerns so institutions can map roles, escalation, and disclosure to policy."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {REVIEW_ADJUDICATION.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.35rem] border border-border/70 bg-card/45 p-6 md:p-7">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Defensibility"
            title="Why this is reviewable."
            description="Reviewability is the bar for institutional adoption: a third party can ask how a conclusion was produced and receive a coherent answer from structure, not from internal lore."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-8">
          <ul className="max-w-3xl space-y-4 border-l-2 border-primary/25 pl-6">
            {WHY_REVIEWABLE.map((line) => (
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
            eyebrow="Interpretation"
            title="How confidence should be interpreted."
            description="Misread confidence and you either over-trust thin evidence or under-use strong signal. The following guardrails are methodological, not promotional."
          />
        </FadeIn>
        <div className="mt-10 space-y-5">
          {CONFIDENCE_INTERPRETATION.map((row, i) => (
            <FadeIn key={row.label} delay={0.05 * i}>
              <div className="rounded-[1.25rem] border border-border/70 bg-card/40 px-5 py-5 md:px-6 md:py-6">
                <p className="text-sm font-semibold text-foreground">{row.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{row.text}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Standards"
            title="Alignment with IIOHR and institutional practice."
            description="FI does not claim to be a professional regulator. Methodology alignment means operable frameworks, review pathways, and traceability that institutes can adopt alongside IIOHR-led training and governance—not a substitute for professional judgment or statutory requirements."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-8">
          <ul className="max-w-3xl space-y-4">
            {IIOHR_ALIGNMENT.map((p) => (
              <li key={p} className="flex gap-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-10 rounded-2xl border border-border/60 bg-card/60 p-8 md:p-10">
            <p className="fi-trust text-xs uppercase tracking-[0.22em]">Ecosystem</p>
            <p className="mt-4 max-w-4xl leading-relaxed text-muted-foreground">
              The same framework underpins{" "}
              <Link
                href="https://hairaudit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                HairAudit
              </Link>{" "}
              scoring and supports{" "}
              <Link
                href="https://hairlongevityinstitute.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Hair Longevity Institute
              </Link>{" "}
              longitudinal pathways—so surgery, biology, and professional standards reinforce one another in
              one architecture.
            </p>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              For extended discussion of evaluation in hair restoration, see our{" "}
              <Link
                href="/ai-hair-transplant-analysis"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                clinical evaluation pillar
              </Link>
              .
            </p>
            <div className="mt-7 flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/contact?intent=institution">Review IIOHR alignment</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact?intent=institution">Institutional participation</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/platform">Platform architecture</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

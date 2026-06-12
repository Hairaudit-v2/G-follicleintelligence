import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";

import { IiohrSeal } from "@/components/brand/iiohr-logo";
import { GlobalHairIntelligenceSectionPlaceholder } from "@/components/ecosystem/GlobalHairIntelligenceSectionPlaceholder";
import { FiHomeEcosystemSection } from "@/components/home/FiHomeEcosystemSection";
import { FiHomeGlobalIntelligenceSection } from "@/components/home/FiHomeGlobalIntelligenceSection";
import { FiHomePatientTwinSection } from "@/components/home/FiHomePatientTwinSection";
import { Section } from "@/components/layout/section";
import { PlatformArchitectureMap } from "@/components/platform/PlatformArchitectureMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import { SITE_SEO_DESCRIPTION, SITE_SEO_TITLE } from "@/lib/structured-data";
import { cn } from "@/lib/utils";
import { PUBLIC_IMAGES } from "@/src/lib/brand/publicImages";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  Building2,
  ChartColumnIncreasing,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Gauge,
  GraduationCap,
  Landmark,
  Layers3,
  LineChart,
  Radar,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";

const OG_IMAGE = PUBLIC_IMAGES.appleTouchIcon;

export const metadata: Metadata = {
  title: SITE_SEO_TITLE,
  description: SITE_SEO_DESCRIPTION,
  openGraph: {
    title: SITE_SEO_TITLE,
    description: SITE_SEO_DESCRIPTION,
    siteName: "Follicle Intelligence",
    type: "website",
    images: [
      {
        url: OG_IMAGE.src,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: "Follicle Intelligence — The World's First Hair Restoration Operating System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_SEO_TITLE,
    description: SITE_SEO_DESCRIPTION,
    images: [OG_IMAGE.src],
  },
};

const ECOSYSTEM_HEADING = "Follicle Intelligence: the platform. Three specialist intelligence layers.";
const ECOSYSTEM_DESCRIPTION = `Follicle Intelligence™ is the master operating system—where clinic, surgical, longitudinal, and governance signal becomes one longitudinal spine.

Under that platform, three named engines deepen specific work: HairAudit™ as the Outcome Intelligence Layer (surgical evidence, scoring, and audit-grade comparability), Hair Longevity Institute™ as the Diagnostic Intelligence Layer (biology and longitudinal treatment intelligence), and IIOHR™ as the Training Intelligence Layer (methodology, standards, and credible review framing).

Evidence still originates in operational systems you already trust; FI unifies benchmarks and governance so improvement compounds network-wide—without replacing your source of record.

A reinforcing loop: richer evidence sharpens benchmarks; clearer benchmarks raise accountability; stronger accountability feeds better training and standards.`;

const GLOBAL_NETWORK_SECTION_TITLE = "How Follicle Intelligence connects the ecosystem";
const GLOBAL_NETWORK_FOOTER_CAPTION = "ONE PLATFORM · THREE INTELLIGENCE LAYERS";

const GlobalHairIntelligenceSectionDynamic = dynamic(
  () =>
    import("@/components/ecosystem/GlobalHairIntelligenceSection").then((m) => ({
      default: m.GlobalHairIntelligenceSection,
    })),
  {
    ssr: false,
    loading: () => (
      <GlobalHairIntelligenceSectionPlaceholder
        heading={ECOSYSTEM_HEADING}
        description={ECOSYSTEM_DESCRIPTION}
      />
    ),
  }
);

const FiHeroEcosystemViz = dynamic(
  () => import("@/components/home/FiHeroEcosystemViz").then((m) => ({ default: m.FiHeroEcosystemViz })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="relative mx-auto aspect-[1/1.05] min-h-[320px] w-full max-w-[min(100%,520px)] animate-pulse rounded-[1.75rem] border border-white/[0.06] bg-[rgb(10_15_24_/0.85)] sm:min-h-[380px] md:min-h-[420px]"
      />
    ),
  }
);

const MARKET_WHY_POINTS: { title: string; desc: string }[] = [
  {
    title: "Fragmented quality landscape",
    desc: "Hair restoration spans jurisdictions, techniques, and commercial models. Patients and payers rarely see comparable, defensible measures of technical quality—so excellence and underperformance can look alike at the marketing layer.",
  },
  {
    title: "Evidence scattered across silos",
    desc: "Surgical outcomes, biological treatment response, and professional standards have lived in separate workflows. Without a shared intelligence layer, institutions cannot align accountability, training, and benchmarks at industry scale.",
  },
  {
    title: "The shift underway",
    desc: "Stakeholders are asking for transparency that survives scrutiny—not slogans. Follicle Intelligence exists to make quality legible: scored where evidence allows, benchmarked where cohorts exist, and governed where standards and review matter.",
  },
];

const PROOF_CARDS = [
  {
    title: "Audit scorecard",
    value: "91.8 / 100",
    detail: "Domain-level scoring turns procedural evidence into comparable, reviewable assessments—so standing is earned on the record, not asserted in copy.",
  },
  {
    title: "Benchmark comparison",
    value: "Top 14%",
    detail: "Peer and historical baselines give clinics and groups a credible story on differentiation: where they lead, where they converge, and where governance should intervene.",
  },
  {
    title: "Governance signal",
    value: "3 flagged cases",
    detail: "Outliers surface early—before variance becomes reputational risk, before training budgets misallocate, and before weak patterns replicate across sites.",
  },
  {
    title: "Improvement trajectory",
    value: "+12.6%",
    detail: "Quarter-over-quarter lift is visible to operators and boards alike: a tangible loop from evidence to action, not a static snapshot.",
  },
  {
    title: "Infrastructure posture",
    value: "Enterprise ready",
    detail: "Private deployments, institutional review layers, and white-label surfaces—positioning FI as durable audit infrastructure, not a single-app feature.",
  },
];

const CAPABILITIES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: ClipboardList,
    title: "Structure evidence into defensible scores",
    desc: "Turn case imagery, records, and follow-up into consistent domain assessments—designed for audit, not anecdote.",
  },
  {
    icon: Radar,
    title: "Benchmark where standing matters",
    desc: "Compare doctors, clinics, and cohorts against standards and peers so quality leadership is visible internally and, where you choose, externally.",
  },
  {
    icon: Activity,
    title: "Surface risk and opportunity with clarity",
    desc: "Detect recurring weaknesses, review triggers, and operational patterns that manual review under-catches at scale.",
  },
  {
    icon: GraduationCap,
    title: "Close the loop to training and governance",
    desc: "Route audit outputs into governance queues, training priorities, and standards-aligned improvement—so insight converts to behavior change.",
  },
  {
    icon: Layers3,
    title: "Deploy as your intelligence layer",
    desc: "Clinic groups, institutes, and enterprise partners white-label the engine: same benchmarks and rules backbone, your brand and policy envelope.",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Upload",
    desc: "Ingest case data, imagery, structured records, and context from live workflows across connected surfaces.",
  },
  {
    step: "02",
    title: "Analyze",
    desc: "Structure evidence, apply scoring logic, and run models to produce review-ready outputs with confidence and provenance in mind.",
  },
  {
    step: "03",
    title: "Score",
    desc: "Generate domain assessments across technique, outcomes, process quality, and supporting documentation.",
  },
  {
    step: "04",
    title: "Benchmark",
    desc: "Place performance in context: standards, peer cohorts, and historical baselines at surgeon, site, and group level.",
  },
  {
    step: "05",
    title: "Improve",
    desc: "Prioritize training, governance, workflow, and reporting moves with explicit operational next steps.",
  },
];

const AUDIENCES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Stethoscope,
    title: "Surgeons & clinical leads",
    desc: "Defensible feedback on strengths and gaps—grounded in structured evidence rather than anecdote or internal politics alone.",
  },
  {
    icon: Building2,
    title: "Clinics & brands",
    desc: "Differentiate on benchmarked quality: credible internal assurance, controlled transparency, and leadership narratives that hold up to scrutiny.",
  },
  {
    icon: Users,
    title: "Group & network operators",
    desc: "Portfolio-wide visibility: where sites converge, diverge, and drift—so capital, training, and standards investments follow signal.",
  },
  {
    icon: Landmark,
    title: "Standards bodies & institutes",
    desc: "Frameworks, review pathways, and longitudinal signal that institutions can adopt without rebuilding core infrastructure.",
  },
  {
    icon: Cpu,
    title: "Platform & enterprise partners",
    desc: "A configurable audit and benchmarking backbone for specialty products—ship faster without sacrificing governance depth.",
  },
  {
    icon: TrendingUp,
    title: "Investors & strategic partners",
    desc: "Category infrastructure: compounding proprietary signal from multi-surface evidence, standards engagement, and benchmark depth—defensible because the workflow integration is hard to replicate ad hoc.",
  },
];

const VERTICALS = [
  {
    title: "Hair restoration",
    status: "Live focus",
    desc: "Follicle Intelligence ships as the clinic OS, with HairAudit™ (outcomes), HLI™ (diagnostics), and IIOHR™ (training) as live intelligence layers that deepen the same platform—not competing products.",
  },
  {
    title: "Facial aesthetics",
    status: "Adaptable",
    desc: "Procedure review, consistency scoring, and outcome governance for injectable and non-surgical pathways.",
  },
  {
    title: "Cosmetic surgery",
    status: "Expandable",
    desc: "Case audit frameworks for multi-step surgical workflows, outcomes review, and quality assurance.",
  },
  {
    title: "Procedural medicine",
    status: "Scalable",
    desc: "A modular architecture for specialty-specific scoring, benchmarks, and review rules.",
  },
  {
    title: "Broader clinical quality systems",
    status: "Enterprise",
    desc: "A white-label intelligence backbone for audit, governance, and institutional benchmarking programs.",
  },
];

function SectionIntro({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">{title}</h2>
      {description ? (
        <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(84,202,255,0.62),rgba(162,220,255,0.96))]"
          style={{ width }}
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="fi-grid relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_0%,hsl(var(--primary)/0.2),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_96%_12%,rgb(110_150_200_/0.11),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/70" />

        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-20 md:grid-cols-12 md:gap-16 md:py-28">
          <FadeIn className="md:col-span-6 lg:col-span-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/90">
              Enterprise hair restoration platform
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.15rem]">
              The World&apos;s First Hair Restoration Operating System
            </h1>
            <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-foreground/92 md:text-xl md:leading-relaxed">
              Manage every part of your clinic from first enquiry to long-term patient outcome.
            </p>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
              One connected platform built specifically for modern hair restoration clinics — connecting lead generation,
              patient management, consultations, clinical imaging, surgery workflows, outcome tracking, staff training,
              and business intelligence.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-xl px-6 shadow-[0_10px_36px_hsl(var(--primary)/0.2)]"
              >
                <Link href="/contact?intent=demo">Book Demo</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 rounded-xl border-white/10 bg-background/25 px-6 backdrop-blur-sm"
              >
                <Link href="/#ecosystem" className="inline-flex items-center gap-2">
                  Explore Platform
                  <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
                </Link>
              </Button>
            </div>

            <div className="mt-10 border-t border-white/[0.07] pt-8">
              <p className="sr-only">Intelligence domains across the network</p>
              <ul className="flex flex-wrap items-center gap-x-1 gap-y-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:text-[11px]">
                {[
                  "Clinical Intelligence",
                  "Surgical Intelligence",
                  "Outcome Intelligence",
                  "Training Intelligence",
                  "Business Intelligence",
                ].map((item, idx) => (
                  <li key={item} className="inline-flex items-center gap-x-3">
                    {idx > 0 ? (
                      <span className="select-none text-border/80" aria-hidden>
                        ·
                      </span>
                    ) : null}
                    <span className="text-foreground/78">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          <FadeIn delay={0.08} className="md:col-span-6 lg:col-span-7">
            <FiHeroEcosystemViz />
          </FadeIn>
        </div>
      </section>

      <FiHomeEcosystemSection />

      <FiHomePatientTwinSection />

      <FiHomeGlobalIntelligenceSection />

      <Section className="border-b border-border/50 py-14 md:py-16">
        <FadeIn>
          <SectionIntro
            eyebrow="Market context"
            title="Why the industry needs a shared intelligence layer."
            description="Hair restoration is a global, high-stakes field where outcomes are difficult to compare and quality is uneven. Marketing narratives outrun verifiable evidence; standards exist but rarely attach to comparable benchmarks across clinics and regions. Follicle Intelligence addresses the gap as the master platform—not with noise, but with structured audit, cohort visibility, and governance-grade reporting, amplified by specialist outcome, diagnostic, and training layers."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {MARKET_WHY_POINTS.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.35rem] border border-border/70 bg-card/35 p-6 md:p-7"
              >
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </Section>

      <GlobalHairIntelligenceSectionDynamic
        variant="follicle-intelligence"
        heading={ECOSYSTEM_HEADING}
        description={ECOSYSTEM_DESCRIPTION}
        networkTitle={GLOBAL_NETWORK_SECTION_TITLE}
        networkFooterCaption={GLOBAL_NETWORK_FOOTER_CAPTION}
        size="hero"
        theme="dark"
      />

      <Section className="py-14 md:py-16">
        <FadeIn>
          <SectionIntro
            eyebrow="The flywheel"
            title="One platform. Three intelligence layers."
            description="Follicle Intelligence™ is the master system: benchmarks, governance, Patient Twin continuity, and the clinic OS spine. HairAudit™, Hair Longevity Institute™, and IIOHR™ are specialist engines underneath—outcome, diagnostic, and training intelligence—that feed the same learning loop so improvement is measurable at ecosystem scale."
          />
          <ul className="mt-10 grid gap-6 border-t border-border/50 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            <li className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/90">
                Follicle Intelligence™
              </span>
              <p className="text-sm leading-6 text-muted-foreground">
                Master hair restoration platform: the command layer, longitudinal record, benchmarks, and governance—without replacing your operational systems of record.
              </p>
            </li>
            <li className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/90">
                HairAudit™ — Outcome Intelligence Layer
              </span>
              <p className="text-sm leading-6 text-muted-foreground">
                Surgical evidence and audit-grade scoring under Follicle Intelligence: case-level review workflows and comparability for transplant quality.
              </p>
            </li>
            <li className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/90">
                Hair Longevity Institute™ — Diagnostic Intelligence Layer
              </span>
              <p className="text-sm leading-6 text-muted-foreground">
                Biology and longitudinal treatment intelligence inside the FI substrate—signal beyond a single procedure snapshot.
              </p>
            </li>
            <li className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/90">
                IIOHR™ — Training Intelligence Layer
              </span>
              <p className="text-sm leading-6 text-muted-foreground">
                Methodology, training, and standards framing that makes Follicle Intelligence outputs reviewable and improvement programs institutionally legitimate.
              </p>
            </li>
          </ul>
        </FadeIn>
      </Section>

      <Section className="border-y border-border/50 py-14 md:py-16">
        <FadeIn>
          <SectionIntro
            eyebrow="What it analyses"
            title="Evidence in. Comparable quality out."
            description="FI structures procedural evidence into dimensions institutions can govern: comparable scores, cohort-relative standing, and reviewable pathways—not opaque commentary."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { term: "Graft quality", desc: "Extraction integrity, handling, and viability signals." },
              { term: "Density", desc: "Distribution, coverage, and design alignment." },
              { term: "Donor preservation", desc: "Donor management and long-term sustainability." },
              { term: "Outcomes", desc: "Follow-up evidence, survival, and patient-reported alignment." },
            ].map(({ term, desc }) => (
              <div key={term} className="rounded-[1.25rem] border border-border/70 bg-card/40 px-5 py-4">
                <p className="text-sm font-semibold text-foreground">{term}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/50 py-8 px-4 sm:gap-3">
            <span className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground">Analyse</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground">Score</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground">Learn</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground">Improve</span>
          </div>
          <p className="mt-4 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Evidence → score → benchmark → improve
          </p>
        </FadeIn>
      </Section>

      <Section className="py-12 md:py-14">
        <FadeIn>
          <div className="grid gap-4 md:grid-cols-5">
            {PROOF_CARDS.map((item, index) => (
              <div
                key={item.title}
                className={cn(
                  "rounded-[1.4rem] border p-5",
                  index === 0 ? "fi-panel md:col-span-2" : "fi-panel-muted"
                )}
              >
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  {item.title}
                </p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{item.value}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </Section>

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="What the platform does"
            title="Structured evidence. Defensible scores. Governance-ready."
            description="From evidence to domain assessments, cohort benchmarks, and review queues—built for institutional process, not slide decks. Deploy privately, white-label publicly, or both."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          {CAPABILITIES.map((item, index) => (
            <FadeIn key={item.title} delay={0.05 * index}>
              <Card className="h-full rounded-[1.4rem] border-border/70 bg-card/45 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                <CardHeader className="space-y-4">
                  <div className="fi-panel-muted flex h-12 w-12 items-center justify-center rounded-2xl">
                    <item.icon className="h-5 w-5 text-primary/90" />
                  </div>
                  <CardTitle className="text-xl leading-7">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-7">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-y border-border/50 py-20">
        <FadeIn>
          <SectionIntro
            eyebrow="How it works"
            title="Upload. Analyze. Score. Benchmark. Improve."
            description="Operational evidence enters from connected surfaces under Follicle Intelligence; what exits is comparable quality signal—ready for governance, training, and—where you choose—transparent disclosure."
          />
        </FadeIn>
        <div className="mt-10 grid gap-5 xl:grid-cols-5">
          {WORKFLOW_STEPS.map((item, index) => (
            <FadeIn key={item.step} delay={0.05 * index}>
              <div className="fi-panel rounded-[1.4rem] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/85">
                    {item.step}
                  </span>
                  {index < WORKFLOW_STEPS.length - 1 ? (
                    <Workflow className="hidden h-4 w-4 text-muted-foreground xl:block" />
                  ) : (
                    <CheckCircle2 className="hidden h-4 w-4 text-primary/85 xl:block" />
                  )}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="Who it is for"
            title="From operating room to boardroom—and the institutions in between."
            description="Clinicians gain clarity on performance; operators gain portfolio truth; standards bodies gain implementable frameworks; capital partners gain infrastructure with compounding signal. The through-line is the same: accountable quality at scale."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {AUDIENCES.map((item, index) => (
            <FadeIn key={item.title} delay={0.05 * index}>
              <Card className="h-full rounded-[1.4rem] border-border/70 bg-card/40">
                <CardHeader className="space-y-4">
                  <item.icon className="h-6 w-6 text-primary/90" />
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="leading-7">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="py-20">
        <FadeIn>
          <SectionIntro
            eyebrow="Dashboard preview"
            title="The command layer for benchmarked quality."
            description="Audit scores, domain breakdowns, cohort standing, governance queues, and disclosure controls—so leadership and clinical teams share one view of the truth."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10">
          <div className="fi-panel rounded-[2rem] p-6 md:p-8">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-6">
                <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[1.5rem] border border-border/70 bg-background/55 p-6">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Executive score
                    </p>
                    <div className="mt-5 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-5xl font-semibold text-foreground">92.4</p>
                        <p className="mt-2 text-sm text-primary">+4.1 vs trailing cohort average</p>
                      </div>
                      <Gauge className="h-10 w-10 text-primary/90" />
                    </div>
                    <div className="mt-6 h-40 rounded-[1.2rem] border border-border/60 bg-[linear-gradient(180deg,rgba(23,34,47,0.78),rgba(12,18,26,0.92))] p-4">
                      <div className="flex h-full items-end gap-2">
                        {[42, 48, 56, 58, 64, 72, 78, 84].map((value) => (
                          <div key={value} className="flex-1 rounded-t-xl bg-white/6">
                            <div
                              className="rounded-t-xl bg-[linear-gradient(180deg,rgba(98,208,255,0.9),rgba(56,159,214,0.45))]"
                              style={{ height: `${value}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-border/70 bg-background/55 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        Domain breakdown
                      </p>
                      <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary/85">
                        24 domains
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4">
                      <ScoreBar label="Planning and design" value="94" width="94%" />
                      <ScoreBar label="Extraction integrity" value="89" width="89%" />
                      <ScoreBar label="Placement execution" value="95" width="95%" />
                      <ScoreBar label="Documentation quality" value="87" width="87%" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  {[
                    {
                      icon: LineChart,
                      title: "Trends over time",
                      text: "Track consistency, variance, and uplift across rolling case cohorts and operator groups.",
                    },
                    {
                      icon: ChartColumnIncreasing,
                      title: "Clinic benchmarking",
                      text: "Compare sites and surgeons against internal targets and broader cohort ranges.",
                    },
                    {
                      icon: ScanSearch,
                      title: "Strengths vs weaknesses",
                      text: "Expose repeated weak signals, standout domains, and case clusters that need review.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-[1.35rem] border border-border/70 bg-card/45 p-5">
                      <item.icon className="h-5 w-5 text-primary/90" />
                      <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6">
                <div className="rounded-[1.5rem] border border-border/70 bg-background/55 p-6">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Governance alerts
                  </p>
                  <div className="mt-5 space-y-3">
                    {[
                      ["Outlier detection", "2 new deviations in extraction integrity"],
                      ["Review queue", "5 cases awaiting internal governance review"],
                      ["Reporting separation", "Public view locked until adjudication"],
                    ].map(([label, text]) => (
                      <div key={label} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-background/55 p-6">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Review layers
                  </p>
                  <div className="mt-5 grid gap-4">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                      <p className="text-sm font-semibold text-foreground">Internal reporting</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Governance notes, flagged evidence, operator comparisons, and training actions.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                      <p className="text-sm font-semibold text-foreground">External or public reporting</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Controlled disclosure layers for trust, transparency, and standards-aligned communication.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-background/55 p-6">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Intelligence summary
                  </p>
                  <div className="mt-5 grid gap-3">
                    {[
                      "Overall audit score and domain breakdown",
                      "Benchmark ranking and cohort drift",
                      "Outlier detection and review prioritization",
                      "Training opportunities and governance actions",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/35 px-4 py-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary/85" />
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="border-y border-border/50 py-20">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <FadeIn>
            <div className="fi-panel rounded-[1.75rem] p-7 md:p-8">
              <div className="flex items-center gap-4">
                <div className="rounded-[1.2rem] border border-amber-300/15 bg-amber-200/5 p-3">
                  <IiohrSeal tone="dark" className="h-16 w-16" aria-hidden />
                </div>
                <div>
                  <p className="fi-trust text-xs font-semibold uppercase tracking-[0.28em]">
                    Training Intelligence Layer (IIOHR™)
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground md:text-3xl">
                    Governance and scoring backed by formal methodology—inside Follicle Intelligence.
                  </h2>
                </div>
              </div>
              <p className="mt-6 text-base leading-7 text-muted-foreground">
                Follicle Intelligence is the master platform for audit and benchmarks; IIOHR™ is the Training
                Intelligence Layer that supplies methodology, training architecture, and standards framing—so scores
                mean something in professional context and can travel into governance, credentialing, and institutional
                programs without losing defensibility.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild className="rounded-xl">
                  <Link href="/methodology">Explore methodology &amp; IIOHR™ alignment</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/methodology">View Methodology</Link>
                </Button>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.06}>
            <div className="grid gap-5 md:grid-cols-2">
              {[
                {
                  icon: ClipboardList,
                  title: "Structured methodology",
                  desc: "A formal scoring framework that supports consistency, comparability, and defensible assessment.",
                },
                {
                  icon: ClipboardList,
                  title: "Review capability",
                  desc: "Case-level review layers for adjudication, commentary, and standards-led oversight.",
                },
                {
                  icon: ShieldCheck,
                  title: "Training and improvement",
                  desc: "Audit outputs that can be translated into practical quality improvement and clinician development.",
                },
                {
                  icon: Landmark,
                  title: "Institutional credibility",
                  desc: "A governance posture that feels aligned with institutes, associations, and quality-led bodies.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.4rem] border border-border/70 bg-card/40 p-5">
                  <item.icon className="h-5 w-5 text-primary/90" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </Section>

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="Infrastructure & expansion"
            title="Built as category infrastructure—not a single-product feature."
            description="Follicle Intelligence strengthens as more evidence types and standards programs connect: deeper cohorts, sharper benchmarks, and harder-to-replace workflow integration. Hair restoration is the live wedge; the architecture is modular for procedural and cosmetic verticals that share audit-shaped problems."
          />
        </FadeIn>
        <FadeIn delay={0.04} className="mt-10">
          <PlatformArchitectureMap />
        </FadeIn>
        <div className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <FadeIn>
            <div className="fi-panel rounded-[1.75rem] p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Platform architecture
              </p>
              <div className="mt-6 grid gap-4">
                {[
                  {
                    icon: Cpu,
                    title: "Follicle Intelligence engine",
                    desc: "Scoring logic, benchmark computation, confidence layers, governance rules, and reporting—one master stack that HairAudit™ (outcomes), HLI™ (diagnostics), and IIOHR™ (training) extend as intelligence layers.",
                  },
                  {
                    icon: Sparkles,
                    title: "Specialty adapters",
                    desc: "Vertical-specific scorecards, taxonomies, review criteria, and evidence models.",
                  },
                  {
                    icon: Building2,
                    title: "White-label deployment layers",
                    desc: "Clinic, group, institutional, or partner-branded interfaces with configurable governance settings.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border/70 bg-background/45 p-5">
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-primary/90" />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground">
                        {item.title}
                      </h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.06}>
            <div className="grid gap-5">
              {VERTICALS.map((item) => (
                <div key={item.title} className="rounded-[1.4rem] border border-border/70 bg-card/40 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary/85">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </Section>

      <section className="pb-20 pt-4">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="fi-panel rounded-[2rem] p-8 md:p-10">
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">
                    Final CTA
                  </p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                    Raise the standard for transparency—in practice, not prose.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                    Whether you run clinics, train surgeons, set standards, or deploy enterprise
                    platforms: Follicle Intelligence is the master platform for benchmarked quality and
                    accountable reporting across the global hair restoration industry—with outcome, diagnostic,
                    and training layers where your program needs depth. Request a demo, explore white-label, or
                    discuss institutional partnership.
                  </p>
                </div>
                <div className="grid gap-4">
                  <Button asChild size="lg" className="h-12 justify-between rounded-xl px-5">
                    <Link href="/contact?intent=demo">
                      Request a platform demo
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-12 justify-between rounded-xl px-5">
                    <Link href="/contact?intent=white-label">
                      Explore white-label opportunities
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg" className="h-12 justify-between rounded-xl px-5">
                    <Link href="/contact?intent=partnership">
                      Talk about benchmarking and audit systems
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

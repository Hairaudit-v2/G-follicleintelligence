import type { Metadata } from "next";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/fade-in";
import {
  ArrowRight,
  BarChart3,
  Cpu,
  GitBranch,
  Layers3,
  Scale,
  ShieldCheck,
  Workflow,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Platform: Category Infrastructure for Audit, Benchmarks & Governance | Follicle Intelligence",
  description:
    "Follicle Intelligence is infrastructure for hair restoration quality: compounding benchmarks, governance and review, and cross-surface learning across HairAudit, HLI, and IIOHR—private, white-label, and institutional deployment.",
};

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
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

function DiagramPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-[100px] flex-col items-center justify-center rounded-xl border border-dashed border-primary/20 bg-primary/5 px-4 py-5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/75">Diagram / framework</p>
      <p className="mt-2 max-w-lg text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

const CAPABILITY_BLOCKS = [
  {
    icon: Cpu,
    title: "Central intelligence core",
    desc: "A single substrate for structuring evidence, computing scores, and emitting signals—not a menu of disconnected “features.” Operational systems stay upstream; FI holds what must be comparable across sites and time.",
  },
  {
    icon: BarChart3,
    title: "Benchmark and standing layer",
    desc: "Cohort definitions, historical baselines, and drift logic that make position defensible. A number without a denominator is marketing; here the denominator is explicit and versioned.",
  },
  {
    icon: Scale,
    title: "Audit governance",
    desc: "Review paths, assignees, and adjudication states—not cosmetic approval stamps. This is where institutional risk is managed: what may be disclosed, what stays internal, and who signed off.",
  },
  {
    icon: Workflow,
    title: "Case and exception orchestration",
    desc: "Intake through re-assessment: exceptions route to people, not folders. Improvement loops close because the platform encodes responsibility, not because someone remembers to email.",
  },
  {
    icon: ShieldCheck,
    title: "Evidence and confidence posture",
    desc: "Outputs carry evidence density and integrity cues—so scores are not mistaken for omniscience. Leaders act when signal quality supports the decision.",
  },
  {
    icon: GitBranch,
    title: "Deployment envelope",
    desc: "Same engine under private tenancy, partner white-label, or institutional program: policy boundaries, branding, and data separation are first-class—not retrofitted hosting options.",
  },
];

const COMPOUNDING_PILLARS = [
  {
    title: "Cohort depth",
    body: "Benchmarks get sharper as more cases enter under consistent rules. Early adopters are not buying a static report—they participate in a denominator that becomes harder for late entrants to ignore.",
  },
  {
    title: "Governance history",
    body: "Every review, escalation, and adjudication leaves a trace. Over time that history is its own asset: proof that quality management was operational, not aspirational.",
  },
  {
    title: "Integration footprint",
    body: "Workflow hooks into HairAudit, HLI-connected pathways, and IIOHR-aligned programs increase switching cost in proportion to seriousness of use—not in proportion to monthly login count.",
  },
];

const REPLICATION_MOAT = [
  {
    title: "Category-specific evidence model",
    body: "Hair restoration is not generic “clinical data.” Domain taxonomies, review norms, and evidence types are built for transplant workflows. A horizontal analytics stack does not inherit that semantics layer.",
  },
  {
    title: "Multi-surface coupling",
    body: "Surgery (HairAudit), longitudinal biology (HLI), and methodology (IIOHR) are separate operating realities; FI is where they meet. Replicating one surface is not replicating the flywheel.",
  },
  {
    title: "Governance as product",
    body: "Competitors can ship charts. Few ship review queues, disclosure separation, and audit trails that institutions will actually run under scrutiny—because that is process and liability design, not UI polish.",
  },
  {
    title: "Time in market",
    body: "Cohort credibility and standards relationships compound. There is no shortcut to years of comparable cases under versioned rules—only entrants who start later with thinner denominators.",
  },
];

const CROSS_SURFACE = [
  {
    surface: "HairAudit",
    role: "Surgical evidence and audit surface",
    toFi: "Feeds scored case evidence, domain weaknesses, and peer-relative standing for the technical core of restoration.",
  },
  {
    surface: "Hair Longevity Institute",
    role: "Biology and longitudinal treatment intelligence",
    toFi: "Extends signal beyond a single procedure—response over time—so quality is not only a snapshot.",
  },
  {
    surface: "IIOHR",
    role: "Methodology, training, standards",
    toFi: "Anchors what “good” means in a professional frame: credentialing, remediation, and institutional legitimacy.",
  },
];

const DEPLOYMENT_MODES = [
  {
    title: "Private and dedicated",
    body: "Tenant-isolated operation for operators who need clear data boundaries, regional constraints, and contractual control. The intelligence substrate is shared; your policy envelope is not. Appropriate for health-system-style governance and multi-brand groups that cannot commingle evidence.",
  },
  {
    title: "White-label and partner-embedded",
    body: "The same scoring engine and benchmark logic under your product or brand surface. Partners ship depth without rebuilding audit science; FI retains the governance primitives (roles, review states, reporting separation) that make enterprise deals feasible.",
  },
  {
    title: "Institutional and standards-led",
    body: "Programs that require methodology versioning, committee review, and exportable packets for oversight. IIOHR alignment is not a marketing badge here—it is how review pathways stay credible when professions and regulators ask questions.",
  },
];

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow="Platform"
        title="Infrastructure for accountable quality—not a toolkit for prettier charts."
        subtitle="Hair restoration is global, fragmented, and reputation-driven. Point solutions can score a case or display a dashboard; they do not make quality comparable across jurisdictions, time, and professional standards. Follicle Intelligence is built as category infrastructure: evidence structuring, cohort logic, governance workflow, and cross-surface learning—so adoption deepens the moat instead of merely renewing a subscription."
      />

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="Category gap"
            title="Why this market needs infrastructure, not another tool."
            description="Tools optimize individual workflows. Infrastructure coordinates evidence, benchmarks, and accountability across operators, brands, and institutions—without collapsing everything into one database. FI does not replace your EMR or your surgical record system; it is the layer where quality becomes legible enough to govern and improve at scale."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-8">
          <div className="rounded-[1.35rem] border border-border/70 bg-card/40 p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-foreground">What tools alone cannot do</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Hold a single definition of “standing” across surgeons and sites.</li>
                  <li>Version cohort rules when methodology changes—without erasing history.</li>
                  <li>Separate internal adjudication from cleared external disclosure by design.</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">What infrastructure must do</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Survive diligence: traceability, evidence linkage, and review records.</li>
                  <li>Compound: more participants, sharper benchmarks, stronger governance history.</li>
                  <li>Connect surgery, biology, and standards in one architecture—not three siloed products.</li>
                </ul>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Architecture"
            title="Capabilities that belong in a serious quality program."
            description="These are not feature bullets for a roadmap slide—they are the minimum load-bearing elements for benchmarked, governable quality."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_BLOCKS.map((item, i) => (
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
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Compounding"
            title="Why the platform compounds."
            description="Defensibility is not a patent on a model; it is the accumulation of comparable evidence, cohort depth, and governance history under consistent rules. Each serious adoption round makes the system more valuable for the next participant—because benchmarks and review norms get harder to replicate from scratch."
          />
        </FadeIn>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {COMPOUNDING_PILLARS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.35rem] border border-border/70 bg-card/45 p-6 md:p-7">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        <DiagramPlaceholder
          label="Suggested: flywheel diagram—evidence in → cohorts deepen → benchmarks sharpen → more operators adopt → governance history grows—with FI at center and HairAudit / HLI / IIOHR as inputs."
        />
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Governance"
            title="Scoring without review is half a system."
            description="A score answers ‘what.’ Governance answers ‘who saw it, what did we do, and what may we say externally?’ Institutions and boards care about the second as much as the first. FI treats review queues, escalation, adjudication, and disclosure separation as first-class—because reputational and regulatory risk lives in the gap between insight and action."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-8">
          <div className="rounded-[1.35rem] border border-border/70 bg-background/55 p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">Scoring layer</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Domain assessments, confidence, cohort-relative position—necessary for comparing technical quality
                  and prioritizing improvement.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">
                  Governance layer
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Assignees, review states, internal vs cleared reporting, and traceable decisions—necessary for
                  running a quality program adults will trust under scrutiny.
                </p>
              </div>
            </div>
            <p className="mt-8 border-t border-border/50 pt-6 text-sm text-muted-foreground">
              Investors should note: workflow integration for review is harder to rip out than a dashboard
              export. That stickiness is intentional—it mirrors how real institutions buy quality.
            </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Ecosystem"
            title="Cross-surface learning is the moat multiplier."
            description="Each surface—HairAudit, HLI, IIOHR—could exist as a standalone product. The defensibility argument is that FI learns across them: surgical evidence, longitudinal biology, and professional methodology feed one benchmark and governance substrate. A competitor with only one stream cannot reproduce the same network effects."
          />
        </FadeIn>
        <div className="mt-10 space-y-6">
          {CROSS_SURFACE.map((row, i) => (
            <FadeIn key={row.surface} delay={0.05 * i}>
              <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-card/40 p-5 md:flex-row md:items-start md:gap-8 md:p-6">
                <div className="md:w-1/3">
                  <p className="text-sm font-semibold text-foreground">{row.surface}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.role}</p>
                </div>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{row.toFi}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        <DiagramPlaceholder
          label="Suggested: triangle or hub diagram—HairAudit, HLI, IIOHR at vertices; FI at center with arrows labeled evidence, longitudinal signal, standards."
        />
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Defensibility"
            title="Why this is hard to replicate."
            description="Replication is not ‘another model API.’ It is rebuilding semantics, cohort history, governance workflow, and multi-surface integrations—under professional and contractual constraints that favor incumbents with time in market."
          />
        </FadeIn>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {REPLICATION_MOAT.map((item, i) => (
            <FadeIn key={item.title} delay={0.05 * i}>
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
            eyebrow="Deployment"
            title="Private, white-label, institutional—same substrate, different envelope."
            description="Commercial seriousness is not only feature count; it is whether the platform can meet data boundaries, brand requirements, and committee oversight. FI is designed for deployment patterns that match how healthcare and enterprise buyers actually contract."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {DEPLOYMENT_MODES.map((mode, i) => (
            <FadeIn key={mode.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.35rem] border border-border/70 bg-card/40 p-6">
                <Layers3 className="h-5 w-5 text-primary/85" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-foreground">{mode.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{mode.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/white-label">White-label</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/security">Security posture</Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-xl">
            <Link href="/licensing">
              Licensing
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Section>

      <Section className="border-t border-border/40">
        <FadeIn>
          <div className="fi-panel rounded-2xl p-8 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">How it operates</p>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                "Evidence enters from connected workflows and surfaces",
                "Structuring, scoring, and confidence assignment",
                "Benchmark comparison, drift, and standing",
                "Governance actions, training routing, disclosure control",
              ].map((step, i) => (
                <div key={step} className="rounded-lg border border-border/70 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {i + 1}</p>
                  <p className="mt-3 text-sm text-foreground">{step}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Production pathways include{" "}
              <Link
                href="https://hairaudit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                HairAudit
              </Link>{" "}
              for surgical audit; integration with{" "}
              <Link
                href="https://hairlongevityinstitute.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                Hair Longevity Institute
              </Link>{" "}
              for longitudinal biology; and alignment with{" "}
              <Link
                href="https://iiohr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
              >
                IIOHR
              </Link>{" "}
              for methodology, training, and standards.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild className="rounded-xl">
                <Link href="/contact?intent=demo">Book enterprise demo</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/dashboard-demo">Dashboard walkthrough</Link>
              </Button>
            </div>
            <EcosystemMention className="mt-8 border-t border-border/50 pt-6" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

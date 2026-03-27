import Link from "next/link";
import type { Metadata } from "next";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  FileLock,
  Gauge,
  Landmark,
  Layers3,
  LineChart,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard Walkthrough: Command Layer for Benchmarked Quality | Follicle Intelligence",
  description:
    "Product walkthrough: executive quality view, domain scores, cohort standing, governance queues, and disclosure controls—the operating interface for audit, benchmarks, and institutional reporting.",
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

function ScoreBar({ label, value, width }: { label: string; value: string; width: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(84,202,255,0.62),rgba(162,220,255,0.96))]"
          style={{ width }}
        />
      </div>
    </div>
  );
}

/** Design handoff: replace inner content with screenshot or Figma embed */
function VisualPlaceholder({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center",
        className
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary/80">Suggested visual</p>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">{label}</p>
    </div>
  );
}

function ExplainGrid({
  see,
  mean,
  action,
}: {
  see: string;
  mean: string;
  action: string;
}) {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      <div className="rounded-[1.25rem] border border-border/70 bg-card/40 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/85">What you see</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{see}</p>
      </div>
      <div className="rounded-[1.25rem] border border-border/70 bg-card/40 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/85">What it means</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{mean}</p>
      </div>
      <div className="rounded-[1.25rem] border border-border/70 bg-card/40 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/85">What action it enables</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{action}</p>
      </div>
    </div>
  );
}

const ROLE_LENS = [
  {
    icon: Stethoscope,
    title: "Surgeon / clinical lead",
    focus: "Domain-level performance and defensible feedback loops.",
    example:
      "Dr. Chen opens the executive tile for her rolling 90-day cohort: overall audit score, extraction integrity vs peers, and a short list of cases flagged for pattern review—not a generic “quality score,” but where her technique diverges from the benchmark she chose to hold herself against.",
  },
  {
    icon: Building2,
    title: "Clinic operator",
    focus: "Site standing, disclosure readiness, and internal assurance.",
    example:
      "The clinic brand lead compares this month’s median score to the group’s internal target, checks the governance queue before any external reporting, and routes two cases to clinical review—so public-facing claims stay aligned with adjudicated evidence.",
  },
  {
    icon: Users,
    title: "Group operator",
    focus: "Portfolio drift, capital allocation, and cross-site consistency.",
    example:
      "A network COO views cohort standing by region and surgeon tier, spots a site whose donor-management scores lag peers, and opens a portfolio action: targeted training budget and a follow-up audit window—signal-driven, not survey-driven.",
  },
  {
    icon: Landmark,
    title: "Standards / review body",
    focus: "Traceability, review pathways, and methodology alignment.",
    example:
      "An IIOHR-aligned reviewer sees separation between internal adjudication and any public summary, exports a structured case packet for committee review, and ties findings back to training modules—without raw operational noise in the institutional record.",
  },
];

export default function DashboardDemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Product walkthrough"
        title="The operating interface for benchmarked quality."
        subtitle="This is where Follicle Intelligence becomes operational: not a static report, but a command layer—executive posture, domain truth, cohort standing, governance queues, and controlled disclosure. What follows mirrors how teams actually use the surface when audit evidence, benchmarks, and standards have to agree."
      />

      <Section className="pb-8 md:pb-10">
        <FadeIn>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Under the UI, the same intelligence core connects{" "}
            <strong className="font-medium text-foreground">HairAudit</strong> surgical evidence,{" "}
            <strong className="font-medium text-foreground">HLI</strong> longitudinal biology where integrated,
            and <strong className="font-medium text-foreground">IIOHR</strong>-aligned methodology. The
            dashboard is how that compound signal becomes decisions.
          </p>
          <VisualPlaceholder
            className="mt-8"
            label="Full-width hero capture: logged-in home or workspace with executive tile, left nav, and tenant branding—annotate callouts for score, cohort, and queue count."
          />
        </FadeIn>
      </Section>

      {/* 1 Executive */}
      <Section className="border-t border-border/50 pt-12 md:pt-16">
        <FadeIn>
          <SectionIntro
            eyebrow="01 · Executive quality view"
            title="One number everyone agrees to interpret the same way."
            description="The executive layer answers: are we within tolerance, improving, and aligned with the cohorts we care about—before anyone opens a case file."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10">
          <div className="fi-panel rounded-[1.75rem] p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Portfolio executive score</p>
                <div className="mt-4 flex items-end gap-4">
                  <p className="text-5xl font-semibold text-foreground">92.4</p>
                  <div className="mb-1 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80">Vs cohort</p>
                    <p className="text-sm font-semibold text-primary">+4.1 vs trailing 90-day mean</p>
                  </div>
                </div>
              </div>
              <Gauge className="h-12 w-12 shrink-0 text-primary/85" aria-hidden />
            </div>
            <div className="mt-6 h-36 rounded-[1.2rem] border border-border/60 bg-[linear-gradient(180deg,rgba(23,34,47,0.78),rgba(12,18,26,0.92))] p-4">
              <div className="flex h-full items-end gap-1.5">
                {[42, 48, 56, 58, 64, 72, 78, 84, 88].map((value) => (
                  <div key={value} className="flex-1 rounded-t-lg bg-white/6">
                    <div
                      className="rounded-t-lg bg-[linear-gradient(180deg,rgba(98,208,255,0.9),rgba(56,159,214,0.45))]"
                      style={{ height: `${value}%` }}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Rolling score trend · last 9 periods
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["Evidence completeness", "High"],
                ["Cohort membership", "HT peer v2"],
                ["Last adjudication", "12 days ago"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border/60 bg-card/35 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{k}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{v}</p>
                </div>
              ))}
            </div>
          </div>
          <VisualPlaceholder
            className="mt-6"
            label="Screenshot or zoomed mock: executive tile with trend sparkline and cohort badge; optional overlay arrows for 'score,' 'delta,' 'period.'"
          />
          <ExplainGrid
            see="A single composite audit score (and trend) for the scope you select—surgeon, site, or group—with explicit cohort labels and evidence-completeness posture."
            mean="Leadership and clinical leads share one definition of “how good,” tied to structured evidence, not a spreadsheet debate."
            action="Set internal targets, prioritize reviews, and decide what is safe to disclose externally once governance has run."
          />
        </FadeIn>
      </Section>

      {/* 2 Domains */}
      <Section className="border-t border-border/50 pt-12 md:pt-16">
        <FadeIn>
          <SectionIntro
            eyebrow="02 · Domain and score breakdowns"
            title="Where excellence and risk actually live."
            description="Aggregates hide failure modes. Domain views expose which technical dimensions drive the headline—donor management, extraction, placement, documentation—so improvement has an address."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10">
          <div className="fi-panel rounded-[1.75rem] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Domain breakdown</p>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary/85">
                24 domains
              </span>
            </div>
            <div className="mt-6 grid max-w-2xl gap-3">
              <ScoreBar label="Planning and design" value="94" width="94%" />
              <ScoreBar label="Extraction integrity" value="81" width="81%" />
              <ScoreBar label="Placement execution" value="95" width="95%" />
              <ScoreBar label="Documentation quality" value="87" width="87%" />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Lowest domain this period: <span className="text-foreground">Extraction integrity</span> — drives
              review queue priority below.
            </p>
          </div>
          <VisualPlaceholder
            className="mt-6"
            label="Side-by-side or stacked bars with tooltip mock: hovering 'extraction' shows definition and evidence sources counted toward the domain."
          />
          <ExplainGrid
            see="Per-domain scores with configurable weights; weak domains surface automatically relative to your baseline and peer cohort."
            mean="You see whether the problem is design, execution, or record-keeping—different owners, different fixes."
            action="Assign targeted QA, peer review, or training modules; track whether the same domain recurs across cases."
          />
        </FadeIn>
      </Section>

      {/* 3 Cohort benchmarking */}
      <Section className="border-t border-border/50 pt-12 md:pt-16">
        <FadeIn>
          <SectionIntro
            eyebrow="03 · Cohort benchmarking and standing"
            title="Relative position you can defend."
            description="Benchmarks turn scores into context: peer groups, historical baselines, and internal targets—so ‘good’ is defined, not assumed."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="fi-panel rounded-[1.75rem] p-6 md:p-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-primary/85" aria-hidden />
                Cohort standing
              </div>
              <p className="mt-4 text-2xl font-semibold text-foreground">Top 18% · HT peer v2</p>
              <p className="mt-1 text-sm text-muted-foreground">Surgeon-level · last 120 cases</p>
              <div className="mt-6 space-y-3 border-t border-border/50 pt-6">
                {[
                  ["Peer median", "86.2"],
                  ["Your trailing mean", "91.4"],
                  ["Group internal target", "90.0"],
                  ["Best-in-network (ref)", "94.1"],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="fi-panel rounded-[1.75rem] p-6 md:p-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <LineChart className="h-4 w-4 text-primary/85" aria-hidden />
                Drift watch
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Cohort definitions are versioned. When membership rules change, standing is recomputed with an
                explicit breakpoint—so month-to-month movement reflects performance, not a silent denominator
                shift.
              </p>
              <div className="mt-6 rounded-xl border border-border/60 bg-background/50 p-4 text-xs text-muted-foreground">
                Active rule set: <span className="text-foreground">HT peer v2</span> · Effective{" "}
                <span className="text-foreground">Jan 1</span>
              </div>
            </div>
          </div>
          <VisualPlaceholder
            className="mt-6"
            label="Benchmark panel with percentile ribbon or ladder graphic; optional map or site list for multi-location operators."
          />
          <ExplainGrid
            see="Rank or band vs selected cohorts, plus internal targets; drift and rule-version notes where methodology changes."
            mean="Investors see proprietary cohort depth; buyers see whether marketing claims survive an internal benchmark."
            action="Adjust targets, defend differentiation with evidence, or escalate when standing slips for multiple periods."
          />
        </FadeIn>
      </Section>

      {/* 4 Governance */}
      <Section className="border-t border-border/50 pt-12 md:pt-16">
        <FadeIn>
          <SectionIntro
            eyebrow="04 · Governance alerts and review queues"
            title="Exceptions before they become incidents."
            description="Quality systems fail when outliers sit in inboxes. The surface prioritizes what needs human judgment—pattern breaks, incomplete evidence, repeated weak domains—and keeps an auditable trail."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10">
          <div className="fi-panel rounded-[1.75rem] p-6 md:p-8">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-400/90" aria-hidden />
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Governance queue</p>
            </div>
            <div className="mt-6 space-y-3">
              {[
                ["P1 · Pattern break", "Extraction integrity · 3 cases · same week", "Awaiting lead reviewer"],
                ["P2 · Evidence gap", "Case HT-2401 · post-op set incomplete", "Request documentation"],
                ["P3 · Recurring domain", "Documentation · below floor 2nd month", "Schedule coaching"],
              ].map(([sev, body, status]) => (
                <div
                  key={body}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold text-primary/90">{sev}</p>
                    <p className="mt-1 text-sm text-foreground">{body}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{status}</span>
                </div>
              ))}
            </div>
          </div>
          <VisualPlaceholder
            className="mt-6"
            label="Queue table mock with severity chips, assignee column, SLA clock—ideal for annotated product tour."
          />
          <ExplainGrid
            see="Prioritized items: statistical outliers, missing evidence, repeated weak domains—each row linkable to case evidence."
            mean="Governance is proactive; reputational risk is reduced because review happens before external narratives harden."
            action="Assign reviewers, attach adjudication notes, and close the loop into training or policy updates."
          />
        </FadeIn>
      </Section>

      {/* 5 Reporting */}
      <Section className="border-t border-border/50 pt-12 md:pt-16">
        <FadeIn>
          <SectionIntro
            eyebrow="05 · Reporting separation and disclosure controls"
            title="Internal truth and external story, explicitly separated."
            description="Not every insight belongs in a patient-facing or public summary. The layer enforces which artifacts are internal-only, which are cleared for controlled disclosure, and which require sign-off—aligned with institutional policy."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="fi-panel rounded-[1.75rem] p-6 md:p-8">
              <div className="flex items-center gap-2">
                <Layers3 className="h-5 w-5 text-primary/85" aria-hidden />
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Internal reporting</p>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">·</span>
                  Full domain breakdown, reviewer notes, and benchmark methodology footnotes
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">·</span>
                  Governance outcomes and training assignments tied to case IDs
                </li>
              </ul>
            </div>
            <div className="fi-panel rounded-[1.75rem] p-6 md:p-8">
              <div className="flex items-center gap-2">
                <FileLock className="h-5 w-5 text-emerald-400/90" aria-hidden />
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">External / public layer</p>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-emerald-400/90">·</span>
                  Summary score and banding only after adjudication state = cleared
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400/90">·</span>
                  Optional patient-facing certificate language with fixed disclosure rules
                </li>
              </ul>
              <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-muted-foreground">
                Public view <span className="font-medium text-foreground">locked</span> until governance queue
                clears for cohort HT-Q1.
              </p>
            </div>
          </div>
          <VisualPlaceholder
            className="mt-6"
            label="Split view or toggle: 'Internal' vs 'External preview' with watermark on draft public summary."
          />
          <ExplainGrid
            see="Distinct report objects and permissions: internal pack vs cleared external summary, with lock state visible in UI."
            mean="Trust: stakeholders know what was reviewed before anything leaves the organization."
            action="Run disclosure reviews, export compliant summaries for partners or patients, and avoid accidental over-sharing."
          />
        </FadeIn>
      </Section>

      {/* Role lens */}
      <Section className="border-t border-border/50 pt-12 md:pt-16">
        <FadeIn>
          <SectionIntro
            eyebrow="Who uses this layer"
            title="Same surface, different decisive questions."
            description="The command layer stays consistent; the job title changes what you optimize for—from technique to portfolio to standards."
          />
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {ROLE_LENS.map((item, i) => (
            <FadeIn key={item.title} delay={0.06 * i}>
              <div className="h-full rounded-[1.4rem] border border-border/70 bg-card/45 p-6 md:p-7">
                <item.icon className="h-6 w-6 text-primary/85" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-primary/80">{item.focus}</p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.example}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* Scenario */}
      <Section className="border-t border-border/50 py-12 md:py-16">
        <FadeIn>
          <SectionIntro
            eyebrow="Scenario"
            title="From deviation to decision—in one system."
            description="A realistic path through the layer when quality signal breaks from expectation. Names and IDs are illustrative."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10">
          <div className="fi-panel rounded-[1.75rem] p-6 md:p-10">
            <ol className="space-y-8 border-l border-border/60 pl-6 md:pl-8">
              {[
                {
                  step: "Signal",
                  text: "Weekly cohort review shows extraction integrity for surgeon A drops from the 88–91 band to 79–83 over ten cases—domain view, not headline score alone.",
                },
                {
                  step: "Triage",
                  text: "Governance queue auto-prioritizes a P1 pattern break: three cases in five days below the extraction floor. Cases HT-2388, HT-2394, HT-2401 attach with evidence thumbnails.",
                },
                {
                  step: "Review",
                  text: "Lead reviewer locks an internal adjudication pack; peer comment added. Public reporting remains locked for that surgeon’s public tile until cleared.",
                },
                {
                  step: "Route",
                  text: "Outcome: targeted FUE mechanics refresher assigned via IIOHR-aligned training module; second-line QA on next fifteen cases. Portfolio view shows the site operator a single action item with owner and due date.",
                },
              ].map((row, idx) => (
                <li key={row.step} className="relative">
                  <span className="absolute -left-[25px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-background text-[11px] font-semibold text-primary md:-left-[33px]">
                    {idx + 1}
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/85">{row.step}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{row.text}</p>
                </li>
              ))}
            </ol>
            <VisualPlaceholder
              className="mt-10"
              label="Storyboard strip: four panels (domain chart dip → queue screenshot → review modal → training assignment) for sales deck or product marketing."
            />
          </div>
        </FadeIn>
      </Section>

      {/* Proof strip + CTA */}
      <Section className="pb-16 md:pb-20">
        <FadeIn>
          <div className="fi-panel rounded-[2rem] p-8 md:p-10">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-primary/90">
                  <Activity className="h-4 w-4" aria-hidden />
                  Proof of depth
                </div>
                <p className="mt-4 text-lg font-medium text-foreground">
                  This walkthrough is representative of how Follicle Intelligence is meant to be deployed: one
                  command layer for benchmarked quality, not a chart library bolted onto a database.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Live demos cover tenant configuration, cohort rule sets, reviewer permissions, and export
                  behavior—aligned to your governance model.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button asChild size="lg" className="h-11 rounded-xl">
                  <Link href="/contact?intent=demo">
                    Book live walkthrough
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 rounded-xl">
                  <Link href="/platform">Platform architecture</Link>
                </Button>
              </div>
            </div>
            <EcosystemMention className="mt-10 border-t border-border/50 pt-8" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

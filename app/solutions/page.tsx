import type { Metadata } from "next";
import Link from "next/link";

import { EcosystemMention } from "@/components/ecosystem/EcosystemMention";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Cpu,
  Landmark,
  Network,
  Stethoscope,
  TrendingUp,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Solutions by Buyer: Clinical, Enterprise & Institutional | Follicle Intelligence",
  description:
    "How Follicle Intelligence maps to surgeons, clinics, networks, standards bodies, platform partners, and strategic investorsâ€”pain points, outcomes, deployment, and ecosystem fit.",
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

type BuyerSegment = {
  icon: LucideIcon;
  title: string;
  hook: string;
  pains: string[];
  howFiHelps: string;
  outcomes: string[];
  /** Which ecosystem surfaces carry most weight for this buyer */
  ecosystem: { label: string; detail: string }[];
  ctaLabel: string;
  ctaHref: string;
};

const BUYER_SEGMENTS: BuyerSegment[] = [
  {
    icon: Stethoscope,
    title: "Surgeons and clinical leads",
    hook: "Performance feedback that survives scrutiny from peers, patients, and payers.",
    pains: [
      "Reputation rests on outcomes that are hard to compare across peers and hard to document consistently.",
      "Quality conversations default to anecdote, volume, or marketingâ€”rarely structured evidence.",
      "Improvement plans lack a shared yardstick, so coaching feels subjective.",
    ],
    howFiHelps:
      "HairAudit supplies the surgical audit surface: domain scores tied to case evidence, not opinion. Follicle Intelligence aggregates standing over rolling cohorts so you see where technique is stable, where it drifts, and where evidence is incomplete. Where programs include medical management, HLI-connected longitudinal signal can inform the same review rhythmâ€”IIOHR-aligned training ties remediation to methodology.",
    outcomes: [
      "Defensible self-assessment and peer comparison on dimensions that matter surgically.",
      "Clear priorities for QA and skills workâ€”grounded in repeat weak domains, not noise.",
      "A credible path to selective transparency (e.g., benchmarks, certificates) after governance review.",
    ],
    ecosystem: [
      { label: "HairAudit", detail: "Primary evidence and scoring entry point for surgical work." },
      { label: "Follicle Intelligence", detail: "Benchmarks, confidence, and review-ready outputs." },
      { label: "IIOHR", detail: "Training and standards alignment when improvement is formalized." },
      { label: "HLI", detail: "Longitudinal biology where your practice integrates treatment pathways." },
    ],
    ctaLabel: "Clinical workflow conversation",
    ctaHref: "/contact?intent=demo",
  },
  {
    icon: Building2,
    title: "Clinics and brands",
    hook: "Quality you can operationalizeâ€”and, where appropriate, evidence you can stand behind commercially.",
    pains: [
      "Brand promises outrun what internal QA can prove under pressure.",
      "Teams need one system for review, not a patchwork of spreadsheets and chats.",
      "Leaders lack cohort-relative standing to prioritize spend across surgeons and services.",
    ],
    howFiHelps:
      "Deploy FI as the clinicâ€™s command layer: governance queues, internal reporting packs, and controlled external summaries. HairAudit anchors surgical evidence; IIOHR gives methodology credibility for training and claims; HLI connects when your brand sells longitudinal care, not only surgery. White-label options let the patient-facing story stay on-brand while the intelligence backbone stays consistent.",
    outcomes: [
      "Operational discipline: who gets review, what gets escalated, what gets trained next.",
      "Differentiation backed by benchmark contextâ€”not a slogan without a denominator.",
      "Disclosure discipline: separate internal truth from cleared external language.",
    ],
    ecosystem: [
      { label: "FI", detail: "Governance, reporting separation, and tenant policy envelope." },
      { label: "HairAudit", detail: "Surgical audit and case-level evidence." },
      { label: "IIOHR", detail: "Standards and training alignment for staff development and trust." },
      { label: "HLI", detail: "Biology and follow-up intelligence for integrated clinics." },
    ],
    ctaLabel: "Clinic and brand scoping",
    ctaHref: "/contact?intent=demo",
  },
  {
    icon: Network,
    title: "Group and network operators",
    hook: "Portfolio truth: where sites converge, diverge, and driftâ€”before variance becomes liability.",
    pains: [
      "Multi-site inconsistency is visible to patients online long before it is visible in management reports.",
      "Capital and training budgets need to follow signal, not the loudest market.",
      "Acquisitions and roll-ups inherit quality debt without comparable baselines.",
    ],
    howFiHelps:
      "FI standardizes audit and benchmark views across entities while preserving role-appropriate access. Group dashboards surface drift by region, brand, or surgeon tier; governance workflows route exceptions centrally or locally per policy. HairAudit operationalizes surgical evidence at scale; IIOHR supports network-wide standards programs; HLI matters where networks sell consistent medical pathways across sites.",
    outcomes: [
      "Comparable baselines across the portfolioâ€”apples-to-apples where policy allows.",
      "Faster intervention when a site breaks from peer or internal bands.",
      "Board-ready narratives: standing, risk, and remediation with traceable evidence.",
    ],
    ecosystem: [
      { label: "FI", detail: "Portfolio analytics, permissions, and cross-site governance." },
      { label: "HairAudit", detail: "Standardized surgical audit intake across locations." },
      { label: "IIOHR", detail: "Network training and credentialing at scale." },
      { label: "HLI", detail: "Longitudinal programs where networks standardize medical care." },
    ],
    ctaLabel: "Portfolio and governance review",
    ctaHref: "/contact?intent=demo",
  },
  {
    icon: Landmark,
    title: "Standards bodies and institutes",
    hook: "Frameworks that can be adoptedâ€”not slide decks that sit on a shelf.",
    pains: [
      "Professional credibility requires review pathways people can actually run.",
      "Quality programs fail when evidence is inconsistent or non-comparable across members.",
      "Partners need assurance that methodology is explicit, versioned, and auditable.",
    ],
    howFiHelps:
      "FI provides structured scoring, cohort definitions, and adjudication records institutions can reference. IIOHR supplies methodology, training architecture, and governance alignmentâ€”so programs feel legitimate inside the profession. HairAudit is the practical surgical evidence surface; HLI extends signal where biology and follow-up belong in the same quality story.",
    outcomes: [
      "Implementable standards: what is measured, how it is reviewed, how it improves over time.",
      "Member organizations gain tools rather than one-off consulting outputs.",
      "Committees can export defensible packets for oversight without exposing raw operational chaos.",
    ],
    ecosystem: [
      { label: "IIOHR", detail: "Methodology, training, and governance alignmentâ€”often the institutional anchor." },
      { label: "FI", detail: "Audit infrastructure, versioning, and review traceability." },
      { label: "HairAudit", detail: "Operational surgical evidence for member practices." },
      { label: "HLI", detail: "Longitudinal and biological dimensions when standards span surgery and medicine." },
    ],
    ctaLabel: "Institutional alignment",
    ctaHref: "/contact?intent=institution",
  },
  {
    icon: Cpu,
    title: "Platform and enterprise partners",
    hook: "Benchmark depth inside your productâ€”not a bolt-on PDF export.",
    pains: [
      "EHR, telehealth, and vertical SaaS buyers expect modern APIs and clear data contracts.",
      "Building audit science and cohort logic in-house is slow and talent-intensive.",
      "Partners need white-label depth without owning clinical liability for every edge case.",
    ],
    howFiHelps:
      "License FI as infrastructure: APIs, events, and configurable pipelines that embed scoring and benchmarks into your workflows. Partners ship faster with governance primitives (roles, review states, reporting separation) already modeled. HairAudit demonstrates production depth in hair; the same engine pattern extends where your roadmap overlaps procedural evidence. HLI and IIOHR integrations are explicit when your customers run combined programs.",
    outcomes: [
      "Shorter time-to-value for â€œquality and benchmarkingâ€ product lines.",
      "Differentiated enterprise features: cohort intelligence, not generic dashboards.",
      "A partner roadmap that compounds as FIâ€™s surfaces and rule sets mature.",
    ],
    ecosystem: [
      { label: "FI", detail: "Core APIs, events, tenant controls, and benchmark engine." },
      { label: "HairAudit", detail: "Reference application and workflow patterns for surgical audit." },
      { label: "HLI / IIOHR", detail: "Optional pathways when your stack serves biology or standards programs." },
    ],
    ctaLabel: "Partner technical scoping",
    ctaHref: "/contact?intent=partnership",
  },
  {
    icon: TrendingUp,
    title: "Investors and strategic partners",
    hook: "Category infrastructure with compounding signalâ€”not a single-feature SaaS bet.",
    pains: [
      "Healthcare investors need to see why quality data compounds and why incumbents cannot replicate it overnight.",
      "Strategic acquirers need clarity on integration surface area and expansion discipline.",
      "Narratives built only on â€œAIâ€ collapse under diligence; workflow and standards depth do not.",
    ],
    howFiHelps:
      "FI sits at the intersection of evidence (HairAudit), biology over time (HLI), and professional methodology (IIOHR). That multi-surface integration increases switching costs as cohorts deepen and governance workflows embed. Hair remains the live wedge; architecture is modular for adjacent procedural categories when evidence patterns justify expansion.",
    outcomes: [
      "A diligence-friendly story: proprietary cohorts, review depth, and integration moats.",
      "Clear expansion thesis: same engine, new vertical adaptersâ€”disciplined, not scattershot.",
      "Alignment with institutions and enterprises that validate long revenue cycles.",
    ],
    ecosystem: [
      { label: "FI", detail: "Central intelligence, benchmarks, and governance substrate." },
      { label: "HairAudit + HLI + IIOHR", detail: "Three demand-side surfaces feeding compounding signal." },
    ],
    ctaLabel: "Strategic briefing",
    ctaHref: "/contact?intent=partnership",
  },
];

const DEPLOYMENT_BY_BUYER: {
  buyer: string;
  commercial: string;
  integration: string;
  governance: string;
}[] = [
  {
    buyer: "Surgeon / small practice",
    commercial: "Single-tenant or small-team license; evidence-first rollout.",
    integration: "HairAudit-forward intake; light EHR adjacency as needed.",
    governance: "Local review, optional peer cohorts; minimal cross-entity policy.",
  },
  {
    buyer: "Clinic and brand",
    commercial: "Site or brand tenant; optional white-label patient-facing surfaces.",
    integration: "Workflow integration for case capture; reporting exports to ops stack.",
    governance: "Role separation (clinical vs leadership), disclosure controls, audit trail.",
  },
  {
    buyer: "Group / network",
    commercial: "Enterprise agreement; volume and site tiers; centralized billing options.",
    integration: "Portfolio feeds, SSO, regional data boundaries by policy.",
    governance: "Central vs local escalation rules; portfolio dashboards and exception routing.",
  },
  {
    buyer: "Standards / institute",
    commercial: "Program or consortium packaging; member onboarding playbooks.",
    integration: "Exports and APIs for member systems; committee-friendly reporting.",
    governance: "Methodology versioning, adjudication records, institutional review paths.",
  },
  {
    buyer: "Platform partner",
    commercial: "API or embedded OEM; rev-share or usage-based by agreement.",
    integration: "Deep product embedding; webhooks and batch; sandbox for co-development.",
    governance: "Tenant isolation; partner-defined policy hooks; optional FI review templates.",
  },
  {
    buyer: "Strategic / investor",
    commercial: "Structured briefings; diligence data room; long-cycle partnership tracks.",
    integration: "Roadmap visibilityâ€”not custom code for every question.",
    governance: "Transparency on cohort depth, standards relationships, and expansion criteria.",
  },
];

const REPLACEMENT_MOAT = [
  {
    title: "Multi-surface evidence",
    body: "Hair restoration quality is not only surgical. FI is built to compound signal across HairAudit evidence, HLI longitudinal biology where connected, and IIOHR methodologyâ€”so switching means rebuilding integrations across all three, not swapping a model API.",
  },
  {
    title: "Cohort and benchmark depth",
    body: "Standing is only as good as denominators and definitions. Versioned cohort rules, historical baselines, and governance events accumulate in-systemâ€”assets that generic analytics layers do not inherit overnight.",
  },
  {
    title: "Workflow and review embedding",
    body: "Scores without queues become shelf-ware. FI couples intelligence to review states, assignees, and disclosure separationâ€”how enterprises actually run risk-controlled quality programs.",
  },
  {
    title: "Standards adjacency",
    body: "IIOHR-aligned methodology gives institutional programs a credible frame. That relationship is not replicated by a horizontal BI tool or a one-off consulting engagement.",
  },
];

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="Map the buyer. Deploy the layer. Keep the architecture."
        subtitle="Buying Follicle Intelligence is not choosing a point toolâ€”it is choosing how surgical evidence, longitudinal biology, and professional standards connect inside your operating model. Below: who we serve, what breaks for them, what changes when FI is in place, and how deployment and defensibility differ by motionâ€”not a repeat of the homepage narrative, but the commercial translation."
      />

      <Section>
        <FadeIn>
          <SectionIntro
            eyebrow="Buyer segments"
            title="Six ways organizations enter the same infrastructure."
            description="Pain is different; the engine is shared. Each profile below is written for procurement, clinical leadership, and boards: what hurts, what FI does, what you can credibly claim after adoption, and which ecosystem surfaces matter most in your first year."
          />
        </FadeIn>

        <div className="mt-12 space-y-12 md:space-y-16">
          {BUYER_SEGMENTS.map((seg, i) => (
            <FadeIn key={seg.title} delay={0.04 * i}>
              <article className="rounded-[1.5rem] border border-border/70 bg-card/40 p-6 md:p-8 lg:p-10">
                <div className="flex flex-col gap-4 border-b border-border/50 pb-6 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                      <seg.icon className="h-6 w-6 text-primary/90" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground md:text-2xl">{seg.title}</h2>
                      <p className="mt-2 text-sm font-medium text-primary/90 md:text-base">{seg.hook}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0 rounded-xl">
                    <Link href={seg.ctaHref}>{seg.ctaLabel}</Link>
                  </Button>
                </div>

                <div className="mt-8 grid gap-8 lg:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Pain points
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                      {seg.pains.map((p) => (
                        <li key={p} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Outcomes unlocked
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                      {seg.outcomes.map((o) => (
                        <li key={o} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-400/70" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <p className="mt-8 text-sm leading-relaxed text-muted-foreground md:text-base">
                  <span className="font-medium text-foreground">How Follicle Intelligence helps. </span>
                  {seg.howFiHelps}
                </p>

                <div className="mt-8 rounded-xl border border-border/60 bg-background/50 p-5 md:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/85">
                    Ecosystem emphasis
                  </p>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    {seg.ecosystem.map((row) => (
                      <div key={row.label}>
                        <dt className="text-sm font-semibold text-foreground">{row.label}</dt>
                        <dd className="mt-1 text-sm text-muted-foreground">{row.detail}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Commercial mechanics"
            title="How deployment differs by buyer type."
            description="Same core; different packaging, integration depth, and governance expectations. Use this table in live conversations to set procurement expectationsâ€”not every buyer needs the same contract or the same first milestone."
          />
        </FadeIn>
        <FadeIn delay={0.06} className="mt-10 overflow-x-auto">
          <div className="min-w-[640px] rounded-[1.25rem] border border-border/70 bg-card/35">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-background/60">
                  <th className="px-4 py-3 font-semibold text-foreground md:px-5">Buyer motion</th>
                  <th className="px-4 py-3 font-semibold text-foreground md:px-5">Commercial shape</th>
                  <th className="px-4 py-3 font-semibold text-foreground md:px-5">Integration</th>
                  <th className="px-4 py-3 font-semibold text-foreground md:px-5">Governance emphasis</th>
                </tr>
              </thead>
              <tbody>
                {DEPLOYMENT_BY_BUYER.map((row) => (
                  <tr key={row.buyer} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-4 align-top font-medium text-foreground md:px-5">{row.buyer}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground md:px-5">{row.commercial}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground md:px-5">{row.integration}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground md:px-5">{row.governance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Exact SKUs, SLAs, and security terms are set in contract. See{" "}
            <Link className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary" href="/licensing">
              licensing
            </Link>{" "}
            and{" "}
            <Link className="font-medium text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary" href="/integration">
              integration
            </Link>{" "}
            for technical and commercial primitives.
          </p>
        </FadeIn>
      </Section>

      <Section className="border-t border-border/50">
        <FadeIn>
          <SectionIntro
            eyebrow="Defensibility"
            title="Why this is hard to replace."
            description="Buyers should ask any vendor: what compounds in your system that a spreadsheet or a generic cloud AI cannot reproduce? Our answer is not a single modelâ€”it is the intersection of evidence, cohort discipline, governance workflow, and standards relationships built for this category."
          />
        </FadeIn>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {REPLACEMENT_MOAT.map((item, i) => (
            <FadeIn key={item.title} delay={0.05 * i}>
              <div className="h-full rounded-[1.35rem] border border-border/70 bg-card/45 p-6 md:p-7">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border/50 pb-4">
        <FadeIn>
          <div className="fi-panel rounded-[1.75rem] p-8 md:p-10">
            <h2 className="text-xl font-semibold text-foreground md:text-2xl">Next conversation</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Tell us which row matches your organizationâ€”we will route the right demo, security packet, and
              commercial path. For portfolio and platform deals, expect a joint session across solution design
              and integration architecture.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="rounded-xl">
                <Link href="/contact?intent=demo">Book enterprise demo</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/contact?intent=white-label">White-label discussion</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/contact?intent=institution">Institutional program</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-xl">
                <Link href="/dashboard-demo">Dashboard walkthrough</Link>
              </Button>
            </div>
            <EcosystemMention className="mt-10 border-t border-border/50 pt-8" />
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

/**
 * Long-form copy and structure for `/audit-network` — AuditOS and HairAudit positioning.
 * Edit here to update marketing content without touching layout code.
 */

export const AUDIT_NETWORK_PAGE_METADATA = {
  title: "AuditOS & HairAudit — Independent Outcome Verification For Hair Restoration | Follicle Intelligence",
  description:
    "AuditOS connects clinical evidence, surgical records, patient images, outcome review, quality scoring, and benchmarking into one accountability layer—powered by HairAudit independent review for clinics, surgeons, and enterprise quality teams.",
} as const;

export const AUDIT_NETWORK_PAGE_CONTENT = {
  hero: {
    id: "audit-hero",
    eyebrow: "AuditOS",
    headline: "Independent Outcome Verification For Hair Restoration",
    subtext:
      "AuditOS connects clinical evidence, surgical records, patient images, outcome review, quality scoring, and benchmarking into one accountability layer powered by HairAudit.",
    primaryCta: { label: "Explore Platform", href: "/platform" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
  },

  problem: {
    id: "audit-problem",
    eyebrow: "Measurement",
    headline: "The industry cannot improve what it cannot measure.",
    cards: [
      {
        title: "Outcomes judged subjectively",
        body: "When quality lives in adjectives, organisations cannot compare teams fairly, prioritise training, or show improvement with the same rigour they expect in other medical disciplines.",
      },
      {
        title: "Before and after evidence is inconsistent",
        body: "Angles, lighting, timing, and capture protocols vary so widely that portfolios are hard to reconcile with what actually happened in the chart and on the schedule.",
      },
      {
        title: "Donor recovery is rarely tracked properly",
        body: "Donor stewardship depends on longitudinal capture. Sparse or uneven follow-up makes it difficult to discuss density, healing, or technique trade-offs with defensible context.",
      },
      {
        title: "Surgical quality varies between teams",
        body: "Technique, throughput, and documentation habits diverge by room. Without structured signals, variance becomes visible only after reputational damage or avoidable rework.",
      },
      {
        title: "Clinics lack independent verification",
        body: "Self-graded excellence is not the same as review-grade evidence. Leadership needs pathways that separate marketing narrative from what an independent framework can evaluate.",
      },
      {
        title: "Patients lack transparent outcome data",
        body: "People deserve clearer expectations grounded in evidence posture—not promises. Transparency starts with what the organisation is willing to capture, compare, and explain.",
      },
      {
        title: "Training feedback loops are weak",
        body: "When teaching is disconnected from outcome evidence, remediation becomes generic. Structured review can support targeted coaching where governance allows it.",
      },
      {
        title: "Benchmarking standards are fragmented",
        body: "Networks compare sites using different denominators and definitions. Honest benchmarking requires shared structure—especially where evidence completeness varies by location.",
      },
    ],
  },

  hairAudit: {
    id: "audit-hair-audit",
    eyebrow: "Framework",
    headline: "Powered by HairAudit",
    paragraphs: [
      "HairAudit provides the independent review and evidence framework behind AuditOS, helping clinics, surgeons, and organisations move from opinion-based quality claims toward structured outcome review.",
      "The posture is deliberate: evidence first, comparability where the record supports it, and explicit humility where capture is incomplete—so dashboards do not pretend to replace clinical judgement.",
    ],
  },

  measures: {
    id: "audit-measures",
    eyebrow: "Evidence",
    headline: "Every procedure can become evidence.",
    cards: [
      {
        title: "Pre-operative baseline",
        body: "Documented starting point for planning conversations, consent context, and later comparison—aligned to your organisation's imaging and charting standards.",
      },
      {
        title: "Surgical planning record",
        body: "What was intended, estimated, and agreed before incision—so day-of execution can be reviewed against a stable reference, not memory.",
      },
      {
        title: "Procedure data",
        body: "Structured operative fields suitable for internal quality review and training debriefs, without turning the EMR into a billboard.",
      },
      {
        title: "Graft and hair counts",
        body: "Counts and distributions where your workflow captures them—useful for variance analysis when methodology is consistent across cases.",
      },
      {
        title: "Donor condition",
        body: "Donor assessment signals that can support donor stewardship conversations and long-term planning discipline.",
      },
      {
        title: "Healing progression",
        body: "Time-stamped follow-up imaging where protocols exist—so healing curves are discussable, not inferred from a single after photo.",
      },
      {
        title: "Follow-up imaging",
        body: "Scheduled capture windows that make longitudinal review possible, including honest gaps when patients do not return.",
      },
      {
        title: "Density outcome",
        body: "Outcome descriptors tied to capture quality and methodology—explicit about what can and cannot be inferred from the images on file.",
      },
      {
        title: "Patient satisfaction",
        body: "Structured feedback where your organisation chooses to collect it—complementary to clinical evidence, not a substitute for it.",
      },
      {
        title: "Long-term growth review",
        body: "Late-interval review checkpoints that respect how hair restoration outcomes mature—so early wins are not mistaken for final posture.",
      },
    ],
  },

  qualityIntel: {
    id: "audit-quality-intel",
    eyebrow: "Intelligence",
    headline: "From individual cases to network-level benchmarking.",
    paragraphs: [
      "As audit data grows, organisations can better understand patterns across surgeons, teams, clinics, techniques, and follow-up protocols—where evidence completeness allows.",
      "Network views can support portfolio governance: which sites need better capture discipline, which teams may benefit from targeted training, and where cohort comparisons are not yet defensible.",
      "Aggregated signals may help identify systemic gaps—imaging protocols, consent documentation, or post-operative follow-through—without claiming precision the underlying data cannot justify.",
    ],
  },

  useCases: {
    id: "audit-use-cases",
    eyebrow: "Stakeholders",
    headline: "Built for accountability at every level.",
    cards: [
      {
        title: "Independent surgeons",
        body: "A review-grade evidence thread that supports reputation under scrutiny—distinct from social proof, and aligned to how you already debrief complex cases.",
      },
      {
        title: "Clinic owners",
        body: "Operational visibility into capture posture, review backlog, and quality signals—so leadership conversations start from structure, not anecdotes.",
      },
      {
        title: "Multi-clinic groups",
        body: "Portfolio-level standards with room for local technique—while keeping denominators honest enough for executive review.",
      },
      {
        title: "Training organisations",
        body: "Feedback loops that can connect curriculum to outcome evidence where your programme design and permissions allow that linkage.",
      },
      {
        title: "Medical directors",
        body: "Governance-friendly summaries that trace claims back to case-level inputs—useful for supervision, remediation, and policy updates.",
      },
      {
        title: "Enterprise quality teams",
        body: "A shared accountability layer for audits, corrective actions, and benchmarking narratives that do not collapse when someone asks for the underlying record.",
      },
    ],
  },

  trust: {
    id: "audit-trust",
    eyebrow: "Posture",
    headline: "Trust is built through evidence.",
    paragraphs: [
      "In a field where visual results matter, evidence quality matters. AuditOS gives organisations a structured way to review outcomes, identify gaps, improve training, and build patient trust without relying only on marketing claims.",
    ],
  },

  finalCta: {
    id: "audit-final-cta",
    eyebrow: "Next step",
    headline: "Build quality control into the system.",
    primaryCta: { label: "Explore Platform", href: "/platform" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
  },
} as const;

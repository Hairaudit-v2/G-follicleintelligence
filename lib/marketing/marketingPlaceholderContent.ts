/**
 * Headlines and SEO for lightweight marketing placeholder routes.
 * Full narrative pages can replace these over time without changing URLs.
 */

export type MarketingPlaceholderComingNext = {
  title: string;
  body: string;
};

export const MARKETING_PLACEHOLDER_COPY = {
  surgeons: {
    path: "/surgeons",
    title: "Become A World-Class Hair Restoration Surgeon | Follicle Intelligence",
    description:
      "Structured training, procedural intelligence, surgical auditing, and performance benchmarking—inside one operating system.",
    headline: "Become A World-Class Hair Restoration Surgeon",
    comingNext: [
      {
        title: "Surgical intelligence cockpit",
        body: "Procedure metrics, donor intelligence, and team performance surfaced the way serious surgeons review cases—not as vanity dashboards.",
      },
      {
        title: "HairAudit-ready evidence posture",
        body: "How independent verification, scoring discipline, and cohort context strengthen reputation under real scrutiny.",
      },
      {
        title: "Training pathways & certification",
        body: "Doctor progression tied to the International Institute of Hair Restoration—aligned to evidence, not slide decks alone.",
      },
    ] satisfies MarketingPlaceholderComingNext[],
  },
  clinicOwners: {
    path: "/clinic-owners",
    title: "Build And Scale A High-Performance Hair Restoration Clinic | Follicle Intelligence",
    description:
      "Operating rhythm, intelligence layers, and governance built for hair restoration enterprises—not generic practice tooling.",
    headline: "Build And Scale A High-Performance Hair Restoration Clinic",
    comingNext: [
      {
        title: "Commercial + clinical spine",
        body: "How LeadFlowOS and ClinicOS keep acquisition, scheduling, and services coherent as volume grows.",
      },
      {
        title: "Quality you can govern",
        body: "Operational dashboards that stay honest about what is comparable—and what still needs better capture.",
      },
      {
        title: "Enterprise-ready rollout patterns",
        body: "What multi-site groups ask for first: separation of duties, reporting envelopes, and audit traceability.",
      },
    ] satisfies MarketingPlaceholderComingNext[],
  },
  academy: {
    path: "/academy",
    title: "Academy: Training Infrastructure For Hair Restoration | Follicle Intelligence",
    description:
      "Doctor, nurse, consultant, and technician pathways connected to evidence, standards, and measurable performance.",
    headline: "Training Infrastructure For The Modern Hair Restoration Workforce",
    comingNext: [
      {
        title: "International Institute of Hair Restoration alignment",
        body: "Public-facing programmes, certification gates, and CPD posture designed for institutional seriousness.",
      },
      {
        title: "Competency tied to live workflows",
        body: "Training signal that connects to case evidence—so remediation is targeted instead of generic.",
      },
      {
        title: "Partner & standards programmes",
        body: "How industry organisations can run certification networks without losing defensibility under review.",
      },
    ] satisfies MarketingPlaceholderComingNext[],
  },
  auditNetwork: {
    path: "/audit-network",
    title: "Audit Network: Independent Hair Restoration Verification | Follicle Intelligence",
    description:
      "HairAudit-powered scoring, cohort context, and review-grade outputs aligned to how serious operators prove quality.",
    headline: "Independent Outcome Verification For Hair Restoration",
    comingNext: [
      {
        title: "Independent review architecture",
        body: "How HairAudit reduces self-graded quality with review paths designed for accountability, not theatre.",
      },
      {
        title: "Benchmarking with honest denominators",
        body: "What makes cohort-relative standing credible—and what we refuse to pretend is comparable when it is not.",
      },
      {
        title: "Evidence packets for leadership",
        body: "Board-ready narratives where standing, risk, and remediation trace back to case-level inputs.",
      },
    ] satisfies MarketingPlaceholderComingNext[],
  },
  intelligence: {
    path: "/intelligence",
    title: "Intelligence: Predictive Hair Restoration Layer | Follicle Intelligence",
    description:
      "Longitudinal patient twin signal, diagnostics, and model-ready datasets that compound as the network deepens.",
    headline: "The Intelligence Layer Behind Predictive Hair Restoration",
    comingNext: [
      {
        title: "Structured capture first",
        body: "Why governance-grade datasets matter before ambitious models—and how FI encodes capture discipline.",
      },
      {
        title: "Future models, responsible posture",
        body: "As structured outcome data grows, future models may help clinicians better understand risk and response—bounded by evidence quality.",
      },
      {
        title: "Twin continuity across years",
        body: "How FoundationOS-style longitudinal timelines become the substrate serious research directions require.",
      },
    ] satisfies MarketingPlaceholderComingNext[],
  },
  demo: {
    path: "/demo",
    title: "Book Enterprise Demo | Follicle Intelligence",
    description:
      "Tell us about your organisation, regions, and deployment stage. We will route you to the right conversation—demo, procurement, or partnership.",
    headline: "Book Enterprise Demo",
    comingNext: [
      {
        title: "Deployment scoping",
        body: "Private tenancy, integrations, data boundaries, and governance expectations—aligned to how enterprise buyers actually contract.",
      },
      {
        title: "Clinical workflow depth",
        body: "Surgery, diagnostics, training, and audit surfaces—so procurement sees the full operating loop, not a feature list.",
      },
      {
        title: "Partnership & procurement paths",
        body: "Education networks, multi-site groups, and strategic partners routed to the right conversation without generic noise.",
      },
    ] satisfies MarketingPlaceholderComingNext[],
  },
} as const;

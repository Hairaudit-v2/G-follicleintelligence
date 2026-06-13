/**
 * Public marketing homepage copy and structured lists.
 * Edit this file to update https://follicleintelligence.ai/ content in one place.
 */

export type HomeOrbitModule = {
  label: string;
  subtitle: string;
};

export type HomeEcosystemModule = {
  name: string;
  description: string;
};

export type HomeAudienceCard = {
  headline: string;
  outcome: string;
  cta: { label: string; href: string };
};

export type HomeTrainingTrack = {
  title: string;
  detail: string;
};

export type HomeIntelligenceGroup = {
  title: string;
  items: readonly string[];
};

export const HOME_PAGE_CONTENT = {
  hero: {
    eyebrow: "Enterprise hair restoration infrastructure",
    headline: "The Operating System For The Future Of Hair Restoration",
    subheadline:
      "A unified substrate for acquisition, clinical depth, surgery, independent verification, workforce certification, and longitudinal outcome intelligence—built so serious operators can govern quality at scale.",
    primaryCta: { label: "Explore The Platform", href: "/platform" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
    supportingLine:
      "For independent surgeons, clinic builders, multi-site groups, education partners, and investors who believe the category deserves infrastructure—not another generic clinic stack.",
    orbitModules: [
      { label: "LeadFlowOS", subtitle: "Acquisition & pipeline" },
      { label: "ClinicOS", subtitle: "Operations spine" },
      { label: "HairIntel", subtitle: "Diagnostics & AI intake" },
      { label: "SurgeryOS", subtitle: "Planning & procedure day" },
      { label: "AuditOS", subtitle: "HairAudit layer" },
      { label: "AcademyOS", subtitle: "Certification & CPD" },
      { label: "AnalyticsOS", subtitle: "Performance intelligence" },
      { label: "FoundationOS", subtitle: "Patient twin & records" },
    ] satisfies HomeOrbitModule[],
    coreEyebrow: "Intelligence core",
    coreTitle: "Follicle Intelligence",
  },

  industryProblem: {
    id: "industry-problem",
    storyEyebrow: "The industry problem",
    headline: "Hair Restoration Has Scaled Faster Than Quality Control",
    subtext:
      "Demand is global; governance is local and uneven. Without shared evidence, longitudinal structure, and accountable review, quality becomes a narrative instead of a measurable standard.",
    cards: [
      "Limited procedural depth in training pathways",
      "Inconsistent outcomes across markets",
      "Weak operational oversight at scale",
      "Fragmented patient intelligence",
      "No defensible global benchmarking",
      "Thin long-term outcome signal",
      "Clinical governance that does not travel",
      "No single operating layer connecting the full journey",
    ],
    transition:
      "The category does not need another horizontal clinic tool. It needs an operating system that connects every layer of serious hair restoration.",
  },

  onePlatform: {
    id: "one-platform",
    storyEyebrow: "The operating system",
    headline: "One Platform. Every Layer Of Hair Restoration.",
    subtext:
      "Eight modules share one spine—structured patient intelligence, procedural evidence, and governance-ready reporting—so leadership sees the same truth across sites, teams, and time horizons.",
    architectureCaption: "Connected OS modules · single intelligence substrate",
    modules: [
      {
        name: "LeadFlowOS",
        description: "Acquisition, CRM, follow-up, and pipeline intelligence—before a patient ever enters the clinical spine.",
      },
      {
        name: "ClinicOS",
        description: "Scheduling, services, staff, and the operational rhythm that keeps high-volume hair programs coherent.",
      },
      {
        name: "HairIntel",
        description: "AI-assisted intake, diagnostics, blood intelligence, and treatment reasoning aligned to restoration workflows.",
      },
      {
        name: "SurgeryOS",
        description: "Surgical planning, donor intelligence, graft economics, and procedure-day orchestration built for the OR.",
      },
      {
        name: "AuditOS",
        description: "HairAudit-aligned verification, independent review, and quality scoring that makes excellence legible.",
      },
      {
        name: "AcademyOS",
        description: "Doctor, nurse, consultant, and technician pathways—anchored to the International Institute of Hair Restoration.",
      },
      {
        name: "AnalyticsOS",
        description: "Conversion, revenue, productivity, and cohort performance—without divorcing commercial signal from clinical truth.",
      },
      {
        name: "FoundationOS",
        description: "Patient records, digital twin continuity, and longitudinal timelines that survive handoffs across years.",
      },
    ] satisfies HomeEcosystemModule[],
  },

  patientJourney: {
    id: "patient-journey",
    storyEyebrow: "The full patient journey",
    headline: "From First Enquiry To Global Intelligence—One Continuous Pipeline",
    subtext:
      "Each stage emits structured signal the next stage can trust—so improvement compounds instead of resetting at every handoff.",
    steps: [
      "Patient enquiry",
      "AI qualification",
      "Consultation",
      "Diagnosis",
      "Blood analysis",
      "Treatment planning",
      "Surgical planning",
      "Procedure day",
      "Outcome tracking",
      "Follow-up",
      "Audit verification",
      "Global intelligence dataset",
    ] as const,
  },

  builtForOperators: {
    id: "built-for-operators",
    storyEyebrow: "Who it is for",
    headline: "Built For The People Who Run Hair Restoration At Serious Scale",
    audiences: [
      {
        headline: "Surgeons",
        outcome: "Sharper preparation, measurable technique signal, and audit-grade evidence that supports reputation under scrutiny—not vanity metrics.",
        cta: { label: "Surgeon pathway", href: "/surgeons" as const },
      },
      {
        headline: "Clinic Owners",
        outcome: "One operating layer for revenue, operations, and clinical coherence—so the business scales without the brand drifting.",
        cta: { label: "Owner playbook", href: "/clinic-owners" as const },
      },
      {
        headline: "Multi-Clinic Groups",
        outcome: "Portfolio governance with comparable signal across regions—standards that travel, exceptions that surface early.",
        cta: { label: "Enterprise deployments", href: "/enterprise" as const },
      },
      {
        headline: "Industry Organisations",
        outcome: "Training infrastructure and standards programs that connect to evidence—so certification reflects defensible practice, not attendance alone.",
        cta: { label: "Academy & partnerships", href: "/academy" as const },
      },
    ] satisfies HomeAudienceCard[],
  },

  training: {
    id: "training-infrastructure",
    storyEyebrow: "Workforce infrastructure",
    headline: "Training Is Operating Infrastructure—Not A Course Catalogue",
    subtext:
      "Certification, competency, and longitudinal performance belong in the same system as clinical work—so workforce quality compounds with case evidence.",
    poweredByLabel: "Standards & pathways anchored to",
    poweredBy: "International Institute of Hair Restoration",
    tracks: [
      {
        title: "Doctor certification",
        detail: "Structured progression with assessment gates tied to real clinical evidence—not checklist theatre.",
      },
      {
        title: "Nurse surgical training",
        detail: "OR-adjacent competencies aligned to how hair teams actually run procedure day.",
      },
      {
        title: "Hair consultant education",
        detail: "Consultation quality, consent depth, and expectation integrity as measurable professional skills.",
      },
      {
        title: "Technician competency",
        detail: "Role-specific standards with performance signal that leadership can review and remediate.",
      },
      {
        title: "Clinical assessment frameworks",
        detail: "Shared rubrics so reviewers, trainers, and operators speak one professional language.",
      },
      {
        title: "CPD tracking",
        detail: "Continuing education that connects to live workflows—not disconnected LMS credits.",
      },
      {
        title: "Performance-based accreditation",
        detail: "Accreditation that can tighten when signal weakens and expand when evidence supports it.",
      },
    ] satisfies HomeTrainingTrack[],
  },

  surgicalIntelligence: {
    id: "surgical-intelligence",
    storyEyebrow: "Surgical intelligence",
    headline: "Every Procedure Becomes Measurable Intelligence",
    intelligenceGroups: [
      {
        title: "Procedure metrics",
        items: ["Graft counts", "Hair counts", "Punch size", "Extraction speed", "Transection rate", "Procedure timelines"],
      },
      {
        title: "Donor intelligence",
        items: ["Donor quality", "Recipient density planning", "Donor recovery signal", "Follicle economics context"],
      },
      {
        title: "Team performance",
        items: ["Role throughput", "Handoff quality", "OR consistency", "Exception patterns"],
      },
      {
        title: "Clinical protocols",
        items: ["Implantation methods", "Medication protocols", "Pre- and post-op pathways"],
      },
      {
        title: "Outcome tracking",
        items: ["Healing progression", "12-month outcomes", "Patient-reported signal", "Audit-ready evidence packets"],
      },
    ] satisfies HomeIntelligenceGroup[],
    closing:
      "Purpose-built surgical intelligence captures variables general systems were never designed to hold—and connects them to governance, HairAudit verification, and longitudinal outcomes so improvement has a denominator.",
  },

  auditNetwork: {
    id: "audit-network",
    storyEyebrow: "Trust & accountability",
    headline: "HairAudit: Independent Review, Evidence, And Benchmark Discipline",
    subtext:
      "HairAudit exists as the accountability layer: independent review, disciplined scoring, outcome verification, and benchmarking that serious operators can stand behind under scrutiny.",
    poweredBy: "HairAudit",
    trustPillars: [
      { title: "Independent review", detail: "Review paths designed to reduce self-graded quality and narrative drift." },
      { title: "Quality scoring", detail: "Transparent scoring primitives so standing is legible—not a black box index." },
      { title: "Outcome verification", detail: "Evidence-linked outcomes that can support internal QA and cleared external disclosure where policy allows." },
      { title: "Evidence-based benchmarking", detail: "Cohort context with honest denominators—so comparison strengthens credibility instead of eroding it." },
    ],
    metrics: [
      "Graft survival analysis",
      "Density assessment",
      "Donor recovery scoring",
      "Hairline design scoring",
      "Patient satisfaction",
      "Complication monitoring",
      "Long-term growth assessment",
      "Global benchmarking",
    ],
    cta: { label: "Explore the audit network", href: "/audit-network" as const },
  },

  globalIntelligence: {
    id: "global-intelligence",
    storyEyebrow: "Global intelligence",
    headline: "Structured Signal That Makes The Entire Network Smarter—Responsibly",
    subtext:
      "As structured outcome data grows across participating programmes, cohorts deepen and comparisons become more informative. Follicle Intelligence is built to compound that signal with governance—not to confuse marketing reach with clinical truth.",
    futureFacingNote:
      "Today, the platform prioritises structured capture, reviewability, and transparent limitations. Predictive layers are a forward roadmap—not a promise that every model is production-ready for every jurisdiction tomorrow.",
    twinDataLabel: "Patient digital twin signal (examples)",
    twinDataPoints: [
      "Baseline imaging",
      "Trichoscopy",
      "Family history",
      "Blood analysis",
      "Treatment history",
      "Medication history",
      "PRP protocols",
      "Exosome history",
      "Surgical history",
      "Outcome progression",
      "Patient satisfaction",
      "Longitudinal health changes",
    ],
  },

  predictiveFuture: {
    id: "predictive-future",
    storyEyebrow: "Future-facing intelligence",
    headline: "A Dataset Built For The Next Decade Of Hair Restoration Science",
    intro:
      "As structured outcome data grows and review norms mature, future models may help clinicians better understand progression risk, donor economics, and long-term density—always bounded by evidence quality, jurisdiction, and clinical judgement.",
    modelsLabel: "Research directions (examples—not universal clinical guarantees)",
    models: [
      "Hair loss progression patterns",
      "Donor depletion risk context",
      "Medication response signal",
      "Surgical candidacy support",
      "Graft survival probability modelling",
      "Complication risk surfacing",
      "Long-term density forecasting (where data supports it)",
      "Biological ageing interactions",
    ],
    closing:
      "Ambition here is institutional: build the deepest defensible hair restoration intelligence substrate in the world—while staying medically responsible about what is proven today versus what becomes possible as data and methods mature.",
  },

  founder: {
    id: "founder-story",
    storyEyebrow: "Why it exists",
    headline: "Why This Operating System Had To Exist",
    pullQuote: "Built by people who have lived the industry.",
    body: `After decades inside hair restoration, one truth became impossible to ignore: the field was scaling faster than the systems designed to protect quality, accountability, and patient safety.

Follicle Intelligence exists to change that—not for a single operator, but as category infrastructure for the next generation of serious programmes.`,
  },

  finalCta: {
    id: "final-cta",
    headline: "The Future Of Hair Restoration Starts Now",
    subtext:
      "Whether you lead surgery, own clinics, run a multi-site group, represent an industry body, or invest behind accountable quality—this is the operating layer built to scale with evidence.",
    primaryCta: { label: "Book Enterprise Demo", href: "/demo" as const },
    secondaryCta: { label: "Explore The Platform", href: "/platform" as const },
  },

  /** Copy for the lazy-loaded global network diagram (matches loading placeholder). */
  networkDiagram: {
    heading: "How the ecosystem connects in production",
    description:
      "LeadFlowOS through AnalyticsOS share one spine: structured patient intelligence, procedural evidence, and governance-ready reporting—so enterprise operators see the same truth across sites, teams, and time horizons.",
    networkTitle: "Networked modules, one operating system",
    networkFooterCaption: "FOLLICLE INTELLIGENCE · GLOBAL INTELLIGENCE NETWORK",
  },
} as const;

export type HomePageContent = typeof HOME_PAGE_CONTENT;

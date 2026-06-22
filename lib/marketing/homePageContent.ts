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

export type HomeEcosystemLayer = {
  title: string;
  modules: readonly HomeEcosystemModule[];
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

/** Visual variant for the in-browser placeholder UI (swap for real screenshots via `screenshotSrc`). */
export type HomeProductShowcaseShell =
  | "clinic-calendar"
  | "crm-pipeline"
  | "patient-twin"
  | "consultation-workflow"
  | "surgical-planning"
  | "audit-report"
  | "academy-learning"
  | "metrics-dashboard";

export type HomeProductShowcaseCard = {
  id: string;
  name: string;
  description: string;
  shell: HomeProductShowcaseShell;
  /**
   * When set, replaces the placeholder shell with a static image from `/public`
   * (e.g. `/marketing/product-showcase/clinic-os.png` → file at `public/marketing/product-showcase/clinic-os.png`).
   */
  screenshotSrc?: string;
};

/** Homepage industry authority cards: optional `statSuffix` pairs with `headline` for numeric proof lines. */
export type HomeAuthorityCard = {
  id: string;
  /** Primary title; when `statSuffix` is set, `headline` is styled as the large numeric line. */
  headline: string;
  statSuffix?: string;
  label: string;
  copy: string;
};

export type HomeAuthorityFounderPanel = {
  eyebrow: string;
  headline: string;
  body: string;
  closingLine: string;
};

/** Homepage platform comparison: one row per capability across three columns. */
export type HomeComparisonRow = {
  capability: string;
  traditionalCrm: string;
  genericClinic: string;
  follicleIntelligence: string;
};

/** Future-facing infrastructure vision cards (careful, non-definitive language). */
export type HomeIntegrationAdoptionCard = {
  title: string;
  copy: string;
};

export type HomeEnterpriseInfrastructureCard = {
  title: string;
  description: string;
  bullets: readonly string[];
};

export type HomeIndustryInfrastructureColumn = {
  headline: string;
  items: readonly string[];
};

export type HomeConnectedEcosystemCard = {
  name: string;
  description: string;
  label: string;
};

export type HomeIntelligenceNetworkColumn = {
  title: string;
  tracks: readonly string[];
};

export type HomeIntelligenceNetworkCard = {
  title: string;
  description: string;
};

export type HomeClinicStageCard = {
  title: string;
  description: string;
};

export type HomeMoonshotPredictionCard = {
  headline: string;
  copy: string;
};

export type HomeMoonshotClosingBlock = {
  headline: string;
  body: string;
  finalLine: string;
};

export const HOME_PAGE_CONTENT = {
  hero: {
    eyebrow: "Enterprise hair restoration infrastructure",
    headline: "The Operating System for Global Hair Restoration",
    subheadline:
      "One connected operating system for acquisition, clinical workflow, surgical intelligence, workforce, finance, training, and outcomes.",
    primaryCta: { label: "Explore The Platform", href: "/platform" as const },
    secondaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
    supportingLine: "Built for modern hair restoration clinics.",
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

  clinicalEcosystem: {
    id: "clinical-ecosystem",
    storyEyebrow: "Complete ecosystem",
    headline: "Built Around The Entire Clinical Ecosystem",
    subtext:
      "From first enquiry to long-term outcomes—every part of the clinic in one platform.",
    modules: [
      { name: "LeadFlow", description: "Patient acquisition and conversion" },
      { name: "ReceptionOS", description: "Front desk and scheduling" },
      { name: "ConsultationOS", description: "Clinical consultation workflow" },
      { name: "SurgeryOS", description: "Procedure planning and surgical intelligence" },
      { name: "FinancialOS", description: "Revenue intelligence and finance" },
      { name: "WorkforceOS", description: "Staff management and SOP compliance" },
      { name: "PatientOS", description: "Patient communication and treatment journeys" },
      { name: "ImagingOS", description: "Clinical imaging and scalp mapping" },
      { name: "AuditOS", description: "Clinical auditing and outcome verification" },
      { name: "AcademyOS", description: "Training, certification, and competency" },
      { name: "AnalyticsOS", description: "Business intelligence and reporting" },
      { name: "ClinicOS", description: "Multi-location operational infrastructure" },
    ] satisfies readonly HomeEcosystemModule[],
  },

  industryProblem: {
    id: "industry-problem",
    storyEyebrow: "The industry problem",
    headline: "Hair Restoration Has Scaled Faster Than Quality Control",
    subtext:
      "Demand is global; quality control is local and uneven. Without shared evidence and accountable review, outcomes become narrative instead of measurable clinical standard.",
    cards: [
      "Limited procedural depth in training pathways",
      "Inconsistent outcomes across markets",
      "Weak operational oversight at scale",
      "Fragmented patient intelligence",
      "No defensible global benchmarking",
      "Thin long-term outcome signal",
      "Clinical governance that does not travel",
      "No single system connecting the full patient journey",
    ],
    transition:
      "The industry does not need another generic software stack. It needs one connected operating system built for serious hair restoration.",
  },

  enterpriseInfrastructure: {
    id: "enterprise-infrastructure",
    storyEyebrow: "Deployed infrastructure",
    headline: "Enterprise Infrastructure",
    subtext: "Five infrastructure layers powering modern hair restoration operations.",
    cards: [
      {
        title: "Clinical Intelligence",
        description: "Clinical systems designed to improve diagnosis and patient outcomes.",
        bullets: ["AI diagnostics", "Blood interpretation", "Trichology intelligence"],
      },
      {
        title: "Surgical Intelligence",
        description: "Surgical systems built for high-precision hair restoration.",
        bullets: ["Live graft counting", "Transection monitoring", "Procedure analytics"],
      },
      {
        title: "Financial Intelligence",
        description: "Financial systems built for visibility, forecasting, and operational growth.",
        bullets: ["Revenue forecasting", "Accounts receivable", "Executive dashboards"],
      },
      {
        title: "Workforce Intelligence",
        description: "Workforce systems for team performance and compliance.",
        bullets: ["Staff onboarding", "SOP compliance", "Readiness scoring"],
      },
      {
        title: "Outcome Intelligence",
        description: "Outcome verification for measurable clinical accountability.",
        bullets: ["HairAudit verification", "Growth tracking", "Long-term analytics"],
      },
    ] satisfies readonly HomeEnterpriseInfrastructureCard[],
  },

  clinicsAtEveryStage: {
    id: "clinics-at-every-stage",
    storyEyebrow: "For every clinic",
    headline: "Built For Clinics At Every Stage",
    subtext: "From a single site to a global network—standardized operations and clear visibility.",
    cards: [
      {
        title: "Growing Clinics",
        description: "Scale demand without operational chaos.",
      },
      {
        title: "Established Clinics",
        description: "Standardize teams, improve conversion, and optimize surgery.",
      },
      {
        title: "Enterprise Groups",
        description: "Multi-location infrastructure with connected intelligence.",
      },
    ] satisfies readonly HomeClinicStageCard[],
  },

  intelligenceNetwork: {
    id: "intelligence-network",
    storyEyebrow: "Intelligence network",
    headline: "The Intelligence Network",
    subtext:
      "Diagnostics, clinical workflow, surgical intelligence, and outcomes—one continuously learning ecosystem.",
    cards: [
      {
        title: "Clinical Intelligence",
        description: "Every patient from diagnosis through treatment planning.",
      },
      {
        title: "Surgical Intelligence",
        description: "Every procedure measured with purpose-built surgical systems.",
      },
      {
        title: "Outcome Intelligence",
        description: "Recovery, growth progression, and long-term results—continuously monitored.",
      },
    ] satisfies readonly HomeIntelligenceNetworkCard[],
  },

  investorPositioning: {
    id: "investor-positioning",
    headline: "We Are Building The Data Layer For The Future Of Hair Restoration Medicine",
    subheadline:
      "Every consultation, treatment, surgery, and patient outcome continuously improves intelligence across the entire ecosystem.",
    subheadline2:
      "Over time, this creates the world's most valuable structured dataset in hair restoration medicine.",
  },

  industrySoftwareGap: {
    id: "industry-software-gap",
    storyEyebrow: "The industry problem",
    headline: "Why Generic Systems Fail Hair Restoration Clinics",
    subtext:
      "Clinics run on fragmented tools never designed for this specialty.",
    currentProblems: {
      headline: "Disconnected Operational Systems",
      items: [
        "Generic CRM platforms",
        "Multiple disconnected calendars",
        "Spreadsheet-based surgery planning",
        "Manual patient communication",
        "Fragmented financial reporting",
        "No procedural intelligence layer",
      ],
    },
    modernNeeds: {
      headline: "What Modern Clinics Actually Need",
      items: [
        "Unified patient acquisition",
        "Clinical intelligence infrastructure",
        "Purpose-built surgical workflow",
        "Outcome measurement architecture",
        "Financial operating intelligence",
        "Longitudinal patient intelligence",
      ],
    },
    closingStatement: {
      line1: "No unified operating system currently exists for the global hair restoration industry.",
      line2: "Until now.",
    },
  },

  connectedIntelligenceEcosystem: {
    id: "connected-intelligence-ecosystem",
    storyEyebrow: "Connected ecosystem",
    headline: "A Connected Intelligence Ecosystem",
    subtext:
      "Four independent systems continuously learn together, creating the world's first connected intelligence infrastructure for hair restoration medicine.",
    cards: [
      {
        name: "Follicle Intelligence",
        description:
          "The operational infrastructure layer powering clinic workflow, surgery management, patient intelligence, workforce systems, and financial operations.",
        label: "Operational Infrastructure",
      },
      {
        name: "Hair Longevity Institute",
        description:
          "Advanced clinical diagnostic intelligence focused on hair loss analysis, blood interpretation, trichology systems, and treatment pathway optimization.",
        label: "Diagnostic Intelligence",
      },
      {
        name: "HairAudit",
        description:
          "Independent outcome verification infrastructure designed to measure surgical quality, benchmark results, and create accountability across procedural performance.",
        label: "Outcome Intelligence",
      },
      {
        name: "IIOHR",
        description:
          "Global education and certification infrastructure standardizing surgeon training, competency validation, staff development, and clinical accreditation.",
        label: "Training Intelligence",
      },
    ] satisfies readonly HomeConnectedEcosystemCard[],
    closingStatement: {
      line1: "Each system strengthens the intelligence capability of every other system.",
      line2: "This creates compounding enterprise value.",
    },
  },

  globalIntelligenceNetwork: {
    id: "global-intelligence-network",
    storyEyebrow: "Global intelligence network",
    headline: "Building The Global Hair Restoration Intelligence Network",
    subtext:
      "Every patient interaction contributes structured intelligence that improves decision making across the entire ecosystem.",
    columns: [
      {
        title: "Patient Intelligence",
        tracks: [
          "Baseline photography",
          "Trichoscopy imaging",
          "Medical history",
          "Family history",
          "Blood markers",
          "Medication history",
          "Treatment pathways",
        ],
      },
      {
        title: "Procedure Intelligence",
        tracks: [
          "Graft extraction metrics",
          "Hair-to-graft ratios",
          "Punch size analytics",
          "Implantation methodology",
          "Team performance data",
          "Procedure timing",
          "Transection analytics",
        ],
      },
      {
        title: "Outcome Intelligence",
        tracks: [
          "Growth progression",
          "Density measurements",
          "Donor recovery analysis",
          "Survival benchmarking",
          "Patient satisfaction scoring",
          "Long-term treatment response",
          "Comparative global outcomes",
        ],
      },
    ] satisfies readonly HomeIntelligenceNetworkColumn[],
    closingStatement: {
      line1: "Every clinical interaction becomes structured intelligence.",
      line2: "The intelligence improves with every patient.",
    },
  },

  hairRestorationDigitalTwin: {
    id: "hair-restoration-digital-twin",
    storyEyebrow: "Strategic moat",
    headline: "The Hair Restoration Digital Twin",
    subtext:
      "Every patient journey creates a continuously evolving intelligence model that learns across diagnostics, treatment, surgery, and long-term outcomes.",
    stages: [
      "Baseline",
      "Clinical Assessment",
      "Diagnostic Intelligence",
      "Treatment Planning",
      "Surgical Procedure",
      "Recovery Monitoring",
      "Outcome Measurement",
      "Longitudinal Progress Tracking",
    ] as const,
    closingStatement: {
      line1: "Over time, millions of patient journeys create the world's largest structured hair restoration dataset.",
      line2: "This intelligence becomes more valuable than the software itself.",
    },
  },

  worksWithExistingSoftware: {
    id: "works-with-existing-software",
    storyEyebrow: "Integration-first adoption",
    headline: "Works With Your Existing Software",
    body: "Follicle Intelligence is designed to integrate with the systems clinics already use.",
    principles: [
      "No forced migration.",
      "No operational disruption.",
      "Connect first. Transition at your own pace.",
    ] as const,
    supportingCopy:
      "Start by connecting your existing CRM, booking, payments, calendar, communication, and patient record systems. Follicle Intelligence creates an intelligence layer above your current infrastructure so clinics can unlock value immediately while keeping day-to-day workflows running.",
    integrationCaption: "Designed to connect with common clinic systems",
    integrationSystems: [
      "HubSpot",
      "Pabau",
      "Cliniko",
      "Timely",
      "Stripe",
      "Google Calendar",
      "Zapier",
      "EMR",
    ] as const,
    intelligenceLayerLabel: "Follicle Intelligence layer",
    cards: [
      {
        title: "Keep current workflows",
        copy:
          "Clinics can continue using the systems their teams already know while FI begins connecting operational, clinical, and commercial data.",
      },
      {
        title: "Connect before replacing",
        copy: "Integrate first with existing tools, then transition modules only when the clinic is ready.",
      },
      {
        title: "Reduce adoption risk",
        copy: "Avoid painful go-lives, forced migrations, and operational downtime.",
      },
      {
        title: "Build toward full OS adoption",
        copy:
          "As confidence grows, clinics can activate more FI modules across LeadFlow, ClinicOS, SurgeryOS, AuditOS, AcademyOS, and AnalyticsOS.",
      },
    ] satisfies HomeIntegrationAdoptionCard[],
  },

  globalHealthcareInfrastructure: {
    id: "global-healthcare-infrastructure",
    storyEyebrow: "Building global healthcare infrastructure",
    headline: "Built as living medical infrastructure",
    subtext:
      "Follicle Intelligence is building the world's first specialised intelligence infrastructure for hair restoration—connecting clinic operations, workforce systems, surgical intelligence, patient intelligence, and global clinical accreditation.",
    gridCaption: "Thirteen OS modules · live delivery status · single intelligence substrate",
    cta: { label: "View full platform progress", href: "/platform/progress" as const },
  },

  healthcareInfrastructureStack: {
    id: "healthcare-infrastructure-stack",
    storyEyebrow: "Ecosystem architecture",
    headline: "The Future Healthcare Infrastructure Stack",
    subtext:
      "Five infrastructure layers connect clinical operations, surgical intelligence, business systems, human infrastructure, and global intelligence — designed for multi-clinic deployment at enterprise scale.",
    caption: "Five layers · connected OS modules · governed intelligence substrate",
    secondaryCta: { label: "Explore ecosystem architecture", href: "/platform/ecosystem" as const },
    layers: [
      {
        title: "Layer 1 — Clinical Operations",
        modules: ["ReceptionOS", "ConsultationOS", "ClinicOS", "PatientOS"],
      },
      {
        title: "Layer 2 — Surgical Intelligence",
        modules: ["SurgeryOS", "ImagingOS", "AuditOS"],
      },
      {
        title: "Layer 3 — Business Infrastructure",
        modules: ["FinancialOS", "AnalyticsOS", "FoundationOS", "OnboardingOS"],
      },
      {
        title: "Layer 4 — Human Infrastructure",
        modules: ["WorkforceOS", "AcademyOS"],
      },
      {
        title: "Layer 5 — Global Intelligence Layer",
        modules: ["HairAudit", "IIOHR", "Clinical accreditation systems"],
      },
    ] as const,
  },

  engineeringCredibility: {
    id: "engineering-credibility",
    storyEyebrow: "Engineering culture",
    headline: "Built Like Infrastructure, Not Software",
    subtext:
      "Every module inside Follicle Intelligence is being developed as enterprise-grade healthcare infrastructure designed for global multi-clinic deployment.",
    metrics: [
      { label: "Overall FI ecosystem completion", value: "~74%" },
      { label: "FI OS core platform", value: "~86%" },
      { label: "Production infrastructure modules", value: "8" },
      { label: "Multi-tenant systems active", value: "11" },
      { label: "Operational workflows deployed", value: "40+" },
      { label: "Database migrations completed", value: "100+" },
      { label: "Internal tests passing", value: "240+" },
    ] as const,
    securityModel: [
      "Tenant isolated architecture",
      "Role based access control",
      "Audit event tracking",
      "Multi-clinic deployment ready",
    ] as const,
  },

  onePlatform: {
    id: "one-platform",
    storyEyebrow: "Enterprise architecture",
    headline: "One Infrastructure Layer. Every Layer Of Hair Restoration.",
    subtext:
      "Thirteen modules across four engines share one spine—structured patient intelligence, procedural evidence, and governance-ready reporting—so enterprise operators see the same truth across sites, teams, and time horizons.",
    architectureCaption: "Four engines · connected OS modules · single intelligence substrate",
    secondaryCta: { label: "View Ecosystem Architecture", href: "/platform/ecosystem" as const },
    layers: [
      {
        title: "Growth Engine",
        modules: [
          {
            name: "LeadFlow",
            description:
              "Acquisition, CRM, follow-up, and pipeline intelligence—before a patient ever enters the clinical spine.",
          },
          {
            name: "ConsultationOS",
            description:
              "Structured consultation forms, pathway launcher, quote acceptance, and conversion intelligence.",
          },
          {
            name: "PatientOS",
            description: "Longitudinal patient records, portal surfaces, and intelligence substrate for cohort learning.",
          },
        ],
      },
      {
        title: "Clinical Engine",
        modules: [
          {
            name: "ImagingOS",
            description: "Template-driven photography sessions, slot progress, and surgical-domain progression assessments.",
          },
          {
            name: "SurgeryOS",
            description: "Surgical planning, donor intelligence, graft economics, and procedure-day orchestration built for the OR.",
          },
          {
            name: "AuditOS",
            description: "HairAudit-aligned verification, independent review, and quality scoring that makes excellence legible.",
          },
        ],
      },
      {
        title: "Workforce Engine",
        modules: [
          {
            name: "WorkforceOS",
            description:
              "Healthcare workforce infrastructure, onboarding, compliance, readiness scoring, clinical rostering, and active staffing orchestration.",
          },
          {
            name: "AcademyOS",
            description: "Doctor, nurse, consultant, and technician pathways—anchored to the International Institute of Hair Restoration.",
          },
        ],
      },
      {
        title: "Enterprise Engine",
        modules: [
          {
            name: "FinancialOS",
            description:
              "Master ledger, surgery profitability, revenue attribution, accounts receivable, and executive forecasting.",
          },
          {
            name: "AnalyticsOS",
            description: "Conversion, productivity, and cohort analytics across reception, consultation, and financial surfaces.",
          },
          {
            name: "ClinicOS",
            description: "Scheduling, services, staff, and the operational rhythm that keeps high-volume hair programs coherent.",
          },
          {
            name: "OnboardingOS",
            description:
              "Enterprise clinic deployment engine — guided tenant provisioning, configuration templates, module activation planning, and sandbox onboarding environments.",
          },
        ],
      },
    ] satisfies readonly HomeEcosystemLayer[],
  },

  /**
   * Product depth: real screenshots can be dropped into `public/marketing/product-showcase/`
   * and wired per-card via `screenshotSrc` on each entry in `cards`.
   */
  productShowcase: {
    id: "product-showcase",
    storyEyebrow: "Operational depth",
    headline: "Built On Real Operational Infrastructure",
    subtext:
      "Follicle Intelligence is not a concept. Every layer is built around real clinical, operational, surgical, training, and outcome workflows.",
    previewDisclaimer:
      "Infrastructure previews are representative of the operational architecture and can be replaced with live screenshots as modules are finalised.",
    cards: [
      {
        id: "clinic-os",
        name: "ClinicOS",
        description: "Scheduling, appointments, staff availability, clinic operations.",
        shell: "clinic-calendar",
        // screenshotSrc: "/marketing/product-showcase/clinic-os.png",
      },
      {
        id: "leadflow-os",
        name: "LeadFlowOS",
        description: "Acquisition pipelines, tasks, follow-ups, and patient conversion intelligence.",
        shell: "crm-pipeline",
        // screenshotSrc: "/marketing/product-showcase/leadflow-os.png",
      },
      {
        id: "foundation-os",
        name: "PatientOS / FoundationOS",
        description: "Track every patient journey from consultation through long-term outcomes.",
        shell: "patient-twin",
        // screenshotSrc: "/marketing/product-showcase/foundation-os.png",
      },
      {
        id: "consultation-os",
        name: "ConsultationOS",
        description: "Clinical assessment, diagnosis, recommendations, quotes.",
        shell: "consultation-workflow",
        // screenshotSrc: "/marketing/product-showcase/consultation-os.png",
      },
      {
        id: "surgery-os",
        name: "SurgeryOS",
        description: "Surgical planning, graft tracking, procedure day intelligence.",
        shell: "surgical-planning",
        // screenshotSrc: "/marketing/product-showcase/surgery-os.png",
      },
      {
        id: "audit-os",
        name: "AuditOS",
        description: "HairAudit review, evidence capture, outcome verification.",
        shell: "audit-report",
        // screenshotSrc: "/marketing/product-showcase/audit-os.png",
      },
      {
        id: "academy-os",
        name: "AcademyOS",
        description: "Training, certification, competency tracking.",
        shell: "academy-learning",
        // screenshotSrc: "/marketing/product-showcase/academy-os.png",
      },
      {
        id: "analytics-os",
        name: "AnalyticsOS",
        description: "Revenue, conversion, productivity, outcome intelligence.",
        shell: "metrics-dashboard",
        // screenshotSrc: "/marketing/product-showcase/analytics-os.png",
      },
    ] satisfies HomeProductShowcaseCard[],
  },

  platformComparison: {
    id: "platform-comparison",
    storyEyebrow: "Category clarity",
    headline: "More Than Software. Industry Infrastructure.",
    subtext:
      "Generic systems optimise a single department. Follicle Intelligence connects acquisition, clinical depth, surgery, verification, workforce standards, and longitudinal intelligence in one governed substrate.",
    footnote:
      "The Follicle Intelligence column reflects one integrated operating system—not a patchwork of disconnected vendor modules.",
    columns: ["Traditional CRM", "Generic Clinic Software", "Follicle Intelligence"] as const,
    rows: [
      {
        capability: "Lead management",
        traditionalCrm: "Sales pipelines without restoration-specific clinical substrate.",
        genericClinic: "Enquiry logs and light CRM—weak linkage into medical truth.",
        follicleIntelligence: "LeadFlowOS with pipeline intelligence tied to consultation and clinical spine.",
      },
      {
        capability: "Scheduling",
        traditionalCrm: "Not built for OR density, rooms, or hair-program rhythm.",
        genericClinic: "Appointment grids—rarely procedure-day and resource orchestration.",
        follicleIntelligence: "ClinicOS scheduling aligned to services, staff, and high-volume hair workflows.",
      },
      {
        capability: "Patient records",
        traditionalCrm: "Contact records—not longitudinal restoration intelligence.",
        genericClinic: "Charts and attachments—often fragmented across tools.",
        follicleIntelligence: "FoundationOS: digital twin continuity and handoff-safe records across years.",
      },
      {
        capability: "Hair loss diagnostics",
        traditionalCrm: "Not in scope.",
        genericClinic: "Basic notes or third-party bolt-ons.",
        follicleIntelligence: "HairIntel: structured classification, imaging context, and restoration-aligned reasoning.",
      },
      {
        capability: "Blood interpretation",
        traditionalCrm: "Not in scope.",
        genericClinic: "PDF uploads or generic lab flags.",
        follicleIntelligence: "Blood intelligence mapped to hair restoration treatment and monitoring workflows.",
      },
      {
        capability: "Surgical workflow management",
        traditionalCrm: "Not in scope.",
        genericClinic: "Peri-op checklists—thin on donor economics and OR orchestration.",
        follicleIntelligence: "SurgeryOS: planning, donor intelligence, graft economics, procedure-day command.",
      },
      {
        capability: "Procedure intelligence",
        traditionalCrm: "Not in scope.",
        genericClinic: "Billing codes or free-text—weak procedural variables.",
        follicleIntelligence: "Native surgical variables, team throughput, and evidence-grade procedure signal.",
      },
      {
        capability: "Outcome benchmarking",
        traditionalCrm: "Not in scope.",
        genericClinic: "Ad-hoc photos—limited cohort discipline.",
        follicleIntelligence: "Structured outcomes with honest denominators and governance-ready comparison context.",
      },
      {
        capability: "Independent auditing",
        traditionalCrm: "Not in scope.",
        genericClinic: "Internal QA only—hard to externalise credibly.",
        follicleIntelligence: "AuditOS / HairAudit-aligned review, scoring primitives, and verification packets.",
      },
      {
        capability: "Staff certification",
        traditionalCrm: "Not in scope.",
        genericClinic: "Disconnected LMS or vendor certificates.",
        follicleIntelligence: "AcademyOS pathways anchored to IIHR with competency tied to live clinical evidence.",
      },
      {
        capability: "Global intelligence dataset",
        traditionalCrm: "Not in scope.",
        genericClinic: "Siloed per clinic—no network learning substrate.",
        follicleIntelligence: "Governed structured signal designed to compound responsibly across programmes.",
      },
      {
        capability: "Predictive intelligence",
        traditionalCrm: "Generic sales forecasting only.",
        genericClinic: "Rarely connected to longitudinal clinical evidence.",
        follicleIntelligence: "Forward roadmap grounded in structured capture—bounded by evidence quality and policy.",
      },
    ] satisfies HomeComparisonRow[],
  },

  patientJourney: {
    id: "patient-journey",
    storyEyebrow: "The full patient journey",
    headline: "From First Enquiry To Global Intelligence—One Continuous Pipeline",
    subtext:
      "Each stage feeds the next—so improvement compounds instead of resetting at every handoff.",
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
    headline: "Built For The People Who Run Hair Restoration At Scale",
    audiences: [
      {
        headline: "Surgeons",
        outcome: "Sharper preparation, measurable technique signal, and audit-grade evidence that supports reputation under scrutiny—not vanity metrics.",
        cta: { label: "Surgeon pathway", href: "/surgeons" as const },
      },
      {
        headline: "Clinic Owners",
        outcome: "One operating system for revenue, operations, and clinical coherence—so the business scales without the brand drifting.",
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
      "Certification, competency, and team performance belong in the same system as clinical work—so quality improves with every case.",
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
      "Purpose-built surgical intelligence captures what general systems cannot—and connects it to HairAudit verification and long-term outcomes.",
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
      "As outcome data grows across participating clinics, the platform becomes smarter with every patient—with governance, not marketing hype.",
    futureFacingNote:
      "Today, the operating system prioritises structured capture, reviewability, and transparent limitations. Predictive layers are a forward roadmap—not a promise that every model is production-ready for every jurisdiction tomorrow.",
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

  moonshot: {
    id: "future-infrastructure",
    storyEyebrow: "The future",
    headline: "The Future Of Hair Restoration Is Predictive",
    subtext:
      "As structured clinical and outcome data grows across the network, future intelligence models may help clinicians understand patterns that have never been visible before.",
    predictions: [
      {
        headline: "Treatment Response Prediction",
        copy: "Better understand which patients may respond differently to therapies such as finasteride, minoxidil, regenerative medicine, and combination treatment protocols.",
      },
      {
        headline: "Donor Preservation Intelligence",
        copy: "Identify extraction strategies that may improve long-term donor management and reduce the risk of unnecessary overharvesting.",
      },
      {
        headline: "Surgical Performance Benchmarking",
        copy: "Understand procedural patterns that may contribute to stronger graft survival, improved density outcomes, and greater long-term consistency.",
      },
      {
        headline: "Clinic Performance Intelligence",
        copy: "Identify operational systems, workflows, and team structures associated with consistently stronger patient outcomes.",
      },
      {
        headline: "Long-Term Hair Loss Forecasting",
        copy: "Better understand progression patterns, treatment durability, and future loss risk across different patient profiles.",
      },
      {
        headline: "Global Outcome Intelligence",
        copy: "As the network grows, clinicians may gain access to the largest structured intelligence layer ever created in hair restoration.",
      },
    ] satisfies HomeMoonshotPredictionCard[],
    closing: {
      headline: "Every Patient Makes The Entire Industry Smarter",
      body: "Hair restoration can evolve from isolated clinic decisions into a connected network where every consultation, procedure, audit, and outcome improves future care.",
      finalLine: "This is bigger than software. This is infrastructure for the future of the industry.",
    },
  },

  authority: {
    id: "authority-trust",
    storyEyebrow: "Industry authority",
    headline: "Built By Industry Experts Who Understand The Problem Firsthand",
    subtext:
      "Follicle Intelligence was built by professionals who have spent decades working inside hair restoration — across consultation, surgery, training, auditing, clinical governance, and patient outcomes.",
    cards: [
      {
        id: "industry-experience",
        headline: "30+",
        statSuffix: "years",
        label: "Industry experience",
        copy: "Built from decades of firsthand experience in trichology, surgical planning, clinic operations, and patient care.",
      },
      {
        id: "clinical-depth",
        headline: "Clinical depth",
        label: "Purpose-built infrastructure",
        copy: "Designed around the real workflows that determine outcomes in hair restoration — not adapted from horizontal healthcare systems.",
      },
      {
        id: "training-infrastructure",
        headline: "Training infrastructure",
        label: "Workforce development",
        copy: "Connected to doctor, nurse, consultant, and technician education pathways through the International Institute of Hair Restoration.",
      },
      {
        id: "audit-methodology",
        headline: "Audit methodology",
        label: "Outcome accountability",
        copy: "Linked to independent review, quality scoring, and evidence-based benchmarking through HairAudit.",
      },
      {
        id: "longitudinal-intelligence",
        headline: "Patient journey intelligence",
        label: "Patient twin foundation",
        copy: "Structured to learn from patient journeys, treatment response, procedure history, and long-term outcomes.",
      },
      {
        id: "global-ambition",
        headline: "Global ambition",
        label: "Industry standardisation",
        copy: "Built to support clinics, surgeons, educators, and multi-clinic groups scaling with quality control.",
      },
    ] satisfies HomeAuthorityCard[],
    founderPanel: {
      eyebrow: "Founder authority",
      headline: "Built by people who have lived the industry.",
      body: "The strongest systems are built by people who understand where the existing ones break. Follicle Intelligence was created from years of observing the same problem from every angle: clinical knowledge, operational systems, training standards, surgical execution, and patient outcomes were disconnected.",
      closingLine: "That is the gap this operating system was built to close.",
    },
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
    eyebrow: "Enterprise infrastructure",
    headline: "Building Infrastructure For The Future Of Hair Restoration",
    subtext: "Built for clinics today. Designed to power global hair restoration medicine.",
    primaryCta: { label: "Explore The Platform", href: "/platform" as const },
    secondaryCta: { label: "Request Enterprise Access", href: "/demo" as const },
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

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
      "Run enquiries, consultations, surgery planning, patient records, staff management, payments, and clinical outcomes from one connected operating system built specifically for modern hair restoration clinics.",
    primaryCta: { label: "Explore The Platform", href: "/platform" as const },
    secondaryCta: { label: "View Platform Progress", href: "/platform/progress" as const },
    supportingLine:
      "Built for clinics today. Designed for the future of global hair restoration medicine.",
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
    subtext: "From first enquiry to long-term outcomes—every part of the clinic in one platform.",
    modules: [
      {
        name: "LeadFlow",
        description:
          "Capture enquiries faster, automate follow-up, and convert more consultations into procedures.",
      },
      {
        name: "ReceptionOS",
        description:
          "Manage appointments, front desk workflow, staff availability, and clinic scheduling from one place.",
      },
      {
        name: "ConsultationOS",
        description:
          "Standardize consultations, treatment plans, recommendations, quotes, and patient handovers.",
      },
      {
        name: "SurgeryOS",
        description:
          "Plan procedures, coordinate surgical teams, track grafts, and improve procedure quality.",
      },
      {
        name: "FinancialOS",
        description:
          "Track payments, revenue, outstanding balances, and clinic financial performance clearly.",
      },
      {
        name: "WorkforceOS",
        description:
          "Keep onboarding, training, SOPs, staff permissions, and compliance organized.",
      },
      {
        name: "PatientOS",
        description:
          "Manage patient journeys, communication, records, treatment history, and long-term care.",
      },
      {
        name: "ImagingOS",
        description:
          "Organize clinical photography, scalp imaging, treatment documentation, and visual progress tracking.",
      },
      {
        name: "AuditOS",
        description:
          "Track outcomes, review procedures, measure quality, and improve patient accountability.",
      },
      {
        name: "AcademyOS",
        description:
          "Train surgeons, certify teams, and maintain competency standards across the clinic.",
      },
      {
        name: "AnalyticsOS",
        description:
          "Understand conversion rates, productivity, financial trends, and operational performance.",
      },
      {
        name: "ClinicOS",
        description:
          "Coordinate daily clinic operations, staff schedules, appointments, and operational workflow.",
      },
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
        description:
          "Improve diagnosis, treatment planning, and patient assessment using connected clinical systems.",
        bullets: ["AI diagnostics", "Blood interpretation", "Trichology intelligence"],
      },
      {
        title: "Surgical Intelligence",
        description:
          "Track procedures, improve graft quality, and create more consistent surgical outcomes.",
        bullets: ["Live graft counting", "Transection monitoring", "Procedure analytics"],
      },
      {
        title: "Financial Intelligence",
        description:
          "Monitor revenue, payments, forecasting, and business performance across the clinic.",
        bullets: ["Revenue forecasting", "Accounts receivable", "Executive dashboards"],
      },
      {
        title: "Workforce Intelligence",
        description: "Keep teams trained, compliant, credentialed, and operationally aligned.",
        bullets: ["Staff onboarding", "SOP compliance", "Readiness scoring"],
      },
      {
        title: "Outcome Intelligence",
        description: "Track long-term patient outcomes and continuously improve clinical quality.",
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
        description:
          "Manage growth without losing control of patient follow-up, operations, and team coordination.",
      },
      {
        title: "Established Clinics",
        description:
          "Improve consistency, optimize team performance, and standardize the patient journey.",
      },
      {
        title: "Enterprise Groups",
        description:
          "Manage multiple locations using connected systems, centralized reporting, and shared intelligence.",
      },
    ] satisfies readonly HomeClinicStageCard[],
  },

  intelligenceNetwork: {
    id: "intelligence-network",
    storyEyebrow: "Intelligence network",
    headline: "The Intelligence Network",
    subtext:
      "Diagnostics, clinical workflow, surgical intelligence, and outcomes—a connected system that improves with every patient and procedure.",
    cards: [
      {
        title: "Clinical Intelligence",
        description: "Every patient from diagnosis through treatment planning.",
      },
      {
        title: "Surgical Intelligence",
        description: "Every procedure tracked to improve quality and consistency over time.",
      },
      {
        title: "Outcome Intelligence",
        description: "Recovery, growth progression, and long-term results—monitored and reviewed.",
      },
    ] satisfies readonly HomeIntelligenceNetworkCard[],
  },

  investorPositioning: {
    id: "investor-positioning",
    headline: "We Are Building The Data Layer For The Future Of Hair Restoration Medicine",
    subheadline:
      "Every consultation, treatment, surgery, and patient outcome helps improve the way clinics diagnose, treat, operate, and deliver better long-term patient results.",
    subheadline2:
      "Over time, this creates the world's most valuable structured dataset in hair restoration medicine.",
  },

  industrySoftwareGap: {
    id: "industry-software-gap",
    storyEyebrow: "The industry problem",
    headline: "The Industry Has Outgrown Generic Software",
    subtext:
      "Most hair restoration clinics still rely on disconnected software, spreadsheets, manual systems, and fragmented workflows that create inefficiency across daily operations.",
    currentProblems: {
      headline: "Disconnected Operational Systems",
      items: [
        "Lost or poorly managed leads",
        "Manual patient follow-up",
        "Disconnected appointment systems",
        "Spreadsheet-based surgery planning",
        "Limited financial visibility",
        "No unified patient journey tracking",
      ],
    },
    modernNeeds: {
      headline: "What Modern Clinics Actually Need",
      items: [
        "Faster lead conversion",
        "Better team coordination",
        "Standardized consultations",
        "Structured surgical planning",
        "Better patient communication",
        "Full operational visibility",
      ],
    },
    closingStatement: {
      line1:
        "No unified operating system currently exists for the global hair restoration industry.",
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
      line1:
        "Over time, millions of patient journeys create the world's largest structured hair restoration dataset.",
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
        copy: "Clinics can continue using the systems their teams already know while FI begins connecting operational, clinical, and commercial data.",
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
        copy: "As confidence grows, clinics can activate more FI modules across LeadFlow, ClinicOS, SurgeryOS, AuditOS, AcademyOS, and AnalyticsOS.",
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
            description:
              "Longitudinal patient records, portal surfaces, and intelligence substrate for cohort learning.",
          },
        ],
      },
      {
        title: "Clinical Engine",
        modules: [
          {
            name: "ImagingOS",
            description:
              "Template-driven photography sessions, slot progress, and surgical-domain progression assessments.",
          },
          {
            name: "SurgeryOS",
            description:
              "Surgical planning, donor intelligence, graft economics, and procedure-day orchestration built for the OR.",
          },
          {
            name: "AuditOS",
            description:
              "HairAudit-aligned verification, independent review, and quality scoring that makes excellence legible.",
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
            description:
              "Doctor, nurse, consultant, and technician pathways—anchored to the International Institute of Hair Restoration.",
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
            description:
              "Conversion, productivity, and cohort analytics across reception, consultation, and financial surfaces.",
          },
          {
            name: "ClinicOS",
            description:
              "Scheduling, services, staff, and the operational rhythm that keeps high-volume hair programs coherent.",
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
        description:
          "Acquisition pipelines, tasks, follow-ups, and patient conversion intelligence.",
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
        follicleIntelligence:
          "LeadFlowOS with pipeline intelligence tied to consultation and clinical spine.",
      },
      {
        capability: "Scheduling",
        traditionalCrm: "Not built for OR density, rooms, or hair-program rhythm.",
        genericClinic: "Appointment grids—rarely procedure-day and resource orchestration.",
        follicleIntelligence:
          "ClinicOS scheduling aligned to services, staff, and high-volume hair workflows.",
      },
      {
        capability: "Patient records",
        traditionalCrm: "Contact records—not longitudinal restoration intelligence.",
        genericClinic: "Charts and attachments—often fragmented across tools.",
        follicleIntelligence:
          "FoundationOS: digital twin continuity and handoff-safe records across years.",
      },
      {
        capability: "Hair loss diagnostics",
        traditionalCrm: "Not in scope.",
        genericClinic: "Basic notes or third-party bolt-ons.",
        follicleIntelligence:
          "HairIntel: structured classification, imaging context, and restoration-aligned reasoning.",
      },
      {
        capability: "Blood interpretation",
        traditionalCrm: "Not in scope.",
        genericClinic: "PDF uploads or generic lab flags.",
        follicleIntelligence:
          "Blood intelligence mapped to hair restoration treatment and monitoring workflows.",
      },
      {
        capability: "Surgical workflow management",
        traditionalCrm: "Not in scope.",
        genericClinic: "Peri-op checklists—thin on donor economics and OR orchestration.",
        follicleIntelligence:
          "SurgeryOS: planning, donor intelligence, graft economics, procedure-day command.",
      },
      {
        capability: "Procedure intelligence",
        traditionalCrm: "Not in scope.",
        genericClinic: "Billing codes or free-text—weak procedural variables.",
        follicleIntelligence:
          "Native surgical variables, team throughput, and evidence-grade procedure signal.",
      },
      {
        capability: "Outcome benchmarking",
        traditionalCrm: "Not in scope.",
        genericClinic: "Ad-hoc photos—limited cohort discipline.",
        follicleIntelligence:
          "Structured outcomes with honest denominators and governance-ready comparison context.",
      },
      {
        capability: "Independent auditing",
        traditionalCrm: "Not in scope.",
        genericClinic: "Internal QA only—hard to externalise credibly.",
        follicleIntelligence:
          "AuditOS / HairAudit-aligned review, scoring primitives, and verification packets.",
      },
      {
        capability: "Staff certification",
        traditionalCrm: "Not in scope.",
        genericClinic: "Disconnected LMS or vendor certificates.",
        follicleIntelligence:
          "AcademyOS pathways anchored to IIHR with competency tied to live clinical evidence.",
      },
      {
        capability: "Global intelligence dataset",
        traditionalCrm: "Not in scope.",
        genericClinic: "Siloed per clinic—no network learning substrate.",
        follicleIntelligence:
          "Governed structured signal designed to compound responsibly across programmes.",
      },
      {
        capability: "Predictive intelligence",
        traditionalCrm: "Generic sales forecasting only.",
        genericClinic: "Rarely connected to longitudinal clinical evidence.",
        follicleIntelligence:
          "Forward roadmap grounded in structured capture—bounded by evidence quality and policy.",
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
        outcome:
          "Sharper preparation, measurable technique signal, and audit-grade evidence that supports reputation under scrutiny—not vanity metrics.",
        cta: { label: "Surgeon pathway", href: "/surgeons" as const },
      },
      {
        headline: "Clinic Owners",
        outcome:
          "One operating system for revenue, operations, and clinical coherence—so the business scales without the brand drifting.",
        cta: { label: "Owner playbook", href: "/clinic-owners" as const },
      },
      {
        headline: "Multi-Clinic Groups",
        outcome:
          "Portfolio governance with comparable signal across regions—standards that travel, exceptions that surface early.",
        cta: { label: "Enterprise deployments", href: "/enterprise" as const },
      },
      {
        headline: "Industry Organisations",
        outcome:
          "Training infrastructure and standards programs that connect to evidence—so certification reflects defensible practice, not attendance alone.",
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
        detail:
          "Structured progression with assessment gates tied to real clinical evidence—not checklist theatre.",
      },
      {
        title: "Nurse surgical training",
        detail: "OR-adjacent competencies aligned to how hair teams actually run procedure day.",
      },
      {
        title: "Hair consultant education",
        detail:
          "Consultation quality, consent depth, and expectation integrity as measurable professional skills.",
      },
      {
        title: "Technician competency",
        detail:
          "Role-specific standards with performance signal that leadership can review and remediate.",
      },
      {
        title: "Clinical assessment frameworks",
        detail:
          "Shared rubrics so reviewers, trainers, and operators speak one professional language.",
      },
      {
        title: "CPD tracking",
        detail:
          "Continuing education that connects to live workflows—not disconnected LMS credits.",
      },
      {
        title: "Performance-based accreditation",
        detail:
          "Accreditation that can tighten when signal weakens and expand when evidence supports it.",
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
        items: [
          "Graft counts",
          "Hair counts",
          "Punch size",
          "Extraction speed",
          "Transection rate",
          "Procedure timelines",
        ],
      },
      {
        title: "Donor intelligence",
        items: [
          "Donor quality",
          "Recipient density planning",
          "Donor recovery signal",
          "Follicle economics context",
        ],
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
        items: [
          "Healing progression",
          "12-month outcomes",
          "Patient-reported signal",
          "Audit-ready evidence packets",
        ],
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
      {
        title: "Independent review",
        detail: "Review paths designed to reduce self-graded quality and narrative drift.",
      },
      {
        title: "Quality scoring",
        detail: "Transparent scoring primitives so standing is legible—not a black box index.",
      },
      {
        title: "Outcome verification",
        detail:
          "Evidence-linked outcomes that can support internal QA and cleared external disclosure where policy allows.",
      },
      {
        title: "Evidence-based benchmarking",
        detail:
          "Cohort context with honest denominators—so comparison strengthens credibility instead of eroding it.",
      },
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
      finalLine:
        "This is bigger than software. This is infrastructure for the future of the industry.",
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
    subtext:
      "Built to help clinics run smarter today while creating the foundation for the future of hair restoration medicine.",
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

/** V5 homepage repositioning — clinic-owner focused, progress-page visual language. */
export type HomeV5MetricCard = {
  /** Omitted for statement-only metric cards (e.g. exclusivity positioning). */
  value?: string;
  label: string;
};

export type HomeV5FragmentationCard = {
  category: string;
  items: readonly string[];
};

export type HomeV5SystemCard = {
  name: string;
  description: string;
};

export type HomeV5CredibilityCard = {
  title: string;
  description: string;
};

export const HOME_V5_CONTENT = {
  hero: {
    id: "hero",
    eyebrow: "Hair restoration operating system",
    headline: "Every Hair Restoration Clinic Runs On Systems Built For Everyone Else",
    headlineLine2: "We Built One Specifically For You",
    subheadline:
      "Most clinics operate across disconnected software never designed for hair restoration medicine.",
    subheadline2:
      "Follicle Intelligence connects consultations, surgery, patient intelligence, staff training, outcomes, analytics, and clinical operations into one purpose-built operating system.",
    metrics: [
      { value: "20", label: "Interconnected Systems" },
      { value: "81%", label: "Platform Deployment" },
      { value: "8+", label: "Replacing Disconnected Clinic Tools" },
      { label: "Built Exclusively For Hair Restoration Medicine" },
    ] satisfies readonly HomeV5MetricCard[],
    primaryCta: { label: "Explore The Platform", href: "/#platform-systems" as const },
    secondaryCta: { label: "See How Clinics Operate On FI", href: "/#hidden-cost" as const },
  },

  fragmentation: {
    id: "fragmentation",
    eyebrow: "Operational reality",
    headline: "Your Clinic Is Probably Losing Revenue In Places You Cannot See",
    cards: [
      {
        category: "Lead Management",
        items: [
          "Enquiries not followed up quickly enough",
          "Potential patients lost before consultation",
        ],
      },
      {
        category: "Consultation Process",
        items: [
          "Manual workflows create inconsistency between consultants",
          "Reduced conversion opportunities",
        ],
      },
      {
        category: "Surgical Performance",
        items: [
          "No objective measurement of procedural quality",
          "No visibility into team performance",
        ],
      },
      {
        category: "Patient Journey",
        items: [
          "Photos, notes and treatment history scattered across systems",
          "No connected patient intelligence",
        ],
      },
      {
        category: "Staff Readiness",
        items: [
          "Difficult to know who is truly procedure-ready",
          "Training accountability often unclear",
        ],
      },
      {
        category: "Outcome Tracking",
        items: ["No long-term procedural benchmarking", "No measurable quality feedback loop"],
      },
    ] satisfies readonly HomeV5FragmentationCard[],
    closingStatement: "Operational inefficiency directly impacts clinic profitability",
    closingSubtext:
      "Small inefficiencies compound across every consultation, procedure and patient journey.",
  },

  hiddenCost: {
    id: "hidden-cost",
    eyebrow: "Revenue impact",
    headline: "The Hidden Cost Of Running Disconnected Systems",
    cascade: [
      "Missed patient follow-up",
      "Lower consultation conversion rates",
      "Reduced surgery bookings",
      "Inconsistent patient experience",
      "Poor long-term outcomes",
      "Reduced patient referrals",
      "Slower clinic growth",
    ] as const,
    closingStatement:
      "Disconnected operational systems quietly reduce clinic profitability every day.",
  },

  platformSystems: {
    id: "platform-systems",
    eyebrow: "Connected infrastructure",
    headline: "One Connected Platform Managing The Entire Clinic",
    systems: [
      { name: "LeadFlow", description: "Never lose another enquiry." },
      { name: "PatientOS", description: "Complete patient intelligence tracking." },
      { name: "ConsultationOS", description: "Standardised clinical consultation workflows." },
      { name: "SurgeryOS", description: "Track every procedure with surgical precision." },
      { name: "ImagingOS", description: "Clinical imaging, documentation, and AI capture." },
      { name: "WorkforceOS", description: "Know exactly which staff are surgery-ready." },
      { name: "AnalyticsOS", description: "See performance across every operational layer." },
      { name: "AuditOS", description: "Measure procedural quality and long-term outcomes." },
    ] satisfies readonly HomeV5SystemCard[],
  },

  differentiation: {
    id: "differentiation",
    eyebrow: "Category distinction",
    headline: "Traditional CRM Systems Stop Where Clinical Intelligence Begins",
    genericSoftware: {
      title: "Generic Clinic Software",
      items: [
        "Lead management",
        "Appointment booking",
        "Contact records",
        "Communication tracking",
        "Basic pipeline management",
      ],
    },
    follicleIntelligence: {
      title: "Follicle Intelligence",
      items: [
        "Lead management",
        "Clinical diagnostics",
        "Consultation intelligence",
        "Surgical intelligence",
        "Graft analytics",
        "Staff competency tracking",
        "Procedure quality scoring",
        "Outcome verification",
        "Longitudinal patient intelligence",
      ],
    },
    closingStatementLines: [
      "Generic Software Helps Run Clinics",
      "Follicle Intelligence Helps Clinics Perform Better",
    ] as const,
  },

  surgeryIntelligence: {
    id: "surgery-intelligence",
    eyebrow: "Surgical intelligence",
    headline: "The World's First Surgical Intelligence Engine Built For Hair Restoration Clinics",
    supportingCopy:
      "For the first time clinics can objectively measure procedural quality at the level where outcomes are actually created.",
    supportingPoints: [
      "Every extraction.",
      "Every graft.",
      "Every team member.",
      "Every surgical variable.",
      "Measured continuously.",
    ] as const,
    metrics: [
      "Grafts extracted",
      "Hair per graft ratio",
      "Punch size selection",
      "Extraction speed",
      "Transection rate",
      "Implantation speed",
      "Donor preservation score",
      "Recipient density planning",
      "Medication protocols",
      "Assistant performance comparison",
      "Team efficiency scoring",
      "Procedure benchmarking",
    ] as const,
    closingStatement: "Every Procedure Becomes Measurable",
  },

  outcomeIntelligence: {
    id: "outcome-intelligence",
    eyebrow: "Outcome intelligence",
    headline: "Know Which Procedures Actually Produce Better Outcomes",
    introCopy:
      "Most clinics perform procedures every day without truly understanding which variables produce better long-term patient outcomes.",
    capabilities: [
      "12 month growth scoring",
      "Density progression",
      "Donor recovery monitoring",
      "Hairline design scoring",
      "Patient satisfaction tracking",
      "Surgeon performance benchmarking",
      "Technique comparison analysis",
    ] as const,
    closingStatement:
      "The Clinics That Measure Outcomes Improve Faster Than The Clinics That Guess",
  },

  staffIntelligence: {
    id: "staff-intelligence",
    eyebrow: "Workforce intelligence",
    headline: "Build Better Teams Through Measurable Clinical Competency",
    introCopy:
      "High-performing clinics depend on high-performing teams. But most clinics have no objective system measuring workforce readiness, competency progression or procedural preparedness.",
    capabilities: [
      "Training assignments",
      "Certification management",
      "Clinical readiness scoring",
      "SOP completion",
      "Competency verification",
      "Role-based permissions",
      "Compliance monitoring",
    ] as const,
    closingStatement: "Better Teams Create Better Procedures",
  },

  credibility: {
    id: "built-inside-clinics",
    eyebrow: "Industry credibility",
    headline: "Built Inside Real Hair Restoration Clinics",
    cards: [
      {
        title: "Real Surgical Workflows",
        description: "Designed around actual procedure-day operational demands",
      },
      {
        title: "Real Consultation Processes",
        description: "Built around actual patient conversion pathways used in clinics",
      },
      {
        title: "Real Clinical Teams",
        description: "Created around surgeons, nurses, consultants and technicians",
      },
      {
        title: "Real Industry Expertise",
        description:
          "Built specifically for one medical specialty rather than adapted generic healthcare software",
      },
    ] satisfies readonly HomeV5CredibilityCard[],
    closingStatement:
      "This platform was not adapted for hair restoration clinics. It was built from inside them.",
  },

  futureVision: {
    id: "future-clinics",
    eyebrow: "The future",
    headline: "The Future Of High Performance Hair Restoration Clinics",
    bodyParagraphs: [
      "The most successful clinics in the future will not simply attract more patients.",
      "They will understand their operations better.",
      "They will measure procedures more precisely.",
      "They will train better teams.",
      "They will improve outcomes more consistently.",
      "And they will continuously learn from every patient interaction.",
    ] as const,
    footerLine: "Better systems create better clinics. Better clinics create better outcomes.",
  },
} as const;

export type HomeV5Content = typeof HOME_V5_CONTENT;

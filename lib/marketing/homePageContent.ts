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
  title: string;
  body: string;
};

export const HOME_PAGE_CONTENT = {
  hero: {
    eyebrow: "Enterprise hair restoration infrastructure",
    headline: "The Operating System For The Future Of Hair Restoration",
    subheadline:
      "From first contact through diagnosis, surgery, independent verification, training, and longitudinal outcome intelligence—a unified substrate built to govern every layer of modern hair restoration.",
    primaryCta: { label: "Explore The Platform", href: "/platform" as const },
    secondaryCta: { label: "Book Enterprise Demo", href: "/contact" as const },
    supportingLine:
      "Built for independent surgeons, clinical enterprises, educators, and global operators advancing the next generation of hair restoration.",
    orbitModules: [
      { label: "LeadFlowOS", subtitle: "CRM, capture & pipeline" },
      { label: "ClinicOS", subtitle: "Scheduling & clinical spine" },
      { label: "HairIntel", subtitle: "AI intake & diagnostics" },
      { label: "SurgeryOS", subtitle: "Planning & procedure day" },
      { label: "AuditOS", subtitle: "HairAudit & verification" },
      { label: "AcademyOS", subtitle: "Training & certification" },
      { label: "AnalyticsOS", subtitle: "BI & performance" },
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
      "Global demand is outpacing the governance, standards, and longitudinal systems required to protect quality, consistency, patient safety, and long-term clinical excellence.",
    cards: [
      "Limited procedural training",
      "Inconsistent outcomes",
      "Weak operational oversight",
      "Fragmented patient data",
      "No global benchmarking",
      "Poor long-term outcome tracking",
      "Limited clinical governance",
      "No unified intelligence network",
    ],
    transition: "The industry does not need another CRM. It needs a new operating system.",
  },

  onePlatform: {
    id: "one-platform",
    storyEyebrow: "The operating system",
    headline: "One Platform. Every Layer Of Hair Restoration.",
    subtext:
      "Follicle Intelligence unifies every critical function of a modern hair restoration enterprise—commercial, clinical, surgical, educational, and analytical—into one connected intelligence substrate.",
    modules: [
      {
        name: "LeadFlowOS",
        description: "CRM, lead capture, follow-ups, and pipeline intelligence.",
      },
      {
        name: "ClinicOS",
        description: "Scheduling, staff, services, and the clinical operations spine across sites.",
      },
      {
        name: "HairIntel",
        description: "AI intake, HLI diagnostics, blood review, and treatment intelligence.",
      },
      {
        name: "SurgeryOS",
        description: "Surgical planning, grafts, donor intelligence, and procedure day orchestration.",
      },
      {
        name: "AuditOS",
        description: "HairAudit, independent outcome verification, and quality scoring.",
      },
      {
        name: "AcademyOS",
        description: "Doctor, nurse, consultant, and technician training pathways.",
      },
      {
        name: "AnalyticsOS",
        description: "Business intelligence, conversion, revenue, and staff productivity.",
      },
      {
        name: "FoundationOS",
        description: "Patient records, patient twin continuity, and longitudinal timelines.",
      },
    ] satisfies HomeEcosystemModule[],
  },

  patientJourney: {
    id: "patient-journey",
    storyEyebrow: "The full patient journey",
    headline: "The Entire Patient Journey Connected In One System",
    subtext:
      "Every interaction becomes structured intelligence that improves future clinical decision-making.",
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
    ],
  },

  builtForOperators: {
    id: "built-for-operators",
    storyEyebrow: "Who it is for",
    headline: "Built For Every Business Shaping The Future Of Hair Restoration",
    audiences: [
      {
        title: "For Surgeons",
        body: "Become a world-class hair restoration surgeon through structured training, procedural intelligence, surgical auditing, and performance benchmarking.",
      },
      {
        title: "For Practice & Group Leaders",
        body: "Run the full hair restoration enterprise—sites, staff, services, and revenue—from one operating system designed for the category.",
      },
      {
        title: "For Multi-Clinic Groups",
        body: "Scale nationally and internationally while maintaining operational consistency, governance, and surgical quality.",
      },
      {
        title: "For Industry Organisations",
        body: "Build training systems, certification pathways, and global standards that improve outcomes across the industry.",
      },
    ] satisfies HomeAudienceCard[],
  },

  training: {
    id: "training-infrastructure",
    storyEyebrow: "The training layer",
    headline: "Better Training Creates Better Outcomes",
    subtext: "Education, certification, and clinical performance are finally connected.",
    poweredBy: "International Institute of Hair Restoration",
    tracks: [
      "Doctor certification",
      "Nurse surgical training",
      "Hair consultant education",
      "Technician competency",
      "Clinical assessment frameworks",
      "CPD tracking",
      "Performance-based accreditation",
    ],
  },

  surgicalIntelligence: {
    id: "surgical-intelligence",
    storyEyebrow: "Surgical intelligence",
    headline: "Every Procedure Becomes Measurable Intelligence",
    variables: [
      "Graft counts",
      "Hair counts",
      "Punch size",
      "Extraction speed",
      "Transection rate",
      "Donor quality",
      "Recipient density planning",
      "Team performance",
      "Medication protocols",
      "Implantation methods",
      "Procedure timelines",
      "Healing progression",
      "12-month outcomes",
    ],
    closing:
      "Purpose-built surgical intelligence captures variables general practice systems were never designed to observe—and ties them to governance, audit, and longitudinal outcomes.",
  },

  auditNetwork: {
    id: "audit-network",
    storyEyebrow: "Independent audit",
    headline: "The First Independent Audit Network In Hair Restoration",
    poweredBy: "HairAudit",
    metrics: [
      "Graft survival analysis",
      "Density assessment",
      "Donor recovery scoring",
      "Hairline design scoring",
      "Patient satisfaction",
      "Complication monitoring",
      "Long-term growth assessment",
      "Global benchmarking",
      "Independent verification",
    ],
  },

  globalIntelligence: {
    id: "global-intelligence",
    storyEyebrow: "Global intelligence",
    headline: "Every Patient Makes The Entire Industry Smarter",
    subtext:
      "Every patient interaction contributes to a continuously expanding intelligence network. Over time, the system learns from every outcome.",
    twinDataLabel: "Patient Digital Twin data",
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
    storyEyebrow: "Predictive future",
    headline: "Building The Largest Hair Restoration Intelligence Dataset In The World",
    modelsLabel: "Predictive model examples",
    models: [
      "Hair loss progression",
      "Donor depletion risk",
      "Medication response",
      "Surgical candidacy",
      "Graft survival probability",
      "Complication risk",
      "Long-term density forecasting",
      "Biological ageing impact",
    ],
  },

  founder: {
    id: "founder-story",
    storyEyebrow: "Why it exists",
    headline: "Built By People Who Have Lived The Industry",
    body: `After decades working inside hair restoration, one truth became impossible to ignore: the industry was scaling globally faster than the systems designed to ensure quality, accountability, and patient safety.

Follicle Intelligence was built to solve that problem—not for a single operator, but for the future of the entire industry.`,
  },

  finalCta: {
    id: "final-cta",
    headline: "The Future Of Hair Restoration Starts Now",
    subtext:
      "Whether you are an independent surgeon, practice operator, enterprise organisation, or global education provider, Follicle Intelligence was built to help you scale intelligently.",
    primaryCta: { label: "Book Enterprise Demo", href: "/contact" as const },
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

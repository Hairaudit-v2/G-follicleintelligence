/**
 * Public platform progress content for `/platform/progress`.
 * Status model follows FI-WEB-REFRESH-1A / public-messaging-standard.md.
 * Completion percentages are retained only as historical internal estimates — not shown on public UI.
 */

import { buildGoogleCalendarPlatformProgressModule } from "@/src/lib/googleCalendar/googleCalendarIntegrationProgress";
import { buildViePlatformProgressModule } from "@/src/lib/vie/viePlatformProgress";

/** Approved public status categories (FI-WEB-REFRESH-1A). */
export const PLATFORM_PROGRESS_STATUSES = [
  "Deployed",
  "Operational Pilot",
  "Advanced Build",
  "In Development",
  "Research and Future Development",
] as const;

export type PlatformProgressStatus = (typeof PLATFORM_PROGRESS_STATUSES)[number];

export type PlatformProgressModule = {
  id: string;
  name: string;
  /**
   * Historical internal estimate only (pre–1B registry).
   * Must not be shown on public progress UI.
   */
  completionPercent?: number;
  description: string;
  status: PlatformProgressStatus;
  /** Optional badge override — defaults to `status`. Prefer leaving unset. */
  statusLabel?: string;
  latestMilestone?: string;
  learnMoreHref?: string;
  /** Short evidence note for maintainers (not rendered publicly). */
  evidenceNote?: string;
};

export type PlatformProgressInfrastructureLayer = {
  id: string;
  name: string;
  tagline: string;
  capabilities: readonly string[];
};

export type PlatformProgressDeploymentMilestone = {
  id: string;
  date: string;
  title: string;
  tag: string;
};

export type PlatformProgressChangelogEntry = {
  id: string;
  date: string;
  tag: string;
  title: string;
  summary: string;
  modules: string[];
};

export type PlatformRecentRelease = {
  id: string;
  title: string;
  module: string;
  date: string;
};

export type FiEcosystemPlatformCompletion = {
  id: string;
  name: string;
  /** Historical internal estimate — admin/internal only. */
  completionPercent: number;
  description: string;
  href?: string;
  external?: boolean;
  status?: PlatformProgressStatus;
};

/**
 * Historical manual rollups retained for internal/admin reference only.
 * Do not surface these figures on public marketing pages (FI-WEB-REFRESH-1A Option B).
 */
export const FI_ECOSYSTEM_COMPLETION_SUMMARY = {
  overallEcosystemPercent: 78,
  fiOsCorePlatformPercent: 77,
  /** When these figures were last treated as current in the public registry. */
  retiredFromPublicUi: "2026-07-16",
  note: "Superseded by public status categories. Not a maintainable automated calculation.",
} as const;

/** Satellite platforms — status-first; % historical/admin only. */
export const FI_ECOSYSTEM_PLATFORM_COMPLETION: FiEcosystemPlatformCompletion[] = [
  {
    id: "workforce-os",
    name: "WorkforceOS",
    completionPercent: 85,
    status: "Operational Pilot",
    description:
      "Staffing readiness, roster operations, compliance monitoring, and workforce planning for hair restoration clinics.",
  },
  {
    id: "hairaudit",
    name: "HairAudit",
    completionPercent: 82,
    status: "Operational Pilot",
    description:
      "Independent surgical audit, evidence capture, quality scoring, and outcome verification.",
    href: "https://hairaudit.com",
    external: true,
  },
  {
    id: "iiohr",
    name: "IIOHR Infrastructure",
    completionPercent: 78,
    status: "Operational Pilot",
    description:
      "Training, certification, and institute-aligned workforce standards.",
    href: "https://iiohr.com",
    external: true,
  },
  {
    id: "hli",
    name: "Hair Longevity Institute",
    completionPercent: 71,
    status: "Advanced Build",
    description:
      "Diagnostics, treatment pathways, and longitudinal biology intelligence.",
    href: "https://hairlongevityinstitute.com",
    external: true,
  },
];

export const PLATFORM_PROGRESS_PAGE_CONTENT = {
  hero: {
    eyebrow: "Platform progress",
    headline: "How Follicle Intelligence is becoming the operating system for hair restoration clinics",
    subtext:
      "Follicle Intelligence is progressing from a connected product ecosystem into a unified operating system for hair restoration clinics — expanding operational workflow depth, connected patient intelligence, and deployment and migration maturity.",
    lastUpdated: "2026-07-16",
  },

  currentPosition: {
    id: "current-platform-position",
    eyebrow: "Where we are today",
    headline: "Current platform position",
    body: [
      "Follicle Intelligence is purpose-built for modern hair restoration clinics — connecting patient acquisition, clinical decision-making, surgery, imaging, outcomes, workforce and business performance in one longitudinal record.",
      "Core operational layers are already usable in defined scopes. Clinics can connect existing systems, adopt selected FI workflows, and transition in stages rather than replacing everything on day one.",
      "Progress is measured by real workflow depth, patient-record continuity, and controlled deployment — not by speculative completion percentages.",
    ] as const,
    dimensions: [
      {
        title: "Operational workflow depth",
        body: "Enquiry, scheduling, consultation, imaging, surgery and workforce workflows that reflect how clinics actually run.",
      },
      {
        title: "Connected patient intelligence",
        body: "Commercial, clinical, surgical and outcome history on one patient spine so teams share the same operational truth.",
      },
      {
        title: "Deployment and migration maturity",
        body: "Staged adoption, connector pathways, and controlled CRM transition designed to protect continuity.",
      },
    ] as const,
  },

  operationalSystems: {
    id: "operational-systems",
    eyebrow: "In use",
    headline: "Operational systems",
    intro:
      "Modules available for routine use within an approved deployment scope, or live in controlled clinical and operational pilots with continued validation.",
  },

  advancedBuild: {
    id: "advanced-build",
    eyebrow: "In progress",
    headline: "Advanced build",
    intro:
      "Core workflows exist and are undergoing integration, testing or deployment preparation. These capabilities are real engineering progress — not yet presented as fully deployed products.",
  },

  inDevelopment: {
    id: "in-development",
    eyebrow: "Under construction",
    headline: "In development",
    intro:
      "Actively designed or implemented surfaces that are not ready for operational claims.",
  },

  researchFuture: {
    id: "research-future",
    eyebrow: "Strategic horizon",
    headline: "Research and future development",
    intro:
      "Long-term intelligence network and research capabilities that remain part of the strategic vision — not operational products today.",
  },

  milestones: {
    id: "recent-milestones",
    eyebrow: "Verified progress",
    headline: "Recent verified milestones",
    intro:
      "Meaningful achievements that deepen workflow, intelligence or deployment maturity — written for clinic operators and strategic reviewers.",
  },

  adoption: {
    id: "adoption-pathway",
    eyebrow: "How clinics begin",
    headline: "Adoption pathway",
    intro:
      "You do not need to replace every system on day one. Follicle Intelligence is designed for progressive adoption that protects clinic continuity.",
    steps: [
      {
        title: "Connect existing systems",
        body: "Link selected tools — including CRM, calendar and operational systems — so FI can sit alongside current workflows.",
      },
      {
        title: "Begin with selected FI workflows",
        body: "Start where value is clearest: enquiry follow-up, scheduling, consultation structure, imaging, or surgery preparation.",
      },
      {
        title: "Transition in stages",
        body: "Move contacts, history and operational ownership into FI through verified stages — with preview, identity reconciliation and post-migration checks.",
      },
      {
        title: "Expand toward a unified operating system",
        body: "As confidence grows, activate more of the patient journey so commercial, clinical and outcome history stay connected.",
      },
    ] as const,
    clinicLine:
      "Connect, transition or replace — at a pace that protects clinic continuity.",
  },

  strategicDirection: {
    id: "strategic-direction",
    eyebrow: "Where this is going",
    headline: "Strategic direction",
    body: [
      "As clinics operate on connected commercial, clinical, surgical and outcome history, the platform becomes more valuable over time — for multi-site standardisation, accountable quality and long-term specialty intelligence.",
      "The long-term vision includes a continuously learning intelligence network for hair restoration medicine. That network is strategic direction, not a claim that every research capability is already an operational product.",
    ] as const,
    points: [
      "Vertical operating depth rather than a loose bundle of point tools",
      "Structured longitudinal patient data across the care journey",
      "A repeatable migration pathway into FI as primary operations",
      "Cross-module intelligence that compounds with use",
    ] as const,
  },

  hubspotMilestone: {
    id: "controlled-crm-migration",
    date: "2026-07",
    heading: "Controlled CRM migration and operational transition",
    summary:
      "FI now supports staged migration of clinic contact and lead data from HubSpot through a governed process that includes historical backup, migration preview, identity reconciliation, duplicate prevention and post-migration verification.",
    detail:
      "Clinics can connect HubSpot, coexist during adoption, transition selected records in verified stages, or make FI the primary system for CRM and clinic operations within the agreed deployment scope.",
  },

  ctas: {
    primary: { label: "Explore the Platform", href: "/platform" as const },
    secondary: {
      label: "Request a Platform and Migration Review",
      href: "/demo" as const,
    },
    tertiary: {
      label: "View the HubSpot Migration Pathway",
      href: "/migrate-from-hubspot" as const,
    },
  },

  closing: {
    eyebrow: "Next step",
    headline: "See how the operating system fits your clinic",
    body: "Whether you are evaluating operational fit, enterprise rollout or strategic partnership, start with the platform architecture — then discuss a transition path that matches your readiness.",
  },

  /** Homepage highlight section (if remounted) — status-first, no completion %. */
  homepage: {
    id: "platform-progress",
    eyebrow: "Platform progress",
    headline: "Operating system maturity in public view",
    description:
      "Connected systems across clinical, operational, intelligence and infrastructure layers — reported with honest deployment status.",
    moduleCountLabel: "systems tracked",
    descriptionClosing: "Public progress registry. No speculative completion percentages.",
    cta: { label: "View platform progress", href: "/platform/progress" },
    secondaryCta: { label: "See how the ecosystem connects", href: "/platform/ecosystem" },
    latestUpdate: {
      title: "Latest verified milestone",
      readFullLogLabel: "Read full progress page",
      readFullLogHref: "/platform/progress#recent-milestones",
    },
  },
} as const;

/** Featured modules for optional homepage highlight. */
export const PLATFORM_PROGRESS_HOMEPAGE_FEATURED_MODULE_IDS = [
  "leadflow",
  "clinic-os",
  "surgery-os",
] as const;

/** Public-safe verified milestones (no internal phase codes). */
export const PLATFORM_PROGRESS_VERIFIED_MILESTONES: PlatformProgressDeploymentMilestone[] = [
  {
    id: "controlled-crm-migration",
    date: "2026-07",
    tag: "LeadFlow · migration",
    title: "Controlled CRM migration and operational transition",
  },
  {
    id: "surgery-imaging-intelligence",
    date: "2026-07-05",
    tag: "SurgeryOS · ImagingOS",
    title: "Surgery imaging intelligence summary ready for operational review",
  },
  {
    id: "surgery-hairaudit-linkage",
    date: "2026-07-05",
    tag: "SurgeryOS · HairAudit",
    title: "Structured surgery-to-HairAudit linkage for outcome review",
  },
  {
    id: "workforce-predictive",
    date: "2026-07-01",
    tag: "WorkforceOS",
    title: "Workforce readiness and planning intelligence expanded",
  },
  {
    id: "calendar-settings",
    date: "2026-06-26",
    tag: "ClinicOS · calendar",
    title: "Calendar settings centre for clinic scheduling connectors",
  },
  {
    id: "visual-comparison",
    date: "2026-06-26",
    tag: "ImagingOS",
    title: "Longitudinal image comparison and alignment capabilities",
  },
  {
    id: "platform-event-backbone",
    date: "2026-06-25",
    tag: "Infrastructure",
    title: "Platform event backbone connecting module workflows",
  },
  {
    id: "field-permissions",
    date: "2026-06-24",
    tag: "Security",
    title: "Field-level permissions for sensitive clinical and commercial data",
  },
  {
    id: "hubspot-staged-import",
    date: "2026-06-22",
    tag: "OnboardingOS · LeadFlow",
    title: "Staged HubSpot import with preview and verification controls",
  },
  {
    id: "analytics-publisher",
    date: "2026-06-21",
    tag: "AnalyticsOS",
    title: "Analytics event publishing expanded across operational modules",
  },
];

/** @deprecated Prefer PLATFORM_PROGRESS_VERIFIED_MILESTONES for public UI. */
export const PLATFORM_PROGRESS_DEPLOYMENT_MILESTONES = PLATFORM_PROGRESS_VERIFIED_MILESTONES;

/** Manual module registry — status is the public maturity signal. */
export const PLATFORM_PROGRESS_MODULES: PlatformProgressModule[] = [
  {
    id: "foundation-os",
    name: "FoundationOS",
    completionPercent: 90,
    description:
      "Patient identity substrate, digital twin continuity, media timelines, and the cross-module spine that keeps longitudinal records coherent.",
    status: "Deployed",
    latestMilestone: "Patient Twin identity spine operational within approved deployments",
    learnMoreHref: "/patient-twin",
    evidenceNote: "Patient Twin routes, identity spine, cross-module event substrate in production codepaths.",
  },
  {
    id: "clinic-os",
    name: "ClinicOS",
    completionPercent: 91,
    description:
      "Calendars, services, appointment lifecycle and day-to-day clinic rhythm for operators — designed for multi-site groups as they standardise.",
    status: "Operational Pilot",
    latestMilestone: "Scheduling and clinic-day operations in controlled clinical use",
    learnMoreHref: "/platform/clinic-os",
    evidenceNote: "CalendarOS, bookings, clinic shell, multi-site scheduling; Evolved operational pilot docs.",
  },
  {
    id: "consultation-os",
    name: "ConsultationOS",
    completionPercent: 72,
    description:
      "Structured consultation forms, treatment pathway support, quotes and clinical handoff into the wider patient record.",
    status: "Advanced Build",
    latestMilestone: "Structured consultation and conversion pathway workflows in place",
    evidenceNote: "Consultation templates, pathway launcher, quote flows — integration and readiness still expanding.",
  },
  {
    id: "patient-os",
    name: "PatientOS",
    completionPercent: 81,
    description:
      "Longitudinal patient records, journey continuity and the operational chart clinicians and staff share across modules.",
    status: "Operational Pilot",
    latestMilestone: "Longitudinal records integrated with Patient Twin in pilot operations",
    learnMoreHref: "/platform/patient-os",
    evidenceNote: "Patient routes, twin linkage, portal surfaces in operational pilot scope.",
  },
  {
    id: "leadflow",
    name: "LeadFlow",
    completionPercent: 68,
    description:
      "Native enquiry, pipeline, assignment and follow-up workflows are active within FI. Controlled HubSpot migration and coexistence pathways are operational, while wider communication automation and reporting depth continue to expand.",
    status: "Operational Pilot",
    latestMilestone: "Native pipeline operations with controlled HubSpot transition pathways",
    learnMoreHref: "/platform/leadflow",
    evidenceNote:
      "fi-admin CRM/pipeline, lead ownership, HubSpot webhook + event drain, staged import, contact-lead pilots 1D/1E, e2e pipeline coverage.",
  },
  {
    id: "imaging-os",
    name: "ImagingOS",
    completionPercent: 88,
    description:
      "Standardised clinical photography, protocol-guided capture, comparison and longitudinal visual records for restoration programmes.",
    status: "Operational Pilot",
    latestMilestone: "Protocol capture and imaging intelligence in controlled operational use",
    learnMoreHref: "/platform/imaging-os",
    evidenceNote: "Imaging sessions, AI execution framework, surgery imaging summary linkage.",
  },
  buildViePlatformProgressModule(),
  {
    id: "surgery-os",
    name: "SurgeryOS",
    completionPercent: 84,
    description:
      "Procedure planning, day-of coordination, graft and team activity records, and continuity into outcome review.",
    status: "Advanced Build",
    latestMilestone: "Surgery imaging intelligence summary and HairAudit linkage in advanced readiness",
    learnMoreHref: "/platform/surgery-os",
    evidenceNote: "Surgery command surfaces, graft-tray chain, imaging summary — broader day-of deployment still expanding.",
  },
  {
    id: "hair-intel",
    name: "HairIntel",
    completionPercent: 79,
    description:
      "Clinical and diagnostic intelligence — classification, progression context and structured intake support for hair restoration decisions.",
    status: "Advanced Build",
    latestMilestone: "Multi-system classification and interpretation pipelines in advanced build",
    learnMoreHref: "/hair-intelligence",
    evidenceNote: "Classification engines and consultation support; not claimed as fully deployed AI product.",
  },
  {
    id: "audit-os",
    name: "AuditOS",
    completionPercent: 82,
    description:
      "Outcome measurement, procedure audit posture and HairAudit-aligned review surfaces for accountable quality.",
    status: "Operational Pilot",
    latestMilestone: "HairAudit patient exposure and surgery linkage in pilot operational scope",
    learnMoreHref: "/audit-network",
    evidenceNote: "AuditOS + HairAudit exposure layer and structured linkage; network depth continues.",
  },
  {
    id: "analytics-os",
    name: "AnalyticsOS",
    completionPercent: 81,
    description:
      "Commercial, operational and clinical performance intelligence built from structured platform events.",
    status: "Advanced Build",
    latestMilestone: "Analytics event publishing expanded across operational modules",
    learnMoreHref: "/platform/analytics-os",
    evidenceNote: "Event pipeline and publisher expansion; executive reporting still maturing.",
  },
  {
    id: "academy-os",
    name: "AcademyOS",
    completionPercent: 76,
    description:
      "Training pathways, competency tracking and institute-aligned development for clinical teams.",
    status: "Advanced Build",
    latestMilestone: "Competency curriculum spine in advanced build",
    learnMoreHref: "/academy",
    evidenceNote: "Academy pathways and IIOHR alignment; not full operational training OS claim.",
  },
  {
    id: "workforce-os",
    name: "WorkforceOS",
    completionPercent: 85,
    description:
      "Staff records, rostering, readiness scoring, compliance posture and workforce planning for restoration clinics.",
    status: "Operational Pilot",
    latestMilestone: "Workforce readiness and planning intelligence in controlled operational use",
    evidenceNote: "Roster, HR sync, readiness scoring, predictive planning shipped into pilot scope.",
  },
  {
    id: "onboarding-os",
    name: "OnboardingOS",
    completionPercent: 86,
    description:
      "Clinic deployment, provisioning templates and staged import tools that support controlled go-live and migration.",
    status: "Operational Pilot",
    latestMilestone: "Staged import and deployment tooling operational for controlled transitions",
    evidenceNote: "Staged HubSpot import engine, tenant provisioning, demo/seeding packs.",
  },
  buildGoogleCalendarPlatformProgressModule(),
  {
    id: "financial-os",
    name: "FinancialOS",
    completionPercent: 64,
    description:
      "Payments, revenue integrity, clearance pathways and executive finance views for hair restoration operations.",
    status: "In Development",
    latestMilestone: "Financial clearance and ledger foundations in active development",
    learnMoreHref: "/platform/progress#progress-financial-os",
    evidenceNote: "Phase-based financial architecture; not ready for full operational claims.",
  },
  {
    id: "security-layer",
    name: "Security Layer",
    completionPercent: 85,
    description:
      "Tenant isolation, role-based access, field-level permissions and secret validation across the platform substrate.",
    status: "Deployed",
    latestMilestone: "Field-level permissions and tenant isolation operational",
    evidenceNote: "RLS, field permissions, tenant isolation in production architecture.",
  },
  {
    id: "event-bus",
    name: "Event Bus",
    completionPercent: 92,
    description:
      "Event-driven backbone that lets modules publish and subscribe to operational and clinical signals without brittle coupling.",
    status: "Deployed",
    latestMilestone: "Platform event backbone released for cross-module workflows",
    evidenceNote: "Subscriber framework, retry, idempotency — infrastructure in use.",
  },
  {
    id: "integration-layer",
    name: "Integration Layer",
    completionPercent: 80,
    description:
      "Connector framework for calendars, CRM, practice tools and APIs — so clinics can connect before they fully transition.",
    status: "Operational Pilot",
    latestMilestone: "Enterprise connector authentication and verification pathways active",
    evidenceNote: "HubSpot, Google Calendar, connector auth/verification; live OAuth breadth still expanding.",
  },
  {
    id: "ai-intelligence-layer",
    name: "AI Intelligence Layer",
    completionPercent: 74,
    description:
      "Structured interpretation, classification and learning systems that improve as clinic data quality deepens.",
    status: "Advanced Build",
    latestMilestone: "Deterministic clinical interpretation pipelines in advanced build",
    evidenceNote: "Deterministic pipelines first; broader learning systems remain in build.",
  },
  {
    id: "global-intelligence-network",
    name: "Global Intelligence Network",
    description:
      "Strategic vision for network-scale outcome intelligence across clinics, training and audit — not an operational product surface today.",
    status: "Research and Future Development",
    latestMilestone: "Vision and architecture direction published; not a deployed network product",
    evidenceNote: "Messaging standard §6.8 — vision only.",
  },
];

export const PLATFORM_PROGRESS_INFRASTRUCTURE_LAYERS: PlatformProgressInfrastructureLayer[] = [
  {
    id: "event-bus",
    name: "Platform Event Bus",
    tagline: "Connected workflows without brittle coupling",
    capabilities: ["Event publishing", "Subscriber orchestration", "Retry and idempotency"],
  },
  {
    id: "security",
    name: "Security Architecture",
    tagline: "Tenant-safe by design",
    capabilities: [
      "Row-level security",
      "Tenant isolation",
      "Field-level permissions",
      "Secret validation",
    ],
  },
  {
    id: "integration",
    name: "Integration Framework",
    tagline: "Connect before you fully replace",
    capabilities: ["Google Calendar", "HubSpot", "Practice systems", "API connectors"],
  },
  {
    id: "ai-engine",
    name: "AI Intelligence Engine",
    tagline: "Structured interpretation first",
    capabilities: [
      "Hair loss classification",
      "Surgical benchmarking foundations",
      "Outcome learning pathways",
      "Pattern recognition research",
    ],
  },
];

export type PlatformSystemArchitectureGroup = {
  id: string;
  heading: string;
  description: string;
  moduleNames: readonly string[];
};

export type PlatformArchitectureStackLayer = {
  id: string;
  label: string;
  systems: readonly string[];
};

export type PlatformProgressMetric = {
  label: string;
  value: string;
};

/** @deprecated Infrastructure hide-% list — public UI no longer shows completion %. */
export const PLATFORM_INFRASTRUCTURE_CORE_SYSTEM_IDS = [
  "foundation-os",
  "security-layer",
  "event-bus",
  "integration-layer",
] as const;

export type PlatformInfrastructureCoreSystemId =
  (typeof PLATFORM_INFRASTRUCTURE_CORE_SYSTEM_IDS)[number];

/** @deprecated Prefer module.status on each registry row. */
export const PLATFORM_INFRASTRUCTURE_DEPLOYMENT_STATUS: Record<
  PlatformInfrastructureCoreSystemId,
  string
> = {
  "foundation-os": "Deployed",
  "security-layer": "Deployed",
  "event-bus": "Deployed",
  "integration-layer": "Operational Pilot",
};

/** Public metrics — status counts only (no completion percentages). */
export const PLATFORM_PROGRESS_METRICS: PlatformProgressMetric[] = [
  { label: "Systems tracked", value: "—" },
  { label: "Deployed", value: "—" },
  { label: "Operational pilot", value: "—" },
  { label: "Advanced build", value: "—" },
  { label: "In development", value: "—" },
  { label: "Research & future", value: "—" },
];

export const PLATFORM_ARCHITECTURE_STACK: PlatformArchitectureStackLayer[] = [
  {
    id: "acquisition",
    label: "Acquisition Layer",
    systems: ["LeadFlow", "External Integrations", "Referral Engine", "Communication Systems"],
  },
  {
    id: "patient",
    label: "Patient Layer",
    systems: ["ConsultationOS", "PatientOS", "ClinicOS", "Calendar"],
  },
  {
    id: "clinical",
    label: "Clinical Layer",
    systems: ["HairIntel", "ImagingOS", "VIE", "SurgeryOS"],
  },
  {
    id: "intelligence",
    label: "Intelligence Layer",
    systems: ["AuditOS", "AnalyticsOS", "AI Intelligence Engine"],
  },
  {
    id: "workforce",
    label: "Workforce Layer",
    systems: ["AcademyOS", "WorkforceOS"],
  },
  {
    id: "infrastructure",
    label: "Infrastructure Layer",
    systems: ["FoundationOS", "Security Layer", "Event Bus", "Integration Layer", "OnboardingOS"],
  },
];

export const PLATFORM_SYSTEM_ARCHITECTURE_GROUPS: PlatformSystemArchitectureGroup[] = [
  {
    id: "clinical",
    heading: "Clinical systems",
    description: "Direct care and clinical workflow surfaces.",
    moduleNames: ["ClinicOS", "ConsultationOS", "PatientOS", "ImagingOS", "SurgeryOS"],
  },
  {
    id: "intelligence",
    heading: "Intelligence systems",
    description: "Diagnostics, imaging intelligence, audit and analytics.",
    moduleNames: ["HairIntel", "VIE", "AuditOS", "AnalyticsOS", "AI Intelligence Layer"],
  },
  {
    id: "operational",
    heading: "Operational systems",
    description: "Acquisition, calendar, workforce, finance and deployment.",
    moduleNames: ["LeadFlow", "CalendarOS", "WorkforceOS", "FinancialOS", "OnboardingOS"],
  },
  {
    id: "infrastructure",
    heading: "Infrastructure systems",
    description: "Identity spine, security, events and learning substrate.",
    moduleNames: ["FoundationOS", "Security Layer", "Event Bus", "Integration Layer", "AcademyOS"],
  },
];

export const PLATFORM_PROGRESS_VIE_CAPABILITIES = [
  "Longitudinal image comparison",
  "Same-angle alignment",
  "Capture protocol validation",
  "Photo metadata attribution",
  "Surgical progress visualization",
  "Outcome readiness signals",
] as const;

/** Internal recent releases (may retain engineering titles for admin). */
export const PLATFORM_RECENT_RELEASES: PlatformRecentRelease[] = [
  {
    id: "2026-07-controlled-crm-migration",
    title: "Controlled CRM migration and operational transition",
    module: "LeadFlow",
    date: "2026-07-16",
  },
  {
    id: "2026-07-05-surgery-imaging",
    title: "Surgery imaging intelligence summary",
    module: "SurgeryOS",
    date: "2026-07-05",
  },
  {
    id: "2026-07-01-workforce",
    title: "Workforce readiness and planning intelligence",
    module: "WorkforceOS",
    date: "2026-07-01",
  },
  {
    id: "2026-06-26-calendar-settings",
    title: "Calendar settings centre",
    module: "CalendarOS",
    date: "2026-06-26",
  },
  {
    id: "2026-06-22-staged-import",
    title: "Staged HubSpot import with preview and verification",
    module: "OnboardingOS",
    date: "2026-06-22",
  },
];

/**
 * Public changelog excerpts — clinic/investor safe language.
 * Extended engineering detail remains in internal runbooks and git history.
 */
export const PLATFORM_PROGRESS_CHANGELOG: PlatformProgressChangelogEntry[] = [
  {
    id: "2026-07-16-controlled-crm-migration",
    date: "2026-07-16",
    tag: "leadflow",
    title: "Controlled CRM migration and operational transition",
    summary:
      "Staged HubSpot-to-FI transition pathways: historical backup, migration preview, identity reconciliation, duplicate prevention and post-migration verification — designed so clinics can connect, coexist, transition or replace at a controlled pace.",
    modules: ["LeadFlow", "OnboardingOS", "Integration Layer"],
  },
  {
    id: "2026-07-05-surgery-imaging-intelligence-release",
    date: "2026-07-05",
    tag: "surgery-os",
    title: "Surgery imaging intelligence summary ready for operational review",
    summary:
      "Structured imaging summary across key surgical image groups, with completeness and audit-readiness signals for clinical operators.",
    modules: ["SurgeryOS", "ImagingOS", "HairAudit", "AnalyticsOS"],
  },
  {
    id: "2026-07-05-surgery-intelligence-hairaudit-release",
    date: "2026-07-05",
    tag: "audit-os",
    title: "Structured surgery-to-HairAudit linkage",
    summary:
      "Surgery cases can link to HairAudit review pathways with operator-visible status — preserving review integrity rather than silent overwrite.",
    modules: ["SurgeryOS", "ImagingOS", "HairAudit", "AuditOS"],
  },
  {
    id: "2026-07-01-workforce-os-predictive-intelligence",
    date: "2026-07-01",
    tag: "workforce-os",
    title: "Workforce readiness and planning intelligence expanded",
    summary:
      "Clinics can monitor workforce readiness and plan staffing with stronger operational signal from roster and compliance posture.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-06-26-calendar-os-settings",
    date: "2026-06-26",
    tag: "clinic-os",
    title: "Calendar settings centre for clinic scheduling connectors",
    summary:
      "Tenant-scoped calendar configuration, sync health visibility and staff calendar links in a unified operations surface.",
    modules: ["CalendarOS", "ClinicOS", "Integration Layer"],
  },
  {
    id: "2026-06-26-imaging-comparison",
    date: "2026-06-26",
    tag: "imaging-os",
    title: "Longitudinal image comparison and alignment",
    summary:
      "Protocol captures support before/after and progression comparison with alignment support for clinical review.",
    modules: ["ImagingOS", "VIE"],
  },
  {
    id: "2026-06-25-event-bus",
    date: "2026-06-25",
    tag: "infrastructure",
    title: "Platform event backbone connecting module workflows",
    summary:
      "Cross-module event publishing and subscription so operational and clinical signals can travel without brittle point-to-point coupling.",
    modules: ["Event Bus", "FoundationOS"],
  },
  {
    id: "2026-06-22-staged-hubspot-import",
    date: "2026-06-22",
    tag: "onboarding-os",
    title: "Staged HubSpot import with preview and verification",
    summary:
      "Approved records can be reviewed, checked for duplicates, imported into FI and verified — without forcing an instantaneous cutover.",
    modules: ["OnboardingOS", "LeadFlow"],
  },
  {
    id: "2026-06-21-analytics-publisher",
    date: "2026-06-21",
    tag: "analytics-os",
    title: "Analytics event publishing expanded",
    summary:
      "More operational modules publish structured events into AnalyticsOS for conversion, productivity and cohort views.",
    modules: ["AnalyticsOS"],
  },
];

const OPERATIONAL_STATUSES: PlatformProgressStatus[] = ["Deployed", "Operational Pilot"];

export function countModulesByStatus(
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
): Record<PlatformProgressStatus, number> {
  const counts: Record<PlatformProgressStatus, number> = {
    Deployed: 0,
    "Operational Pilot": 0,
    "Advanced Build": 0,
    "In Development": 0,
    "Research and Future Development": 0,
  };
  for (const mod of modules) {
    counts[mod.status] += 1;
  }
  return counts;
}

export function getModulesByStatuses(
  statuses: readonly PlatformProgressStatus[],
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
): PlatformProgressModule[] {
  const set = new Set(statuses);
  return modules.filter((mod) => set.has(mod.status));
}

/** @deprecated Averages of historical % are not used on public UI. */
export function computePlatformProgressEcosystemAverage(
  modules: readonly PlatformProgressModule[]
) {
  const withPercent = modules.filter((mod) => typeof mod.completionPercent === "number");
  if (withPercent.length === 0) return 0;
  const total = withPercent.reduce((sum, mod) => sum + (mod.completionPercent ?? 0), 0);
  return Math.round(total / withPercent.length);
}

export function getPlatformProgressSnapshot(
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
) {
  const statusCounts = countModulesByStatus(modules);
  const fiOsModuleAverage = computePlatformProgressEcosystemAverage(modules);
  return {
    /** Historical only — do not render on public marketing. */
    overallEcosystemPercent: FI_ECOSYSTEM_COMPLETION_SUMMARY.overallEcosystemPercent,
    /** Historical only — do not render on public marketing. */
    fiOsCorePlatformPercent: FI_ECOSYSTEM_COMPLETION_SUMMARY.fiOsCorePlatformPercent,
    /** @deprecated */
    ecosystemAverage: fiOsModuleAverage,
    fiOsModuleAverage,
    activeModuleCount: modules.length,
    deployableSurfaceCount:
      statusCounts.Deployed + statusCounts["Operational Pilot"],
    statusCounts,
    lastUpdated: PLATFORM_PROGRESS_PAGE_CONTENT.hero.lastUpdated,
  };
}

export function getFeaturedPlatformProgressModules(
  moduleIds: readonly string[] = PLATFORM_PROGRESS_HOMEPAGE_FEATURED_MODULE_IDS,
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
) {
  return moduleIds
    .map((id) => modules.find((mod) => mod.id === id))
    .filter((mod): mod is PlatformProgressModule => mod != null);
}

export function getPlatformProgressModulesHeadline(
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
): string {
  return `${modules.length} connected systems in the public progress registry`;
}

export function getPlatformProgressHomepageDescription(
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
): string {
  const c = PLATFORM_PROGRESS_PAGE_CONTENT.homepage;
  return `${c.description} ${modules.length} ${c.moduleCountLabel}. ${c.descriptionClosing}`;
}

export function getLatestPlatformProgressChangelogEntry(
  entries: readonly PlatformProgressChangelogEntry[] = PLATFORM_PROGRESS_CHANGELOG
): PlatformProgressChangelogEntry | null {
  if (entries.length === 0) return null;
  return (
    [...entries].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.id.localeCompare(a.id);
    })[0] ?? null
  );
}

export function isPlatformInfrastructureCoreSystem(
  moduleId: string
): moduleId is PlatformInfrastructureCoreSystemId {
  return (PLATFORM_INFRASTRUCTURE_CORE_SYSTEM_IDS as readonly string[]).includes(moduleId);
}

export function getPlatformInfrastructureDeploymentStatus(moduleId: string): string | null {
  if (!isPlatformInfrastructureCoreSystem(moduleId)) return null;
  return PLATFORM_INFRASTRUCTURE_DEPLOYMENT_STATUS[moduleId];
}

export function resolvePlatformProgressModulesByName(
  names: readonly string[],
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
): PlatformProgressModule[] {
  return names
    .map((name) => modules.find((mod) => mod.name === name))
    .filter((mod): mod is PlatformProgressModule => mod != null);
}

export function getPlatformProgressMetrics(
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
): PlatformProgressMetric[] {
  const snapshot = getPlatformProgressSnapshot(modules);
  const counts = snapshot.statusCounts;
  return [
    { label: "Systems tracked", value: String(snapshot.activeModuleCount) },
    { label: "Deployed", value: String(counts.Deployed) },
    { label: "Operational pilot", value: String(counts["Operational Pilot"]) },
    { label: "Advanced build", value: String(counts["Advanced Build"]) },
    { label: "In development", value: String(counts["In Development"]) },
    {
      label: "Research & future",
      value: String(counts["Research and Future Development"]),
    },
  ];
}

export function getOperationalModules(
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
) {
  return getModulesByStatuses(OPERATIONAL_STATUSES, modules);
}

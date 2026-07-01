/**
 * Live module progress + engineering changelog for `/platform/progress`.
 * Update percentages, stages, and status badges here — no layout changes required.
 */

import { buildGoogleCalendarPlatformProgressModule } from "@/src/lib/googleCalendar/googleCalendarIntegrationProgress";
import { buildViePlatformProgressModule } from "@/src/lib/vie/viePlatformProgress";

export const PLATFORM_PROGRESS_STATUSES = [
  "Live",
  "Production",
  "Pilot Ready",
  "Operational beta",
  "Active Development",
  "Infrastructure Complete",
] as const;

export type PlatformProgressStatus = (typeof PLATFORM_PROGRESS_STATUSES)[number];

export type PlatformProgressModule = {
  id: string;
  name: string;
  completionPercent: number;
  /** Infrastructure phase label shown on progress cards. */
  stage: string;
  description: string;
  status: PlatformProgressStatus;
  /** Institutional status badge copy — falls back to `status` when omitted. */
  statusLabel?: string;
  /** Latest shipped milestone for the module registry. */
  latestMilestone?: string;
  learnMoreHref?: string;
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
  completionPercent: number;
  description: string;
  href?: string;
  external?: boolean;
};

/** Manual ecosystem-wide completion rollup — edit as delivery advances. */
export const FI_ECOSYSTEM_COMPLETION_SUMMARY = {
  overallEcosystemPercent: 78,
  fiOsCorePlatformPercent: 77,
} as const;

/** Satellite and workforce platforms in the broader FI ecosystem. */
export const FI_ECOSYSTEM_PLATFORM_COMPLETION: FiEcosystemPlatformCompletion[] = [
  {
    id: "workforce-os",
    name: "WorkforceOS",
    completionPercent: 85,
    description:
      "Enterprise workforce intelligence for staffing readiness, payroll intelligence, compliance monitoring, recruitment, surgical workforce allocation, and predictive workforce decision systems.",
  },
  {
    id: "hairaudit",
    name: "HairAudit",
    completionPercent: 82,
    description:
      "Independent surgical audit, evidence capture, quality scoring, and outcome verification.",
    href: "https://hairaudit.com",
    external: true,
  },
  {
    id: "iiohr",
    name: "IIOHR Infrastructure",
    completionPercent: 78,
    description:
      "Training, certification, Nexus provisioning, and institute-aligned workforce standards.",
    href: "https://iiohr.com",
    external: true,
  },
  {
    id: "hli",
    name: "HLI Platform",
    completionPercent: 71,
    description:
      "Hair Longevity Institute diagnostics, treatment pathways, and longitudinal biology intelligence.",
    href: "https://hairlongevityinstitute.com",
    external: true,
  },
];

export const PLATFORM_PROGRESS_PAGE_CONTENT = {
  hero: {
    eyebrow: "Platform Infrastructure",
    headline: "Building the Intelligence Infrastructure for Hair Restoration Medicine",
    subtext:
      "Follicle Intelligence is engineering the world's first vertically integrated operating system connecting patient acquisition, clinical diagnostics, surgical execution, long-term outcome intelligence, practitioner certification, and global treatment intelligence into one unified platform.",
    lastUpdated: "2026-07-01",
  },

  intelligenceSystems: {
    eyebrow: "Platform architecture",
    headline: "20 Interconnected Intelligence Systems",
    intro:
      "Organised across clinical, intelligence, operational, and infrastructure layers — one continuously learning network.",
  },

  modules: {
    eyebrow: "Module registry",
    headline: "Infrastructure delivery registry",
    intro:
      "Functional completeness across clinical, surgical, intelligence, workforce, and connector layers — updated as engineering milestones ship.",
  },

  infrastructureLayer: {
    eyebrow: "Core substrate",
    headline: "Core Infrastructure Layer",
    intro:
      "Systems that power every module above — event-driven architecture, security, integrations, and learning engines.",
  },

  vie: {
    eyebrow: "Visual intelligence",
    headline: "VIE — Visual Intelligence Engine",
    intro:
      "A dedicated product layer for clinical photography intelligence — protocol capture, alignment, comparison, and surgical progress visualization across the FI ecosystem.",
  },

  milestones: {
    eyebrow: "Deployment log",
    headline: "Engineering deployment timeline",
    intro:
      "Chronological record of infrastructure releases — migrations, engines, and integration contracts.",
  },

  intelligenceNetwork: {
    eyebrow: "Competitive moat",
    headline: "The Intelligence Network",
    manifesto: [
      "Every consultation.",
      "Every scalp analysis.",
      "Every medication protocol.",
      "Every graft extracted.",
      "Every transection rate.",
      "Every implantation pattern.",
      "Every surgical decision.",
      "Every post-operative recovery pathway.",
      "Every long-term patient outcome.",
      "Continuously structured.",
      "Continuously measured.",
      "Continuously learning.",
    ] as const,
    closing:
      "At scale, this creates the world's first continuously evolving intelligence network dedicated entirely to hair restoration medicine.",
    closingLine: "The software powers operations. The data becomes the asset.",
  },

  platformMetrics: {
    eyebrow: "Platform scale",
    headline: "Platform Intelligence Metrics",
  },

  platformArchitecture: {
    eyebrow: "System architecture",
    headline: "Platform Architecture",
    intro:
      "Vertically integrated layers — from acquisition through clinical execution to intelligence and infrastructure.",
  },

  eventBus: {
    eyebrow: "Core infrastructure",
    headline: "Platform Event Bus",
    subtitle:
      "The asynchronous communication backbone connecting every system across the Follicle Intelligence ecosystem.",
    capabilities: [
      "Event publishing",
      "Subscriber orchestration",
      "Delivery retry framework",
      "Idempotency protection",
      "Service decoupling",
      "Cross-platform communication architecture",
      "Internal service routing",
    ] as const,
  },

  defensibility: {
    eyebrow: "Structural moat",
    headline: "Why This Cannot Be Easily Replicated",
    intro:
      "Follicle Intelligence combines infrastructure layers no existing software provider currently connects.",
    expertiseAreas: [
      "Hair restoration medicine",
      "Surgical workflow systems",
      "Longitudinal outcome auditing",
      "AI diagnostic modelling",
      "Clinical imaging intelligence",
      "Practitioner certification systems",
      "Global treatment benchmarking",
      "Multi-clinic healthcare operations",
    ] as const,
    closing: "This creates structural defensibility that becomes stronger as adoption grows.",
  },

  closing: {
    eyebrow: "Founder conviction",
    headline: "We Are Building The Future Infrastructure Of Hair Restoration",
    body: [
      "We believe the future of hair restoration will not be built around clinics.",
      "It will be built around intelligence.",
      "The clinics of the future will not simply perform procedures.",
      "They will continuously learn from every patient, every treatment, every outcome, and every clinical decision.",
      "Follicle Intelligence is building the infrastructure layer that makes that future possible.",
    ] as const,
  },

  changelog: {
    eyebrow: "Full engineering log",
    headline: "Extended infrastructure changelog",
    intro: "Detailed release notes for platform engineers and integration partners.",
  },

  homepage: {
    id: "platform-progress",
    eyebrow: "Platform infrastructure",
    headline: "Intelligence Infrastructure In Active Deployment",
    description:
      "Twenty interconnected systems across clinical, intelligence, operational, and infrastructure layers.",
    moduleCountLabel: "integrated systems",
    descriptionClosing: "Live engineering registry. Category-defining platform architecture.",
    cta: { label: "View Live Platform Progress", href: "/platform/progress" },
    secondaryCta: { label: "See how the ecosystem connects", href: "/platform/ecosystem" },
    latestUpdate: {
      title: "Latest infrastructure deployment",
      readFullLogLabel: "Read full deployment log",
      readFullLogHref: "/platform/progress#engineering-changelog",
    },
  },
} as const;

/** Featured modules surfaced on the public homepage highlight section. */
export const PLATFORM_PROGRESS_HOMEPAGE_FEATURED_MODULE_IDS = [
  "foundation-os",
  "financial-os",
  "surgery-os",
] as const;

/** Latest infrastructure deployments for internal FI Admin dashboard. */
export const PLATFORM_RECENT_RELEASES: PlatformRecentRelease[] = [
  {
    id: "2026-06-26-calendar-os-gc11",
    title: "GC-11 — Calendar Settings Centre deployed",
    module: "CalendarOS",
    date: "2026-06-26",
  },
  {
    id: "2026-06-26-vie-6-same-angle-alignment",
    title: "VIE-6 — Same Angle Alignment Engine completed",
    module: "Visual Intelligence Engine (VIE)",
    date: "2026-06-26",
  },
  {
    id: "2026-06-25-event-bus-gc10",
    title: "GC-10 — Platform Event Bus architecture released",
    module: "Event Bus",
    date: "2026-06-25",
  },
  {
    id: "2026-06-24-security-sa2",
    title: "SA-2 — Field Level Permission Engine completed",
    module: "Security Layer",
    date: "2026-06-24",
  },
  {
    id: "2026-06-23-calendar-os-gc8",
    title: "GC-8 — Scheduled background sync monitoring released",
    module: "CalendarOS",
    date: "2026-06-23",
  },
  {
    id: "2026-06-22-calendar-os-gc7",
    title: "GC-7 — Google sync conflict review queue deployed",
    module: "CalendarOS",
    date: "2026-06-22",
  },
  {
    id: "2026-06-22-onboarding-os-phase-f5",
    title: "OnboardingOS Phase F5 — Staged Import Engine",
    module: "OnboardingOS",
    date: "2026-06-22",
  },
  {
    id: "2026-06-21-analytics-an-c",
    title: "AN-C — Analytics publisher expansion completed",
    module: "AnalyticsOS",
    date: "2026-06-21",
  },
  {
    id: "2026-06-20-ha-guide-2b",
    title: "HA-GUIDE-2B — Spanish multilingual patient education released",
    module: "PatientOS",
    date: "2026-06-20",
  },
  {
    id: "2026-06-26-vie-5-longitudinal-comparison",
    title: "VIE-5 — Longitudinal Comparison Engine",
    module: "Visual Intelligence Engine (VIE)",
    date: "2026-06-19",
  },
];

const DEPLOYABLE_STATUSES: PlatformProgressStatus[] = ["Live", "Production", "Pilot Ready"];

export function computePlatformProgressEcosystemAverage(
  modules: readonly PlatformProgressModule[]
) {
  if (modules.length === 0) return 0;
  const total = modules.reduce((sum, mod) => sum + mod.completionPercent, 0);
  return Math.round(total / modules.length);
}

export function getPlatformProgressSnapshot(
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
) {
  const fiOsModuleAverage = computePlatformProgressEcosystemAverage(modules);
  return {
    overallEcosystemPercent: FI_ECOSYSTEM_COMPLETION_SUMMARY.overallEcosystemPercent,
    fiOsCorePlatformPercent: FI_ECOSYSTEM_COMPLETION_SUMMARY.fiOsCorePlatformPercent,
    /** @deprecated Use `overallEcosystemPercent` or `fiOsCorePlatformPercent` in UI copy. */
    ecosystemAverage: fiOsModuleAverage,
    fiOsModuleAverage,
    activeModuleCount: modules.length,
    deployableSurfaceCount: modules.filter((mod) => DEPLOYABLE_STATUSES.includes(mod.status))
      .length,
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

/** Manual module registry — edit completionPercent, stage, and status as delivery advances. */
export const PLATFORM_PROGRESS_MODULES: PlatformProgressModule[] = [
  {
    id: "foundation-os",
    name: "FoundationOS",
    completionPercent: 90,
    stage: "Phase 4 · identity spine",
    description:
      "Patient identity substrate, digital twin continuity, media timelines, and cross-module event spine for longitudinal intelligence.",
    status: "Infrastructure Complete",
    statusLabel: "Operational Core",
    latestMilestone: "Patient Twin identity spine operational",
    learnMoreHref: "/patient-twin",
  },
  {
    id: "clinic-os",
    name: "ClinicOS",
    completionPercent: 91,
    stage: "Phase 5 · operations centre",
    description:
      "Calendars, services, appointment lifecycle, and day-to-day clinic rhythm for multi-site operators.",
    status: "Production",
    statusLabel: "Production Ready",
    latestMilestone: "Multi-site scheduling spine in production",
    learnMoreHref: "/platform/clinic-os",
  },
  {
    id: "consultation-os",
    name: "ConsultationOS",
    completionPercent: 72,
    stage: "Phase 3 · workflow engine",
    description:
      "Structured consultation forms, pathway launcher, quote acceptance, and conversion intelligence.",
    status: "Active Development",
    statusLabel: "Advanced Build",
    latestMilestone: "Conversion pathway launcher shipped",
  },
  {
    id: "patient-os",
    name: "PatientOS",
    completionPercent: 81,
    stage: "Phase 4 · longitudinal records",
    description:
      "Longitudinal patient records, portal surfaces, and intelligence substrate for cohort learning.",
    status: "Production",
    statusLabel: "Production Stable",
    latestMilestone: "Patient Twin records integration live",
    learnMoreHref: "/platform/patient-os",
  },
  {
    id: "leadflow",
    name: "LeadFlow",
    completionPercent: 68,
    stage: "Phase 2 · acquisition pipeline",
    description:
      "Lead capture, attribution, HubSpot sync, and conversion funnel intelligence across acquisition surfaces.",
    status: "Active Development",
    statusLabel: "Scaling",
    latestMilestone: "HubSpot acquisition pipeline wired",
  },
  {
    id: "imaging-os",
    name: "ImagingOS",
    completionPercent: 88,
    stage: "Phase 4 · AI execution framework",
    description:
      "Template-driven photography sessions, slot progress, AI execution framework, and surgical-domain progression assessments.",
    status: "Operational beta",
    statusLabel: "Operational Beta",
    latestMilestone: "Live AI execution framework operational",
    learnMoreHref: "/platform/imaging-os",
  },
  buildViePlatformProgressModule(),
  {
    id: "surgery-os",
    name: "SurgeryOS",
    completionPercent: 84,
    stage: "Phase 3 · procedure-day command",
    description:
      "Procedure-day command centre, live capture, graft intelligence foundation, and clinical safety guardrails.",
    status: "Active Development",
    statusLabel: "Advanced Build",
    latestMilestone: "Graft intelligence procedure-day command",
    learnMoreHref: "/platform/surgery-os",
  },
  {
    id: "hair-intel",
    name: "HairIntel",
    completionPercent: 79,
    stage: "Phase 2 · classification intelligence",
    description:
      "Hair loss classification, progression velocity, treatment response modelling, and cohort intelligence.",
    status: "Active Development",
    statusLabel: "Intelligence Layer",
    latestMilestone: "Multi-system classification engine live",
  },
  {
    id: "audit-os",
    name: "AuditOS",
    completionPercent: 82,
    stage: "Phase 3 · HairAudit exposure",
    description:
      "Independent audit workflows, HairAudit patient exposure layer, report surfaces, and network integration contracts.",
    status: "Production",
    statusLabel: "Production Stable",
    latestMilestone: "HairAudit patient exposure layer completed",
    learnMoreHref: "/audit-network",
  },
  {
    id: "analytics-os",
    name: "AnalyticsOS",
    completionPercent: 81,
    stage: "Phase 3 · executive intelligence",
    description:
      "Conversion, productivity, and cohort analytics — plus deterministic executive health scoring from the AnalyticsOS event pipeline.",
    status: "Infrastructure Complete",
    statusLabel: "Executive Intelligence",
    latestMilestone: "AN-C Analytics publisher expansion completed",
    learnMoreHref: "/platform/analytics-os",
  },
  {
    id: "academy-os",
    name: "AcademyOS",
    completionPercent: 76,
    stage: "Phase 2 · certification spine",
    description:
      "Training pathways, certification hooks, and institute-aligned competency tracking for clinical teams.",
    status: "Active Development",
    statusLabel: "Certification Engine",
    latestMilestone: "Competency curriculum spine operational",
    learnMoreHref: "/academy",
  },
  {
    id: "workforce-os",
    name: "WorkforceOS",
    completionPercent: 85,
    stage: "Phase 2 · predictive workforce intelligence",
    description:
      "Healthcare workforce infrastructure, onboarding, compliance, readiness scoring, clinical rostering, employment lifecycle, IIOHR HR identity reconciliation, duplicate detection, and HR sync audit centre.",
    status: "Active Development",
    statusLabel: "Operational Beta",
    latestMilestone: "Predictive workforce intelligence and workforce planning engine",
  },
  {
    id: "onboarding-os",
    name: "OnboardingOS",
    completionPercent: 86,
    stage: "Phase F5 · staged import engine",
    description:
      "Enterprise clinic deployment engine — tenant provisioning, deployment templates, Guided Assist, go-live readiness gates, and live connectors.",
    status: "Pilot Ready",
    statusLabel: "Deployment Engine",
    latestMilestone: "IHRG-DEMO-1 Demo Data Expansion Pack shipped",
  },
  buildGoogleCalendarPlatformProgressModule(),
  {
    id: "financial-os",
    name: "FinancialOS",
    completionPercent: 64,
    stage: "Phase 2 · executive finance",
    description:
      "Master ledger, surgery profitability, revenue attribution, accounts receivable, and executive forecasting.",
    status: "Active Development",
    statusLabel: "In Development",
    latestMilestone: "Executive finance intelligence in build",
    learnMoreHref: "/platform/progress#progress-financial-os",
  },
  {
    id: "security-layer",
    name: "Security Layer",
    completionPercent: 85,
    stage: "SA-2 · field permissions",
    description:
      "Row-level security, tenant isolation, field-level permissions, and secret validation across the FI substrate.",
    status: "Infrastructure Complete",
    statusLabel: "Infrastructure Core",
    latestMilestone: "SA-2 Field Level Permission Engine completed",
  },
  {
    id: "event-bus",
    name: "Event Bus",
    completionPercent: 92,
    stage: "GC-10 · platform event architecture",
    description:
      "Event-driven architecture, subscriber framework, retry processing, and idempotency validation.",
    status: "Infrastructure Complete",
    statusLabel: "Core Infrastructure",
    latestMilestone: "GC-10 Platform Event Bus architecture released",
  },
  {
    id: "integration-layer",
    name: "Integration Layer",
    completionPercent: 80,
    stage: "Phase F · connector framework",
    description:
      "Google Calendar, HubSpot, Timely, Zapier, and API connector framework for enterprise clinic deployments.",
    status: "Pilot Ready",
    statusLabel: "Connector Framework",
    latestMilestone: "Enterprise connector auth and verification layer",
  },
  {
    id: "ai-intelligence-layer",
    name: "AI Intelligence Layer",
    completionPercent: 74,
    stage: "Phase 2 · learning systems",
    description:
      "Hair loss classification, surgical benchmarking, outcome learning, and pattern recognition engines.",
    status: "Active Development",
    statusLabel: "Learning Systems",
    latestMilestone: "Deterministic clinical interpretation pipelines",
  },
];

export const PLATFORM_PROGRESS_INFRASTRUCTURE_LAYERS: PlatformProgressInfrastructureLayer[] = [
  {
    id: "event-bus",
    name: "Platform Event Bus",
    tagline: "Event-driven architecture",
    capabilities: ["Subscriber framework", "Retry processing", "Idempotency validation"],
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
    tagline: "Enterprise connector substrate",
    capabilities: ["Google Calendar", "HubSpot", "Timely", "Zapier", "API connectors"],
  },
  {
    id: "ai-engine",
    name: "AI Intelligence Engine",
    tagline: "Continuous learning systems",
    capabilities: [
      "Hair loss classification",
      "Surgical benchmarking",
      "Outcome learning",
      "Pattern recognition",
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

/** Core substrate systems — percentages preserved in registry but hidden in public UI. */
export const PLATFORM_INFRASTRUCTURE_CORE_SYSTEM_IDS = [
  "foundation-os",
  "security-layer",
  "event-bus",
  "integration-layer",
] as const;

export type PlatformInfrastructureCoreSystemId =
  (typeof PLATFORM_INFRASTRUCTURE_CORE_SYSTEM_IDS)[number];

/** Deployment status copy for infrastructure core systems (replaces visible completion %). */
export const PLATFORM_INFRASTRUCTURE_DEPLOYMENT_STATUS: Record<
  PlatformInfrastructureCoreSystemId,
  string
> = {
  "foundation-os": "Core Platform Operational",
  "security-layer": "Operational Security Architecture",
  "event-bus": "Infrastructure Deployed",
  "integration-layer": "Connector Framework Active",
};

export const PLATFORM_PROGRESS_METRICS: PlatformProgressMetric[] = [
  { label: "Integrated Systems", value: "20" },
  { label: "Ecosystem Completion", value: "77%" },
  { label: "Clinical Data Fields", value: "250+" },
  { label: "Procedure Variables Captured", value: "1000+" },
  { label: "Outcome Tracking Horizon", value: "12 Months" },
  { label: "Continuous Learning Potential", value: "Infinite" },
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
    systems: ["ConsultationOS", "PatientOS", "ClinicOS", "CalendarOS"],
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
    systems: ["AcademyOS", "WorkforceOS", "Certification Engine"],
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
    heading: "Clinical Systems",
    description: "Core systems supporting direct patient care and clinical workflows.",
    moduleNames: ["ClinicOS", "ConsultationOS", "PatientOS", "ImagingOS", "SurgeryOS"],
  },
  {
    id: "intelligence",
    heading: "Intelligence Systems",
    description:
      "Systems responsible for diagnostics, pattern recognition, benchmarking, and outcome intelligence.",
    moduleNames: ["HairIntel", "VIE", "AuditOS", "AnalyticsOS", "AI Intelligence Layer"],
  },
  {
    id: "operational",
    heading: "Operational Systems",
    description: "Systems managing acquisition, operations, finance, and deployment.",
    moduleNames: ["LeadFlow", "CalendarOS", "WorkforceOS", "FinancialOS", "OnboardingOS"],
  },
  {
    id: "infrastructure",
    heading: "Infrastructure Systems",
    description: "Core architecture powering platform scalability.",
    moduleNames: ["FoundationOS", "Security Layer", "Event Bus", "Integration Layer", "AcademyOS"],
  },
];

export const PLATFORM_PROGRESS_VIE_CAPABILITIES = [
  "Longitudinal image comparison",
  "Same angle alignment engine",
  "Capture protocol validation",
  "AI image classification",
  "Photo metadata attribution",
  "Marketing derivative generation",
  "Surgical progress visualization",
] as const;

/** Chronological deployment feed — most recent first. */
export const PLATFORM_PROGRESS_DEPLOYMENT_MILESTONES: PlatformProgressDeploymentMilestone[] = [
  {
    id: "ihrg-demo-1",
    date: "2026-06-26",
    tag: "onboarding-os",
    title: "IHRG-DEMO-1 Demo Data Expansion Pack shipped",
  },
  {
    id: "gc-11",
    date: "2026-06-26",
    tag: "calendar-os",
    title: "GC-11 Calendar Settings Centre deployed",
  },
  {
    id: "vie-6",
    date: "2026-06-26",
    tag: "vie",
    title: "VIE-6 Same Angle Alignment Engine completed",
  },
  {
    id: "gc-10",
    date: "2026-06-25",
    tag: "event-bus",
    title: "GC-10 Platform Event Bus architecture released",
  },
  {
    id: "sa-2",
    date: "2026-06-24",
    tag: "security",
    title: "SA-2 Field Level Permission Engine completed",
  },
  {
    id: "gc-8",
    date: "2026-06-23",
    tag: "calendar-os",
    title: "GC-8 Scheduled background sync monitoring released",
  },
  {
    id: "gc-7",
    date: "2026-06-22",
    tag: "calendar-os",
    title: "GC-7 Google sync conflict review queue deployed",
  },
  {
    id: "onb-f5",
    date: "2026-06-22",
    tag: "onboarding-os",
    title: "ONB-F5 HubSpot staged import engine operational",
  },
  {
    id: "an-c",
    date: "2026-06-21",
    tag: "analytics-os",
    title: "AN-C Analytics publisher expansion completed",
  },
  {
    id: "ha-guide-2b",
    date: "2026-06-20",
    tag: "patient-os",
    title: "HA-GUIDE-2B Spanish multilingual patient education released",
  },
  {
    id: "vie-5",
    date: "2026-06-19",
    tag: "vie",
    title: "VIE-5 Longitudinal Comparison Engine deployed",
  },
];

/** Public engineering changelog — append entries as milestones ship. */
export const PLATFORM_PROGRESS_CHANGELOG: PlatformProgressChangelogEntry[] = [
  {
    id: "2026-07-01-workforce-os-predictive-intelligence",
    date: "2026-07-01",
    tag: "workforce-os",
    title: "WorkforceOS predictive workforce intelligence shipped",
    summary:
      "WorkforceOS now includes predictive workforce intelligence, allowing clinics to forecast staffing risks, monitor workforce readiness, and proactively manage operational workforce performance.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-06-26-ihrg-demo-1",
    date: "2026-06-26",
    tag: "onboarding-os",
    title: "IHRG-DEMO-1 — Demo Data Expansion Pack",
    summary:
      "Profile-scaled, idempotent IHRG demo seeding across the full FI operating system — LeadFlow, CRM, CalendarOS, SurgeryOS, ImagingOS, AcademyOS, PaymentsOS, ReceptionOS, and AnalyticsOS. Supports light, standard, alive (default), and enterprise profiles via scripts/seed-ihrg-demo-data.ts.",
    modules: [
      "LeadFlowOS",
      "PatientOS",
      "ConsultationOS",
      "SurgeryOS",
      "ImagingOS",
      "AcademyOS",
      "CalendarOS",
      "PaymentsOS",
      "AnalyticsOS",
      "ClinicOS",
    ],
  },
  {
    id: "2026-06-26-calendar-os-gc11",
    date: "2026-06-26",
    tag: "calendar-os",
    title: "GC-11 — Calendar Settings Centre deployed",
    summary:
      "Tenant-scoped Calendar Settings Centre — Google Calendar connector configuration, sync health visibility, staff calendar links, and inbound scope management in a unified admin surface.",
    modules: ["CalendarOS", "Integration Layer"],
  },
  {
    id: "2026-06-26-vie-6-same-angle-alignment",
    date: "2026-06-26",
    tag: "vie",
    title: "VIE-6 — Same Angle Alignment Engine completed",
    summary:
      "Visual Intelligence Engine Phase 6: deterministic same-angle alignment for longitudinal comparison pairs — metadata-driven pose matching, alignment confidence scoring, and comparison readiness gates before AI-assisted overlay.",
    modules: ["Visual Intelligence Engine (VIE)", "ImagingOS"],
  },
  {
    id: "2026-06-25-event-bus-gc10",
    date: "2026-06-25",
    tag: "event-bus",
    title: "GC-10 — Platform Event Bus architecture released",
    summary:
      "Platform Event Bus substrate — subscriber framework, retry processing, idempotency validation, and cross-module event contracts for AnalyticsOS, CalendarOS, and deployment intelligence.",
    modules: ["Event Bus", "AnalyticsOS", "CalendarOS"],
  },
  {
    id: "2026-06-24-security-sa2",
    date: "2026-06-24",
    tag: "security",
    title: "SA-2 — Field Level Permission Engine completed",
    summary:
      "Field-level permission engine — granular read/write gates on sensitive clinical and financial fields with tenant isolation, audit trails, and role-aligned policy enforcement.",
    modules: ["Security Layer"],
  },
  {
    id: "2026-06-23-calendar-os-gc8",
    date: "2026-06-23",
    tag: "calendar-os",
    title: "GC-8 — Scheduled background sync monitoring released",
    summary:
      "Timed background sync scheduling with health monitoring, failure alerting, and per-calendar sync diagnostics for inbound Google Calendar integration.",
    modules: ["CalendarOS", "Integration Layer"],
  },
  {
    id: "2026-06-22-calendar-os-gc7",
    date: "2026-06-22",
    tag: "calendar-os",
    title: "GC-7 — Google sync conflict review queue deployed",
    summary:
      "Conflict and duplicate review queue for inbound Google Calendar events — platform and tenant admin approve/reject workflow before FI booking import.",
    modules: ["CalendarOS", "ClinicOS"],
  },
  {
    id: "2026-06-26-vie-5-longitudinal-comparison",
    date: "2026-06-26",
    tag: "vie",
    title: "VIE-5 — Longitudinal Comparison Engine completed",
    summary:
      "Visual Intelligence Engine Phase 5: accepted protocol captures now generate metadata-driven before/after comparison pairs and patient progression timelines — baseline vs follow-up, pre/post-op, donor extraction, graft tray, and repair review categories with confidence scoring, review accept/dismiss, ImagingOS Compare tab integration, Patient Twin readiness summary, and SurgeryOS operative pair status. Deterministic heuristics only; same-angle AI alignment deferred to VIE-6.",
    modules: ["Visual Intelligence Engine (VIE)", "ImagingOS", "SurgeryOS", "Patient Twin"],
  },
  {
    id: "2026-06-26-calendar-os-gc-csp",
    date: "2026-06-26",
    tag: "calendar-os",
    title: "CalendarOS GC-CSP — Google Calendar CSP compatibility fixed",
    summary:
      "Global CSP in next.config.mjs now includes a focused Google Calendar/Auth allowlist: connect-src for www.googleapis.com and oauth2.googleapis.com, frame-src for accounts.google.com OAuth iframes, and img-src for lh3.googleusercontent.com profile images. No broad loosening or new script-src permissions. Calendar page verified without securitypolicyviolation events.",
    modules: ["Google Calendar Integration", "ClinicOS"],
  },
  {
    id: "2026-06-26-calendar-os-gc6b",
    date: "2026-06-26",
    tag: "calendar-os",
    title: "CalendarOS GC-6B — Google inbound calendar scope admin",
    summary:
      "FI Admin inbound Google Calendar scope manager: discover calendars from OAuth calendarList, toggle per-calendar inbound sync, refresh scopes without losing choices, run sync now with per-calendar diagnostics, and tenant-safe admin permissions. Outbound appointment creation unchanged.",
    modules: ["Google Calendar Integration", "ClinicOS"],
  },
  {
    id: "2026-06-22-onboarding-os-phase-f5",
    date: "2026-06-22",
    tag: "onboarding-os",
    title: "OnboardingOS Phase F5 — Staged Import Engine",
    summary:
      "Controlled staged import engine added: approved HubSpot records can now be reviewed, duplicate-checked, imported into FI, mapped back to source records, and audited without write-back to HubSpot.",
    modules: ["OnboardingOS", "LeadFlow"],
  },
  {
    id: "2026-06-22-onboarding-os-phase-f3",
    date: "2026-06-22",
    tag: "onboarding-os",
    title: "OnboardingOS Phase F3 Google Calendar read-only connector completed",
    summary:
      "OnboardingOS Phase F3 added the first live read-only connector, allowing Google Calendar events to sync safely into a staging review queue before any FI booking import. Includes deterministic event classification, duplicate detection, sync health tracking, and platform/tenant admin approve/reject review — no write-back to Google.",
    modules: ["OnboardingOS"],
  },
  {
    id: "2026-06-22-onboarding-os-phase-f2",
    date: "2026-06-22",
    tag: "onboarding-os",
    title: "OnboardingOS Phase F2 Connector Auth & Verification completed",
    summary:
      "Connector authentication and verification engine — OAuth/API credential lifecycle, required permission scope tracking, token expiry warnings, verification events, and deployment intelligence signals. Architecture verification in test mode; prerequisite for live connector sync.",
    modules: ["OnboardingOS"],
  },
  {
    id: "2026-06-22-onboarding-os-phase-f1",
    date: "2026-06-22",
    tag: "onboarding-os",
    title: "OnboardingOS Phase F1 Legacy System Connector Layer completed",
    summary:
      "Enterprise connector architecture allowing clinics to securely register and prepare connections to existing software systems — HubSpot, Pabau, Cliniko, Stripe, Xero, Google Calendar, Outlook, Meta Ads, and Google Ads — with encrypted credentials, sync health tracking, data mapping plans, and Connect Existing Systems onboarding UI (foundation only; live OAuth and API sync in later phases).",
    modules: ["OnboardingOS"],
  },
  {
    id: "2026-06-22-onboarding-os-phase-e2",
    date: "2026-06-22",
    tag: "onboarding-os",
    title: "OnboardingOS Phase E2 Deployment Intelligence Command Centre",
    summary:
      "OnboardingOS Phase E2 added Deployment Intelligence: a weighted clinic deployment score across infrastructure, workflow, staff, operational readiness, adoption confidence, and executive approval.",
    modules: ["OnboardingOS"],
  },
  {
    id: "2026-06-22-onboarding-os-phase-e",
    date: "2026-06-22",
    tag: "onboarding-os",
    title: "OnboardingOS Phase E Go-Live Readiness Command Centre",
    summary:
      "Go-live readiness checklist, owner and platform review sign-offs, and explicit platform-admin approval gate — embedded as the executive approval domain inside Deployment Intelligence.",
    modules: ["OnboardingOS"],
  },
  {
    id: "2026-06-22-onboarding-os-phase-ab",
    date: "2026-06-22",
    tag: "onboarding-os",
    title: "OnboardingOS Phase A–B foundations added",
    summary:
      "OnboardingOS Phase A–B foundations added: tenant provisioning sessions, deployment templates, module bundle activation planning, role packs, service workflow templates, and sandbox seed planning.",
    modules: ["OnboardingOS"],
  },
  {
    id: "2026-07-01-workforce-os-phase-1c-sprint-1",
    date: "2026-07-01",
    tag: "workforce-os",
    title: "WorkforceOS Phase 1C Sprint 1 — HR identity reconciliation audit layer",
    summary:
      "Staff Identity Reconciliation Engine, Duplicate Detection Engine, and HR Sync Audit Centre shipped — auditable IIOHR ↔ FI OS identity links, fi_hr_sync_runs audit trail, duplicate candidate detection, and HR sync health dashboard foundation.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-07-01-workforce-os-staff-lifecycle",
    date: "2026-07-01",
    tag: "workforce-os",
    title: "WorkforceOS staff lifecycle management added",
    summary:
      "WorkforceOS staff lifecycle management added, introducing employment lifecycle controls, external HR identity management, reconciliation workflows, archival controls, and audit-backed workforce identity governance.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-06-26-workforce-command-centre-v1",
    date: "2026-06-26",
    tag: "workforce-os",
    title: "WorkforceOS Workforce Command Centre v1 shipped",
    summary:
      "Staff directory redesigned as an intelligence-first Workforce Command Centre — readiness metrics, compliance attention queue, role segmentation, and card-based directory while preserving add/edit staff flows.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-06-22-workforce-roster-command-centre",
    date: "2026-06-22",
    tag: "workforce-os",
    title: "WorkforceOS Phase 2E Roster Command Centre completed",
    summary:
      "Active workforce orchestration — Roster Command Centre with ranked assignment candidates, shift and availability management, and deep links from SurgeryOS, ClinicOS, and appointment surfaces.",
    modules: ["WorkforceOS", "SurgeryOS", "ClinicOS"],
  },
  {
    id: "2026-06-22-workforce-surgery-clinic-integration",
    date: "2026-06-22",
    tag: "workforce-os",
    title: "WorkforceOS Phase 2D SurgeryOS / ClinicOS staffing integration completed",
    summary:
      "Clinical rostering wired into SurgeryOS readiness, procedure day, and tomorrow boards plus ClinicOS calendar and appointment detail — assignment bridge syncs existing assigned staff to fi_staff_event_assignments with readiness visibility.",
    modules: ["WorkforceOS", "SurgeryOS", "ClinicOS"],
  },
  {
    id: "2026-06-22-workforce-clinical-rostering",
    date: "2026-06-22",
    tag: "workforce-os",
    title: "WorkforceOS Phase 2C clinical rostering foundation completed",
    summary:
      "Clinical rostering schema — shifts, availability blocks, staffing templates, event assignments with readiness snapshots, rostering engine, HR OS command centre, and Staff Twin roster panel.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-06-22-workforce-template-bootstrap",
    date: "2026-06-22",
    tag: "workforce-os",
    title: "WorkforceOS onboarding template bootstrap seeding completed",
    summary:
      "Tenant-scoped onboarding template bootstrap seeding — default workforce onboarding pathways and compliance checklists wired into tenant bootstrap.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-06-22-workforce-tenant-bootstrap",
    date: "2026-06-22",
    tag: "workforce-os",
    title: "WorkforceOS tenant bootstrap architecture completed",
    summary:
      "Multi-tenant workforce bootstrap architecture — identity provisioning, onboarding centre wiring, and tenant-scoped HR module activation contracts.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-06-21-workforce-onboarding-centre",
    date: "2026-06-21",
    tag: "workforce-os",
    title: "WorkforceOS onboarding centre completed",
    summary:
      "Onboarding centre surfaces for workforce intake, compliance checkpoints, training readiness gates, and operational staff governance workflows.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-06-21-workforce-identity-layer",
    date: "2026-06-21",
    tag: "workforce-os",
    title: "WorkforceOS identity layer completed",
    summary:
      "Workforce identity layer — staff provisioning contracts, FI user linkage, role alignment, and tenant-scoped workforce identity spine.",
    modules: ["WorkforceOS"],
  },
  {
    id: "2026-06-20-hairaudit-patient-exposure",
    date: "2026-06-20",
    tag: "audit-os",
    title: "HairAudit intelligence patient exposure layer completed",
    summary:
      "Patient exposure layer for HairAudit-aligned intelligence — governed audit packet surfacing and outcome verification hooks in AuditOS.",
    modules: ["AuditOS"],
  },
  {
    id: "2026-06-20-imaging-ai-execution",
    date: "2026-06-20",
    tag: "imaging-os",
    title: "ImagingOS live AI execution framework completed",
    summary:
      "Live AI execution framework for guided imaging sessions — template-driven capture, slot progress, and surgical-domain progression assessments.",
    modules: ["ImagingOS"],
  },
  {
    id: "2026-06-19-surgery-graft-foundation",
    date: "2026-06-19",
    tag: "surgery-os",
    title: "SurgeryOS graft intelligence operational foundation completed",
    summary:
      "Graft intelligence operational foundation — live graft totals, counting assistant UX, donor economics context, and procedure-day command centre integration.",
    modules: ["SurgeryOS"],
  },
  {
    id: "2026-06-19-financial-executive-intelligence",
    date: "2026-06-19",
    tag: "financial-os",
    title: "FinancialOS executive finance intelligence completed",
    summary:
      "Executive finance intelligence layer — master ledger, surgery profitability, revenue attribution, accounts receivable, and forecasting across FI OS.",
    modules: ["FinancialOS"],
  },
  {
    id: "2026-06-21-project-nexus-phase-9b",
    date: "2026-06-21",
    tag: "project-nexus",
    title: "Project Nexus Phase 9B — IIOHR ProductionAdapter",
    summary:
      "IIOHR ProductionAdapter implemented for signed FI OS Nexus provisioning, state reconciliation, rollback, dry-run safety, and audit logging.",
    modules: ["AcademyOS", "WorkforceOS"],
  },
  {
    id: "2026-06-19-surgery-live-capture",
    date: "2026-06-19",
    tag: "surgery-os",
    title: "Live capture infrastructure",
    summary:
      "Phase 1b live capture schema and loader contracts — real-time procedure events wired into SurgeryOS readiness board.",
    modules: ["SurgeryOS"],
  },
  {
    id: "2026-06-19-reception-phase5",
    date: "2026-06-19",
    tag: "reception-os",
    title: "ReceptionOS Phase 5 delivery closeout",
    summary:
      "Pilot validation hooks, delivery closeout workflows, and hardened board payload schema for front-desk command centre refresh.",
    modules: ["ReceptionOS"],
  },
  {
    id: "2026-06-15-consultation-workflow-engine",
    date: "2026-06-15",
    tag: "consultation-os",
    title: "ConsultationOS workflow engine",
    summary:
      "Hair loss treatment, female hair loss, pathology, repair, and follow-up templates with pathway launcher progress labels.",
    modules: ["ConsultationOS"],
  },
];

export function getPlatformProgressModulesHeadline(
  modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES
): string {
  return `${modules.length} Interconnected Intelligence Systems`;
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
  return PLATFORM_PROGRESS_METRICS.map((metric) => {
    if (metric.label === "Integrated Systems") {
      return { ...metric, value: String(snapshot.activeModuleCount) };
    }
    if (metric.label === "Ecosystem Completion") {
      return { ...metric, value: `${snapshot.fiOsCorePlatformPercent}%` };
    }
    return metric;
  });
}

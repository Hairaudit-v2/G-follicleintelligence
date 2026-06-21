/**
 * Live module progress + engineering changelog for `/platform/progress`.
 * Update percentages, stages, and status badges here — no layout changes required.
 */

export const PLATFORM_PROGRESS_STATUSES = [
  "Live",
  "Production",
  "Pilot Ready",
  "Active Development",
  "Infrastructure Complete",
] as const;

export type PlatformProgressStatus = (typeof PLATFORM_PROGRESS_STATUSES)[number];

export type PlatformProgressModule = {
  id: string;
  name: string;
  completionPercent: number;
  stage: string;
  description: string;
  status: PlatformProgressStatus;
  learnMoreHref?: string;
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

export const PLATFORM_PROGRESS_PAGE_CONTENT = {
  hero: {
    eyebrow: "Platform Progress",
    headline: "Engineering the complete hair restoration operating system",
    subtext:
      "Transparent delivery status across every Follicle Intelligence module — from infrastructure foundations through pilot-ready surfaces and production deployments.",
    lastUpdated: "2026-06-22",
  },

  summary: {
    eyebrow: "Delivery snapshot",
    headline: "Built in the open. Shipped with discipline.",
    intro:
      "Percentages reflect functional completeness against each module’s defined scope — schema, workflows, admin surfaces, integrations, and pilot hardening. Updated manually as milestones land.",
  },

  modules: {
    eyebrow: "Module grid",
    headline: "Twelve connected systems. One delivery spine.",
    intro: "Filter by status or scan completion across the FI OS surface area.",
  },

  changelog: {
    eyebrow: "Engineering changelog",
    headline: "Recent Infrastructure Milestones",
    intro: "Public record of platform delivery — migrations, surfaces, and integration contracts.",
  },

  finalCta: {
    eyebrow: "Partner access",
    headline: "Deploy the operating system in your organisation",
    primaryCta: { label: "Book enterprise demo", href: "/demo" },
    secondaryCta: { label: "Explore platform architecture", href: "/platform" },
  },

  homepage: {
    id: "platform-progress",
    eyebrow: "Platform progress",
    headline: "Built as a living healthcare operating system",
    description:
      "Follicle Intelligence is building the world's first specialised operating system for hair restoration, clinic operations, workforce infrastructure, surgical intelligence, patient intelligence, and global clinical accreditation.",
    cta: { label: "View platform progress", href: "/platform/progress" },
    secondaryCta: { label: "See how the ecosystem connects", href: "/platform/ecosystem" },
    latestUpdate: {
      title: "Latest platform update",
      readFullLogLabel: "Read full progress log",
      readFullLogHref: "/platform/progress#engineering-changelog",
    },
  },
} as const;

/** Featured modules surfaced on the public homepage highlight section. */
export const PLATFORM_PROGRESS_HOMEPAGE_FEATURED_MODULE_IDS = [
  "foundation-os",
  "reception-os",
  "financial-os",
  "surgery-os",
] as const;

/** Latest infrastructure deployments for internal FI Admin dashboard. */
export const PLATFORM_RECENT_RELEASES: PlatformRecentRelease[] = [
  {
    id: "2026-06-21-workforce-onboarding-centre",
    title: "WorkforceOS onboarding centre",
    module: "WorkforceOS",
    date: "2026-06-21",
  },
  {
    id: "2026-06-19-financial-executive-engine",
    title: "FinancialOS executive finance engine",
    module: "FinancialOS",
    date: "2026-06-19",
  },
  {
    id: "2026-06-19-surgery-graft-intelligence",
    title: "SurgeryOS graft intelligence",
    module: "SurgeryOS",
    date: "2026-06-19",
  },
  {
    id: "2026-06-20-imaging-ai-execution",
    title: "ImagingOS AI execution framework",
    module: "ImagingOS",
    date: "2026-06-20",
  },
  {
    id: "2026-06-15-consultation-workflow-engine",
    title: "ConsultationOS workflow engine",
    module: "ConsultationOS",
    date: "2026-06-15",
  },
];

const DEPLOYABLE_STATUSES: PlatformProgressStatus[] = ["Live", "Production", "Pilot Ready"];

export function computePlatformProgressEcosystemAverage(modules: readonly PlatformProgressModule[]) {
  if (modules.length === 0) return 0;
  const total = modules.reduce((sum, mod) => sum + mod.completionPercent, 0);
  return Math.round(total / modules.length);
}

export function getPlatformProgressSnapshot(modules: readonly PlatformProgressModule[] = PLATFORM_PROGRESS_MODULES) {
  return {
    ecosystemAverage: computePlatformProgressEcosystemAverage(modules),
    activeModuleCount: modules.length,
    deployableSurfaceCount: modules.filter((mod) => DEPLOYABLE_STATUSES.includes(mod.status)).length,
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
    completionPercent: 96,
    stage: "Patient Twin · identity spine",
    description:
      "Patient identity substrate, digital twin continuity, media timelines, and cross-module event spine for longitudinal intelligence.",
    status: "Infrastructure Complete",
    learnMoreHref: "/patient-twin",
  },
  {
    id: "reception-os",
    name: "ReceptionOS",
    completionPercent: 94,
    stage: "Phase 5 · front-desk command centre",
    description: "Front-desk command centre — arrival board, task orchestration, outbound comms, and pilot metrics.",
    status: "Production",
    learnMoreHref: "/fi-admin",
  },
  {
    id: "consultation-os",
    name: "ConsultationOS",
    completionPercent: 89,
    stage: "Workflow engine · conversion pathways",
    description: "Structured consultation forms, pathway launcher, quote acceptance, and conversion intelligence.",
    status: "Production",
  },
  {
    id: "financial-os",
    name: "FinancialOS",
    completionPercent: 88,
    stage: "Executive finance intelligence",
    description:
      "Master ledger, surgery profitability, revenue attribution, accounts receivable, and executive forecasting — plus payment pathways and finance applications.",
    status: "Production",
    learnMoreHref: "/platform/progress#progress-financial-os",
  },
  {
    id: "surgery-os",
    name: "SurgeryOS",
    completionPercent: 92,
    stage: "Graft intelligence · procedure-day command",
    description: "Procedure-day command centre, live capture, graft intelligence foundation, and clinical safety guardrails.",
    status: "Production",
    learnMoreHref: "/platform/surgery-os",
  },
  {
    id: "imaging-os",
    name: "ImagingOS",
    completionPercent: 80,
    stage: "Live AI execution framework",
    description: "Template-driven photography sessions, slot progress, AI execution framework, and surgical-domain progression assessments.",
    status: "Pilot Ready",
    learnMoreHref: "/platform/imaging-os",
  },
  {
    id: "patient-os",
    name: "PatientOS",
    completionPercent: 78,
    stage: "Records · timelines · Patient Twin",
    description: "Longitudinal patient records, portal surfaces, and intelligence substrate for cohort learning.",
    status: "Production",
    learnMoreHref: "/platform/patient-os",
  },
  {
    id: "audit-os",
    name: "AuditOS",
    completionPercent: 86,
    stage: "HairAudit · patient exposure layer",
    description: "Independent audit workflows, HairAudit patient exposure layer, report surfaces, and network integration contracts.",
    status: "Pilot Ready",
    learnMoreHref: "/audit-network",
  },
  {
    id: "academy-os",
    name: "AcademyOS",
    completionPercent: 61,
    stage: "Competency · curriculum spine",
    description: "Training pathways, certification hooks, and institute-aligned competency tracking for clinical teams.",
    status: "Active Development",
    learnMoreHref: "/academy",
  },
  {
    id: "analytics-os",
    name: "AnalyticsOS",
    completionPercent: 57,
    stage: "Operational KPIs · funnel intelligence",
    description: "Conversion, productivity, and cohort analytics across reception, consultation, and financial surfaces.",
    status: "Active Development",
    learnMoreHref: "/platform/analytics-os",
  },
  {
    id: "clinic-os",
    name: "ClinicOS",
    completionPercent: 84,
    stage: "Operations centre · scheduling spine",
    description: "Calendars, services, appointment lifecycle, and day-to-day clinic rhythm for multi-site operators.",
    status: "Production",
    learnMoreHref: "/platform/clinic-os",
  },
  {
    id: "workforce-os",
    name: "WorkforceOS",
    completionPercent: 30,
    stage: "Identity · onboarding · tenant bootstrap",
    description:
      "Healthcare workforce infrastructure, onboarding, compliance, training readiness, and operational staff governance.",
    status: "Active Development",
  },
];

/** Public engineering changelog — append entries as milestones ship. */
export const PLATFORM_PROGRESS_CHANGELOG: PlatformProgressChangelogEntry[] = [
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

export function getLatestPlatformProgressChangelogEntry(
  entries: readonly PlatformProgressChangelogEntry[] = PLATFORM_PROGRESS_CHANGELOG
): PlatformProgressChangelogEntry | null {
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

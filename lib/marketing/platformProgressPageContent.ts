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

export const PLATFORM_PROGRESS_PAGE_CONTENT = {
  hero: {
    eyebrow: "Platform Progress",
    headline: "Engineering the complete hair restoration operating system",
    subtext:
      "Transparent delivery status across every Follicle Intelligence module — from infrastructure foundations through pilot-ready surfaces and production deployments.",
    lastUpdated: "2026-06-19",
  },

  summary: {
    eyebrow: "Delivery snapshot",
    headline: "Built in the open. Shipped with discipline.",
    intro:
      "Percentages reflect functional completeness against each module’s defined scope — schema, workflows, admin surfaces, integrations, and pilot hardening. Updated manually as milestones land.",
  },

  modules: {
    eyebrow: "Module grid",
    headline: "Eleven connected systems. One delivery spine.",
    intro: "Filter by status or scan completion across the FI OS surface area.",
  },

  changelog: {
    eyebrow: "Engineering changelog",
    headline: "What shipped recently",
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
    headline: "Built as a living operating system",
    description:
      "Follicle Intelligence is actively engineered and deployed module by module — with public delivery status across the full FI OS surface area.",
    cta: { label: "View platform progress", href: "/platform/progress" },
    latestUpdate: {
      title: "Latest platform update",
      readFullLogLabel: "Read full progress log",
      readFullLogHref: "/platform/progress#engineering-changelog",
    },
  },
} as const;

/** Featured modules surfaced on the public homepage highlight section. */
export const PLATFORM_PROGRESS_HOMEPAGE_FEATURED_MODULE_IDS = [
  "reception-os",
  "financial-os",
  "consultation-os",
  "surgery-os",
] as const;

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
    id: "reception-os",
    name: "ReceptionOS",
    completionPercent: 82,
    stage: "Phase 5 · delivery closeout",
    description: "Front-desk command centre — arrival board, task orchestration, outbound comms, and pilot metrics.",
    status: "Pilot Ready",
    learnMoreHref: "/fi-admin",
  },
  {
    id: "consultation-os",
    name: "ConsultationOS",
    completionPercent: 88,
    stage: "Forms engine · conversion pathways",
    description: "Structured consultation forms, pathway launcher, quote acceptance, and conversion intelligence.",
    status: "Production",
  },
  {
    id: "financial-os",
    name: "FinancialOS",
    completionPercent: 74,
    stage: "Deposits · installments · finance apps",
    description: "Payment pathways, deposit rules, finance applications, and revenue dashboards wired to case flow.",
    status: "Active Development",
  },
  {
    id: "surgery-os",
    name: "SurgeryOS",
    completionPercent: 71,
    stage: "Phase 2 · graft intelligence",
    description: "Procedure-day command centre, live capture, graft counting assistant, and clinical safety guardrails.",
    status: "Active Development",
    learnMoreHref: "/platform/surgery-os",
  },
  {
    id: "imaging-os",
    name: "ImagingOS",
    completionPercent: 76,
    stage: "Guided capture · progression mapping",
    description: "Template-driven photography sessions, slot progress, and surgical-domain progression assessments.",
    status: "Pilot Ready",
    learnMoreHref: "/platform/imaging-os",
  },
  {
    id: "patient-os",
    name: "PatientOS",
    completionPercent: 79,
    stage: "Records · timelines · Patient Twin",
    description: "Longitudinal patient records, portal surfaces, and intelligence substrate for cohort learning.",
    status: "Production",
    learnMoreHref: "/platform/patient-os",
  },
  {
    id: "audit-os",
    name: "AuditOS",
    completionPercent: 58,
    stage: "Evidence · scoring · network review",
    description: "Independent audit workflows, report surfaces, and HairAudit network integration contracts.",
    status: "Active Development",
    learnMoreHref: "/audit-network",
  },
  {
    id: "academy-os",
    name: "AcademyOS",
    completionPercent: 47,
    stage: "Competency · curriculum spine",
    description: "Training pathways, certification hooks, and institute-aligned competency tracking for clinical teams.",
    status: "Active Development",
    learnMoreHref: "/academy",
  },
  {
    id: "analytics-os",
    name: "AnalyticsOS",
    completionPercent: 63,
    stage: "Operational KPIs · funnel intelligence",
    description: "Conversion, productivity, and cohort analytics across reception, consultation, and financial surfaces.",
    status: "Active Development",
    learnMoreHref: "/platform/analytics-os",
  },
  {
    id: "leadflow",
    name: "LeadFlow",
    completionPercent: 67,
    stage: "Pipeline · tasks · acquisition",
    description: "CRM control plane — enquiry capture, pipeline stages, ownership, and follow-up rhythm.",
    status: "Pilot Ready",
    learnMoreHref: "/platform/leadflow",
  },
  {
    id: "clinic-os",
    name: "ClinicOS",
    completionPercent: 73,
    stage: "Operations centre · scheduling spine",
    description: "Calendars, services, appointment lifecycle, and day-to-day clinic rhythm for multi-site operators.",
    status: "Production",
    learnMoreHref: "/platform/clinic-os",
  },
];

/** Public engineering changelog — append entries as milestones ship. */
export const PLATFORM_PROGRESS_CHANGELOG: PlatformProgressChangelogEntry[] = [
  {
    id: "2026-06-19-financial-os-enterprise-intelligence",
    date: "2026-06-19",
    tag: "financial-os",
    title: "FinancialOS enterprise intelligence layer shipped",
    summary:
      "Added master financial ledger, surgery profitability, revenue attribution, accounts receivable, and executive finance forecasting across FI OS.",
    modules: ["FinancialOS"],
  },
  {
    id: "2026-06-19-surgery-graft-safety",
    date: "2026-06-19",
    tag: "surgery-os",
    title: "Graft counting assistant + clinical safety guardrails",
    summary:
      "Phase 2 graft intelligence surfaces: live graft totals, counting assistant UX, and clinical safety checks on the procedure-day command centre.",
    modules: ["SurgeryOS"],
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
    id: "2026-06-19-reception-comms",
    date: "2026-06-19",
    tag: "reception-os",
    title: "Outbound communication provider layer",
    summary:
      "Phase 4 communication contracts — provider interface, dry-run/stub providers, and enqueue paths from reception tasks.",
    modules: ["ReceptionOS"],
  },
  {
    id: "2026-06-19-reception-tasks",
    date: "2026-06-19",
    tag: "reception-os",
    title: "Reception task orchestration foundation",
    summary:
      "Task schema, persona widget defaults, and tenant-scoped board model for ReceptionOS operational personas.",
    modules: ["ReceptionOS"],
  },
  {
    id: "2026-06-18-imaging-progression",
    date: "2026-06-18",
    tag: "imaging-os",
    title: "Progression assessment → surgical domain mapping",
    summary: "ImagingOS phase IM6 — progression assessments mapped to surgical planning domains for case readiness.",
    modules: ["ImagingOS", "SurgeryOS"],
  },
  {
    id: "2026-06-17-financial-dashboard",
    date: "2026-06-17",
    tag: "financial-os",
    title: "FinancialOS dashboard + module switcher",
    summary:
      "Unified financial dashboard with deposit rules, installments, and in-page module navigation across FinancialOS surfaces.",
    modules: ["FinancialOS"],
  },
  {
    id: "2026-06-15-consultation-forms",
    date: "2026-06-15",
    tag: "consultation-os",
    title: "Consultation forms engine v2 pathways",
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

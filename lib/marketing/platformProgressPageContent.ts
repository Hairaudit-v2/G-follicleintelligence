/**
 * Live module progress + engineering changelog for `/platform/progress`.
 * Update percentages, stages, and status badges here — no layout changes required.
 */

import { buildGoogleCalendarPlatformProgressModule } from "@/src/lib/googleCalendar/googleCalendarIntegrationProgress";

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
  overallEcosystemPercent: 74,
  fiOsCorePlatformPercent: 86,
} as const;

/** Satellite and workforce platforms in the broader FI ecosystem. */
export const FI_ECOSYSTEM_PLATFORM_COMPLETION: FiEcosystemPlatformCompletion[] = [
  {
    id: "workforce-os",
    name: "WorkforceOS",
    completionPercent: 85,
    description:
      "Healthcare workforce infrastructure, onboarding, compliance, readiness scoring, clinical rostering, and active staffing orchestration.",
  },
  {
    id: "hairaudit",
    name: "HairAudit",
    completionPercent: 82,
    description: "Independent surgical audit, evidence capture, quality scoring, and outcome verification.",
    href: "https://hairaudit.com",
    external: true,
  },
  {
    id: "iiohr",
    name: "IIOHR Infrastructure",
    completionPercent: 78,
    description: "Training, certification, Nexus provisioning, and institute-aligned workforce standards.",
    href: "https://iiohr.com",
    external: true,
  },
  {
    id: "hli",
    name: "HLI Platform",
    completionPercent: 71,
    description: "Hair Longevity Institute diagnostics, treatment pathways, and longitudinal biology intelligence.",
    href: "https://hairlongevityinstitute.com",
    external: true,
  },
];

export const PLATFORM_PROGRESS_PAGE_CONTENT = {
  hero: {
    eyebrow: "Platform Progress",
    headline: "Engineering the complete hair restoration operating system",
    subtext:
      "Transparent delivery status across every Follicle Intelligence module — from infrastructure foundations through pilot-ready surfaces and production deployments.",
    lastUpdated: "2026-06-26",
  },

  summary: {
    eyebrow: "Delivery snapshot",
    headline: "Built in the open. Shipped with discipline.",
    intro:
      "Percentages reflect functional completeness across the FI ecosystem — core OS modules, workforce infrastructure, and connected satellite platforms including HairAudit, IIOHR, and HLI.",
  },

  modules: {
    eyebrow: "Module grid",
    headlineSuffix: "connected systems. One delivery spine.",
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
    headline: "Built as a Living Operating System",
    description:
      "Enterprise medical infrastructure in active development.",
    moduleCountLabel: "operating modules",
    descriptionClosing: "Weekly deployment. Production architecture operational.",
    cta: { label: "View Live Platform Progress", href: "/platform/progress" },
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
  "financial-os",
  "surgery-os",
] as const;

/** Latest infrastructure deployments for internal FI Admin dashboard. */
export const PLATFORM_RECENT_RELEASES: PlatformRecentRelease[] = [
  {
    id: "2026-06-26-calendar-os-gc6b",
    title: "CalendarOS GC-6B — Google inbound calendar scope admin",
    module: "Google Calendar Integration",
    date: "2026-06-26",
  },
  {
    id: "2026-06-26-calendar-os-gc-csp",
    title: "CalendarOS GC-CSP — Google Calendar CSP compatibility",
    module: "Google Calendar Integration",
    date: "2026-06-26",
  },
  {
    id: "2026-06-22-onboarding-os-phase-f5",
    title: "OnboardingOS Phase F5 — Staged Import Engine",
    module: "OnboardingOS",
    date: "2026-06-22",
  },
  {
    id: "2026-06-22-onboarding-os-phase-f3",
    title: "OnboardingOS Phase F3 — Google Calendar Read-Only Connector",
    module: "OnboardingOS",
    date: "2026-06-22",
  },
  {
    id: "2026-06-22-onboarding-os-phase-f2",
    title: "OnboardingOS Phase F2 — Connector Auth & Verification",
    module: "OnboardingOS",
    date: "2026-06-22",
  },
  {
    id: "2026-06-22-onboarding-os-phase-f1",
    title: "OnboardingOS Phase F1 — Legacy System Connector Layer",
    module: "OnboardingOS",
    date: "2026-06-22",
  },
  {
    id: "2026-06-22-onboarding-os-phase-e2",
    title: "OnboardingOS Deployment Intelligence Command Centre",
    module: "OnboardingOS",
    date: "2026-06-22",
  },
  {
    id: "2026-06-22-onboarding-os-phase-ab",
    title: "OnboardingOS clinic deployment templates",
    module: "OnboardingOS",
    date: "2026-06-22",
  },
  {
    id: "2026-06-22-workforce-roster-command-centre",
    title: "WorkforceOS Roster Command Centre",
    module: "WorkforceOS",
    date: "2026-06-22",
  },
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
  const fiOsModuleAverage = computePlatformProgressEcosystemAverage(modules);
  return {
    overallEcosystemPercent: FI_ECOSYSTEM_COMPLETION_SUMMARY.overallEcosystemPercent,
    fiOsCorePlatformPercent: FI_ECOSYSTEM_COMPLETION_SUMMARY.fiOsCorePlatformPercent,
    /** @deprecated Use `overallEcosystemPercent` or `fiOsCorePlatformPercent` in UI copy. */
    ecosystemAverage: fiOsModuleAverage,
    fiOsModuleAverage,
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
    completionPercent: 78,
    stage: "Cross-platform intelligence event coverage",
    description:
      "Conversion, productivity, and cohort analytics across reception, consultation, and financial surfaces — plus deterministic executive health scoring from the AnalyticsOS event pipeline.",
    status: "Infrastructure Complete",
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
    completionPercent: 85,
    stage: "Roster Command Centre · assignment intelligence · ops integration",
    description:
      "Healthcare workforce infrastructure, onboarding, compliance, readiness scoring, clinical rostering, Roster Command Centre assignment editor, and SurgeryOS / ClinicOS staffing orchestration.",
    status: "Pilot Ready",
  },
  {
    id: "onboarding-os",
    name: "OnboardingOS",
    completionPercent: 74,
    stage: "Staged import engine",
    description:
      "Enterprise clinic deployment engine — tenant provisioning, deployment templates, sandbox training, Guided Assist, go-live readiness gates, Deployment Intelligence, and live read-only connectors. Phase F5 added a controlled staged import engine: approved HubSpot records can be reviewed, duplicate-checked, imported into FI, mapped to source records, and audited without write-back to HubSpot.",
    status: "Active Development",
  },
  buildGoogleCalendarPlatformProgressModule(),
];

/** Public engineering changelog — append entries as milestones ship. */
export const PLATFORM_PROGRESS_CHANGELOG: PlatformProgressChangelogEntry[] = [
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
  return `${modules.length} connected systems. One delivery spine.`;
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

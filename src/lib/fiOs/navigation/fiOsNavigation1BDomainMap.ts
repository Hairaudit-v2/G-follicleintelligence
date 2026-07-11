/**
 * FI-UX-REBUILD-1B workflow domain mapping for navigation drift audit (D6G-A).
 * Maps current nav ids, labels, and route suffixes to role-first workflow domains.
 */

export const FI_OS_1B_WORKFLOW_DOMAINS = [
  "Today",
  "Calendar",
  "Front Desk",
  "Patients",
  "Pipeline",
  "Clinical",
  "Surgery",
  "Finance",
  "Team",
  "Reports",
  "Settings",
] as const;

export type FiOs1BWorkflowDomain = (typeof FI_OS_1B_WORKFLOW_DOMAINS)[number];

export type FiOsNav1BMappingEntry = {
  domain: FiOs1BWorkflowDomain;
  /** When the same surface can legitimately sit in two 1B domains by route context. */
  alternateDomain?: FiOs1BWorkflowDomain;
  notes?: string;
};

/** Canonical 1B domain per primary nav id (fiOsShellPrimaryNav). */
export const FI_OS_NAV_1B_DOMAIN_BY_ID: Record<string, FiOsNav1BMappingEntry> = {
  dashboard: { domain: "Today" },
  calendar: { domain: "Calendar" },
  "front-desk": { domain: "Front Desk", notes: "Consolidated front desk workspace" },
  "operations-centre": { domain: "Front Desk", notes: "Clinic flow operational board" },
  "reception-os": { domain: "Front Desk", notes: "Front desk reception workspace" },
  "reception-board": { domain: "Front Desk", notes: "Same-day reception board" },
  "tomorrow-board": { domain: "Front Desk", notes: "Next-day preparation board" },
  patients: { domain: "Patients" },
  "patient-twin": { domain: "Patients", notes: "Health record / patient twin" },
  crm: { domain: "Pipeline", notes: "Enquiries workspace" },
  "follow-up-queue": { domain: "Pipeline", notes: "Follow-ups in enquiry pipeline" },
  consultations: {
    domain: "Pipeline",
    alternateDomain: "Clinical",
    notes: "Conversion board is pipeline; live consult workspace is clinical",
  },
  surgery: { domain: "Surgery", notes: "Consolidated surgery workspace" },
  cases: { domain: "Surgery" },
  "surgery-os": { domain: "Surgery" },
  "doctor-workspace": { domain: "Clinical" },
  prescriptions: { domain: "Clinical" },
  "pathology-nav": { domain: "Clinical" },
  "payments-inbox": { domain: "Finance" },
  "financial-os": { domain: "Finance" },
  reports: { domain: "Reports", notes: "Consolidated reports workspace" },
  analytics: { domain: "Reports", notes: "Insights / analytics" },
  auditos: { domain: "Reports", notes: "Quality review" },
  "analytics-legacy": { domain: "Reports" },
  "auditos-legacy": { domain: "Reports" },
  "insights-legacy": { domain: "Reports" },
  "financial-os-legacy": { domain: "Reports" },
  "payments-inbox-legacy": { domain: "Reports" },
  team: { domain: "Team", notes: "Consolidated team workspace" },
  staff: { domain: "Team" },
  "onboarding-centre": { domain: "Team" },
  "hr-os": { domain: "Team", notes: "Legacy HR dashboard" },
  "workforce-os-hub": { domain: "Team" },
  "hr-os-dashboard": { domain: "Team" },
  "staff-directory-legacy": { domain: "Team" },
  academyos: { domain: "Team" },
  settings: { domain: "Settings" },
  // Sub-item ids
  "leadflow-dashboard": { domain: "Pipeline" },
  "crm-workspace": { domain: "Pipeline" },
  "consultation-conversion-board": { domain: "Pipeline" },
  "cases-worklist": { domain: "Surgery" },
  "surgery-os-command-centre": { domain: "Surgery" },
  "surgery-intelligence-dashboard": { domain: "Surgery" },
  "surgery-readiness-board": { domain: "Surgery" },
  "procedure-day-board": { domain: "Surgery", notes: "Procedure day tab inside surgery workflow" },
  "pathology-inbox": { domain: "Clinical" },
  "pathology-email-routes": { domain: "Settings", notes: "Admin configuration under clinical labs" },
  "front-desk-today": { domain: "Front Desk" },
  "front-desk-tomorrow": { domain: "Front Desk" },
  "front-desk-reception-operations": { domain: "Front Desk" },
  "front-desk-clinic-flow": { domain: "Front Desk" },
  "front-desk-reception-board": { domain: "Front Desk" },
  "front-desk-tomorrow": { domain: "Front Desk" },
  "reception-board-command": { domain: "Front Desk" },
  "surgery-command": { domain: "Surgery" },
  "surgery-cases": { domain: "Surgery" },
  "surgery-procedure-day": { domain: "Surgery" },
  "surgery-review": { domain: "Surgery" },
  "graft-counting-legacy": { domain: "Surgery" },
  "team-overview": { domain: "Team" },
  "team-staff": { domain: "Team" },
  "team-roster": { domain: "Team" },
  "team-onboarding": { domain: "Team" },
  "team-compliance": { domain: "Team" },
  "team-training": { domain: "Team" },
  "team-identity": { domain: "Team" },
  "roster-command-legacy": { domain: "Team" },
  "compliance-legacy": { domain: "Team" },
  "certifications-legacy": { domain: "Team" },
  "credentials-legacy": { domain: "Team" },
  "staff-identity-audit": { domain: "Team" },
  "staff-access-legacy": { domain: "Team" },
  "reports-overview": { domain: "Reports" },
  "reports-analytics": { domain: "Reports" },
  "reports-quality": { domain: "Reports" },
  "reports-surgery": { domain: "Reports" },
  "reports-performance": { domain: "Reports" },
  "reports-admin": { domain: "Reports" },
};

/** Label overrides when id is absent (quick-create, D6 routes). */
export const FI_OS_NAV_1B_DOMAIN_BY_LABEL: Record<string, FiOs1BWorkflowDomain> = {
  Today: "Today",
  Calendar: "Calendar",
  "Clinic flow": "Front Desk",
  "Front desk": "Front Desk",
  "Reception board": "Front Desk",
  "Tomorrow board": "Front Desk",
  Enquiries: "Pipeline",
  "Follow-ups": "Pipeline",
  Consultations: "Pipeline",
  Patients: "Patients",
  "Health record": "Patients",
  Cases: "Surgery",
  Surgery: "Surgery",
  "Surgery intelligence": "Surgery",
  "Ready for surgery": "Surgery",
  "Readiness board": "Surgery",
  "Surgery day": "Surgery",
  "Procedure day": "Surgery",
  "Doctor overview": "Clinical",
  "Doctor workspace": "Clinical",
  Overview: "Surgery",
  Prescriptions: "Clinical",
  Pathology: "Clinical",
  Payments: "Finance",
  Finances: "Finance",
  Insights: "Reports",
  "Quality review": "Reports",
  Staff: "Team",
  Onboarding: "Team",
  "Onboarding Centre": "Team",
  Team: "Team",
  Academy: "Team",
  Settings: "Settings",
  More: "Today",
  Search: "Today",
  New: "Today",
};

/** Route suffix (after tenant base) → 1B domain for D6 intelligence and deep links. */
export const FI_OS_ROUTE_SUFFIX_1B_DOMAIN: Record<string, FiOs1BWorkflowDomain> = {
  intelligence: "Reports",
  "intelligence/presence": "Reports",
  "intelligence/signal-learning": "Reports",
  "intelligence/d6-bake": "Reports",
  "intelligence/navigation-audit": "Reports",
  "surgery-os/intelligence": "Surgery",
  "surgery-readiness": "Surgery",
  "procedure-day": "Surgery",
  "front-desk": "Front Desk",
  "front-desk/clinic-flow": "Front Desk",
  "front-desk/reception-board": "Front Desk",
  "front-desk/tomorrow": "Front Desk",
  surgery: "Surgery",
  "surgery/cases": "Surgery",
  "surgery/procedure-day": "Surgery",
  "surgery/review": "Surgery",
  team: "Team",
  "team/staff": "Team",
  "team/roster": "Team",
  "team/onboarding": "Team",
  "team/compliance": "Team",
  "team/training": "Team",
  "team/identity": "Team",
  "workforce-os": "Team",
  "hr-os": "Team",
  "hr-os/onboarding": "Team",
  "hr-os/compliance": "Team",
  "hr-os/certifications": "Team",
  "hr-os/credentials": "Team",
  "workforce-os/roster": "Team",
  "workforce-os/staff-access": "Team",
  "workforce-os/staff-identity-audit": "Team",
  academy: "Team",
  reports: "Reports",
  "reports/analytics": "Reports",
  "reports/quality": "Reports",
  "reports/surgery": "Reports",
  "reports/performance": "Reports",
  "reports/admin": "Reports",
  insights: "Reports",
};

/** D6 internal intelligence surfaces (not in primary sidebar today). */
export const FI_OS_D6_INTELLIGENCE_NAV_ENTRIES: ReadonlyArray<{
  id: string;
  label: string;
  routeSuffix: string;
  domain: FiOs1BWorkflowDomain;
}> = [
  {
    id: "d6-presence",
    label: "Arrival confirmation",
    routeSuffix: "intelligence/presence",
    domain: "Reports",
  },
  {
    id: "d6-signal-learning",
    label: "Priority tuning",
    routeSuffix: "intelligence/signal-learning",
    domain: "Reports",
  },
  {
    id: "d6-bake",
    label: "Intelligence validation",
    routeSuffix: "intelligence/d6-bake",
    domain: "Reports",
  },
  {
    id: "d6-navigation-audit",
    label: "Navigation audit",
    routeSuffix: "intelligence/navigation-audit",
    domain: "Reports",
  },
];

const OS_SUFFIX_IN_LABEL_RE = /\b(?!FI\b)\w+\s*OS\b/i;
/** Architecture / product-module language that must not appear in ordinary staff nav labels. */
const MODULE_LANGUAGE_LABEL_RE =
  /\b(Patient\s+Twin|Digital\s+Twin|Command\s+Cent(?:re|er)|Procedure\s+Day|Readiness\s+Board|LeadFlow|Audit\s+Intelligence|Workforce\s+Intelligence|Onboarding\s+Centre|Intelligence\s+Centre|Access\s+Centre|Global\s+Command)\b/i;

export function mapNavIdTo1BDomain(navId: string): FiOs1BWorkflowDomain | null {
  const entry = FI_OS_NAV_1B_DOMAIN_BY_ID[navId.trim()];
  return entry?.domain ?? null;
}

export function mapNavLabelTo1BDomain(label: string): FiOs1BWorkflowDomain | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  return FI_OS_NAV_1B_DOMAIN_BY_LABEL[trimmed] ?? null;
}

export function mapRouteSuffixTo1BDomain(routeSuffix: string): FiOs1BWorkflowDomain | null {
  const norm = routeSuffix.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!norm) return "Today";
  return FI_OS_ROUTE_SUFFIX_1B_DOMAIN[norm] ?? null;
}

export function resolve1BDomainForNavItem(input: {
  id: string;
  label: string;
  routeSuffix?: string | null;
}): FiOs1BWorkflowDomain | null {
  return (
    mapNavIdTo1BDomain(input.id) ??
    (input.routeSuffix ? mapRouteSuffixTo1BDomain(input.routeSuffix) : null) ??
    mapNavLabelTo1BDomain(input.label)
  );
}

/** Staff-facing labels that violate 1B “workflows not modules” principle. */
export function labelHasLegacyModuleLanguage(label: string): boolean {
  const t = label.trim();
  if (!t) return false;
  if (OS_SUFFIX_IN_LABEL_RE.test(t)) return true;
  if (MODULE_LANGUAGE_LABEL_RE.test(t)) return true;
  if (/\bCentre\b/i.test(t) && !/^front desk$/i.test(t)) return true;
  return false;
}

export function labelHasOsSuffix(label: string): boolean {
  return OS_SUFFIX_IN_LABEL_RE.test(label.trim());
}
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";

/**
 * FI OS Stage 4 — map URL path suffix (under `/fi-admin/[tenantId]/`) to a {@link FiFeatureKey}.
 * Unknown suffixes return `null` (no additional feature gate).
 */
export function normalizeFiAdminTenantPathSuffix(pathname: string, tenantBase: string): string {
  const p = pathname.trim();
  const b = tenantBase.replace(/\/+$/, "");
  if (!p.startsWith(b)) return "";
  let rest = p.slice(b.length);
  if (rest.startsWith("/")) rest = rest.slice(1);
  const q = rest.indexOf("?");
  const pathOnly = q === -1 ? rest : rest.slice(0, q);
  return pathOnly.replace(/\/+$/, "");
}

const RULES: readonly { test: (full: string) => boolean; feature: FiFeatureKey | null }[] = [
  { test: (f) => f === "" || f === "dashboard", feature: "dashboard" },
  { test: (f) => /^patients\/[^/]+\/twin(\/|$)/.test(f), feature: "patient_twin" },
  { test: (f) => /^patients\/[^/]+\/imaging(\/|$)/.test(f), feature: "imaging" },
  {
    test: (f) =>
      f.startsWith("patients/") &&
      (/(^|\/)pathology-/i.test(f) || /(^|\/)pathology\//i.test(f) || /pathology_results/i.test(f)),
    feature: "pathology",
  },
  { test: (f) => f.startsWith("patients/"), feature: "patients" },
  {
    test: (f) => f === "foundation-integrity" || f.startsWith("foundation-integrity/"),
    feature: "patient_twin",
  },
  { test: (f) => f === "crm" || f.startsWith("crm/"), feature: "crm" },
  { test: (f) => f === "leadflow" || f.startsWith("leadflow/"), feature: "crm" },
  { test: (f) => f === "leads" || f.startsWith("leads/"), feature: "crm" },
  /** Staged leads/contacts inbox (import review) */
  { test: (f) => f === "inbox" || f.startsWith("inbox/"), feature: "crm" },
  { test: (f) => f === "calendar" || f.startsWith("calendar/"), feature: "calendar" },
  { test: (f) => f === "appointments" || f.startsWith("appointments/"), feature: "calendar" },
  { test: (f) => f === "bookings" || f.startsWith("bookings/"), feature: "calendar" },
  { test: (f) => f === "tomorrow" || f.startsWith("tomorrow/"), feature: "calendar" },
  {
    test: (f) => f === "front-desk/tomorrow" || f.startsWith("front-desk/tomorrow/"),
    feature: "calendar",
  },
  { test: (f) => f === "front-desk" || f.startsWith("front-desk/"), feature: "dashboard" },
  { test: (f) => f === "operations" || f.startsWith("operations/"), feature: "dashboard" },
  {
    test: (f) => f === "reception-board" || f.startsWith("reception-board/"),
    feature: "dashboard",
  },
  { test: (f) => f === "reception-os" || f.startsWith("reception-os/"), feature: "dashboard" },
  { test: (f) => f === "reception" || f.startsWith("reception/"), feature: "dashboard" },
  {
    test: (f) => f === "surgery/procedure-day" || f.startsWith("surgery/procedure-day/"),
    feature: "procedure_day",
  },
  { test: (f) => f === "surgery/cases" || f.startsWith("surgery/cases/"), feature: "cases" },
  {
    test: (f) => f === "surgery/review" || f.startsWith("surgery/review/"),
    feature: "surgery_pipeline",
  },
  { test: (f) => f === "surgery" || f.startsWith("surgery/"), feature: "surgery_pipeline" },
  { test: (f) => f === "surgery-os" || f.startsWith("surgery-os/"), feature: "surgery_pipeline" },
  { test: (f) => f === "system-status" || f.startsWith("system-status/"), feature: "settings" },
  { test: (f) => f === "configuration" || f.startsWith("configuration/"), feature: "settings" },
  // Personal Clinic guide on/off — every tenant member (not admin-settings gated).
  // Must stay above the general `settings/*` rule so staff without the settings module can toggle.
  {
    test: (f) => f === "settings/clinic-guide" || f.startsWith("settings/clinic-guide/"),
    feature: null,
  },
  { test: (f) => f === "settings" || f.startsWith("settings/"), feature: "settings" },
  { test: (f) => f === "services" || f.startsWith("services/"), feature: "settings" },
  { test: (f) => f === "rooms" || f.startsWith("rooms/"), feature: "settings" },
  { test: (f) => f === "doctor" || f.startsWith("doctor/"), feature: "consultations" },
  {
    test: (f) => f === "consultations" || f.startsWith("consultations/"),
    feature: "consultations",
  },
  {
    test: (f) => f === "consultation-conversion" || f.startsWith("consultation-conversion/"),
    feature: "consultations",
  },
  { test: (f) => /(^|\/)procedure-day(\/|$)/.test(f), feature: "procedure_day" },
  { test: (f) => f === "cases" || f.startsWith("cases/"), feature: "cases" },
  {
    test: (f) => f === "surgery-readiness" || f.startsWith("surgery-readiness/"),
    feature: "cases",
  },
  {
    test: (f) => f === "prescriptions" || f.startsWith("prescriptions/"),
    feature: "prescriptions",
  },
  {
    test: (f) => f === "medication-reorders" || f.startsWith("medication-reorders/"),
    feature: "prescriptions",
  },
  { test: (f) => f === "audit" || f.startsWith("audit/"), feature: "audit" },
  { test: (f) => f === "academy" || f.startsWith("academy/"), feature: "academy" },
  { test: (f) => f === "payments" || f.startsWith("payments/"), feature: "settings" },
  { test: (f) => f === "financial-os" || f.startsWith("financial-os/"), feature: "settings" },
  { test: (f) => f === "financial" || f.startsWith("financial/"), feature: "settings" },
  { test: (f) => f === "reports/quality" || f.startsWith("reports/quality/"), feature: "audit" },
  {
    test: (f) => f === "reports/surgery" || f.startsWith("reports/surgery/"),
    feature: "surgery_pipeline",
  },
  {
    test: (f) => f === "reports/performance" || f.startsWith("reports/performance/"),
    feature: "settings",
  },
  { test: (f) => f === "reports" || f.startsWith("reports/"), feature: "analytics" },
  { test: (f) => f === "team/roster" || f.startsWith("team/roster/"), feature: "staff" },
  { test: (f) => f === "team" || f.startsWith("team/"), feature: "staff" },
  { test: (f) => f === "staff" || f.startsWith("staff/"), feature: "staff" },
  { test: (f) => f.startsWith("hr/"), feature: "staff" },
  { test: (f) => f === "workforce-os" || f.startsWith("workforce-os/"), feature: "staff" },
  { test: (f) => f === "hr-os" || f.startsWith("hr-os/"), feature: "staff" },
];

/**
 * @param suffix from {@link normalizeFiAdminTenantPathSuffix} (no leading slash, no query)
 */
export function resolveRequiredFiFeatureForTenantSuffix(suffix: string): FiFeatureKey | null {
  const s = suffix.trim();
  for (const r of RULES) {
    if (r.test(s)) return r.feature;
  }
  return null;
}

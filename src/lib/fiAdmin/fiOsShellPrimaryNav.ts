import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { getClinicOsShellActiveNavId } from "@/src/lib/fiAdmin/clinicOsShellConfig";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { tenantAdminRoleAllowsBookingsBoardNav } from "@/src/lib/tenantAdmin/tenantAdminRoles";

export type FiOsPrimarySidebarSubItem = {
  id: string;
  label: string;
  href: string;
  /** Stage 2: optional UI visibility key (does not replace route guards). */
  featureKey?: FiFeatureKey;
};

export type FiOsPrimarySidebarItem = {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  disabled: boolean;
  /** Shown when disabled (permissions / coming soon). */
  hint?: string;
  /** Nested links (SurgeryOS readiness, ConsultationOS conversion). */
  subItems?: FiOsPrimarySidebarSubItem[];
  /** Stage 2: optional UI visibility key (does not replace route guards). */
  featureKey?: FiFeatureKey;
  /** When set, row stays visible if any listed feature is enabled (Stage 2 UI only). */
  anyOfFeatures?: readonly FiFeatureKey[];
};

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "") || "";
}

function hrefFor(base: string, path: string): string {
  const b = normalizeBase(base);
  const p = path.trim();
  if (!p) return b;
  return `${b}/${p}`;
}

function primaryNavClinicalBlocks(role: FiTenantAdminRole | null | undefined): {
  calendar: boolean;
  cases: boolean;
  rx: boolean;
  doctor: boolean;
  patients: boolean;
  patientTwin: boolean;
  analytics: boolean;
  audit: boolean;
} {
  if (!role) {
    return { calendar: false, cases: false, rx: false, doctor: false, patients: false, patientTwin: false, analytics: false, audit: false };
  }
  if (role === "clinic_admin") {
    return { calendar: false, cases: false, rx: false, doctor: false, patients: false, patientTwin: false, analytics: false, audit: false };
  }
  if (role === "operations_admin") {
    return { calendar: false, cases: false, rx: true, doctor: true, patients: false, patientTwin: false, analytics: false, audit: false };
  }
  if (role === "finance_admin") {
    return { calendar: true, cases: true, rx: true, doctor: true, patients: true, patientTwin: true, analytics: false, audit: false };
  }
  if (role === "dashboard_viewer") {
    return { calendar: true, cases: true, rx: true, doctor: true, patients: true, patientTwin: true, analytics: false, audit: false };
  }
  if (role === "data_safety_admin") {
    return { calendar: true, cases: true, rx: true, doctor: true, patients: true, patientTwin: true, analytics: false, audit: false };
  }
  return { calendar: false, cases: false, rx: false, doctor: false, patients: false, patientTwin: false, analytics: false, audit: false };
}

/**
 * Primary FI OS sidebar — one entry per top-level module (product requirement).
 * Visibility mirrors `showCrmNav` / `showBookingsBoard` from `crmShellAccess` (same as legacy nav).
 */
export function resolveFiOsPrimarySidebarItems(
  base: string,
  showCrmNav: boolean,
  showBookingsBoard: boolean,
  tenantBackendAdminRole?: FiTenantAdminRole | null,
  showAuditOsNav: boolean = true,
  showConfigurationHubNav: boolean = true,
  showFiPaymentsInboxNav: boolean = false
): FiOsPrimarySidebarItem[] {
  const b = normalizeBase(base);
  const blocks = primaryNavClinicalBlocks(tenantBackendAdminRole ?? null);
  const auditDisabled =
    tenantBackendAdminRole != null ? !showAuditOsNav : blocks.audit;
  const calendarEligible = showBookingsBoard || tenantAdminRoleAllowsBookingsBoardNav(tenantBackendAdminRole ?? null);
  const items: FiOsPrimarySidebarItem[] = [
    { id: "dashboard", featureKey: "dashboard", label: "Dashboard", shortLabel: "Home", href: b, disabled: false },
    {
      id: "doctor-workspace",
      featureKey: "consultations",
      label: "Doctor workspace",
      shortLabel: "Doctor",
      href: hrefFor(b, "doctor"),
      disabled: !showBookingsBoard || blocks.doctor,
      hint:
        !showBookingsBoard || blocks.doctor
          ? "Requires bookings operator access and a clinical role for this tenant."
          : undefined,
    },
    {
      id: "calendar",
      featureKey: "calendar",
      label: "Calendar",
      shortLabel: "Cal",
      href: hrefFor(b, "calendar"),
      disabled: !calendarEligible || blocks.calendar,
      hint:
        !calendarEligible || blocks.calendar
          ? "Operational calendar requires bookings operator access or an operations/clinic admin role."
          : undefined,
    },
    {
      id: "operations-centre",
      featureKey: "dashboard",
      label: "Operations centre",
      shortLabel: "Ops",
      href: hrefFor(b, "operations"),
      disabled: false,
    },
    {
      id: "reception-os",
      featureKey: "dashboard",
      label: "ReceptionOS",
      shortLabel: "RecOS",
      href: hrefFor(b, "reception-os"),
      disabled: false,
    },
    {
      id: "reception-board",
      featureKey: "dashboard",
      label: "Reception board",
      shortLabel: "Rec",
      href: hrefFor(b, "reception"),
      disabled: false,
    },
    {
      id: "tomorrow-board",
      featureKey: "calendar",
      label: "Tomorrow board",
      shortLabel: "Tmrw",
      href: hrefFor(b, "tomorrow"),
      disabled: false,
    },
    {
      id: "patients",
      featureKey: "patients",
      label: "Patients",
      shortLabel: "Patients",
      href: hrefFor(b, "patients"),
      disabled: !showBookingsBoard || blocks.patients,
      hint: !showBookingsBoard || blocks.patients ? "Requires bookings operator access for this tenant." : undefined,
    },
    {
      id: "crm",
      featureKey: "crm",
      label: "Leads",
      shortLabel: "Leads",
      href: hrefFor(b, "crm"),
      disabled: !showCrmNav,
      hint: !showCrmNav ? "Requires CRM shell role for this tenant." : undefined,
    },
    {
      id: "follow-up-queue",
      featureKey: "crm",
      label: "Follow ups",
      shortLabel: "Tasks",
      href: hrefFor(b, "crm"),
      disabled: !showCrmNav,
      hint: !showCrmNav ? "Requires CRM shell role for this tenant." : "Lead pipeline and follow-up tasks live in the same workspace.",
    },
    {
      id: "consultations",
      featureKey: "consultations",
      label: "Consultations",
      shortLabel: "Consult",
      href: hrefFor(b, "consultations"),
      disabled: !showBookingsBoard && !showCrmNav,
      hint:
        !showBookingsBoard && !showCrmNav
          ? "Requires bookings operator or CRM shell access for this tenant."
          : undefined,
      subItems:
        !showBookingsBoard && !showCrmNav
          ? undefined
          : [
              {
                id: "consultation-conversion-board",
                featureKey: "consultations",
                label: "Conversion board",
                href: hrefFor(b, "consultation-conversion"),
              },
            ],
    },
    {
      id: "cases",
      featureKey: "cases",
      label: "Cases",
      shortLabel: "Cases",
      href: hrefFor(b, "cases"),
      disabled: blocks.cases,
      hint: blocks.cases ? "Surgery case workspace is not enabled for this admin role." : undefined,
      subItems: blocks.cases
        ? undefined
        : [
            { id: "cases-worklist", featureKey: "cases", label: "Case worklist", href: hrefFor(b, "cases") },
            {
              id: "surgery-readiness-board",
              featureKey: "cases",
              label: "Readiness board",
              href: hrefFor(b, "surgery-readiness"),
            },
            {
              id: "procedure-day-board",
              featureKey: "procedure_day",
              label: "Procedure day",
              href: hrefFor(b, "procedure-day"),
            },
          ],
    },
    {
      id: "prescriptions",
      featureKey: "prescriptions",
      label: "Prescriptions",
      shortLabel: "Rx",
      href: hrefFor(b, "prescriptions"),
      disabled: blocks.rx,
      hint: blocks.rx ? "Prescribing is not enabled for this admin role." : undefined,
    },
    {
      id: "pathology-nav",
      featureKey: "pathology",
      label: "Pathology",
      shortLabel: "Labs",
      href: hrefFor(b, "patients"),
      disabled: blocks.patients,
      hint: blocks.patients
        ? "Requires bookings operator access for this tenant."
        : "Pathology requests and results are opened from patient records.",
    },
    {
      id: "patient-twin",
      featureKey: "patient_twin",
      label: "Patient Twin",
      shortLabel: "Twin",
      href: hrefFor(b, "foundation-integrity"),
      disabled: blocks.patientTwin,
      hint: blocks.patientTwin ? "Foundation integrity workspace is not enabled for this admin role." : undefined,
      anyOfFeatures: ["patient_twin", "imaging"],
    },
    {
      id: "auditos",
      featureKey: "audit",
      label: "Audit intelligence",
      shortLabel: "Audit",
      href: hrefFor(b, "audit"),
      disabled: auditDisabled,
      hint: auditDisabled ? "Audit intelligence requires security review access or a clinical tenant role." : undefined,
    },
    {
      id: "academyos",
      featureKey: "academy",
      label: "Academy",
      shortLabel: "Academy",
      href: "#",
      disabled: true,
      hint: "Coming soon.",
    },
    {
      id: "payments-inbox",
      label: "Payments",
      shortLabel: "Pay",
      href: hrefFor(b, "payments"),
      disabled: !showFiPaymentsInboxNav,
      hint: !showFiPaymentsInboxNav ? "RevenueOS payments are disabled (FI_PAYMENTS_ENABLED)." : undefined,
    },
    {
      id: "financial-os",
      featureKey: "settings",
      label: "FinancialOS",
      shortLabel: "Fin",
      href: hrefFor(b, "financial/dashboard"),
      disabled: false,
      subItems: [
        { id: "financial-dashboard", featureKey: "settings", label: "Financial dashboard", href: hrefFor(b, "financial/dashboard") },
        { id: "financial-invoices", featureKey: "settings", label: "Invoices", href: hrefFor(b, "financial/invoices") },
        { id: "financial-payments", featureKey: "settings", label: "Payments", href: hrefFor(b, "financial/payments") },
        { id: "financial-payment-requests", featureKey: "settings", label: "Payment requests", href: hrefFor(b, "financial/payment-requests") },
        { id: "financial-installments", featureKey: "settings", label: "Installments", href: hrefFor(b, "financial/installments") },
        { id: "financial-providers", featureKey: "settings", label: "Providers", href: hrefFor(b, "financial/providers") },
        { id: "financial-finance-applications", featureKey: "settings", label: "Finance Applications", href: hrefFor(b, "financial/finance-applications") },
        { id: "financial-super-release", featureKey: "settings", label: "Super Release", href: hrefFor(b, "financial/super-release") },
        { id: "financial-international-transfers", featureKey: "settings", label: "International Transfers", href: hrefFor(b, "financial/international-transfers") },
        { id: "financial-deposit-rules", featureKey: "settings", label: "Deposit rules", href: hrefFor(b, "financial/deposit-rules") },
      ],
    },
    {
      id: "analytics",
      featureKey: "analytics",
      label: "Analytics",
      shortLabel: "Analytics",
      href: hrefFor(b, "analytics"),
      disabled: blocks.analytics,
      hint: blocks.analytics ? "Analytics is hidden for this admin role." : undefined,
    },
    {
      id: "staff",
      featureKey: "staff",
      label: "Staff",
      shortLabel: "Staff",
      href: hrefFor(b, "staff"),
      disabled: false,
      hint: "People, roles, and workspace defaults for this clinic.",
    },
    {
      id: "settings",
      featureKey: "settings",
      label: "Settings",
      shortLabel: "Settings",
      href: hrefFor(b, "configuration"),
      disabled: !showConfigurationHubNav,
      hint: !showConfigurationHubNav
        ? "Configuration requires clinic, finance, operations, or admin-user management access."
        : undefined,
    },
  ];
  return items;
}

function fiFeatureVisibleForNav(access: ReadonlyMap<FiFeatureKey, boolean> | null, key?: FiFeatureKey): boolean {
  if (!access || !key) return true;
  return access.get(key) !== false;
}

function primarySidebarItemVisibleByFeatures(item: FiOsPrimarySidebarItem, access: ReadonlyMap<FiFeatureKey, boolean>): boolean {
  const keys =
    item.anyOfFeatures && item.anyOfFeatures.length > 0
      ? [...item.anyOfFeatures]
      : item.featureKey
        ? [item.featureKey]
        : [];
  if (!keys.length) return true;
  return keys.some((k) => fiFeatureVisibleForNav(access, k));
}

/**
 * Stage 2 UI visibility: removes primary-nav rows whose feature flag is off.
 * Does not alter `disabled` / RBAC-driven hints — callers should still resolve items with RBAC first.
 */
export function filterFiOsPrimarySidebarItemsByFeatureAccess(
  items: FiOsPrimarySidebarItem[],
  access: ReadonlyMap<FiFeatureKey, boolean> | null
): FiOsPrimarySidebarItem[] {
  if (!access) return items;
  const out: FiOsPrimarySidebarItem[] = [];
  for (const item of items) {
    if (!primarySidebarItemVisibleByFeatures(item, access)) continue;
    const rawSubs = item.subItems;
    if (rawSubs?.length) {
      const subs = rawSubs.filter((s) => fiFeatureVisibleForNav(access, s.featureKey));
      out.push(subs.length === rawSubs.length ? item : { ...item, subItems: subs.length ? subs : undefined });
    } else {
      out.push(item);
    }
  }
  return out;
}

/**
 * Maps legacy horizontal-nav ids (from URL segments) to a single primary sidebar tab.
 */
export function getFiOsShellActiveSidebarId(pathname: string, base: string): string | null {
  const nb = base.replace(/\/+$/, "") || "";
  const npRaw = pathname.replace(/\/+$/, "") || "/";
  if (npRaw.startsWith(nb)) {
    const restEarly = npRaw.slice(nb.length).replace(/^\//, "");
    const firstEarly = restEarly.split("/")[0] ?? "";
    if (firstEarly === "doctor") return "doctor-workspace";
    if (firstEarly === "operations") return "operations-centre";
    if (firstEarly === "reception-os") return "reception-os";
    if (firstEarly === "reception") return "reception-board";
    if (firstEarly === "tomorrow") return "tomorrow-board";
    if (firstEarly === "payments") return "payments-inbox";
    if (firstEarly === "financial") return "financial-os";
    if (firstEarly === "staff") return "staff";
  }

  const legacy = getClinicOsShellActiveNavId(pathname, base);
  if (legacy === "foundationos") return "patient-twin";
  if (legacy === "services" || legacy === "configuration") return "settings";
  if (legacy === "leadflow") return "crm";
  if (legacy === "operations-centre") return "operations-centre";
  if (legacy === "reception-os") return "reception-os";
  if (legacy === "reception-board") return "reception-board";
  if (legacy === "tomorrow-board") return "tomorrow-board";
  if (legacy === "surgeryos" || legacy === "surgery-readiness-board" || legacy === "procedure-day-board") return "cases";
  if (legacy === "prescriptions") return "prescriptions";
  if (legacy === "patientos") return "patients";
  if (legacy === "calendar") return "calendar";
  if (legacy === "consultation-conversion-board") return "consultations";
  if (legacy === "consultations") return "consultations";
  if (legacy === "dashboard") return "dashboard";
  if (legacy === "auditos") return "auditos";
  if (legacy === "analyticsos") return "analytics";
  if (legacy === "appointments" || legacy === "bookings") return "calendar";

  if (npRaw.startsWith(nb)) {
    const rest = npRaw.slice(nb.length).replace(/^\//, "");
    const first = rest.split("/")[0] ?? "";
    if (first === "payments") return "payments-inbox";
    if (first === "financial") return "financial-os";
    if (first === "system-status") return "calendar";
    if (first === "settings") return "settings";
  }

  return null;
}

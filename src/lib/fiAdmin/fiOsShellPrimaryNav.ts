import { getClinicOsShellActiveNavId } from "@/src/lib/fiAdmin/clinicOsShellConfig";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { tenantAdminRoleAllowsBookingsBoardNav } from "@/src/lib/tenantAdmin/tenantAdminRoles";

export type FiOsPrimarySidebarItem = {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  disabled: boolean;
  /** Shown when disabled (permissions / coming soon). */
  hint?: string;
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
  showConfigurationHubNav: boolean = true
): FiOsPrimarySidebarItem[] {
  const b = normalizeBase(base);
  const blocks = primaryNavClinicalBlocks(tenantBackendAdminRole ?? null);
  const auditDisabled =
    tenantBackendAdminRole != null ? !showAuditOsNav : blocks.audit;
  const calendarEligible = showBookingsBoard || tenantAdminRoleAllowsBookingsBoardNav(tenantBackendAdminRole ?? null);
  const items: FiOsPrimarySidebarItem[] = [
    { id: "dashboard", label: "Dashboard", shortLabel: "Home", href: b, disabled: false },
    {
      id: "doctor-workspace",
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
      id: "patients",
      label: "Patients",
      shortLabel: "Patients",
      href: hrefFor(b, "patients"),
      disabled: !showBookingsBoard || blocks.patients,
      hint: !showBookingsBoard || blocks.patients ? "Requires bookings operator access for this tenant." : undefined,
    },
    {
      id: "crm",
      label: "CRM / LeadFlow",
      shortLabel: "CRM",
      href: hrefFor(b, "crm"),
      disabled: !showCrmNav,
      hint: !showCrmNav ? "Requires CRM shell role for this tenant." : undefined,
    },
    {
      id: "cases",
      label: "Cases / SurgeryOS",
      shortLabel: "Cases",
      href: hrefFor(b, "cases"),
      disabled: blocks.cases,
      hint: blocks.cases ? "SurgeryOS is not enabled for this admin role." : undefined,
    },
    {
      id: "prescriptions",
      label: "Prescriptions",
      shortLabel: "Rx",
      href: hrefFor(b, "prescriptions"),
      disabled: blocks.rx,
      hint: blocks.rx ? "Prescribing is not enabled for this admin role." : undefined,
    },
    {
      id: "patient-twin",
      label: "Patient Twin",
      shortLabel: "Twin",
      href: hrefFor(b, "foundation-integrity"),
      disabled: blocks.patientTwin,
      hint: blocks.patientTwin ? "FoundationOS deep links are not enabled for this admin role." : undefined,
    },
    {
      id: "auditos",
      label: "AuditOS",
      shortLabel: "Audit",
      href: hrefFor(b, "audit"),
      disabled: auditDisabled,
      hint: auditDisabled ? "AuditOS requires security review access or a clinical tenant role." : undefined,
    },
    {
      id: "academyos",
      label: "AcademyOS",
      shortLabel: "Academy",
      href: "#",
      disabled: true,
      hint: "Coming soon.",
    },
    {
      id: "analytics",
      label: "AnalyticsOS",
      shortLabel: "Analytics",
      href: hrefFor(b, "analytics"),
      disabled: blocks.analytics,
      hint: blocks.analytics ? "Analytics is hidden for this admin role." : undefined,
    },
    {
      id: "settings",
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
  }

  const legacy = getClinicOsShellActiveNavId(pathname, base);
  if (legacy === "foundationos") return "patient-twin";
  if (legacy === "staff" || legacy === "services" || legacy === "configuration") return "settings";
  if (legacy === "leadflow") return "crm";
  if (legacy === "surgeryos") return "cases";
  if (legacy === "prescriptions") return "prescriptions";
  if (legacy === "patientos") return "patients";
  if (legacy === "calendar") return "calendar";
  if (legacy === "dashboard") return "dashboard";
  if (legacy === "auditos") return "auditos";
  if (legacy === "analyticsos") return "analytics";
  if (legacy === "appointments" || legacy === "bookings" || legacy === "consultations") return "calendar";

  if (npRaw.startsWith(nb)) {
    const rest = npRaw.slice(nb.length).replace(/^\//, "");
    const first = rest.split("/")[0] ?? "";
    if (first === "system-status") return "calendar";
    if (first === "settings") return "settings";
  }

  return null;
}

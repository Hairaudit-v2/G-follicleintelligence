import { getClinicOsShellActiveNavId } from "@/src/lib/fiAdmin/clinicOsShellConfig";

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

/**
 * Primary FI OS sidebar — one entry per top-level module (product requirement).
 * Visibility mirrors `showCrmNav` / `showBookingsBoard` from `crmShellAccess` (same as legacy nav).
 */
export function resolveFiOsPrimarySidebarItems(
  base: string,
  showCrmNav: boolean,
  showBookingsBoard: boolean
): FiOsPrimarySidebarItem[] {
  const b = normalizeBase(base);
  const items: FiOsPrimarySidebarItem[] = [
    { id: "dashboard", label: "Dashboard", shortLabel: "Home", href: b, disabled: false },
    {
      id: "doctor-workspace",
      label: "Doctor workspace",
      shortLabel: "Doctor",
      href: hrefFor(b, "doctor"),
      disabled: !showBookingsBoard,
      hint: !showBookingsBoard ? "Requires CRM shell role or active staff membership for this tenant." : undefined,
    },
    {
      id: "calendar",
      label: "Calendar",
      shortLabel: "Cal",
      href: hrefFor(b, "calendar"),
      disabled: false,
    },
    {
      id: "patients",
      label: "Patients",
      shortLabel: "Patients",
      href: hrefFor(b, "patients"),
      disabled: !showBookingsBoard,
      hint: !showBookingsBoard ? "Requires bookings operator access for this tenant." : undefined,
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
      disabled: false,
    },
    {
      id: "prescriptions",
      label: "Prescriptions",
      shortLabel: "Rx",
      href: hrefFor(b, "prescriptions"),
      disabled: false,
    },
    {
      id: "patient-twin",
      label: "Patient Twin",
      shortLabel: "Twin",
      href: hrefFor(b, "foundation-integrity"),
      disabled: false,
    },
    {
      id: "auditos",
      label: "AuditOS",
      shortLabel: "Audit",
      href: hrefFor(b, "audit"),
      disabled: false,
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
      disabled: false,
    },
    {
      id: "settings",
      label: "Settings",
      shortLabel: "Settings",
      href: hrefFor(b, "configuration"),
      disabled: false,
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
  }

  return null;
}

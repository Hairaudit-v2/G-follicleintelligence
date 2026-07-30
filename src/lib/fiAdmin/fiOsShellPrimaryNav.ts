import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { getClinicOsShellActiveNavId } from "@/src/lib/fiAdmin/clinicOsShellConfig";
import {
  buildFrontDeskSidebarSubItems,
  FI_OS_FRONT_DESK_NAV_ID,
} from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";
import {
  buildSurgerySidebarSubItems,
  FI_OS_SURGERY_NAV_ID,
} from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";
import {
  buildReportsSidebarSubItems,
  FI_OS_REPORTS_NAV_ID,
} from "@/src/lib/fiOs/reports/reportsWorkspaceCore";
import {
  buildTeamSidebarSubItems,
  buildTeamWorkspaceLandingHref,
  FI_OS_TEAM_NAV_ID,
  type FiOsTeamTabId,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";
import { buildSettingsSidebarSubItems } from "@/src/lib/fiOs/settings/settingsWorkspaceCore";
import { filterProcedureDayFromFiOsSidebarItems } from "@/src/lib/procedureDay/procedureDayNavCore";
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
  /** Nested links (Surgery readiness, Consultations conversion). */
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
    return {
      calendar: false,
      cases: false,
      rx: false,
      doctor: false,
      patients: false,
      patientTwin: false,
      analytics: false,
      audit: false,
    };
  }
  if (role === "clinic_admin") {
    return {
      calendar: false,
      cases: false,
      rx: false,
      doctor: false,
      patients: false,
      patientTwin: false,
      analytics: false,
      audit: false,
    };
  }
  if (role === "operations_admin") {
    return {
      calendar: false,
      cases: false,
      rx: true,
      doctor: true,
      patients: false,
      patientTwin: false,
      analytics: false,
      audit: false,
    };
  }
  if (role === "finance_admin") {
    return {
      calendar: true,
      cases: true,
      rx: true,
      doctor: true,
      // F-PILOT-18: Patients directory must stay reachable (balances / records), not Surgery cases.
      patients: false,
      patientTwin: true,
      analytics: false,
      audit: false,
    };
  }
  if (role === "dashboard_viewer") {
    return {
      calendar: true,
      cases: true,
      rx: true,
      doctor: true,
      patients: true,
      patientTwin: true,
      analytics: false,
      audit: false,
    };
  }
  if (role === "data_safety_admin") {
    return {
      calendar: true,
      cases: true,
      rx: true,
      doctor: true,
      patients: true,
      patientTwin: true,
      analytics: false,
      audit: false,
    };
  }
  return {
    calendar: false,
    cases: false,
    rx: false,
    doctor: false,
    patients: false,
    patientTwin: false,
    analytics: false,
    audit: false,
  };
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
  showFiPaymentsInboxNav: boolean = false,
  showHrOsNav: boolean = false,
  showProcedureDayNav: boolean = false,
  showSurgeryAdminSurfaces: boolean = false,
  showTeamAdminSurfaces: boolean = false,
  visibleTeamTabIds?: readonly FiOsTeamTabId[],
  showSettingsAdminSurfaces: boolean = false,
  showPilotControlNav: boolean = false
): FiOsPrimarySidebarItem[] {
  const b = normalizeBase(base);
  const blocks = primaryNavClinicalBlocks(tenantBackendAdminRole ?? null);
  const auditDisabled = tenantBackendAdminRole != null ? !showAuditOsNav : blocks.audit;
  const calendarEligible =
    showBookingsBoard || tenantAdminRoleAllowsBookingsBoardNav(tenantBackendAdminRole ?? null);
  const items: FiOsPrimarySidebarItem[] = [
    {
      id: "dashboard",
      featureKey: "dashboard",
      label: "Today",
      shortLabel: "Today",
      href: b,
      disabled: false,
    },
    {
      id: "doctor-workspace",
      featureKey: "consultations",
      label: "Doctor overview",
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
      id: FI_OS_FRONT_DESK_NAV_ID,
      featureKey: "dashboard",
      label: "Front desk",
      shortLabel: "Front",
      href: hrefFor(b, "front-desk"),
      disabled: false,
      hint: "Today’s clinic board and tomorrow prep.",
      subItems: buildFrontDeskSidebarSubItems(b.split("/").filter(Boolean).pop() ?? ""),
    },
    ...(showPilotControlNav
      ? [
          {
            id: "pilot-control",
            featureKey: "dashboard" as const,
            label: "Pilot Control Centre",
            shortLabel: "Pilot",
            href: hrefFor(b, "pilot-control"),
            disabled: false,
            hint: "Controlled Pilot · Clinic Operations readiness, blockers, and expansion health.",
          } satisfies FiOsPrimarySidebarItem,
        ]
      : []),
    {
      id: FI_OS_SURGERY_NAV_ID,
      featureKey: "surgery_pipeline",
      label: "Surgery",
      shortLabel: "Surgery",
      href: hrefFor(b, "surgery"),
      disabled: blocks.cases,
      hint: blocks.cases ? "Surgery workspace is not enabled for this admin role." : undefined,
      subItems: buildSurgerySidebarSubItems(b.split("/").filter(Boolean).pop() ?? "", {
        showProcedureDayNav,
        showSurgeryAdminSurfaces,
        casesBlocked: blocks.cases,
      }),
    },
    {
      id: "patients",
      featureKey: "patients",
      label: "Patients",
      shortLabel: "Patients",
      href: hrefFor(b, "patients"),
      disabled: !showBookingsBoard || blocks.patients,
      hint:
        !showBookingsBoard || blocks.patients
          ? "Requires bookings operator access for this tenant."
          : undefined,
    },
    {
      id: "crm",
      featureKey: "crm",
      label: "Pipeline",
      shortLabel: "Pipe",
      href: hrefFor(b, "crm"),
      disabled: !showCrmNav,
      hint: !showCrmNav ? "Requires CRM shell role for this tenant." : undefined,
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
      subItems: blocks.patients
        ? undefined
        : [
            {
              id: "pathology-inbox",
              featureKey: "pathology",
              label: "Results inbox",
              href: hrefFor(b, "pathology/inbox"),
            },
            {
              id: "pathology-email-routes",
              featureKey: "pathology",
              label: "Email routes",
              href: hrefFor(b, "configuration/pathology-email"),
            },
          ],
    },
    {
      id: "patient-twin",
      featureKey: "patient_twin",
      label: "Health record",
      shortLabel: "Record",
      href: hrefFor(b, "foundation-integrity"),
      disabled: blocks.patientTwin,
      hint: blocks.patientTwin
        ? "Health record workspace is not enabled for this admin role."
        : undefined,
      anyOfFeatures: ["patient_twin", "imaging"],
    },
    {
      id: FI_OS_REPORTS_NAV_ID,
      featureKey: "analytics",
      label: "Reports",
      shortLabel: "Reports",
      href: hrefFor(b, "reports"),
      disabled: blocks.analytics,
      hint: blocks.analytics ? "Reports are hidden for this admin role." : undefined,
      subItems: buildReportsSidebarSubItems(b.split("/").filter(Boolean).pop() ?? "", {
        showAuditOsNav: showAuditOsNav && !auditDisabled,
        showReportsAdminSurfaces: showTeamAdminSurfaces || showSurgeryAdminSurfaces,
      }),
    },
    {
      id: FI_OS_TEAM_NAV_ID,
      featureKey: "staff",
      label: "Team",
      shortLabel: "Team",
      href:
        visibleTeamTabIds && visibleTeamTabIds.length > 0
          ? buildTeamWorkspaceLandingHref(
              b.split("/").filter(Boolean).pop() ?? "",
              visibleTeamTabIds
            )
          : hrefFor(b, "team"),
      disabled: false,
      hint: "Staff operations, roster, onboarding, compliance, training, and access.",
      subItems: buildTeamSidebarSubItems(b.split("/").filter(Boolean).pop() ?? "", {
        showHrOsNav,
        visibleTabIds: visibleTeamTabIds,
        showTeamAdminSurfaces: showTeamAdminSurfaces || showSurgeryAdminSurfaces,
      }),
    },
    {
      id: "financial-os",
      featureKey: "settings",
      label: "Money",
      shortLabel: "Money",
      href: hrefFor(b, "financial-os"),
      disabled: false,
      hint: "Invoices, balances, pathways, and financial clearance.",
      // When FI_PAYMENTS_ENABLED is off, no separate Payments row — Money is the single door.
      subItems: showFiPaymentsInboxNav
        ? [
            {
              id: "payments-inbox",
              label: "Take payment",
              href: hrefFor(b, "payments"),
            },
          ]
        : undefined,
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
      subItems: buildSettingsSidebarSubItems(b.split("/").filter(Boolean).pop() ?? "", {
        showSettingsAdminSurfaces,
      }),
    },
  ];
  return filterProcedureDayFromFiOsSidebarItems(items, showProcedureDayNav);
}

function fiFeatureVisibleForNav(
  access: ReadonlyMap<FiFeatureKey, boolean> | null,
  key?: FiFeatureKey
): boolean {
  if (!access || !key) return true;
  return access.get(key) !== false;
}

function primarySidebarItemVisibleByFeatures(
  item: FiOsPrimarySidebarItem,
  access: ReadonlyMap<FiFeatureKey, boolean>
): boolean {
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
      out.push(
        subs.length === rawSubs.length
          ? item
          : { ...item, subItems: subs.length ? subs : undefined }
      );
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
  const pathOnly = pathname.split(/[?#]/)[0] ?? pathname;
  const nb = base.replace(/\/+$/, "") || "";
  const npRaw = pathOnly.replace(/\/+$/, "") || "/";
  if (npRaw.startsWith(nb)) {
    const restEarly = npRaw.slice(nb.length).replace(/^\//, "");
    const firstEarly = restEarly.split("/")[0] ?? "";
    if (
      firstEarly === "crm" ||
      firstEarly === "leadflow" ||
      firstEarly === "consultation-conversion"
    ) {
      return "crm";
    }
    if (firstEarly === "doctor") return "doctor-workspace";
    if (firstEarly === "front-desk") return FI_OS_FRONT_DESK_NAV_ID;
    if (firstEarly === "surgery") return FI_OS_SURGERY_NAV_ID;
    if (firstEarly === "team") return FI_OS_TEAM_NAV_ID;
    if (firstEarly === "reports") return FI_OS_REPORTS_NAV_ID;
    if (firstEarly === "analytics") return "analytics-legacy";
    if (firstEarly === "audit") return "auditos-legacy";
    if (firstEarly === "intelligence") {
      const secondEarly = restEarly.split("/")[1] ?? "";
      if (secondEarly === "presence") return "d6-presence";
      if (secondEarly === "signal-learning") return "d6-signal-learning";
      if (secondEarly === "d6-bake") return "d6-bake";
      if (secondEarly === "navigation-audit") return "d6-navigation-audit";
      return "d6-navigation-audit";
    }
    if (firstEarly === "operations") return "operations-centre";
    if (firstEarly === "reception-os") return "reception-os";
    if (firstEarly === "pilot-control") return "pilot-control";
    if (firstEarly === "reception-board") return "reception-board-command";
    if (firstEarly === "surgery-os") {
      const secondEarly = restEarly.split("/")[1] ?? "";
      if (secondEarly === "intelligence") return "surgery-intelligence-dashboard";
      if (secondEarly === "graft-counting") return "graft-counting-legacy";
      return "surgery-os";
    }
    if (firstEarly === "cases") return "cases-worklist";
    if (firstEarly === "procedure-day") return "procedure-day-board";
    if (firstEarly === "surgery-readiness") return "surgery-readiness-board";
    if (firstEarly === "reception") return "reception-board";
    if (firstEarly === "tomorrow") return "tomorrow-board";
    if (firstEarly === "payments") return "payments-inbox";
    if (firstEarly === "financial-os") return "financial-os";
    if (firstEarly === "financial") return "financial-os";
    if (firstEarly === "staff") return "staff-directory-legacy";
    if (firstEarly === "workforce-os") {
      const secondEarly = restEarly.split("/")[1] ?? "";
      if (secondEarly === "staff-identity-audit") return "staff-identity-audit";
      if (secondEarly === "staff-access") return "staff-access-legacy";
      if (secondEarly === "hr-task-map") return "hr-task-map-legacy";
      if (secondEarly === "roster") return "roster-command-legacy";
      return "workforce-os-hub";
    }
    if (firstEarly === "hr-os") {
      const secondEarly = restEarly.split("/")[1] ?? "";
      if (secondEarly === "onboarding") return "onboarding-centre";
      if (secondEarly === "compliance") return "compliance-legacy";
      if (secondEarly === "certifications") return "certifications-legacy";
      if (secondEarly === "credentials") return "credentials-legacy";
      if (secondEarly === "sync-health") return "hr-os-sync-health";
      if (secondEarly === "roster") return "roster-command-legacy";
      return "hr-os-dashboard";
    }
    if (firstEarly === "academy") return "academyos";
  }

  const legacy = getClinicOsShellActiveNavId(pathname, base);
  if (legacy === "foundationos") return "patient-twin";
  if (legacy === "services" || legacy === "configuration") return "settings";
  if (legacy === "leadflow") return "crm";
  if (legacy === "leadflow-crm") return "crm";
  if (legacy === "operations-centre") return "operations-centre";
  if (legacy === "reception-os") return "reception-os";
  if (legacy === "surgery-os") return "surgery-os";
  if (legacy === "reception-board") return "reception-board";
  if (legacy === "tomorrow-board") return "tomorrow-board";
  if (legacy === "surgeryos") return "surgery-os";
  if (legacy === "surgery-readiness-board") return "surgery-readiness-board";
  if (legacy === "procedure-day-board") return "procedure-day-board";
  if (legacy === "prescriptions") return "prescriptions";
  if (legacy === "patientos") return "patients";
  if (legacy === "calendar") return "calendar";
  if (legacy === "consultation-conversion-board") return "crm";
  if (legacy === "consultations") return "consultations";
  if (legacy === "dashboard") return "dashboard";
  if (legacy === "auditos") return "auditos-legacy";
  if (legacy === "analyticsos") return "analytics-legacy";
  if (legacy === "appointments" || legacy === "bookings") return "calendar";

  if (npRaw.startsWith(nb)) {
    const rest = npRaw.slice(nb.length).replace(/^\//, "");
    const first = rest.split("/")[0] ?? "";
    if (first === "payments") return "payments-inbox";
    if (first === "financial-os") return "financial-os";
    if (first === "financial") return "financial-os";
    if (first === "system-status") return "calendar";
    if (first === "settings") return "settings";
    if (first === "hr-os") {
      const second = rest.split("/")[1] ?? "";
      if (second === "onboarding") return "onboarding-centre";
      if (second === "compliance") return "compliance-legacy";
      if (second === "certifications") return "certifications-legacy";
      if (second === "credentials") return "credentials-legacy";
      if (second === "sync-health") return "hr-os-sync-health";
      if (second === "roster") return "roster-command-legacy";
      return "hr-os-dashboard";
    }
    if (first === "workforce-os") {
      const second = rest.split("/")[1] ?? "";
      if (second === "staff-identity-audit") return "staff-identity-audit";
      if (second === "staff-access") return "staff-access-legacy";
      if (second === "hr-task-map") return "hr-task-map-legacy";
      if (second === "roster") return "roster-command-legacy";
      return "workforce-os-hub";
    }
    if (first === "team") return FI_OS_TEAM_NAV_ID;
    if (first === "reports") return FI_OS_REPORTS_NAV_ID;
    if (first === "analytics") return "analytics-legacy";
    if (first === "audit") return "auditos-legacy";
    if (first === "intelligence") {
      const second = rest.split("/")[1] ?? "";
      if (second === "presence") return "d6-presence";
      if (second === "signal-learning") return "d6-signal-learning";
      if (second === "d6-bake") return "d6-bake";
      if (second === "navigation-audit") return "d6-navigation-audit";
      return "d6-navigation-audit";
    }
    if (first === "payments") return "payments-inbox-legacy";
    if (first === "financial-os") return "financial-os-legacy";
    if (first === "academy") return "academyos";
  }

  return null;
}

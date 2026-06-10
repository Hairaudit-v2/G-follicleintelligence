/**
 * Clinic OS shell navigation and quick-action definitions.
 * Visibility mirrors server props from `crmShellAccess`:
 * - CRM / LeadFlow: `showCrmNav` from {@link getCrmShellNavAllowed}
 * - Bookings board, appointments, and **PatientOS** (`/patients*`): `showBookingsBoard` from
 *   {@link getBookingsBoardNavAllowed} — same eligibility as {@link getBookingsOperatorPageSession}
 *   used by `app/(fi-admin)/fi-admin/[tenantId]/patients/layout.tsx` (no separate route permission change).
 *
 * Navigation is grouped by FI OS module labels (ClinicOS, LeadFlow, …); route paths are unchanged.
 */

export type ClinicOsShellPermissionHint = {
  /** When true, the item is only usable when CRM shell nav is allowed for the user. */
  requiresCrmShellNav?: boolean;
  /** When true, the item requires bookings-board access (CRM shell roles or active `fi_staff` member). */
  requiresBookingsBoardNav?: boolean;
  /** When true, only `clinic_admin` / legacy tenant admins may use the link (Admin Users settings). */
  requiresManageAdminUsers?: boolean;
  /** Reserved for future role-based gating (not evaluated yet). */
  minRole?: "member" | "admin" | "owner";
};

export type ClinicOsShellNavDefinition = {
  id: string;
  label: string;
  /** Path after `base` (no leading slash). Use "" for tenant home. */
  path: string;
  /** Home route: active only on exact `base` match. */
  home?: boolean;
  permissionHint: ClinicOsShellPermissionHint;
  /** No backing route yet — always shown disabled with `href` `#`. */
  placeholder?: boolean;
  /** Optional link `title` / tooltip (leaf behaviour). */
  description?: string;
};

export type ClinicOsShellNavModuleDefinition = {
  id: string;
  label: string;
  /** Module-level tooltip (enquiries, planning, HairAudit, etc.). */
  description?: string;
  items: ClinicOsShellNavDefinition[];
};

export type ResolvedClinicOsShellNavItem = {
  id: string;
  label: string;
  href: string;
  disabled: boolean;
  home?: boolean;
  description?: string;
};

export type ResolvedClinicOsShellNavModule = {
  id: string;
  label: string;
  description?: string;
  /** When true, shell UI shows the module label before the item row (multi-link clusters). */
  showModuleLabel: boolean;
  items: ResolvedClinicOsShellNavItem[];
};

export type ClinicOsQuickActionDefinition = {
  id: string;
  label: string;
  /** Path after `base`, or "" with placeholder */
  path: string;
  permissionHint: ClinicOsShellPermissionHint;
  placeholder?: boolean;
  /** Optional `title` on the menu link. */
  description?: string;
};

export type ResolvedClinicOsQuickAction = {
  id: string;
  label: string;
  href: string;
  disabled: boolean;
  description?: string;
};

/** Primary shell modules — hrefs resolved against `/fi-admin/[tenantId]`. */
export const CLINIC_OS_SHELL_NAV_MODULES: ClinicOsShellNavModuleDefinition[] = [
  {
    id: "clinicos",
    label: "ClinicOS",
    description: "Dashboard, bookings, calendar, and daily operations.",
    items: [
      { id: "dashboard", label: "Dashboard", path: "", home: true, permissionHint: {}, description: "Tenant home and overview." },
      {
        id: "operations-centre",
        label: "Operations",
        path: "operations",
        permissionHint: {},
        description: "ClinicOS operations centre — schedule, flow, and CRM snapshot.",
      },
      {
        id: "reception-board",
        label: "Reception",
        path: "reception",
        permissionHint: {},
        description: "Front-desk board for today’s patients and booking status.",
      },
      {
        id: "tomorrow-board",
        label: "Tomorrow",
        path: "tomorrow",
        permissionHint: {},
        description: "End-of-day readiness for tomorrow’s clinic day (bookings, surgery signals, payments, staff).",
      },
      {
        id: "appointments",
        label: "Appointments",
        path: "appointments",
        permissionHint: { requiresBookingsBoardNav: true },
        description: "Appointments list and slide-over.",
      },
      {
        id: "bookings",
        label: "Board",
        path: "bookings",
        permissionHint: { requiresBookingsBoardNav: true },
        description: "Legacy booking board and agenda.",
      },
      { id: "calendar", label: "Calendar", path: "calendar", permissionHint: {}, description: "Operational calendar." },
      {
        id: "doctor-workspace",
        label: "Doctor workspace",
        path: "doctor",
        permissionHint: { requiresBookingsBoardNav: true },
        description: "DoctorOS clinical command centre — rounds, Rx, pharmacy, voice notes.",
      },
      {
        id: "consultations",
        label: "Consultations",
        path: "consultations",
        permissionHint: {},
        description: "Consultation workspace.",
      },
      {
        id: "consultation-conversion-board",
        label: "Conversion board",
        path: "consultation-conversion",
        permissionHint: {},
        description: "Consultation funnel from booked consult through surgery.",
      },
      {
        id: "prescriptions",
        label: "Prescriptions",
        path: "prescriptions",
        permissionHint: {},
        description: "DoctorOS prescribing workspace (internal drafts and signing).",
      },
      {
        id: "messages",
        label: "Messages",
        path: "",
        permissionHint: {},
        placeholder: true,
        description: "Team messaging (coming soon).",
      },
    ],
  },
  {
    id: "leadflow",
    label: "LeadFlow",
    description: "Enquiries, leads, pipeline, tasks, and follow-ups.",
    items: [{ id: "leadflow", label: "LeadFlow", path: "crm", permissionHint: { requiresCrmShellNav: true } }],
  },
  {
    id: "patientos",
    label: "PatientOS",
    description: "Patient profile, timeline, and treatment history.",
    items: [
      {
        id: "patientos",
        label: "PatientOS",
        path: "patients",
        permissionHint: { requiresBookingsBoardNav: true },
      },
    ],
  },
  {
    id: "surgeryos",
    label: "SurgeryOS",
    description: "Planning, procedure day, post-op, and follow-up.",
    items: [
      { id: "surgeryos", label: "SurgeryOS", path: "cases", permissionHint: {} },
      {
        id: "surgery-readiness-board",
        label: "Readiness board",
        path: "surgery-readiness",
        permissionHint: {},
        description: "14-day surgery readiness across bookings, cases, pathology, and consent signals.",
      },
      {
        id: "procedure-day-board",
        label: "Procedure day",
        path: "procedure-day",
        permissionHint: {},
        description: "Today’s surgery schedule, team, procedure progress, and operating-room checklist.",
      },
    ],
  },
  {
    id: "auditos",
    label: "AuditOS",
    description: "HairAudit queue and outcome intelligence.",
    items: [{ id: "auditos", label: "AuditOS", path: "audit", permissionHint: {} }],
  },
  {
    id: "academyos",
    label: "AcademyOS",
    description: "Training and certification (coming soon).",
    items: [{ id: "academyos", label: "AcademyOS", path: "", permissionHint: {}, placeholder: true }],
  },
  {
    id: "analyticsos",
    label: "AnalyticsOS",
    description: "Executive intelligence across modules (read-only composition).",
    items: [{ id: "analyticsos", label: "AnalyticsOS", path: "analytics", permissionHint: {} }],
  },
  {
    id: "foundationos-mod",
    label: "FoundationOS",
    description: "Patient identity, media, timelines, events, and Patient Twin health.",
    items: [
      {
        id: "foundationos",
        label: "FoundationOS",
        path: "foundation-integrity",
        permissionHint: {},
        description: "Patient identity, media, timelines, events, and Patient Twin health.",
      },
    ],
  },
  {
    id: "settings-mod",
    label: "Settings",
    description: "Staff, services, and tenant administration.",
    items: [
      { id: "staff", label: "Staff", path: "staff", permissionHint: {} },
      { id: "services", label: "Services", path: "services", permissionHint: {} },
      {
        id: "configuration",
        label: "Configuration",
        path: "configuration",
        permissionHint: {},
        description: "Tenant and system configuration.",
      },
      {
        id: "admin-users",
        label: "Admin Users",
        path: "settings/admin-users",
        permissionHint: { requiresManageAdminUsers: true },
        description:
          "Manage non-clinical platform access for trusted administrators, finance teams, owners, auditors, and operational staff.",
      },
      {
        id: "tax-localisation",
        label: "Tax & Localisation",
        path: "settings/tax-localisation",
        permissionHint: {},
        description: "Configure tax, currency, invoice, and regional business settings for this clinic.",
      },
      {
        id: "timely-zapier",
        label: "Integrations · Timely",
        path: "settings/integrations/timely",
        permissionHint: {},
        description: "Zapier webhook URLs and manual setup for Timely patients and appointments.",
      },
    ],
  },
];

/** Flattened nav defs (e.g. tests, introspection). */
export const CLINIC_OS_SHELL_NAV_ITEMS: ClinicOsShellNavDefinition[] = CLINIC_OS_SHELL_NAV_MODULES.flatMap((m) => m.items);

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "") || "";
}

function normalizePath(p: string): string {
  const t = p.replace(/\/+$/, "");
  return t.length === 0 ? "/" : t;
}

function hrefFor(base: string, path: string): string {
  const b = normalizeBase(base);
  const p = path.trim();
  if (!p) return b;
  return `${b}/${p}`;
}

function resolveOneNavItem(
  base: string,
  def: ClinicOsShellNavDefinition,
  showCrmNav: boolean,
  showBookingsBoard: boolean,
  showManageAdminUsers: boolean
): ResolvedClinicOsShellNavItem {
  if (def.placeholder) {
    return {
      id: def.id,
      label: def.label,
      href: "#",
      disabled: true,
      home: def.home,
      description: def.description,
    };
  }
  const needsCrm = Boolean(def.permissionHint.requiresCrmShellNav);
  const needsBookings = Boolean(def.permissionHint.requiresBookingsBoardNav);
  const needsAdminUsers = Boolean(def.permissionHint.requiresManageAdminUsers);
  if (needsCrm && !showCrmNav) {
    return {
      id: def.id,
      label: def.label,
      href: "#",
      disabled: true,
      home: def.home,
      description: def.description,
    };
  }
  if (needsBookings && !showBookingsBoard) {
    return {
      id: def.id,
      label: def.label,
      href: "#",
      disabled: true,
      home: def.home,
      description: def.description,
    };
  }
  if (needsAdminUsers && !showManageAdminUsers) {
    return {
      id: def.id,
      label: def.label,
      href: "#",
      disabled: true,
      home: def.home,
      description: def.description,
    };
  }
  const href = def.home ? normalizeBase(base) : hrefFor(base, def.path);
  return { id: def.id, label: def.label, href, disabled: false, home: def.home, description: def.description };
}

/**
 * Which primary nav tab should show as active for the current URL.
 * Uses path segments under `base`; also treats `/hair-audit/*` as AuditOS when outside the tenant prefix.
 */
export function getClinicOsShellActiveNavId(pathname: string, base: string): string | null {
  const nb = normalizeBase(base);
  const np = normalizePath(pathname);

  if (np.startsWith("/hair-audit")) return "auditos";
  if (!np.startsWith(nb)) return null;

  if (np === nb) return "dashboard";

  const rest = np.slice(nb.length);
  const sub = rest.startsWith("/") ? rest.slice(1) : rest;
  const first = sub.split("/")[0] ?? "";

  if (first === "operations") return "operations-centre";
  if (first === "reception") return "reception-board";
  if (first === "tomorrow") return "tomorrow-board";

  if (first === "bookings") return "bookings";
  if (first === "calendar") return "calendar";
  if (first === "appointments") return "appointments";
  if (first === "patients") return "patientos";
  /** Tenant directory — closest match to PatientOS (no dedicated shell tab). */
  if (first === "directory") return "patientos";
  if (first === "staff") return "staff";
  if (first === "services") return "services";
  if (first === "doctor") return "doctor-workspace";
  if (first === "consultations") return "consultations";
  if (first === "consultation-conversion") return "consultation-conversion-board";
  if (first === "prescriptions") return "prescriptions";
  if (first === "cases") return "surgeryos";
  if (first === "surgery-readiness") return "surgery-readiness-board";
  if (first === "procedure-day") return "procedure-day-board";
  if (first === "crm") return "leadflow";
  if (first === "analytics") return "analyticsos";
  if (first === "audit") return "auditos";
  if (first === "foundation-integrity") return "foundationos";
  if (first === "configuration" || first === "settings") return "configuration";

  return null;
}

/** Calendar page renders its own control bar — shell secondary row stays off. */
export function isClinicOsShellCalendarContextRoute(): boolean {
  return false;
}

export function resolveClinicOsShellNavModules(
  base: string,
  showCrmNav: boolean,
  showBookingsBoard: boolean = showCrmNav,
  showManageAdminUsers: boolean = false
): ResolvedClinicOsShellNavModule[] {
  return CLINIC_OS_SHELL_NAV_MODULES.map((mod) => {
    const items = mod.items.map((def) => resolveOneNavItem(base, def, showCrmNav, showBookingsBoard, showManageAdminUsers));
    const nonPlaceholderDefs = mod.items.filter((d) => !d.placeholder);
    const realLinks = nonPlaceholderDefs.length;
    const duplicateModuleLabel = nonPlaceholderDefs.some((d) => d.label === mod.label);
    const showModuleLabel = realLinks > 1 && !duplicateModuleLabel;
    return {
      id: mod.id,
      label: mod.label,
      description: mod.description,
      showModuleLabel,
      items,
    };
  });
}

export function resolveClinicOsShellNavItems(
  base: string,
  showCrmNav: boolean,
  showBookingsBoard: boolean = showCrmNav,
  showManageAdminUsers: boolean = false
): ResolvedClinicOsShellNavItem[] {
  return resolveClinicOsShellNavModules(base, showCrmNav, showBookingsBoard, showManageAdminUsers).flatMap((m) => m.items);
}

export const CLINIC_OS_SHELL_QUICK_ACTIONS: ClinicOsQuickActionDefinition[] = [
  {
    id: "patient",
    label: "Patient",
    path: "patients/new",
    permissionHint: { requiresBookingsBoardNav: true },
    description: "Create a patient record (PatientOS).",
  },
  {
    id: "consultation",
    label: "Consultation",
    path: "consultations/new",
    permissionHint: {},
    description: "Start a new consultation.",
  },
  {
    id: "lead",
    label: "Lead",
    path: "crm",
    permissionHint: { requiresCrmShellNav: true },
    description: "LeadFlow — enquiries, pipeline, and tasks.",
  },
  {
    id: "booking",
    label: "Appointment",
    path: "appointments",
    permissionHint: { requiresBookingsBoardNav: true },
    description: "Open Appointments to create or edit (ClinicOS).",
  },
  {
    id: "case",
    label: "New case",
    path: "cases/new",
    permissionHint: {},
    description: "Start a surgery case (SurgeryOS).",
  },
  {
    id: "task",
    label: "Task",
    path: "crm",
    permissionHint: { requiresCrmShellNav: true },
    description: "LeadFlow — open a lead, then add a task on the Timeline tab.",
  },
  {
    id: "message",
    label: "Message",
    path: "",
    permissionHint: {},
    placeholder: true,
    description: "Messages (coming soon).",
  },
];

export function resolveClinicOsShellQuickActions(
  base: string,
  showCrmNav: boolean,
  showBookingsBoard: boolean = showCrmNav
): ResolvedClinicOsQuickAction[] {
  return CLINIC_OS_SHELL_QUICK_ACTIONS.map((def) => {
    if (def.placeholder) {
      return { id: def.id, label: def.label, href: "#", disabled: true, description: def.description };
    }
    const needsCrm = Boolean(def.permissionHint.requiresCrmShellNav);
    const needsBookings = Boolean(def.permissionHint.requiresBookingsBoardNav);
    if (needsCrm && !showCrmNav) {
      return { id: def.id, label: def.label, href: "#", disabled: true, description: def.description };
    }
    if (needsBookings && !showBookingsBoard) {
      return { id: def.id, label: def.label, href: "#", disabled: true, description: def.description };
    }
    return {
      id: def.id,
      label: def.label,
      href: hrefFor(base, def.path),
      disabled: false,
      description: def.description,
    };
  });
}

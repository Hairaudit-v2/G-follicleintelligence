/**
 * Clinic OS shell navigation and quick-action definitions.
 * Permission hints are descriptive only for future RBAC; visibility today mirrors
 * existing CRM shell nav via `showCrmNav` from `getCrmShellNavAllowed` (no new enforcement).
 */

export type ClinicOsShellPermissionHint = {
  /** When true, the item is only usable when CRM shell nav is allowed for the user. */
  requiresCrmShellNav?: boolean;
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
};

export type ResolvedClinicOsShellNavItem = {
  id: string;
  label: string;
  href: string;
  disabled: boolean;
  home?: boolean;
};

export type ClinicOsQuickActionDefinition = {
  id: string;
  label: string;
  /** Path after `base`, or "" with placeholder */
  path: string;
  permissionHint: ClinicOsShellPermissionHint;
  placeholder?: boolean;
};

export type ResolvedClinicOsQuickAction = {
  id: string;
  label: string;
  href: string;
  disabled: boolean;
};

/** Primary shell tabs — hrefs resolved against `/fi-admin/[tenantId]`. */
export const CLINIC_OS_SHELL_NAV_ITEMS: ClinicOsShellNavDefinition[] = [
  { id: "dashboard", label: "Dashboard", path: "", home: true, permissionHint: {} },
  /** Calendar home is tenant-wide; booking/CRM shortcuts on the page use `showCrmNav`. */
  { id: "calendar", label: "Calendar", path: "calendar", permissionHint: {} },
  /** Patients home is tenant-wide; CRM-gated shortcuts live on the page. */
  { id: "patients", label: "Patients", path: "patients", permissionHint: {} },
  { id: "consultations", label: "Consultations", path: "consultations", permissionHint: {} },
  { id: "cases", label: "Patients", path: "cases", permissionHint: {} },
  { id: "messages", label: "Messages", path: "", permissionHint: {}, placeholder: true },
  { id: "sales", label: "Sales", path: "crm", permissionHint: { requiresCrmShellNav: true } },
  { id: "reports", label: "Reports", path: "", permissionHint: {}, placeholder: true },
  { id: "training", label: "Training", path: "", permissionHint: {}, placeholder: true },
  { id: "audit", label: "Audit", path: "audit", permissionHint: {} },
  { id: "setup", label: "Setup", path: "configuration", permissionHint: {} },
];

export const CLINIC_OS_SHELL_QUICK_ACTIONS: ClinicOsQuickActionDefinition[] = [
  { id: "patient", label: "Patient", path: "patients/new", permissionHint: {} },
  { id: "consultation", label: "Consultation", path: "consultations/new", permissionHint: {} },
  { id: "lead", label: "Lead", path: "crm", permissionHint: { requiresCrmShellNav: true } },
  { id: "booking", label: "Booking", path: "bookings/new", permissionHint: { requiresCrmShellNav: true } },
  { id: "case", label: "Patient", path: "cases/new", permissionHint: {} },
  { id: "task", label: "Task", path: "", permissionHint: {}, placeholder: true },
  { id: "message", label: "Message", path: "", permissionHint: {}, placeholder: true },
];

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

/**
 * Which primary nav tab should show as active for the current URL.
 * Uses path segments under `base`; also treats `/hair-audit/*` as Audit when outside the tenant prefix.
 */
export function getClinicOsShellActiveNavId(pathname: string, base: string): string | null {
  const nb = normalizeBase(base);
  const np = normalizePath(pathname);

  if (np.startsWith("/hair-audit")) return "audit";
  if (!np.startsWith(nb)) return null;

  if (np === nb) return "dashboard";

  const rest = np.slice(nb.length);
  const sub = rest.startsWith("/") ? rest.slice(1) : rest;
  const first = sub.split("/")[0] ?? "";

  if (first === "calendar") return "calendar";
  if (first === "bookings") return "calendar";
  if (first === "patients") return "patients";
  if (first === "consultations") return "consultations";
  if (first === "cases") return "cases";
  if (first === "crm") return "sales";
  if (first === "audit") return "audit";
  if (first === "configuration" || first === "settings") return "setup";

  return null;
}

/** Calendar page renders its own control bar — shell secondary row stays off. */
export function isClinicOsShellCalendarContextRoute(_pathname: string, _base: string): boolean {
  return false;
}

export function resolveClinicOsShellNavItems(base: string, showCrmNav: boolean): ResolvedClinicOsShellNavItem[] {
  return CLINIC_OS_SHELL_NAV_ITEMS.map((def) => {
    if (def.placeholder) {
      return { id: def.id, label: def.label, href: "#", disabled: true, home: def.home };
    }
    const needsCrm = Boolean(def.permissionHint.requiresCrmShellNav);
    if (needsCrm && !showCrmNav) {
      return { id: def.id, label: def.label, href: "#", disabled: true, home: def.home };
    }
    const href = def.home ? normalizeBase(base) : hrefFor(base, def.path);
    return { id: def.id, label: def.label, href, disabled: false, home: def.home };
  });
}

export function resolveClinicOsShellQuickActions(base: string, showCrmNav: boolean): ResolvedClinicOsQuickAction[] {
  return CLINIC_OS_SHELL_QUICK_ACTIONS.map((def) => {
    if (def.placeholder) {
      return { id: def.id, label: def.label, href: "#", disabled: true };
    }
    const needsCrm = Boolean(def.permissionHint.requiresCrmShellNav);
    if (needsCrm && !showCrmNav) {
      return { id: def.id, label: def.label, href: "#", disabled: true };
    }
    return { id: def.id, label: def.label, href: hrefFor(base, def.path), disabled: false };
  });
}

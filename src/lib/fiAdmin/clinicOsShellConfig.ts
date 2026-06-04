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
  { id: "calendar", label: "Calendar", path: "calendar", permissionHint: { requiresCrmShellNav: true } },
  { id: "patients", label: "Patients", path: "patients", permissionHint: { requiresCrmShellNav: true } },
  { id: "cases", label: "Cases", path: "cases", permissionHint: {} },
  { id: "messages", label: "Messages", path: "", permissionHint: {}, placeholder: true },
  { id: "reports", label: "Reports", path: "", permissionHint: {}, placeholder: true },
  { id: "training", label: "Training", path: "", permissionHint: {}, placeholder: true },
  { id: "audit", label: "Audit", path: "audit", permissionHint: {} },
  { id: "settings", label: "Settings", path: "configuration", permissionHint: {} },
];

export const CLINIC_OS_SHELL_QUICK_ACTIONS: ClinicOsQuickActionDefinition[] = [
  { id: "new-patient", label: "New Patient", path: "", permissionHint: { requiresCrmShellNav: true }, placeholder: true },
  { id: "new-lead", label: "New Lead", path: "crm", permissionHint: { requiresCrmShellNav: true } },
  { id: "new-booking", label: "New Booking", path: "bookings", permissionHint: { requiresCrmShellNav: true } },
  { id: "new-case", label: "New Case", path: "cases/new", permissionHint: {} },
  { id: "new-task", label: "New Task", path: "", permissionHint: {}, placeholder: true },
  { id: "send-message", label: "Send Message", path: "", permissionHint: {}, placeholder: true },
];

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "") || "";
}

function hrefFor(base: string, path: string): string {
  const b = normalizeBase(base);
  const p = path.trim();
  if (!p) return b;
  return `${b}/${p}`;
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

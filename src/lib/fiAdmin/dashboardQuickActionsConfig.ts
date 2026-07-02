/**
 * FI OS tenant dashboard — quick action definitions and resolution.
 *
 * `DASHBOARD_QUICK_ACTION_DEFINITIONS` is the single source of truth for keys, labels, and routes.
 * Shell flags (`showCrmNav`, `showBookingsBoard`) gate items today; future role policies can:
 * - pass a filtered `definitions` array into {@link resolveDashboardQuickActions}, or
 * - post-filter with {@link filterResolvedDashboardQuickActions}.
 */

export type DashboardQuickActionKey =
  | "booking"
  | "patient"
  | "lead"
  | "consultation"
  | "case"
  | "upload_images";

export type DashboardQuickActionKind = "link" | "modal_create_lead";

export type DashboardQuickActionNavFlags = {
  showCrmNav: boolean;
  showBookingsBoard: boolean;
};

export type DashboardQuickActionDef = {
  key: DashboardQuickActionKey;
  /** Short label for compact toolbar (leading "+" added in UI). */
  label: string;
  /** Path after tenant base `/fi-admin/[tenantId]/` (no leading slash). */
  path: string;
  /** Optional hash without `#`. */
  hash?: string;
  requiresCrmShellNav?: boolean;
  requiresBookingsBoardNav?: boolean;
  kind: DashboardQuickActionKind;
};

export const DASHBOARD_QUICK_ACTION_DEFINITIONS: readonly DashboardQuickActionDef[] = [
  {
    key: "booking",
    label: "Booking",
    path: "calendar",
    kind: "link",
  },
  {
    key: "patient",
    label: "Patient",
    path: "patients/new",
    requiresBookingsBoardNav: true,
    kind: "link",
  },
  {
    key: "lead",
    label: "Enquiry",
    path: "crm",
    hash: "fi-os-crm-create-lead",
    requiresCrmShellNav: true,
    kind: "modal_create_lead",
  },
  {
    key: "consultation",
    label: "Consultation",
    path: "consultations/new",
    kind: "link",
  },
  {
    key: "case",
    label: "Case",
    path: "cases/new",
    kind: "link",
  },
  {
    key: "upload_images",
    label: "Upload images",
    path: "foundation-integrity",
    hash: "fi-os-foundation-media",
    kind: "link",
  },
] as const;

export type ResolvedDashboardQuickAction = {
  key: DashboardQuickActionKey;
  label: string;
  kind: DashboardQuickActionKind;
  href: string;
  enabled: boolean;
  disabledReason?: string;
};

function normalizeTenantBase(base: string): string {
  return base.replace(/\/+$/, "") || "";
}

function buildHref(b: string, path: string, hash?: string): string {
  const p = path.trim().replace(/^\/+/, "");
  const tail = p ? `/${p}` : "";
  const h = hash?.trim() ? `#${hash.trim()}` : "";
  return `${b}${tail}${h}`;
}

/**
 * Materialises {@link DASHBOARD_QUICK_ACTION_DEFINITIONS} (or a caller-supplied subset) into
 * href + enabled rows for the current tenant and nav flags.
 */
export function resolveDashboardQuickActions(
  tenantBase: string,
  flags: DashboardQuickActionNavFlags,
  definitions: readonly DashboardQuickActionDef[] = DASHBOARD_QUICK_ACTION_DEFINITIONS
): ResolvedDashboardQuickAction[] {
  const b = normalizeTenantBase(tenantBase);
  const out: ResolvedDashboardQuickAction[] = [];

  for (const def of definitions) {
    const needsCrm = Boolean(def.requiresCrmShellNav);
    const needsBookings = Boolean(def.requiresBookingsBoardNav);
    const href = buildHref(b, def.path, def.hash);

    let enabled = true;
    let disabledReason: string | undefined;

    if (needsCrm && !flags.showCrmNav) {
      enabled = false;
      disabledReason = "Enquiries access required.";
    } else if (needsBookings && !flags.showBookingsBoard) {
      enabled = false;
      disabledReason = "Scheduling / PatientOS access required.";
    }

    out.push({
      key: def.key,
      label: def.label,
      kind: def.kind,
      href,
      enabled,
      disabledReason,
    });
  }

  return out;
}

/**
 * Apply an arbitrary visibility predicate (e.g. future OS role / permission matrix).
 * Typically used on the output of {@link resolveDashboardQuickActions}.
 */
export function filterResolvedDashboardQuickActions(
  items: readonly ResolvedDashboardQuickAction[],
  isVisible: (item: ResolvedDashboardQuickAction) => boolean
): ResolvedDashboardQuickAction[] {
  return items.filter(isVisible);
}

/**
 * Optional: filter definitions before resolve when policy depends only on static keys
 * (e.g. hide entire rows for a role bundle).
 */
export function filterDashboardQuickActionDefinitions(
  definitions: readonly DashboardQuickActionDef[],
  isAllowed: (def: DashboardQuickActionDef) => boolean
): DashboardQuickActionDef[] {
  return definitions.filter(isAllowed);
}

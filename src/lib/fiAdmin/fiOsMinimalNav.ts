import { isFiOsTenantCalendarPath } from "@/src/lib/fiAdmin/fiOsTenantCalendarRoute";
import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

export type FiOsMinimalNavItemId = "today" | "calendar" | "search" | "new" | "more";

export type FiOsMinimalNavLinkItem = {
  id: "today" | "calendar";
  kind: "link";
  label: string;
  href: string;
  disabled?: boolean;
  hint?: string;
};

export type FiOsMinimalNavActionItem = {
  id: "search" | "new" | "more";
  kind: "action";
  label: string;
};

export type FiOsMinimalNavItem = FiOsMinimalNavLinkItem | FiOsMinimalNavActionItem;

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "") || "";
}

function normalizePath(pathname: string): string {
  const t = pathname.replace(/\/+$/, "");
  return t.length === 0 ? "/" : t;
}

/**
 * D2 minimal rail / mobile bottom bar items. Calendar href and disabled state
 * are derived from the already-resolved primary sidebar items so RBAC and
 * feature gating stay centralized in `fiOsShellPrimaryNav`.
 */
export function resolveFiOsMinimalNavItems(
  base: string,
  sidebarItems: readonly FiOsPrimarySidebarItem[]
): FiOsMinimalNavItem[] {
  const b = normalizeBase(base);
  const calendar = sidebarItems.find((item) => item.id === "calendar");

  return [
    {
      id: "today",
      kind: "link",
      label: "Today",
      href: b,
    },
    {
      id: "calendar",
      kind: "link",
      label: "Calendar",
      href: calendar?.href ?? `${b}/calendar`,
      disabled: calendar?.disabled ?? false,
      hint: calendar?.hint,
    },
    {
      id: "search",
      kind: "action",
      label: "Search",
    },
    {
      id: "new",
      kind: "action",
      label: "New",
    },
    {
      id: "more",
      kind: "action",
      label: "More",
    },
  ];
}

/** Which minimal nav link is active for the current route (actions return null). */
export function getFiOsMinimalNavActiveId(
  pathname: string,
  base: string
): FiOsMinimalNavItemId | null {
  const nb = normalizeBase(base);
  const np = normalizePath(pathname);

  if (np === nb || np === `${nb}/`) {
    return "today";
  }

  if (isFiOsTenantCalendarPath(pathname) || np.startsWith(`${nb}/calendar`)) {
    return "calendar";
  }

  return null;
}

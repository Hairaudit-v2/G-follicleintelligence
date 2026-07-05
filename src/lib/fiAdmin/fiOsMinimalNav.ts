import { isFiOsTenantCalendarPath } from "@/src/lib/fiAdmin/fiOsTenantCalendarRoute";
import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import {
  FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS,
  resolvePrimaryRailSidebarTarget,
  type FiOsD6gPrimaryRailSlotId,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";

export type FiOsMinimalNavItemId = FiOsD6gPrimaryRailSlotId;

export type FiOsMinimalNavLinkItem = {
  id: Exclude<FiOsMinimalNavItemId, "more">;
  kind: "link";
  label: string;
  href: string;
  disabled?: boolean;
  hint?: string;
};

export type FiOsMinimalNavActionItem = {
  id: "more";
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

function linkFromRailSlot(
  base: string,
  slotId: Exclude<FiOsMinimalNavItemId, "more">,
  label: string,
  sidebarItems: readonly FiOsPrimarySidebarItem[]
): FiOsMinimalNavLinkItem {
  const b = normalizeBase(base);
  const target = resolvePrimaryRailSidebarTarget(slotId, sidebarItems);

  if (slotId === "today") {
    return { id: "today", kind: "link", label: "Today", href: b };
  }

  const fallbackHref =
    slotId === "calendar"
      ? `${b}/calendar`
      : slotId === "patients"
        ? `${b}/patients`
        : slotId === "team"
          ? `${b}/team`
          : `${b}/reports`;

  return {
    id: slotId,
    kind: "link",
    label,
    href: target?.href ?? fallbackHref,
    disabled: target?.disabled ?? false,
    hint: target?.hint,
  };
}

/**
 * D6G-B six-slot primary rail. Calendar href/disabled state is derived from
 * primary sidebar items (unchanged); Search/New live in the top bar only.
 */
export function resolveFiOsMinimalNavItems(
  base: string,
  sidebarItems: readonly FiOsPrimarySidebarItem[]
): FiOsMinimalNavItem[] {
  return [
    linkFromRailSlot(base, "today", "Today", sidebarItems),
    linkFromRailSlot(base, "calendar", "Calendar", sidebarItems),
    linkFromRailSlot(base, "patients", "Patients", sidebarItems),
    linkFromRailSlot(base, "team", "Team", sidebarItems),
    linkFromRailSlot(base, "reports", "Reports", sidebarItems),
    { id: "more", kind: "action", label: "More" },
  ];
}

/** Slot order exposed for tests and audit. */
export function primaryRailSlotIds(): readonly FiOsMinimalNavItemId[] {
  return FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS;
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

  if (np.startsWith(`${nb}/patients`) || np.startsWith(`${nb}/foundation-integrity`)) {
    return "patients";
  }

  if (
    np.startsWith(`${nb}/team`) ||
    np.startsWith(`${nb}/workforce-os`) ||
    np.startsWith(`${nb}/hr-os`) ||
    np === `${nb}/staff` ||
    np.startsWith(`${nb}/staff/`)
  ) {
    return "team";
  }

  if (
    np.startsWith(`${nb}/reports`) ||
    np.startsWith(`${nb}/analytics`) ||
    np.startsWith(`${nb}/audit`) ||
    np.startsWith(`${nb}/intelligence`) ||
    np.startsWith(`${nb}/financial-os`) ||
    np === `${nb}/payments` ||
    np.startsWith(`${nb}/payments/`)
  ) {
    return "reports";
  }

  return null;
}
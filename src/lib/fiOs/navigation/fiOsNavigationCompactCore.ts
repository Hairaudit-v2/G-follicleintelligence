/**
 * FI-LH-NAV-COMPACT-1 / FI-LH-NAV-COMPACT-1B — compact expandable LH navigation helpers.
 */

import type { FiOsSidebarWorkflowSection } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import {
  FI_OS_HIDDEN_MORE_SUB_ITEM_IDS,
  FI_OS_LEGACY_MORE_SUB_ITEM_IDS,
  isStaffHiddenMoreDrawerLabel,
  moreDrawerAdminSurfacesEnabled,
  workflowGroupForD6gNavItemId,
  type FiOsD6gWorkflowGroupId,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";
import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

export const FI_OS_NAV_EXPANDED_GROUPS_STORAGE_PREFIX = "fi-os-nav-expanded-groups";

/** Max collapsed group headers for a typical staff persona (no sidebar scroll at ~900px). */
export const FI_OS_COMPACT_NAV_MAX_GROUP_HEADERS = 9;

export function buildNavExpandedGroupsStorageKey(scope: {
  tenantId: string;
  userEmail?: string | null;
}): string {
  const tenant = scope.tenantId.trim() || "unknown";
  const user = scope.userEmail?.trim().toLowerCase() || "anonymous";
  return `${FI_OS_NAV_EXPANDED_GROUPS_STORAGE_PREFIX}:${tenant}:${user}`;
}

const VALID_GROUP_IDS = new Set<string>([
  "FRONT_DESK",
  "PIPELINE",
  "PATIENTS",
  "CLINICAL",
  "SURGERY",
  "FINANCE",
  "REPORTS",
  "TEAM",
  "SETTINGS",
]);

export function parsePersistedExpandedNavGroups(
  raw: string | null | undefined
): Set<FiOsD6gWorkflowGroupId> {
  if (!raw?.trim()) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const out = new Set<FiOsD6gWorkflowGroupId>();
    for (const entry of parsed) {
      if (typeof entry === "string" && VALID_GROUP_IDS.has(entry)) {
        out.add(entry as FiOsD6gWorkflowGroupId);
      }
    }
    return out;
  } catch {
    return new Set();
  }
}

export function serializeExpandedNavGroups(groups: ReadonlySet<FiOsD6gWorkflowGroupId>): string {
  return JSON.stringify([...groups]);
}

/** Maps the active sidebar id (or sub-item id) to a workflow group for auto-expand. */
export function resolveActiveWorkflowGroupForNav(
  activeNavId: string | null | undefined
): FiOsD6gWorkflowGroupId | null {
  const id = activeNavId?.trim();
  if (!id) return null;
  return workflowGroupForD6gNavItemId(id);
}

export function mergeExpandedNavGroups(
  persisted: ReadonlySet<FiOsD6gWorkflowGroupId>,
  activeGroupId: FiOsD6gWorkflowGroupId | null
): Set<FiOsD6gWorkflowGroupId> {
  const out = new Set(persisted);
  if (activeGroupId) out.add(activeGroupId);
  return out;
}

export function toggleNavGroupExpansion(
  expanded: ReadonlySet<FiOsD6gWorkflowGroupId>,
  groupId: FiOsD6gWorkflowGroupId
): Set<FiOsD6gWorkflowGroupId> {
  const out = new Set(expanded);
  if (out.has(groupId)) out.delete(groupId);
  else out.add(groupId);
  return out;
}

export function countCompactNavGroupHeaders(
  sections: readonly FiOsSidebarWorkflowSection[]
): number {
  return sections.length;
}

/** Whether a nav item row should appear active inside a workflow group. */
export function isNavItemActiveInGroup(
  item: FiOsPrimarySidebarItem,
  activeNavId: string | null,
  pathname: string
): boolean {
  if (!activeNavId) return false;
  if (item.id === activeNavId) return true;
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    item.subItems?.some((sub) => {
      if (sub.id === activeNavId) return true;
      const href = sub.href.replace(/\/+$/, "") || "/";
      return href === path;
    }) ?? false
  );
}

/** Whether a workflow group contains the active route. */
export function workflowGroupHasActiveRoute(
  section: FiOsSidebarWorkflowSection,
  activeNavId: string | null,
  pathname: string
): boolean {
  return section.items.some((item) => isNavItemActiveInGroup(item, activeNavId, pathname));
}

/** Staff-facing sidebar: hide legacy direct links while preserving routes. */
export function filterSidebarItemSubLinksForStaff(
  item: FiOsPrimarySidebarItem,
  opts: {
    showNavigationAdminSurfaces?: boolean;
    showSurgeryAdminSurfaces?: boolean;
    showTeamAdminSurfaces?: boolean;
    showReportsAdminSurfaces?: boolean;
    showSettingsAdminSurfaces?: boolean;
  }
): FiOsPrimarySidebarItem {
  const subs = item.subItems;
  if (!subs?.length) return item;

  const adminSurfaces = moreDrawerAdminSurfacesEnabled({
    ...opts,
    showNavigationAdminSurfaces:
      opts.showNavigationAdminSurfaces ||
      opts.showSettingsAdminSurfaces ||
      opts.showReportsAdminSurfaces,
  });

  const filtered = subs.filter((sub) => {
    if (FI_OS_LEGACY_MORE_SUB_ITEM_IDS.has(sub.id)) {
      // Conditional visibility (e.g. procedure day) resolved by filterSubItemsForMoreDrawer.
      if (FI_OS_HIDDEN_MORE_SUB_ITEM_IDS.has(sub.id)) return true;
      return adminSurfaces;
    }
    if (!adminSurfaces && isStaffHiddenMoreDrawerLabel(sub.label)) {
      return false;
    }
    if (!adminSurfaces && /\(direct\)/i.test(sub.label)) {
      return false;
    }
    return true;
  });

  if (filtered.length === subs.length) return item;
  return { ...item, subItems: filtered.length ? filtered : undefined };
}

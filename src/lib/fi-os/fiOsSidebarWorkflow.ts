import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import {
  buildD6AdminSidebarItems,
  FI_OS_D6G_WORKFLOW_GROUP_LABELS,
  filterSubItemsForMoreDrawer,
  isPrimaryRailNavId,
  orderedD6gWorkflowGroups,
  sortNavItemsForD6gGroup,
  workflowGroupForD6gNavItemId,
  type FiOsD6gWorkflowGroupId,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";

/** 1B workflow groups for All areas / More drawer (D6G-B). */
export const FI_OS_WORKFLOW_GROUP_IDS = [
  "FRONT_DESK",
  "PIPELINE",
  "PATIENTS",
  "CLINICAL",
  "SURGERY",
  "FINANCE",
  "REPORTS",
  "TEAM",
  "SETTINGS",
] as const;

export type FiOsWorkflowGroupId = FiOsD6gWorkflowGroupId;

export const FI_OS_WORKFLOW_GROUP_LABELS: Record<FiOsWorkflowGroupId, string> =
  FI_OS_D6G_WORKFLOW_GROUP_LABELS;

/** Consolidated workspaces that stay in More for sub-links while also on the primary rail. */
const PRIMARY_RAIL_MORE_DRAWER_EXCEPTION_IDS = new Set(["team"]);

export type BuildFiOsSidebarWorkflowSectionsOptions = {
  workspaceProfile?: FiWorkspaceProfileKey | null;
  /** Tenant shell base path, e.g. `/fi-admin/[tenantId]`. */
  tenantBase?: string;
  /** When true, omit primary-rail destinations from the drawer. */
  forCollapsedShell?: boolean;
  showNavigationAdminSurfaces?: boolean;
  showProcedureDayNav?: boolean;
  showSurgeryAdminSurfaces?: boolean;
  showTeamAdminSurfaces?: boolean;
};

export type FiOsSidebarWorkflowSection = {
  groupId: FiOsWorkflowGroupId;
  title: string;
  items: FiOsPrimarySidebarItem[];
};

export function workflowGroupForNavItemId(
  itemId: string,
  _workspaceProfile?: FiWorkspaceProfileKey | null | undefined
): FiOsWorkflowGroupId {
  return workflowGroupForD6gNavItemId(itemId);
}

export function orderedWorkflowGroupsForWorkspace(
  workspaceProfile?: FiWorkspaceProfileKey | null
): FiOsWorkflowGroupId[] {
  return orderedD6gWorkflowGroups(workspaceProfile ?? "default");
}

function prepareSidebarItemsForDrawer(
  items: FiOsPrimarySidebarItem[],
  opts: BuildFiOsSidebarWorkflowSectionsOptions
): FiOsPrimarySidebarItem[] {
  const prepared = items
    .filter((it) => {
      if (
        opts.forCollapsedShell &&
        isPrimaryRailNavId(it.id) &&
        !PRIMARY_RAIL_MORE_DRAWER_EXCEPTION_IDS.has(it.id)
      ) {
        return false;
      }
      return true;
    })
    .map((it) =>
      filterSubItemsForMoreDrawer(it, {
        showProcedureDayNav: opts.showProcedureDayNav,
        showNavigationAdminSurfaces: opts.showNavigationAdminSurfaces,
        showSurgeryAdminSurfaces: opts.showSurgeryAdminSurfaces,
        showTeamAdminSurfaces: opts.showTeamAdminSurfaces,
      })
    );

  if (opts.showNavigationAdminSurfaces && opts.tenantBase?.trim()) {
    prepared.push(...buildD6AdminSidebarItems(opts.tenantBase.trim()));
  }

  return prepared;
}

/**
 * Groups sidebar items into 1B workflow sections for legacy rail or More drawer.
 */
export function buildFiOsSidebarWorkflowSections(
  items: FiOsPrimarySidebarItem[],
  workspaceProfile?: FiWorkspaceProfileKey | null,
  options?: BuildFiOsSidebarWorkflowSectionsOptions
): FiOsSidebarWorkflowSection[] {
  const opts: BuildFiOsSidebarWorkflowSectionsOptions = {
    workspaceProfile,
    ...options,
  };
  const prepared = prepareSidebarItemsForDrawer(items, opts);
  const byId = new Map(prepared.map((it) => [it.id, it]));
  const groupOrder = orderedD6gWorkflowGroups(opts.workspaceProfile ?? "default");
  const out: FiOsSidebarWorkflowSection[] = [];

  for (const groupId of groupOrder) {
    const bucket: FiOsPrimarySidebarItem[] = [];
    for (const it of prepared) {
      if (workflowGroupForD6gNavItemId(it.id) !== groupId) continue;
      if (!byId.has(it.id)) continue;
      bucket.push(it);
    }
    const sorted = sortNavItemsForD6gGroup(groupId, bucket);
    if (sorted.length === 0) continue;
    out.push({ groupId, title: FI_OS_D6G_WORKFLOW_GROUP_LABELS[groupId], items: sorted });
  }
  return out;
}
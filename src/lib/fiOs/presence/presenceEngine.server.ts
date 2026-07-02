import "server-only";

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import {
  buildPresenceContextFromDashboard,
  derivePresenceFromDashboardInput,
  derivePresenceSnapshots,
  summarizePresenceForToday,
} from "@/src/lib/fiOs/presence/presenceEngine";
import type { PresenceEngineContext, PresenceSummary } from "@/src/lib/fiOs/presence/presenceTypes";
import {
  loadTenantOperationalDashboard,
  type TenantOperationalDashboard,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export type LoadPresenceContext = {
  profileKey?: FiWorkspaceProfileKey;
  now?: Date;
  /** Pre-loaded dashboard avoids duplicate loader call on tenant home. */
  dashboard?: TenantOperationalDashboard;
  todayItems?: readonly TodayFeedItem[];
};

async function resolveDashboard(
  tenantId: string,
  dashboard?: TenantOperationalDashboard
): Promise<TenantOperationalDashboard> {
  if (dashboard) return dashboard;
  return loadTenantOperationalDashboard(tenantId, { includeReceptionBoard: true });
}

/**
 * Lightweight presence snapshot load — reuses dashboard when provided.
 * No new DB writes in D6E.
 */
export async function loadPresenceSnapshotForTenant(
  tenantId: string,
  context: LoadPresenceContext = {}
): Promise<PresenceSummary> {
  const dashboard = await resolveDashboard(tenantId, context.dashboard);
  const engineContext = buildPresenceContextFromDashboard(dashboard, {
    profileKey: context.profileKey,
    now: context.now,
  });

  const snapshots = derivePresenceSnapshots({
    context: engineContext,
    todayItems: context.todayItems ?? [],
    receptionCards: dashboard.receptionBoard.cards,
  });

  return summarizePresenceForToday(snapshots, engineContext);
}

/**
 * Presence summary for Today surface — prefers pre-derived feed items.
 */
export async function loadPresenceSummaryForToday(
  tenantId: string,
  context: LoadPresenceContext & { todayItems: readonly TodayFeedItem[] }
): Promise<PresenceSummary> {
  const dashboard = await resolveDashboard(tenantId, context.dashboard);
  return derivePresenceFromDashboardInput({
    dashboard,
    todayItems: context.todayItems,
    profileKey: context.profileKey,
    now: context.now,
  });
}

export function buildPresenceEngineContext(
  tenantId: string,
  overrides: Partial<PresenceEngineContext> = {}
): PresenceEngineContext {
  return {
    tenantId,
    nowIso: new Date().toISOString(),
    viewerSessionActive: true,
    withinOperatingWindow: true,
    ...overrides,
  };
}

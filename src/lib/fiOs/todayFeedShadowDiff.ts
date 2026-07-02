import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import {
  buildAttentionPriorities,
  countPatientsInClinicToday,
  IN_CLINIC_COLUMNS,
} from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import { buildTodayFeed } from "@/src/lib/fiOs/todayFeedDerive";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

/**
 * FI-UX-REBUILD-1D (P0B) — shadow-mode validation.
 *
 * Compares the new Today feed derivation against the legacy signal sources it
 * is meant to supersede, so discrepancies surface in logs *before* any tenant
 * has `today_surface` enabled. Every check here is a "no signal lost" check —
 * it never asserts exact numeric parity across the two systems, because Today
 * intentionally shows more context (e.g. "arriving soon") than the legacy
 * coarse counts do.
 */

export type TodayFeedShadowDiscrepancySeverity = "warning" | "error";

export type TodayFeedShadowDiscrepancy = {
  code: string;
  message: string;
  severity: TodayFeedShadowDiscrepancySeverity;
};

export type TodayFeedShadowDiffResult = {
  tenantId: string;
  computedAt: string;
  discrepancies: TodayFeedShadowDiscrepancy[];
  legacySignalCount: number;
  todayFeedSignalCount: number;
};

export function computeTodayFeedShadowDiff(input: {
  dashboard: TenantOperationalDashboard;
  showCrmNav: boolean;
  profileKey?: FiWorkspaceProfileKey;
  now?: Date;
}): TodayFeedShadowDiffResult {
  const { dashboard, showCrmNav, profileKey, now = new Date() } = input;
  const base = `/fi-admin/${dashboard.tenantId}`;
  const discrepancies: TodayFeedShadowDiscrepancy[] = [];

  // Uncapped so a busy tenant's per-bucket UI cap never masks a real discrepancy here.
  const feed = buildTodayFeed({
    base,
    dashboard,
    showCrmNav,
    profileKey,
    now,
    maxPerBucket: Number.MAX_SAFE_INTEGER,
  });
  const allItems = [...feed.rightNow, ...feed.upNext, ...feed.comingUp];
  const idSet = new Set(allItems.map((i) => i.id));

  const legacyPriorities = buildAttentionPriorities({
    base,
    actionCentre: dashboard.actionCentre,
    showCrmNav,
    maxItems: 8,
  });
  for (const p of legacyPriorities) {
    if (!idSet.has(`aggregate-${p.id}`)) {
      discrepancies.push({
        code: `missing_aggregate:${p.id}`,
        message: `Legacy attention priority "${p.id}" ("${p.label}") has no corresponding Today feed item.`,
        severity: "error",
      });
    }
  }

  const inClinicCards = dashboard.receptionBoard.cards.filter((c) => IN_CLINIC_COLUMNS.has(c.receptionColumn));
  for (const c of inClinicCards) {
    if (!idSet.has(`reception-${c.id}`)) {
      discrepancies.push({
        code: `missing_reception_item:${c.id}`,
        message: `"${c.displayName}" is in-clinic per the legacy reception board but has no Today feed item.`,
        severity: "error",
      });
    }
  }
  const legacyInClinicCount = countPatientsInClinicToday(dashboard.receptionBoard.cards);
  if (legacyInClinicCount !== inClinicCards.length) {
    discrepancies.push({
      code: "in_clinic_count_definition_drift",
      message: `countPatientsInClinicToday() (${legacyInClinicCount}) disagrees with the shared IN_CLINIC_COLUMNS filter (${inClinicCards.length}) — the two definitions have drifted apart.`,
      severity: "error",
    });
  }

  for (const l of dashboard.staleLeads) {
    if (!idSet.has(`stale-lead-${l.leadId}`)) {
      discrepancies.push({
        code: `missing_stale_lead:${l.leadId}`,
        message: `Stale lead "${l.title}" has no corresponding Today feed item.`,
        severity: "error",
      });
    }
  }

  for (const t of dashboard.tasksDue) {
    if (!idSet.has(`task-${t.id}`)) {
      discrepancies.push({
        code: `missing_task_due:${t.id}`,
        message: `Task "${t.title}" has no corresponding Today feed item.`,
        severity: "error",
      });
    }
  }

  for (const r of dashboard.upcomingReminders) {
    if (!idSet.has(`reminder-${r.jobId}`)) {
      discrepancies.push({
        code: `missing_reminder:${r.jobId}`,
        message: `Reminder for "${r.recipientLabel}" has no corresponding Today feed item.`,
        severity: "warning",
      });
    }
  }

  const legacySignalCount =
    legacyPriorities.length +
    inClinicCards.length +
    dashboard.staleLeads.length +
    dashboard.tasksDue.length +
    dashboard.upcomingReminders.length;

  return {
    tenantId: dashboard.tenantId,
    computedAt: now.toISOString(),
    discrepancies,
    legacySignalCount,
    todayFeedSignalCount: allItems.length,
  };
}

/**
 * Fire-and-forget validation for the tenant home render path. Never throws —
 * a bug in shadow validation must never affect which surface actually renders.
 * Disable via `FI_TODAY_SURFACE_SHADOW_LOG=false` if logging becomes noisy.
 */
export function runTodayFeedShadowValidation(input: {
  dashboard: TenantOperationalDashboard;
  showCrmNav: boolean;
  profileKey?: FiWorkspaceProfileKey;
  now?: Date;
}): void {
  if (process.env.FI_TODAY_SURFACE_SHADOW_LOG?.trim().toLowerCase() === "false") return;

  try {
    const result = computeTodayFeedShadowDiff(input);
    if (result.discrepancies.length === 0) return;
    // eslint-disable-next-line no-console -- intentional shadow-mode telemetry, not user-facing.
    console.warn("[today-feed-shadow] discrepancies detected", {
      tenantId: result.tenantId,
      computedAt: result.computedAt,
      legacySignalCount: result.legacySignalCount,
      todayFeedSignalCount: result.todayFeedSignalCount,
      discrepancies: result.discrepancies,
    });
  } catch (e) {
    // eslint-disable-next-line no-console -- intentional shadow-mode telemetry, not user-facing.
    console.error("[today-feed-shadow] shadow validation crashed", {
      tenantId: input.dashboard.tenantId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

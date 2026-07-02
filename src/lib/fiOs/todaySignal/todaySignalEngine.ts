import type { TodayEntityAttentionSignal } from "@/src/lib/fiOs/todayFeedEntityAttention";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import { parseArrivalIntentAt } from "@/src/lib/fiOs/todaySignal/bookingArrivalIntentCore";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
/**
 * FI-UX-REBUILD D6 — unified signal engine facade.
 * Raw operational state → Today feed (via existing derive + entity attention loaders).
 */

export type TodayMagicMomentKey =
  | "patient_arrival_intent"
  | "patient_checked_in"
  | "payment_blocker_cleared"
  | "pathology_result_arrived"
  | "surgery_readiness_changed"
  | "lead_stale";

export type TodayMagicMomentSpec = {
  key: TodayMagicMomentKey;
  label: string;
  autoResolves: boolean;
  refreshTrigger: "dashboard_reload";
};

export const TODAY_MAGIC_MOMENTS: Record<TodayMagicMomentKey, TodayMagicMomentSpec> = {
  patient_arrival_intent: {
    key: "patient_arrival_intent",
    label: "Patient says they're here",
    autoResolves: true,
    refreshTrigger: "dashboard_reload",
  },
  patient_checked_in: {
    key: "patient_checked_in",
    label: "Reception confirms check-in",
    autoResolves: true,
    refreshTrigger: "dashboard_reload",
  },
  payment_blocker_cleared: {
    key: "payment_blocker_cleared",
    label: "Payment clears financial/surgery blocker",
    autoResolves: true,
    refreshTrigger: "dashboard_reload",
  },
  pathology_result_arrived: {
    key: "pathology_result_arrived",
    label: "Pathology result needs review",
    autoResolves: true,
    refreshTrigger: "dashboard_reload",
  },
  surgery_readiness_changed: {
    key: "surgery_readiness_changed",
    label: "Surgery checklist readiness updates",
    autoResolves: true,
    refreshTrigger: "dashboard_reload",
  },
  lead_stale: {
    key: "lead_stale",
    label: "Lead becomes stale without follow-up",
    autoResolves: true,
    refreshTrigger: "dashboard_reload",
  },
};

/** Non-PHI fingerprint for cheap client revision polling. */
export function computeTodaySignalRevision(
  dashboard: Pick<
    TenantOperationalDashboard,
    "actionCentre" | "receptionBoard" | "staleLeads" | "entityAttention" | "tasksDue"
  >
): string {
  const reception = dashboard.receptionBoard.cards.map((c) => ({
    id: c.id,
    col: c.receptionColumn,
    st: c.bookingStatus,
    intent: parseArrivalIntentAt(c.metadata),
  }));
  const payload = {
    ac: dashboard.actionCentre,
    reception,
    stale: dashboard.staleLeads.map((l) => ({ id: l.leadId, d: l.daysInStage })),
    entity: dashboard.entityAttention.map((s) => s.id),
    tasks: dashboard.tasksDue.map((t) => ({ id: t.id, s: t.status })),
  };
  return stableJsonHash(payload);
}

function stableJsonHash(value: unknown): string {  const json = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export type TodaySignalEngineOutput = {  entitySignals: readonly TodayEntityAttentionSignal[];
  feedItems: readonly TodayFeedItem[];
};

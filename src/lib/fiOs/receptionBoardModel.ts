/**
 * Reception Board V1 — pure helpers for tenant-local day filtering and column bucketing.
 * Fine-grained "in consultation" vs "in treatment" uses optional `fi_reception_flow_phase` on
 * `fi_bookings.metadata` (no schema migration); status remains `arrived`.
 */

export const FI_RECEPTION_FLOW_PHASE_KEY = "fi_reception_flow_phase" as const;

export type ReceptionFlowPhase = "consultation" | "treatment";

export const RECEPTION_BOARD_COLUMN_IDS = [
  "expected",
  "arrived",
  "in_consultation",
  "in_treatment",
  "complete",
  "no_show",
  "cancelled",
] as const;

export type ReceptionBoardColumnId = (typeof RECEPTION_BOARD_COLUMN_IDS)[number];

export function parseReceptionFlowPhase(metadata: Record<string, unknown> | null | undefined): ReceptionFlowPhase | null {
  const v = metadata?.[FI_RECEPTION_FLOW_PHASE_KEY];
  if (v === "consultation" || v === "treatment") return v;
  return null;
}

/** Merge reception phase into booking metadata (full object replace on PATCH). */
export function withReceptionFlowPhase(
  metadata: Record<string, unknown>,
  phase: ReceptionFlowPhase | null
): Record<string, unknown> {
  const next = { ...metadata };
  if (phase == null) {
    delete next[FI_RECEPTION_FLOW_PHASE_KEY];
  } else {
    next[FI_RECEPTION_FLOW_PHASE_KEY] = phase;
  }
  return next;
}

/**
 * Booking `start_at` must fall in `[localStartIso, localEndIso)` — same operational-day bounds
 * as `TenantOperationalDashboard.operationalDay`.
 */
export function bookingStartFallsOnOperationalWindow(
  startAtIso: string,
  localStartIso: string,
  localEndIso: string
): boolean {
  const s = startAtIso.trim();
  return s >= localStartIso.trim() && s < localEndIso.trim();
}

/**
 * Map DB booking status + optional reception metadata to a board column.
 * Unknown non-terminal statuses surface under **expected** so they are not dropped silently.
 */
export function receptionBoardColumnForBooking(row: {
  booking_status: string;
  metadata: Record<string, unknown>;
}): ReceptionBoardColumnId {
  const st = String(row.booking_status ?? "").trim();
  if (st === "cancelled") return "cancelled";
  if (st === "completed") return "complete";
  if (st === "no_show") return "no_show";
  if (st === "scheduled" || st === "confirmed") return "expected";
  if (st === "arrived") {
    const phase = parseReceptionFlowPhase(row.metadata);
    if (phase === "consultation") return "in_consultation";
    if (phase === "treatment") return "in_treatment";
    return "arrived";
  }
  return "expected";
}

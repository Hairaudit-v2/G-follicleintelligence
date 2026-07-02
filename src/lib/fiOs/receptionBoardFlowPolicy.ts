/**
 * Pure policy for Reception Board flow actions (PIN vs full session, window, payloads).
 */

import {
  bookingStartFallsOnOperationalWindow,
  FI_RECEPTION_FLOW_PHASE_KEY,
  withReceptionFlowPhase,
} from "@/src/lib/fiOs/receptionBoardModel";

export const RECEPTION_BOARD_FLOW_ACTIONS = [
  "mark_arrived",
  "start_consultation",
  "start_treatment",
  "complete",
  "mark_no_show",
  "cancel",
] as const;

export type ReceptionBoardFlowActionKind = (typeof RECEPTION_BOARD_FLOW_ACTIONS)[number];

export const RECEPTION_BOARD_FLOW_ACTION_LABELS: Record<ReceptionBoardFlowActionKind, string> = {
  mark_arrived: "Check in patient",
  start_consultation: "Start consultation",
  start_treatment: "Start treatment",
  complete: "Complete visit",
  mark_no_show: "Mark no-show",
  cancel: "Cancel appointment",
};

export function receptionBoardFlowActionLabel(action: ReceptionBoardFlowActionKind): string {
  return RECEPTION_BOARD_FLOW_ACTION_LABELS[action];
}

export function staffPinMayRunReceptionFlowAction(action: ReceptionBoardFlowActionKind): boolean {
  return action !== "cancel";
}

export function assertBookingStartInOperationalWindow(
  startAtIso: string,
  localStartIso: string,
  localEndIso: string
): { ok: true } | { ok: false; error: string } {
  if (!bookingStartFallsOnOperationalWindow(startAtIso, localStartIso, localEndIso)) {
    return {
      ok: false,
      error: "That booking is not on today's board (outside the clinic operational day).",
    };
  }
  return { ok: true };
}

export function assertBookingMutableForReceptionFlow(
  bookingStatus: string
): { ok: true } | { ok: false; error: string } {
  const st = String(bookingStatus ?? "").trim();
  if (st === "cancelled" || st === "completed" || st === "no_show") {
    return { ok: false, error: "This booking can no longer be changed." };
  }
  return { ok: true };
}

/** Phase label for PIN audit detail (metadata `fi_reception_flow_phase`). */
export function receptionFlowAuditPhaseLabel(metadata: Record<string, unknown>): string | null {
  const v = metadata[FI_RECEPTION_FLOW_PHASE_KEY];
  if (v === "consultation" || v === "treatment") return v;
  return null;
}

export function applyPhaseIntentToMetadataForAction(
  action: "mark_arrived" | "start_consultation" | "start_treatment" | "mark_no_show",
  baseMetadata: Record<string, unknown>
): Record<string, unknown> {
  if (action === "mark_arrived") return withReceptionFlowPhase(baseMetadata, null);
  if (action === "start_consultation") return withReceptionFlowPhase(baseMetadata, "consultation");
  if (action === "start_treatment") return withReceptionFlowPhase(baseMetadata, "treatment");
  if (action === "mark_no_show") return withReceptionFlowPhase(baseMetadata, null);
  return baseMetadata;
}

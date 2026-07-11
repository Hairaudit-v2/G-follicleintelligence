/**
 * FI-UX-REBUILD-1 S3.3 — pure display helpers for Front Desk Today UI.
 * No React. No payload derivation — only presentation-field ordering and labels.
 */

import type { ReceptionBoardFlowActionKind } from "@/src/lib/fiOs/receptionBoardFlowPolicy";
import { receptionBoardFlowActionLabel } from "@/src/lib/fiOs/receptionBoardFlowPolicy";
import type { ReceptionOperationalState } from "@/src/lib/fiOs/receptionBoardModel";
import type {
  FrontDeskCardActionId,
  FrontDeskPaymentState,
  FrontDeskSeverity,
  FrontDeskTodayCard,
} from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types";

/** Staff-facing labels for S3.1 operational states (S2 vocabulary). */
export const FRONT_DESK_OPERATIONAL_STATE_LABELS: Record<ReceptionOperationalState, string> = {
  cancelled: "Cancelled",
  complete: "Completed",
  no_show: "No-show",
  in_treatment: "In treatment",
  in_consultation: "In consultation",
  waiting: "Waiting",
  running_late: "Running late",
  arriving_soon: "Arriving soon",
  expected: "Expected",
};

export const FRONT_DESK_SEVERITY_LABELS: Record<FrontDeskSeverity, string> = {
  blocker: "Blocker",
  action_needed: "Action needed",
  information: "Information",
};

export const FRONT_DESK_CARD_ACTION_LABELS: Record<FrontDeskCardActionId, string> = {
  check_in: "Check in patient",
  start_consultation: "Start consultation",
  start_treatment: "Start treatment",
  complete: "Complete visit",
  no_show: "Mark no-show",
  cancel: "Cancel appointment",
  take_payment: "Take payment",
  find_patient: "Find patient",
  open_patient: "Open patient",
  open_calendar: "Open calendar",
};

const FLOW_ACTION_IDS = new Set<FrontDeskCardActionId>([
  "check_in",
  "start_consultation",
  "start_treatment",
  "complete",
  "no_show",
  "cancel",
]);

/** Display priority for primary action by operational state (first match in allowedActions wins). */
const PRIMARY_BY_STATE: Record<ReceptionOperationalState, FrontDeskCardActionId[]> = {
  expected: ["check_in", "open_patient", "open_calendar"],
  arriving_soon: ["check_in", "open_patient", "open_calendar"],
  running_late: ["check_in", "open_patient", "open_calendar"],
  waiting: ["start_consultation", "start_treatment", "complete", "open_patient"],
  in_consultation: ["start_treatment", "complete", "open_patient"],
  in_treatment: ["complete", "open_patient", "open_calendar"],
  complete: ["open_patient", "open_calendar", "take_payment"],
  cancelled: ["open_patient", "open_calendar"],
  no_show: ["open_patient", "open_calendar"],
};

/**
 * Order allowedActions for display: primary first (by state hierarchy), then rest.
 * Pure — does not invent actions not already in `allowedActions`.
 */
export function orderFrontDeskCardActions(
  card: Pick<FrontDeskTodayCard, "operationalState" | "allowedActions" | "payment">
): { primary: FrontDeskCardActionId | null; secondary: FrontDeskCardActionId[] } {
  const allowed = new Set(card.allowedActions);
  const preferred = PRIMARY_BY_STATE[card.operationalState] ?? ["open_patient"];
  let primary: FrontDeskCardActionId | null = null;
  for (const id of preferred) {
    if (allowed.has(id)) {
      primary = id;
      break;
    }
  }
  if (!primary) {
    primary = card.allowedActions[0] ?? null;
  }

  const secondary = card.allowedActions.filter((id) => id !== primary);

  // Surface take_payment early when payment needs attention and allowed.
  if (
    allowed.has("take_payment") &&
    (card.payment.state === "due" || card.payment.state === "overdue")
  ) {
    const rest = secondary.filter((id) => id !== "take_payment");
    return { primary, secondary: ["take_payment", ...rest] };
  }

  return { primary, secondary };
}

export function isFrontDeskFlowActionId(id: FrontDeskCardActionId): boolean {
  return FLOW_ACTION_IDS.has(id);
}

export function mapFrontDeskCardActionToFlowAction(
  id: FrontDeskCardActionId
): ReceptionBoardFlowActionKind | null {
  switch (id) {
    case "check_in":
      return "mark_arrived";
    case "start_consultation":
      return "start_consultation";
    case "start_treatment":
      return "start_treatment";
    case "complete":
      return "complete";
    case "no_show":
      return "mark_no_show";
    case "cancel":
      return "cancel";
    default:
      return null;
  }
}

export function frontDeskCardActionLabel(id: FrontDeskCardActionId): string {
  return FRONT_DESK_CARD_ACTION_LABELS[id];
}

export function frontDeskFlowActionSuccessLabel(id: FrontDeskCardActionId): string {
  const flow = mapFrontDeskCardActionToFlowAction(id);
  if (flow) return receptionBoardFlowActionLabel(flow);
  return frontDeskCardActionLabel(id);
}

export function paymentNeedsAttention(state: FrontDeskPaymentState): boolean {
  return state === "due" || state === "overdue";
}

/** Ensure payments href is always the canonical Payments inbox. */
export function frontDeskPaymentsHref(tenantId: string): string {
  return `/fi-admin/${tenantId.trim()}/payments`;
}

export function frontDeskPatientsSearchHref(tenantId: string, query: string): string {
  const q = query.trim();
  const base = `/fi-admin/${tenantId.trim()}/patients`;
  return q ? `${base}?q=${encodeURIComponent(q)}` : base;
}

/** Staff-facing copy checks — no architecture language. */
export function staffFacingCopyIsClean(text: string): boolean {
  return !/\b(ReceptionOS|SurgeryOS|WorkforceOS|FinancialOS|PatientOS|LeadFlow|Command Centre|Command Center|Patient Twin|HR OS)\b/i.test(
    text
  );
}

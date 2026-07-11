/**
 * FI-UX-REBUILD-1 S3.4A — pure dual-run comparison (IDs and counts only, no PHI).
 *
 * Compares old reception-board command-centre payload cards against the S3.2
 * Front Desk Today presentation. Does not load data or rebuild presentation.
 */

import {
  RECEPTION_RUNNING_LATE_GRACE_MINUTES,
  type ReceptionOperationalState,
} from "@/src/lib/fiOs/receptionBoardModel";
import type { FrontDeskTodayPresentation } from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types";
import type { ReceptionBoardCommandCenterPayload } from "@/src/lib/receptionBoard/receptionBoardTypes";

export type FrontDeskDualRunStateDifferenceKind =
  | "expected_to_arriving_soon"
  | "expected_to_running_late"
  | "arrived_to_waiting"
  | "arrived_to_in_consultation"
  | "arrived_to_in_treatment"
  | "other_intentional"
  | "unexpected";

export type FrontDeskDualRunStateDifference = {
  bookingId: string;
  oldColumn: string;
  newState: ReceptionOperationalState;
  kind: FrontDeskDualRunStateDifferenceKind;
};

export type FrontDeskDualRunComparison = {
  tenantId: string;
  operationalDay: string;
  generatedAt: string;
  runningLateGraceMinutes: number;
  oldBookingIds: string[];
  newBookingIds: string[];
  missingFromNew: string[];
  extraInNew: string[];
  duplicateBookingIds: string[];
  counts: {
    total: { old: number; new: number };
    completed: { old: number; new: number };
    cancelledOrNoShow: { old: number; new: number };
    paymentDue: { old: number; new: number };
    keyedBlockers: { old: number; new: number };
  };
  stateDifferences: FrontDeskDualRunStateDifference[];
  paymentMismatches: string[];
  keyedBlockerMismatches: string[];
  panelOnlyAlertIds: string[];
  intentionalNotes: string[];
  hardFailures: string[];
  pass: boolean;
};

function uniqueSorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function collectPresentationBookingIds(
  presentation: FrontDeskTodayPresentation
): { all: string[]; duplicates: string[] } {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const add = (id: string) => {
    if (seen.has(id)) duplicates.add(id);
    else seen.add(id);
  };
  for (const lane of presentation.lanes) {
    for (const c of lane.cards) add(c.bookingId);
  }
  for (const c of presentation.exceptionCards.cancelled) add(c.bookingId);
  for (const c of presentation.exceptionCards.noShow) add(c.bookingId);
  return { all: uniqueSorted(seen), duplicates: uniqueSorted(duplicates) };
}

function classifyStateDiff(
  oldColumn: string,
  newState: ReceptionOperationalState
): FrontDeskDualRunStateDifferenceKind {
  if (oldColumn === "expected" && newState === "arriving_soon") {
    return "expected_to_arriving_soon";
  }
  if (oldColumn === "expected" && newState === "running_late") {
    return "expected_to_running_late";
  }
  if (oldColumn === "expected" && newState === "expected") {
    return "other_intentional";
  }
  if (oldColumn === "arrived" && newState === "waiting") {
    return "arrived_to_waiting";
  }
  if (oldColumn === "in_consultation" && newState === "in_consultation") {
    return "other_intentional";
  }
  if (oldColumn === "in_treatment" && newState === "in_treatment") {
    return "other_intentional";
  }
  if (oldColumn === "arrived" && newState === "in_consultation") {
    return "arrived_to_in_consultation";
  }
  if (oldColumn === "arrived" && newState === "in_treatment") {
    return "arrived_to_in_treatment";
  }
  if (oldColumn === "complete" && newState === "complete") {
    return "other_intentional";
  }
  if (
    (oldColumn === "cancelled" && newState === "cancelled") ||
    (oldColumn === "no_show" && newState === "no_show")
  ) {
    return "other_intentional";
  }
  // Terminal column vs state renames
  if (oldColumn === "complete" && newState === "complete") return "other_intentional";
  return "unexpected";
}

/**
 * Pure dual-run audit: same payload + already-built presentation.
 * Uses exported S3.1 grace constant for documentation of intentional late reclass.
 */
export function compareFrontDeskDualRun(
  payload: ReceptionBoardCommandCenterPayload,
  presentation: FrontDeskTodayPresentation,
  opts?: { nowMs?: number }
): FrontDeskDualRunComparison {
  const nowMs =
    opts?.nowMs ??
    (Number.isFinite(Date.parse(payload.loadedAt))
      ? Date.parse(payload.loadedAt)
      : Date.parse(presentation.generatedAt));

  const oldIds = uniqueSorted((payload.receptionCards ?? []).map((c) => c.id).filter(Boolean));
  const { all: newIds, duplicates: duplicateBookingIds } =
    collectPresentationBookingIds(presentation);

  const oldSet = new Set(oldIds);
  const newSet = new Set(newIds);
  const missingFromNew = oldIds.filter((id) => !newSet.has(id));
  const extraInNew = newIds.filter((id) => !oldSet.has(id));

  const oldById = new Map((payload.receptionCards ?? []).map((c) => [c.id, c]));
  const newById = new Map<string, { state: ReceptionOperationalState; payment: string }>();
  for (const lane of presentation.lanes) {
    for (const c of lane.cards) {
      newById.set(c.bookingId, { state: c.operationalState, payment: c.payment.state });
    }
  }
  for (const c of presentation.exceptionCards.cancelled) {
    newById.set(c.bookingId, { state: c.operationalState, payment: c.payment.state });
  }
  for (const c of presentation.exceptionCards.noShow) {
    newById.set(c.bookingId, { state: c.operationalState, payment: c.payment.state });
  }

  const stateDifferences: FrontDeskDualRunStateDifference[] = [];
  for (const id of oldIds) {
    const old = oldById.get(id);
    const neu = newById.get(id);
    if (!old || !neu) continue;
    // Document intentional remodel pairs (column → operational state).
    const kind = classifyStateDiff(old.receptionColumn, neu.state);
    if (
      kind === "expected_to_arriving_soon" ||
      kind === "expected_to_running_late" ||
      kind === "arrived_to_waiting" ||
      kind === "arrived_to_in_consultation" ||
      kind === "arrived_to_in_treatment" ||
      kind === "unexpected"
    ) {
      stateDifferences.push({
        bookingId: id,
        oldColumn: old.receptionColumn,
        newState: neu.state,
        kind,
      });
    }
  }

  // Counts
  const oldCompleted = (payload.receptionCards ?? []).filter(
    (c) => c.receptionColumn === "complete" || c.bookingStatus === "completed"
  ).length;
  const oldCancelledOrNoShow = (payload.receptionCards ?? []).filter(
    (c) =>
      c.receptionColumn === "cancelled" ||
      c.receptionColumn === "no_show" ||
      c.bookingStatus === "cancelled" ||
      c.bookingStatus === "no_show"
  ).length;

  const apptById = new Map((payload.appointments ?? []).map((a) => [a.id, a]));
  const oldPaymentDueIds = uniqueSorted(
    (payload.receptionCards ?? [])
      .map((c) => {
        const p = apptById.get(c.id)?.paymentStatus;
        return p === "due" || p === "overdue" ? c.id : null;
      })
      .filter((x): x is string => !!x)
  );
  const newPaymentDueIds = uniqueSorted(
    [...newById.entries()]
      .filter(([, v]) => v.payment === "due" || v.payment === "overdue")
      .map(([id]) => id)
  );

  // Shell-tier presentation may leave payment unknown — only compare when full
  const paymentMismatches: string[] = [];
  if (presentation.loadTier === "full") {
    for (const id of oldPaymentDueIds) {
      if (!newPaymentDueIds.includes(id) && newSet.has(id)) paymentMismatches.push(id);
    }
    for (const id of newPaymentDueIds) {
      if (!oldPaymentDueIds.includes(id) && oldSet.has(id)) paymentMismatches.push(id);
    }
  }

  // Explicitly keyed alerts vs presentation card blockers / attention bookingIds
  const oldKeyedAlertBookingIds = uniqueSorted(
    (payload.actionAlerts ?? [])
      .map((a) => a.bookingId?.trim() || null)
      .filter((x): x is string => !!x && oldSet.has(x))
  );
  const newKeyedBlockerBookingIds = uniqueSorted(
    [
      ...presentation.lanes.flatMap((l) =>
        l.cards.filter((c) => c.blocker.items.length > 0).map((c) => c.bookingId)
      ),
      ...presentation.attentionItems
        .map((a) => a.bookingId)
        .filter((x): x is string => !!x),
    ]
  );

  const keyedBlockerMismatches: string[] = [];
  // Soft: only flag when old has keyed alert but new has neither card blocker nor attention
  for (const id of oldKeyedAlertBookingIds) {
    const cardHas = [...newById.keys()].includes(id);
    const hasBlocker =
      presentation.lanes.some((l) =>
        l.cards.some((c) => c.bookingId === id && c.blocker.items.length > 0)
      ) || presentation.attentionItems.some((a) => a.bookingId === id);
    if (cardHas && !hasBlocker) {
      // May be filtered kind (pipeline) — check alert kind
      const alerts = (payload.actionAlerts ?? []).filter((a) => a.bookingId === id);
      const allExcluded = alerts.every(
        (a) => a.kind === "no_follow_up_after_consultation"
      );
      if (!allExcluded) keyedBlockerMismatches.push(id);
    }
  }

  const panelOnlyAlertIds = uniqueSorted(
    (payload.actionAlerts ?? [])
      .filter((a) => !a.bookingId?.trim() && !a.patientId?.trim())
      .map((a) => a.id)
  );

  const intentionalNotes: string[] = [
    `Running late uses RECEPTION_RUNNING_LATE_GRACE_MINUTES=${RECEPTION_RUNNING_LATE_GRACE_MINUTES}`,
    "expected may reclassify to arriving_soon or running_late",
    "arrived without phase reclassifies to waiting",
    "pipeline/manager alerts excluded from attention",
    "unkeyed alerts remain panel-only",
  ];

  const hardFailures: string[] = [];
  if (missingFromNew.length) hardFailures.push(`missingFromNew:${missingFromNew.length}`);
  if (extraInNew.length) hardFailures.push(`extraInNew:${extraInNew.length}`);
  if (duplicateBookingIds.length) {
    hardFailures.push(`duplicateBookingIds:${duplicateBookingIds.length}`);
  }
  if (oldCompleted !== presentation.summary.completed) {
    hardFailures.push(
      `completedDrift:old=${oldCompleted},new=${presentation.summary.completed}`
    );
  }
  if (oldCancelledOrNoShow !== presentation.summary.cancelledOrNoShow) {
    hardFailures.push(
      `cancelledOrNoShowDrift:old=${oldCancelledOrNoShow},new=${presentation.summary.cancelledOrNoShow}`
    );
  }
  if (paymentMismatches.length) {
    hardFailures.push(`paymentMismatches:${uniqueSorted(paymentMismatches).length}`);
  }
  if (keyedBlockerMismatches.length) {
    hardFailures.push(`keyedBlockerMismatches:${keyedBlockerMismatches.length}`);
  }
  const unexpectedStates = stateDifferences.filter((d) => d.kind === "unexpected");
  if (unexpectedStates.length) {
    hardFailures.push(`unexpectedStateDiffs:${unexpectedStates.length}`);
  }

  return {
    tenantId: payload.tenantId,
    operationalDay: payload.operationalDay?.todayYmd ?? presentation.operationalDay.todayYmd,
    generatedAt: presentation.generatedAt || payload.loadedAt,
    runningLateGraceMinutes: RECEPTION_RUNNING_LATE_GRACE_MINUTES,
    oldBookingIds: oldIds,
    newBookingIds: newIds,
    missingFromNew,
    extraInNew,
    duplicateBookingIds,
    counts: {
      total: { old: oldIds.length, new: newIds.length },
      completed: { old: oldCompleted, new: presentation.summary.completed },
      cancelledOrNoShow: {
        old: oldCancelledOrNoShow,
        new: presentation.summary.cancelledOrNoShow,
      },
      paymentDue: {
        old: oldPaymentDueIds.length,
        new: newPaymentDueIds.length,
      },
      keyedBlockers: {
        old: oldKeyedAlertBookingIds.length,
        new: newKeyedBlockerBookingIds.length,
      },
    },
    stateDifferences,
    paymentMismatches: uniqueSorted(paymentMismatches),
    keyedBlockerMismatches: uniqueSorted(keyedBlockerMismatches),
    panelOnlyAlertIds,
    intentionalNotes,
    hardFailures,
    pass: hardFailures.length === 0,
  };
}

function mapStateToLegacyColumn(state: ReceptionOperationalState): string {
  switch (state) {
    case "cancelled":
      return "cancelled";
    case "complete":
      return "complete";
    case "no_show":
      return "no_show";
    case "in_treatment":
      return "in_treatment";
    case "in_consultation":
      return "in_consultation";
    case "waiting":
      return "arrived";
    case "running_late":
    case "arriving_soon":
    case "expected":
      return "expected";
    default:
      return "expected";
  }
}

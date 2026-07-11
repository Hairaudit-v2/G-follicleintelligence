/**
 * Reception Board / Front Desk — pure operational status model (S3.1).
 *
 * Derives one canonical operational state per booking from:
 * - booking_status
 * - optional fi_reception_flow_phase metadata
 * - appointment start time vs fixed `nowMs`
 * - explicit arriving-soon / running-late thresholds
 *
 * No I/O. Callers supply timestamps so tests stay deterministic.
 *
 * Lane precedence (first match wins when evaluating):
 * 1. cancelled
 * 2. complete
 * 3. no_show
 * 4. in_treatment   (arrived + treatment phase)
 * 5. in_consultation (arrived + consultation phase)
 * 6. waiting        (arrived, no phase) — even if start is in the past
 * 7. running_late   (expected family, start + grace has passed, not arrived)
 * 8. arriving_soon  (expected family, start within upcoming window)
 * 9. expected       (default for non-terminal, non-arrived)
 *
 * Terminal states always override expected / late / arriving.
 * Arrived always beats running late (never "late" after check-in).
 */

export const FI_RECEPTION_FLOW_PHASE_KEY = "fi_reception_flow_phase" as const;

export type ReceptionFlowPhase = "consultation" | "treatment";

/** Legacy board column ids (time-agnostic bucketing used by existing UI). */
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

/**
 * Canonical Front Desk operational states (S3.1).
 * Includes time-aware arriving_soon / running_late and explicit waiting.
 */
export const RECEPTION_OPERATIONAL_STATES = [
  "cancelled",
  "complete",
  "no_show",
  "in_treatment",
  "in_consultation",
  "waiting",
  "running_late",
  "arriving_soon",
  "expected",
] as const;

export type ReceptionOperationalState = (typeof RECEPTION_OPERATIONAL_STATES)[number];

/** Minutes before appointment start when an expected booking becomes "arriving soon". */
export const RECEPTION_ARRIVING_SOON_WINDOW_MINUTES = 60;

/**
 * Minutes after appointment start before an expected (not-arrived) booking becomes "running late".
 * Zero matches existing presentation overdue behaviour (`startAt <= now`).
 */
export const RECEPTION_RUNNING_LATE_GRACE_MINUTES = 0;

export function parseReceptionFlowPhase(
  metadata: Record<string, unknown> | null | undefined
): ReceptionFlowPhase | null {
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

function normalizeBookingStatus(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

export function isReceptionOperationalTerminalState(
  state: ReceptionOperationalState
): boolean {
  return state === "cancelled" || state === "complete" || state === "no_show";
}

/** Map booking_status alone to a terminal operational state, if any. */
export function receptionTerminalStateFromBookingStatus(
  bookingStatus: string | null | undefined
): ReceptionOperationalState | null {
  const st = normalizeBookingStatus(bookingStatus);
  if (st === "cancelled") return "cancelled";
  if (st === "completed") return "complete";
  if (st === "no_show") return "no_show";
  return null;
}

export type DeriveReceptionOperationalStateInput = {
  bookingStatus: string;
  metadata?: Record<string, unknown> | null;
  /** Appointment start ISO. Missing/invalid → never arriving_soon / running_late. */
  startAtIso?: string | null;
  /** Fixed clock for derivation (ms since epoch). */
  nowMs: number;
  /** Override default {@link RECEPTION_ARRIVING_SOON_WINDOW_MINUTES}. */
  arrivingSoonWindowMinutes?: number;
  /** Override default {@link RECEPTION_RUNNING_LATE_GRACE_MINUTES}. */
  runningLateGraceMinutes?: number;
};

/**
 * Pure: one canonical operational state for a booking at `nowMs`.
 *
 * @see module header for precedence.
 */
export function deriveReceptionOperationalState(
  input: DeriveReceptionOperationalStateInput
): ReceptionOperationalState {
  const terminal = receptionTerminalStateFromBookingStatus(input.bookingStatus);
  if (terminal) return terminal;

  const st = normalizeBookingStatus(input.bookingStatus);

  // Arrived path — never running_late / arriving_soon / expected.
  if (st === "arrived") {
    const phase = parseReceptionFlowPhase(input.metadata);
    if (phase === "treatment") return "in_treatment";
    if (phase === "consultation") return "in_consultation";
    return "waiting";
  }

  // Expected family: scheduled, confirmed, and unknown non-terminal statuses.
  const startMs = parseStartMs(input.startAtIso);
  if (startMs == null) {
    return "expected";
  }

  const windowMin =
    input.arrivingSoonWindowMinutes ?? RECEPTION_ARRIVING_SOON_WINDOW_MINUTES;
  const graceMin =
    input.runningLateGraceMinutes ?? RECEPTION_RUNNING_LATE_GRACE_MINUTES;
  const windowMs = Math.max(0, windowMin) * 60_000;
  const graceMs = Math.max(0, graceMin) * 60_000;
  const now = input.nowMs;

  // Running late: start + grace has passed and patient still not arrived.
  if (startMs + graceMs <= now) {
    return "running_late";
  }

  // Arriving soon: start is still in the future (or at now before grace flips late)
  // and within the upcoming window.
  // After grace=0, startMs <= now is late; so arriving_soon requires startMs > now.
  if (startMs > now && startMs <= now + windowMs) {
    return "arriving_soon";
  }

  return "expected";
}

function parseStartMs(startAtIso: string | null | undefined): number | null {
  const raw = startAtIso?.trim();
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  return t;
}

/**
 * Map canonical operational state → legacy board column id.
 * Time-aware states collapse into expected/arrived for existing column UIs.
 */
export function receptionBoardColumnFromOperationalState(
  state: ReceptionOperationalState
): ReceptionBoardColumnId {
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
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

/**
 * Map DB booking status + optional reception metadata to a board column.
 * Time-agnostic (no arriving_soon / running_late). Unknown non-terminal → expected.
 * Retained for existing loaders/UI; prefer {@link deriveReceptionOperationalState} for Front Desk v2.
 */
export function receptionBoardColumnForBooking(row: {
  booking_status: string;
  metadata: Record<string, unknown>;
}): ReceptionBoardColumnId {
  return receptionBoardColumnFromOperationalState(
    deriveReceptionOperationalState({
      bookingStatus: row.booking_status,
      metadata: row.metadata,
      startAtIso: null,
      nowMs: 0,
    })
  );
}

/** True when an expected-family booking is in the arriving-soon window. */
export function isBookingArrivingSoon(
  input: Omit<DeriveReceptionOperationalStateInput, "nowMs"> & { nowMs: number }
): boolean {
  return deriveReceptionOperationalState(input) === "arriving_soon";
}

/** True when patient has arrived and no consult/treatment phase has started. */
export function isBookingWaiting(
  input: Pick<DeriveReceptionOperationalStateInput, "bookingStatus" | "metadata">
): boolean {
  return (
    deriveReceptionOperationalState({
      bookingStatus: input.bookingStatus,
      metadata: input.metadata,
      startAtIso: null,
      nowMs: 0,
    }) === "waiting"
  );
}

/** True when expected-family booking is past start + grace and not arrived. */
export function isBookingRunningLate(
  input: Omit<DeriveReceptionOperationalStateInput, "nowMs"> & { nowMs: number }
): boolean {
  return deriveReceptionOperationalState(input) === "running_late";
}

export type ReceptionLaneSortItem = {
  startAtIso?: string | null;
  bookingId: string;
};

/**
 * Stable ordering within an operational lane:
 * 1. appointment start ascending (invalid/missing starts sort last)
 * 2. booking id ascending (deterministic tie-break)
 */
export function compareReceptionLaneItems(
  a: ReceptionLaneSortItem,
  b: ReceptionLaneSortItem
): number {
  const as = parseStartMs(a.startAtIso);
  const bs = parseStartMs(b.startAtIso);
  const aKey = as == null ? Number.POSITIVE_INFINITY : as;
  const bKey = bs == null ? Number.POSITIVE_INFINITY : bs;
  if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  return a.bookingId.localeCompare(b.bookingId);
}

/** Pure sort of lane items (does not mutate input). */
export function sortReceptionLaneItems<T extends ReceptionLaneSortItem>(
  items: readonly T[]
): T[] {
  return [...items].sort(compareReceptionLaneItems);
}

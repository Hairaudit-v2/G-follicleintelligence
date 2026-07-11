/**
 * FI-UX-REBUILD-1 S3.2 — pure Front Desk Today presentation builder.
 *
 * Cards mint only from `payload.receptionCards` (keyed by bookingId).
 * appointments / queue / alerts may enrich existing cards only — never insert.
 *
 * No React, no I/O, no server-only.
 */

import {
  deriveReceptionOperationalState,
  isReceptionOperationalTerminalState,
  sortReceptionLaneItems,
  type ReceptionOperationalState,
} from "@/src/lib/fiOs/receptionBoardModel";
import { EXTENDED_ALERT_PRIORITY } from "@/src/lib/receptionBoard/receptionBoardCore";
import type {
  ReceptionBoardActionAlert,
  ReceptionBoardAppointmentCard,
  ReceptionBoardCommandCenterPayload,
} from "@/src/lib/receptionBoard/receptionBoardTypes";
import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

import type {
  FrontDeskAttentionItem,
  FrontDeskCardActionId,
  FrontDeskCardBlocker,
  FrontDeskMutationMode,
  FrontDeskPaymentState,
  FrontDeskSeverity,
  FrontDeskTodayCard,
  FrontDeskTodayGlobalAction,
  FrontDeskTodayLane,
  FrontDeskTodayLaneId,
  FrontDeskTodayPresentation,
  FrontDeskTodaySummary,
} from "./frontDeskTodayPresentation.types";

export type { FrontDeskTodayPresentation } from "./frontDeskTodayPresentation.types";

export const FRONT_DESK_TODAY_ATTENTION_CAP = 12;

/** Operational kinds allowed on the reception attention panel. */
const ATTENTION_ALLOWED_KINDS = new Set([
  "missing_deposit",
  "missing_consent",
  "missing_medical_clearance",
  "surgery_readiness_incomplete",
  "unconfirmed_surgery",
  "staff_not_assigned",
  "missing_pre_op_checklist",
  "missing_imaging",
  "missing_treatment_plan",
  "incomplete_consultation",
  "missing_forms",
  "surgery_risk",
]);

/** Kinds excluded from staff Today attention (pipeline / CRM / marketing). */
const ATTENTION_EXCLUDED_KINDS = new Set(["no_follow_up_after_consultation"]);

const SEVERITY_RANK: Record<FrontDeskSeverity, number> = {
  blocker: 3,
  action_needed: 2,
  information: 1,
};

const LANE_ORDER: readonly FrontDeskTodayLaneId[] = [
  "running_late",
  "waiting",
  "arriving_soon",
  "in_consultation",
  "in_treatment",
  "completed",
] as const;

const LANE_LABELS: Record<FrontDeskTodayLaneId, string> = {
  running_late: "Running late",
  waiting: "Waiting",
  arriving_soon: "Arriving soon",
  in_consultation: "In consultation",
  in_treatment: "In treatment",
  completed: "Completed",
};

const PAYMENT_LABELS: Record<FrontDeskPaymentState, string> = {
  paid: "Paid",
  due: "Payment due",
  overdue: "Payment overdue",
  not_required: "No payment required",
  unknown: "Payment unknown",
};

export type BuildFrontDeskTodayPresentationOptions = {
  /** Tenant base path, e.g. `/fi-admin/${tenantId}`. */
  base: string;
  /** Fixed clock for operational state (ms). */
  nowMs: number;
  mutationMode: FrontDeskMutationMode;
  maxAttentionItems?: number;
};

/**
 * Build the Front Desk Today presentation from the command-centre payload.
 * Pure over (payload, opts). Does not read wall clock.
 */
export function buildFrontDeskTodayPresentation(
  payload: ReceptionBoardCommandCenterPayload,
  opts: BuildFrontDeskTodayPresentationOptions
): FrontDeskTodayPresentation {
  const base = normalizeBase(opts.base);
  const nowMs = opts.nowMs;
  const maxAttention = opts.maxAttentionItems ?? FRONT_DESK_TODAY_ATTENTION_CAP;
  const loadTier = payload.loadTier === "shell" ? "shell" : "full";
  const tz = payload.operationalDay?.calendarTimezone?.trim() || "UTC";

  // 1–3. Canonical cards from receptionCards only.
  const cardsByBookingId = new Map<string, FrontDeskTodayCard>();
  for (const row of payload.receptionCards ?? []) {
    if (!row?.id) continue;
    if (cardsByBookingId.has(row.id)) continue; // first wins; never duplicate
    const state = deriveReceptionOperationalState({
      bookingStatus: row.bookingStatus,
      metadata: row.metadata ?? {},
      startAtIso: row.startAt,
      nowMs,
    });
    cardsByBookingId.set(row.id, baseCardFromReceptionRow(row, state, base, tz, nowMs, opts.mutationMode));
  }

  // 4–5. Index appointments; merge payment + journey by bookingId only.
  const appointmentsById = indexAppointments(payload.appointments ?? []);
  for (const [bookingId, card] of cardsByBookingId) {
    const appt = appointmentsById.get(bookingId);
    if (!appt) {
      if (loadTier === "shell") {
        card.payment = { state: "unknown", label: PAYMENT_LABELS.unknown };
      }
      continue;
    }
    if (loadTier === "shell") {
      card.payment = { state: "unknown", label: PAYMENT_LABELS.unknown };
    } else {
      const state = normalizePaymentState(appt.paymentStatus);
      card.payment = {
        state,
        label: appt.paymentStatusLabel?.trim() || PAYMENT_LABELS[state],
      };
    }
    // Enrich links from appointments when present
    if (appt.hrefs?.patient) card.links.patient = appt.hrefs.patient;
    if (appt.hrefs?.appointment) card.links.appointment = appt.hrefs.appointment;
    if (appt.hrefs?.calendar) card.links.calendar = appt.hrefs.calendar;
    if (appt.room && !card.resource.roomLabel) {
      card.resource.roomLabel = appt.room;
    }
    if (appt.clinician?.trim() && card.resource.clinicianLabel === "—") {
      card.resource.clinicianLabel = appt.clinician.trim();
    }
  }

  // 6–7. Alerts: explicit bookingId/patientId only — never parse composite ids.
  const attentionCandidates: FrontDeskAttentionItem[] = [];
  for (const raw of payload.actionAlerts ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const alert = sanitizeAlert(raw);
    if (!alert) continue;
    if (!isAttentionKindAllowed(alert.kind)) continue;

    const fdSeverity = mapPayloadSeverity(alert.severity);
    const bookingId = normalizeUuid(alert.bookingId);
    const patientId = normalizeUuid(alert.patientId);

    // Payment-style kinds from appointments (no alert required) handled below.
    const panelItem: FrontDeskAttentionItem = {
      id: alert.id,
      kind: alert.kind,
      title: alert.title,
      detail: alert.detail,
      severity: fdSeverity,
      href: alert.href,
      bookingId,
      patientId,
      priorityScore: Number.isFinite(alert.priorityScore) ? alert.priorityScore : 50,
    };

    if (bookingId && cardsByBookingId.has(bookingId)) {
      attachBlockerToCard(cardsByBookingId.get(bookingId)!, panelItem);
      attentionCandidates.push(panelItem);
    } else if (patientId) {
      // Badge each of that patient's today cards; one panel row.
      for (const card of cardsByBookingId.values()) {
        if (card.patient.patientId === patientId) {
          attachBlockerToCard(card, panelItem);
        }
      }
      attentionCandidates.push(panelItem);
    } else {
      // Neither ID → panel-only (ambiguous / unkeyed).
      attentionCandidates.push({ ...panelItem, bookingId: null, patientId: null });
    }
  }

  // Payment due/overdue as card blockers + panel (from appointments merge).
  if (loadTier === "full") {
    for (const card of cardsByBookingId.values()) {
      if (card.payment.state === "due" || card.payment.state === "overdue") {
        const sev: FrontDeskSeverity =
          card.payment.state === "overdue" ? "blocker" : "action_needed";
        const item: FrontDeskAttentionItem = {
          id: `payment-${card.bookingId}-${card.payment.state}`,
          kind: "missing_deposit",
          title: card.payment.label,
          detail: card.patient.displayName,
          severity: sev,
          href: `${base}/payments`,
          bookingId: card.bookingId,
          patientId: card.patient.patientId,
          priorityScore: card.payment.state === "overdue" ? 95 : 80,
        };
        attachBlockerToCard(card, item);
        // Overdue goes to panel; due stays card-only (contract table).
        if (card.payment.state === "overdue") {
          attentionCandidates.push(item);
        }
      }
    }
  }

  // 8–11. Finalize blockers on each card.
  for (const card of cardsByBookingId.values()) {
    finalizeCardBlockers(card);
    card.allowedActions = deriveAllowedActions(card.operationalState, opts.mutationMode);
  }

  // 12–13. Lanes + exceptions.
  const laneBuckets: Record<FrontDeskTodayLaneId, FrontDeskTodayCard[]> = {
    running_late: [],
    waiting: [],
    arriving_soon: [],
    in_consultation: [],
    in_treatment: [],
    completed: [],
  };
  const cancelled: FrontDeskTodayCard[] = [];
  const noShow: FrontDeskTodayCard[] = [];

  for (const card of cardsByBookingId.values()) {
    const state = card.operationalState;
    if (state === "cancelled") {
      card.laneId = null;
      cancelled.push(card);
      continue;
    }
    if (state === "no_show") {
      card.laneId = null;
      noShow.push(card);
      continue;
    }
    const laneId = laneIdForState(state);
    card.laneId = laneId;
    laneBuckets[laneId].push(card);
  }

  const lanes: FrontDeskTodayLane[] = LANE_ORDER.map((id) => {
    const sorted = sortReceptionLaneItems(
      laneBuckets[id].map((c) => ({
        ...c,
        startAtIso: c.appointment.startAtIso,
        bookingId: c.bookingId,
      }))
    );
    return {
      id,
      label: id === "arriving_soon" ? "Arriving soon" : LANE_LABELS[id],
      cards: sorted,
      count: sorted.length,
      collapsedByDefault: id === "completed",
    };
  });

  // 14. Attention: dedupe, sort, cap.
  const dedupedAttention = dedupeAttentionItems(attentionCandidates);
  const sortedAttention = sortAttentionItems(dedupedAttention);
  const totalAttention = sortedAttention.length;
  const visibleAttention = sortedAttention.slice(0, Math.max(0, maxAttention));
  const hiddenAttention = Math.max(0, totalAttention - visibleAttention.length);

  // 15. Summary + global actions.
  const summary = computeSummary(cardsByBookingId, cancelled.length + noShow.length);
  const actions = buildGlobalActions(base);

  return {
    generatedAt: payload.loadedAt || new Date(nowMs).toISOString(),
    operationalDay: {
      calendarTimezone: tz,
      todayYmd: payload.operationalDay?.todayYmd ?? "",
    },
    loadTier,
    lanes,
    exceptionCards: {
      cancelled: sortReceptionLaneItems(
        cancelled.map((c) => ({
          ...c,
          startAtIso: c.appointment.startAtIso,
          bookingId: c.bookingId,
        }))
      ),
      noShow: sortReceptionLaneItems(
        noShow.map((c) => ({
          ...c,
          startAtIso: c.appointment.startAtIso,
          bookingId: c.bookingId,
        }))
      ),
    },
    attentionItems: visibleAttention,
    attentionSummary: {
      total: totalAttention,
      visible: visibleAttention.length,
      hidden: hiddenAttention,
    },
    summary,
    actions,
  };
}

// --- internals ----------------------------------------------------------------

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "") || "";
}

function baseCardFromReceptionRow(
  row: ReceptionBoardCard,
  state: ReceptionOperationalState,
  base: string,
  tz: string,
  nowMs: number,
  mutationMode: FrontDeskMutationMode
): FrontDeskTodayCard {
  const startMs = Date.parse(row.startAt);
  const endMs = Date.parse(row.endAt);
  const durationMinutes =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
      ? Math.round((endMs - startMs) / 60_000)
      : null;

  const arrivalMs = extractArrivalMs(row.metadata ?? {});
  const waitingMinutes =
    arrivalMs != null && state === "waiting"
      ? Math.max(0, Math.floor((nowMs - arrivalMs) / 60_000))
      : null;

  return {
    bookingId: row.id,
    patient: {
      displayName: row.displayName?.trim() || "Patient",
      patientId: row.patientId ?? null,
      leadId: row.leadId ?? null,
    },
    appointment: {
      startAtIso: row.startAt,
      endAtIso: row.endAt,
      startTimeLabel: formatStartTime(row.startAt, tz),
      durationMinutes,
      typeLabel: row.typeLabel?.trim() || row.bookingType || "Appointment",
    },
    resource: {
      clinicianLabel: row.providerLabel?.trim() || "—",
      roomLabel: row.roomLabel?.trim() || null,
      clinicLabel: row.clinicLabel?.trim() || null,
    },
    operationalState: state,
    laneId: null,
    runningLate: state === "running_late",
    waitingMinutes,
    payment: { state: "unknown", label: PAYMENT_LABELS.unknown },
    blocker: { highest: null, summary: null, items: [] },
    contact: null,
    allowedActions: deriveAllowedActions(state, mutationMode),
    links: {
      patient: row.patientId ? `${base}/patients/${row.patientId}` : null,
      appointment: `${base}/appointments?bookingId=${row.id}`,
      calendar: `${base}/calendar?bookingId=${row.id}`,
    },
  };
}

function extractArrivalMs(metadata: Record<string, unknown>): number | null {
  for (const key of ["fi_reception_arrived_at", "arrived_at", "checked_in_at"]) {
    const v = metadata[key];
    if (typeof v === "string" && v.trim()) {
      const t = Date.parse(v);
      if (Number.isFinite(t)) return t;
    }
  }
  return null;
}

function formatStartTime(iso: string, tz: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return iso.slice(11, 16) || "—";
  }
}

function indexAppointments(
  rows: readonly ReceptionBoardAppointmentCard[]
): Map<string, ReceptionBoardAppointmentCard> {
  const map = new Map<string, ReceptionBoardAppointmentCard>();
  for (const row of rows) {
    if (!row?.id) continue;
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return map;
}

function normalizePaymentState(raw: string | undefined): FrontDeskPaymentState {
  switch (raw) {
    case "paid":
    case "due":
    case "overdue":
    case "not_required":
    case "unknown":
      return raw;
    default:
      return "unknown";
  }
}

function normalizeUuid(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  // Accept uuid-shaped strings only; do not invent IDs from composites.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  ) {
    return null;
  }
  return v;
}

function sanitizeAlert(raw: unknown): ReceptionBoardActionAlert | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Partial<ReceptionBoardActionAlert>;
  if (typeof a.id !== "string" || !a.id.trim()) return null;
  if (typeof a.kind !== "string" || !a.kind.trim()) return null;
  if (typeof a.title !== "string") return null;
  if (typeof a.detail !== "string") return null;
  const severity = a.severity;
  if (
    severity !== "info" &&
    severity !== "warning" &&
    severity !== "critical" &&
    severity !== "blocked"
  ) {
    return null;
  }
  return {
    id: a.id.trim(),
    kind: a.kind as ReceptionBoardActionAlert["kind"],
    title: a.title,
    detail: a.detail,
    severity,
    href: typeof a.href === "string" ? a.href : null,
    priorityScore: typeof a.priorityScore === "number" ? a.priorityScore : 50,
    bookingId: a.bookingId ?? null,
    patientId: a.patientId ?? null,
  };
}

function isAttentionKindAllowed(kind: string): boolean {
  if (ATTENTION_EXCLUDED_KINDS.has(kind)) return false;
  if (ATTENTION_ALLOWED_KINDS.has(kind)) return true;
  // Unknown kinds with explicit operational wording stay out unless allowlisted.
  return false;
}

function mapPayloadSeverity(
  severity: ReceptionBoardActionAlert["severity"]
): FrontDeskSeverity {
  switch (severity) {
    case "blocked":
    case "critical":
      return "blocker";
    case "warning":
      return "action_needed";
    case "info":
    default:
      return "information";
  }
}

function attachBlockerToCard(card: FrontDeskTodayCard, item: FrontDeskAttentionItem): void {
  const blockerId = `${item.severity}:${item.kind}:${item.id}`;
  if (card.blocker.items.some((b) => b.id === blockerId || (b.kind === item.kind && b.label === item.title))) {
    return;
  }
  card.blocker.items.push({
    id: blockerId,
    kind: item.kind,
    label: item.title,
    severity: item.severity,
    href: item.href,
  });
}

function finalizeCardBlockers(card: FrontDeskTodayCard): void {
  if (!card.blocker.items.length) {
    card.blocker = { highest: null, summary: null, items: [] };
    return;
  }
  const sorted = [...card.blocker.items].sort(compareBlockers);
  const top = sorted[0]!;
  card.blocker = {
    highest: top.severity,
    summary: top.label,
    items: sorted,
  };
}

function compareBlockers(a: FrontDeskCardBlocker, b: FrontDeskCardBlocker): number {
  const sr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (sr !== 0) return sr;
  const pa =
    EXTENDED_ALERT_PRIORITY[a.kind as keyof typeof EXTENDED_ALERT_PRIORITY] ?? 0;
  const pb =
    EXTENDED_ALERT_PRIORITY[b.kind as keyof typeof EXTENDED_ALERT_PRIORITY] ?? 0;
  if (pb !== pa) return pb - pa;
  const k = a.kind.localeCompare(b.kind);
  if (k !== 0) return k;
  return a.id.localeCompare(b.id);
}

function laneIdForState(state: ReceptionOperationalState): FrontDeskTodayLaneId {
  switch (state) {
    case "running_late":
      return "running_late";
    case "waiting":
      return "waiting";
    case "arriving_soon":
    case "expected":
      return "arriving_soon";
    case "in_consultation":
      return "in_consultation";
    case "in_treatment":
      return "in_treatment";
    case "complete":
      return "completed";
    default:
      return "arriving_soon";
  }
}

function deriveAllowedActions(
  state: ReceptionOperationalState,
  mode: FrontDeskMutationMode
): FrontDeskCardActionId[] {
  const nav: FrontDeskCardActionId[] = ["take_payment", "find_patient", "open_calendar"];
  // open_patient only when we might have a link — still advisory.
  nav.push("open_patient");

  if (mode === "none") return nav;

  const flow: FrontDeskCardActionId[] = [];
  if (state === "expected" || state === "arriving_soon" || state === "running_late") {
    flow.push("check_in", "no_show");
  }
  if (state === "waiting") {
    flow.push("start_consultation", "start_treatment", "complete", "no_show");
  }
  if (state === "in_consultation") {
    flow.push("start_treatment", "complete");
  }
  if (state === "in_treatment") {
    flow.push("complete");
  }
  if (!isReceptionOperationalTerminalState(state) && mode === "full") {
    flow.push("cancel");
  }
  // PIN: all flow except cancel (already gated by mode === full for cancel)
  if (mode === "pin_reception") {
    return [...flow.filter((a) => a !== "cancel"), ...nav];
  }
  return [...flow, ...nav];
}

function dedupeAttentionItems(items: FrontDeskAttentionItem[]): FrontDeskAttentionItem[] {
  const map = new Map<string, FrontDeskAttentionItem>();
  for (const item of items) {
    const key = `${item.bookingId ?? item.patientId ?? "panel"}|${item.kind}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    // Keep stronger severity / higher priority.
    if (compareAttention(item, existing) < 0) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function sortAttentionItems(items: FrontDeskAttentionItem[]): FrontDeskAttentionItem[] {
  return [...items].sort(compareAttention);
}

function compareAttention(a: FrontDeskAttentionItem, b: FrontDeskAttentionItem): number {
  const sr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (sr !== 0) return sr;
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  const k = a.kind.localeCompare(b.kind);
  if (k !== 0) return k;
  return a.id.localeCompare(b.id);
}

function computeSummary(
  cards: Map<string, FrontDeskTodayCard>,
  cancelledOrNoShow: number
): FrontDeskTodaySummary {
  const summary: FrontDeskTodaySummary = {
    total: cards.size,
    arrivingSoon: 0,
    expected: 0,
    runningLate: 0,
    waiting: 0,
    inConsultation: 0,
    inTreatment: 0,
    completed: 0,
    cancelledOrNoShow,
    paymentAttention: 0,
    blockers: 0,
  };
  for (const card of cards.values()) {
    switch (card.operationalState) {
      case "arriving_soon":
        summary.arrivingSoon += 1;
        break;
      case "expected":
        summary.expected += 1;
        break;
      case "running_late":
        summary.runningLate += 1;
        break;
      case "waiting":
        summary.waiting += 1;
        break;
      case "in_consultation":
        summary.inConsultation += 1;
        break;
      case "in_treatment":
        summary.inTreatment += 1;
        break;
      case "complete":
        summary.completed += 1;
        break;
      default:
        break;
    }
    if (card.payment.state === "due" || card.payment.state === "overdue") {
      summary.paymentAttention += 1;
    }
    if (card.blocker.highest === "blocker") {
      summary.blockers += 1;
    }
  }
  return summary;
}

function buildGlobalActions(base: string): FrontDeskTodayGlobalAction[] {
  return [
    { id: "take_payment", label: "Take payment", href: `${base}/payments` },
    { id: "find_patient", label: "Find patient", href: `${base}/patients` },
    { id: "new_booking", label: "New booking", href: `${base}/calendar` },
    { id: "open_calendar", label: "Open calendar", href: `${base}/calendar` },
  ];
}

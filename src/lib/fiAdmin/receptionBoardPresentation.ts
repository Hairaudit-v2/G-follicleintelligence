/**
 * Reception Board — front-desk presentation helpers (UI copy only; no loader changes).
 */

import type {
  ReceptionBoardCard,
  TenantActionCentre,
  TenantOperationalDashboard,
  TenantPaymentCommercialKpis,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export const receptionBoardLinkButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF] disabled:pointer-events-none disabled:opacity-40";

export type ReceptionSnapshotCard = {
  id: string;
  label: string;
  value: number | string;
  detail: string;
  href?: string;
};

export type ReceptionPriorityItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  severity: "critical" | "warning" | "info";
  priorityScore: number;
};

export type ReceptionFlowLaneId =
  | "arriving_soon"
  | "waiting"
  | "checked_in"
  | "in_consultation_treatment"
  | "ready_for_handoff"
  | "completed";

export type ReceptionFlowLane = {
  id: ReceptionFlowLaneId;
  label: string;
};

export type ReceptionFlowBoardItem = {
  card: ReceptionBoardCard;
  laneId: ReceptionFlowLaneId;
  missingItems: string[];
  nextAction: string;
  sortKey: string;
};

export type ReceptionReadinessBlocker = {
  id: string;
  label: string;
  count: number;
  href: string;
};

export type ReceptionHandoffSummary = {
  roomAssigned: number;
  roomMissing: number;
  readyForClinical: number;
  waitingForHandoff: number;
  completedReadyToLeave: number;
};

export type ReceptionAppointmentListItem = {
  id: string;
  patientName: string;
  timeLabel: string;
  serviceLabel: string;
  statusLabel: string;
  appointmentHref: string;
  sortKey: string;
};

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

function bookingStatusNorm(status: string): string {
  return String(status ?? "").trim().toLowerCase();
}

function isActiveColumn(col: ReceptionBoardCard["receptionColumn"]): boolean {
  return col === "arrived" || col === "in_consultation" || col === "in_treatment";
}

function isOverdueExpected(card: ReceptionBoardCard, nowMs: number): boolean {
  if (card.receptionColumn !== "expected") return false;
  const start = Date.parse(card.startAt);
  return Number.isFinite(start) && start <= nowMs;
}

function formatSlot(iso: string, tz: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz.trim() || undefined,
  }).format(d);
}

function missingItemsForCard(card: ReceptionBoardCard, nowMs: number): string[] {
  const items: string[] = [];
  const st = bookingStatusNorm(card.bookingStatus);

  if (st === "scheduled") items.push("Arrival not confirmed");
  if (!card.patientId && card.leadId) items.push("Patient profile missing");
  if (isActiveColumn(card.receptionColumn) && !card.roomLabel?.trim()) items.push("Room needed");
  if (card.receptionColumn === "expected" && isOverdueExpected(card, nowMs)) {
    items.push("Check in overdue");
  }
  if (card.bookingType.toLowerCase().includes("surgery") && !card.metadata?.case_id && !card.metadata?.fi_case_id) {
    items.push("Procedure preparation incomplete");
  }

  return items;
}

function nextActionForCard(card: ReceptionBoardCard, nowMs: number): string {
  switch (card.receptionColumn) {
    case "expected":
      return isOverdueExpected(card, nowMs)
        ? "Check the patient in now."
        : "Confirm arrival when the patient arrives.";
    case "arrived":
      return "Move to consultation or treatment.";
    case "in_consultation":
      return "Complete consultation and confirm handoff.";
    case "in_treatment":
      return "Monitor treatment and prepare checkout.";
    case "complete":
      return "Confirm discharge and any follow-up.";
    case "no_show":
      return "Record is closed — no show.";
    case "cancelled":
      return "Record is closed — cancelled.";
  }
}

export const RECEPTION_FLOW_LANES: readonly ReceptionFlowLane[] = [
  { id: "arriving_soon", label: "Arriving soon" },
  { id: "waiting", label: "Waiting" },
  { id: "checked_in", label: "Checked in" },
  { id: "in_consultation_treatment", label: "In consultation / treatment" },
  { id: "ready_for_handoff", label: "Ready for handoff" },
  { id: "completed", label: "Completed" },
] as const;

export function receptionFlowLaneForCard(card: ReceptionBoardCard, nowMs: number): ReceptionFlowLaneId | null {
  switch (card.receptionColumn) {
    case "expected":
      return isOverdueExpected(card, nowMs) ? "waiting" : "arriving_soon";
    case "arrived":
      return "checked_in";
    case "in_consultation":
      return "in_consultation_treatment";
    case "in_treatment":
      return "ready_for_handoff";
    case "complete":
      return "completed";
    case "no_show":
    case "cancelled":
      return null;
  }
}

export function buildReceptionSnapshotCards(
  base: string,
  cards: readonly ReceptionBoardCard[],
  paymentCommercialKpis: TenantPaymentCommercialKpis,
  nowMs = Date.now(),
): ReceptionSnapshotCard[] {
  const expected = cards.filter((c) => c.receptionColumn === "expected").length;
  const checkedIn = cards.filter(
    (c) => c.receptionColumn === "arrived" || c.receptionColumn === "in_consultation" || c.receptionColumn === "in_treatment",
  ).length;
  const waiting = cards.filter((c) => c.receptionColumn === "arrived").length;
  const inClinical = cards.filter(
    (c) => c.receptionColumn === "in_consultation" || c.receptionColumn === "in_treatment",
  ).length;
  const paymentsDue = paymentCommercialKpis.depositsDueCount + paymentCommercialKpis.overduePaymentsCount;
  const formsMissing = cards.filter((c) => missingItemsForCard(c, nowMs).some((m) => m.includes("preparation") || m.includes("profile"))).length;

  return [
    {
      id: "expected",
      label: "Expected arrivals",
      value: expected,
      detail: "Patients scheduled for today who have not checked in yet",
    },
    {
      id: "checked_in",
      label: "Checked in",
      value: checkedIn,
      detail: "Patients on-site across waiting and clinical stages",
    },
    {
      id: "waiting",
      label: "Waiting",
      value: waiting,
      detail: "Checked in and waiting for the clinical team",
    },
    {
      id: "in_clinical",
      label: "In consultation / treatment",
      value: inClinical,
      detail: "Patients currently with the clinical team",
    },
    {
      id: "payments",
      label: "Payments due",
      value: paymentsDue,
      detail: "Deposits or balances outstanding before treatment",
      href: `${base}/financial/dashboard`,
    },
    {
      id: "forms",
      label: "Forms or consents missing",
      value: formsMissing,
      detail: "Patients with intake, profile, or preparation gaps reception can chase",
    },
  ];
}

type PriorityCandidate = {
  id: string;
  count: number;
  priorityScore: number;
  severity: ReceptionPriorityItem["severity"];
  headline: (n: number) => string;
  detail?: string;
  href?: string;
};

export function buildReceptionPriorities(
  base: string,
  cards: readonly ReceptionBoardCard[],
  paymentCommercialKpis: TenantPaymentCommercialKpis,
  actionCentre: TenantActionCentre,
  maxItems = 5,
  nowMs = Date.now(),
): ReceptionPriorityItem[] {
  const overdueCheckIn = cards.filter((c) => c.receptionColumn === "expected" && isOverdueExpected(c, nowMs)).length;
  const waitingToCheckIn = cards.filter(
    (c) => c.receptionColumn === "expected" && !isOverdueExpected(c, nowMs),
  ).length;
  const formsBlockers = cards.filter((c) =>
    missingItemsForCard(c, nowMs).some((m) => m.includes("preparation") || m.includes("profile") || m.includes("confirmed")),
  ).length;
  const roomNeeded = cards.filter((c) => isActiveColumn(c.receptionColumn) && !c.roomLabel?.trim()).length;
  const handoffRequired = cards.filter((c) => c.receptionColumn === "in_consultation").length;
  const paymentsBeforeTreatment =
    paymentCommercialKpis.depositsDueCount +
    paymentCommercialKpis.overduePaymentsCount +
    actionCentre.surgeryFinancialPaymentAttention;

  const candidates: PriorityCandidate[] = [
    {
      id: "check_in_overdue",
      count: overdueCheckIn,
      priorityScore: 98,
      severity: "critical",
      headline: (n) => plural(n, "patient", "patients") + " are waiting to be checked in",
      detail: "Appointment time has passed — check them in on the flow board.",
      href: `${base}/reception`,
    },
    {
      id: "payment_before_procedure",
      count: paymentsBeforeTreatment,
      priorityScore: 95,
      severity: "critical",
      headline: (n) => plural(n, "payment", "payments") + " due before today's procedures",
      detail: "Confirm deposits or balances before starting treatment.",
      href: `${base}/financial/dashboard`,
    },
    {
      id: "forms_missing",
      count: formsBlockers,
      priorityScore: 88,
      severity: "warning",
      headline: (n) => plural(n, "patient", "patients") + " have missing forms or details before treatment",
      detail: "Complete intake, consents, or patient profile links before clinical handoff.",
    },
    {
      id: "room_assignment",
      count: roomNeeded,
      priorityScore: 82,
      severity: "warning",
      headline: (n) => plural(n, "room assignment", "room assignments") + " needed for on-site patients",
      detail: "Assign rooms before moving patients to consultation or treatment.",
      href: `${base}/calendar`,
    },
    {
      id: "handoff_required",
      count: handoffRequired,
      priorityScore: 75,
      severity: "info",
      headline: (n) => plural(n, "patient handoff", "patient handoffs") + " required after consultation",
      detail: "Move patients to treatment or mark complete when consultation finishes.",
    },
    {
      id: "expected_arriving",
      count: waitingToCheckIn,
      priorityScore: 60,
      severity: "info",
      headline: (n) => plural(n, "arrival", "arrivals") + " expected shortly",
      detail: "Prepare reception for upcoming check-ins.",
    },
  ];

  return candidates
    .filter((c) => c.count > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore || b.count - a.count)
    .slice(0, maxItems)
    .map((c) => ({
      id: c.id,
      headline: c.headline(c.count),
      detail: c.detail,
      href: c.href,
      severity: c.severity,
      priorityScore: c.priorityScore,
    }));
}

export function hasUrgentReceptionPriorities(items: readonly ReceptionPriorityItem[]): boolean {
  return items.some((i) => i.severity === "critical" || i.severity === "warning");
}

export function receptionAttentionSeverityClass(severity: ReceptionPriorityItem["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-rose-500/25 bg-rose-500/[0.06]";
    case "warning":
      return "border-amber-500/20 bg-amber-500/[0.04]";
    default:
      return "border-white/[0.08] bg-[#0c1220]/60";
  }
}

export function buildReceptionFlowBoardItems(
  cards: readonly ReceptionBoardCard[],
  nowMs = Date.now(),
): Record<ReceptionFlowLaneId, ReceptionFlowBoardItem[]> {
  const lanes: Record<ReceptionFlowLaneId, ReceptionFlowBoardItem[]> = {
    arriving_soon: [],
    waiting: [],
    checked_in: [],
    in_consultation_treatment: [],
    ready_for_handoff: [],
    completed: [],
  };

  for (const card of cards) {
    const laneId = receptionFlowLaneForCard(card, nowMs);
    if (!laneId) continue;
    lanes[laneId].push({
      card,
      laneId,
      missingItems: missingItemsForCard(card, nowMs),
      nextAction: nextActionForCard(card, nowMs),
      sortKey: card.startAt,
    });
  }

  for (const laneId of Object.keys(lanes) as ReceptionFlowLaneId[]) {
    lanes[laneId] = lanes[laneId].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  return lanes;
}

export function buildReceptionReadinessBlockers(
  base: string,
  cards: readonly ReceptionBoardCard[],
  paymentCommercialKpis: TenantPaymentCommercialKpis,
  nowMs = Date.now(),
): ReceptionReadinessBlocker[] {
  const intakeIncomplete = cards.filter((c) =>
    missingItemsForCard(c, nowMs).some((m) => m.includes("profile") || m.includes("preparation")),
  ).length;
  const arrivalUnconfirmed = cards.filter((c) => bookingStatusNorm(c.bookingStatus) === "scheduled").length;
  const contactMissing = cards.filter((c) => !c.patientId && c.leadId).length;
  const paymentsDue = paymentCommercialKpis.depositsDueCount + paymentCommercialKpis.overduePaymentsCount;

  const items: ReceptionReadinessBlocker[] = [
    {
      id: "intake",
      label: "Incomplete intake or preparation",
      count: intakeIncomplete,
      href: `${base}/calendar`,
    },
    {
      id: "consents",
      label: "Unsigned consents or forms",
      count: intakeIncomplete,
      href: `${base}/consultations`,
    },
    {
      id: "payment",
      label: "Deposit or payment due",
      count: paymentsDue,
      href: `${base}/financial/dashboard`,
    },
    {
      id: "contact",
      label: "Missing contact or patient profile",
      count: contactMissing,
      href: `${base}/crm`,
    },
    {
      id: "arrival",
      label: "Missing arrival confirmation",
      count: arrivalUnconfirmed,
      href: `${base}/calendar`,
    },
  ];

  return items.filter((i) => i.count > 0).slice(0, 5);
}

export function buildReceptionHandoffSummary(cards: readonly ReceptionBoardCard[]): ReceptionHandoffSummary {
  const active = cards.filter((c) => isActiveColumn(c.receptionColumn) || c.receptionColumn === "expected");
  const roomAssigned = active.filter((c) => c.roomLabel?.trim()).length;
  const roomMissing = active.filter((c) => !c.roomLabel?.trim() && isActiveColumn(c.receptionColumn)).length;
  const readyForClinical = cards.filter((c) => c.receptionColumn === "arrived").length;
  const waitingForHandoff = cards.filter((c) => c.receptionColumn === "in_consultation").length;
  const completedReadyToLeave = cards.filter((c) => c.receptionColumn === "complete").length;

  return {
    roomAssigned,
    roomMissing,
    readyForClinical,
    waitingForHandoff,
    completedReadyToLeave,
  };
}

export function buildReceptionAppointmentList(
  base: string,
  cards: readonly ReceptionBoardCard[],
  tz: string,
  maxItems = 12,
): ReceptionAppointmentListItem[] {
  return cards
    .filter((c) => c.receptionColumn !== "cancelled" && c.receptionColumn !== "no_show")
    .map((c) => ({
      id: c.id,
      patientName: c.displayName,
      timeLabel: formatSlot(c.startAt, c.timezone ?? tz),
      serviceLabel: c.typeLabel,
      statusLabel: c.statusLabel,
      appointmentHref: `${base}/appointments/${encodeURIComponent(c.id)}`,
      sortKey: c.startAt,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(0, maxItems);
}

export function receptionFlowBoardHasPatients(lanes: Record<ReceptionFlowLaneId, ReceptionFlowBoardItem[]>): boolean {
  return RECEPTION_FLOW_LANES.some((lane) => lanes[lane.id].length > 0);
}

/** Column counts for diagnostics — raw booking reception columns. */
export function receptionColumnCounts(cards: readonly ReceptionBoardCard[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    counts[c.receptionColumn] = (counts[c.receptionColumn] ?? 0) + 1;
  }
  return counts;
}

export type ReceptionBoardPresentationInput = Pick<
  TenantOperationalDashboard,
  "receptionBoard" | "paymentCommercialKpis" | "actionCentre" | "operationalDay" | "tenantId" | "tenantName"
>;

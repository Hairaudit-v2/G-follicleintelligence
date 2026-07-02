/**
 * Operations Centre — clinic-facing presentation helpers (UI copy only; no loader changes).
 */

import { countAgendaBookingsOnOperationalDayByBucket } from "@/src/components/fi-admin/operations/operationsAgendaDayStats";
import { resolveProcedureDayNavHref } from "@/src/lib/procedureDay/procedureDayNavCore";
import type { AgendaBucket } from "@/src/lib/fiOs/tenantOperationalDashboardHelpers";
import type {
  DashboardBookingItem,
  ReceptionBoardCard,
  TenantActionCentre,
  TenantOperationalDashboard,
  TenantOperationalDay,
  TenantPaymentCommercialKpis,
  TenantQuickStats,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export const operationsCentreLinkButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF] disabled:pointer-events-none disabled:opacity-40";

const BUCKETS: AgendaBucket[] = ["consult", "surgery", "follow_up", "other"];

const BUCKET_SERVICE_LABEL: Record<AgendaBucket, string> = {
  consult: "Consultation",
  surgery: "Procedure",
  follow_up: "Follow-up",
  other: "Visit",
};

export type LiveClinicFlowCard = {
  id: string;
  label: string;
  value: number | string;
  detail: string;
  href: string;
};

export type CoordinationPriorityItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  severity: "critical" | "warning" | "info";
  priorityScore: number;
};

export type MovementLaneId =
  | "expected"
  | "arrived"
  | "in_consultation"
  | "in_procedure"
  | "completed";

export type MovementLane = {
  id: MovementLaneId;
  label: string;
};

export type MovementBoardItem = {
  id: string;
  patientName: string;
  timeLabel: string;
  serviceLabel: string;
  stateLabel: string;
  nextAction: string;
  sortKey: string;
  laneId: MovementLaneId;
  patientHref: string | null;
  bookingHref: string;
  receptionHref: string;
};

export type RoomOverviewSummary = {
  roomsActive: number;
  roomsAvailable: number | null;
  procedureRoomsInUse: number;
  treatmentRoomsInUse: number;
  hasRoomAssignments: boolean;
  conflictCount: number;
};

export type StaffCoordinationSummary = {
  staffScheduledToday: number;
  coverageWarning: string | null;
  unavailableNote: string | null;
  procedureTeamBlockers: number;
  hasData: boolean;
};

export type FinancialBlockerItem = {
  id: string;
  label: string;
  count: number;
  href: string;
};

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

function isInOperationalDay(iso: string, localStartIso: string, localEndIso: string): boolean {
  const t = Date.parse(iso);
  const a = Date.parse(localStartIso);
  const b = Date.parse(localEndIso);
  if (![t, a, b].every(Number.isFinite)) return iso >= localStartIso && iso < localEndIso;
  return t >= a && t < b;
}

function formatSlot(iso: string, tz: string | null): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz?.trim() || undefined,
  }).format(d);
}

function todayAgendaRows(
  agendaByBucket: Record<AgendaBucket, DashboardBookingItem[]>,
  operationalDay: TenantOperationalDay
): Array<{ row: DashboardBookingItem; bucket: AgendaBucket }> {
  const { localStartIso, localEndIso } = operationalDay;
  const rows: Array<{ row: DashboardBookingItem; bucket: AgendaBucket }> = [];
  for (const bucket of BUCKETS) {
    for (const row of agendaByBucket[bucket]) {
      if (isInOperationalDay(row.start_at, localStartIso, localEndIso)) {
        rows.push({ row, bucket });
      }
    }
  }
  return rows.sort((a, b) => a.row.start_at.localeCompare(b.row.start_at));
}

function bookingStatusNorm(status: string): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function movementLaneForRow(
  row: DashboardBookingItem,
  bucket: AgendaBucket
): MovementLaneId | null {
  const st = bookingStatusNorm(row.booking_status);
  if (st === "cancelled" || st === "no_show") return null;
  if (st === "completed") return "completed";
  if (st === "scheduled" || st === "confirmed") return "expected";
  if (st === "arrived") {
    if (bucket === "surgery") return "in_procedure";
    if (bucket === "consult" || bucket === "follow_up") return "in_consultation";
    return "arrived";
  }
  return "expected";
}

function stateLabelForLane(laneId: MovementLaneId): string {
  switch (laneId) {
    case "expected":
      return "Expected";
    case "arrived":
      return "Arrived · waiting";
    case "in_consultation":
      return "In consultation";
    case "in_procedure":
      return "In procedure";
    case "completed":
      return "Completed";
  }
}

function nextActionForLane(laneId: MovementLaneId): string {
  switch (laneId) {
    case "expected":
      return "Confirm arrival when the patient checks in.";
    case "arrived":
      return "Move to consultation or treatment on the reception board.";
    case "in_consultation":
      return "Complete consultation and confirm next step.";
    case "in_procedure":
      return "Monitor procedure progress and room turnover.";
    case "completed":
      return "Confirm discharge and any follow-up booking.";
  }
}

function resolvePatientHref(base: string, row: DashboardBookingItem): string | null {
  if (row.patient_id?.trim()) return `${base}/patients/${row.patient_id.trim()}`;
  if (row.lead_id?.trim() && row.patient_id == null)
    return `${base}/crm/leads/${row.lead_id.trim()}`;
  return null;
}

function resolveBookingHref(base: string, row: DashboardBookingItem): string {
  if (row.case_id?.trim()) return `${base}/cases/${row.case_id.trim()}`;
  return `${base}/calendar`;
}

export const MOVEMENT_LANES: readonly MovementLane[] = [
  { id: "expected", label: "Expected" },
  { id: "arrived", label: "Arrived" },
  { id: "in_consultation", label: "In consultation" },
  { id: "in_procedure", label: "In treatment / procedure" },
  { id: "completed", label: "Completed" },
] as const;

export function buildLiveClinicFlowCards(
  base: string,
  data: Pick<
    TenantOperationalDashboard,
    "agendaByBucket" | "operationalDay" | "clinicToday" | "paymentCommercialKpis" | "receptionBoard"
  >,
  opts?: { showProcedureDayNav?: boolean }
): LiveClinicFlowCard[] {
  const procedureDayHref = resolveProcedureDayNavHref(base, opts?.showProcedureDayNav === true);
  const { agendaByBucket, operationalDay, clinicToday, paymentCommercialKpis, receptionBoard } =
    data;
  const todayRows = todayAgendaRows(agendaByBucket, operationalDay);
  const tz = operationalDay.calendarTimezone;

  const expected = todayRows.filter(({ row }) => {
    const st = bookingStatusNorm(row.booking_status);
    return st === "scheduled" || st === "confirmed";
  }).length;

  const arrived = todayRows.filter(
    ({ row }) => bookingStatusNorm(row.booking_status) === "arrived"
  ).length;

  const consultationsInProgress = todayRows.filter(
    ({ row, bucket }) =>
      bookingStatusNorm(row.booking_status) === "arrived" &&
      (bucket === "consult" || bucket === "follow_up")
  ).length;

  const proceduresActive = todayRows.filter(
    ({ row, bucket }) => bookingStatusNorm(row.booking_status) === "arrived" && bucket === "surgery"
  ).length;

  const roomsInUse = receptionBoard.cards.filter((c) => c.roomLabel?.trim()).length;

  const paymentsNeedingAttention =
    paymentCommercialKpis.depositsDueCount + paymentCommercialKpis.overduePaymentsCount;

  const cards: LiveClinicFlowCard[] = [
    {
      id: "expected",
      label: "Patients expected today",
      value: expected,
      detail: "Appointments scheduled or confirmed for today",
      href: `${base}/calendar`,
    },
    {
      id: "arrived",
      label: "Patients arrived",
      value: arrived,
      detail: "Checked in and on-site today",
      href: `${base}/reception`,
    },
    {
      id: "consultations",
      label: "Consultations in progress",
      value: consultationsInProgress || clinicToday.consultations,
      detail: "Consultation visits active on today's schedule",
      href: `${base}/calendar`,
    },
    {
      id: "procedures",
      label: "Procedures active",
      value: proceduresActive || clinicToday.surgeries,
      detail: "Procedure visits underway today",
      href: procedureDayHref,
    },
    {
      id: "rooms",
      label: "Rooms in use",
      value: roomsInUse,
      detail:
        roomsInUse > 0
          ? "Bookings with a room assigned today"
          : "Assign rooms on the calendar as visits are confirmed",
      href: `${base}/reception`,
    },
    {
      id: "payments",
      label: "Payments needing attention",
      value: paymentsNeedingAttention,
      detail: "Deposits due or overdue before treatment",
      href: `${base}/financial/dashboard`,
    },
  ];

  void tz;
  return cards.slice(0, 6);
}

type CoordinationCandidate = {
  id: string;
  count: number;
  priorityScore: number;
  severity: CoordinationPriorityItem["severity"];
  headline: (n: number) => string;
  detail?: string;
  href?: string;
};

export function buildCoordinationPriorities(
  base: string,
  data: Pick<
    TenantOperationalDashboard,
    | "agendaByBucket"
    | "operationalDay"
    | "actionCentre"
    | "paymentCommercialKpis"
    | "quickStats"
    | "clinicToday"
  >,
  showCrmNav: boolean,
  maxItems = 5
): CoordinationPriorityItem[] {
  const todayRows = todayAgendaRows(data.agendaByBucket, data.operationalDay);
  const patientsWaiting = todayRows.filter(
    ({ row, bucket }) => movementLaneForRow(row, bucket) === "arrived"
  ).length;
  const needConfirmation = todayRows.filter(
    ({ row }) => bookingStatusNorm(row.booking_status) === "scheduled"
  ).length;
  const todaySurgeriesBlocked = todayRows.filter(
    ({ row, bucket }) => bucket === "surgery" && !row.case_id?.trim()
  ).length;
  const paymentsBeforeTreatment =
    data.paymentCommercialKpis.depositsDueCount + data.paymentCommercialKpis.overduePaymentsCount;
  const staffScheduled = data.quickStats.staffOnDutyToday;
  const visitsToday = todayRows.length;
  const coverageGap = visitsToday > 0 && staffScheduled === 0;

  const { actionCentre } = data;
  const crmHref = showCrmNav ? `${base}/crm` : `${base}/calendar`;

  const candidates: CoordinationCandidate[] = [
    {
      id: "payment_before_procedure",
      count: paymentsBeforeTreatment,
      priorityScore: 100,
      severity: "critical",
      headline: (n) => plural(n, "payment", "payments") + " still outstanding before treatment",
      detail: "Confirm deposits or balances before starting today's procedures.",
      href: `${base}/financial/dashboard`,
    },
    {
      id: "procedure_blocked",
      count: todaySurgeriesBlocked,
      priorityScore: 95,
      severity: "critical",
      headline: (n) =>
        plural(n, "procedure", "procedures") + " blocked by preparation requirements",
      detail: "Link cases and complete preparation before procedure day.",
      href: `${base}/surgery-readiness`,
    },
    {
      id: "patients_waiting",
      count: patientsWaiting,
      priorityScore: 88,
      severity: "warning",
      headline: (n) => plural(n, "patient", "patients") + " have arrived and are waiting",
      detail: "Move patients forward on the reception board.",
      href: `${base}/reception`,
    },
    {
      id: "appointments_confirmation",
      count: needConfirmation,
      priorityScore: 75,
      severity: "warning",
      headline: (n) => plural(n, "appointment", "appointments") + " need confirmation",
      detail: "Confirm scheduled visits before patients arrive.",
      href: `${base}/calendar`,
    },
    {
      id: "staff_coverage",
      count: coverageGap ? 1 : 0,
      priorityScore: 70,
      severity: "warning",
      headline: () => "Staff coverage issue detected for today",
      detail: "No clinical staff are assigned on today's schedule.",
      href: `${base}/reception`,
    },
    {
      id: "consultations_completion",
      count: actionCentre.consultationsAwaitingCompletion,
      priorityScore: 60,
      severity: "info",
      headline: (n) => plural(n, "consultation", "consultations") + " require completion today",
      detail: "Draft or in-progress consultation workspaces need closing.",
      href: `${base}/consultations`,
    },
    {
      id: "enquiries",
      count: actionCentre.leadsAwaitingContact,
      priorityScore: 50,
      severity: "info",
      headline: (n) => plural(n, "enquiry", "enquiries") + " awaiting contact",
      detail: "New enquiries not yet worked by the team.",
      href: crmHref,
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

export function hasUrgentCoordination(items: readonly CoordinationPriorityItem[]): boolean {
  return items.some((i) => i.severity === "critical" || i.severity === "warning");
}

export function attentionSeverityClass(severity: CoordinationPriorityItem["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-rose-500/25 bg-rose-500/[0.06]";
    case "warning":
      return "border-amber-500/20 bg-amber-500/[0.04]";
    default:
      return "border-white/[0.08] bg-[#0c1220]/60";
  }
}

export function buildMovementBoardItems(
  base: string,
  data: Pick<TenantOperationalDashboard, "agendaByBucket" | "operationalDay">,
  maxPerLane = 4
): Record<MovementLaneId, MovementBoardItem[]> {
  const { operationalDay } = data;
  const tz = operationalDay.calendarTimezone;
  const receptionHref = `${base}/reception`;
  const lanes: Record<MovementLaneId, MovementBoardItem[]> = {
    expected: [],
    arrived: [],
    in_consultation: [],
    in_procedure: [],
    completed: [],
  };

  for (const { row, bucket } of todayAgendaRows(data.agendaByBucket, operationalDay)) {
    const laneId = movementLaneForRow(row, bucket);
    if (!laneId) continue;
    const item: MovementBoardItem = {
      id: row.id,
      patientName: row.title?.trim() || "Scheduled visit",
      timeLabel: formatSlot(row.start_at, row.timezone ?? tz),
      serviceLabel: BUCKET_SERVICE_LABEL[bucket],
      stateLabel: stateLabelForLane(laneId),
      nextAction: nextActionForLane(laneId),
      sortKey: row.start_at,
      laneId,
      patientHref: resolvePatientHref(base, row),
      bookingHref: resolveBookingHref(base, row),
      receptionHref,
    };
    lanes[laneId].push(item);
  }

  for (const laneId of Object.keys(lanes) as MovementLaneId[]) {
    lanes[laneId] = lanes[laneId]
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(0, maxPerLane);
  }

  return lanes;
}

export function buildRoomOverview(
  receptionCards: readonly ReceptionBoardCard[]
): RoomOverviewSummary {
  const withRoom = receptionCards.filter((c) => c.roomLabel?.trim());
  const procedureRooms = withRoom.filter((c) =>
    c.bookingType.toLowerCase().includes("surgery")
  ).length;
  const treatmentRooms = withRoom.filter(
    (c) => !c.bookingType.toLowerCase().includes("surgery")
  ).length;
  const roomLabels = new Set(withRoom.map((c) => c.roomLabel!.trim()));

  return {
    roomsActive: roomLabels.size,
    roomsAvailable: null,
    procedureRoomsInUse: procedureRooms,
    treatmentRoomsInUse: treatmentRooms,
    hasRoomAssignments: withRoom.length > 0,
    conflictCount: 0,
  };
}

export function buildStaffCoordinationSummary(
  quickStats: TenantQuickStats,
  actionCentre: TenantActionCentre,
  visitsToday: number
): StaffCoordinationSummary {
  const staffScheduled = quickStats.staffOnDutyToday;
  const coverageWarning =
    visitsToday > 0 && staffScheduled === 0
      ? "No clinical staff are assigned on today's schedule."
      : staffScheduled > 0 && visitsToday > staffScheduled * 8
        ? "Today's visit volume may exceed typical staff capacity."
        : null;

  return {
    staffScheduledToday: staffScheduled,
    coverageWarning,
    unavailableNote: null,
    procedureTeamBlockers: actionCentre.surgeryReadinessAlerts,
    hasData: staffScheduled > 0 || visitsToday > 0 || actionCentre.surgeryReadinessAlerts > 0,
  };
}

export function buildFinancialBlockers(
  base: string,
  paymentCommercialKpis: TenantPaymentCommercialKpis,
  actionCentre: TenantActionCentre
): FinancialBlockerItem[] {
  const items: FinancialBlockerItem[] = [
    {
      id: "deposits_due",
      label: "Payments due before treatment",
      count: paymentCommercialKpis.depositsDueCount,
      href: `${base}/financial/invoices`,
    },
    {
      id: "overdue",
      label: "Overdue payments",
      count: paymentCommercialKpis.overduePaymentsCount,
      href: `${base}/financial/invoices`,
    },
    {
      id: "clearance",
      label: "Financial clearance alerts",
      count: actionCentre.financialClearanceAttention,
      href: `${base}/financial/dashboard`,
    },
    {
      id: "surgery_payment",
      label: "Surgery payment follow-up",
      count: actionCentre.surgeryFinancialPaymentAttention,
      href: `${base}/financial/invoices`,
    },
  ];

  return items.filter((i) => i.count > 0).slice(0, 4);
}

/** Agenda bucket counts for diagnostics panels. */
export function agendaBucketCountsForOperationalDay(
  data: Pick<TenantOperationalDashboard, "agendaByBucket" | "operationalDay">
): Record<AgendaBucket, number> {
  const { todayYmd, calendarTimezone } = data.operationalDay;
  return countAgendaBookingsOnOperationalDayByBucket(
    data.agendaByBucket,
    todayYmd,
    calendarTimezone
  );
}

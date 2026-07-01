import { parseAppointmentProcedureMetadata } from "@/src/lib/bookings/appointmentMetadata";
import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { PATIENT_JOURNEY_STATE_LABELS } from "@/src/lib/patientJourney/patientJourneyStateCore";

import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import { localClockMinutesFromInstant, parseIsoUtcMs } from "@/src/lib/calendar/calendarTimezone";
import type {
  CalendarAppointmentRiskStatus,
  CalendarBookingIntelligence,
  CalendarBookingIntelligenceInput,
  CalendarConflictKind,
  CalendarConflictViolation,
  CalendarOperationalBlocker,
  CalendarOperationalBlockerKind,
  CalendarOperationalFeedItem,
} from "./calendarIntelligenceTypes";

export function isSurgeryBookingType(bookingType: string): boolean {
  return bookingType.trim().toLowerCase() === "surgery";
}

export function buildCalendarBlockerFixHref(
  tenantId: string,
  kind: CalendarOperationalBlockerKind,
  ctx: { bookingId: string; patientId?: string | null; caseId?: string | null }
): string | null {
  const base = `/fi-admin/${tenantId.trim()}`;
  const bid = ctx.bookingId.trim();
  const pid = ctx.patientId?.trim();
  const cid = ctx.caseId?.trim();
  switch (kind) {
    case "missing_staff":
    case "surgery_without_staff":
      return `${base}/calendar?booking=${bid}`;
    case "missing_room":
      return `${base}/calendar?booking=${bid}`;
    case "unpaid_deposit":
      return pid ? `${base}/patients/${pid}?tab=payments` : `${base}/appointments/${bid}`;
    case "missing_consent":
      return pid ? `${base}/patients/${pid}?tab=consent` : `${base}/appointments/${bid}`;
    case "incomplete_pre_op":
      return cid ? `${base}/cases/${cid}` : pid ? `${base}/patients/${pid}` : `${base}/appointments/${bid}`;
    case "room_conflict":
    case "surgeon_conflict":
    case "staff_conflict":
    case "patient_conflict":
      return `${base}/calendar?booking=${bid}`;
    case "outside_clinic_hours":
      return `${base}/settings/calendar`;
    default:
      return `${base}/appointments/${bid}`;
  }
}

function overlapsWithBuffer(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  bufferMs: number
): boolean {
  return aStart < bEnd + bufferMs && aEnd + bufferMs > bStart;
}

export function detectCalendarOverlapConflicts(
  candidate: Pick<
    FiBookingRow,
    | "id"
    | "start_at"
    | "end_at"
    | "assigned_staff_id"
    | "assigned_user_id"
    | "patient_id"
    | "room_id"
    | "booking_type"
    | "booking_status"
  >,
  others: FiBookingRow[],
  opts?: {
    ignoreBookingId?: string;
    bufferMinutes?: number;
    staffIdToUserId?: Map<string, string | null>;
  }
): CalendarConflictViolation[] {
  const ignore = opts?.ignoreBookingId?.trim();
  const bufferMs = Math.max(0, (opts?.bufferMinutes ?? 10) * 60_000);
  const staffMap = opts?.staffIdToUserId ?? new Map<string, string | null>();
  const s = Date.parse(candidate.start_at);
  const e = Date.parse(candidate.end_at);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return [];

  const candStaff = candidate.assigned_staff_id?.trim() || null;
  const candUser =
    candidate.assigned_user_id?.trim() ||
    (candStaff ? staffMap.get(candStaff)?.trim() || null : null);
  const candRoom = candidate.room_id?.trim() || null;
  const candPatient = candidate.patient_id?.trim() || null;

  const violations: CalendarConflictViolation[] = [];

  for (const o of others) {
    if (ignore && o.id === ignore) continue;
    if (isBookingCancelled(o)) continue;
    const os = Date.parse(o.start_at);
    const oe = Date.parse(o.end_at);
    if (!Number.isFinite(os) || !Number.isFinite(oe)) continue;
    if (!overlapsWithBuffer(s, e, os, oe, bufferMs)) continue;

    const oStaff = o.assigned_staff_id?.trim() || null;
    const oUser = o.assigned_user_id?.trim() || (oStaff ? staffMap.get(oStaff)?.trim() || null : null);
    const oRoom = o.room_id?.trim() || null;
    const oPatient = o.patient_id?.trim() || null;

    if (candRoom && oRoom && candRoom === oRoom) {
      violations.push({
        kind: "room_overlap",
        severity: "error",
        message: "Room double-booked for this time window.",
        conflictingBookingId: o.id,
      });
    }
    if (candStaff && oStaff && candStaff === oStaff) {
      violations.push({
        kind: "surgeon_overlap",
        severity: "error",
        message: "Surgeon/staff double-booked for this time window.",
        conflictingBookingId: o.id,
      });
    } else if (candUser && oUser && candUser === oUser) {
      violations.push({
        kind: "staff_overlap",
        severity: "error",
        message: "Staff member double-booked for this time window.",
        conflictingBookingId: o.id,
      });
    }
    if (candPatient && oPatient && candPatient === oPatient) {
      violations.push({
        kind: "patient_overlap",
        severity: "warning",
        message: "Patient has another appointment overlapping this slot.",
        conflictingBookingId: o.id,
      });
    }
  }

  const deduped = new Map<string, CalendarConflictViolation>();
  for (const v of violations) {
    deduped.set(`${v.kind}:${v.conflictingBookingId ?? ""}`, v);
  }
  return Array.from(deduped.values());
}

export function isOutsideClinicBusinessHours(
  startAt: string,
  endAt: string,
  grid: BusinessGridConfig
): boolean {
  const sm = parseIsoUtcMs(startAt);
  const em = parseIsoUtcMs(endAt);
  if (sm == null || em == null || em <= sm) return true;
  const tz = grid.timeZone;
  const startMin = localClockMinutesFromInstant(sm, tz);
  const endMin = localClockMinutesFromInstant(em - 1, tz);
  if (startMin == null || endMin == null) return true;
  const open = grid.dayStartHourUtc * 60;
  const close = grid.dayEndHourUtc * 60;
  return startMin < open || endMin >= close;
}

export function detectCalendarOperationalBlockers(
  input: CalendarBookingIntelligenceInput,
  conflicts: CalendarConflictViolation[] = []
): CalendarOperationalBlocker[] {
  const blockers: CalendarOperationalBlocker[] = [];
  const tid = input.tenantId.trim();
  const hrefCtx = {
    bookingId: input.bookingId,
    patientId: input.patientId,
    caseId: input.caseId,
  };
  const isSurgery = isSurgeryBookingType(input.bookingType);

  if (isBookingCancelled({ booking_status: input.bookingStatus, cancelled_at: null })) {
    return blockers;
  }

  if (!input.assignedStaffId?.trim() && !input.assignedUserId?.trim()) {
    blockers.push({
      kind: "missing_staff",
      label: "No clinician assigned",
      severity: isSurgery ? "critical" : "warning",
      href: buildCalendarBlockerFixHref(tid, "missing_staff", hrefCtx),
    });
  }

  if (input.roomRequired && !input.roomId?.trim()) {
    blockers.push({
      kind: "missing_room",
      label: "No room assigned",
      severity: isSurgery ? "critical" : "warning",
      href: buildCalendarBlockerFixHref(tid, "missing_room", hrefCtx),
    });
  }

  if (isSurgery) {
    if (!input.assignedStaffId?.trim() && !input.assignedUserId?.trim()) {
      blockers.push({
        kind: "surgery_without_staff",
        label: "Surgery booked without required staff",
        severity: "critical",
        href: buildCalendarBlockerFixHref(tid, "surgery_without_staff", hrefCtx),
      });
    }
    if (input.consentSigned === false) {
      blockers.push({
        kind: "missing_consent",
        label: "Consent not documented",
        severity: "critical",
        href: buildCalendarBlockerFixHref(tid, "missing_consent", hrefCtx),
      });
    }
    if (input.depositSatisfied === false) {
      blockers.push({
        kind: "unpaid_deposit",
        label: "Deposit not satisfied",
        severity: "critical",
        href: buildCalendarBlockerFixHref(tid, "unpaid_deposit", hrefCtx),
      });
    }
    if (input.preOpChecklistComplete === false) {
      blockers.push({
        kind: "incomplete_pre_op",
        label: "Pre-op checklist incomplete",
        severity: "warning",
        href: buildCalendarBlockerFixHref(tid, "incomplete_pre_op", hrefCtx),
      });
    }
  }

  for (const c of conflicts) {
    const kindMap: Record<CalendarConflictKind, CalendarOperationalBlockerKind | null> = {
      room_overlap: "room_conflict",
      surgeon_overlap: "surgeon_conflict",
      staff_overlap: "staff_conflict",
      patient_overlap: "patient_conflict",
      outside_clinic_hours: "outside_clinic_hours",
      surgery_without_required_staff: "surgery_without_staff",
    };
    const kind = kindMap[c.kind];
    if (!kind) continue;
    blockers.push({
      kind,
      label: c.message,
      severity: c.severity === "error" ? "critical" : "warning",
      href: buildCalendarBlockerFixHref(tid, kind, hrefCtx),
    });
  }

  const seen = new Set<string>();
  return blockers.filter((b) => {
    if (seen.has(b.kind)) return false;
    seen.add(b.kind);
    return true;
  });
}

export function calculateBookingReadinessPercent(input: {
  blockers: CalendarOperationalBlocker[];
  isSurgery: boolean;
  preOpChecklistComplete?: boolean;
  consentSigned?: boolean;
  depositSatisfied?: boolean;
  hasStaff: boolean;
  hasRoom: boolean;
  explicitPercent?: number | null;
}): number | null {
  if (input.explicitPercent != null && Number.isFinite(input.explicitPercent)) {
    return Math.max(0, Math.min(100, Math.round(input.explicitPercent)));
  }
  if (!input.isSurgery) return null;

  const checks = [
    input.hasStaff,
    input.hasRoom,
    input.consentSigned !== false,
    input.depositSatisfied !== false,
    input.preOpChecklistComplete !== false,
  ];
  const ok = checks.filter(Boolean).length;
  const penalty = input.blockers.filter((b) => b.severity === "critical").length * 10;
  return Math.max(0, Math.min(100, Math.round((ok / checks.length) * 100 - penalty)));
}

export function deriveAppointmentRiskStatus(input: {
  blockers: CalendarOperationalBlocker[];
  readinessPercent: number | null;
  bookingStatus: string;
}): CalendarAppointmentRiskStatus {
  if (isBookingCancelled({ booking_status: input.bookingStatus } as FiBookingRow)) {
    return "ready";
  }
  const critical = input.blockers.filter((b) => b.severity === "critical");
  const warning = input.blockers.filter((b) => b.severity === "warning");
  if (critical.length > 0) return "blocked";
  if (warning.length > 0) return "at_risk";
  if (input.readinessPercent != null && input.readinessPercent < 70) return "attention";
  if (warning.length === 0 && critical.length === 0) return "ready";
  return "attention";
}

export function deriveCalendarNextAction(
  blockers: CalendarOperationalBlocker[]
): { label: string; href: string | null } | null {
  const sorted = [...blockers].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });
  const first = sorted[0];
  if (!first) return null;
  return { label: first.label, href: first.href };
}

export function buildCalendarBookingIntelligence(
  input: CalendarBookingIntelligenceInput,
  conflicts: CalendarConflictViolation[] = []
): CalendarBookingIntelligence {
  const isSurgery = isSurgeryBookingType(input.bookingType);
  const blockers = detectCalendarOperationalBlockers(input, conflicts);
  const readinessPercent = calculateBookingReadinessPercent({
    blockers,
    isSurgery,
    preOpChecklistComplete: input.preOpChecklistComplete,
    consentSigned: input.consentSigned,
    depositSatisfied: input.depositSatisfied,
    hasStaff: Boolean(input.assignedStaffId?.trim() || input.assignedUserId?.trim()),
    hasRoom: Boolean(input.roomId?.trim()),
    explicitPercent: input.readinessPercent,
  });

  let paymentFlag: CalendarBookingIntelligence["paymentFlag"] = "unknown";
  if (!isSurgery) paymentFlag = "not_required";
  else if (input.depositSatisfied === true) paymentFlag = "satisfied";
  else if (input.depositSatisfied === false) paymentFlag = "due";

  let consentFlag: CalendarBookingIntelligence["consentFlag"] = "unknown";
  if (input.consentSigned === true) consentFlag = "signed";
  else if (input.consentSigned === false) consentFlag = "missing";

  const journeyState = input.journeyState ?? null;
  const journeyStateLabel = journeyState ? PATIENT_JOURNEY_STATE_LABELS[journeyState] : null;

  const riskStatus = deriveAppointmentRiskStatus({
    blockers,
    readinessPercent,
    bookingStatus: input.bookingStatus,
  });

  return {
    riskStatus,
    readinessPercent,
    readinessReady: readinessPercent == null ? blockers.length === 0 : readinessPercent >= 85,
    journeyState,
    journeyStateLabel,
    paymentFlag,
    consentFlag,
    blockers,
    blockerCount: blockers.length,
    nextAction: deriveCalendarNextAction(blockers),
    isSurgery,
  };
}

export function shapeCalendarOperationalFeedItem(input: {
  booking: FiBookingRow;
  patientDisplayName: string;
  staffSummary: string | null;
  roomLabel: string | null;
  intelligence: CalendarBookingIntelligence;
}): CalendarOperationalFeedItem {
  const proc = parseAppointmentProcedureMetadata(input.booking.metadata ?? {});
  return {
    id: input.booking.id,
    patientDisplayName: input.patientDisplayName,
    appointmentType: input.booking.booking_type,
    startAt: input.booking.start_at,
    endAt: input.booking.end_at,
    status: input.booking.booking_status,
    clinicianSummary: input.staffSummary,
    room: input.roomLabel,
    paymentFlag: input.intelligence.paymentFlag,
    readinessReady: input.intelligence.readinessReady,
    readinessPercent: input.intelligence.readinessPercent,
    journeyState: input.intelligence.journeyState,
    journeyStateLabel: input.intelligence.journeyStateLabel,
    blockerCount: input.intelligence.blockerCount,
    riskStatus: input.intelligence.riskStatus,
    isSurgery: input.intelligence.isSurgery,
    graftEstimate: proc.graft_count_estimate,
  };
}

export function rankSurgerySlotSuggestions<T extends { reason: string; startAt: string }>(
  slots: T[]
): T[] {
  return [...slots].sort((a, b) => {
    const aPref = a.reason.toLowerCase().includes("preferred") ? 0 : 1;
    const bPref = b.reason.toLowerCase().includes("preferred") ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;
    return a.startAt.localeCompare(b.startAt);
  });
}
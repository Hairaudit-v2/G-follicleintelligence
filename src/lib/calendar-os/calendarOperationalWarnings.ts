/**
 * CalendarOS V2 — operational warnings and surgery intelligence (pure).
 */

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import type {
  CalendarBookingIntelligence,
  CalendarOperationalBlocker,
} from "@/src/lib/calendarIntelligence/calendarIntelligenceTypes";
import type { ClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import { isBookingUnassignedForCalendarOs } from "@/src/lib/calendar-os/calendarResourceModel";
import {
  bookingDurationMinutesUtc,
  formatTimeRangeInTimezone,
} from "@/src/lib/calendar/calendarTimezone";

export type CalendarOsBookingWarningKind =
  | "payment"
  | "consent"
  | "readiness"
  | "staffing"
  | "unassigned"
  | "room"
  | "credential"
  | "attention";

export type CalendarOsBookingWarning = {
  kind: CalendarOsBookingWarningKind;
  label: string;
  severity: "info" | "warning" | "critical";
};

export type CalendarOsSurgeryIntelligence = {
  plannedGraftCount: string | null;
  surgeonLabel: string | null;
  nurseTeamLabel: string | null;
  procedureRoom: string | null;
  readinessStatus: string | null;
  readinessPercent: number | null;
  consentComplete: boolean | null;
  photographyComplete: boolean | null;
  paymentStatus: string | null;
  expectedFinishLabel: string | null;
  attentionFlags: string[];
};

export type CalendarOsStaffCoverageWarning = {
  id: string;
  label: string;
  severity: "warning" | "critical";
};

export type CalendarOsOperationalPanelSummary = {
  todaysCapacity: { booked: number; availableStaff: number };
  availableClinicians: string[];
  unassignedBookings: number;
  surgeryReadinessIssues: number;
  roomsAvailable: number;
  followUpsDue: number;
  paymentsRequiringAttention: number;
  staffCoverageWarnings: CalendarOsStaffCoverageWarning[];
};

function blockerToWarning(blocker: CalendarOperationalBlocker): CalendarOsBookingWarning | null {
  const kindMap: Partial<Record<CalendarOperationalBlocker["kind"], CalendarOsBookingWarningKind>> =
    {
      missing_staff: "staffing",
      missing_room: "room",
      unpaid_deposit: "payment",
      missing_consent: "consent",
      incomplete_pre_op: "readiness",
      surgery_without_staff: "staffing",
      room_conflict: "attention",
      surgeon_conflict: "attention",
      staff_conflict: "attention",
      patient_conflict: "attention",
    };
  const kind = kindMap[blocker.kind] ?? "attention";
  return {
    kind,
    label: blocker.label,
    severity: blocker.severity === "critical" ? "critical" : blocker.severity,
  };
}

export function deriveCalendarOsBookingWarnings(input: {
  booking: FiBookingRow;
  display?: OperationalCalendarBookingDisplay;
  operational?: CalendarBookingIntelligence | null;
  staffing?: ClinicalStaffingSummaryDto | null;
}): CalendarOsBookingWarning[] {
  const { booking, display, operational, staffing } = input;
  const warnings: CalendarOsBookingWarning[] = [];
  const seen = new Set<string>();

  function push(w: CalendarOsBookingWarning) {
    const key = `${w.kind}:${w.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(w);
  }

  if (isBookingUnassignedForCalendarOs(booking)) {
    push({
      kind: "unassigned",
      label: "Unassigned — no clinician",
      severity: "warning",
    });
  }

  if (operational?.paymentFlag === "due") {
    push({ kind: "payment", label: "Payment / deposit due", severity: "warning" });
  }

  if (operational?.consentFlag === "missing") {
    push({ kind: "consent", label: "Consent missing", severity: "warning" });
  }

  if (operational && !operational.readinessReady && operational.isSurgery) {
    push({
      kind: "readiness",
      label: operational.readinessPercent != null
        ? `Surgery readiness ${operational.readinessPercent}%`
        : "Surgery readiness incomplete",
      severity: operational.riskStatus === "blocked" ? "critical" : "warning",
    });
  }

  for (const blocker of operational?.blockers ?? []) {
    const w = blockerToWarning(blocker);
    if (w) push(w);
  }

  if (staffing && !staffing.ready) {
    for (const m of staffing.missingRoles) {
      push({
        kind: "staffing",
        label: `Missing ${m.role} (${m.assigned}/${m.required})`,
        severity: staffing.displayStatus === "blocked" ? "critical" : "warning",
      });
    }
    for (const b of staffing.blockedAssignments) {
      push({
        kind: "credential",
        label: b.reason || `${b.role} blocked`,
        severity: "critical",
      });
    }
  }

  if (booking.room_required && !booking.room_id?.trim() && !display?.roomLabel) {
    push({ kind: "room", label: "Room not assigned", severity: "warning" });
  }

  if (operational?.riskStatus === "at_risk" || operational?.riskStatus === "blocked") {
    push({
      kind: "attention",
      label: operational.nextAction?.label ?? "Needs attention",
      severity: operational.riskStatus === "blocked" ? "critical" : "warning",
    });
  }

  return warnings;
}

export function deriveCalendarOsSurgeryIntelligence(input: {
  booking: FiBookingRow;
  display?: OperationalCalendarBookingDisplay;
  operational?: CalendarBookingIntelligence | null;
  staffing?: ClinicalStaffingSummaryDto | null;
  calendarTimezone: string;
}): CalendarOsSurgeryIntelligence {
  const { booking, display, operational, staffing, calendarTimezone } = input;
  const meta = booking.metadata ?? {};
  const graftFromMeta =
    typeof meta.planned_graft_count === "number"
      ? String(meta.planned_graft_count)
      : typeof meta.graft_estimate === "string"
        ? meta.graft_estimate.trim()
        : null;

  const photographyComplete =
    meta.photography_complete === true
      ? true
      : meta.photography_complete === false
        ? false
        : null;

  const consentComplete =
    operational?.consentFlag === "signed"
      ? true
      : operational?.consentFlag === "missing"
        ? false
        : null;

  const paymentStatus =
    operational?.paymentFlag === "satisfied"
      ? "Satisfied"
      : operational?.paymentFlag === "due"
        ? "Deposit due"
        : operational?.paymentFlag === "not_required"
          ? "Not required"
          : null;

  const attentionFlags: string[] = [];
  if (staffing?.warnings?.length) attentionFlags.push(...staffing.warnings.slice(0, 3));
  for (const b of operational?.blockers ?? []) {
    if (b.severity !== "info") attentionFlags.push(b.label);
  }

  const durationMin = bookingDurationMinutesUtc(booking.start_at, booking.end_at) ?? 0;
  const endMs = Date.parse(booking.end_at);
  const expectedFinishLabel =
    Number.isFinite(endMs) && durationMin > 0
      ? formatTimeRangeInTimezone(booking.start_at, booking.end_at, calendarTimezone).split("–").pop()?.trim() ??
        null
      : null;

  return {
    plannedGraftCount: graftFromMeta,
    surgeonLabel: display?.resourceTeamLine ?? null,
    nurseTeamLabel: display?.resourceTeamLine ?? null,
    procedureRoom: display?.roomLabel ?? display?.resourceRoomLine ?? null,
    readinessStatus: operational?.readinessReady
      ? "Ready"
      : operational?.readinessPercent != null
        ? `${operational.readinessPercent}% ready`
        : staffing?.displayStatus ?? null,
    readinessPercent: operational?.readinessPercent ?? staffing?.readinessScore ?? null,
    consentComplete,
    photographyComplete,
    paymentStatus,
    expectedFinishLabel,
    attentionFlags: attentionFlags.slice(0, 5),
  };
}

export function buildCalendarOsOperationalPanelSummary(input: {
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  staffDirectory: Array<{
    id: string;
    full_name?: string | null;
    is_active?: boolean;
    clinical_readiness?: { clinically_available: boolean };
  }>;
  rooms: Array<{ id: string; is_active?: boolean }>;
  lanesDayKeys: string[];
}): CalendarOsOperationalPanelSummary {
  const { bookings, bookingDisplay, staffDirectory, rooms, lanesDayKeys } = input;
  const daySet = new Set(lanesDayKeys);

  const dayBookings = bookings.filter((b) => {
    const ms = Date.parse(b.start_at);
    if (!Number.isFinite(ms)) return false;
    const key = new Date(ms).toISOString().slice(0, 10);
    return daySet.has(key) || lanesDayKeys.some((dk) => b.start_at.startsWith(dk));
  });

  const availableClinicians = staffDirectory
    .filter((s) => s.is_active !== false && s.clinical_readiness?.clinically_available !== false)
    .map((s) => String(s.full_name ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);

  let unassignedBookings = 0;
  let surgeryReadinessIssues = 0;
  let followUpsDue = 0;
  let paymentsRequiringAttention = 0;

  for (const b of dayBookings) {
    if (isBookingUnassignedForCalendarOs(b)) unassignedBookings += 1;
    const display = bookingDisplay[b.id];
    const op = display?.operational;
    if (op?.isSurgery && !op.readinessReady) surgeryReadinessIssues += 1;
    if (b.booking_type === "follow_up" || b.booking_type === "review") followUpsDue += 1;
    if (op?.paymentFlag === "due") paymentsRequiringAttention += 1;
  }

  const roomsAvailable = rooms.filter((r) => r.is_active !== false).length;

  const staffCoverageWarnings = deriveCalendarOsStaffCoverageWarnings({
    dayBookings,
    staffDirectory,
    unassignedBookings,
    surgeryReadinessIssues,
    availableStaffCount: availableClinicians.length,
  });

  return {
    todaysCapacity: {
      booked: dayBookings.length,
      availableStaff: availableClinicians.length,
    },
    availableClinicians,
    unassignedBookings,
    surgeryReadinessIssues,
    roomsAvailable,
    followUpsDue,
    paymentsRequiringAttention,
    staffCoverageWarnings,
  };
}

export function deriveCalendarOsStaffCoverageWarnings(input: {
  dayBookings: FiBookingRow[];
  staffDirectory: Array<{
    id: string;
    full_name?: string | null;
    staff_role?: string | null;
    is_active?: boolean;
    clinical_readiness?: { clinically_available: boolean; warning_label?: string | null };
  }>;
  unassignedBookings: number;
  surgeryReadinessIssues: number;
  availableStaffCount: number;
}): CalendarOsStaffCoverageWarning[] {
  const warnings: CalendarOsStaffCoverageWarning[] = [];
  const { dayBookings, staffDirectory, unassignedBookings, surgeryReadinessIssues, availableStaffCount } =
    input;

  const inactiveBlocked = staffDirectory.filter(
    (s) =>
      s.is_active !== false &&
      s.clinical_readiness?.clinically_available === false &&
      s.clinical_readiness?.warning_label
  );
  for (const s of inactiveBlocked.slice(0, 3)) {
    warnings.push({
      id: `readiness:${s.id}`,
      label: `${String(s.full_name ?? "Staff").trim()} — ${s.clinical_readiness?.warning_label}`,
      severity: "warning",
    });
  }

  const surgeryCount = dayBookings.filter((b) => b.booking_type === "surgery").length;
  const nursesAvailable = staffDirectory.filter(
    (s) =>
      s.is_active !== false &&
      s.clinical_readiness?.clinically_available !== false &&
      String(s.staff_role ?? "").toLowerCase().includes("nurse")
  ).length;

  if (surgeryCount > 0 && nursesAvailable === 0) {
    warnings.push({
      id: "no-nurses",
      label: "Surgery day with no available nurses on roster",
      severity: "critical",
    });
  }

  if (unassignedBookings > 0) {
    warnings.push({
      id: "unassigned",
      label: `${unassignedBookings} booking${unassignedBookings === 1 ? "" : "s"} unassigned`,
      severity: unassignedBookings >= 3 ? "critical" : "warning",
    });
  }

  if (surgeryReadinessIssues > 0) {
    warnings.push({
      id: "surgery-readiness",
      label: `${surgeryReadinessIssues} surgery case${surgeryReadinessIssues === 1 ? "" : "s"} not ready`,
      severity: "warning",
    });
  }

  const bookedPerStaff =
    availableStaffCount > 0 ? dayBookings.length / availableStaffCount : dayBookings.length;
  if (dayBookings.length >= 8 && availableStaffCount > 0 && bookedPerStaff >= 6) {
    warnings.push({
      id: "high-load",
      label: "High booking load relative to available staff",
      severity: "warning",
    });
  }

  return warnings.slice(0, 6);
}

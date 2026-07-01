import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  detectCalendarOverlapConflicts,
  isOutsideClinicBusinessHours,
} from "@/src/lib/calendarIntelligence/calendarIntelligenceCore";
import type {
  CalendarConflictKind,
  CalendarConflictViolation,
} from "@/src/lib/calendarIntelligence/calendarIntelligenceTypes";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";

export type CalendarConflictEngineInput = {
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
    | "room_required"
  >;
  existing: FiBookingRow[];
  gridConfig: BusinessGridConfig;
  bufferMinutes?: number;
  staffIdToUserId?: Map<string, string | null>;
};

export type CalendarConflictEngineResult = {
  status: "clear" | "warning" | "blocked";
  violations: CalendarConflictViolation[];
};

export function evaluateCalendarConflicts(
  input: CalendarConflictEngineInput
): CalendarConflictEngineResult {
  const violations: CalendarConflictViolation[] = [];

  if (
    isOutsideClinicBusinessHours(
      input.candidate.start_at,
      input.candidate.end_at,
      input.gridConfig
    )
  ) {
    violations.push({
      kind: "outside_clinic_hours",
      severity: "warning",
      message: "Appointment is outside clinic business hours.",
      conflictingBookingId: null,
    });
  }

  violations.push(
    ...detectCalendarOverlapConflicts(input.candidate, input.existing, {
      ignoreBookingId: input.candidate.id,
      bufferMinutes: input.bufferMinutes,
      staffIdToUserId: input.staffIdToUserId,
    })
  );

  const isSurgery = input.candidate.booking_type.trim().toLowerCase() === "surgery";
  if (
    isSurgery &&
    !input.candidate.assigned_staff_id?.trim() &&
    !input.candidate.assigned_user_id?.trim()
  ) {
    violations.push({
      kind: "surgery_without_required_staff",
      severity: "error",
      message: "Surgery requires an assigned surgeon or clinical lead.",
      conflictingBookingId: null,
    });
  }

  const deduped = new Map<CalendarConflictKind, CalendarConflictViolation>();
  for (const v of violations) {
    if (!deduped.has(v.kind)) deduped.set(v.kind, v);
  }
  const unique = Array.from(deduped.values());
  const blocked = unique.some((v) => v.severity === "error");
  const warning = unique.some((v) => v.severity === "warning");
  return {
    status: blocked ? "blocked" : warning ? "warning" : "clear",
    violations: unique,
  };
}
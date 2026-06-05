/**
 * Calendar-facing appointment DTO — maps `fi_bookings` rows for CRM calendar clients.
 */

import { resolveProcedureFamily, fiProcedureFamilyLabels, type FiProcedureFamily } from "@/lib/design-system";
import {
  bookingDurationMinutes,
  parseAppointmentProcedureMetadata,
  type AppointmentProcedureMetadata,
} from "./appointmentMetadata";
import { bookingStatusLabel, bookingTypeLabel } from "./operatorBookingLabels";
import type { FiBookingRow } from "./types";

export type CalendarAppointmentProcedure = AppointmentProcedureMetadata & {
  family: FiProcedureFamily;
  familyLabel: string;
  typeLabel: string;
};

export type CalendarAppointment = {
  id: string;
  tenantId: string;
  procedure: string;
  status: string;
  statusLabel: string;
  title: string | null;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  /** `fi_staff.id` when set; calendar column assignment. */
  assignedStaffId: string | null;
  providerId: string | null;
  clinicId: string | null;
  location: string | null;
  timezone: string | null;
  leadId: string | null;
  personId: string | null;
  patientId: string | null;
  caseId: string | null;
  isVirtual: boolean;
  procedureDetails: CalendarAppointmentProcedure;
  metadata: Record<string, unknown>;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function isVirtualBooking(row: FiBookingRow): boolean {
  const loc = row.location?.trim().toLowerCase() ?? "";
  if (loc.includes("zoom") || loc.includes("virtual") || loc.includes("telehealth")) return true;
  const meta = row.metadata ?? {};
  return meta.is_virtual === true || meta.virtual === true;
}

export function mapBookingToCalendarAppointment(row: FiBookingRow): CalendarAppointment {
  const procedure = row.booking_type.trim();
  const family = resolveProcedureFamily({
    bookingType: procedure,
    isVirtual: isVirtualBooking(row),
  });
  const parsed = parseAppointmentProcedureMetadata(row.metadata ?? {});

  return {
    id: row.id,
    tenantId: row.tenant_id,
    procedure,
    status: row.booking_status,
    statusLabel: bookingStatusLabel(row.booking_status),
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    durationMinutes: bookingDurationMinutes(row),
    assignedStaffId: row.assigned_staff_id,
    providerId: row.assigned_user_id,
    clinicId: row.clinic_id,
    location: row.location,
    timezone: row.timezone,
    leadId: row.lead_id,
    personId: row.person_id,
    patientId: row.patient_id,
    caseId: row.case_id,
    isVirtual: isVirtualBooking(row),
    procedureDetails: {
      ...parsed,
      family,
      familyLabel: fiProcedureFamilyLabels[family],
      typeLabel: bookingTypeLabel(procedure),
    },
    metadata: row.metadata ?? {},
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBookingsToCalendarAppointments(rows: FiBookingRow[]): CalendarAppointment[] {
  return rows.map(mapBookingToCalendarAppointment);
}

/** Merge server appointment DTO into an existing booking row (calendar optimistic sync). */
export function mapCalendarAppointmentToBookingRow(
  appt: CalendarAppointment,
  existing: FiBookingRow
): FiBookingRow {
  return {
    ...existing,
    booking_type: appt.procedure,
    booking_status: appt.status,
    title: appt.title,
    start_at: appt.startAt,
    end_at: appt.endAt,
    assigned_staff_id: appt.assignedStaffId ?? null,
    assigned_user_id: appt.providerId,
    clinic_id: appt.clinicId,
    location: appt.location,
    timezone: appt.timezone,
    metadata: appt.metadata,
    cancelled_at: appt.cancelledAt,
    updated_at: appt.updatedAt,
  };
}

import "server-only";

import { parseUtcCalendarDateString } from "./calendarQuery";
import {
  createBooking,
  loadBookingsForOperatorView,
  loadBookingForTenant,
  updateBooking,
} from "./bookings";
import { checkAppointmentAvailability, DEFAULT_APPOINTMENT_BUFFER_MINUTES } from "./appointmentAvailability";
import {
  endIsoFromStartAndProcedure,
  defaultProcedureDurationMinutes,
} from "./appointmentProcedureDefaults";
import {
  mapBookingToCalendarAppointment,
  mapBookingsToCalendarAppointments,
  type CalendarAppointment,
} from "./appointmentDto";
import {
  mergeAppointmentProcedureMetadata,
} from "./appointmentMetadata";
import { bookingTypeLabel } from "./operatorBookingLabels";
import type { FiBookingRow } from "./types";

export class AppointmentConflictError extends Error {
  readonly conflictingBookingId: string | null;

  constructor(message: string, conflictingBookingId: string | null) {
    super(message);
    this.name = "AppointmentConflictError";
    this.conflictingBookingId = conflictingBookingId;
  }
}

export function utcCalendarDayRangeIso(dateYmd: string): { rangeStartIso: string; rangeEndIso: string } {
  const normalized = parseUtcCalendarDateString(dateYmd);
  if (!normalized) throw new Error("Invalid date (expected YYYY-MM-DD).");
  const y = Number(normalized.slice(0, 4));
  const mo = Number(normalized.slice(5, 7)) - 1;
  const d = Number(normalized.slice(8, 10));
  const startMs = Date.UTC(y, mo, d, 0, 0, 0, 0);
  const endMs = startMs + 86_400_000;
  return {
    rangeStartIso: new Date(startMs).toISOString(),
    rangeEndIso: new Date(endMs).toISOString(),
  };
}

export type ListCalendarAppointmentsParams = {
  tenantId: string;
  date: string;
  providerId?: string | null;
  procedure?: string | null;
  clinicId?: string | null;
  includeCancelled?: boolean;
};

export async function listCalendarAppointments(
  params: ListCalendarAppointmentsParams
): Promise<{ date: string; appointments: CalendarAppointment[] }> {
  const date = parseUtcCalendarDateString(params.date);
  if (!date) throw new Error("Invalid date (expected YYYY-MM-DD).");

  const { rangeStartIso, rangeEndIso } = utcCalendarDayRangeIso(date);
  const rows = await loadBookingsForOperatorView({
    tenantId: params.tenantId,
    rangeStartIso,
    rangeEndIso,
    assignedUserId: params.providerId?.trim() || null,
    bookingType: params.procedure?.trim() || null,
    clinicId: params.clinicId?.trim() || null,
    includeCancelled: params.includeCancelled ?? false,
  });

  return { date, appointments: mapBookingsToCalendarAppointments(rows) };
}

async function assertSlotAvailable(args: {
  tenantId: string;
  startAt: string;
  endAt: string;
  assignedUserId: string | null;
  excludeBookingId?: string | null;
}): Promise<void> {
  const { rangeStartIso, rangeEndIso } = utcCalendarDayRangeIso(
    parseUtcCalendarDateString(args.startAt.slice(0, 10)) ?? args.startAt.slice(0, 10)
  );
  const dayStartMs = Date.parse(rangeStartIso);
  const dayEndMs = Date.parse(rangeEndIso);
  const startMs = Date.parse(args.startAt);
  const endMs = Date.parse(args.endAt);

  const padStart = new Date(Math.min(dayStartMs, startMs - 86_400_000)).toISOString();
  const padEnd = new Date(Math.max(dayEndMs, endMs + 86_400_000)).toISOString();

  const existing = await loadBookingsForOperatorView({
    tenantId: args.tenantId,
    rangeStartIso: padStart,
    rangeEndIso: padEnd,
    assignedUserId: args.assignedUserId,
    includeCancelled: false,
  });

  const result = checkAppointmentAvailability({
    candidateStartIso: args.startAt,
    candidateEndIso: args.endAt,
    assignedUserId: args.assignedUserId,
    existing,
    excludeBookingId: args.excludeBookingId,
    bufferMinutes: DEFAULT_APPOINTMENT_BUFFER_MINUTES,
  });

  if (!result.ok) {
    throw new AppointmentConflictError(result.message, result.conflictingBookingId);
  }
}

function mergeCreateMetadata(
  base: Record<string, unknown> | undefined,
  procedurePatch: Record<string, unknown> | undefined
): Record<string, unknown> {
  let meta = { ...(base ?? {}) };
  if (procedurePatch) {
    meta = mergeAppointmentProcedureMetadata(meta, {
      graft_count_estimate: procedurePatch.graft_count_estimate as string | null | undefined,
      donor_area: procedurePatch.donor_area as string | null | undefined,
      technique: procedurePatch.technique as string | null | undefined,
      special_instructions: procedurePatch.special_instructions as string | null | undefined,
      surgeon_user_id: procedurePatch.surgeon_user_id as string | null | undefined,
      consultant_user_id: procedurePatch.consultant_user_id as string | null | undefined,
      tech_user_id: procedurePatch.tech_user_id as string | null | undefined,
    });
  }
  return meta;
}

export type CreateCalendarAppointmentParams = {
  tenantId: string;
  procedure: string;
  startAt: string;
  endAt?: string;
  providerId?: string | null;
  clinicId?: string | null;
  leadId?: string | null;
  personId?: string | null;
  patientId?: string | null;
  caseId?: string | null;
  title?: string | null;
  description?: string | null;
  timezone?: string | null;
  location?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
  procedureMetadataPatch?: Record<string, unknown>;
  createdByUserId?: string | null;
  skipAvailabilityCheck?: boolean;
};

export async function createCalendarAppointment(
  params: CreateCalendarAppointmentParams
): Promise<CalendarAppointment> {
  const procedure = params.procedure.trim();
  const startAt = params.startAt.trim();
  const endAt = params.endAt?.trim() || endIsoFromStartAndProcedure(startAt, procedure);
  const providerId = params.providerId?.trim() || null;

  if (!params.skipAvailabilityCheck) {
    await assertSlotAvailable({
      tenantId: params.tenantId,
      startAt,
      endAt,
      assignedUserId: providerId,
    });
  }

  const metadata = mergeCreateMetadata(params.metadata, params.procedureMetadataPatch);
  const defaultTitle = bookingTypeLabel(procedure);

  let row = await createBooking({
    tenantId: params.tenantId,
    leadId: params.leadId ?? null,
    personId: params.personId ?? null,
    patientId: params.patientId ?? null,
    caseId: params.caseId ?? null,
    clinicId: params.clinicId ?? null,
    assignedUserId: providerId,
    bookingType: procedure,
    title: params.title?.trim() || defaultTitle,
    description: params.description ?? null,
    startAt,
    endAt,
    timezone: params.timezone ?? null,
    location: params.location ?? null,
    metadata,
    createdByUserId: params.createdByUserId ?? null,
  });

  const desiredStatus = params.status?.trim();
  if (desiredStatus && desiredStatus !== "scheduled" && desiredStatus !== row.booking_status) {
    row = await updateBooking({
      tenantId: params.tenantId,
      bookingId: row.id,
      leadId: row.lead_id,
      personId: row.person_id,
      patientId: row.patient_id,
      caseId: row.case_id,
      clinicId: row.clinic_id,
      assignedUserId: row.assigned_user_id,
      bookingType: row.booking_type,
      bookingStatus: desiredStatus,
      title: row.title,
      description: row.description,
      startAt: row.start_at,
      endAt: row.end_at,
      timezone: row.timezone,
      location: row.location,
      metadata: row.metadata,
    });
  }

  return mapBookingToCalendarAppointment(row);
}

export type RescheduleCalendarAppointmentParams = {
  tenantId: string;
  appointmentId: string;
  startAt?: string;
  endAt?: string;
  providerId?: string | null;
  clinicId?: string | null;
  procedure?: string;
  status?: string;
  title?: string | null;
  location?: string | null;
  metadata?: Record<string, unknown>;
  procedureMetadataPatch?: Record<string, unknown>;
  skipAvailabilityCheck?: boolean;
};

export async function rescheduleCalendarAppointment(
  params: RescheduleCalendarAppointmentParams
): Promise<CalendarAppointment> {
  const existing = await loadBookingForTenant(params.tenantId, params.appointmentId);
  if (!existing) throw new Error("Appointment not found.");

  const nextStart = params.startAt?.trim() ?? existing.start_at;
  const procedure = params.procedure?.trim() ?? existing.booking_type;
  let nextEnd = params.endAt?.trim();

  if (!nextEnd) {
    if (params.startAt && !params.endAt) {
      const durationMs =
        new Date(existing.end_at).getTime() - new Date(existing.start_at).getTime();
      const durationMin =
        Number.isFinite(durationMs) && durationMs > 0
          ? Math.round(durationMs / 60_000)
          : defaultProcedureDurationMinutes(procedure);
      nextEnd = new Date(Date.parse(nextStart) + durationMin * 60_000).toISOString();
    } else {
      nextEnd = existing.end_at;
    }
  }

  const providerId =
    params.providerId !== undefined ? params.providerId?.trim() || null : existing.assigned_user_id;

  if (!params.skipAvailabilityCheck) {
    await assertSlotAvailable({
      tenantId: params.tenantId,
      startAt: nextStart,
      endAt: nextEnd,
      assignedUserId: providerId,
      excludeBookingId: existing.id,
    });
  }

  let metadata = params.metadata ?? existing.metadata ?? {};
  if (params.procedureMetadataPatch) {
    metadata = mergeCreateMetadata(metadata, params.procedureMetadataPatch);
  }

  const updated = await updateBooking({
    tenantId: params.tenantId,
    bookingId: params.appointmentId,
    leadId: existing.lead_id,
    personId: existing.person_id,
    patientId: existing.patient_id,
    caseId: existing.case_id,
    clinicId: params.clinicId !== undefined ? params.clinicId : existing.clinic_id,
    assignedUserId: providerId,
    bookingType: params.procedure ?? undefined,
    bookingStatus: params.status ?? undefined,
    title: params.title !== undefined ? params.title : existing.title,
    description: existing.description,
    startAt: nextStart,
    endAt: nextEnd,
    timezone: existing.timezone,
    location: params.location !== undefined ? params.location : existing.location,
    metadata,
  });

  return mapBookingToCalendarAppointment(updated);
}

/** Re-export for route handlers mapping 409 conflicts. */
export type { FiBookingRow };

/**
 * Browser client for calendar appointment API routes.
 *
 * PATCH reschedule: `PATCH /api/tenants/{tenantId}/appointments/{appointmentId}`
 * (see `app/api/tenants/[tenantId]/appointments/[appointmentId]/route.ts`).
 */

import type { CalendarAppointment } from "@/src/lib/bookings/appointmentDto";

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string; conflictingAppointmentId?: string | null };

function tenantAppointmentsBase(tenantId: string): string {
  return `/api/tenants/${encodeURIComponent(tenantId.trim())}/appointments`;
}

export type FetchAppointmentsParams = {
  tenantId: string;
  date: string;
  providerId?: string | null;
  procedure?: string | null;
  clinicId?: string | null;
  includeCancelled?: boolean;
};

export async function fetchCalendarAppointments(
  params: FetchAppointmentsParams
): Promise<{ date: string; providerId: string | null; appointments: CalendarAppointment[] }> {
  const sp = new URLSearchParams({ date: params.date });
  if (params.providerId?.trim()) sp.set("provider", params.providerId.trim());
  if (params.procedure?.trim()) sp.set("procedure", params.procedure.trim());
  if (params.clinicId?.trim()) sp.set("clinicId", params.clinicId.trim());
  if (params.includeCancelled) sp.set("includeCancelled", "1");

  const res = await fetch(`${tenantAppointmentsBase(params.tenantId)}?${sp.toString()}`, {
    credentials: "include",
  });
  const json = (await res.json()) as
    | ApiOk<{
        date: string;
        providerId: string | null;
        appointments: CalendarAppointment[];
      }>
    | ApiErr;
  if (!res.ok || !json.ok) {
    throw new Error(!json.ok ? json.error : `Request failed (${res.status}).`);
  }
  return {
    date: json.date,
    providerId: json.providerId,
    appointments: json.appointments,
  };
}

export type CreateAppointmentInput = {
  tenantId: string;
  procedure: string;
  startAt: string;
  endAt?: string;
  providerId?: string | null;
  patientId?: string | null;
  leadId?: string | null;
  personId?: string | null;
  caseId?: string | null;
  clinicId?: string | null;
  title?: string | null;
  location?: string | null;
  procedureDetails?: Record<string, unknown>;
};

export async function createCalendarAppointmentRequest(
  input: CreateAppointmentInput
): Promise<CalendarAppointment> {
  const res = await fetch(tenantAppointmentsBase(input.tenantId), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      procedure: input.procedure,
      startAt: input.startAt,
      endAt: input.endAt,
      provider: input.providerId,
      patientId: input.patientId,
      leadId: input.leadId,
      personId: input.personId,
      caseId: input.caseId,
      clinicId: input.clinicId,
      title: input.title,
      location: input.location,
      procedureDetails: input.procedureDetails,
    }),
  });
  const json = (await res.json()) as ApiOk<{ appointment: CalendarAppointment }> | ApiErr;
  if (!res.ok || !json.ok) {
    throw new Error(!json.ok ? json.error : `Request failed (${res.status}).`);
  }
  return json.appointment;
}

export type RescheduleAppointmentInput = {
  tenantId: string;
  appointmentId: string;
  startAt?: string;
  endAt?: string;
  /** Linked `fi_users.id` when not using `staffId`. */
  providerId?: string | null;
  /** `fi_staff.id` — set or clear (`null`) assignment; when present, server resolves linked user. */
  staffId?: string | null;
  clinicId?: string | null;
  procedure?: string;
  metadata?: Record<string, unknown>;
};

export type RescheduleAppointmentResult =
  | { ok: true; appointment: CalendarAppointment }
  | {
      ok: false;
      error: string;
      conflictingAppointmentId?: string | null;
      isConflict?: boolean;
    };

export async function rescheduleCalendarAppointmentRequest(
  input: RescheduleAppointmentInput
): Promise<RescheduleAppointmentResult> {
  let res: Response;
  try {
    res = await fetch(
      `${tenantAppointmentsBase(input.tenantId)}/${encodeURIComponent(input.appointmentId.trim())}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: input.startAt,
          endAt: input.endAt,
          provider: input.providerId,
          staffId: input.staffId,
          clinicId: input.clinicId,
          procedure: input.procedure,
          metadata: input.metadata,
        }),
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: msg };
  }

  let json: ApiOk<{ appointment: CalendarAppointment }> | ApiErr;
  try {
    json = (await res.json()) as ApiOk<{ appointment: CalendarAppointment }> | ApiErr;
  } catch {
    return {
      ok: false,
      error: res.status ? `Request failed (${res.status}).` : "Invalid response from server.",
      isConflict: res.status === 409,
    };
  }

  if (res.ok && json.ok) {
    return { ok: true, appointment: json.appointment };
  }
  return {
    ok: false,
    error: !json.ok ? json.error : `Request failed (${res.status}).`,
    conflictingAppointmentId: !json.ok ? (json.conflictingAppointmentId ?? null) : null,
    isConflict: res.status === 409,
  };
}

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

function calendarOsEventBase(tenantId: string, eventId: string): string {
  return `/api/tenants/${encodeURIComponent(tenantId.trim())}/calendar/appointments/${encodeURIComponent(eventId.trim())}`;
}

export type RescheduleCalendarOsEventInput = {
  tenantId: string;
  eventId: string;
  startAt: string;
  endAt: string;
  staffId?: string | null;
  clinicId?: string | null;
  roomId?: string | null;
  interactionSource?: "calendar_drag" | "calendar_quick_edit";
};

export type RescheduleCalendarOsEventResult =
  | { ok: true; writebackStatus: string; googleEtag: string | null; auditId: string }
  | {
      ok: false;
      error: string;
      code?: string;
      writebackStatus?: string;
      isConflict?: boolean;
    };

/** PATCH CalendarOS google_linked_fios event with Google write-back. */
export async function rescheduleCalendarOsEventRequest(
  input: RescheduleCalendarOsEventInput
): Promise<RescheduleCalendarOsEventResult> {
  let res: Response;
  try {
    res = await fetch(calendarOsEventBase(input.tenantId, input.eventId), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt: input.startAt,
        endAt: input.endAt,
        staffId: input.staffId,
        clinicId: input.clinicId,
        roomId: input.roomId,
        interactionSource: input.interactionSource ?? "calendar_drag",
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }

  const json = (await res.json().catch(() => ({
    ok: false,
    error: `Request failed (${res.status}).`,
  }))) as Record<string, unknown>;

  if (res.ok && json.ok) {
    return {
      ok: true,
      writebackStatus: String(json.writebackStatus ?? "synced"),
      googleEtag: (json.googleEtag as string | null) ?? null,
      auditId: String(json.auditId ?? ""),
    };
  }

  return {
    ok: false,
    error: typeof json.error === "string" ? json.error : `Request failed (${res.status}).`,
    code: typeof json.code === "string" ? json.code : undefined,
    writebackStatus: typeof json.writebackStatus === "string" ? json.writebackStatus : undefined,
    isConflict: res.status === 409 || json.code === "concurrent_edit",
  };
}

export async function linkCalendarOsPatientRequest(input: {
  tenantId: string;
  eventId: string;
  patientId: string;
  confirmed: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${calendarOsEventBase(input.tenantId, input.eventId)}/link-patient`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientId: input.patientId,
      confirmed: input.confirmed,
    }),
  });
  const json = (await res.json().catch(() => ({ ok: false, error: "Invalid response" }))) as {
    ok?: boolean;
    error?: string;
  };
  if (res.ok && json.ok) return { ok: true };
  return { ok: false, error: json.error ?? `Request failed (${res.status}).` };
}

export async function convertExternalCalendarEventRequest(input: {
  tenantId: string;
  eventId: string;
  clinicId?: string | null;
  assignedStaffId?: string | null;
}): Promise<
  | { ok: true; fiosAppointmentId: string }
  | { ok: false; error: string }
> {
  const res = await fetch(`${calendarOsEventBase(input.tenantId, input.eventId)}/convert`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clinicId: input.clinicId,
      assignedStaffId: input.assignedStaffId,
    }),
  });
  const json = (await res.json().catch(() => ({ ok: false, error: "Invalid response" }))) as {
    ok?: boolean;
    error?: string;
    fiosAppointmentId?: string;
  };
  if (res.ok && json.ok && json.fiosAppointmentId) {
    return { ok: true, fiosAppointmentId: json.fiosAppointmentId };
  }
  return { ok: false, error: json.error ?? `Request failed (${res.status}).` };
}

export async function quickEditCalendarOsEventRequest(input: {
  tenantId: string;
  eventId: string;
  patch: Record<string, unknown>;
}): Promise<RescheduleCalendarOsEventResult> {
  let res: Response;
  try {
    res = await fetch(calendarOsEventBase(input.tenantId, input.eventId), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input.patch,
        interactionSource: "calendar_quick_edit",
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
  const json = (await res.json().catch(() => ({
    ok: false,
    error: `Request failed (${res.status}).`,
  }))) as Record<string, unknown>;
  if (res.ok && json.ok) {
    return {
      ok: true,
      writebackStatus: String(json.writebackStatus ?? "synced"),
      googleEtag: (json.googleEtag as string | null) ?? null,
      auditId: String(json.auditId ?? ""),
    };
  }
  return {
    ok: false,
    error: typeof json.error === "string" ? json.error : `Request failed (${res.status}).`,
    code: typeof json.code === "string" ? json.code : undefined,
    writebackStatus: typeof json.writebackStatus === "string" ? json.writebackStatus : undefined,
    isConflict: res.status === 409 || json.code === "concurrent_edit",
  };
}

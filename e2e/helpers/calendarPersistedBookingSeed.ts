import type { APIRequestContext } from "@playwright/test";

import { e2eRunId, smokeTestLeadName } from "./test-data";
import { weekMondayYmd } from "./calendarInteraction";

const SMOKETEST_META_FLAG = "e2e_persisted_drag";

export type PersistedBookingSeed = {
  bookingId: string;
  dayKey: string;
  startAt: string;
  endAt: string;
  title: string;
  staffId: string | null;
};

function requireSupabaseAdminEnv(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for persisted calendar e2e seed.",
    );
  }
  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

async function supabaseSelect<T>(table: string, query: string): Promise<T[]> {
  const { url, serviceRoleKey } = requireSupabaseAdminEnv();
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase select failed (${table}): ${res.status} ${body}`);
  }
  return (await res.json()) as T[];
}

function isoAtUtcHour(dayKey: string, hour: number, minute = 0): string {
  return `${dayKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

function dayKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function persistedDragDayKey(): string {
  const explicit = process.env.FI_E2E_CALENDAR_PERSISTED_DATE?.trim();
  if (explicit) return explicit;
  const anchor = process.env.FI_E2E_CALENDAR_INTERACTION_DATE?.trim() || new Date().toISOString().slice(0, 10);
  const mon = weekMondayYmd(anchor);
  const y = Number(mon.slice(0, 4));
  const mo = Number(mon.slice(5, 7)) - 1;
  const d = Number(mon.slice(8, 10));
  return new Date(Date.UTC(y, mo, d + 14, 0, 0, 0, 0)).toISOString().slice(0, 10);
}

async function resolveLeadId(tenantId: string): Promise<{ leadId: string; personId: string | null }> {
  const fromEnv = process.env.FI_E2E_CALENDAR_LEAD_ID?.trim();
  if (fromEnv) {
    return { leadId: fromEnv, personId: process.env.FI_E2E_CALENDAR_PERSON_ID?.trim() || null };
  }

  const rows = await supabaseSelect<{ id: string; person_id: string | null }>(
    "fi_crm_leads",
    `tenant_id=eq.${tenantId}&person_id=not.is.null&select=id,person_id&limit=1`
  );
  const lead = rows[0];
  if (!lead?.id) {
    throw new Error(
      "No CRM lead with person_id — set FI_E2E_CALENDAR_LEAD_ID or seed a lead on the demo tenant.",
    );
  }
  return { leadId: lead.id, personId: lead.person_id };
}

async function resolveStaffId(tenantId: string): Promise<string | null> {
  const fromEnv = process.env.FI_E2E_CALENDAR_STAFF_ID?.trim();
  if (fromEnv) return fromEnv;

  const rows = await supabaseSelect<{ id: string }>(
    "fi_staff",
    `tenant_id=eq.${tenantId}&is_active=eq.true&select=id&limit=1`
  );
  return rows[0]?.id ?? null;
}

export function hasPersistedCalendarSeedEnv(): boolean {
  if (process.env.FI_E2E_CALENDAR_LEAD_ID?.trim()) return true;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export async function fetchAppointmentStartAt(
  request: APIRequestContext,
  tenantId: string,
  bookingId: string,
  dayKey: string
): Promise<string | null> {
  const res = await request.get(
    `/api/tenants/${encodeURIComponent(tenantId)}/appointments?date=${encodeURIComponent(dayKey)}&includeCancelled=1`
  );
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    appointments?: Array<{ id: string; startAt?: string; start_at?: string }>;
  };
  if (!res.ok || !json.ok || !Array.isArray(json.appointments)) return null;
  const hit = json.appointments.find((a) => a.id === bookingId);
  const start = hit?.startAt ?? hit?.start_at;
  return start?.trim() || null;
}

/** Creates one SMOKETEST consultation via authenticated appointments API (real fi_bookings row). */
export async function seedPersistedCalendarConsultation(input: {
  tenantId: string;
  request: APIRequestContext;
  slotHourUtc?: number;
  durationMinutes?: number;
}): Promise<PersistedBookingSeed> {
  const tid = input.tenantId.trim();
  const { leadId, personId } = await resolveLeadId(tid);
  const staffId = await resolveStaffId(tid);

  const dayKey = persistedDragDayKey();
  const hour = input.slotHourUtc ?? Number(process.env.FI_E2E_CALENDAR_PERSISTED_HOUR_UTC ?? 6);
  const durationMin = input.durationMinutes ?? 45;
  const startAt =
    process.env.FI_E2E_CALENDAR_PERSISTED_START_AT?.trim() || isoAtUtcHour(dayKey, hour, 0);
  const endAt =
    process.env.FI_E2E_CALENDAR_PERSISTED_END_AT?.trim() ||
    new Date(Date.parse(startAt) + durationMin * 60_000).toISOString();

  const runId = e2eRunId();
  const title = `${smokeTestLeadName(`PersistedDrag-${runId}`)} — Consultation`;

  const res = await input.request.post(`/api/tenants/${encodeURIComponent(tid)}/appointments`, {
    data: {
      procedure: "consultation",
      startAt,
      endAt,
      leadId,
      ...(personId ? { personId } : {}),
      ...(staffId ? { staffId } : {}),
      title,
      metadata: {
        smoketest: true,
        [SMOKETEST_META_FLAG]: true,
        e2e_run_id: runId,
      },
      skipAvailabilityCheck: true,
    },
  });

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    appointment?: { id: string; startAt?: string; endAt?: string; start_at?: string; end_at?: string };
  };
  if (!res.ok || !json.ok || !json.appointment?.id) {
    throw new Error(json.error ?? `Persisted calendar seed failed (${res.status}).`);
  }

  const appt = json.appointment;
  return {
    bookingId: appt.id,
    dayKey: dayKeyFromIso(appt.startAt ?? appt.start_at ?? startAt),
    startAt: appt.startAt ?? appt.start_at ?? startAt,
    endAt: appt.endAt ?? appt.end_at ?? endAt,
    title,
    staffId,
  };
}

/** Second booking occupying a later slot — overlap rejection helper. */
export async function seedPersistedCalendarBlocker(input: {
  tenantId: string;
  request: APIRequestContext;
  dayKey: string;
  startAt: string;
  endAt: string;
  staffId?: string | null;
}): Promise<PersistedBookingSeed> {
  const tid = input.tenantId.trim();
  const lead = await resolveLeadId(tid);
  const staffId = input.staffId ?? (await resolveStaffId(tid));

  const runId = e2eRunId();
  const title = `${smokeTestLeadName(`PersistedBlocker-${runId}`)} — Consultation`;

  const res = await input.request.post(`/api/tenants/${encodeURIComponent(tid)}/appointments`, {
    data: {
      procedure: "consultation",
      startAt: input.startAt,
      endAt: input.endAt,
      leadId: lead.leadId,
      ...(lead.personId ? { personId: lead.personId } : {}),
      ...(staffId ? { staffId } : {}),
      title,
      metadata: { smoketest: true, e2e_persisted_blocker: true, e2e_run_id: runId },
      skipAvailabilityCheck: true,
    },
  });

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    appointment?: { id: string; startAt?: string; endAt?: string; start_at?: string; end_at?: string };
  };
  if (!res.ok || !json.ok || !json.appointment?.id) {
    throw new Error(json.error ?? `Persisted blocker seed failed (${res.status}).`);
  }

  const appt = json.appointment;
  return {
    bookingId: appt.id,
    dayKey: input.dayKey,
    startAt: appt.startAt ?? appt.start_at ?? input.startAt,
    endAt: appt.endAt ?? appt.end_at ?? input.endAt,
    title,
    staffId,
  };
}

export async function cancelPersistedCalendarBooking(input: {
  tenantId: string;
  request: APIRequestContext;
  bookingId: string;
}): Promise<void> {
  const res = await input.request.post(
    `/api/tenants/${encodeURIComponent(input.tenantId.trim())}/bookings/${encodeURIComponent(input.bookingId)}/cancel`,
    {
      data: {
        cancellationReason: "E2E persisted drag smoke — auto-cancelled.",
      },
    }
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Cancel booking failed (${res.status}).`);
  }
}

export async function cancelPersistedCalendarBookings(input: {
  tenantId: string;
  request: APIRequestContext;
  bookingIds: string[];
}): Promise<void> {
  for (const id of input.bookingIds) {
    if (!id?.trim()) continue;
    try {
      await cancelPersistedCalendarBooking({ ...input, bookingId: id });
    } catch {
      /* best-effort cleanup */
    }
  }
}

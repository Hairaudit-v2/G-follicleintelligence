import type { FiBookingRow } from "./types";

/** Procedure / team fields stored on `fi_bookings.metadata` (Evolved Hair Clinics). */
export type AppointmentProcedureMetadata = {
  graft_count_estimate: string | null;
  donor_area: string | null;
  technique: string | null;
  special_instructions: string | null;
  surgeon_user_id: string | null;
  consultant_user_id: string | null;
  tech_user_id: string | null;
};

export type AppointmentStatusHistoryEntry = {
  at: string;
  status: string;
  note?: string | null;
  source?: string | null;
};

export type AppointmentInstructionsSentMetadata = {
  pre_op_at?: string | null;
  post_op_at?: string | null;
};

const STATUS_HISTORY_KEY = "status_history";
const INSTRUCTIONS_SENT_KEY = "instructions_sent";

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function uuidOrNull(v: unknown): string | null {
  const s = strOrNull(v);
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

export function parseAppointmentProcedureMetadata(metadata: Record<string, unknown>): AppointmentProcedureMetadata {
  return {
    graft_count_estimate: strOrNull(metadata.graft_count_estimate),
    donor_area: strOrNull(metadata.donor_area),
    technique: strOrNull(metadata.technique),
    special_instructions: strOrNull(metadata.special_instructions),
    surgeon_user_id: uuidOrNull(metadata.surgeon_user_id),
    consultant_user_id: uuidOrNull(metadata.consultant_user_id),
    tech_user_id: uuidOrNull(metadata.tech_user_id),
  };
}

export function mergeAppointmentProcedureMetadata(
  base: Record<string, unknown>,
  patch: Partial<AppointmentProcedureMetadata>
): Record<string, unknown> {
  const next = { ...base };
  for (const key of [
    "graft_count_estimate",
    "donor_area",
    "technique",
    "special_instructions",
    "surgeon_user_id",
    "consultant_user_id",
    "tech_user_id",
  ] as const) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }
  return next;
}

export function parseAppointmentStatusHistory(metadata: Record<string, unknown>): AppointmentStatusHistoryEntry[] {
  const raw = metadata[STATUS_HISTORY_KEY];
  if (!Array.isArray(raw)) return [];
  const out: AppointmentStatusHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    const at = strOrNull(r.at);
    const status = strOrNull(r.status);
    if (!at || !status) continue;
    out.push({
      at,
      status,
      note: strOrNull(r.note),
      source: strOrNull(r.source),
    });
  }
  return out;
}

export function appendAppointmentStatusHistory(
  metadata: Record<string, unknown>,
  entry: AppointmentStatusHistoryEntry
): Record<string, unknown> {
  const prev = parseAppointmentStatusHistory(metadata);
  return {
    ...metadata,
    [STATUS_HISTORY_KEY]: [entry, ...prev].slice(0, 40),
  };
}

/** Merges stored history with derived booking lifecycle rows (newest first). */
export function buildAppointmentStatusHistory(booking: FiBookingRow): AppointmentStatusHistoryEntry[] {
  const meta = booking.metadata ?? {};
  const stored = parseAppointmentStatusHistory(meta);
  const derived: AppointmentStatusHistoryEntry[] = [];

  if (booking.cancelled_at) {
    derived.push({
      at: booking.cancelled_at,
      status: "cancelled",
      note: booking.cancellation_reason,
      source: "fi_bookings",
    });
  }
  if (booking.booking_status === "completed") {
    derived.push({
      at: booking.updated_at,
      status: "completed",
      source: "fi_bookings",
    });
  }
  derived.push({
    at: booking.created_at,
    status: booking.booking_status,
    note: "Created",
    source: "fi_bookings",
  });

  const seen = new Set<string>();
  const merged: AppointmentStatusHistoryEntry[] = [];
  for (const e of [...stored, ...derived]) {
    const key = `${e.at}|${e.status}|${e.note ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(e);
  }
  merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return merged;
}

export function parseInstructionsSent(metadata: Record<string, unknown>): AppointmentInstructionsSentMetadata {
  const raw = metadata[INSTRUCTIONS_SENT_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  return {
    pre_op_at: strOrNull(r.pre_op_at),
    post_op_at: strOrNull(r.post_op_at),
  };
}

export function markInstructionsSent(
  metadata: Record<string, unknown>,
  kind: "pre_op" | "post_op"
): Record<string, unknown> {
  const prev = parseInstructionsSent(metadata);
  const at = new Date().toISOString();
  return {
    ...metadata,
    [INSTRUCTIONS_SENT_KEY]: {
      ...prev,
      ...(kind === "pre_op" ? { pre_op_at: at } : { post_op_at: at }),
    },
  };
}

export function bookingDurationMinutes(booking: FiBookingRow): number {
  const ms = new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.round(ms / 60_000);
}

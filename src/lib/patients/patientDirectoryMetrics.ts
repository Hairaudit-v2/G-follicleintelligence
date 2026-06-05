/**
 * Pure metrics for the patient directory (commercial + clinical ops).
 */

import { BOOKING_TYPES } from "@/src/lib/bookings/bookingPolicy";

const TERMINAL_BOOKING = new Set(["cancelled", "completed", "no_show"]);

/** Treatment procedure booking types (excludes consult / review / admin). */
export const PATIENT_PROCEDURE_BOOKING_TYPES = new Set<string>(
  BOOKING_TYPES.filter((t) => !["consultation", "review", "follow_up", "other"].includes(t))
);

export type PatientDirectoryBookingLike = {
  id: string;
  start_at: string;
  booking_status: string;
  booking_type: string;
  title: string | null;
};

const TREATMENT_VALUE_KEYS = ["treatment_value_gbp", "treatment_value", "estimated_value", "deal_value"] as const;

/** Parse GBP treatment value from CRM lead `metadata` (shell convention). */
export function parseTreatmentValueGbp(metadata: Record<string, unknown> | null | undefined): number | null {
  const meta = metadata ?? {};
  for (const k of TREATMENT_VALUE_KEYS) {
    const v = meta[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/[£$,\s]/g, "").trim();
      if (!cleaned) continue;
      const n = Number(cleaned);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return null;
}

/** Sum treatment values across linked leads; null when no values recorded. */
export function sumPatientLifetimeValueGbp(leadMetadatas: readonly Record<string, unknown>[]): number | null {
  let sum = 0;
  let any = false;
  for (const meta of leadMetadatas) {
    const v = parseTreatmentValueGbp(meta);
    if (v == null) continue;
    sum += v;
    any = true;
  }
  return any ? sum : null;
}

export function formatPatientLifetimeValueGbp(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(amount);
}

export function countCompletedProcedures(bookings: readonly PatientDirectoryBookingLike[]): number {
  let n = 0;
  for (const b of bookings) {
    const st = String(b.booking_status ?? "").toLowerCase();
    if (st !== "completed") continue;
    const type = String(b.booking_type ?? "").trim().toLowerCase();
    if (PATIENT_PROCEDURE_BOOKING_TYPES.has(type)) n += 1;
  }
  return n;
}

export function pickNextAppointment(
  bookings: readonly PatientDirectoryBookingLike[],
  nowIso: string
): { id: string; startAt: string; title: string | null } | null {
  const now = Date.parse(nowIso);
  let best: PatientDirectoryBookingLike | null = null;
  for (const b of bookings) {
    const st = String(b.booking_status ?? "").toLowerCase();
    if (TERMINAL_BOOKING.has(st)) continue;
    const t = Date.parse(String(b.start_at));
    if (!Number.isFinite(t) || t < now) continue;
    if (!best || t < Date.parse(best.start_at)) best = b;
  }
  if (!best) return null;
  return { id: best.id, startAt: String(best.start_at), title: best.title };
}

/** Latest attended visit: prefer latest completed booking, else latest past non-terminal booking. */
export function pickLastVisitAt(bookings: readonly PatientDirectoryBookingLike[], nowIso: string): string | null {
  const now = Date.parse(nowIso);
  let lastCompleted: string | null = null;
  let lastPast: string | null = null;
  for (const b of bookings) {
    const st = String(b.booking_status ?? "").toLowerCase();
    const t = Date.parse(String(b.start_at));
    if (!Number.isFinite(t) || t > now) continue;
    if (st === "cancelled" || st === "no_show") continue;
    const iso = String(b.start_at);
    if (st === "completed") {
      if (!lastCompleted || t > Date.parse(lastCompleted)) lastCompleted = iso;
    }
    if (!lastPast || t > Date.parse(lastPast)) lastPast = iso;
  }
  return lastCompleted ?? lastPast;
}

export function truncateClinicalSummary(line: string | null | undefined, max = 48): string {
  const s = line?.trim();
  if (!s) return "—";
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

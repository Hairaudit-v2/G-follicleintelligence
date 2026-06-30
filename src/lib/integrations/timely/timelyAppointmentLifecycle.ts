import type { BookingStatus } from "@/src/lib/bookings/bookingPolicy";

/** Normalized Timely appointment lifecycle events (Zapier / webhook). */
export const TIMELY_APPOINTMENT_LIFECYCLE_EVENTS = [
  "appointment_created",
  "appointment_updated",
  "appointment_cancelled",
  "appointment_completed",
  "appointment_rescheduled",
  "appointment_no_show",
] as const;

export type TimelyAppointmentLifecycleEvent = (typeof TIMELY_APPOINTMENT_LIFECYCLE_EVENTS)[number];

const LIFECYCLE_EVENT_SET = new Set<string>(TIMELY_APPOINTMENT_LIFECYCLE_EVENTS);

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

/** Map Timely status text to FI `booking_status`. */
export function mapTimelyStatusToBookingStatus(
  status: string | undefined | null
): BookingStatus | null {
  const raw = status?.trim();
  if (!raw) return null;

  const token = normalizeToken(raw);

  if (
    token === "cancelled" ||
    token === "canceled" ||
    token === "cancel" ||
    token.includes("cancelled") ||
    token.includes("canceled")
  ) {
    return "cancelled";
  }
  if (
    token === "completed" ||
    token === "complete" ||
    token === "done" ||
    token === "finished" ||
    token.includes("completed")
  ) {
    return "completed";
  }
  if (
    token === "no show" ||
    token === "noshow" ||
    token === "no_show" ||
    token.includes("no show")
  ) {
    return "no_show";
  }
  if (token === "confirmed" || token === "confirm") {
    return "confirmed";
  }
  if (token === "arrived" || token === "checked in" || token.includes("checked in")) {
    return "arrived";
  }
  if (token === "scheduled" || token === "pending" || token === "booked") {
    return "scheduled";
  }
  if (token === "rescheduled" || token === "reschedule") {
    return "scheduled";
  }

  return null;
}

/** Normalize explicit lifecycle event strings from Zapier payloads. */
export function normalizeTimelyLifecycleEventType(
  raw: string | undefined | null
): TimelyAppointmentLifecycleEvent | null {
  const v = raw?.trim();
  if (!v) return null;

  const lower = v.toLowerCase().replace(/[\s-]+/g, "_");

  if (LIFECYCLE_EVENT_SET.has(lower)) {
    return lower as TimelyAppointmentLifecycleEvent;
  }

  const aliases: Record<string, TimelyAppointmentLifecycleEvent> = {
    created: "appointment_created",
    appointment_create: "appointment_created",
    new_appointment: "appointment_created",
    updated: "appointment_updated",
    appointment_update: "appointment_updated",
    modified: "appointment_updated",
    cancelled: "appointment_cancelled",
    canceled: "appointment_cancelled",
    cancel: "appointment_cancelled",
    completed: "appointment_completed",
    complete: "appointment_completed",
    rescheduled: "appointment_rescheduled",
    reschedule: "appointment_rescheduled",
    no_show: "appointment_no_show",
    noshow: "appointment_no_show",
    "no show": "appointment_no_show",
  };

  return aliases[lower] ?? aliases[normalizeToken(v)] ?? null;
}

export function extractTimelyAppointmentEventType(payload: {
  event_type?: string;
  event?: string;
  type?: string;
}): string | null {
  for (const key of ["event_type", "event", "type"] as const) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function inferTimelyAppointmentLifecycleEvent(params: {
  explicitEventType?: string | null;
  status?: string | null;
  hasExistingBooking: boolean;
  startTimeChanged?: boolean;
}): TimelyAppointmentLifecycleEvent {
  const normalized = normalizeTimelyLifecycleEventType(params.explicitEventType ?? null);
  if (normalized) return normalized;

  const mappedStatus = mapTimelyStatusToBookingStatus(params.status ?? null);
  if (mappedStatus === "cancelled") return "appointment_cancelled";
  if (mappedStatus === "completed") return "appointment_completed";
  if (mappedStatus === "no_show") return "appointment_no_show";

  const statusToken = normalizeToken(params.status ?? "");
  if (statusToken === "rescheduled" || statusToken === "reschedule") {
    return "appointment_rescheduled";
  }

  if (params.hasExistingBooking) {
    if (params.startTimeChanged) return "appointment_rescheduled";
    return "appointment_updated";
  }

  return "appointment_created";
}

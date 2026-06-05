import type { ReminderTriggerEvent } from "./reminderConstants";
import type { ReminderTemplateType } from "./reminderConstants";

export const REMINDER_PLACEHOLDER_KEYS = [
  "{{patient_name}}",
  "{{booking_time}}",
  "{{clinic_name}}",
  "{{booking_title}}",
  "{{booking_type}}",
  "{{norwood_summary}}",
] as const;

export type ReminderMergeContext = {
  patient_name?: string;
  /** Human-readable booking window in clinic/patient TZ when available */
  booking_time?: string;
  clinic_name?: string;
  booking_title?: string;
  booking_type?: string;
  /** From {@link formatClinicalScalesSummary} when patient clinical details exist */
  norwood_summary?: string;
};

const PLACEHOLDER_MAP: Record<(typeof REMINDER_PLACEHOLDER_KEYS)[number], keyof ReminderMergeContext> = {
  "{{patient_name}}": "patient_name",
  "{{booking_time}}": "booking_time",
  "{{clinic_name}}": "clinic_name",
  "{{booking_title}}": "booking_title",
  "{{booking_type}}": "booking_type",
  "{{norwood_summary}}": "norwood_summary",
};

/** Maps shorthand template triggers to scheduling keys used by `scheduledAtForBookingTrigger`. */
export type BookingReminderScheduleTrigger = "booking_created" | "booking_48h_before" | "booking_24h_before";

export function toBookingScheduleTrigger(trigger: ReminderTriggerEvent): BookingReminderScheduleTrigger | null {
  switch (trigger) {
    case "booking_created":
      return "booking_created";
    case "booking_48h_before":
    case "booking_48h":
      return "booking_48h_before";
    case "booking_24h_before":
    case "booking_24h":
      return "booking_24h_before";
    default:
      return null;
  }
}

/**
 * Replace known `{{...}}` tokens; unknown tokens are left unchanged.
 */
export function renderReminderText(template: string, ctx: ReminderMergeContext): string {
  let out = template;
  for (const [token, key] of Object.entries(PLACEHOLDER_MAP) as [keyof typeof PLACEHOLDER_MAP, keyof ReminderMergeContext][]) {
    const val = ctx[key];
    if (val === undefined || val === null) continue;
    const s = String(val);
    out = out.split(token).join(s);
  }
  return out;
}

export function scheduledAtForBookingTrigger(params: {
  trigger: BookingReminderScheduleTrigger;
  bookingStartIso: string;
  nowIso: string;
}): string | null {
  const startMs = Date.parse(params.bookingStartIso);
  if (!Number.isFinite(startMs)) return null;
  const nowMs = Date.parse(params.nowIso);
  if (!Number.isFinite(nowMs)) return null;

  switch (params.trigger) {
    case "booking_created":
      return params.nowIso;
    case "booking_48h_before": {
      const t = startMs - 48 * 3_600_000;
      return new Date(Math.max(t, nowMs)).toISOString();
    }
    case "booking_24h_before": {
      const t = startMs - 24 * 3_600_000;
      return new Date(Math.max(t, nowMs)).toISOString();
    }
    default:
      return null;
  }
}

/** Immediate send queue time for non-booking triggers (lead_created, post_consult). */
export function scheduledAtForImmediateTrigger(trigger: ReminderTriggerEvent, nowIso: string): string | null {
  if (trigger === "lead_created" || trigger === "post_consult") return nowIso;
  return null;
}

/**
 * Whether a template channel is allowed for the patient's preference (null = no filter).
 */
export function templateTypeMatchesPreference(
  templateType: ReminderTemplateType,
  preferred: string | null | undefined
): boolean {
  const p = preferred?.trim().toLowerCase() || null;
  if (!p) return true;
  if (p === "both") return true;
  if (p === "email") return templateType === "email";
  if (p === "sms") return templateType === "sms";
  return true;
}

export function bookingStartsAfterNow(bookingStartIso: string, nowMs: number): boolean {
  const startMs = Date.parse(bookingStartIso);
  return Number.isFinite(startMs) && startMs > nowMs;
}

/** One-line hint for calendar cards: next pending/processing reminder for a booking. */
export function formatNextReminderHint(
  jobs: { scheduled_at: string; status: string; template_name?: string; template_type: string }[]
): string | null {
  const pending = jobs
    .filter((j) => j.status === "pending" || j.status === "processing")
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const j = pending[0];
  if (!j) return null;
  const when = new Date(j.scheduled_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  const label = j.template_name?.trim() || "Reminder";
  return `${label} (${j.template_type}) · ${when}`;
}

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ReminderJobStatus } from "@/src/lib/reminders/reminderConstants";
import { REMINDER_JOB_STATUSES } from "@/src/lib/reminders/reminderConstants";
import {
  isDeliveryChannelConfigured,
  type ReminderDeliveryConfig,
} from "@/src/lib/reminders/reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "@/src/lib/reminders/reminderDeliveryConfig.server";
import {
  isReminderLiveDeliveryEnabled,
  isReminderTestSendOverrideEnabled,
  reminderTestEmailOverride,
} from "@/src/lib/reminders/reminderLiveDeliveryPolicy.server";
import { loadReminderTemplatesForTenant } from "@/src/lib/reminders/reminderTemplates.server";
import type { FiReminderTemplateRow } from "@/src/lib/reminders/reminderTypes";

import type {
  CalendarReminderJobListItem,
  CalendarReminderTemplateChecklistItem,
  CalendarReminderTestingPayload,
} from "./calendarTestingTypes";

const CHECKLIST: Omit<CalendarReminderTemplateChecklistItem, "satisfied" | "detail">[] = [
  {
    id: "uat_confirmation",
    label: "Appointment confirmation (immediate queue)",
    expectedTriggers: ["booking_created"],
  },
  {
    id: "uat_48h",
    label: "48-hour reminder",
    expectedTriggers: ["booking_48h_before", "booking_48h"],
  },
  {
    id: "uat_24h",
    label: "24-hour reminder (often used as “day before” copy)",
    expectedTriggers: ["booking_24h_before", "booking_24h"],
  },
  {
    id: "uat_same_day",
    label: "Same-day / morning-of reminder",
    expectedTriggers: [],
  },
  {
    id: "uat_cancel_notice",
    label: "Cancellation notice to patient",
    expectedTriggers: [],
  },
  {
    id: "uat_reschedule_notice",
    label: "Reschedule notice to patient",
    expectedTriggers: [],
  },
  {
    id: "uat_post_appt",
    label: "Post-appointment follow-up (booking-scoped)",
    expectedTriggers: [],
  },
  {
    id: "uat_post_consult",
    label: "Post-consult follow-up (consultation completed)",
    expectedTriggers: ["post_consult"],
  },
];

function templateSatisfies(
  templates: FiReminderTemplateRow[],
  triggers: string[]
): { ok: boolean; detail: string } {
  if (!triggers.length) {
    return {
      ok: false,
      detail:
        "Not supported as a distinct trigger in the current schema — use booking_created / 24h / 48h templates or CRM comms until a migration adds dedicated triggers.",
    };
  }
  const active = templates.filter((t) => t.is_active);
  const hit = active.find((t) => triggers.includes(t.trigger_event));
  if (hit)
    return {
      ok: true,
      detail: `Active template: “${hit.name}” (${hit.type}, ${hit.trigger_event}).`,
    };
  const inactive = templates.find((t) => triggers.includes(t.trigger_event));
  if (inactive)
    return { ok: false, detail: `Template exists but is inactive: “${inactive.name}”.` };
  return { ok: false, detail: `No active template for: ${triggers.join(", ")}.` };
}

function isJobStatus(s: string): s is ReminderJobStatus {
  return (REMINDER_JOB_STATUSES as readonly string[]).includes(s);
}

export async function loadCalendarReminderTestingPayload(
  tenantId: string
): Promise<CalendarReminderTestingPayload> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const deliveryCfg: ReminderDeliveryConfig = loadReminderDeliveryConfig();
  const templates = await loadReminderTemplatesForTenant(tid, supabase);

  const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: jobRows, error: je } = await supabase
    .from("fi_reminder_jobs")
    .select("id, status, scheduled_at, booking_id, template_id, error_log, updated_at")
    .eq("tenant_id", tid)
    .gte("created_at", sinceIso);
  if (je) throw new Error(je.message);

  const stats: Record<ReminderJobStatus, number> = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
  };
  const tplIds = new Set<string>();
  for (const r of jobRows ?? []) {
    const row = r as Record<string, unknown>;
    const st = String(row.status ?? "");
    if (isJobStatus(st)) stats[st] += 1;
    const tidTpl = row.template_id != null ? String(row.template_id) : "";
    if (tidTpl) tplIds.add(tidTpl);
  }

  const { data: tplRows } = await supabase
    .from("fi_reminder_templates")
    .select("id, name, trigger_event")
    .eq("tenant_id", tid)
    .in("id", Array.from(tplIds));
  const tplName = new Map<string, string>();
  const tplTrig = new Map<string, string>();
  for (const t of tplRows ?? []) {
    const tr = t as Record<string, unknown>;
    tplName.set(String(tr.id), String(tr.name ?? ""));
    tplTrig.set(String(tr.id), String(tr.trigger_event ?? ""));
  }

  const mapJob = (
    r: Record<string, unknown>
  ): CalendarReminderJobListItem & { updated_at: string } => ({
    id: String(r.id),
    scheduled_at: String(r.scheduled_at ?? ""),
    template_name: tplName.get(String(r.template_id)) || "—",
    trigger_event: tplTrig.get(String(r.template_id)) || "—",
    booking_id: r.booking_id != null ? String(r.booking_id) : null,
    status: (isJobStatus(String(r.status)) ? String(r.status) : "pending") as ReminderJobStatus,
    error_log: r.error_log != null ? String(r.error_log) : null,
    updated_at: String(r.updated_at ?? ""),
  });

  const allMapped = (jobRows ?? []).map((r) => mapJob(r as Record<string, unknown>));
  const recentFailedJobs: CalendarReminderJobListItem[] = allMapped
    .filter((j) => j.status === "failed")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 8)
    .map(({ id, scheduled_at, template_name, trigger_event, booking_id, status, error_log }) => ({
      id,
      scheduled_at,
      template_name,
      trigger_event,
      booking_id,
      status,
      error_log,
    }));

  const nowMs = Date.now();
  const upcomingJobs: CalendarReminderJobListItem[] = allMapped
    .filter((j) => j.status === "pending" && Date.parse(j.scheduled_at) >= nowMs - 120_000)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 12)
    .map(({ id, scheduled_at, template_name, trigger_event, booking_id, status, error_log }) => ({
      id,
      scheduled_at,
      template_name,
      trigger_event,
      booking_id,
      status,
      error_log,
    }));

  const checklist: CalendarReminderTemplateChecklistItem[] = CHECKLIST.map((c) => {
    if (c.expectedTriggers.length === 0) {
      return {
        ...c,
        satisfied: false,
        detail:
          c.id === "uat_same_day"
            ? "No dedicated same-day trigger in `fi_reminder_templates` yet — use a booking_created template with same-day wording, or add a migration for a new trigger."
            : c.id === "uat_cancel_notice" || c.id === "uat_reschedule_notice"
              ? "No automated patient cancellation/reschedule notice templates in-queue today — pending jobs are superseded on reschedule/cancel; consider CRM outbound or a future trigger."
              : "No booking-scoped post-appointment template — use `post_consult` when a consultation is completed, or CRM follow-up.",
      };
    }
    const { ok, detail } = templateSatisfies(templates, c.expectedTriggers);
    return { ...c, satisfied: ok, detail };
  });

  const live = isReminderLiveDeliveryEnabled();
  const testEmail = reminderTestEmailOverride();
  const testSend = isReminderTestSendOverrideEnabled();

  return {
    liveDeliveryEnabled: live,
    liveDeliveryHelp: live
      ? "Live delivery is enabled (FI_REMINDERS_LIVE_DELIVERY unset or true). Cron will call Resend/Twilio when jobs are due."
      : "Live delivery is OFF (FI_REMINDERS_LIVE_DELIVERY=false). Due jobs are cancelled by the processor without contacting patients — recommended for staging.",
    testSendConfigured: Boolean(testEmail && testSend),
    testSendHelp:
      testSend && testEmail
        ? `Test sends to ${testEmail} are allowed (FI_REMINDERS_TEST_SEND=true).`
        : "Set FI_REMINDERS_TEST_SEND=true and FI_REMINDER_TEST_EMAIL to enable “Send test email” from Calendar UAT (never uses the patient address).",
    emailChannelConfigured: isDeliveryChannelConfigured(deliveryCfg, "email"),
    smsChannelConfigured: isDeliveryChannelConfigured(deliveryCfg, "sms"),
    bookingEnqueueSummary:
      "Jobs enqueue from syncBookingReminderJobs after booking create/update when the row has patient_id, reminder consent, contact for the template channel, delivery keys configured, and start_at is in the future. Cancel/complete/reschedule supersede or skip pending booking jobs.",
    templateChecklist: checklist,
    jobStats: stats,
    recentFailedJobs,
    upcomingJobs,
  };
}

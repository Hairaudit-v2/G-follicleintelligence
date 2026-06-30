import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingForTenant } from "@/src/lib/bookings/server";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadReminderTemplateForTenant } from "@/src/lib/reminders/reminderTemplates.server";
import { buildMergeContext } from "@/src/lib/reminders/reminderBookingMergeContext.server";
import { renderReminderText, type ReminderMergeContext } from "@/src/lib/reminders/remindersCore";

export type ReminderJobPreviewResult = {
  jobId: string;
  templateName: string;
  triggerEvent: string;
  channel: string;
  subject: string | null;
  body: string;
};

/**
 * Renders subject/body for a booking-anchored reminder job (read-only; no delivery).
 * Used by Calendar UAT and operator tooling.
 */
export async function renderBookingReminderJobPreview(
  tenantId: string,
  jobId: string
): Promise<ReminderJobPreviewResult | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const jid = assertNonEmptyUuid(jobId, "jobId");
  const supabase = supabaseAdmin();

  const { data: job, error } = await supabase
    .from("fi_reminder_jobs")
    .select("id, template_id, booking_id, tenant_id")
    .eq("tenant_id", tid)
    .eq("id", jid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) return null;
  const row = job as {
    id: string;
    template_id: string;
    booking_id: string | null;
    tenant_id: string;
  };
  const bid = row.booking_id?.trim();
  if (!bid) return null;

  const template = await loadReminderTemplateForTenant(tid, row.template_id, supabase);
  if (!template) return null;

  const booking = await loadBookingForTenant(tid, bid, supabase);
  if (!booking) return null;

  const merge: ReminderMergeContext = await buildMergeContext(supabase, tid, booking);
  const body = renderReminderText(template.body, merge);
  const subject = template.subject ? renderReminderText(template.subject, merge) : null;

  return {
    jobId: jid,
    templateName: template.name,
    triggerEvent: template.trigger_event,
    channel: template.type,
    subject,
    body,
  };
}

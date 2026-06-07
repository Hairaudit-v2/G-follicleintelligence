"use server";

import { z } from "zod";

import { getBookingsOperatorSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import { isDeliveryChannelConfigured } from "@/src/lib/reminders/reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "@/src/lib/reminders/reminderDeliveryConfig.server";
import { sendTestReminderEmailToOverride } from "@/src/lib/reminders/reminderDelivery.server";
import {
  isReminderTestSendOverrideEnabled,
  reminderTestEmailOverride,
} from "@/src/lib/reminders/reminderLiveDeliveryPolicy.server";
import { loadReminderJobsForBooking } from "@/src/lib/reminders/reminderJobs.server";
import { renderBookingReminderJobPreview } from "@/src/lib/reminders/reminderPreview.server";

const bookingBodySchema = z.object({
  bookingId: z.string().uuid(),
});

const jobBodySchema = z.object({
  jobId: z.string().uuid(),
});

function deny(): { ok: false; error: string } {
  return { ok: false, error: "Not allowed or session expired." };
}

export async function listCalendarReminderJobsForBookingAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      jobs: {
        id: string;
        scheduled_at: string;
        status: string;
        template_name: string;
        template_trigger_event: string;
        template_type: string;
        error_log: string | null;
      }[];
    }
  | { ok: false; error: string }
> {
  const tid = tenantId.trim();
  const session = await getBookingsOperatorSessionIfAllowed(tid);
  if (!session) return deny();
  const parsed = bookingBodySchema.safeParse(body ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid booking id." };
  try {
    const jobs = await loadReminderJobsForBooking(tid, parsed.data.bookingId);
    return {
      ok: true,
      jobs: jobs.map((j) => ({
        id: j.id,
        scheduled_at: j.scheduled_at,
        status: j.status,
        template_name: j.template_name,
        template_trigger_event: j.template_trigger_event,
        template_type: j.template_type,
        error_log: j.error_log,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function previewCalendarBookingReminderJobAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      preview: {
        jobId: string;
        templateName: string;
        triggerEvent: string;
        channel: string;
        subject: string | null;
        body: string;
      };
    }
  | { ok: false; error: string }
> {
  const tid = tenantId.trim();
  const session = await getBookingsOperatorSessionIfAllowed(tid);
  if (!session) return deny();
  const parsed = jobBodySchema.safeParse(body ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid job id." };
  try {
    const p = await renderBookingReminderJobPreview(tid, parsed.data.jobId);
    if (!p) return { ok: false, error: "Job not found or not a booking-anchored reminder." };
    return { ok: true, preview: p };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Sends rendered copy to `FI_REMINDER_TEST_EMAIL` only when `FI_REMINDERS_TEST_SEND=true`.
 * Never uses the patient address. Email templates only.
 */
export async function sendTestCalendarBookingReminderEmailAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const tid = tenantId.trim();
  const session = await getBookingsOperatorSessionIfAllowed(tid);
  if (!session) return deny();
  const parsed = jobBodySchema.safeParse(body ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid job id." };

  if (!isReminderTestSendOverrideEnabled()) {
    return {
      ok: false,
      error: "Test send is disabled. Set FI_REMINDERS_TEST_SEND=true and FI_REMINDER_TEST_EMAIL in the server environment.",
    };
  }
  const to = reminderTestEmailOverride();
  if (!to) {
    return { ok: false, error: "FI_REMINDER_TEST_EMAIL is not set." };
  }

  const cfg = loadReminderDeliveryConfig();
  if (!isDeliveryChannelConfigured(cfg, "email")) {
    return { ok: false, error: "Email delivery is not configured (Resend API key / from address)." };
  }

  try {
    const p = await renderBookingReminderJobPreview(tid, parsed.data.jobId);
    if (!p) return { ok: false, error: "Job not found or not a booking-anchored reminder." };
    if (p.channel !== "email") {
      return { ok: false, error: "Test send from Calendar UAT supports email templates only (this job is SMS)." };
    }
    await sendTestReminderEmailToOverride({
      cfg,
      to,
      subject: p.subject ?? "Appointment reminder (test)",
      body: p.body,
    });
    return { ok: true, message: `Sent test email to ${to} via Resend.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

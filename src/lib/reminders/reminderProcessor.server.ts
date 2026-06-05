import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingForTenant } from "@/src/lib/bookings/server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { CRM_LEAD_COMMUNICATION_MAX_PREVIEW } from "@/src/lib/crm/crmLeadCommunicationPolicy";
import { createCrmLeadCommunication } from "@/src/lib/crm/leadCommunications";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { renderReminderText, type ReminderMergeContext } from "./remindersCore";
import { loadReminderTemplateForTenant } from "./reminderTemplates.server";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function buildMergeContext(
  supabase: SupabaseClient,
  tenantId: string,
  booking: FiBookingRow
): Promise<ReminderMergeContext> {
  const ctx: ReminderMergeContext = {
    booking_title: booking.title?.trim() || "Appointment",
    booking_type: booking.booking_type,
  };

  if (booking.clinic_id?.trim()) {
    const { data } = await supabase
      .from("fi_clinics")
      .select("name")
      .eq("tenant_id", tenantId.trim())
      .eq("id", booking.clinic_id.trim())
      .maybeSingle();
    const name = (data as { name?: string } | null)?.name?.trim();
    if (name) ctx.clinic_name = name;
  }

  const tz = booking.timezone?.trim() || undefined;
  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
    const df = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: tz,
    });
    ctx.booking_time = `${df.format(start)} – ${df.format(end)}`;
  } else {
    ctx.booking_time = booking.start_at;
  }

  if (booking.patient_id?.trim()) {
    const { data: pat } = await supabase
      .from("fi_patients")
      .select("person_id")
      .eq("tenant_id", tenantId.trim())
      .eq("id", booking.patient_id.trim())
      .maybeSingle();
    const pid = (pat as { person_id?: string } | null)?.person_id?.trim();
    if (pid) {
      const { data: person } = await supabase
        .from("fi_persons")
        .select("metadata")
        .eq("tenant_id", tenantId.trim())
        .eq("id", pid)
        .maybeSingle();
      const meta = (person as { metadata?: Record<string, unknown> } | null)?.metadata;
      const label = personMetadataDisplayLabel(meta ?? {});
      if (label.trim()) ctx.patient_name = label;
    }
  }

  if (!ctx.patient_name?.trim()) {
    ctx.patient_name = "Patient";
  }

  return ctx;
}

async function claimReminderJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<{ id: string; tenant_id: string; template_id: string; booking_id: string | null; lead_id: string | null; attempt_count: number } | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .update({ status: "processing", last_attempt_at: nowIso, updated_at: nowIso })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("id, tenant_id, template_id, booking_id, lead_id, attempt_count")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    template_id: String(row.template_id),
    booking_id: row.booking_id != null ? String(row.booking_id) : null,
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    attempt_count: Number(row.attempt_count ?? 0),
  };
}

/**
 * Picks due pending jobs, claims them, renders templates, stubs outbound send, logs to CRM when a lead is anchored.
 * One retry on failure (`attempt_count` 0 → 1 pending; second failure → `failed`).
 */
export async function processReminderJobsOnce(opts?: {
  limit?: number;
  client?: SupabaseClient;
}): Promise<{ claimed: number; sent: number; failed: number; retried: number }> {
  const supabase = opts?.client ?? supabaseAdmin();
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 100);
  const nowIso = new Date().toISOString();

  const { data: due, error: qe } = await supabase
    .from("fi_reminder_jobs")
    .select("id")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (qe) throw new Error(qe.message);

  let sent = 0;
  let failed = 0;
  let retried = 0;
  let claimed = 0;

  for (const raw of due ?? []) {
    const jobId = String((raw as { id: string }).id);
    const row = await claimReminderJob(supabase, jobId);
    if (!row) continue;
    claimed += 1;

    try {
      assertNonEmptyUuid(row.tenant_id, "tenantId");
      const template = await loadReminderTemplateForTenant(row.tenant_id, row.template_id, supabase);
      if (!template) throw new Error("Template missing.");

      if (!row.booking_id) throw new Error("Booking anchor missing.");
      const booking = await loadBookingForTenant(row.tenant_id, row.booking_id, supabase);
      if (!booking) throw new Error("Booking missing.");
      if (booking.booking_status === "cancelled" || booking.booking_status === "completed") {
        throw new Error(`Booking is ${booking.booking_status}; skip.`);
      }

      const merge = await buildMergeContext(supabase, row.tenant_id, booking);
      const body = renderReminderText(template.body, merge);
      const subject = template.subject ? renderReminderText(template.subject, merge) : null;

      // Stub transport (Twilio / ESP integration deferred).
      console.log(
        `[fi_reminder_jobs] stub send tenant=${row.tenant_id} job=${row.id} type=${template.type} to=(patient channel TBD) body=${truncate(body, 160)}`
      );

      if (row.lead_id) {
        const preview = truncate(body, CRM_LEAD_COMMUNICATION_MAX_PREVIEW);
        await createCrmLeadCommunication(
          {
            tenantId: row.tenant_id,
            leadId: row.lead_id,
            communicationType: template.type === "sms" ? "sms" : "email",
            direction: "outbound",
            outcome: null,
            subject: subject ? truncate(subject, 200) : null,
            preview,
            metadata: { source: "fi_reminder_jobs", job_id: row.id, booking_id: row.booking_id },
          },
          supabase
        );
      }

      const doneIso = new Date().toISOString();
      const { error: ue } = await supabase
        .from("fi_reminder_jobs")
        .update({
          status: "sent",
          delivered_at: doneIso,
          error: null,
          updated_at: doneIso,
        })
        .eq("id", row.id)
        .eq("status", "processing");
      if (ue) throw new Error(ue.message);
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const nextAttempt = row.attempt_count + 1;
      const doneIso = new Date().toISOString();
      if (nextAttempt >= 2) {
        const { error: fe } = await supabase
          .from("fi_reminder_jobs")
          .update({
            status: "failed",
            error: truncate(msg, 2000),
            attempt_count: nextAttempt,
            updated_at: doneIso,
          })
          .eq("id", row.id)
          .eq("status", "processing");
        if (fe) console.error("[processReminderJobsOnce] failed update", fe.message);
        failed += 1;
      } else {
        const { error: re } = await supabase
          .from("fi_reminder_jobs")
          .update({
            status: "pending",
            error: truncate(msg, 2000),
            attempt_count: nextAttempt,
            updated_at: doneIso,
          })
          .eq("id", row.id)
          .eq("status", "processing");
        if (re) console.error("[processReminderJobsOnce] retry update", re.message);
        retried += 1;
      }
    }
  }

  return { claimed, sent, failed, retried };
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingForTenant } from "@/src/lib/bookings/server";
import { CRM_LEAD_COMMUNICATION_MAX_PREVIEW } from "@/src/lib/crm/crmLeadCommunicationPolicy";
import { createCrmLeadCommunication } from "@/src/lib/crm/leadCommunications";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { ReminderTriggerEvent } from "./reminderConstants";
import {
  buildMergeContext,
  appendClinicalSummaryToContext,
} from "./reminderBookingMergeContext.server";
import { sendReminderDelivery } from "./reminderDelivery.server";
import { isReminderLiveDeliveryEnabled } from "./reminderLiveDeliveryPolicy.server";
import { renderReminderText, type ReminderMergeContext } from "./remindersCore";
import {
  loadPatientReminderContact,
  patientHasContactForTemplateType,
} from "./reminderPatientContact.server";
import { loadReminderTemplateForTenant } from "./reminderTemplates.server";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function buildMergeContextForLeadAnchoredJob(
  supabase: SupabaseClient,
  tenantId: string,
  params: {
    leadId: string | null;
    personId: string | null;
    patientId: string | null;
  },
  trigger: ReminderTriggerEvent
): Promise<ReminderMergeContext> {
  const ctx: ReminderMergeContext = {
    booking_title: trigger === "post_consult" ? "Consultation follow-up" : "Your enquiry",
    booking_type: trigger === "post_consult" ? "consultation" : "crm_lead",
    booking_time:
      trigger === "post_consult"
        ? "Following your recent consultation"
        : "Recent activity with our team",
  };

  if (params.leadId?.trim()) {
    const { data: lead } = await supabase
      .from("fi_crm_leads")
      .select("summary, clinic_id")
      .eq("tenant_id", tenantId.trim())
      .eq("id", params.leadId.trim())
      .maybeSingle();
    const lr = lead as { summary?: string | null; clinic_id?: string | null } | null;
    if (lr?.summary?.trim()) ctx.patient_name = lr.summary.trim();
    if (lr?.clinic_id?.trim()) {
      const { data: cl } = await supabase
        .from("fi_clinics")
        .select("display_name")
        .eq("tenant_id", tenantId.trim())
        .eq("id", lr.clinic_id.trim())
        .maybeSingle();
      const cn = (cl as { display_name?: string } | null)?.display_name?.trim();
      if (cn) ctx.clinic_name = cn;
    }
  }

  if (!ctx.patient_name?.trim() && params.personId?.trim()) {
    const { data: person } = await supabase
      .from("fi_persons")
      .select("metadata")
      .eq("tenant_id", tenantId.trim())
      .eq("id", params.personId.trim())
      .maybeSingle();
    const meta = (person as { metadata?: Record<string, unknown> } | null)?.metadata;
    const label = personMetadataDisplayLabel(meta ?? {});
    if (label.trim()) ctx.patient_name = label;
  }

  if (params.patientId?.trim()) {
    await appendClinicalSummaryToContext(supabase, tenantId, params.patientId.trim(), ctx);
  }

  if (!ctx.patient_name?.trim()) ctx.patient_name = "Patient";

  return ctx;
}

async function finalizeJobSent(
  supabase: SupabaseClient,
  jobId: string,
  doneIso: string
): Promise<void> {
  const { error: ue } = await supabase
    .from("fi_reminder_jobs")
    .update({
      status: "sent",
      delivered_at: doneIso,
      error_log: null,
      updated_at: doneIso,
    })
    .eq("id", jobId)
    .eq("status", "processing");
  if (ue) throw new Error(ue.message);
}

async function finalizeJobCancelled(
  supabase: SupabaseClient,
  jobId: string,
  reason: string,
  doneIso: string
): Promise<void> {
  const { error } = await supabase
    .from("fi_reminder_jobs")
    .update({
      status: "cancelled",
      error_log: truncate(reason, 2000),
      updated_at: doneIso,
    })
    .eq("id", jobId)
    .eq("status", "processing");
  if (error) console.error("[finalizeJobCancelled]", error.message);
}

async function claimReminderJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<{
  id: string;
  tenant_id: string;
  template_id: string;
  booking_id: string | null;
  lead_id: string | null;
  person_id: string | null;
  attempt_count: number;
  metadata: Record<string, unknown>;
} | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .update({ status: "processing", last_attempt_at: nowIso, updated_at: nowIso })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("id, tenant_id, template_id, booking_id, lead_id, person_id, attempt_count, metadata")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const rawMeta = row.metadata;
  const metadata =
    rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
      ? (rawMeta as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    template_id: String(row.template_id),
    booking_id: row.booking_id != null ? String(row.booking_id) : null,
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    person_id: row.person_id != null ? String(row.person_id) : null,
    attempt_count: Number(row.attempt_count ?? 0),
    metadata,
  };
}

function isNonBookingReminderTrigger(t: ReminderTriggerEvent): boolean {
  return t === "lead_created" || t === "post_consult";
}

async function resolvePatientIdForJob(
  supabase: SupabaseClient,
  tenantId: string,
  row: {
    booking_id: string | null;
    lead_id: string | null;
    metadata: Record<string, unknown>;
  }
): Promise<string | null> {
  const metaPid = row.metadata.patient_id;
  if (typeof metaPid === "string" && metaPid.trim()) return metaPid.trim();

  if (row.booking_id?.trim()) {
    const booking = await loadBookingForTenant(tenantId, row.booking_id, supabase);
    const pid = booking?.patient_id?.trim();
    if (pid) return pid;
  }

  if (row.lead_id?.trim()) {
    const { data: leadRow } = await supabase
      .from("fi_crm_leads")
      .select("patient_id")
      .eq("tenant_id", tenantId.trim())
      .eq("id", row.lead_id.trim())
      .maybeSingle();
    const pr = (leadRow as { patient_id?: string | null } | null)?.patient_id;
    if (pr?.trim()) return pr.trim();
  }

  return null;
}

function isNonRetryableDeliveryError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("no email on file") ||
    m.includes("no valid phone on file") ||
    m.includes("reminder body is empty")
  );
}

/**
 * Picks due pending jobs, claims them, renders templates, sends via Resend/Twilio, logs to CRM when a lead is anchored.
 * One retry on failure (`attempt_count` 0 → 1 pending; second failure → `failed`).
 * Ineligible bookings or missing patient contact → `cancelled` (no retry).
 */
export async function processReminderJobsOnce(opts?: {
  limit?: number;
  client?: SupabaseClient;
}): Promise<{ claimed: number; sent: number; failed: number; retried: number; cancelled: number }> {
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
  let cancelled = 0;

  for (const raw of due ?? []) {
    const jobId = String((raw as { id: string }).id);
    const row = await claimReminderJob(supabase, jobId);
    if (!row) continue;
    claimed += 1;

    try {
      assertNonEmptyUuid(row.tenant_id, "tenantId");
      const template = await loadReminderTemplateForTenant(
        row.tenant_id,
        row.template_id,
        supabase
      );
      if (!template) throw new Error("Template missing.");

      let merge: ReminderMergeContext;

      if (!row.booking_id && isNonBookingReminderTrigger(template.trigger_event)) {
        let resolvedPatientId: string | null = null;
        if (row.lead_id?.trim()) {
          const { data: leadRow } = await supabase
            .from("fi_crm_leads")
            .select("patient_id")
            .eq("tenant_id", row.tenant_id.trim())
            .eq("id", row.lead_id.trim())
            .maybeSingle();
          const pr = (leadRow as { patient_id?: string | null } | null)?.patient_id;
          if (pr?.trim()) resolvedPatientId = pr.trim();
        }
        const metaPid = row.metadata.patient_id;
        if (!resolvedPatientId && typeof metaPid === "string" && metaPid.trim()) {
          resolvedPatientId = metaPid.trim();
        }

        merge = await buildMergeContextForLeadAnchoredJob(
          supabase,
          row.tenant_id,
          {
            leadId: row.lead_id,
            personId: row.person_id,
            patientId: resolvedPatientId,
          },
          template.trigger_event
        );
      } else {
        if (!row.booking_id) throw new Error("Booking anchor missing for this template.");
        const booking = await loadBookingForTenant(row.tenant_id, row.booking_id, supabase);
        if (!booking) throw new Error("Booking missing.");
        if (booking.booking_status === "cancelled" || booking.booking_status === "completed") {
          await finalizeJobCancelled(
            supabase,
            row.id,
            `Booking is ${booking.booking_status}; reminder not sent.`,
            nowIso
          );
          cancelled += 1;
          continue;
        }

        merge = await buildMergeContext(supabase, row.tenant_id, booking);
      }

      const body = renderReminderText(template.body, merge);
      const subject = template.subject ? renderReminderText(template.subject, merge) : null;

      const patientId = await resolvePatientIdForJob(supabase, row.tenant_id, row);
      if (!patientId) {
        await finalizeJobCancelled(
          supabase,
          row.id,
          "Patient anchor missing; reminder not sent.",
          nowIso
        );
        cancelled += 1;
        continue;
      }

      const contact = await loadPatientReminderContact(supabase, row.tenant_id, patientId);
      if (!contact || !patientHasContactForTemplateType(contact, template.type)) {
        await finalizeJobCancelled(
          supabase,
          row.id,
          `Patient has no ${template.type} contact on file; reminder not sent.`,
          nowIso
        );
        cancelled += 1;
        continue;
      }

      if (!isReminderLiveDeliveryEnabled()) {
        await finalizeJobCancelled(
          supabase,
          row.id,
          "Live reminder delivery disabled (FI_REMINDERS_LIVE_DELIVERY=false). No SMS/email was sent.",
          nowIso
        );
        cancelled += 1;
        continue;
      }

      const delivery = await sendReminderDelivery({
        type: template.type,
        contact,
        subject,
        body,
      });

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
            metadata: {
              source: "fi_reminder_jobs",
              job_id: row.id,
              booking_id: row.booking_id,
              trigger: template.trigger_event,
              provider: delivery.provider,
              external_id: delivery.externalId,
            },
          },
          supabase
        );
      }

      const doneIso = new Date().toISOString();
      await finalizeJobSent(supabase, row.id, doneIso);
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const nextAttempt = row.attempt_count + 1;
      const doneIso = new Date().toISOString();
      if (isNonRetryableDeliveryError(msg)) {
        await finalizeJobCancelled(supabase, row.id, msg, doneIso);
        cancelled += 1;
        continue;
      }
      if (nextAttempt >= 2) {
        const { error: fe } = await supabase
          .from("fi_reminder_jobs")
          .update({
            status: "failed",
            error_log: truncate(msg, 2000),
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
            error_log: truncate(msg, 2000),
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

  return { claimed, sent, failed, retried, cancelled };
}

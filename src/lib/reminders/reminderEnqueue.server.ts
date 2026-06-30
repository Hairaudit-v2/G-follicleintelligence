import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";
import { loadReminderTemplatesForTenant } from "./reminderTemplates.server";
import { cancelPendingReminderJobsForBooking } from "./reminderJobs.server";
import {
  bookingStartsAfterNow,
  scheduledAtForBookingTrigger,
  scheduledAtForImmediateTrigger,
  templateTypeMatchesPreference,
  toBookingScheduleTrigger,
} from "./remindersCore";
import { isDeliveryChannelConfigured } from "./reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "./reminderDeliveryConfig.server";
import {
  loadPatientReminderContact,
  patientHasContactForTemplateType,
} from "./reminderPatientContact.server";

function bookingIsReminderEligible(row: FiBookingRow): boolean {
  if (
    row.booking_status === "cancelled" ||
    row.booking_status === "completed" ||
    row.booking_status === "no_show"
  ) {
    return false;
  }
  return true;
}

async function loadPatientReminderPrefs(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<{ consent: boolean; preferred_contact_method: string | null } | null> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("reminder_consent, preferred_contact_method")
    .eq("tenant_id", tenantId.trim())
    .eq("id", patientId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    consent: Boolean(r.reminder_consent),
    preferred_contact_method:
      r.preferred_contact_method != null ? String(r.preferred_contact_method) : null,
  };
}

/**
 * Rebuilds pending `fi_reminder_jobs` for a booking from active templates when the patient has opted in.
 * Best-effort: failures are swallowed (booking flow must not break).
 */
export async function syncBookingReminderJobs(
  booking: FiBookingRow,
  client?: SupabaseClient
): Promise<void> {
  try {
    const supabase = client ?? supabaseAdmin();
    const tid = assertNonEmptyUuid(booking.tenant_id, "tenantId");
    const bid = assertNonEmptyUuid(booking.id, "bookingId");

    await cancelPendingReminderJobsForBooking(tid, bid, "superseded_by_resync", supabase);

    if (!bookingIsReminderEligible(booking)) return;

    const patientId = booking.patient_id?.trim();
    if (!patientId) return;

    const prefs = await loadPatientReminderPrefs(supabase, tid, patientId);
    if (!prefs?.consent) return;

    if (!bookingStartsAfterNow(booking.start_at, Date.now())) {
      return;
    }

    const deliveryCfg = loadReminderDeliveryConfig();
    const contact = await loadPatientReminderContact(supabase, tid, patientId);
    if (!contact) return;

    const templates = (await loadReminderTemplatesForTenant(tid, supabase)).filter((t) => {
      if (!t.is_active) return false;
      return toBookingScheduleTrigger(t.trigger_event) != null;
    });

    const nowIso = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];

    for (const tpl of templates) {
      if (!isDeliveryChannelConfigured(deliveryCfg, tpl.type)) continue;
      if (!patientHasContactForTemplateType(contact, tpl.type)) continue;
      if (!templateTypeMatchesPreference(tpl.type, prefs.preferred_contact_method)) continue;
      const schedKey = toBookingScheduleTrigger(tpl.trigger_event);
      if (!schedKey) continue;
      const scheduledAt = scheduledAtForBookingTrigger({
        trigger: schedKey,
        bookingStartIso: booking.start_at,
        nowIso,
      });
      if (!scheduledAt) continue;

      rows.push({
        tenant_id: tid,
        template_id: tpl.id,
        booking_id: bid,
        person_id: booking.person_id?.trim() || null,
        lead_id: booking.lead_id?.trim() || null,
        scheduled_at: scheduledAt,
        status: "pending",
        attempt_count: 0,
        metadata: { entity_type: "booking", entity_id: bid, patient_id: patientId },
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    if (!rows.length) return;

    const { error } = await supabase.from("fi_reminder_jobs").insert(rows);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[syncBookingReminderJobs]", msg);
  }
}

/**
 * Enqueues `lead_created` templates once per new lead when the linked patient has reminder consent.
 */
export async function syncLeadCreatedReminderJobs(
  lead: FiCrmLeadRow,
  client?: SupabaseClient
): Promise<void> {
  try {
    const supabase = client ?? supabaseAdmin();
    const tid = assertNonEmptyUuid(lead.tenant_id, "tenantId");
    const lid = assertNonEmptyUuid(lead.id, "leadId");
    const patientId = lead.patient_id?.trim();
    if (!patientId) return;

    const prefs = await loadPatientReminderPrefs(supabase, tid, patientId);
    if (!prefs?.consent) return;

    const deliveryCfg = loadReminderDeliveryConfig();
    const contact = await loadPatientReminderContact(supabase, tid, patientId);
    if (!contact) return;

    const templates = (await loadReminderTemplatesForTenant(tid, supabase)).filter(
      (t) => t.is_active && t.trigger_event === "lead_created"
    );

    const nowIso = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];

    for (const tpl of templates) {
      if (!isDeliveryChannelConfigured(deliveryCfg, tpl.type)) continue;
      if (!patientHasContactForTemplateType(contact, tpl.type)) continue;
      if (!templateTypeMatchesPreference(tpl.type, prefs.preferred_contact_method)) continue;
      const scheduledAt = scheduledAtForImmediateTrigger(tpl.trigger_event, nowIso);
      if (!scheduledAt) continue;
      rows.push({
        tenant_id: tid,
        template_id: tpl.id,
        booking_id: null,
        person_id: lead.person_id?.trim() || null,
        lead_id: lid,
        scheduled_at: scheduledAt,
        status: "pending",
        attempt_count: 0,
        metadata: { entity_type: "lead", entity_id: lid, patient_id: patientId },
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    if (!rows.length) return;
    const { error } = await supabase.from("fi_reminder_jobs").insert(rows);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[syncLeadCreatedReminderJobs]", msg);
  }
}

/**
 * Fires `post_consult` templates when a consultation is marked completed (patient consent required).
 */
export async function syncPostConsultReminderJobs(
  consultation: ConsultationRow,
  client?: SupabaseClient
): Promise<void> {
  try {
    const supabase = client ?? supabaseAdmin();
    const tid = assertNonEmptyUuid(consultation.tenant_id, "tenantId");
    const patientId = consultation.patient_id?.trim();
    if (!patientId) return;

    const prefs = await loadPatientReminderPrefs(supabase, tid, patientId);
    if (!prefs?.consent) return;

    const deliveryCfg = loadReminderDeliveryConfig();
    const contact = await loadPatientReminderContact(supabase, tid, patientId);
    if (!contact) return;

    const templates = (await loadReminderTemplatesForTenant(tid, supabase)).filter(
      (t) => t.is_active && t.trigger_event === "post_consult"
    );

    const nowIso = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];

    for (const tpl of templates) {
      if (!isDeliveryChannelConfigured(deliveryCfg, tpl.type)) continue;
      if (!patientHasContactForTemplateType(contact, tpl.type)) continue;
      if (!templateTypeMatchesPreference(tpl.type, prefs.preferred_contact_method)) continue;
      const scheduledAt = scheduledAtForImmediateTrigger(tpl.trigger_event, nowIso);
      if (!scheduledAt) continue;
      rows.push({
        tenant_id: tid,
        template_id: tpl.id,
        booking_id: null,
        person_id: consultation.person_id?.trim() || null,
        lead_id: consultation.lead_id?.trim() || null,
        scheduled_at: scheduledAt,
        status: "pending",
        attempt_count: 0,
        metadata: {
          entity_type: "consultation",
          entity_id: consultation.id,
          consultation_id: consultation.id,
          patient_id: patientId,
        },
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    if (!rows.length) return;
    const { error } = await supabase.from("fi_reminder_jobs").insert(rows);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[syncPostConsultReminderJobs]", msg);
  }
}

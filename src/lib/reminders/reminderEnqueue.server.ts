import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadReminderTemplatesForTenant } from "./reminderTemplates.server";
import { deletePendingReminderJobsForBooking } from "./reminderJobs.server";
import { scheduledAtForBookingTrigger, templateTypeMatchesPreference, bookingStartsAfterNow } from "./remindersCore";
import type { ReminderTriggerEvent } from "./reminderConstants";

const BOOKING_TRIGGERS: ReminderTriggerEvent[] = [
  "booking_created",
  "booking_48h_before",
  "booking_24h_before",
];

function bookingIsReminderEligible(row: FiBookingRow): boolean {
  if (row.booking_status === "cancelled" || row.booking_status === "completed" || row.booking_status === "no_show") {
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
    preferred_contact_method: r.preferred_contact_method != null ? String(r.preferred_contact_method) : null,
  };
}

/**
 * Rebuilds pending `fi_reminder_jobs` for a booking from active templates when the patient has opted in.
 * Best-effort: failures are swallowed (booking flow must not break).
 */
export async function syncBookingReminderJobs(booking: FiBookingRow, client?: SupabaseClient): Promise<void> {
  try {
    const supabase = client ?? supabaseAdmin();
    const tid = assertNonEmptyUuid(booking.tenant_id, "tenantId");
    const bid = assertNonEmptyUuid(booking.id, "bookingId");

    await deletePendingReminderJobsForBooking(tid, bid, supabase);

    if (!bookingIsReminderEligible(booking)) return;

    const patientId = booking.patient_id?.trim();
    if (!patientId) return;

    const prefs = await loadPatientReminderPrefs(supabase, tid, patientId);
    if (!prefs?.consent) return;

    if (!bookingStartsAfterNow(booking.start_at, Date.now())) {
      return;
    }

    const templates = (await loadReminderTemplatesForTenant(tid, supabase)).filter(
      (t) => t.is_active && BOOKING_TRIGGERS.includes(t.trigger_event)
    );

    const nowIso = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];

    for (const tpl of templates) {
      if (!templateTypeMatchesPreference(tpl.type, prefs.preferred_contact_method)) continue;
      const scheduledAt = scheduledAtForBookingTrigger({
        trigger: tpl.trigger_event,
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
        metadata: {},
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

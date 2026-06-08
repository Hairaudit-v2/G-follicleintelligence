import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { formatBookingWindowInTimezone, normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import type { ReminderMergeContext } from "./remindersCore";

export async function appendClinicalSummaryToContext(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  ctx: ReminderMergeContext
): Promise<void> {
  const { data } = await supabase
    .from("fi_patient_clinical_details")
    .select("norwood_scale, ludwig_scale, hairline_pattern, primary_concern")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .maybeSingle();
  const r = data as {
    norwood_scale?: string | null;
    ludwig_scale?: string | null;
    hairline_pattern?: string | null;
    primary_concern?: string | null;
  } | null;
  if (!r) return;
  const summary = formatClinicalScalesSummary({
    norwood_scale: r.norwood_scale ?? null,
    ludwig_scale: r.ludwig_scale ?? null,
    hairline_pattern: r.hairline_pattern ?? null,
    primary_concern: r.primary_concern ?? null,
  });
  if (summary?.trim()) ctx.norwood_summary = summary;
}

export async function buildMergeContext(
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
      .select("display_name")
      .eq("tenant_id", tenantId.trim())
      .eq("id", booking.clinic_id.trim())
      .maybeSingle();
    const name = (data as { display_name?: string } | null)?.display_name?.trim();
    if (name) ctx.clinic_name = name;
  }

  const tzKey = normalizeCalendarTimezone(booking.timezone?.trim() || null);
  ctx.booking_time = formatBookingWindowInTimezone(booking.start_at, booking.end_at, tzKey);

  if (booking.patient_id?.trim()) {
    await appendClinicalSummaryToContext(supabase, tenantId, booking.patient_id.trim(), ctx);
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

import type { SupabaseClient } from "@supabase/supabase-js";

export type AppendPatientTimelineEventInput = {
  tenantId: string;
  patientId: string | null;
  personId: string | null;
  crmLeadId: string | null;
  source: string;
  eventType: string;
  /** ISO 8601 timestamp of the activity. */
  eventTimestamp: string;
  title: string | null;
  description: string | null;
  /** Stable idempotency key; stored in metadata and enforced by uq_fi_patient_timeline_dedupe. */
  dedupeKey: string;
  metadata?: Record<string, unknown>;
};

export type AppendPatientTimelineEventResult = {
  inserted: boolean;
  /** Set when a new row was inserted. */
  id: string | null;
};

/**
 * Append-only insert of an external activity into fi_patient_timeline. Never updates an existing
 * patient/person/lead row. Idempotent: a duplicate (same tenant+source+event_type+dedupe_key) is a
 * no-op via the unique index (23505 swallowed).
 */
export async function appendPatientTimelineEvent(
  supabase: SupabaseClient,
  input: AppendPatientTimelineEventInput
): Promise<AppendPatientTimelineEventResult> {
  if (!input.patientId && !input.personId && !input.crmLeadId) {
    throw new Error(
      "appendPatientTimelineEvent requires at least one anchor (patient/person/lead)."
    );
  }

  const metadata = {
    ...(input.metadata ?? {}),
    dedupe_key: input.dedupeKey,
  };

  const { data, error } = await supabase
    .from("fi_patient_timeline")
    .insert({
      tenant_id: input.tenantId.trim(),
      patient_id: input.patientId,
      person_id: input.personId,
      crm_lead_id: input.crmLeadId,
      source: input.source,
      event_type: input.eventType,
      event_timestamp: input.eventTimestamp,
      title: input.title,
      description: input.description,
      metadata,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    // Duplicate delivery — already on the timeline.
    return { inserted: false, id: null };
  }
  if (error) throw new Error(error.message);

  return { inserted: true, id: data ? String((data as { id: string }).id) : null };
}

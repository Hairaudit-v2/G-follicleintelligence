import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata } from "./internal";
import type {
  CreateTimelineEventInput,
  CreateTimelineEventResult,
  FoundationSupabase,
} from "./types";

/**
 * Inserts a curated fi_timeline_events row. Dedupes when fi_event_id + case + kind + tenant match an existing row.
 * Does not write to fi_events.
 */
export async function createTimelineEvent(
  input: CreateTimelineEventInput,
  client?: FoundationSupabase
): Promise<CreateTimelineEventResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = input.tenant_id.trim();
  const caseId = input.case_id.trim();
  const eventKind = input.event_type.trim();
  const patientId = (input.patient_id ?? input.foundation_patient_id)?.trim() || null;
  const occurredAt = input.occurred_at?.trim() || new Date().toISOString();

  if (input.fi_event_id?.trim()) {
    const dup = await supabase
      .from("fi_timeline_events")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("case_id", caseId)
      .eq("event_kind", eventKind)
      .eq("fi_event_id", input.fi_event_id.trim())
      .maybeSingle();
    if (dup.error) throw new Error(dup.error.message);
    if (dup.data?.id) {
      return { id: String(dup.data.id), created: false };
    }
  }

  const detail = shallowMergeMetadata(
    {
      ...(input.description ? { description: input.description } : {}),
      ...(input.metadata ?? {}),
      ...(input.person_id ? { person_id: input.person_id } : {}),
      ...(input.clinic_id ? { clinic_id: input.clinic_id } : {}),
      ...(input.source_system ? { source_system: input.source_system } : {}),
    },
    null
  );

  const inserted = await supabase
    .from("fi_timeline_events")
    .insert({
      tenant_id: tenantId,
      case_id: caseId,
      patient_id: patientId,
      organisation_id: input.organisation_id?.trim() || null,
      event_kind: eventKind,
      title: input.title,
      detail: Object.keys(detail).length ? detail : null,
      occurred_at: occurredAt,
      fi_event_id: input.fi_event_id?.trim() || null,
    })
    .select("id")
    .single();

  if (inserted.error) throw new Error(inserted.error.message);
  return { id: String((inserted.data as { id: string }).id), created: true };
}

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isFiClinicalIntelligenceSignalKey,
  type FiClinicalIntelligenceSignalKey,
} from "@/src/config/fiClinicalIntelligenceSignals";
import {
  recordClinicalIntelligenceEventInputSchema,
  type RecordClinicalIntelligenceEventInput,
} from "@/src/lib/fi-os/clinicalIntelligenceEventsSchema";

export {
  recordClinicalIntelligenceEventInputSchema,
  type RecordClinicalIntelligenceEventInput,
} from "@/src/lib/fi-os/clinicalIntelligenceEventsSchema";

function assertSignalKey(key: string): asserts key is FiClinicalIntelligenceSignalKey {
  if (!isFiClinicalIntelligenceSignalKey(key)) {
    throw new Error(`Unknown clinical intelligence signal_key: ${key}`);
  }
}

export async function recordClinicalIntelligenceEvent(
  raw: RecordClinicalIntelligenceEventInput
): Promise<{ id: string }> {
  const input = recordClinicalIntelligenceEventInputSchema.parse(raw);
  assertSignalKey(input.signalKey);

  const supabase = supabaseAdmin();
  const row = {
    tenant_id: input.tenantId,
    patient_id: input.patientId ?? null,
    case_id: input.caseId ?? null,
    consultation_id: input.consultationId ?? null,
    booking_id: input.bookingId ?? null,
    staff_id: input.staffId ?? null,
    signal_key: input.signalKey,
    event_type: input.eventType,
    severity: input.severity,
    title: input.title,
    description: input.description ?? null,
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
    status: input.status,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    metadata: input.metadata,
  };

  const { data, error } = await supabase
    .from("fi_clinical_intelligence_events")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    if (error.message?.includes("fi_clinical_intelligence_events") || error.code === "42P01") {
      throw new Error(
        "Clinical intelligence events table is not available (migration not applied)."
      );
    }
    throw new Error(error.message);
  }
  return { id: String((data as { id: string }).id) };
}

export async function acknowledgeClinicalIntelligenceEvent(params: {
  tenantId: string;
  eventId: string;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("fi_clinical_intelligence_events")
    .update({ status: "acknowledged", updated_at: new Date().toISOString() })
    .eq("tenant_id", params.tenantId.trim())
    .eq("id", params.eventId.trim())
    .in("status", ["open"]);
  if (error) throw new Error(error.message);
}

export async function resolveClinicalIntelligenceEvent(params: {
  tenantId: string;
  eventId: string;
  resolvedByUserId: string | null;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_clinical_intelligence_events")
    .update({
      status: "resolved",
      resolved_at: now,
      resolved_by_user_id: params.resolvedByUserId,
      updated_at: now,
    })
    .eq("tenant_id", params.tenantId.trim())
    .eq("id", params.eventId.trim());
  if (error) throw new Error(error.message);
}

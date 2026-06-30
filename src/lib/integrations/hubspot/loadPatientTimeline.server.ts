import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PatientTimelineRow = {
  id: string;
  source: string;
  event_type: string;
  event_timestamp: string;
  title: string | null;
  description: string | null;
  crm_lead_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LoadPatientTimelineResult =
  | { ok: true; patientId: string; personId: string; rows: PatientTimelineRow[] }
  | { ok: false };

/**
 * Load the chronological external-activity timeline for a patient (newest first).
 *
 * Includes rows anchored on the patient directly OR on the patient's person (HubSpot contact
 * events that matched the person but not the patient facet). Read-only.
 */
export async function loadPatientTimeline(
  tenantId: string,
  patientId: string,
  opts?: { limit?: number; client?: SupabaseClient }
): Promise<LoadPatientTimelineResult> {
  const supabase = opts?.client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);

  const { data: patient, error: pe } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!patient) return { ok: false };

  const personId = String((patient as { person_id: string }).person_id);

  const { data, error } = await supabase
    .from("fi_patient_timeline")
    .select(
      "id, source, event_type, event_timestamp, title, description, crm_lead_id, metadata, created_at"
    )
    .eq("tenant_id", tid)
    .or(`patient_id.eq.${pid},person_id.eq.${personId}`)
    .order("event_timestamp", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return {
    ok: true,
    patientId: pid,
    personId,
    rows: (data ?? []) as PatientTimelineRow[],
  };
}

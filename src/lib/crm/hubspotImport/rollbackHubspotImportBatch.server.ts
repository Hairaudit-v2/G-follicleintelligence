import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Deletes FI OS rows created by HubSpot Stage 1 import for a batch (metadata.import_batch_id).
 * Order: leads (cascades fi_crm_lead_source_ids), patients, persons (cascades fi_person_source_ids).
 */
export async function rollbackHubspotImportBatch(
  tenantId: string,
  importBatchId: string,
  client?: SupabaseClient
): Promise<{ leadsDeleted: number; patientsDeleted: number; personsDeleted: number }> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const bid = importBatchId.trim();

  const { data: leads, error: le } = await supabase
    .from("fi_crm_leads")
    .select("id")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", bid);
  if (le) throw new Error(le.message);
  const leadIds = (leads ?? []).map((r) => String((r as { id: string }).id));

  if (leadIds.length) {
    const chunk = 100;
    for (let i = 0; i < leadIds.length; i += chunk) {
      const slice = leadIds.slice(i, i + chunk);
      const { error: d1 } = await supabase
        .from("fi_crm_leads")
        .delete()
        .eq("tenant_id", tid)
        .in("id", slice);
      if (d1) throw new Error(d1.message);
    }
  }

  const { data: patients, error: pe } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", bid);
  if (pe) throw new Error(pe.message);
  const patientIds = (patients ?? []).map((r) => String((r as { id: string }).id));
  if (patientIds.length) {
    const chunk = 100;
    for (let i = 0; i < patientIds.length; i += chunk) {
      const slice = patientIds.slice(i, i + chunk);
      const { error: d2 } = await supabase
        .from("fi_patients")
        .delete()
        .eq("tenant_id", tid)
        .in("id", slice);
      if (d2) throw new Error(d2.message);
    }
  }

  const { data: persons, error: pse } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", bid);
  if (pse) throw new Error(pse.message);
  const personIds = (persons ?? []).map((r) => String((r as { id: string }).id));
  if (personIds.length) {
    const chunk = 100;
    for (let i = 0; i < personIds.length; i += chunk) {
      const slice = personIds.slice(i, i + chunk);
      const { error: d3 } = await supabase
        .from("fi_persons")
        .delete()
        .eq("tenant_id", tid)
        .in("id", slice);
      if (d3) throw new Error(d3.message);
    }
  }

  return {
    leadsDeleted: leadIds.length,
    patientsDeleted: patientIds.length,
    personsDeleted: personIds.length,
  };
}

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { HubspotContactParsedRow } from "./hubspotContactCsvColumns";

export type StagingRowDb = {
  id: string;
  import_batch_id: string;
  row_index: number;
  record_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  contact_owner: string | null;
  lead_status: string | null;
  create_date: string | null;
  last_modified_date: string | null;
  contact_type: string | null;
  lifecycle_stage: string | null;
  lead_source: string | null;
  stage_of_journey: string | null;
  next_appointment_date: string | null;
  associated_deal: string | null;
  associated_company: string | null;
  associated_deal_ids: string | null;
  /** Preserved from HubSpot Non-Surgical custom property; null when column absent. */
  non_surgical: string | null;
};

export function stagingDbRowToParsed(row: StagingRowDb): HubspotContactParsedRow {
  return {
    rowIndex: row.row_index,
    recordId: row.record_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phoneNumber: row.phone_number,
    contactOwner: row.contact_owner,
    leadStatus: row.lead_status,
    createDate: row.create_date,
    lastModifiedDate: row.last_modified_date,
    contactType: row.contact_type,
    lifecycleStage: row.lifecycle_stage,
    leadSource: row.lead_source,
    stageOfJourney: row.stage_of_journey,
    nextAppointmentDate: row.next_appointment_date,
    associatedDeal: row.associated_deal,
    associatedCompany: row.associated_company,
    associatedDealIds: row.associated_deal_ids,
    nonSurgical: row.non_surgical ?? null,
  };
}

export type FiImportBatchRow = {
  id: string;
  tenant_id: string;
  status: string;
  dry_run_passed: boolean;
  dry_run_at: string | null;
  dry_run_report: unknown;
  imported_at: string | null;
  rolled_back_at: string | null;
  row_count: number;
  imported_row_count: number;
  created_at: string;
  metadata?: unknown;
};

export async function loadHubspotImportBatch(
  tenantId: string,
  batchId: string
): Promise<{ batch: FiImportBatchRow | null; stagingPreview: StagingRowDb[]; stagingTotal: number }> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const bid = batchId.trim();

  const { data: batch, error: be } = await supabase
    .from("fi_import_batches")
    .select(
      "id, tenant_id, status, dry_run_passed, dry_run_at, dry_run_report, imported_at, rolled_back_at, row_count, imported_row_count, created_at, metadata"
    )
    .eq("tenant_id", tid)
    .eq("id", bid)
    .maybeSingle();
  if (be) throw new Error(be.message);
  if (!batch) return { batch: null, stagingPreview: [], stagingTotal: 0 };

  const { count, error: ce } = await supabase
    .from("stg_hubspot_contacts_imports")
    .select("id", { count: "exact", head: true })
    .eq("import_batch_id", bid);
  if (ce) throw new Error(ce.message);

  const { data: preview, error: pe } = await supabase
    .from("stg_hubspot_contacts_imports")
    .select("*")
    .eq("import_batch_id", bid)
    .order("row_index", { ascending: true })
    .limit(50);
  if (pe) throw new Error(pe.message);

  return {
    batch: batch as FiImportBatchRow,
    stagingPreview: (preview ?? []) as StagingRowDb[],
    stagingTotal: count ?? 0,
  };
}

export async function loadAllStagingRowsForBatch(tenantId: string, batchId: string): Promise<HubspotContactParsedRow[]> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const bid = batchId.trim();

  const { data: b, error: be } = await supabase
    .from("fi_import_batches")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", bid)
    .maybeSingle();
  if (be) throw new Error(be.message);
  if (!b) throw new Error("Import batch not found.");

  const pageSize = 1000;
  const out: HubspotContactParsedRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data: chunk, error } = await supabase
      .from("stg_hubspot_contacts_imports")
      .select("*")
      .eq("import_batch_id", bid)
      .order("row_index", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!chunk?.length) break;
    for (const row of chunk) {
      out.push(stagingDbRowToParsed(row as StagingRowDb));
    }
    if (chunk.length < pageSize) break;
  }
  return out;
}

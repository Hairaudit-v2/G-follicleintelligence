/**
 * Shared read-only audit helpers for HubSpot import batch rollback (scripts only).
 * No server-only / Next imports — safe for plain `tsx`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROTECTED_HUBSPOT_IMPORT_BATCH_IDS = new Set<string>([
  "c65ed118-f128-42b5-8278-c54d436797a2".toLowerCase(),
]);

const CHUNK = 100;

export function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** True if any row exists for tenant + column IN ids (chunked). */
export async function existsAnyInIds(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  column: string,
  ids: string[]
): Promise<boolean> {
  if (!ids.length) return false;
  for (const slice of chunks(ids, CHUNK)) {
    const q = supabase.from(table).select("id").eq("tenant_id", tenantId).in(column, slice).limit(1);
    const { data, error } = await q;
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    if ((data ?? []).length > 0) return true;
  }
  return false;
}

export type RollbackBlocker = { table: string; column?: string; count?: number; reason: string };

export type HubspotBatchAudit = {
  batch_id: string;
  batch_status: string | null;
  counts: Record<string, number>;
  blockers: RollbackBlocker[];
  proposed_delete_order: string[];
  safe_to_rollback: boolean;
};

export async function loadPersonPatientLeadIdsForImportBatch(
  supabase: SupabaseClient,
  tenantId: string,
  batchId: string
): Promise<{ personIds: string[]; patientIds: string[]; leadIds: string[] }> {
  const { data: persons, error: pe } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", batchId);
  if (pe) throw new Error(pe.message);
  const personIds = (persons ?? []).map((r) => String((r as { id: string }).id));

  const { data: patients, error: pae } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", batchId);
  if (pae) throw new Error(pae.message);
  const patientIds = (patients ?? []).map((r) => String((r as { id: string }).id));

  const { data: leads, error: le } = await supabase
    .from("fi_crm_leads")
    .select("id")
    .eq("tenant_id", tenantId)
    .filter("metadata->>import_batch_id", "eq", batchId);
  if (le) throw new Error(le.message);
  const leadIds = (leads ?? []).map((r) => String((r as { id: string }).id));

  return { personIds, patientIds, leadIds };
}

async function countExact(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  batchId: string | null,
  metadataBatchColumn: boolean,
  extra?: { column: string; ids: string[] }
): Promise<number> {
  if (extra?.ids?.length) {
    let total = 0;
    for (const slice of chunks(extra.ids, CHUNK)) {
      let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in(extra.column, slice);
      const { count, error } = await q;
      if (error) throw new Error(`${table}: ${error.message}`);
      total += count ?? 0;
    }
    return total;
  }
  if (metadataBatchColumn && batchId) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .filter("metadata->>import_batch_id", "eq", batchId);
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  }
  return 0;
}

/**
 * Clinical / booking / surgery anchors that must be absent before automated rollback.
 */
export async function collectRollbackBlockers(
  supabase: SupabaseClient,
  tenantId: string,
  personIds: string[],
  patientIds: string[],
  leadIds: string[]
): Promise<RollbackBlocker[]> {
  const blockers: RollbackBlocker[] = [];

  const checks: { table: string; column: string; ids: string[]; reason: string }[] = [
    { table: "fi_bookings", column: "lead_id", ids: leadIds, reason: "Booking linked to imported lead" },
    { table: "fi_bookings", column: "person_id", ids: personIds, reason: "Booking linked to imported person" },
    { table: "fi_bookings", column: "patient_id", ids: patientIds, reason: "Booking linked to imported patient" },
    { table: "fi_consultations", column: "lead_id", ids: leadIds, reason: "Consultation linked to imported lead" },
    { table: "fi_consultations", column: "person_id", ids: personIds, reason: "Consultation linked to imported person" },
    { table: "fi_consultations", column: "patient_id", ids: patientIds, reason: "Consultation linked to imported patient" },
    { table: "fi_cases", column: "patient_id", ids: patientIds, reason: "Case linked to imported patient" },
    { table: "fi_patient_images", column: "patient_id", ids: patientIds, reason: "Patient image linked to imported patient" },
    { table: "fi_pathology_requests", column: "patient_id", ids: patientIds, reason: "Pathology request linked to imported patient" },
    { table: "fi_pathology_results", column: "patient_id", ids: patientIds, reason: "Pathology result linked to imported patient" },
    { table: "fi_pathology_ai_interpretations", column: "patient_id", ids: patientIds, reason: "Pathology AI linked to imported patient" },
    { table: "fi_clinical_notes", column: "patient_id", ids: patientIds, reason: "Clinical note linked to imported patient" },
    { table: "fi_patient_timeline_events", column: "patient_id", ids: patientIds, reason: "Patient timeline event linked to imported patient" },
    { table: "fi_timeline_events", column: "patient_id", ids: patientIds, reason: "Case timeline event linked to imported patient" },
    { table: "fi_payment_records", column: "patient_id", ids: patientIds, reason: "Payment record linked to imported patient" },
    { table: "fi_payment_records", column: "lead_id", ids: leadIds, reason: "Payment record linked to imported lead" },
    { table: "fi_intakes", column: "person_id", ids: personIds, reason: "Intake linked to imported person" },
    { table: "fi_intakes", column: "patient_id", ids: patientIds, reason: "Intake linked to imported patient" },
    { table: "fi_global_cases", column: "foundation_patient_id", ids: patientIds, reason: "Global case linked to imported patient" },
  ];

  for (const c of checks) {
    if (!c.ids.length) continue;
    const hit = await existsAnyInIds(supabase, c.table, tenantId, c.column, c.ids);
    if (hit) blockers.push({ table: c.table, column: c.column, reason: c.reason });
  }

  /** Medication / prescribing — restrict FKs: presence blocks naive delete. */
  for (const { table, column, reason } of [
    { table: "fi_patient_therapy_plans", column: "patient_id", reason: "MedicationOS therapy plan linked to imported patient" },
    { table: "fi_patient_prescriptions", column: "patient_id", reason: "Patient prescription linked to imported patient" },
  ] as const) {
    if (!patientIds.length) continue;
    const hit = await existsAnyInIds(supabase, table, tenantId, column, patientIds);
    if (hit) blockers.push({ table, column, reason });
  }

  /** Imaging OS */
  for (const { table, column, reason } of [
    { table: "fi_imaging_protocol_sessions", column: "patient_id", reason: "Imaging protocol session linked to imported patient" },
    { table: "fi_imaging_scalp_maps", column: "patient_id", reason: "Imaging scalp map linked to imported patient" },
  ] as const) {
    if (!patientIds.length) continue;
    const hit = await existsAnyInIds(supabase, table, tenantId, column, patientIds);
    if (hit) blockers.push({ table, column, reason });
  }

  return blockers;
}

export const PROPOSED_DELETE_ORDER = [
  "fi_reminder_jobs (where lead_id or person_id in batch)",
  "fi_crm_leads (cascade: fi_crm_activity_events, fi_crm_lead_stage_history, fi_crm_lead_source_ids, fi_crm_tasks, fi_crm_notes, fi_crm_messages, fi_crm_quotes, fi_crm_lead_communications, …)",
  "fi_patients (metadata.import_batch_id for this batch)",
  "fi_person_source_ids (cascade on fi_persons delete, or explicit)",
  "fi_person_roles (cascade on fi_persons delete)",
  "fi_persons (metadata.import_batch_id for this batch)",
  "fi_import_batches row: UPDATE status=rolled_back, rolled_back_at, metadata (do not DELETE batch row)",
] as const;

export async function auditHubspotImportBatch(
  supabase: SupabaseClient,
  batchId: string
): Promise<HubspotBatchAudit> {
  const bid = batchId.trim();
  const { data: batch, error: be } = await supabase
    .from("fi_import_batches")
    .select("id, tenant_id, status, row_count, imported_row_count, kind, metadata, created_at, rolled_back_at")
    .eq("id", bid)
    .maybeSingle();
  if (be) throw new Error(be.message);

  if (!batch) {
    return {
      batch_id: bid,
      batch_status: null,
      counts: {},
      blockers: [{ table: "fi_import_batches", reason: "No fi_import_batches row for this id" }],
      proposed_delete_order: [...PROPOSED_DELETE_ORDER],
      safe_to_rollback: false,
    };
  }

  const tenantId = String((batch as { tenant_id: string }).tenant_id);
  const batchStatus = String((batch as { status: string }).status);

  const { personIds, patientIds, leadIds } = await loadPersonPatientLeadIdsForImportBatch(supabase, tenantId, bid);

  const personsCount = await countExact(supabase, "fi_persons", tenantId, bid, true);
  const patientsCount = await countExact(supabase, "fi_patients", tenantId, bid, true);
  const leadsCount = await countExact(supabase, "fi_crm_leads", tenantId, bid, true);

  let sourceIdsCount = 0;
  for (const slice of chunks(personIds, CHUNK)) {
    const { count, error } = await supabase
      .from("fi_person_source_ids")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("source_system", "hubspot")
      .in("person_id", slice);
    if (error) throw new Error(error.message);
    sourceIdsCount += count ?? 0;
  }

  let reminderJobsByLead = 0;
  for (const slice of chunks(leadIds, CHUNK)) {
    const { count, error } = await supabase
      .from("fi_reminder_jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("lead_id", slice);
    if (error) throw new Error(error.message);
    reminderJobsByLead += count ?? 0;
  }
  let reminderJobsByPerson = 0;
  for (const slice of chunks(personIds, CHUNK)) {
    const { count, error } = await supabase
      .from("fi_reminder_jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("person_id", slice);
    if (error) throw new Error(error.message);
    reminderJobsByPerson += count ?? 0;
  }

  let stgHubspotRows = 0;
  const stgRes = await supabase
    .from("stg_hubspot_contacts_imports")
    .select("id", { count: "exact", head: true })
    .eq("import_batch_id", bid);
  if (!stgRes.error) stgHubspotRows = stgRes.count ?? 0;

  const blockers = await collectRollbackBlockers(supabase, tenantId, personIds, patientIds, leadIds);

  if (batchStatus === "rolled_back") {
    const residual = personsCount + patientsCount + leadsCount;
    if (residual === 0) {
      return {
        batch_id: bid,
        batch_status: batchStatus,
        counts: {
          fi_persons: personsCount,
          fi_patients: patientsCount,
          fi_crm_leads: leadsCount,
          fi_person_source_ids_hubspot_for_batch_persons: sourceIdsCount,
          fi_reminder_jobs_by_lead_id: reminderJobsByLead,
          fi_reminder_jobs_by_person_id: reminderJobsByPerson,
          stg_hubspot_contacts_imports: stgHubspotRows,
        },
        blockers: [],
        proposed_delete_order: [...PROPOSED_DELETE_ORDER],
        safe_to_rollback: true,
      };
    }
    blockers.unshift({
      table: "fi_import_batches",
      reason: "Batch is marked rolled_back but fi_persons / fi_patients / fi_crm_leads rows still reference this import_batch_id",
    });
  } else if (batchStatus !== "import_completed" && batchStatus !== "import_failed") {
    blockers.unshift({
      table: "fi_import_batches",
      reason: `Batch status "${batchStatus}" is not eligible for automated rollback (expected import_completed or import_failed).`,
    });
  }

  const safe_to_rollback = blockers.length === 0;

  return {
    batch_id: bid,
    batch_status: batchStatus,
    counts: {
      fi_persons: personsCount,
      fi_patients: patientsCount,
      fi_crm_leads: leadsCount,
      fi_person_source_ids_hubspot_for_batch_persons: sourceIdsCount,
      fi_reminder_jobs_by_lead_id: reminderJobsByLead,
      fi_reminder_jobs_by_person_id: reminderJobsByPerson,
      stg_hubspot_contacts_imports: stgHubspotRows,
    },
    blockers,
    proposed_delete_order: [...PROPOSED_DELETE_ORDER],
    safe_to_rollback,
  };
}

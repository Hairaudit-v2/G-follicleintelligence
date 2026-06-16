import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { ensureDefaultPipelineStages, getEntryPipelineStage, loadPipelineStages } from "@/src/lib/crm/pipeline";
import { appendCrmLeadStageHistory } from "@/src/lib/crm/stageHistory";
import { mapFiCrmLeadRow } from "@/src/lib/crm/leadRow";
import type { CrmPipelineScope } from "@/src/lib/crm/types";
import { DEFAULT_CRM_PIPELINE_KEY } from "@/src/lib/crm/types";
import { syncLeadCreatedReminderJobs } from "@/src/lib/reminders/reminderEnqueue.server";
import { isPlaceholderEmail, normalizeEmail, normalizeWhitespaceName } from "@/src/lib/fi/foundation/normalize";
import type { HubspotContactParsedRow } from "./hubspotContactCsvColumns";
import type { HubspotContactRowValidation } from "./validateHubspotContactsImport";
import { rowHasBlockingIssues } from "./validateHubspotContactsImport";
import { hubspotRecordIdExists } from "./hubspotImportDbChecks.server";
import { splitHubspotDealIds } from "./hubspotDealIds";

const HUBSPOT_PERSON_SOURCE = "hubspot";
const HUBSPOT_DEAL_SOURCE = "hubspot_deal";

function buildHubspotPersonMetadata(params: {
  importBatchId: string;
  recordId: string;
  row: HubspotContactParsedRow;
  validation: HubspotContactRowValidation;
}): Record<string, unknown> {
  const { importBatchId, recordId, row, validation } = params;
  const emailNorm = normalizeEmail(row.email);
  const display = [row.firstName?.trim(), row.lastName?.trim()].filter(Boolean).join(" ").trim();
  const normDisplay = normalizeWhitespaceName(display);
  const base: Record<string, unknown> = {
    import_batch_id: importBatchId,
    hubspot: {
      record_id: recordId,
      first_name: row.firstName?.trim() ?? null,
      last_name: row.lastName?.trim() ?? null,
      email: row.email?.trim() ?? null,
      phone_number: row.phoneNumber?.trim() ?? null,
      contact_owner: row.contactOwner?.trim() ?? null,
      lead_status: row.leadStatus?.trim() ?? null,
      create_date: row.createDate?.trim() ?? null,
      last_modified_date: row.lastModifiedDate?.trim() ?? null,
      contact_type: row.contactType?.trim() ?? null,
      lifecycle_stage: row.lifecycleStage?.trim() ?? null,
      lead_source: row.leadSource?.trim() ?? null,
      stage_of_journey: row.stageOfJourney?.trim() ?? null,
      next_appointment_date: row.nextAppointmentDate?.trim() ?? null,
      associated_deal: row.associatedDeal?.trim() ?? null,
      associated_company: row.associatedCompany?.trim() ?? null,
      associated_deal_ids: row.associatedDealIds?.trim() ?? null,
      mapped_pipeline_slug: validation.mappedPipelineSlug,
      mapped_lead_status_key: validation.mappedLeadStatusKey,
      import_classification: validation.classification,
      // Non-Surgical custom property: preserved when present in export
      non_surgical: row.nonSurgical?.trim() ?? null,
    },
  };
  if (emailNorm && !isPlaceholderEmail(emailNorm)) {
    base.email_normalized = emailNorm;
  }
  if (normDisplay) {
    base.normalised_display_name = normDisplay;
  }
  if (display) {
    base.display_name = display;
  }
  if (!validation.phoneCorrupted && row.phoneNumber?.trim()) {
    // Only store phone when it is not Excel-mangled scientific notation.
    base.phone = row.phoneNumber.trim();
  } else if (validation.phoneCorrupted && row.phoneNumber?.trim()) {
    // Preserve the raw corrupted value in the hubspot audit block for manual recovery.
    const hub = base.hubspot as Record<string, unknown>;
    hub.phone_number_quarantined = row.phoneNumber.trim();
    hub.phone_number_quarantine_reason = "scientific_notation_mangled";
  }
  return base;
}

function buildLeadMetadata(params: {
  importBatchId: string;
  row: HubspotContactParsedRow;
  validation: HubspotContactRowValidation;
}): Record<string, unknown> {
  const { importBatchId, row, validation } = params;
  return {
    import_batch_id: importBatchId,
    hubspot: {
      lead_status: row.leadStatus?.trim() ?? null,
      lifecycle_stage: row.lifecycleStage?.trim() ?? null,
      stage_of_journey: row.stageOfJourney?.trim() ?? null,
      lead_source: row.leadSource?.trim() ?? null,
      contact_owner: row.contactOwner?.trim() ?? null,
      contact_type: row.contactType?.trim() ?? null,
      associated_company: row.associatedCompany?.trim() ?? null,
      associated_deal: row.associatedDeal?.trim() ?? null,
      associated_deal_ids: row.associatedDealIds?.trim() ?? null,
      mapped_pipeline_slug: validation.mappedPipelineSlug,
      mapped_lead_status_key: validation.mappedLeadStatusKey,
      import_classification: validation.classification,
    },
  };
}

function leadSummary(row: HubspotContactParsedRow, recordId: string): string {
  const display = [row.firstName?.trim(), row.lastName?.trim()].filter(Boolean).join(" ").trim();
  if (display) return display.slice(0, 500);
  const em = row.email?.trim();
  if (em) return em.slice(0, 500);
  return ("HubSpot contact " + recordId).slice(0, 500);
}

async function deletePersonCascade(supabase: SupabaseClient, tenantId: string, personId: string): Promise<void> {
  await supabase.from("fi_crm_leads").delete().eq("tenant_id", tenantId).eq("person_id", personId);
  await supabase.from("fi_patients").delete().eq("tenant_id", tenantId).eq("person_id", personId);
  await supabase.from("fi_persons").delete().eq("tenant_id", tenantId).eq("id", personId);
}

export async function commitHubspotImportStage1Rows(params: {
  tenantId: string;
  importBatchId: string;
  orderedRows: HubspotContactParsedRow[];
  validationByRowIndex: Map<number, HubspotContactRowValidation>;
  maxRows: number;
  client?: SupabaseClient;
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const supabase = params.client ?? supabaseAdmin();
  const tenantId = params.tenantId.trim();
  const importBatchId = params.importBatchId.trim();
  const scope: CrmPipelineScope = {
    tenantId,
    organisationId: null,
    clinicId: null,
    pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
  };
  await ensureDefaultPipelineStages(scope, supabase);
  const stages = await loadPipelineStages(scope, supabase);
  const entry = await getEntryPipelineStage(scope, supabase);
  if (!entry) throw new Error("CRM pipeline has no entry stage.");

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const sorted = [...params.orderedRows].sort((a, b) => a.rowIndex - b.rowIndex);

  for (const row of sorted) {
    if (imported >= params.maxRows) break;
    const v = params.validationByRowIndex.get(row.rowIndex);
    if (!v || rowHasBlockingIssues(v)) {
      skipped++;
      continue;
    }
    const recordId = row.recordId?.trim();
    if (!recordId) {
      skipped++;
      continue;
    }
    if (await hubspotRecordIdExists(tenantId, recordId, supabase)) {
      skipped++;
      errors.push("Row " + String(row.rowIndex) + ": skipped -- HubSpot Record ID already imported.");
      continue;
    }

    let personId: string | null = null;
    let patientId: string | null = null;
    let leadId: string | null = null;

    try {
      const personMeta = buildHubspotPersonMetadata({ importBatchId, recordId, row, validation: v });
      const { data: pIns, error: pErr } = await supabase
        .from("fi_persons")
        .insert({ tenant_id: tenantId, metadata: personMeta })
        .select("id")
        .single();
      if (pErr) throw new Error(pErr.message);
      personId = String((pIns as { id: string }).id);

      const { error: psErr } = await supabase.from("fi_person_source_ids").insert({
        tenant_id: tenantId,
        person_id: personId,
        source_system: HUBSPOT_PERSON_SOURCE,
        source_person_id: recordId,
      });
      if (psErr) throw new Error(psErr.message);

      if (v.classification === "patient" || v.classification === "mixed_patient_lead") {
        const hub = (personMeta.hubspot as Record<string, unknown>) ?? {};
        const patientMeta = {
          import_batch_id: importBatchId,
          hubspot: { ...hub },
        };
        const { data: patIns, error: patErr } = await supabase
          .from("fi_patients")
          .insert({
            tenant_id: tenantId,
            person_id: personId,
            metadata: patientMeta,
          })
          .select("id")
          .single();
        if (patErr) throw new Error(patErr.message);
        patientId = String((patIns as { id: string }).id);
      }

      const slug = v.mappedPipelineSlug;
      const stageRow = slug ? stages.find((s) => s.slug === slug) : null;
      const stageId = stageRow?.id ?? entry.id;

      const leadMeta = buildLeadMetadata({ importBatchId, row, validation: v });
      const { data: lIns, error: lErr } = await supabase
        .from("fi_crm_leads")
        .insert({
          tenant_id: tenantId,
          organisation_id: null,
          clinic_id: null,
          person_id: personId,
          patient_id: patientId,
          case_id: null,
          current_stage_id: stageId,
          primary_owner_user_id: null,
          status: "open",
          priority: null,
          summary: leadSummary(row, recordId),
          metadata: leadMeta,
        })
        .select("*")
        .single();
      if (lErr) throw new Error(lErr.message);
      const lead = mapFiCrmLeadRow(lIns as Record<string, unknown>);
      leadId = lead.id;

      await appendCrmLeadStageHistory(
        {
          tenantId,
          leadId: lead.id,
          fromStageId: null,
          toStageId: stageId,
          changedBy: null,
          source: "system",
          reason: "hubspot.import.stage1",
          metadata: { import_batch_id: importBatchId, row_index: row.rowIndex },
        },
        supabase
      );

      const dealIds = splitHubspotDealIds(row.associatedDealIds);
      for (const dealId of dealIds) {
        const { error: dErr } = await supabase.from("fi_crm_lead_source_ids").insert({
          tenant_id: tenantId,
          lead_id: lead.id,
          source_system: HUBSPOT_DEAL_SOURCE,
          source_lead_id: dealId,
        });
        if (dErr?.code === "23505") continue;
        if (dErr) throw new Error(dErr.message);
      }

      await appendCrmActivityEvent(
        {
          tenantId,
          leadId: lead.id,
          activityKind: "crm.import.hubspot_stage1",
          title: "HubSpot CRM import (Stage 1)",
          detail: {
            import_batch_id: importBatchId,
            row_index: row.rowIndex,
            hubspot_record_id: recordId,
          },
        },
        supabase
      );

      await syncLeadCreatedReminderJobs(lead, supabase);
      imported++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push("Row " + String(row.rowIndex) + ": " + msg);
      if (personId) {
        try {
          if (leadId) {
            await supabase.from("fi_crm_lead_source_ids").delete().eq("tenant_id", tenantId).eq("lead_id", leadId);
            await supabase.from("fi_crm_leads").delete().eq("tenant_id", tenantId).eq("id", leadId);
          }
          if (patientId) {
            await supabase.from("fi_patients").delete().eq("tenant_id", tenantId).eq("id", patientId);
          }
          await deletePersonCascade(supabase, tenantId, personId);
        } catch {
          /* best-effort cleanup */
        }
      }
    }
  }

  return { imported, skipped, errors };
}

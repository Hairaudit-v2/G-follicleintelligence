"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { parseHubspotContactsCsv } from "@/src/lib/crm/hubspotImport/parseHubspotContactsCsv";
import { validateHubspotContactsRows } from "@/src/lib/crm/hubspotImport/validateHubspotContactsImport";
import { extendHubspotDryRunWithDatabase } from "@/src/lib/crm/hubspotImport/hubspotImportDbChecks.server";
import { commitHubspotImportStage1Rows } from "@/src/lib/crm/hubspotImport/commitHubspotImportStage1.server";
import { rollbackHubspotImportBatch } from "@/src/lib/crm/hubspotImport/rollbackHubspotImportBatch.server";
import {
  loadAllStagingRowsForBatch,
  type FiImportBatchRow,
} from "@/src/lib/crm/hubspotImport/hubspotImportBatchLoad.server";
import type { HubspotContactsDryRunReport, HubspotContactRowValidation } from "@/src/lib/crm/hubspotImport/validateHubspotContactsImport";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function isDryRunReport(value: unknown): value is HubspotContactsDryRunReport {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.generatedAt === "string" && Array.isArray(o.rowResults) && typeof o.passed === "boolean";
}

export async function hubspotCrmImportUploadCsvAction(
  tenantId: string,
  csvText: string
): Promise<{ ok: true; batchId: string; rowCount: number; parseError?: string } | { ok: false; error: string }> {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
    const parsed = parseHubspotContactsCsv(csvText);
    if (parsed.error) {
      return { ok: false, error: parsed.error };
    }
    if (!parsed.rows.length) {
      return { ok: false, error: "No data rows in CSV." };
    }

    const supabase = supabaseAdmin();
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId, null);

    const { data: batchIns, error: bErr } = await supabase
      .from("fi_import_batches")
      .insert({
        tenant_id: tenantId.trim(),
        source_system: "hubspot",
        kind: "crm_hubspot_contacts_stage1",
        status: "uploaded",
        row_count: parsed.rows.length,
        created_by_fi_user_id: fiUserId,
        metadata: { upload: "hubspot_contacts_csv" },
      })
      .select("id")
      .single();
    if (bErr) throw new Error(bErr.message);
    const batchId = String((batchIns as { id: string }).id);

    try {
      const chunkSize = 200;
      for (let i = 0; i < parsed.rows.length; i += chunkSize) {
        const slice = parsed.rows.slice(i, i + chunkSize);
        const payload = slice.map((r) => ({
          import_batch_id: batchId,
          row_index: r.rowIndex,
          record_id: r.recordId,
          first_name: r.firstName,
          last_name: r.lastName,
          email: r.email,
          phone_number: r.phoneNumber,
          contact_owner: r.contactOwner,
          lead_status: r.leadStatus,
          create_date: r.createDate,
          last_modified_date: r.lastModifiedDate,
          contact_type: r.contactType,
          lifecycle_stage: r.lifecycleStage,
          lead_source: r.leadSource,
          stage_of_journey: r.stageOfJourney,
          next_appointment_date: r.nextAppointmentDate,
          associated_deal: r.associatedDeal,
          associated_company: r.associatedCompany,
          associated_deal_ids: r.associatedDealIds,
          non_surgical: r.nonSurgical,
        }));
        const { error: sErr } = await supabase.from("stg_hubspot_contacts_imports").insert(payload);
        if (sErr) throw new Error(sErr.message);
      }
    } catch (e) {
      await supabase.from("fi_import_batches").delete().eq("id", batchId).eq("tenant_id", tenantId.trim());
      throw e;
    }

    return { ok: true, batchId, rowCount: parsed.rows.length };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function hubspotCrmImportDryRunAction(
  tenantId: string,
  batchId: string
): Promise<{ ok: true; report: HubspotContactsDryRunReport; batch: FiImportBatchRow } | { ok: false; error: string }> {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
    const supabase = supabaseAdmin();
    const tid = tenantId.trim();
    const bid = batchId.trim();

    const { data: batchRow, error: be } = await supabase
      .from("fi_import_batches")
      .select(
        "id, tenant_id, status, dry_run_passed, dry_run_at, dry_run_report, imported_at, rolled_back_at, row_count, imported_row_count, created_at, metadata"
      )
      .eq("tenant_id", tid)
      .eq("id", bid)
      .maybeSingle();
    if (be) throw new Error(be.message);
    if (!batchRow) throw new Error("Batch not found.");

    const rows = await loadAllStagingRowsForBatch(tid, bid);
    const base = validateHubspotContactsRows(rows);
    const report = await extendHubspotDryRunWithDatabase(tid, rows, base);

    const { data: updated, error: ue } = await supabase
      .from("fi_import_batches")
      .update({
        dry_run_passed: report.passed,
        dry_run_at: new Date().toISOString(),
        dry_run_report: report as unknown as Record<string, unknown>,
        status: report.passed ? "dry_run_passed" : "dry_run_failed",
      })
      .eq("id", bid)
      .eq("tenant_id", tid)
      .select(
        "id, tenant_id, status, dry_run_passed, dry_run_at, dry_run_report, imported_at, rolled_back_at, row_count, imported_row_count, created_at, metadata"
      )
      .single();
    if (ue) throw new Error(ue.message);

    return { ok: true, report, batch: updated as FiImportBatchRow };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function hubspotCrmImportCommitStage1Action(
  tenantId: string,
  batchId: string
): Promise<
  | { ok: true; imported: number; skipped: number; errors: string[]; batch: FiImportBatchRow }
  | { ok: false; error: string }
> {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
    const supabase = supabaseAdmin();
    const tid = tenantId.trim();
    const bid = batchId.trim();

    const { data: batchRow, error: be } = await supabase
      .from("fi_import_batches")
      .select(
        "id, tenant_id, status, dry_run_passed, dry_run_at, dry_run_report, imported_at, rolled_back_at, row_count, imported_row_count, created_at, metadata"
      )
      .eq("tenant_id", tid)
      .eq("id", bid)
      .maybeSingle();
    if (be) throw new Error(be.message);
    if (!batchRow) throw new Error("Batch not found.");
    const b = batchRow as FiImportBatchRow;
    if (b.status === "import_completed" || b.status === "rolled_back") {
      throw new Error("This batch has already been imported or rolled back.");
    }
    if (b.status !== "dry_run_passed" || !b.dry_run_passed) {
      throw new Error("Run a successful dry-run before importing.");
    }

    const reportRaw = b.dry_run_report;
    if (!isDryRunReport(reportRaw)) {
      throw new Error("Dry-run report missing; run dry-run again.");
    }
    const report = reportRaw;
    const validationByRowIndex = new Map<number, HubspotContactRowValidation>();
    for (const rr of report.rowResults) {
      validationByRowIndex.set(rr.rowIndex, rr);
    }

    const { data: locked, error: le } = await supabase
      .from("fi_import_batches")
      .update({ status: "importing" })
      .eq("id", bid)
      .eq("tenant_id", tid)
      .eq("status", "dry_run_passed")
      .select("id")
      .maybeSingle();
    if (le) throw new Error(le.message);
    if (!locked) {
      throw new Error("Import already started or batch is not ready for import.");
    }

    const rows = await loadAllStagingRowsForBatch(tid, bid);
    let result: { imported: number; skipped: number; errors: string[] };
    try {
      result = await commitHubspotImportStage1Rows({
        tenantId: tid,
        importBatchId: bid,
        orderedRows: rows,
        validationByRowIndex,
        maxRows: 100,
      });
    } catch (e) {
      await supabase.from("fi_import_batches").update({ status: "dry_run_passed" }).eq("id", bid).eq("tenant_id", tid);
      throw e;
    }

    const nextStatus = result.imported > 0 ? "import_completed" : "dry_run_passed";
    const prevMeta =
      b.metadata && typeof b.metadata === "object" && !Array.isArray(b.metadata)
        ? (b.metadata as Record<string, unknown>)
        : {};
    const { data: updated, error: ue } = await supabase
      .from("fi_import_batches")
      .update({
        imported_at: new Date().toISOString(),
        imported_row_count: result.imported,
        status: nextStatus,
        metadata: {
          ...prevMeta,
          import_stage1_errors: result.errors,
        },
      })
      .eq("id", bid)
      .eq("tenant_id", tid)
      .select(
        "id, tenant_id, status, dry_run_passed, dry_run_at, dry_run_report, imported_at, rolled_back_at, row_count, imported_row_count, created_at, metadata"
      )
      .single();
    if (ue) throw new Error(ue.message);

    return { ok: true, ...result, batch: updated as FiImportBatchRow };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function hubspotCrmImportRollbackBatchAction(
  tenantId: string,
  batchId: string
): Promise<{ ok: true; summary: { leadsDeleted: number; patientsDeleted: number; personsDeleted: number } } | { ok: false; error: string }> {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
    const tid = tenantId.trim();
    const bid = batchId.trim();
    const supabase = supabaseAdmin();
    const { data: b, error: be } = await supabase
      .from("fi_import_batches")
      .select("status")
      .eq("tenant_id", tid)
      .eq("id", bid)
      .maybeSingle();
    if (be) throw new Error(be.message);
    if (!b) throw new Error("Batch not found.");
    if (String((b as { status: string }).status) !== "import_completed") {
      throw new Error("Rollback is only available after a successful import (status import_completed).");
    }
    const summary = await rollbackHubspotImportBatch(tid, bid);
    const { error: ue } = await supabase
      .from("fi_import_batches")
      .update({
        rolled_back_at: new Date().toISOString(),
        status: "rolled_back",
      })
      .eq("id", bid)
      .eq("tenant_id", tid);
    if (ue) throw new Error(ue.message);
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

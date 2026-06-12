/**
 * Commit Stage 1 HubSpot import (max 100 successful rows) for:
 *   - Latest fi_import_batches row with status=dry_run_passed, or
 *   - With `--from-csv <path>`: upload that CSV, run dry-run (incl. DB checks), then commit (when no dry_run_passed batch exists, or to force a new batch).
 *
 * Loads .env.local / .env from repo root. The npm script preloads `patch-server-only-for-scripts.cjs`
 * (temporarily no-ops `node_modules/server-only` for this process only).
 *
 *   npm run hubspot:commit-latest-batch
 *   npm run hubspot:commit-latest-batch -- --from-csv ./hubspot-crm-exports-comprehensive-lead-flow-2026-06-11.csv
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: FI_HUBSPOT_IMPORT_TENANT_ID (uuid), else tenant slug FI_EVOLVED_TENANT_SLUG (default `evolved`).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { commitHubspotImportStage1Rows } from "../src/lib/crm/hubspotImport/commitHubspotImportStage1.server";
import { extendHubspotDryRunWithDatabase } from "../src/lib/crm/hubspotImport/hubspotImportDbChecks.server";
import { loadAllStagingRowsForBatch } from "../src/lib/crm/hubspotImport/hubspotImportBatchLoad.server";
import { parseHubspotContactsCsv } from "../src/lib/crm/hubspotImport/parseHubspotContactsCsv";
import type { HubspotContactsDryRunReport, HubspotContactRowValidation } from "../src/lib/crm/hubspotImport/validateHubspotContactsImport";
import { validateHubspotContactsRows } from "../src/lib/crm/hubspotImport/validateHubspotContactsImport";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function isDryRunReport(value: unknown): value is HubspotContactsDryRunReport {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.generatedAt === "string" && Array.isArray(o.rowResults) && typeof o.passed === "boolean";
}

function parseArgs(argv: string[]): { fromCsv: string | null } {
  let fromCsv: string | null = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from-csv" && argv[i + 1]) {
      fromCsv = resolve(process.cwd(), argv[++i]);
      continue;
    }
    if (a.startsWith("--from-csv=")) {
      fromCsv = resolve(process.cwd(), a.slice("--from-csv=".length));
    }
  }
  if (!fromCsv) {
    const last = argv[argv.length - 1];
    if (last && /\.csv$/i.test(last) && !last.startsWith("-")) {
      fromCsv = resolve(process.cwd(), last);
    }
  }
  return { fromCsv };
}

loadRepoEnvFiles();

const MAX_ROWS = 100;
const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

type BatchRow = {
  id: string;
  tenant_id: string;
  status: string;
  dry_run_passed: boolean;
  dry_run_at: string | null;
  dry_run_report: unknown;
  created_at: string;
  row_count: number;
  metadata: unknown;
};

async function resolveTenantId(supabase: ReturnType<typeof supabaseAdmin>): Promise<string> {
  const explicit = process.env.FI_HUBSPOT_IMPORT_TENANT_ID?.trim();
  if (explicit) return explicit;
  const slug = (process.env.FI_EVOLVED_TENANT_SLUG ?? "evolved").trim();
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No fi_tenants row for slug=${slug}. Set FI_HUBSPOT_IMPORT_TENANT_ID or run dev:provision:evolved.`);
  return String((data as { id: string }).id);
}

async function bootstrapBatchFromCsv(
  supabase: ReturnType<typeof supabaseAdmin>,
  tenantId: string,
  csvPath: string
): Promise<BatchRow> {
  const tid = tenantId.trim();
  const csvText = readFileSync(csvPath, "utf8");
  const parsed = parseHubspotContactsCsv(csvText);
  if (parsed.error) throw new Error(parsed.error);
  if (!parsed.rows.length) throw new Error("No data rows in CSV.");

  const { data: batchIns, error: bErr } = await supabase
    .from("fi_import_batches")
    .insert({
      tenant_id: tid,
      source_system: "hubspot",
      kind: "crm_hubspot_contacts_stage1",
      status: "uploaded",
      row_count: parsed.rows.length,
      metadata: { upload: "hubspot_contacts_csv", script: "hubspot-commit-latest-dry-run-batch" },
    })
    .select("id, tenant_id, status, dry_run_passed, dry_run_at, dry_run_report, created_at, row_count, metadata")
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
      }));
      const { error: sErr } = await supabase.from("stg_hubspot_contacts_imports").insert(payload);
      if (sErr) throw new Error(sErr.message);
    }
  } catch (e) {
    await supabase.from("fi_import_batches").delete().eq("id", batchId).eq("tenant_id", tid);
    throw e;
  }

  const base = validateHubspotContactsRows(parsed.rows);
  const report = await extendHubspotDryRunWithDatabase(tid, parsed.rows, base);

  const { data: updated, error: ue } = await supabase
    .from("fi_import_batches")
    .update({
      dry_run_passed: report.passed,
      dry_run_at: new Date().toISOString(),
      dry_run_report: report as unknown as Record<string, unknown>,
      status: report.passed ? "dry_run_passed" : "dry_run_failed",
    })
    .eq("id", batchId)
    .eq("tenant_id", tid)
    .select("id, tenant_id, status, dry_run_passed, dry_run_at, dry_run_report, created_at, row_count, metadata")
    .single();
  if (ue) throw new Error(ue.message);
  if (!report.passed) {
    throw new Error(`Dry-run failed for bootstrapped batch ${batchId}; see dry_run_report in fi_import_batches.`);
  }
  return updated as BatchRow;
}

async function main(): Promise<void> {
  const supabase = supabaseAdmin();
  const { fromCsv } = parseArgs(process.argv);

  let batch: BatchRow | undefined;

  const { data: batchList, error: be } = await supabase
    .from("fi_import_batches")
    .select("id, tenant_id, status, dry_run_passed, dry_run_at, dry_run_report, created_at, row_count, metadata")
    .eq("kind", "crm_hubspot_contacts_stage1")
    .eq("status", "dry_run_passed")
    .eq("dry_run_passed", true)
    .order("dry_run_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (be) throw new Error(be.message);
  batch = batchList?.[0] as BatchRow | undefined;

  if (!batch && fromCsv) {
    const tid = await resolveTenantId(supabase);
    batch = await bootstrapBatchFromCsv(supabase, tid, fromCsv);
  }

  if (!batch) {
    console.error(
      "No fi_import_batches row with status=dry_run_passed. Re-run Import Centre dry-run, or pass --from-csv <path> to upload and dry-run first."
    );
    process.exit(1);
  }

  const tid = batch.tenant_id.trim();
  const bid = String(batch.id).trim();
  const reportRaw = batch.dry_run_report;
  if (!isDryRunReport(reportRaw)) {
    throw new Error("Batch dry_run_report is missing or invalid; run dry-run from Import Centre again.");
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
    throw new Error("Could not lock batch (already importing or not dry_run_passed).");
  }

  const rows = await loadAllStagingRowsForBatch(tid, bid);
  let result: { imported: number; skipped: number; errors: string[] };
  try {
    result = await commitHubspotImportStage1Rows({
      tenantId: tid,
      importBatchId: bid,
      orderedRows: rows,
      validationByRowIndex,
      maxRows: MAX_ROWS,
    });
  } catch (e) {
    await supabase.from("fi_import_batches").update({ status: "dry_run_passed" }).eq("id", bid).eq("tenant_id", tid);
    throw e;
  }

  const prevMeta =
    batch.metadata && typeof batch.metadata === "object" && !Array.isArray(batch.metadata)
      ? (batch.metadata as Record<string, unknown>)
      : {};
  const nextStatus = result.imported > 0 ? "import_completed" : "dry_run_passed";
  const { error: ue } = await supabase
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
    .eq("tenant_id", tid);
  if (ue) throw new Error(ue.message);

  const { count: personsCount, error: pce } = await supabase
    .from("fi_persons")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", bid);
  if (pce) throw new Error(pce.message);

  const { data: personIdsRows, error: pie } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", bid);
  if (pie) throw new Error(pie.message);
  const personIds = (personIdsRows ?? []).map((r) => String((r as { id: string }).id));

  let sourceIdsCount = 0;
  if (personIds.length) {
    const chunk = 200;
    for (let i = 0; i < personIds.length; i += chunk) {
      const slice = personIds.slice(i, i + chunk);
      const { count: c, error: sie } = await supabase
        .from("fi_person_source_ids")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .eq("source_system", "hubspot")
        .in("person_id", slice);
      if (sie) throw new Error(sie.message);
      sourceIdsCount += c ?? 0;
    }
  }

  const { count: leadsCount, error: lce } = await supabase
    .from("fi_crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", bid);
  if (lce) throw new Error(lce.message);

  const { count: patientsCount, error: patce } = await supabase
    .from("fi_patients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", bid);
  if (patce) throw new Error(patce.message);

  const { data: samplePersons, error: spe } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", bid)
    .order("created_at", { ascending: true })
    .limit(5);
  if (spe) throw new Error(spe.message);

  const { data: batchPatients, error: spte } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", bid);
  if (spte) throw new Error(spte.message);

  const patientClassified = (batchPatients ?? []).filter((row) => {
    const m = (row as { metadata?: { hubspot?: { import_classification?: string } } }).metadata;
    const c = m?.hubspot?.import_classification;
    return c === "patient" || c === "mixed_patient_lead";
  });

  const twinLinks = patientClassified.slice(0, 3).map((p) => {
    const id = String((p as { id: string }).id);
    return `${baseUrl}/fi-admin/${tid}/patients/${id}/twin`;
  });

  const patientSearchLinks = (samplePersons ?? []).slice(0, 5).map((row) => {
    const meta = (row as { metadata?: { display_name?: string; hubspot?: { first_name?: string; last_name?: string } } })
      .metadata;
    const q =
      (meta?.display_name ?? [meta?.hubspot?.first_name, meta?.hubspot?.last_name].filter(Boolean).join(" ")).trim() ||
      "hubspot";
    return `${baseUrl}/fi-admin/${tid}/patients?q=${encodeURIComponent(q)}`;
  });

  const leadFlowUrl = `${baseUrl}/fi-admin/${tid}/crm`;

  const summary = {
    batchId: bid,
    tenantId: tid,
    maxRowsCap: MAX_ROWS,
    commit: { imported: result.imported, skipped: result.skipped, errors: result.errors },
    verification: {
      fi_persons_for_batch: personsCount ?? 0,
      fi_person_source_ids_hubspot_for_imported_persons: sourceIdsCount,
      fi_crm_leads_for_batch: leadsCount ?? 0,
      fi_patients_for_batch: patientsCount ?? 0,
    },
    uiChecks: {
      leadFlow: leadFlowUrl,
      patientOsSearchSamples: patientSearchLinks,
      patientTwinSamples: twinLinks,
      manualUiNote:
        "Open LeadFlow (CRM leads), PatientOS search links below, and Patient Twin links in a signed-in browser session; automated browser verification was not run here.",
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

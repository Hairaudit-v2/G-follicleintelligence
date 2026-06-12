/**
 * Import the next N HubSpot contacts from a CSV, skipping Record IDs already in fi_person_source_ids (hubspot).
 * Does not use staging / Import Centre UI — creates a new fi_import_batches row and calls commitHubspotImportStage1Rows.
 *
 *   npm run hubspot:import-next-500
 *   npm run hubspot:import-next-500 -- --from-csv ./path.csv --max 500
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Tenant: FI_HUBSPOT_IMPORT_TENANT_ID or FI_EVOLVED_TENANT_SLUG (default evolved)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { commitHubspotImportStage1Rows } from "../src/lib/crm/hubspotImport/commitHubspotImportStage1.server";
import { extendHubspotDryRunWithDatabase } from "../src/lib/crm/hubspotImport/hubspotImportDbChecks.server";
import { parseHubspotContactsCsv } from "../src/lib/crm/hubspotImport/parseHubspotContactsCsv";
import type { HubspotContactRowValidation } from "../src/lib/crm/hubspotImport/validateHubspotContactsImport";
import { rowHasBlockingIssues, validateHubspotContactsRows } from "../src/lib/crm/hubspotImport/validateHubspotContactsImport";
import { buildFiPersonsMetadataSearchOrFilter, patientDirectorySearchIlikePattern } from "../src/lib/patients/patientDirectorySearch";

const DEFAULT_CSV = "hubspot-crm-exports-comprehensive-lead-flow-2026-06-11.csv";
const DEFAULT_MAX = 500;

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

async function resolveTenantId(supabase: ReturnType<typeof supabaseAdmin>): Promise<string> {
  const explicit = process.env.FI_HUBSPOT_IMPORT_TENANT_ID?.trim();
  if (explicit) return explicit;
  const slug = (process.env.FI_EVOLVED_TENANT_SLUG ?? "evolved").trim();
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No fi_tenants row for slug=${slug}. Set FI_HUBSPOT_IMPORT_TENANT_ID.`);
  return String((data as { id: string }).id);
}

function parseArgs(argv: string[]): { fromCsv: string; max: number } {
  let fromCsv = resolve(process.cwd(), DEFAULT_CSV);
  let max = DEFAULT_MAX;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from-csv" && argv[i + 1]) {
      fromCsv = resolve(process.cwd(), argv[++i]);
      continue;
    }
    if (a.startsWith("--from-csv=")) {
      fromCsv = resolve(process.cwd(), a.slice("--from-csv=".length));
    }
    if (a === "--max" && argv[i + 1]) {
      max = Math.max(1, Math.min(5000, parseInt(argv[++i], 10) || DEFAULT_MAX));
    }
    if (a.startsWith("--max=")) {
      max = Math.max(1, Math.min(5000, parseInt(a.slice("--max=".length), 10) || DEFAULT_MAX));
    }
  }
  return { fromCsv, max };
}

loadRepoEnvFiles();

async function main(): Promise<void> {
  const { fromCsv, max } = parseArgs(process.argv);
  const supabase = supabaseAdmin();
  const tenantId = await resolveTenantId(supabase);
  const tid = tenantId.trim();

  const csvText = readFileSync(fromCsv, "utf8");
  const parsed = parseHubspotContactsCsv(csvText);
  if (parsed.error) throw new Error(parsed.error);
  if (!parsed.rows.length) throw new Error("No data rows in CSV.");

  const baseReport = validateHubspotContactsRows(parsed.rows);
  const report = await extendHubspotDryRunWithDatabase(tid, parsed.rows, baseReport);

  const validationByRowIndex = new Map<number, HubspotContactRowValidation>();
  for (const rr of report.rowResults) {
    validationByRowIndex.set(rr.rowIndex, rr);
  }

  const sorted = [...parsed.rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const eligible: typeof sorted = [];
  for (const row of sorted) {
    const v = validationByRowIndex.get(row.rowIndex);
    if (!v || rowHasBlockingIssues(v)) continue;
    const rid = row.recordId?.trim();
    if (!rid) continue;
    eligible.push(row);
  }

  const toImport = eligible.slice(0, max);
  const valMap = new Map<number, HubspotContactRowValidation>();
  for (const row of toImport) {
    const v = validationByRowIndex.get(row.rowIndex);
    if (v) valMap.set(row.rowIndex, v);
  }

  const expectedPatients = toImport.filter((r) => {
    const v = valMap.get(r.rowIndex);
    return v && (v.classification === "patient" || v.classification === "mixed_patient_lead");
  }).length;

  const initialMetadata = { script: "hubspot-import-next-500", source_csv: fromCsv } as Record<string, unknown>;

  const { data: batchIns, error: bErr } = await supabase
    .from("fi_import_batches")
    .insert({
      tenant_id: tid,
      source_system: "hubspot",
      kind: "crm_hubspot_contacts_stage1",
      status: "importing",
      row_count: toImport.length,
      dry_run_passed: false,
      dry_run_report: {
        script: "hubspot-import-next-500",
        csv: fromCsv,
        max_requested: max,
        eligible_in_csv: eligible.length,
        planned_import: toImport.length,
        expected_fi_patients: expectedPatients,
        generatedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>,
      metadata: initialMetadata,
    })
    .select("id")
    .single();
  if (bErr) throw new Error(bErr.message);
  const batchId = String((batchIns as { id: string }).id);

  let result: { imported: number; skipped: number; errors: string[] };
  try {
    result = await commitHubspotImportStage1Rows({
      tenantId: tid,
      importBatchId: batchId,
      orderedRows: toImport,
      validationByRowIndex: valMap,
      maxRows: toImport.length,
    });
  } catch (e) {
    await supabase.from("fi_import_batches").update({ status: "import_failed" }).eq("id", batchId).eq("tenant_id", tid);
    throw e;
  }

  const prevMeta = initialMetadata;

  await supabase
    .from("fi_import_batches")
    .update({
      imported_at: new Date().toISOString(),
      imported_row_count: result.imported,
      status: result.imported > 0 ? "import_completed" : "import_failed",
      metadata: {
        ...prevMeta,
        import_stage1_errors: result.errors,
        skipped: result.skipped,
      },
    })
    .eq("id", batchId)
    .eq("tenant_id", tid);

  const { count: personsCount } = await supabase
    .from("fi_persons")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", batchId);

  const { count: leadsCount } = await supabase
    .from("fi_crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", batchId);

  const { count: patientsCount } = await supabase
    .from("fi_patients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", batchId);

  const { data: personIdsRows } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", batchId);
  const personIds = (personIdsRows ?? []).map((r) => String((r as { id: string }).id));
  const batchPersonSet = new Set(personIds);

  const dupCheck: { source_person_id: string; cnt: number }[] = [];
  if (personIds.length) {
    const { data: srcRows, error: srcErr } = await supabase
      .from("fi_person_source_ids")
      .select("source_person_id")
      .eq("tenant_id", tid)
      .eq("source_system", "hubspot")
      .in("person_id", personIds);
    if (srcErr) throw new Error(srcErr.message);
    const bySp = new Map<string, number>();
    for (const r of srcRows ?? []) {
      const sp = String((r as { source_person_id: string }).source_person_id);
      bySp.set(sp, (bySp.get(sp) ?? 0) + 1);
    }
    for (const [source_person_id, cnt] of Array.from(bySp.entries())) {
      if (cnt > 1) dupCheck.push({ source_person_id, cnt });
    }
  }

  const searchTerms = ["Tjania Smith", "Simon"];
  const searchHits: Record<string, unknown>[] = [];
  for (const term of searchTerms) {
    const pattern = patientDirectorySearchIlikePattern(term);
    const orFilter = buildFiPersonsMetadataSearchOrFilter(pattern);
    const { data: hits, error: se } = await supabase.from("fi_persons").select("id").eq("tenant_id", tid).or(orFilter).limit(20);
    searchHits.push({
      term,
      ok: !se,
      error: se?.message,
      hits: (hits ?? []).length,
      any_in_new_batch: (hits ?? []).some((h) => batchPersonSet.has(String((h as { id: string }).id))),
    });
  }

  const { data: twinSamples } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", batchId)
    .limit(3);

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const twinUrls = (twinSamples ?? []).map((p) => `${baseUrl}/fi-admin/${tid}/patients/${String((p as { id: string }).id)}/twin`);

  const twinSampleCount = (twinSamples ?? []).length;
  const twinSampleOk = expectedPatients < 3 ? true : twinSampleCount >= 3;

  const summary = {
    ok: true,
    new_batch_id: batchId,
    tenant_id: tid,
    csv: fromCsv,
    max_requested: max,
    shortfall_vs_max: max > toImport.length ? max - toImport.length : 0,
    eligible_non_blocking_in_csv: eligible.length,
    planned_rows: toImport.length,
    commit: result,
    counts_for_batch: {
      fi_persons: personsCount ?? 0,
      fi_crm_leads: leadsCount ?? 0,
      fi_patients: patientsCount ?? 0,
      expected_fi_patients_from_classification: expectedPatients,
    },
    patients_count_matches_expected: (patientsCount ?? 0) === expectedPatients,
    duplicate_hubspot_source_person_id_within_batch: dupCheck,
    patient_os_search_sample: searchHits,
    patient_twin_urls_sample: twinUrls,
    patient_twin_sample_count: twinSampleCount,
    patient_twin_at_least_three_when_expected: twinSampleOk,
    leadflow_url: `${baseUrl}/fi-admin/${tid}/crm`,
    patient_os_url: `${baseUrl}/fi-admin/${tid}/patients`,
    http_note:
      "Open LeadFlow / PatientOS / Patient Twin URLs in a browser session with auth; this script does not send cookies.",
  };

  console.log(JSON.stringify(summary, null, 2));

  const okCounts = (personsCount ?? 0) === result.imported && (leadsCount ?? 0) === result.imported && result.imported === toImport.length;
  if (!okCounts || dupCheck.length || (patientsCount ?? 0) !== expectedPatients || !twinSampleOk) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Import the next N HubSpot contacts from a CSV, skipping Record IDs already in fi_person_source_ids (hubspot).
 * Does not use staging / Import Centre UI — creates a new fi_import_batches row and calls commitHubspotImportStage1Rows.
 *
 *   npm run hubspot:import-next-500
 *   npm run hubspot:import-next-500 -- --from-csv ./path.csv --max 500
 *   npm run hubspot:import-next-500 -- --last --dry-run   # last N importable rows (CSV order), no DB writes
 *   npm run hubspot:import-next-500 -- --last           # commit last N after a passing dry-run
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

function parseArgs(argv: string[]): { fromCsv: string; max: number; dryRun: boolean; last: boolean } {
  let fromCsv = resolve(process.cwd(), DEFAULT_CSV);
  let max = DEFAULT_MAX;
  let dryRun = false;
  let last = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run" || a === "--dry_run") {
      dryRun = true;
      continue;
    }
    if (a === "--last" || a === "--tail") {
      last = true;
      continue;
    }
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
  return { fromCsv, max, dryRun, last };
}

loadRepoEnvFiles();

function classificationCountsForRows(
  rows: { rowIndex: number }[],
  valMap: Map<number, HubspotContactRowValidation>
): { lead_only: number; patient: number; mixed_patient_lead: number } {
  const out = { lead_only: 0, patient: 0, mixed_patient_lead: 0 };
  for (const r of rows) {
    const v = valMap.get(r.rowIndex);
    if (!v) continue;
    if (v.classification === "lead_only") out.lead_only++;
    else if (v.classification === "patient") out.patient++;
    else if (v.classification === "mixed_patient_lead") out.mixed_patient_lead++;
  }
  return out;
}

function duplicateRecordIdsInSelection(rows: { recordId?: string | null }[]): string[] {
  const seen = new Map<string, number>();
  const dups: string[] = [];
  for (const r of rows) {
    const id = r.recordId?.trim();
    if (!id) continue;
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  seen.forEach((n, id) => {
    if (n > 1) dups.push(id);
  });
  return dups;
}

async function main(): Promise<void> {
  const { fromCsv, max, dryRun, last } = parseArgs(process.argv);
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

  const toImport = last ? eligible.slice(-max) : eligible.slice(0, max);
  const valMap = new Map<number, HubspotContactRowValidation>();
  for (const row of toImport) {
    const v = validationByRowIndex.get(row.rowIndex);
    if (v) valMap.set(row.rowIndex, v);
  }

  const dupInSelection = duplicateRecordIdsInSelection(toImport);
  const classCounts = classificationCountsForRows(toImport, valMap);

  const expectedPatients = toImport.filter((r) => {
    const v = valMap.get(r.rowIndex);
    return v && (v.classification === "patient" || v.classification === "mixed_patient_lead");
  }).length;

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  if (dryRun) {
    const rowIndexRange =
      toImport.length === 0
        ? null
        : {
            min: Math.min(...toImport.map((r) => r.rowIndex)),
            max: Math.max(...toImport.map((r) => r.rowIndex)),
          };
    const drySummary = {
      mode: "dry_run",
      selection: last ? "last_by_csv_order" : "first_by_csv_order",
      ok: dupInSelection.length === 0 && toImport.length > 0,
      csv: fromCsv,
      tenant_id: tid,
      max_requested: max,
      eligible_non_blocking_not_already_hubspot: eligible.length,
      planned_rows: toImport.length,
      shortfall_vs_max: max > toImport.length ? max - toImport.length : 0,
      row_index_range: rowIndexRange,
      duplicate_record_ids_in_planned_selection: dupInSelection,
      classification_counts_planned: classCounts,
      expected_fi_patients_from_classification: expectedPatients,
      full_csv_validator_passed: report.passed,
      note_blocking_elsewhere:
        "Rows outside this slice may still have blocking issues; this dry-run only validates the planned import slice is non-blocking and not already in fi_person_source_ids.",
    };
    console.log(JSON.stringify(drySummary, null, 2));
    if (!drySummary.ok) process.exitCode = 1;
    return;
  }

  const initialMetadata = {
    script: "hubspot-import-next-500",
    source_csv: fromCsv,
    selection: last ? "last_by_csv_order" : "first_by_csv_order",
  } as Record<string, unknown>;

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
        selection: last ? "last_by_csv_order" : "first_by_csv_order",
        eligible_in_csv: eligible.length,
        planned_import: toImport.length,
        expected_fi_patients: expectedPatients,
        classification_counts_planned: classCounts,
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

  let sourceIdsCountResolved = 0;
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
      sourceIdsCountResolved += c ?? 0;
    }
  }

  const { data: personsMetaRows } = await supabase
    .from("fi_persons")
    .select("metadata")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", batchId);
  const classificationFromDb = { lead_only: 0, patient: 0, mixed_patient_lead: 0 };
  for (const pr of personsMetaRows ?? []) {
    const m = (pr as { metadata?: { hubspot?: { import_classification?: string } } }).metadata;
    const c = m?.hubspot?.import_classification;
    if (c === "lead_only") classificationFromDb.lead_only++;
    else if (c === "patient") classificationFromDb.patient++;
    else if (c === "mixed_patient_lead") classificationFromDb.mixed_patient_lead++;
  }

  const { data: samplePersonsForSearch } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", batchId)
    .order("created_at", { ascending: true })
    .limit(5);

  const patientOsSearchSamples = (samplePersonsForSearch ?? []).map((row) => {
    const meta = (row as { metadata?: { display_name?: string; hubspot?: { first_name?: string; last_name?: string } } }).metadata;
    const q =
      (meta?.display_name ?? [meta?.hubspot?.first_name, meta?.hubspot?.last_name].filter(Boolean).join(" ")).trim() || "hubspot";
    return {
      person_id: String((row as { id: string }).id),
      q,
      url: `${baseUrl}/fi-admin/${tid}/patients?q=${encodeURIComponent(q)}`,
    };
  });

  const { data: twinPatientRows } = await supabase
    .from("fi_patients")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .filter("metadata->>import_batch_id", "eq", batchId);
  const twinEligible = (twinPatientRows ?? []).filter((p) => {
    const m = (p as { metadata?: { hubspot?: { import_classification?: string } } }).metadata;
    const c = m?.hubspot?.import_classification;
    return c === "patient" || c === "mixed_patient_lead";
  });
  const patientTwinUrlsSample = twinEligible.slice(0, 3).map((p) => {
    const id = String((p as { id: string }).id);
    return `${baseUrl}/fi-admin/${tid}/patients/${id}/twin`;
  });
  const twinSampleCount = patientTwinUrlsSample.length;
  const twinSampleOk = expectedPatients < 3 ? true : twinSampleCount >= 3;

  const searchHits: Record<string, unknown>[] = [];
  for (const sample of patientOsSearchSamples) {
    const term = sample.q;
    const pattern = patientDirectorySearchIlikePattern(term);
    const orFilter = buildFiPersonsMetadataSearchOrFilter(pattern);
    const { data: hits, error: se } = await supabase.from("fi_persons").select("id").eq("tenant_id", tid).or(orFilter).limit(20);
    searchHits.push({
      term,
      person_id: sample.person_id,
      ok: !se,
      error: se?.message,
      hits: (hits ?? []).length,
      any_in_new_batch: (hits ?? []).some((h) => batchPersonSet.has(String((h as { id: string }).id))),
    });
  }

  const patientProfileUrlsSample = (samplePersonsForSearch ?? []).map((row) => {
    const id = String((row as { id: string }).id);
    return `${baseUrl}/fi-admin/${tid}/patients/${id}`;
  });

  const summary = {
    ok: true,
    new_batch_id: batchId,
    tenant_id: tid,
    csv: fromCsv,
    selection: last ? "last_by_csv_order" : "first_by_csv_order",
    max_requested: max,
    shortfall_vs_max: max > toImport.length ? max - toImport.length : 0,
    eligible_non_blocking_in_csv: eligible.length,
    planned_rows: toImport.length,
    commit: result,
    counts_for_batch: {
      fi_persons: personsCount ?? 0,
      fi_person_source_ids_hubspot: sourceIdsCountResolved,
      fi_crm_leads: leadsCount ?? 0,
      fi_patients: patientsCount ?? 0,
      expected_fi_patients_from_classification: expectedPatients,
    },
    classification_counts_fi_persons_metadata: classificationFromDb,
    patients_count_matches_expected: (patientsCount ?? 0) === expectedPatients,
    duplicate_hubspot_source_person_id_within_batch: dupCheck,
    patient_os_search_sample: searchHits,
    patient_os_search_urls: patientOsSearchSamples.map((s) => s.url),
    patient_profile_urls_sample: patientProfileUrlsSample,
    patient_twin_urls_sample: patientTwinUrlsSample,
    patient_twin_sample_count: twinSampleCount,
    patient_twin_at_least_three_when_expected: twinSampleOk,
    leadflow_url: `${baseUrl}/fi-admin/${tid}/crm`,
    patient_os_url: `${baseUrl}/fi-admin/${tid}/patients`,
    http_note:
      "Open LeadFlow / PatientOS / profile / Patient Twin URLs in a signed-in browser; this script only runs DB checks.",
  };

  console.log(JSON.stringify(summary, null, 2));

  const okCounts =
    (personsCount ?? 0) === result.imported &&
    sourceIdsCountResolved === result.imported &&
    (leadsCount ?? 0) === result.imported &&
    result.imported === toImport.length;
  if (!okCounts || dupCheck.length || (patientsCount ?? 0) !== expectedPatients || !twinSampleOk) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

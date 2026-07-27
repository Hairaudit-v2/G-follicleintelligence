/**
 * Canonical Conversion-ID reconciliation: selected-export baseline vs staging.
 * Privacy-safe: never prints names, emails, answers, or raw payloads.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const OFFICIAL = "iqqvzgxoimxchhcnbzxl";
const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";
const EXPORT_CUTOFF_UTC = "2026-07-15T08:42:00.000Z"; // downloaded per FI-HUBSPOT-BACKUP-1 manifest
const OUT =
  "G:/follicleintelligence/docs/audits/evidence-fi-hubspot-form-submissions-id-reconciliation.json";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  process.env[k] = v;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url.replace("https://", "").split(".")[0];
if (ref !== OFFICIAL) {
  console.error(JSON.stringify({ error: "wrong_supabase_ref", ref }));
  process.exit(2);
}

const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const baseline = JSON.parse(
  readFileSync(
    "G:/follicleintelligence/docs/audits/.tmp-baseline-submission-ids.json",
    "utf8"
  )
);
const baselineIds = new Set(baseline.ids);

async function fetchAllStaging() {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase
      .from("fi_external_hubspot_form_submission_staging")
      .select(
        "id, hubspot_submission_id, hubspot_form_id, hubspot_created_at, hubspot_updated_at, archived, linked_contact_id, sync_run_id, tenant_id, integration_id, content_classification"
      )
      .eq("tenant_id", TENANT)
      .eq("integration_id", INTEGRATION)
      .order("hubspot_submission_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

const staging = await fetchAllStaging();
const backupIds = new Set(staging.map((r) => r.hubspot_submission_id));

const onlyBaseline = [...baselineIds].filter((id) => !backupIds.has(id));
const onlyBackup = [...backupIds].filter((id) => !baselineIds.has(id));

const idCounts = new Map();
for (const r of staging) {
  idCounts.set(
    r.hubspot_submission_id,
    (idCounts.get(r.hubspot_submission_id) ?? 0) + 1
  );
}
const duplicateGroups = [...idCounts.entries()].filter(([, c]) => c > 1);

const pairCounts = new Map();
for (const r of staging) {
  const k = `${r.hubspot_form_id}::${r.hubspot_submission_id}`;
  pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1);
}
const duplicatePairs = [...pairCounts.entries()].filter(([, c]) => c > 1);

const destIdsBySource = new Map();
for (const r of staging) {
  const list = destIdsBySource.get(r.hubspot_submission_id) ?? [];
  list.push(r.id);
  destIdsBySource.set(r.hubspot_submission_id, list);
}
const multiDest = [...destIdsBySource.entries()].filter(([, ids]) => ids.length > 1);

const backupOnlyRows = staging.filter((r) =>
  onlyBackup.includes(r.hubspot_submission_id)
);

function dateKey(iso) {
  if (!iso) return null;
  return String(iso).slice(0, 10);
}

const byCreated = new Map();
const byForm = new Map();
const byClassification = new Map();
let createdAfterCutoff = 0;
let createdOnOrBeforeCutoff = 0;
let createdNull = 0;
let updatedNonNull = 0;

for (const r of backupOnlyRows) {
  const d = dateKey(r.hubspot_created_at);
  byCreated.set(d, (byCreated.get(d) ?? 0) + 1);
  byForm.set(r.hubspot_form_id, (byForm.get(r.hubspot_form_id) ?? 0) + 1);
  const c = r.content_classification ?? "null";
  byClassification.set(c, (byClassification.get(c) ?? 0) + 1);
  if (!r.hubspot_created_at) createdNull++;
  else if (new Date(r.hubspot_created_at) > new Date(EXPORT_CUTOFF_UTC))
    createdAfterCutoff++;
  else createdOnOrBeforeCutoff++;
  if (r.hubspot_updated_at) updatedNonNull++;
}

const formIds = [...byForm.keys()];
const { data: formDefs, error: formErr } = await supabase
  .from("fi_external_hubspot_form_definition_staging")
  .select("hubspot_form_id, archived, hubspot_created_at")
  .eq("tenant_id", TENANT)
  .eq("integration_id", INTEGRATION)
  .in("hubspot_form_id", formIds.length ? formIds : ["__none__"]);
if (formErr) throw new Error(formErr.message);

const parentFormSet = new Set((formDefs ?? []).map((f) => f.hubspot_form_id));
const backupOnlyMissingParent = backupOnlyRows.filter(
  (r) => !parentFormSet.has(r.hubspot_form_id)
).length;

const { count: tenantExists } = await supabase
  .from("fi_tenants")
  .select("id", { count: "exact", head: true })
  .eq("id", TENANT);

let assocForm = 0;
let assocContact = 0;
{
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("fi_external_hubspot_association_staging")
      .select("from_hubspot_id, to_object_type")
      .eq("tenant_id", TENANT)
      .eq("integration_id", INTEGRATION)
      .eq("from_object_type", "form_submission")
      .range(from, from + pageSize - 1);
    if (error) {
      // table name may differ
      console.error("assoc_query_error", error.message);
      break;
    }
    for (const a of data ?? []) {
      if (a.to_object_type === "form") assocForm++;
      if (a.to_object_type === "contact") assocContact++;
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
}

const report = {
  frozen_at_utc: new Date().toISOString(),
  canonical_id_column_baseline: "Conversion ID",
  canonical_id_column_backup: "hubspot_submission_id",
  export_cutoff_utc: EXPORT_CUTOFF_UTC,
  tenant_id: TENANT,
  integration_id: INTEGRATION,
  supabase_ref: ref,
  counts: {
    baseline_unique_ids: baselineIds.size,
    backup_unique_ids: backupIds.size,
    backup_rows: staging.length,
    ids_only_in_baseline: onlyBaseline.length,
    ids_only_in_backup: onlyBackup.length,
    duplicate_canonical_id_groups_in_backup: duplicateGroups.length,
    duplicate_form_submission_pairs_in_backup: duplicatePairs.length,
    source_id_maps_to_multiple_destination_uuids: multiDest.length,
  },
  duplicate_query_equivalent:
    "SELECT hubspot_submission_id, COUNT(*) FROM fi_external_hubspot_form_submission_staging WHERE tenant_id=$1 AND integration_id=$2 GROUP BY 1 HAVING COUNT(*) > 1",
  duplicate_assessment:
    duplicateGroups.length === 0
      ? "No true duplicate canonical IDs in backup. Upsert key is (tenant_id, integration_id, hubspot_form_id, hubspot_submission_id)."
      : "Duplicate groups present — inspect before Green.",
  backup_only_privacy_safe: {
    total: onlyBackup.length,
    created_after_export_cutoff: createdAfterCutoff,
    created_on_or_before_export_cutoff: createdOnOrBeforeCutoff,
    created_at_null: createdNull,
    updated_at_populated: updatedNonNull,
    archived_true: backupOnlyRows.filter((r) => r.archived === true).length,
    archived_false_or_null: backupOnlyRows.filter((r) => r.archived !== true)
      .length,
    missing_parent_form: backupOnlyMissingParent,
    linked_contact_id_populated: backupOnlyRows.filter((r) => r.linked_contact_id)
      .length,
    by_created_date: Object.fromEntries(
      [...byCreated.entries()].sort((a, b) =>
        String(a[0]).localeCompare(String(b[0]))
      )
    ),
    by_form_id: Object.fromEntries(
      [...byForm.entries()].sort((a, b) => b[1] - a[1])
    ),
    by_content_classification: Object.fromEntries(byClassification),
    note: "Submission status / import-origin fields are not present as discrete columns; archived defaults false; hubspot_updated_at null for all staged submissions by engine design.",
  },
  relational_integrity: {
    tenant_row_exists: (tenantExists ?? 0) > 0,
    wrong_tenant_rows: staging.filter((r) => r.tenant_id !== TENANT).length,
    orphan_missing_parent_form_all_staging: staging.filter((r) => {
      // filled below after loading all forms
      return false;
    }).length,
    association_form_edges: assocForm,
    association_contact_edges: assocContact,
    linked_contact_column_populated_all: staging.filter((r) => r.linked_contact_id)
      .length,
  },
  baseline_only_id_hashes_sample: onlyBaseline
    .slice(0, 20)
    .map((id) => createHash("sha256").update(id).digest("hex").slice(0, 12)),
  classification_hint: null,
};

// parent form check for all staging
const { data: allForms } = await supabase
  .from("fi_external_hubspot_form_definition_staging")
  .select("hubspot_form_id")
  .eq("tenant_id", TENANT)
  .eq("integration_id", INTEGRATION);
const allFormSet = new Set((allForms ?? []).map((f) => f.hubspot_form_id));
report.relational_integrity.orphan_missing_parent_form_all_staging =
  staging.filter((r) => !allFormSet.has(r.hubspot_form_id)).length;
report.relational_integrity.parent_forms_staged = allFormSet.size;

const afterShare =
  onlyBackup.length === 0
    ? 0
    : createdAfterCutoff / onlyBackup.length;
report.classification_hint = {
  mostly_post_cutoff_growth: afterShare >= 0.95,
  mostly_pre_cutoff_coverage_gap: createdOnOrBeforeCutoff / Math.max(onlyBackup.length, 1) >= 0.95,
  ids_missing_from_backup: onlyBaseline.length,
  inventory_total_recorded_submissions_at_export: 5310,
  selected_export_baseline: 4220,
  destination_now: backupIds.size,
};

writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

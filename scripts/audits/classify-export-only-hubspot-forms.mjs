/**
 * Read-only classification of export-only HubSpot form IDs via Forms APIs.
 * Privacy-safe: no form names, field labels, or submission content in output.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Load server helpers through tsx-compiled path by spawning is heavy;
// instead call HubSpot HTTP directly after decrypting via existing connector loaders.

const OFFICIAL = "iqqvzgxoimxchhcnbzxl";
const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";

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
  if (k === "FI_EXTERNAL_CONNECTOR_MASTER_KEY") {
    const prior = process.env[k] ?? "";
    if (!prior || v.length > prior.length) process.env[k] = v;
    continue;
  }
  process.env[k] = v;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url.replace("https://", "").split(".")[0];
if (ref !== OFFICIAL) {
  console.error(JSON.stringify({ error: "wrong_supabase_ref", ref }));
  process.exit(2);
}

const recon = JSON.parse(
  readFileSync("docs/audits/evidence-fi-hubspot-forms-reconciliation.json", "utf8")
);
const onlyInExport = recon.onlyInExport ?? [];
if (!onlyInExport.length) {
  console.log(JSON.stringify({ note: "no_export_only_ids" }));
  process.exit(0);
}

const { loadHubspotAccessToken } = await import(
  "../../src/lib/onboarding-os/hubspotConnector.server.ts"
);

const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const token = await loadHubspotAccessToken(supabase, INTEGRATION);
if (!token) {
  console.error(JSON.stringify({ error: "no_access_token" }));
  process.exit(1);
}

async function hubspotGet(path) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function countStagedSubmissions(formId) {
  const { count, error } = await supabase
    .from("fi_external_hubspot_form_submission_staging")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT)
    .eq("integration_id", INTEGRATION)
    .eq("hubspot_form_id", formId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function formInStaging(formId) {
  const { count, error } = await supabase
    .from("fi_external_hubspot_form_definition_staging")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT)
    .eq("integration_id", INTEGRATION)
    .eq("hubspot_form_id", formId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** List all form IDs from marketing v3 + forms v2 (IDs only). */
async function listApiFormIds() {
  const ids = new Map(); // id -> { source, archived }
  // marketing v3 paginated
  let after = null;
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ limit: "100" });
    if (after) q.set("after", after);
    const { status, body } = await hubspotGet(`/marketing/v3/forms/?${q}`);
    if (status !== 200 || !body) break;
    for (const row of body.results ?? []) {
      if (row?.id) {
        ids.set(String(row.id).toLowerCase(), {
          source: "marketing_v3",
          archived: Boolean(row.archived),
          formType: typeof row.formType === "string" ? row.formType : null,
        });
      }
    }
    after = body.paging?.next?.after ?? null;
    if (!after) break;
  }
  // forms v2 list
  {
    const { status, body } = await hubspotGet("/forms/v2/forms");
    if (status === 200 && Array.isArray(body)) {
      for (const row of body) {
        const id = String(row.guid ?? row.id ?? "").toLowerCase();
        if (!id) continue;
        const prior = ids.get(id);
        ids.set(id, {
          source: prior ? `${prior.source}+forms_v2` : "forms_v2",
          archived: prior?.archived ?? Boolean(row.archived ?? row.deletedAt),
          formType:
            prior?.formType ??
            (typeof row.formType === "string" ? row.formType : null),
        });
      }
    }
  }
  return ids;
}

const apiForms = await listApiFormIds();
const classifications = [];

for (const formId of onlyInExport) {
  const inBackup = await formInStaging(formId);
  const stagedSubs = await countStagedSubmissions(formId);
  const apiMeta = apiForms.get(formId) ?? null;

  // Direct get probes
  const v3 = await hubspotGet(`/marketing/v3/forms/${formId}`);
  const v2 = await hubspotGet(`/forms/v2/forms/${formId}`);

  let classification = "unexplained";
  let remediation = "Investigate further before Green.";
  let presentInCurrentApi = Boolean(apiMeta) || v3.status === 200 || v2.status === 200;
  let archivedOrDeleted = null;

  if (apiMeta) {
    archivedOrDeleted = apiMeta.archived;
    if (apiMeta.archived) {
      classification = "archived_in_api_but_listable";
      remediation =
        "Document archival exclusion if live backup lists active-only; optional archived-forms pass.";
    } else {
      classification = "active_accessible_missed_by_backup";
      remediation = "Forms-phase defect likely — consider forms-only resume/rerun.";
    }
  } else if (v3.status === 404 && v2.status === 404) {
    classification = "deleted_or_not_found_in_api";
    archivedOrDeleted = true;
    remediation = "No forms-only rerun; document as historical export-only / deleted.";
  } else if (v3.status === 403 || v2.status === 403) {
    classification = "inaccessible_to_private_app";
    remediation =
      "Scope/permission gap — document; rerun only after access granted if needed.";
  } else if (v3.status === 200 || v2.status === 200) {
    const body = v3.status === 200 ? v3.body : v2.body;
    archivedOrDeleted = Boolean(body?.archived ?? body?.deletedAt);
    presentInCurrentApi = true;
    classification = archivedOrDeleted
      ? "archived_or_deleted_flag_on_direct_get"
      : "present_on_direct_get_not_in_list";
    remediation = archivedOrDeleted
      ? "Document lifecycle exclusion."
      : "Investigate pagination/filtering; possible forms-only rerun.";
  }

  classifications.push({
    canonicalFormId: formId,
    presentInExportInventory: true,
    presentInBackup: inBackup,
    presentInCurrentApi,
    archivedOrDeleted,
    formType: apiMeta?.formType ?? null,
    apiListSource: apiMeta?.source ?? null,
    directGet: {
      marketing_v3_status: v3.status,
      forms_v2_status: v2.status,
    },
    backedUpSubmissionCount: stagedSubs,
    exportBaselineSubmissionCount: null,
    classification,
    evidenceSource: "hubspot_forms_api_readonly + staging counts",
    requiredRemediation: remediation,
  });
}

recon.exportOnlyClassifications = classifications;
recon.status =
  classifications.every((c) =>
    [
      "deleted_or_not_found_in_api",
      "archived_in_api_but_listable",
      "archived_or_deleted_flag_on_direct_get",
      "inaccessible_to_private_app",
    ].includes(c.classification)
  ) && !classifications.some((c) => c.classification === "active_accessible_missed_by_backup")
    ? "GREEN_CANDIDATE"
    : classifications.some((c) => c.classification === "active_accessible_missed_by_backup")
      ? "RED_CANDIDATE"
      : "AMBER_CANDIDATE";

recon.formsInventoryVerdict =
  recon.status === "GREEN_CANDIDATE"
    ? "GREEN"
    : recon.status === "RED_CANDIDATE"
      ? "RED"
      : "AMBER";

writeFileSync(
  "docs/audits/evidence-fi-hubspot-forms-reconciliation.json",
  `${JSON.stringify(recon, null, 2)}\n`
);
console.log(
  JSON.stringify(
    {
      status: recon.status,
      formsInventoryVerdict: recon.formsInventoryVerdict,
      classifications: classifications.map((c) => ({
        id: c.canonicalFormId,
        classification: c.classification,
        presentInCurrentApi: c.presentInCurrentApi,
        archivedOrDeleted: c.archivedOrDeleted,
        backedUpSubmissionCount: c.backedUpSubmissionCount,
        directGet: c.directGet,
      })),
    },
    null,
    2
  )
);

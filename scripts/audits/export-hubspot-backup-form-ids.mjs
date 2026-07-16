/**
 * Privacy-safe export of backed-up HubSpot form definition IDs from production staging.
 * Official Supabase project only.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const OFFICIAL = "iqqvzgxoimxchhcnbzxl";
const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";
const RUN = "66f72f09-d333-4bb0-9c39-5da7b912e964";
const OUT = "docs/audits/evidence-fi-hubspot-backup-form-ids.json";

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

const { data, error } = await supabase
  .from("fi_external_hubspot_form_definition_staging")
  .select("hubspot_form_id")
  .eq("tenant_id", TENANT)
  .eq("integration_id", INTEGRATION)
  .order("hubspot_form_id", { ascending: true });

if (error) {
  console.error(error.message);
  process.exit(1);
}

const ids = [...new Set((data ?? []).map((r) => String(r.hubspot_form_id).toLowerCase()))].sort();
const evidence = {
  evidenceType: "hubspot_backup_form_inventory",
  backupRunId: RUN,
  source: "fi_external_hubspot_form_definition_staging",
  tenantId: TENANT,
  integrationId: INTEGRATION,
  backupUniqueFormCount: ids.length,
  duplicateIds: [],
  formIds: ids,
};

writeFileSync(OUT, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ out: OUT, backupUniqueFormCount: ids.length }, null, 2));
if (ids.length !== 46) process.exit(1);

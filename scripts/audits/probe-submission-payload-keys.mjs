/**
 * Privacy-safe: sample one form submission payload top-level keys only.
 * Never prints field values.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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
  )
    v = v.slice(1, -1);
  if (k === "FI_EXTERNAL_CONNECTOR_MASTER_KEY") {
    const prior = process.env[k] ?? "";
    if (!prior || v.length > prior.length) process.env[k] = v;
    continue;
  }
  process.env[k] = v;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (url.replace("https://", "").split(".")[0] !== OFFICIAL) process.exit(2);

const { loadHubspotAccessToken } = await import(
  "../../src/lib/onboarding-os/hubspotConnector.server.ts"
);
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const token = await loadHubspotAccessToken(supabase, INTEGRATION);

const { data: form } = await supabase
  .from("fi_external_hubspot_form_definition_staging")
  .select("hubspot_form_id")
  .eq("tenant_id", TENANT)
  .eq("integration_id", INTEGRATION)
  .limit(1)
  .maybeSingle();

const formId = form?.hubspot_form_id;
const res = await fetch(
  `https://api.hubapi.com/form-integrations/v1/submissions/forms/${formId}?limit=1`,
  { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
);
const body = await res.json();
const sample = body?.results?.[0] ?? null;
const keys = sample ? Object.keys(sample).sort() : [];
const valueEntryKeys =
  Array.isArray(sample?.values) && sample.values[0]
    ? Object.keys(sample.values[0]).sort()
    : [];

console.log(
  JSON.stringify(
    {
      httpStatus: res.status,
      topLevelKeys: keys,
      hasContactIdKey: keys.includes("contactId"),
      hasConversionIdKey: keys.includes("conversionId"),
      valuesArrayPresent: Array.isArray(sample?.values),
      valueObjectKeys: valueEntryKeys,
      note: "No field values printed.",
    },
    null,
    2
  )
);

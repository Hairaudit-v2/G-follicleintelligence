/**
 * Privacy-safe metadata probe for specific HubSpot form IDs.
 * Emits only lifecycle/type/flags — never names, fields, or URLs.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const OFFICIAL = "iqqvzgxoimxchhcnbzxl";
const INTEGRATION = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";
const IDS = [
  "440386a7-7498-4245-890c-ab785d3c6f77",
  "6e136ca0-40f7-48af-9216-64df6c9122ac",
];

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
if (url.replace("https://", "").split(".")[0] !== OFFICIAL) {
  console.error("wrong project");
  process.exit(2);
}

const { loadHubspotAccessToken } = await import(
  "../../src/lib/onboarding-os/hubspotConnector.server.ts"
);
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const token = await loadHubspotAccessToken(supabase, INTEGRATION);

async function get(path) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function pickMeta(body) {
  if (!body || typeof body !== "object") return null;
  return {
    id: body.id ?? body.guid ?? null,
    archived: body.archived ?? null,
    deletedAt: body.deletedAt ?? null,
    formType: body.formType ?? null,
    createdAt: body.createdAt ?? body.createdAt ?? null,
    updatedAt: body.updatedAt ?? null,
    publishDate: body.publishDate ?? null,
    isPublished:
      body.isPublished ?? body.published ?? body.publishStatus ?? null,
    configurationLifecycleState:
      body.configuration?.lifecycleState ??
      body.lifecycleState ??
      null,
    keys: Object.keys(body).sort(),
  };
}

const out = [];
for (const id of IDS) {
  const v3 = await get(`/marketing/v3/forms/${id}`);
  const v2 = await get(`/forms/v2/forms/${id}`);
  // Also check list with formTypes filter variants if any
  out.push({
    id,
    marketing_v3: { status: v3.status, meta: pickMeta(v3.body) },
    forms_v2: { status: v2.status, meta: pickMeta(v2.body) },
  });
}

// Count how many IDs marketing v3 list returns total
let listed = 0;
let after = null;
const listedIds = new Set();
for (let i = 0; i < 50; i++) {
  const q = new URLSearchParams({ limit: "100" });
  if (after) q.set("after", after);
  const page = await get(`/marketing/v3/forms/?${q}`);
  if (page.status !== 200) break;
  for (const row of page.body?.results ?? []) {
    listed += 1;
    if (row?.id) listedIds.add(String(row.id).toLowerCase());
  }
  after = page.body?.paging?.next?.after ?? null;
  if (!after) break;
}
const v2list = await get("/forms/v2/forms");
const v2ids = new Set(
  (Array.isArray(v2list.body) ? v2list.body : []).map((r) =>
    String(r.guid ?? r.id ?? "").toLowerCase()
  )
);

console.log(
  JSON.stringify(
    {
      probes: out,
      marketing_v3_list_count: listed,
      marketing_v3_list_contains_export_only: IDS.map((id) =>
        listedIds.has(id)
      ),
      forms_v2_list_count: v2ids.size,
      forms_v2_list_contains_export_only: IDS.map((id) => v2ids.has(id)),
    },
    null,
    2
  )
);

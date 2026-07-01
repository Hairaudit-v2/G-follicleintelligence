import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnvLocal() {
  const p = join(process.cwd(), ".env.local");
  const text = readFileSync(p, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = env.EVOLVED_PERTH_TENANT_ID?.trim();
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const tables = ["fi_hr_sync_runs", "fi_staff_identity_links", "fi_staff_duplicate_candidates"];
  for (const t of tables) {
    const { error } = await supabase.from(t).select("id", { count: "exact", head: true });
    console.log(`${t}: ${error ? `MISSING/ERROR — ${error.message}` : "OK"}`);
  }

  if (tenantId) {
    const { data: runs, error: runErr } = await supabase
      .from("fi_hr_sync_runs")
      .select("run_id, status, records_received, records_linked, records_created, records_updated, duplicates_detected, started_at, completed_at")
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false })
      .limit(5);
    if (runErr) console.error("fi_hr_sync_runs query:", runErr.message);
    else console.log("\nLatest fi_hr_sync_runs:", JSON.stringify(runs, null, 2));

    const { count: dupCount } = await supabase
      .from("fi_staff_duplicate_candidates")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "open");

    const { count: linkCount } = await supabase
      .from("fi_staff_identity_links")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    console.log(`\nIdentity links: ${linkCount ?? 0}, open duplicates: ${dupCount ?? 0}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
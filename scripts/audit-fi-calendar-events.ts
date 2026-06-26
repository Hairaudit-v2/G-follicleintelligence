import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";

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

loadRepoEnvFiles();

async function main() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("fi_calendar_events")
    .select("title, calendar_id, external_event_id, metadata, updated_at, start_time, tenant_id")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  console.log(JSON.stringify(rows.slice(0, 40), null, 2));

  const deleted = rows.filter((r) => r.metadata?.deleted_from_provider === true);
  const fiCreated = rows.filter((r) => {
    const src = String((r.metadata as Record<string, unknown>)?.source ?? "");
    return src === "fi_appointment_create" || src === "fi_calendar_create";
  });

  console.log("\n--- summary ---");
  console.log("total_rows:", rows.length);
  console.log("deleted_from_provider:", deleted.length);
  console.log("deleted_locally:", rows.filter((r) => r.metadata?.deleted_locally === true).length);
  console.log("google_sync source:", rows.filter((r) => r.metadata?.source === "google_sync").length);
  console.log("fi_created in sample:", fiCreated.length);
  console.log(
    "deleted fi_created:",
    deleted.filter((r) => {
      const src = String((r.metadata as Record<string, unknown>)?.source ?? "");
      return src === "fi_appointment_create" || src === "fi_calendar_create";
    }).length
  );

  if (deleted.length > 0) {
    console.log("\n--- deleted_from_provider rows ---");
    console.log(JSON.stringify(deleted, null, 2));
  }

  const { data: integrations, error: intErr } = await sb
    .from("fi_calendar_integrations")
    .select("tenant_id, calendar_id, google_account_email, status, last_synced_at, last_sync_status")
    .eq("status", "active");
  if (intErr) {
    console.error("integrations:", intErr.message);
  } else {
    console.log("\n--- active integrations ---");
    console.log(JSON.stringify(integrations, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

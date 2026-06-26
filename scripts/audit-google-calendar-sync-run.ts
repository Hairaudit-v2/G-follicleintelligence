import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { syncGoogleCalendarForTenant } from "../src/lib/googleCalendar/googleCalendarSync.server";

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

const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";

async function snapshot(label: string) {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("fi_calendar_events")
    .select("title, external_event_id, metadata, updated_at")
    .eq("tenant_id", TENANT)
    .order("updated_at", { ascending: false });
  const rows = data ?? [];
  console.log(`\n=== ${label} (${rows.length} rows) ===`);
  for (const r of rows) {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    console.log({
      title: r.title,
      external_event_id: r.external_event_id,
      source: meta.source,
      deleted_from_provider: meta.deleted_from_provider ?? false,
      sync_status: meta.sync_status ?? null,
      updated_at: r.updated_at,
    });
  }
  return rows;
}

async function main() {
  await snapshot("BEFORE sync");
  const result = await syncGoogleCalendarForTenant({ tenantId: TENANT });
  console.log("\n=== sync result ===");
  console.log(JSON.stringify(result, null, 2));
  await snapshot("AFTER sync");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { loadGoogleCalendarMonitoringPage } from "../src/lib/googleCalendar/googleCalendarMonitoring.server";
import { runScheduledGoogleCalendarSync } from "../src/lib/googleCalendar/googleCalendarSyncScheduler.server";

const TENANT = process.env.GC8_TENANT_ID?.trim() || "c2615b95-b707-4485-aa5f-be8f78ec868a";

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

async function main() {
  loadRepoEnvFiles();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("Missing Supabase env vars in .env.local");
  }

  console.log("GC-8 scheduled sync dry run");
  console.log({ tenantId: TENANT, at: new Date().toISOString() });

  const scheduled = await runScheduledGoogleCalendarSync({ tenantId: TENANT });
  console.log("\n=== scheduled sync batch ===");
  console.log(JSON.stringify(scheduled, null, 2));

  const sb = supabaseAdmin();
  const { data: health } = await sb
    .from("fi_calendar_sync_health")
    .select(
      "health_status, health_score, consecutive_failures, last_successful_sync_at, total_sync_runs, average_sync_duration_ms"
    )
    .eq("tenant_id", TENANT)
    .maybeSingle();

  const { data: runs } = await sb
    .from("fi_calendar_sync_runs")
    .select("started_at, duration_ms, status, calendars_scanned, events_fetched, events_inserted, events_updated")
    .eq("tenant_id", TENANT)
    .order("started_at", { ascending: false })
    .limit(3);

  console.log("\n=== fi_calendar_sync_health ===");
  console.log(JSON.stringify(health, null, 2));

  console.log("\n=== recent fi_calendar_sync_runs (last 3) ===");
  console.log(JSON.stringify(runs, null, 2));

  const page = await loadGoogleCalendarMonitoringPage(TENANT, { canManage: false });
  console.log("\n=== monitoring page model (summary) ===");
  console.log(
    JSON.stringify(
      {
        connected: page.connected,
        healthStatus: page.healthStatus,
        healthScore: page.healthScore,
        schedulerActive: page.scheduledSyncEnabled && !page.schedulerPaused,
        syncFrequencyMinutes: page.syncFrequencyMinutes,
        successRatePercent: page.successRatePercent,
        recentRunCount: page.recentRuns.length,
        openAlertCount: page.openAlertCount,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

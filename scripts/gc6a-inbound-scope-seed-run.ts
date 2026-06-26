import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { resolveGoogleCalendarAccessToken } from "../src/lib/googleCalendar/googleCalendarAuth.server";
import { seedGoogleInboundCalendarScopesFromCalendarList } from "../src/lib/googleCalendar/googleCalendarInboundSyncData.server";

const TENANT = process.env.GC6A_TENANT_ID?.trim() || "c2615b95-b707-4485-aa5f-be8f78ec868a";

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
  const { data: integration, error: intErr } = await sb
    .from("fi_calendar_integrations")
    .select("id, calendar_id, google_account_email, status")
    .eq("tenant_id", TENANT)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (intErr) throw new Error(intErr.message);
  if (!integration) throw new Error(`No active Google integration for tenant ${TENANT}`);

  const tokenResult = await resolveGoogleCalendarAccessToken(TENANT);
  if (!tokenResult.ok) throw new Error(tokenResult.error);

  const seedResult = await seedGoogleInboundCalendarScopesFromCalendarList({
    tenantId: TENANT,
    integrationId: integration.id,
    googleAccountEmail: integration.google_account_email,
    accessToken: tokenResult.data!.accessToken,
    defaultCalendarId: integration.calendar_id,
  });

  console.log("\n=== GC-6A inbound scope seed ===");
  console.log(JSON.stringify(seedResult, null, 2));

  const { data: scopes } = await sb
    .from("fi_calendar_inbound_sync_calendars")
    .select("google_calendar_id, google_calendar_summary, is_enabled, is_primary, metadata")
    .eq("tenant_id", TENANT)
    .eq("integration_id", integration.id)
    .order("is_primary", { ascending: false })
    .order("google_calendar_summary", { ascending: true });
  console.log("\n=== inbound scopes (all) ===");
  console.log(JSON.stringify(scopes ?? [], null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

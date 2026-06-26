import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { resolveGoogleCalendarAccessToken } from "../src/lib/googleCalendar/googleCalendarAuth.server";
import { syncGoogleCalendarForTenant } from "../src/lib/googleCalendar/googleCalendarSync.server";

const TENANT = process.env.GC5_TENANT_ID?.trim() || "c2615b95-b707-4485-aa5f-be8f78ec868a";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

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

type GoogleCalendarListEntry = {
  id?: string;
  summary?: string;
  primary?: boolean;
  accessRole?: string;
};

async function ensureInboundSyncTable(): Promise<void> {
  const sb = supabaseAdmin();
  const { error } = await sb.from("fi_calendar_inbound_sync_calendars").select("id").limit(1);
  if (!error) return;

  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260926120005_calendar_os_phase_gc5_inbound_sync_calendars.sql"
  );
  if (!existsSync(migrationPath)) {
    throw new Error(`Migration file missing: ${migrationPath}`);
  }
  throw new Error(
    `fi_calendar_inbound_sync_calendars table not found (${error.message}). Apply migration 20260926120005 first.`
  );
}

async function listGoogleCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const res = await fetch(`${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList?maxResults=250`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google calendarList failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { items?: GoogleCalendarListEntry[] };
  return json.items ?? [];
}

function pickInboundCalendars(
  entries: GoogleCalendarListEntry[],
  integrationCalendarId: string
): Array<{ google_calendar_id: string; google_calendar_summary: string; is_primary: boolean }> {
  const wantedSummaries = ["fi os consultations", "consultations"];
  const wantedIds = new Set<string>([
    integrationCalendarId.trim() || "primary",
    "primary",
  ]);

  for (const entry of entries) {
    const id = entry.id?.trim();
    const summary = entry.summary?.trim() ?? "";
    if (!id) continue;
    if (entry.primary) wantedIds.add(id);
    if (summary.toLowerCase().includes("consultations")) wantedIds.add(id);
    if (id.toLowerCase().includes("support@follicleintelligence.ai")) wantedIds.add(id);
    if (summary.toLowerCase().includes("support@follicleintelligence.ai")) wantedIds.add(id);
    if (wantedSummaries.some((w) => summary.toLowerCase().includes(w))) wantedIds.add(id);
  }

  return entries
    .filter((e) => e.id && wantedIds.has(e.id.trim()))
    .map((e) => ({
      google_calendar_id: e.id!.trim(),
      google_calendar_summary: e.summary?.trim() || e.id!.trim(),
      is_primary: Boolean(e.primary) || e.id!.trim() === integrationCalendarId.trim(),
    }));
}

async function seedInboundCalendars(
  tenantId: string,
  integrationId: string,
  integrationCalendarId: string,
  accessToken: string
): Promise<number> {
  const sb = supabaseAdmin();
  const { data: existing, error: existingErr } = await sb
    .from("fi_calendar_inbound_sync_calendars")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .limit(1);
  if (existingErr) throw new Error(existingErr.message);
  if ((existing ?? []).length > 0) return 0;

  const entries = await listGoogleCalendars(accessToken);
  const scopes = pickInboundCalendars(entries, integrationCalendarId);
  if (scopes.length === 0) {
    throw new Error("No inbound calendars matched from Google calendarList.");
  }

  const rows = scopes.map((scope) => ({
    tenant_id: tenantId,
    integration_id: integrationId,
    provider: "google",
    google_calendar_id: scope.google_calendar_id,
    google_calendar_summary: scope.google_calendar_summary,
    is_enabled: true,
    is_primary: scope.is_primary,
    metadata: {},
  }));

  const { error } = await sb.from("fi_calendar_inbound_sync_calendars").upsert(rows, {
    onConflict: "integration_id,google_calendar_id",
  });
  if (error) throw new Error(error.message);
  return rows.length;
}

async function main() {
  await ensureInboundSyncTable();

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

  const seeded = await seedInboundCalendars(
    TENANT,
    integration.id,
    integration.calendar_id,
    tokenResult.data!.accessToken
  );
  if (seeded > 0) {
    console.log(`Seeded ${seeded} inbound sync calendar scope(s).`);
  } else {
    console.log("Inbound sync calendars already configured — using existing rows.");
  }

  const { data: scopes } = await sb
    .from("fi_calendar_inbound_sync_calendars")
    .select("google_calendar_id, google_calendar_summary, is_enabled, is_primary")
    .eq("tenant_id", TENANT)
    .eq("integration_id", integration.id)
    .eq("is_enabled", true);
  console.log("\n=== inbound scopes ===");
  console.log(JSON.stringify(scopes ?? [], null, 2));

  const result = await syncGoogleCalendarForTenant({ tenantId: TENANT });
  console.log("\n=== sync summary ===");
  console.log(JSON.stringify(result, null, 2));

  const syncResult = result.result;
  if (syncResult) {
    console.log("\n=== GC-5 cycle metrics ===");
    console.log({
      calendarsScanned: syncResult.calendarsScanned,
      eventsFetchedTotal: syncResult.eventsFetchedTotal ?? syncResult.discovered,
      eventsInsertedTotal: syncResult.eventsInsertedTotal ?? syncResult.created,
      eventsUpdatedTotal: syncResult.eventsUpdatedTotal ?? syncResult.updated,
      eventsSkippedTotal: syncResult.eventsSkippedTotal ?? syncResult.skipped,
      eventsMarkedDeleted: syncResult.deleted,
      failedCalendars: syncResult.failedCalendars ?? [],
      perCalendar: syncResult.perCalendar ?? [],
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

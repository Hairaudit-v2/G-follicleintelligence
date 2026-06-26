import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

import { resolveGoogleCalendarAccessToken } from "./googleCalendarAuth.server";
import {
  seedGoogleInboundCalendarScopesFromCalendarList,
} from "./googleCalendarInboundSyncData.server";
import {
  buildInboundScopePageStats,
  inboundSyncCalendarRowToClient,
  type GoogleCalendarInboundScopePageModel,
  type GoogleCalendarInboundSyncNowSummary,
  type InboundSyncCalendarClientRow,
} from "./googleCalendarInboundScopeCore";
import { syncGoogleCalendarForTenant } from "./googleCalendarSync.server";
import type { FiCalendarSyncStatus, GoogleCalendarSyncResult } from "./googleCalendarTypes";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
};

type IntegrationRow = {
  id: string;
  google_account_email: string | null;
  calendar_id: string;
  status: string;
  access_token_encrypted: string | null;
  last_synced_at: string | null;
  last_sync_status: string;
  last_sync_error: string | null;
};

type InboundSyncCalendarDbRow = {
  id: string;
  google_calendar_id: string;
  google_calendar_summary: string | null;
  is_enabled: boolean;
  is_primary: boolean;
  last_synced_at: string | null;
  updated_at: string;
  metadata: Record<string, unknown> | null;
};

const INBOUND_SELECT =
  "id, google_calendar_id, google_calendar_summary, is_enabled, is_primary, last_synced_at, updated_at, metadata";

function summarizeSyncError(message: string | null | undefined): string | null {
  if (!message?.trim()) return null;
  const trimmed = message.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}…`;
}

async function loadActiveIntegrationRow(
  tenantId: string,
  opts: ServerOpts
): Promise<IntegrationRow | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_calendar_integrations")
    .select(
      "id, google_account_email, calendar_id, status, access_token_encrypted, last_synced_at, last_sync_status, last_sync_error"
    )
    .eq("tenant_id", tenantId.trim())
    .neq("status", "disconnected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as IntegrationRow | null) ?? null;
}

async function loadInboundSyncCalendars(
  tenantId: string,
  integrationId: string,
  opts: ServerOpts
): Promise<InboundSyncCalendarClientRow[]> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_calendar_inbound_sync_calendars")
    .select(INBOUND_SELECT)
    .eq("tenant_id", tenantId.trim())
    .eq("integration_id", integrationId.trim())
    .order("is_primary", { ascending: false })
    .order("google_calendar_summary", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as InboundSyncCalendarDbRow[]).map(inboundSyncCalendarRowToClient);
}

/** Load sanitized inbound scope page model for FI Admin (no tokens). */
export async function loadGoogleCalendarInboundScopePage(
  tenantId: string,
  opts: ServerOpts & { canManage?: boolean } = {}
): Promise<GoogleCalendarInboundScopePageModel> {
  const tid = tenantId.trim();
  const integration = await loadActiveIntegrationRow(tid, opts);
  const connected = Boolean(integration?.access_token_encrypted?.trim() && integration.status !== "disconnected");

  let calendars: InboundSyncCalendarClientRow[] = [];
  if (integration && connected) {
    calendars = await loadInboundSyncCalendars(tid, integration.id, opts);
  }

  const stats = buildInboundScopePageStats(calendars, integration
    ? {
        lastSyncedAt: integration.last_synced_at,
        lastSyncStatus: (integration.last_sync_status ?? "never_synced") as FiCalendarSyncStatus,
        lastSyncErrorSummary:
          integration.last_sync_status === "failed"
            ? summarizeSyncError(integration.last_sync_error)
            : null,
      }
    : null);

  return {
    tenantId: tid,
    canManage: opts.canManage ?? false,
    connected,
    integrationId: integration?.id ?? null,
    googleAccountEmail: integration?.google_account_email?.trim() ?? null,
    outboundCalendarId: integration?.calendar_id?.trim() ?? null,
    calendars,
    stats,
  };
}

export async function setGoogleInboundSyncCalendarEnabled(
  input: {
    tenantId: string;
    calendarRowId: string;
    isEnabled: boolean;
    actorAuthUserId: string;
  },
  opts: ServerOpts = {}
): Promise<{ ok: true; calendar: InboundSyncCalendarClientRow } | { ok: false; error: string }> {
  const tenantId = input.tenantId.trim();
  const calendarRowId = input.calendarRowId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("fi_calendar_inbound_sync_calendars")
    .select(INBOUND_SELECT)
    .eq("id", calendarRowId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!existing) return { ok: false, error: "Inbound calendar scope not found." };

  const row = existing as InboundSyncCalendarDbRow;
  if (row.is_enabled === input.isEnabled) {
    return { ok: true, calendar: inboundSyncCalendarRowToClient(row) };
  }

  const { data: updated, error: updateError } = await supabase
    .from("fi_calendar_inbound_sync_calendars")
    .update({ is_enabled: input.isEnabled, updated_at: now })
    .eq("id", calendarRowId)
    .eq("tenant_id", tenantId)
    .select(INBOUND_SELECT)
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) return { ok: false, error: "Failed to update inbound calendar scope." };

  const calendar = inboundSyncCalendarRowToClient(updated as InboundSyncCalendarDbRow);

  logStructured("info", "google_calendar_inbound_scope_admin_toggled", {
    tenantId,
    calendarRowId,
    googleCalendarId: calendar.googleCalendarId,
    isEnabled: input.isEnabled,
    actorAuthUserId: input.actorAuthUserId,
  });

  return { ok: true, calendar };
}

export async function refreshGoogleInboundCalendarScopes(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<
  | { ok: true; calendarsDiscovered: number; inserted: number; updated: number; preservedEnabledState: number }
  | { ok: false; error: string }
> {
  const tid = tenantId.trim();
  const tokenResult = await resolveGoogleCalendarAccessToken(tid, opts);
  if (!tokenResult.ok) return { ok: false, error: tokenResult.error };

  const { accessToken, integration } = tokenResult.data!;
  const seedResult = await seedGoogleInboundCalendarScopesFromCalendarList(
    {
      tenantId: tid,
      integrationId: integration.id,
      googleAccountEmail: integration.googleAccountEmail,
      accessToken,
      defaultCalendarId: integration.calendarId,
    },
    opts
  );

  if (!seedResult.ok) return { ok: false, error: seedResult.error };

  logStructured("info", "google_calendar_inbound_scope_admin_refreshed", {
    tenantId: tid,
    integrationId: integration.id,
    calendarsDiscovered: seedResult.calendarsDiscovered,
    inserted: seedResult.inserted,
    updated: seedResult.updated,
    preservedEnabledState: seedResult.preservedEnabledState,
  });

  return {
    ok: true,
    calendarsDiscovered: seedResult.calendarsDiscovered,
    inserted: seedResult.inserted,
    updated: seedResult.updated,
    preservedEnabledState: seedResult.preservedEnabledState,
  };
}

function mapSyncResultToAdminSummary(result: GoogleCalendarSyncResult): GoogleCalendarInboundSyncNowSummary {
  const perCalendar = (result.perCalendar ?? []).map((row) => ({
    calendarId: row.calendarId,
    calendarSummary: row.calendarSummary,
    fetched: row.eventsFetched,
    inserted: row.eventsInserted,
    updated: row.eventsUpdated,
    skipped: row.eventsSkipped,
    failed: Boolean(row.failed),
    error: row.error ?? null,
  }));

  return {
    calendarsScanned: result.calendarsScanned ?? perCalendar.length,
    fetched: result.eventsFetchedTotal ?? result.discovered,
    inserted: result.eventsInsertedTotal ?? result.created,
    updated: result.eventsUpdatedTotal ?? result.updated,
    skipped: result.eventsSkippedTotal ?? result.skipped,
    failed: result.failedCalendars?.length ?? perCalendar.filter((r) => r.failed).length,
    perCalendar,
  };
}

export async function runGoogleCalendarInboundSyncNow(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<
  | { ok: true; outcome: "synced"; summary: GoogleCalendarInboundSyncNowSummary }
  | { ok: false; outcome: "failed" | "skipped"; error: string; summary?: GoogleCalendarInboundSyncNowSummary }
> {
  const tid = tenantId.trim();
  const syncSummary = await syncGoogleCalendarForTenant({ tenantId: tid }, opts);

  logStructured("info", "google_calendar_inbound_sync_admin_triggered", {
    tenantId: tid,
    integrationId: syncSummary.integrationId || null,
    outcome: syncSummary.outcome,
    error: syncSummary.error ?? null,
    calendarsScanned: syncSummary.result?.calendarsScanned ?? null,
    eventsFetched: syncSummary.result?.eventsFetchedTotal ?? syncSummary.result?.discovered ?? null,
    eventsInserted: syncSummary.result?.eventsInsertedTotal ?? syncSummary.result?.created ?? null,
    eventsUpdated: syncSummary.result?.eventsUpdatedTotal ?? syncSummary.result?.updated ?? null,
    eventsSkipped: syncSummary.result?.eventsSkippedTotal ?? syncSummary.result?.skipped ?? null,
    failedCalendarCount: syncSummary.result?.failedCalendars?.length ?? null,
  });

  if (syncSummary.outcome === "skipped") {
    return {
      ok: false,
      outcome: "skipped",
      error: syncSummary.error ?? "Sync skipped — no active integration.",
    };
  }

  if (syncSummary.outcome === "failed") {
    return {
      ok: false,
      outcome: "failed",
      error: syncSummary.error ?? "Inbound sync failed.",
      summary: syncSummary.result ? mapSyncResultToAdminSummary(syncSummary.result) : undefined,
    };
  }

  return {
    ok: true,
    outcome: "synced",
    summary: mapSyncResultToAdminSummary(syncSummary.result!),
  };
}

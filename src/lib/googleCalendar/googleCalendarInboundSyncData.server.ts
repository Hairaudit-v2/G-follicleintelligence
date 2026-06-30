import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  buildGoogleInboundCalendarScopeMetadata,
  isGoogleCalendarAuthFailure,
  parseGoogleCalendarListEntriesResponse,
  resolveGoogleInboundCalendarIsPrimary,
  resolveGoogleInboundCalendarSummary,
  shouldEnableGoogleInboundCalendarByDefault,
} from "./googleCalendarCore";
import type {
  FiCalendarIntegration,
  GoogleCalendarListEntry,
  GoogleInboundScopeSeedResult,
} from "./googleCalendarTypes";

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export type GoogleInboundCalendarScope = {
  calendarId: string;
  summary: string | null;
  isPrimary: boolean;
  inboundRowId: string | null;
};

type InboundSyncCalendarRow = {
  id: string;
  google_calendar_id: string;
  google_calendar_summary: string | null;
  is_primary: boolean;
  is_enabled: boolean;
};

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
};

export type SeedGoogleInboundCalendarScopesInput = {
  tenantId: string;
  integrationId: string;
  googleAccountEmail: string | null;
  accessToken: string;
  defaultCalendarId: string;
};

export async function fetchGoogleCalendarListEntries(
  accessToken: string,
  opts: { fetchOverride?: typeof fetch } = {}
): Promise<
  | { ok: true; entries: GoogleCalendarListEntry[] }
  | { ok: false; error: string; authFailure: boolean }
> {
  const fetchFn = opts.fetchOverride ?? fetch;

  logStructured("info", "google_calendar_calendar_list_fetch_start", {});

  const res = await fetchFn(`${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList?maxResults=250`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = `Google calendarList failed (${res.status}): ${body.slice(0, 300)}`;
    const authFailure = isGoogleCalendarAuthFailure(error);
    logStructured(authFailure ? "error" : "warn", "google_calendar_calendar_list_fetch_complete", {
      ok: false,
      status: res.status,
      authFailure,
    });
    return { ok: false, error, authFailure };
  }

  const json = await res.json();
  const entries = parseGoogleCalendarListEntriesResponse(json).filter((entry) => entry.id?.trim());

  logStructured("info", "google_calendar_calendar_list_fetch_complete", {
    ok: true,
    calendarsDiscovered: entries.length,
  });

  return { ok: true, entries };
}

/** Fetch Google calendarList and upsert inbound sync scopes idempotently (GC-6A). */
export async function seedGoogleInboundCalendarScopesFromCalendarList(
  input: SeedGoogleInboundCalendarScopesInput,
  opts: ServerOpts = {}
): Promise<GoogleInboundScopeSeedResult> {
  const tenantId = input.tenantId.trim();
  const integrationId = input.integrationId.trim();
  const defaultCalendarId = input.defaultCalendarId.trim() || "primary";

  if (!tenantId || !integrationId || !input.accessToken.trim()) {
    return { ok: false, error: "Tenant id, integration id, and access token are required." };
  }

  const listResult = await fetchGoogleCalendarListEntries(input.accessToken, {
    fetchOverride: opts.fetchOverride,
  });
  if (!listResult.ok) {
    logStructured("warn", "google_calendar_inbound_scope_seed_complete", {
      ok: false,
      tenantId,
      integrationId,
      error: listResult.error,
    });
    return { ok: false, error: listResult.error };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data: existingData, error: existingError } = await supabase
    .from("fi_calendar_inbound_sync_calendars")
    .select("id, google_calendar_id, google_calendar_summary, is_enabled, is_primary")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId);

  if (existingError) {
    const error = existingError.message;
    logStructured("warn", "google_calendar_inbound_scope_seed_complete", {
      ok: false,
      tenantId,
      integrationId,
      error,
    });
    return { ok: false, error };
  }

  const existingByCalendarId = new Map<string, InboundSyncCalendarRow>();
  for (const row of (existingData ?? []) as InboundSyncCalendarRow[]) {
    existingByCalendarId.set(row.google_calendar_id.trim(), row);
  }

  const counts = {
    calendarsDiscovered: listResult.entries.length,
    inserted: 0,
    updated: 0,
    preservedEnabledState: 0,
    enabledByDefault: 0,
    disabledByDefault: 0,
  };

  const now = new Date().toISOString();

  for (const entry of listResult.entries) {
    const googleCalendarId = entry.id!.trim();
    const summary = resolveGoogleInboundCalendarSummary(entry);
    const isPrimary = resolveGoogleInboundCalendarIsPrimary(entry, defaultCalendarId);
    const metadata = buildGoogleInboundCalendarScopeMetadata(entry);
    const existing = existingByCalendarId.get(googleCalendarId);

    if (existing) {
      const { error } = await supabase
        .from("fi_calendar_inbound_sync_calendars")
        .update({
          google_calendar_summary: summary,
          is_primary: isPrimary,
          metadata,
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("tenant_id", tenantId);

      if (error) {
        logStructured("warn", "google_calendar_inbound_scope_seed_complete", {
          ok: false,
          tenantId,
          integrationId,
          error: error.message,
        });
        return { ok: false, error: error.message };
      }

      counts.updated += 1;
      counts.preservedEnabledState += 1;
      logStructured("info", "google_calendar_inbound_scope_updated", {
        tenantId,
        integrationId,
        googleCalendarId,
        isEnabled: existing.is_enabled,
      });
      logStructured("info", "google_calendar_inbound_scope_preserved", {
        tenantId,
        integrationId,
        googleCalendarId,
        isEnabled: existing.is_enabled,
      });
      continue;
    }

    const isEnabled = shouldEnableGoogleInboundCalendarByDefault(entry, input.googleAccountEmail);
    const { error } = await supabase.from("fi_calendar_inbound_sync_calendars").insert({
      tenant_id: tenantId,
      integration_id: integrationId,
      provider: "google",
      google_calendar_id: googleCalendarId,
      google_calendar_summary: summary,
      is_enabled: isEnabled,
      is_primary: isPrimary,
      metadata,
      updated_at: now,
    });

    if (error) {
      logStructured("warn", "google_calendar_inbound_scope_seed_complete", {
        ok: false,
        tenantId,
        integrationId,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }

    counts.inserted += 1;
    if (isEnabled) counts.enabledByDefault += 1;
    else counts.disabledByDefault += 1;

    logStructured("info", "google_calendar_inbound_scope_seeded", {
      tenantId,
      integrationId,
      googleCalendarId,
      isEnabled,
      isPrimary,
    });
  }

  logStructured("info", "google_calendar_inbound_scope_seed_complete", {
    ok: true,
    tenantId,
    integrationId,
    ...counts,
  });

  return { ok: true, ...counts };
}

/** Enabled inbound Google calendars for an integration; falls back to integration primary when none configured. */
export async function getGoogleInboundCalendarScopesForIntegration(
  integration: FiCalendarIntegration,
  opts: ServerOpts = {}
): Promise<GoogleInboundCalendarScope[]> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_calendar_inbound_sync_calendars")
    .select("id, google_calendar_id, google_calendar_summary, is_primary")
    .eq("integration_id", integration.id)
    .eq("tenant_id", integration.tenantId)
    .eq("is_enabled", true)
    .order("is_primary", { ascending: false })
    .order("google_calendar_summary", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as InboundSyncCalendarRow[];
  if (rows.length === 0) {
    const fallbackId = integration.calendarId.trim() || "primary";
    return [
      {
        calendarId: fallbackId,
        summary:
          integration.googleAccountEmail?.trim() ||
          (fallbackId === "primary" ? "primary" : fallbackId),
        isPrimary: true,
        inboundRowId: null,
      },
    ];
  }

  return rows.map((row) => ({
    calendarId: row.google_calendar_id.trim(),
    summary: row.google_calendar_summary?.trim() ?? null,
    isPrimary: row.is_primary,
    inboundRowId: row.id,
  }));
}

export async function touchInboundSyncCalendarLastSynced(
  inboundRowId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<void> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_inbound_sync_calendars")
    .update({ last_synced_at: now, updated_at: now })
    .eq("id", inboundRowId)
    .eq("tenant_id", tenantId.trim());

  if (error) throw new Error(error.message);
}

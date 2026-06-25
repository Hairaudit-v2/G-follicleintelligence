import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { isAccessTokenExpired } from "./googleCalendarCore";
import type { FiCalendarIntegrationStatus } from "./googleCalendarTypes";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

type IntegrationStatusRow = {
  google_account_email: string | null;
  calendar_id: string;
  token_expires_at: string | null;
  status: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
};

export type GoogleCalendarConnectionStatus = {
  connected: boolean;
  google_account_email: string | null;
  calendar_id: string | null;
  status: FiCalendarIntegrationStatus | "not_connected";
  token_expires_at: string | null;
  last_synced_at: string | null;
  can_create_meet: boolean;
};

function deriveDisplayStatus(row: IntegrationStatusRow | null): GoogleCalendarConnectionStatus["status"] {
  if (!row) return "not_connected";
  const status = row.status as FiCalendarIntegrationStatus;
  if (status === "disconnected") return "not_connected";
  return status;
}

function isConnected(row: IntegrationStatusRow | null): boolean {
  if (!row) return false;
  if (row.status === "disconnected") return false;
  return Boolean(row.access_token_encrypted?.trim());
}

function canCreateMeet(row: IntegrationStatusRow | null): boolean {
  if (!isConnected(row)) return false;
  if (row!.status !== "active") return false;
  return Boolean(row!.refresh_token_encrypted?.trim());
}

async function loadLastSyncedAt(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_calendar_events")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return null;

  let latest: string | null = null;
  for (const row of data ?? []) {
    const meta = (row as { metadata?: Record<string, unknown> }).metadata;
    const synced = meta?.last_synced_at;
    if (typeof synced === "string" && synced.trim()) {
      const candidate = synced.trim();
      if (!latest || Date.parse(candidate) > Date.parse(latest)) {
        latest = candidate;
      }
    }
  }
  return latest;
}

/** Load sanitized Google Calendar connection status for FI Admin (no token exposure). */
export async function loadGoogleCalendarConnectionStatus(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<GoogleCalendarConnectionStatus> {
  const tid = tenantId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_calendar_integrations")
    .select(
      "google_account_email, calendar_id, token_expires_at, status, access_token_encrypted, refresh_token_encrypted"
    )
    .eq("tenant_id", tid)
    .neq("status", "disconnected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = (data as IntegrationStatusRow | null) ?? null;
  const lastSyncedAt = await loadLastSyncedAt(supabase, tid);

  const connected = isConnected(row);
  const displayStatus = deriveDisplayStatus(row);

  let effectiveStatus = displayStatus;
  if (connected && row && isAccessTokenExpired(row.token_expires_at) && row.status === "active") {
    effectiveStatus = row.refresh_token_encrypted?.trim() ? "active" : "expired";
  }

  return {
    connected,
    google_account_email: row?.google_account_email?.trim() ?? null,
    calendar_id: row?.calendar_id?.trim() ?? null,
    status: effectiveStatus,
    token_expires_at: row?.token_expires_at ?? null,
    last_synced_at: lastSyncedAt,
    can_create_meet: canCreateMeet(row),
  };
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { isAccessTokenExpired } from "./googleCalendarCore";
import { loadGoogleCalendarSyncHealth } from "./googleCalendarSync.server";
import type { FiCalendarIntegrationStatus, FiCalendarSyncStatus } from "./googleCalendarTypes";

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
  last_synced_at: string | null;
  last_sync_status: string;
  last_sync_error: string | null;
  sync_failure_count: number;
  last_validated_at: string | null;
  last_validation_status: string | null;
};

export type GoogleCalendarConnectionStatus = {
  connected: boolean;
  google_account_email: string | null;
  calendar_id: string | null;
  status: FiCalendarIntegrationStatus | "not_connected";
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_sync_status: FiCalendarSyncStatus;
  sync_failure_count: number;
  last_sync_error_summary: string | null;
  last_validated_at: string | null;
  can_create_meet: boolean;
  sync_health_label: "healthy" | "needs_attention" | "not_synced";
};

function deriveDisplayStatus(
  row: IntegrationStatusRow | null
): GoogleCalendarConnectionStatus["status"] {
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

function summarizeSyncError(message: string | null | undefined): string | null {
  if (!message?.trim()) return null;
  const trimmed = message.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}…`;
}

function deriveSyncHealthLabel(
  row: IntegrationStatusRow | null,
  connected: boolean
): GoogleCalendarConnectionStatus["sync_health_label"] {
  if (!connected || !row) return "not_synced";
  if (row.last_sync_status === "never_synced") return "not_synced";
  if (row.last_sync_status === "failed" || (row.sync_failure_count ?? 0) > 0) {
    return "needs_attention";
  }
  return "healthy";
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
      "google_account_email, calendar_id, token_expires_at, status, access_token_encrypted, refresh_token_encrypted, last_synced_at, last_sync_status, last_sync_error, sync_failure_count, last_validated_at, last_validation_status"
    )
    .eq("tenant_id", tid)
    .neq("status", "disconnected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = (data as IntegrationStatusRow | null) ?? null;
  const connected = isConnected(row);
  const displayStatus = deriveDisplayStatus(row);

  let effectiveStatus = displayStatus;
  if (connected && row && isAccessTokenExpired(row.token_expires_at) && row.status === "active") {
    effectiveStatus = row.refresh_token_encrypted?.trim() ? "active" : "expired";
  }

  const syncHealth = await loadGoogleCalendarSyncHealth({ tenantId: tid }, opts);

  return {
    connected,
    google_account_email: row?.google_account_email?.trim() ?? null,
    calendar_id: row?.calendar_id?.trim() ?? null,
    status: effectiveStatus,
    token_expires_at: row?.token_expires_at ?? null,
    last_synced_at: row?.last_synced_at ?? syncHealth.last_synced_at,
    last_sync_status: (row?.last_sync_status ?? "never_synced") as FiCalendarSyncStatus,
    sync_failure_count: row?.sync_failure_count ?? 0,
    last_sync_error_summary:
      row?.last_sync_status === "failed" ? summarizeSyncError(row.last_sync_error) : null,
    last_validated_at: row?.last_validated_at ?? syncHealth.last_validated_at,
    can_create_meet: canCreateMeet(row),
    sync_health_label: deriveSyncHealthLabel(row, connected),
  };
}

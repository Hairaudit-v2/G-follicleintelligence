import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SupabaseClient } from "@supabase/supabase-js";

import { syncGoogleCalendarEvents } from "./googleCalendarService.server";
import type {
  FiCalendarSyncStatus,
  FiCalendarValidationStatus,
  GoogleCalendarSyncResult,
} from "./googleCalendarTypes";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";

export const GOOGLE_CALENDAR_SYNC_MAX_TENANTS = 50;

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
};

type IntegrationSyncRow = {
  id: string;
  tenant_id: string;
  calendar_id: string;
  status: string;
  google_account_email: string | null;
  token_expires_at: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  last_synced_at: string | null;
  last_sync_status: string;
  last_sync_error: string | null;
  sync_failure_count: number;
  last_validated_at: string | null;
  last_validation_status: string | null;
  last_validation_error: string | null;
};

export type GoogleCalendarTenantSyncSummary = {
  tenantId: string;
  integrationId: string;
  calendarId: string;
  outcome: "synced" | "failed" | "skipped";
  error?: string;
  result?: GoogleCalendarSyncResult;
};

export type GoogleCalendarSyncCronResponse = {
  success: boolean;
  synced: number;
  failed: number;
  skipped: number;
  tenants: GoogleCalendarTenantSyncSummary[];
  source: "vercel_cron";
};

export type GoogleCalendarSyncHealth = {
  connected: boolean;
  last_synced_at: string | null;
  last_sync_status: FiCalendarSyncStatus;
  sync_failure_count: number;
  last_sync_error_summary: string | null;
  last_validated_at: string | null;
  last_validation_status: FiCalendarValidationStatus | null;
  token_expires_at: string | null;
  can_create_meet: boolean;
};

export type GoogleCalendarSyncDiagnostics = GoogleCalendarSyncHealth & {
  integration_id: string | null;
  calendar_id: string | null;
  google_account_email: string | null;
  integration_status: string | null;
  last_validation_error_summary: string | null;
  recent_sync_result: GoogleCalendarSyncResult | null;
};

function sanitizeSyncError(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/access_token[=:]\S+/gi, "access_token=[redacted]")
    .replace(/refresh_token[=:]\S+/gi, "refresh_token=[redacted]")
    .slice(0, 500);
}

function summarizeError(message: string | null | undefined): string | null {
  if (!message?.trim()) return null;
  const sanitized = sanitizeSyncError(message.trim());
  if (sanitized.length <= 120) return sanitized;
  return `${sanitized.slice(0, 117)}…`;
}

async function loadActiveIntegrations(
  supabase: SupabaseClient,
  tenantId?: string
): Promise<IntegrationSyncRow[]> {
  let query = supabase
    .from("fi_calendar_integrations")
    .select(
      "id, tenant_id, calendar_id, status, google_account_email, token_expires_at, access_token_encrypted, refresh_token_encrypted, last_synced_at, last_sync_status, last_sync_error, sync_failure_count, last_validated_at, last_validation_status, last_validation_error"
    )
    .eq("status", "active")
    .order("last_synced_at", { ascending: true, nullsFirst: true });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as IntegrationSyncRow[];
}

async function recordSyncSuccess(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_integrations")
    .update({
      last_synced_at: now,
      last_sync_status: "success",
      last_sync_error: null,
      sync_failure_count: 0,
      updated_at: now,
    })
    .eq("id", integrationId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}

async function recordSyncFailure(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string,
  currentFailureCount: number,
  errorMessage: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_integrations")
    .update({
      last_synced_at: now,
      last_sync_status: "failed",
      last_sync_error: sanitizeSyncError(errorMessage),
      sync_failure_count: currentFailureCount + 1,
      updated_at: now,
    })
    .eq("id", integrationId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}

function canCreateMeet(row: IntegrationSyncRow | null): boolean {
  if (!row || row.status !== "active") return false;
  return Boolean(row.refresh_token_encrypted?.trim());
}

function mapHealthFromRow(row: IntegrationSyncRow | null): GoogleCalendarSyncHealth {
  const connected = Boolean(row?.access_token_encrypted?.trim() && row.status !== "disconnected");
  return {
    connected,
    last_synced_at: row?.last_synced_at ?? null,
    last_sync_status: (row?.last_sync_status ?? "never_synced") as FiCalendarSyncStatus,
    sync_failure_count: row?.sync_failure_count ?? 0,
    last_sync_error_summary:
      row?.last_sync_status === "failed" ? summarizeError(row.last_sync_error) : null,
    last_validated_at: row?.last_validated_at ?? null,
    last_validation_status: (row?.last_validation_status as FiCalendarValidationStatus | null) ?? null,
    token_expires_at: row?.token_expires_at ?? null,
    can_create_meet: canCreateMeet(row),
  };
}

async function loadLatestIntegrationRow(
  supabase: SupabaseClient,
  tenantId: string
): Promise<IntegrationSyncRow | null> {
  const { data, error } = await supabase
    .from("fi_calendar_integrations")
    .select(
      "id, tenant_id, calendar_id, status, google_account_email, token_expires_at, access_token_encrypted, refresh_token_encrypted, last_synced_at, last_sync_status, last_sync_error, sync_failure_count, last_validated_at, last_validation_status, last_validation_error"
    )
    .eq("tenant_id", tenantId.trim())
    .neq("status", "disconnected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as IntegrationSyncRow | null) ?? null;
}

/** Sync Google Calendar events for a single tenant's active integration. */
export async function syncGoogleCalendarForTenant(
  input: { tenantId: string; limit?: number },
  opts: ServerOpts = {}
): Promise<GoogleCalendarTenantSyncSummary> {
  const tenantId = input.tenantId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const integrations = await loadActiveIntegrations(supabase, tenantId);
  const integration = integrations[0];

  if (!integration) {
    return {
      tenantId,
      integrationId: "",
      calendarId: "",
      outcome: "skipped",
      error: "No active Google Calendar integration.",
    };
  }

  const syncResult = await syncGoogleCalendarEvents(tenantId, {
    supabaseClientForTests: opts.supabaseClientForTests,
    fetchOverride: opts.fetchOverride,
    integrationId: integration.id,
    lookaheadDays: 180,
    lookbackDays: 30,
  });

  if (!syncResult.ok) {
    await recordSyncFailure(
      supabase,
      integration.id,
      tenantId,
      integration.sync_failure_count ?? 0,
      syncResult.error
    );
    return {
      tenantId,
      integrationId: integration.id,
      calendarId: integration.calendar_id,
      outcome: "failed",
      error: summarizeError(syncResult.error) ?? syncResult.error,
    };
  }

  await recordSyncSuccess(supabase, integration.id, tenantId);

  return {
    tenantId,
    integrationId: integration.id,
    calendarId: integration.calendar_id,
    outcome: "synced",
    result: syncResult.data.result,
  };
}

/** Sync all tenants with active Google Calendar integrations. */
export async function syncGoogleCalendarForAllTenants(
  input: { limitPerTenant?: number } = {},
  opts: ServerOpts = {}
): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  skipped: number;
  tenants: GoogleCalendarTenantSyncSummary[];
}> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const maxTenants = Math.min(
    input.limitPerTenant ?? GOOGLE_CALENDAR_SYNC_MAX_TENANTS,
    GOOGLE_CALENDAR_SYNC_MAX_TENANTS
  );

  const integrations = await loadActiveIntegrations(supabase);
  const tenantIds = [...new Set(integrations.map((r) => r.tenant_id))].slice(0, maxTenants);

  const tenants: GoogleCalendarTenantSyncSummary[] = [];
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const tenantId of tenantIds) {
    const summary = await syncGoogleCalendarForTenant({ tenantId }, opts);
    tenants.push(summary);
    if (summary.outcome === "synced") synced += 1;
    else if (summary.outcome === "failed") failed += 1;
    else skipped += 1;
  }

  return {
    success: failed === 0,
    synced,
    failed,
    skipped,
    tenants,
  };
}

/** Load sanitized sync health for FI Admin (no tokens). */
export async function loadGoogleCalendarSyncHealth(
  input: { tenantId: string },
  opts: ServerOpts = {}
): Promise<GoogleCalendarSyncHealth> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const row = await loadLatestIntegrationRow(supabase, input.tenantId);
  return mapHealthFromRow(row);
}

/** Load sanitized sync diagnostics for admin/backend (no tokens or event payloads). */
export async function loadGoogleCalendarSyncDiagnostics(
  input: { tenantId: string },
  opts: ServerOpts = {}
): Promise<GoogleCalendarSyncDiagnostics> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const row = await loadLatestIntegrationRow(supabase, input.tenantId);
  const health = mapHealthFromRow(row);

  return {
    ...health,
    integration_id: row?.id ?? null,
    calendar_id: row?.calendar_id ?? null,
    google_account_email: row?.google_account_email?.trim() ?? null,
    integration_status: row?.status ?? null,
    last_validation_error_summary: summarizeError(row?.last_validation_error),
    recent_sync_result: null,
  };
}

export type GoogleCalendarSyncCronOptions = {
  getEnv?: (key: string) => string | undefined;
  syncForTenant?: typeof syncGoogleCalendarForTenant;
  syncForAllTenants?: typeof syncGoogleCalendarForAllTenants;
};

function resolveGetEnv(opts?: GoogleCalendarSyncCronOptions): (key: string) => string | undefined {
  return opts?.getEnv ?? ((key) => process.env[key]);
}

function parseCronQueryParams(
  req: NextRequest
): { tenantId?: string; limit?: number } | NextResponse<{ success: false; error: string }> {
  const url = new URL(req.url);
  const tenantIdRaw = url.searchParams.get("tenantId")?.trim();
  if (tenantIdRaw && !z.string().uuid().safeParse(tenantIdRaw).success) {
    return NextResponse.json({ success: false, error: "Invalid tenantId." }, { status: 400 });
  }

  const limitRaw = url.searchParams.get("limit");
  let limit: number | undefined;
  if (limitRaw != null && limitRaw.trim() !== "") {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return NextResponse.json({ success: false, error: "Invalid limit." }, { status: 400 });
    }
    limit = Math.min(parsed, GOOGLE_CALENDAR_SYNC_MAX_TENANTS);
  }

  return { tenantId: tenantIdRaw || undefined, limit };
}

/** GET handler for `/api/cron/google-calendar/sync`. */
export async function handleGoogleCalendarSyncCronGet(
  req: NextRequest,
  opts?: GoogleCalendarSyncCronOptions
): Promise<Response> {
  if (req.method !== "GET") {
    return NextResponse.json({ success: false, error: "Method not allowed." }, { status: 405 });
  }

  const getEnv = resolveGetEnv(opts);
  const auth = assertCronAuthorized(
    req,
    [getEnv("CRON_SECRET") ?? "", getEnv("FI_GOOGLE_CALENDAR_CRON_SECRET") ?? ""],
    { alternateTimingSafeHeaderName: "x-fi-google-calendar-secret" }
  );
  if (auth) return auth;

  const parsed = parseCronQueryParams(req);
  if (parsed instanceof NextResponse) return parsed;

  const syncForTenant = opts?.syncForTenant ?? syncGoogleCalendarForTenant;
  const syncForAllTenants = opts?.syncForAllTenants ?? syncGoogleCalendarForAllTenants;

  try {
    if (parsed.tenantId) {
      const summary = await syncForTenant({ tenantId: parsed.tenantId, limit: parsed.limit });
      const body: GoogleCalendarSyncCronResponse = {
        success: summary.outcome !== "failed",
        synced: summary.outcome === "synced" ? 1 : 0,
        failed: summary.outcome === "failed" ? 1 : 0,
        skipped: summary.outcome === "skipped" ? 1 : 0,
        tenants: [summary],
        source: "vercel_cron",
      };
      return NextResponse.json(body);
    }

    const result = await syncForAllTenants({ limitPerTenant: parsed.limit });
    const body: GoogleCalendarSyncCronResponse = {
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      skipped: result.skipped,
      tenants: result.tenants,
      source: "vercel_cron",
    };
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "google_calendar_sync_cron_failed", { message });
    return NextResponse.json({ success: false, error: "Processor unavailable." }, { status: 500 });
  }
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  isGoogleCalendarSyncDue,
  type FiCalendarSyncFrequencyMinutes,
} from "./googleCalendarSyncHealthCore";
import {
  syncGoogleCalendarForTenant,
  type GoogleCalendarTenantSyncSummary,
} from "./googleCalendarSync.server";
import {
  markExpiredGoogleCalendarWebhookSubscriptions,
  renewExpiringGoogleCalendarWebhookSubscriptions,
  tenantHasActiveWebhookSubscription,
} from "./googleCalendarWebhookSubscriptions.server";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
  nowMs?: number;
};

type SchedulableIntegrationRow = {
  id: string;
  tenant_id: string;
  calendar_id: string;
  status: string;
  sync_enabled: boolean;
  scheduled_sync_enabled: boolean;
  sync_frequency_minutes: number;
  scheduled_sync_paused_at: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
};

export type GoogleCalendarScheduledSyncSummary = {
  tenantId: string;
  integrationId: string;
  outcome: "synced" | "failed" | "skipped";
  skipReason?: string;
  error?: string;
  result?: GoogleCalendarTenantSyncSummary["result"];
};

export type RunScheduledGoogleCalendarSyncResult = {
  success: boolean;
  synced: number;
  failed: number;
  skipped: number;
  tenants: GoogleCalendarScheduledSyncSummary[];
  source: "scheduled";
  webhookRenewals?: { renewed: number; failed: number; expired: number };
};

const SCHEDULER_SELECT =
  "id, tenant_id, calendar_id, status, sync_enabled, scheduled_sync_enabled, sync_frequency_minutes, scheduled_sync_paused_at, access_token_encrypted, refresh_token_encrypted";

function hasValidOAuthTokens(row: SchedulableIntegrationRow): boolean {
  return Boolean(row.access_token_encrypted?.trim() || row.refresh_token_encrypted?.trim());
}

function isSchedulerEligible(row: SchedulableIntegrationRow): boolean {
  if (row.status !== "active") return false;
  if (!row.sync_enabled) return false;
  if (!row.scheduled_sync_enabled) return false;
  if (row.scheduled_sync_paused_at) return false;
  if (!hasValidOAuthTokens(row)) return false;
  return true;
}

async function loadSchedulableIntegrations(
  supabase: SupabaseClient,
  tenantId?: string
): Promise<SchedulableIntegrationRow[]> {
  let query = supabase
    .from("fi_calendar_integrations")
    .select(SCHEDULER_SELECT)
    .eq("status", "active")
    .eq("sync_enabled", true)
    .eq("scheduled_sync_enabled", true)
    .is("scheduled_sync_paused_at", null)
    .order("updated_at", { ascending: true });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SchedulableIntegrationRow[];
}

async function loadHealthLastStarted(
  supabase: SupabaseClient,
  integrationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_calendar_sync_health")
    .select("last_sync_started_at")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.last_sync_started_at as string | null) ?? null;
}

/**
 * Run scheduled Google Calendar sync for all eligible tenants.
 * Called by Vercel cron every 15 minutes; respects per-tenant frequency settings.
 */
export async function runScheduledGoogleCalendarSync(
  input: { tenantId?: string; limit?: number } = {},
  opts: ServerOpts = {}
): Promise<RunScheduledGoogleCalendarSyncResult> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const nowMs = opts.nowMs ?? Date.now();
  const maxTenants = Math.min(input.limit ?? 50, 50);

  const expiredCount = await markExpiredGoogleCalendarWebhookSubscriptions(opts);
  const webhookRenewals = await renewExpiringGoogleCalendarWebhookSubscriptions(opts);

  const integrations = (await loadSchedulableIntegrations(supabase, input.tenantId)).filter(
    isSchedulerEligible
  );

  const tenantIds = [...new Set(integrations.map((r) => r.tenant_id))].slice(0, maxTenants);
  const tenants: GoogleCalendarScheduledSyncSummary[] = [];
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const tenantId of tenantIds) {
    const integration = integrations.find((row) => row.tenant_id === tenantId);
    if (!integration) continue;

    const frequency = integration.sync_frequency_minutes as FiCalendarSyncFrequencyMinutes;
    const lastStarted = await loadHealthLastStarted(supabase, integration.id);

    const hasActiveWebhook = await tenantHasActiveWebhookSubscription(tenantId, {
      ...opts,
      nowMs,
    });

    if (hasActiveWebhook) {
      tenants.push({
        tenantId,
        integrationId: integration.id,
        outcome: "skipped",
        skipReason: "realtime_webhook_active",
      });
      skipped += 1;
      continue;
    }

    if (!isGoogleCalendarSyncDue(lastStarted, frequency, nowMs)) {
      tenants.push({
        tenantId,
        integrationId: integration.id,
        outcome: "skipped",
        skipReason: "not_due",
      });
      skipped += 1;
      continue;
    }

    logStructured("info", "google_calendar_scheduled_sync_start", {
      tenantId,
      integrationId: integration.id,
      frequencyMinutes: frequency,
    });

    const summary = await syncGoogleCalendarForTenant(
      { tenantId, source: "scheduled" },
      { supabaseClientForTests: opts.supabaseClientForTests, fetchOverride: opts.fetchOverride }
    );

    tenants.push({
      tenantId,
      integrationId: integration.id,
      outcome: summary.outcome,
      error: summary.error,
      result: summary.result,
      skipReason: summary.outcome === "skipped" ? summary.error : undefined,
    });

    if (summary.outcome === "synced") synced += 1;
    else if (summary.outcome === "failed") failed += 1;
    else skipped += 1;
  }

  logStructured("info", "google_calendar_scheduled_sync_batch_complete", {
    synced,
    failed,
    skipped,
    tenantCount: tenants.length,
  });

  return {
    success: failed === 0,
    synced,
    failed,
    skipped,
    tenants,
    source: "scheduled",
    webhookRenewals: {
      renewed: webhookRenewals.renewed,
      failed: webhookRenewals.failed,
      expired: expiredCount,
    },
  };
}

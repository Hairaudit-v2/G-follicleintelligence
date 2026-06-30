import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  computeSuccessRatePercent,
  type FiCalendarSyncFrequencyMinutes,
  type FiCalendarSyncHealthStatus,
} from "./googleCalendarSyncHealthCore";
import {
  syncRunRowToClient,
  type GoogleCalendarMonitoringPageModel,
} from "./googleCalendarMonitoringCore";
import {
  loadGoogleCalendarSyncHealthRow,
  loadGoogleCalendarSyncRunHistory,
} from "./googleCalendarSyncHealth.server";
import {
  loadActiveWebhookSubscriptionForTenant,
  type WebhookSubscriptionRow,
} from "./googleCalendarWebhookSubscriptions.server";
import type { GoogleCalendarWebhookHealthModel } from "./googleCalendarMonitoringCore";
import { loadFiEventBusHealthForTenant } from "@/src/lib/events/fiEventBusHealth.server";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

type IntegrationRow = {
  id: string;
  status: string;
  access_token_encrypted: string | null;
  sync_enabled: boolean;
  scheduled_sync_enabled: boolean;
  sync_frequency_minutes: number;
  scheduled_sync_paused_at: string | null;
  scheduled_sync_paused_reason: string | null;
  realtime_sync_enabled: boolean;
};

function deriveWebhookHealth(
  integration: IntegrationRow | null,
  subscription: WebhookSubscriptionRow | null,
  nowMs: number = Date.now()
): GoogleCalendarWebhookHealthModel {
  if (!integration?.realtime_sync_enabled && !subscription) {
    return {
      realtimeSyncEnabled: false,
      subscriptionStatus: "none",
      subscriptionId: null,
      lastNotificationAt: null,
      expirationAt: null,
      failureCount: 0,
      syncMode: "disabled",
    };
  }

  const status = (subscription?.status ??
    "none") as GoogleCalendarWebhookHealthModel["subscriptionStatus"];
  const expirationAt = subscription?.expiration_at ?? null;
  const expMs = expirationAt ? Date.parse(expirationAt) : NaN;
  const isExpiredByTime = Number.isFinite(expMs) && expMs <= nowMs;
  const failureCount = subscription?.failure_count ?? 0;

  let syncMode: GoogleCalendarWebhookHealthModel["syncMode"] = "fallback_polling";
  if (status === "active" && !isExpiredByTime && failureCount < 3) {
    syncMode = "realtime_active";
  } else if (status === "expired" || isExpiredByTime) {
    syncMode = "expired";
  } else if (status === "failed" || failureCount >= 3) {
    syncMode = "failed";
  } else if (!integration?.realtime_sync_enabled) {
    syncMode = "disabled";
  }

  return {
    realtimeSyncEnabled: Boolean(integration?.realtime_sync_enabled),
    subscriptionStatus: status === "none" ? "none" : status,
    subscriptionId: subscription?.id ?? null,
    lastNotificationAt: subscription?.last_notification_at ?? null,
    expirationAt,
    failureCount,
    syncMode,
  };
}

async function loadIntegrationRow(
  tenantId: string,
  opts: ServerOpts
): Promise<IntegrationRow | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_calendar_integrations")
    .select(
      "id, status, access_token_encrypted, sync_enabled, scheduled_sync_enabled, sync_frequency_minutes, scheduled_sync_paused_at, scheduled_sync_paused_reason, realtime_sync_enabled"
    )
    .eq("tenant_id", tenantId.trim())
    .neq("status", "disconnected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as IntegrationRow | null) ?? null;
}

async function countOpenAlerts(
  tenantId: string,
  integrationId: string,
  opts: ServerOpts
): Promise<number> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_admin_notifications")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId.trim())
    .eq("integration_id", integrationId)
    .eq("source", "google_calendar_sync")
    .eq("status", "open");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Load Google Calendar monitoring dashboard data for FI Admin integrations page. */
export async function loadGoogleCalendarMonitoringPage(
  tenantId: string,
  opts: ServerOpts & { canManage?: boolean } = {}
): Promise<GoogleCalendarMonitoringPageModel> {
  const integration = await loadIntegrationRow(tenantId, opts);
  const connected = Boolean(
    integration?.access_token_encrypted?.trim() && integration.status !== "disconnected"
  );

  if (!integration || !connected) {
    return {
      tenantId: tenantId.trim(),
      canManage: opts.canManage ?? false,
      connected: false,
      integrationId: integration?.id ?? null,
      syncEnabled: integration?.sync_enabled ?? true,
      scheduledSyncEnabled: integration?.scheduled_sync_enabled ?? true,
      syncFrequencyMinutes: (integration?.sync_frequency_minutes ??
        15) as FiCalendarSyncFrequencyMinutes,
      schedulerPaused: Boolean(integration?.scheduled_sync_paused_at),
      schedulerPausedReason: integration?.scheduled_sync_paused_reason ?? null,
      healthStatus: "warning",
      healthScore: 0,
      lastSuccessfulSyncAt: null,
      consecutiveFailures: 0,
      successRatePercent: 100,
      metrics: {
        totalSyncRuns: 0,
        totalEventsProcessed: 0,
        totalReviewItemsCreated: 0,
        failedSyncs: 0,
        averageSyncDurationMs: null,
      },
      recentRuns: [],
      openAlertCount: 0,
      webhook: deriveWebhookHealth(integration, null),
      eventBus: await loadFiEventBusHealthForTenant(tenantId, opts),
    };
  }

  const subscription = await loadActiveWebhookSubscriptionForTenant(tenantId, opts);
  const webhook = deriveWebhookHealth(integration, subscription);
  const health = await loadGoogleCalendarSyncHealthRow(
    { tenantId, integrationId: integration.id },
    opts
  );
  const runs = await loadGoogleCalendarSyncRunHistory(
    { tenantId, integrationId: integration.id, limit: 25 },
    opts
  );
  const openAlertCount = await countOpenAlerts(tenantId, integration.id, opts);

  const totalRuns = health?.total_sync_runs ?? 0;
  const failedSyncs = health?.consecutive_failures ?? 0;
  const successRuns = Math.max(
    0,
    totalRuns - (runs.filter((r) => r.status === "failed").length ?? 0)
  );

  const totalEventsProcessed =
    (health?.total_events_fetched ?? 0) +
    (health?.total_events_inserted ?? 0) +
    (health?.total_events_updated ?? 0);

  return {
    tenantId: tenantId.trim(),
    canManage: opts.canManage ?? false,
    connected: true,
    integrationId: integration.id,
    syncEnabled: integration.sync_enabled,
    scheduledSyncEnabled: integration.scheduled_sync_enabled,
    syncFrequencyMinutes: integration.sync_frequency_minutes as FiCalendarSyncFrequencyMinutes,
    schedulerPaused: Boolean(integration.scheduled_sync_paused_at),
    schedulerPausedReason: integration.scheduled_sync_paused_reason,
    healthStatus: (health?.health_status ?? "warning") as FiCalendarSyncHealthStatus,
    healthScore: health?.health_score ?? 0,
    lastSuccessfulSyncAt: health?.last_successful_sync_at ?? null,
    consecutiveFailures: health?.consecutive_failures ?? 0,
    successRatePercent: computeSuccessRatePercent(successRuns, totalRuns),
    metrics: {
      totalSyncRuns: totalRuns,
      totalEventsProcessed,
      totalReviewItemsCreated: health?.total_review_items_created ?? 0,
      failedSyncs,
      averageSyncDurationMs: health?.average_sync_duration_ms ?? null,
    },
    recentRuns: runs.map(syncRunRowToClient),
    openAlertCount,
    webhook,
    eventBus: await loadFiEventBusHealthForTenant(tenantId, opts),
  };
}

export async function setGoogleCalendarScheduledSyncEnabled(
  input: { tenantId: string; enabled: boolean; actorAuthUserId?: string },
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegrationRow(input.tenantId, opts);
  if (!integration) return { ok: false, error: "No Google Calendar integration found." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_integrations")
    .update({
      scheduled_sync_enabled: input.enabled,
      updated_at: now,
    })
    .eq("id", integration.id)
    .eq("tenant_id", input.tenantId.trim());

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setGoogleCalendarSyncFrequency(
  input: { tenantId: string; frequencyMinutes: FiCalendarSyncFrequencyMinutes },
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegrationRow(input.tenantId, opts);
  if (!integration) return { ok: false, error: "No Google Calendar integration found." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_integrations")
    .update({
      sync_frequency_minutes: input.frequencyMinutes,
      updated_at: now,
    })
    .eq("id", integration.id)
    .eq("tenant_id", input.tenantId.trim());

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function pauseGoogleCalendarScheduledSync(
  input: { tenantId: string; reason?: string },
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegrationRow(input.tenantId, opts);
  if (!integration) return { ok: false, error: "No Google Calendar integration found." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_integrations")
    .update({
      scheduled_sync_paused_at: now,
      scheduled_sync_paused_reason: input.reason?.trim() || "Paused manually by admin.",
      updated_at: now,
    })
    .eq("id", integration.id)
    .eq("tenant_id", input.tenantId.trim());

  if (error) return { ok: false, error: error.message };

  const health = await loadGoogleCalendarSyncHealthRow(
    { tenantId: input.tenantId, integrationId: integration.id },
    opts
  );
  if (health) {
    await supabase
      .from("fi_calendar_sync_health")
      .update({ health_status: "paused", updated_at: now })
      .eq("id", health.id);
  }

  return { ok: true };
}

export async function resumeGoogleCalendarScheduledSync(
  input: { tenantId: string },
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegrationRow(input.tenantId, opts);
  if (!integration) return { ok: false, error: "No Google Calendar integration found." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_integrations")
    .update({
      scheduled_sync_paused_at: null,
      scheduled_sync_paused_reason: null,
      sync_failure_count: 0,
      updated_at: now,
    })
    .eq("id", integration.id)
    .eq("tenant_id", input.tenantId.trim());

  if (error) return { ok: false, error: error.message };

  const health = await loadGoogleCalendarSyncHealthRow(
    { tenantId: input.tenantId, integrationId: integration.id },
    opts
  );
  if (health) {
    await supabase
      .from("fi_calendar_sync_health")
      .update({
        consecutive_failures: 0,
        health_status: "healthy",
        updated_at: now,
      })
      .eq("id", health.id);
  }

  return { ok: true };
}

export async function setGoogleCalendarSyncEnabled(
  input: { tenantId: string; enabled: boolean },
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegrationRow(input.tenantId, opts);
  if (!integration) return { ok: false, error: "No Google Calendar integration found." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_integrations")
    .update({
      sync_enabled: input.enabled,
      updated_at: now,
    })
    .eq("id", integration.id)
    .eq("tenant_id", input.tenantId.trim());

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function enableGoogleCalendarRealtimeSync(
  input: { tenantId: string },
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { createGoogleCalendarWebhookSubscription } =
    await import("./googleCalendarWebhookSubscriptions.server");
  const result = await createGoogleCalendarWebhookSubscription({ tenantId: input.tenantId }, opts);
  if (!result.ok) return result;
  return { ok: true };
}

export async function renewGoogleCalendarRealtimeSync(
  input: { tenantId: string; subscriptionId?: string },
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const subscription = await loadActiveWebhookSubscriptionForTenant(input.tenantId, opts);
  const subscriptionId = input.subscriptionId ?? subscription?.id;
  if (!subscriptionId) {
    return enableGoogleCalendarRealtimeSync({ tenantId: input.tenantId }, opts);
  }

  const { renewGoogleCalendarWebhookSubscription } =
    await import("./googleCalendarWebhookSubscriptions.server");
  const result = await renewGoogleCalendarWebhookSubscription(
    { tenantId: input.tenantId, subscriptionId },
    opts
  );
  if (!result.ok) return result;
  return { ok: true };
}

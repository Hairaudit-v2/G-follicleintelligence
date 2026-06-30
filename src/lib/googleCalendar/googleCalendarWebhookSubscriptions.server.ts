import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";
import { createGoogleCalendarProviderAdapter } from "@/src/lib/calendar/providers/googleCalendarProviderAdapter.server";
import { shouldSkipDuplicateWebhookNotification } from "@/src/lib/calendar/providers/calendarProviderAdapter";

import { syncGoogleCalendarIncrementalForWebhook } from "./googleCalendarIncrementalSync.server";
import { createGoogleCalendarWebhookAlertIfNeeded } from "./googleCalendarWebhookAlerts.server";
import {
  emitCalendarWebhookReceived,
  emitCalendarWebhookSubscriptionCreated,
  emitCalendarWebhookSubscriptionExpired,
  emitCalendarWebhookSubscriptionRenewed,
} from "@/src/lib/events/fiCalendarEventBus.server";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
  nowMs?: number;
  webhookBaseUrl?: string;
};

export type WebhookSubscriptionRow = {
  id: string;
  tenant_id: string;
  integration_id: string;
  provider: string;
  google_calendar_id: string;
  channel_id: string;
  resource_id: string | null;
  resource_uri: string | null;
  sync_token: string | null;
  expiration_at: string | null;
  status: string;
  last_notification_at: string | null;
  failure_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const SUBSCRIPTION_SELECT =
  "id, tenant_id, integration_id, provider, google_calendar_id, channel_id, resource_id, resource_uri, sync_token, expiration_at, status, last_notification_at, failure_count, metadata, created_at, updated_at";

function resolveWebhookUrl(opts: ServerOpts): string {
  if (opts.webhookBaseUrl?.trim()) {
    return `${opts.webhookBaseUrl.replace(/\/$/, "")}/api/google/calendar/webhook`;
  }
  const siteUrl =
    process.env.FI_GOOGLE_CALENDAR_WEBHOOK_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  return `${siteUrl.replace(/\/$/, "")}/api/google/calendar/webhook`;
}

function resolveChannelToken(tenantId: string, integrationId: string): string {
  const secret = process.env.FI_GOOGLE_CALENDAR_WEBHOOK_SECRET?.trim();
  if (secret) return `${tenantId}:${integrationId}:${secret.slice(0, 16)}`;
  return `${tenantId}:${integrationId}`;
}

async function loadIntegrationForWebhook(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ id: string; calendar_id: string; realtime_sync_enabled: boolean } | null> {
  const { data, error } = await supabase
    .from("fi_calendar_integrations")
    .select("id, calendar_id, realtime_sync_enabled, status")
    .eq("tenant_id", tenantId.trim())
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: String(data.id),
    calendar_id: String(data.calendar_id),
    realtime_sync_enabled: Boolean(data.realtime_sync_enabled),
  };
}

async function stopExistingActiveSubscription(
  supabase: SupabaseClient,
  tenantId: string,
  googleCalendarId: string,
  opts: ServerOpts
): Promise<void> {
  const { data: existing } = await supabase
    .from("fi_calendar_webhook_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("tenant_id", tenantId.trim())
    .eq("provider", "google")
    .eq("google_calendar_id", googleCalendarId.trim())
    .eq("status", "active")
    .maybeSingle();

  if (!existing) return;

  const row = existing as WebhookSubscriptionRow;
  if (row.resource_id) {
    const adapter = createGoogleCalendarProviderAdapter(opts);
    await adapter.stopWebhook({
      tenantId,
      channelId: row.channel_id,
      resourceId: row.resource_id,
    });
  }

  await supabase
    .from("fi_calendar_webhook_subscriptions")
    .update({ status: "stopped", updated_at: new Date().toISOString() })
    .eq("id", row.id);
}

/** Create a Google Calendar push webhook subscription (idempotent per active calendar). */
export async function createGoogleCalendarWebhookSubscription(
  input: { tenantId: string; googleCalendarId?: string; integrationId?: string },
  opts: ServerOpts = {}
): Promise<{ ok: true; subscription: WebhookSubscriptionRow } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const tenantId = input.tenantId.trim();
  const integration = await loadIntegrationForWebhook(supabase, tenantId);
  if (!integration) return { ok: false, error: "No active Google Calendar integration." };

  const googleCalendarId = (input.googleCalendarId ?? integration.calendar_id).trim();
  if (!googleCalendarId) return { ok: false, error: "Calendar id is required." };

  await stopExistingActiveSubscription(supabase, tenantId, googleCalendarId, opts);

  const channelId = randomUUID();
  const adapter = createGoogleCalendarProviderAdapter(opts);
  const watchResult = await adapter.subscribeWebhook({
    tenantId,
    calendarId: googleCalendarId,
    webhookUrl: resolveWebhookUrl(opts),
    channelId,
    channelToken: resolveChannelToken(tenantId, integration.id),
  });

  if (!watchResult.ok) {
    await createGoogleCalendarWebhookAlertIfNeeded(
      {
        tenantId,
        integrationId: integration.id,
        eventType: "webhook_subscription_failed",
        title: "Google Calendar webhook subscription failed",
        message: watchResult.error,
        idempotencyKey: `gcal-webhook-create-failed:${integration.id}:${googleCalendarId}`,
        metadata: { googleCalendarId, error: watchResult.error },
      },
      opts
    );

    return { ok: false, error: watchResult.error };
  }

  const now = new Date().toISOString();
  const subscriptionId = randomUUID();
  const { data, error } = await supabase
    .from("fi_calendar_webhook_subscriptions")
    .insert({
      id: subscriptionId,
      tenant_id: tenantId,
      integration_id: integration.id,
      provider: "google",
      google_calendar_id: googleCalendarId,
      channel_id: watchResult.subscription.channelId,
      resource_id: watchResult.subscription.resourceId,
      resource_uri: watchResult.subscription.resourceUri,
      expiration_at: watchResult.subscription.expirationAt,
      status: "active",
      failure_count: 0,
      metadata: {},
      created_at: now,
      updated_at: now,
    })
    .select(SUBSCRIPTION_SELECT)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to persist webhook subscription." };
  }

  await supabase
    .from("fi_calendar_integrations")
    .update({ realtime_sync_enabled: true, updated_at: now })
    .eq("id", integration.id);

  logStructured("info", "google_calendar_webhook_subscription_created", {
    tenantId,
    integrationId: integration.id,
    googleCalendarId,
    channelId: watchResult.subscription.channelId,
    expirationAt: watchResult.subscription.expirationAt,
  });

  await emitCalendarWebhookSubscriptionCreated(
    {
      tenantId,
      integrationId: integration.id,
      subscriptionId,
      googleCalendarId,
    },
    opts
  );

  return { ok: true, subscription: data as WebhookSubscriptionRow };
}

/** Renew an expiring Google Calendar webhook subscription. */
export async function renewGoogleCalendarWebhookSubscription(
  input: { tenantId: string; subscriptionId: string },
  opts: ServerOpts = {}
): Promise<{ ok: true; subscription: WebhookSubscriptionRow } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const { data: existing, error: loadError } = await supabase
    .from("fi_calendar_webhook_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("id", input.subscriptionId.trim())
    .eq("tenant_id", input.tenantId.trim())
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!existing) return { ok: false, error: "Webhook subscription not found." };

  const row = existing as WebhookSubscriptionRow;
  const result = await createGoogleCalendarWebhookSubscription(
    {
      tenantId: input.tenantId,
      googleCalendarId: row.google_calendar_id,
      integrationId: row.integration_id,
    },
    opts
  );

  if (result.ok) {
    await emitCalendarWebhookSubscriptionRenewed(
      {
        tenantId: input.tenantId,
        integrationId: row.integration_id,
        subscriptionId: result.subscription.id,
        googleCalendarId: row.google_calendar_id,
      },
      opts
    );
  }

  return result;
}

/** Stop a Google Calendar webhook subscription. */
export async function stopGoogleCalendarWebhookSubscription(
  input: { tenantId: string; subscriptionId?: string; googleCalendarId?: string },
  opts: ServerOpts = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const tenantId = input.tenantId.trim();

  let query = supabase
    .from("fi_calendar_webhook_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (input.subscriptionId) {
    query = query.eq("id", input.subscriptionId.trim());
  } else if (input.googleCalendarId) {
    query = query.eq("google_calendar_id", input.googleCalendarId.trim());
  }

  const { data, error } = await query.maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true };

  const row = data as WebhookSubscriptionRow;
  if (row.resource_id) {
    const adapter = createGoogleCalendarProviderAdapter(opts);
    await adapter.stopWebhook({
      tenantId,
      channelId: row.channel_id,
      resourceId: row.resource_id,
    });
  }

  const now = new Date().toISOString();
  await supabase
    .from("fi_calendar_webhook_subscriptions")
    .update({ status: "stopped", updated_at: now })
    .eq("id", row.id);

  await supabase
    .from("fi_calendar_integrations")
    .update({ realtime_sync_enabled: false, updated_at: now })
    .eq("id", row.integration_id);

  logStructured("info", "google_calendar_webhook_subscription_stopped", {
    tenantId,
    subscriptionId: row.id,
    googleCalendarId: row.google_calendar_id,
  });

  return { ok: true };
}

/** List active subscriptions expiring within threshold hours. */
export async function listExpiringGoogleCalendarWebhookSubscriptions(
  input: { thresholdHours?: number; limit?: number } = {},
  opts: ServerOpts = {}
): Promise<WebhookSubscriptionRow[]> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const nowMs = opts.nowMs ?? Date.now();
  const thresholdMs = (input.thresholdHours ?? 24) * 60 * 60 * 1000;
  const expiresBefore = new Date(nowMs + thresholdMs).toISOString();

  const { data, error } = await supabase
    .from("fi_calendar_webhook_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("status", "active")
    .lte("expiration_at", expiresBefore)
    .order("expiration_at", { ascending: true })
    .limit(input.limit ?? 50);

  if (error) throw new Error(error.message);
  return (data ?? []) as WebhookSubscriptionRow[];
}

export type GoogleCalendarWebhookNotificationInput = {
  channelId: string;
  resourceId: string;
  resourceState: string;
  messageNumber?: string;
};

export type GoogleCalendarWebhookNotificationResult = {
  ok: boolean;
  status: number;
  outcome: "accepted" | "rejected" | "duplicate" | "sync_triggered" | "ignored";
  error?: string;
};

/** Handle an incoming Google Calendar push notification. */
export async function handleGoogleCalendarWebhookNotification(
  input: GoogleCalendarWebhookNotificationInput,
  opts: ServerOpts = {}
): Promise<GoogleCalendarWebhookNotificationResult> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const channelId = input.channelId.trim();
  const resourceId = input.resourceId.trim();

  if (!channelId || !resourceId) {
    return {
      ok: false,
      status: 400,
      outcome: "rejected",
      error: "Missing channel or resource id.",
    };
  }

  const { data: subscription, error: loadError } = await supabase
    .from("fi_calendar_webhook_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("channel_id", channelId)
    .eq("status", "active")
    .maybeSingle();

  if (loadError) {
    return { ok: false, status: 500, outcome: "rejected", error: loadError.message };
  }

  if (!subscription) {
    logStructured("warn", "google_calendar_webhook_unknown_channel", { channelId, resourceId });
    return { ok: false, status: 404, outcome: "rejected", error: "Unknown webhook channel." };
  }

  const row = subscription as WebhookSubscriptionRow;
  if (row.resource_id && row.resource_id !== resourceId) {
    return { ok: false, status: 403, outcome: "rejected", error: "Resource id mismatch." };
  }

  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const lastMessageNumber = metadata.last_message_number as string | undefined;
  if (shouldSkipDuplicateWebhookNotification(lastMessageNumber, input.messageNumber)) {
    return { ok: true, status: 200, outcome: "duplicate" };
  }

  const now = new Date().toISOString();
  const resourceState = input.resourceState.trim().toLowerCase();

  if (resourceState === "sync" || resourceState === "exists" || resourceState === "not_exists") {
    const syncResult = await syncGoogleCalendarIncrementalForWebhook(
      {
        tenantId: row.tenant_id,
        integrationId: row.integration_id,
        googleCalendarId: row.google_calendar_id,
        syncToken: row.sync_token,
        subscriptionId: row.id,
      },
      opts
    );

    if (!syncResult.ok) {
      await supabase
        .from("fi_calendar_webhook_subscriptions")
        .update({
          failure_count: row.failure_count + 1,
          updated_at: now,
        })
        .eq("id", row.id);

      await createGoogleCalendarWebhookAlertIfNeeded(
        {
          tenantId: row.tenant_id,
          integrationId: row.integration_id,
          eventType: "webhook_notification_failed",
          title: "Google Calendar webhook sync failed",
          message: syncResult.error,
          idempotencyKey: `gcal-webhook-notify-failed:${row.id}:${input.messageNumber ?? now}`,
          metadata: { channelId, resourceState, error: syncResult.error },
        },
        opts
      );

      return { ok: false, status: 500, outcome: "rejected", error: syncResult.error };
    }

    if (syncResult.nextSyncToken) {
      await supabase
        .from("fi_calendar_webhook_subscriptions")
        .update({
          sync_token: syncResult.nextSyncToken,
          updated_at: now,
        })
        .eq("id", row.id);
    }
  }

  await supabase
    .from("fi_calendar_webhook_subscriptions")
    .update({
      last_notification_at: now,
      metadata: {
        ...metadata,
        last_message_number: input.messageNumber ?? metadata.last_message_number,
        last_resource_state: resourceState,
      },
      updated_at: now,
    })
    .eq("id", row.id);

  logStructured("info", "google_calendar_webhook_notification_processed", {
    tenantId: row.tenant_id,
    channelId,
    resourceState,
    messageNumber: input.messageNumber ?? null,
  });

  await emitCalendarWebhookReceived(
    {
      tenantId: row.tenant_id,
      integrationId: row.integration_id,
      channelId,
      resourceState,
      googleCalendarId: row.google_calendar_id,
      messageNumber: input.messageNumber,
    },
    opts
  );

  return {
    ok: true,
    status: 200,
    outcome: resourceState === "sync" ? "sync_triggered" : "accepted",
  };
}

/** Renew all expiring webhook subscriptions (called from scheduled cron). */
export async function renewExpiringGoogleCalendarWebhookSubscriptions(
  opts: ServerOpts = {}
): Promise<{ renewed: number; failed: number }> {
  const expiring = await listExpiringGoogleCalendarWebhookSubscriptions(
    { thresholdHours: 24 },
    opts
  );
  let renewed = 0;
  let failed = 0;

  for (const row of expiring) {
    const result = await renewGoogleCalendarWebhookSubscription(
      { tenantId: row.tenant_id, subscriptionId: row.id },
      opts
    );

    if (result.ok) {
      renewed += 1;
    } else {
      failed += 1;
      await createGoogleCalendarWebhookAlertIfNeeded(
        {
          tenantId: row.tenant_id,
          integrationId: row.integration_id,
          eventType: "webhook_renewal_required",
          title: "Google Calendar webhook renewal failed",
          message: result.error,
          severity: "high",
          idempotencyKey: `gcal-webhook-renewal-failed:${row.id}`,
          metadata: { subscriptionId: row.id, googleCalendarId: row.google_calendar_id },
        },
        opts
      );
    }
  }

  return { renewed, failed };
}

/** Mark expired subscriptions and alert admins. */
export async function markExpiredGoogleCalendarWebhookSubscriptions(
  opts: ServerOpts = {}
): Promise<number> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const nowMs = opts.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();

  const { data: expired, error } = await supabase
    .from("fi_calendar_webhook_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("status", "active")
    .lt("expiration_at", now);

  if (error) throw new Error(error.message);
  const rows = (expired ?? []) as WebhookSubscriptionRow[];

  for (const row of rows) {
    await supabase
      .from("fi_calendar_webhook_subscriptions")
      .update({ status: "expired", updated_at: now })
      .eq("id", row.id);

    await createGoogleCalendarWebhookAlertIfNeeded(
      {
        tenantId: row.tenant_id,
        integrationId: row.integration_id,
        eventType: "webhook_subscription_expired",
        title: "Google Calendar webhook subscription expired",
        message: "Real-time sync fell back to scheduled polling until renewed.",
        idempotencyKey: `gcal-webhook-expired:${row.id}`,
        metadata: { subscriptionId: row.id, googleCalendarId: row.google_calendar_id },
      },
      opts
    );

    await emitCalendarWebhookSubscriptionExpired(
      {
        tenantId: row.tenant_id,
        integrationId: row.integration_id,
        subscriptionId: row.id,
        googleCalendarId: row.google_calendar_id,
      },
      opts
    );
  }

  return rows.length;
}

export async function loadActiveWebhookSubscriptionForTenant(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<WebhookSubscriptionRow | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_calendar_webhook_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("tenant_id", tenantId.trim())
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as WebhookSubscriptionRow | null) ?? null;
}

export async function tenantHasActiveWebhookSubscription(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<boolean> {
  const row = await loadActiveWebhookSubscriptionForTenant(tenantId, opts);
  if (!row) return false;
  if (!row.expiration_at) return true;
  const expMs = Date.parse(row.expiration_at);
  return !Number.isNaN(expMs) && expMs > (opts.nowMs ?? Date.now());
}

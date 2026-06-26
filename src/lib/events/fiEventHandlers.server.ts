import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { publishAnalyticsEvent } from "@/src/lib/analytics-os/analyticsEventCore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

export type FiEventHandlerContext = {
  tenantId: string;
  handlerKey: string;
  targetModule: string;
  event: {
    id: string;
    eventName: string;
    sourceModule: string;
    payload: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
};

export type FiEventHandlerResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

type HandlerFn = (
  ctx: FiEventHandlerContext,
  opts: { supabaseClientForTests?: SupabaseClient }
) => Promise<FiEventHandlerResult>;

async function handleAnalyticsCalendarEventCaptured(
  ctx: FiEventHandlerContext,
  opts: { supabaseClientForTests?: SupabaseClient }
): Promise<FiEventHandlerResult> {
  try {
    await publishAnalyticsEvent(
      {
        tenantId: ctx.tenantId,
        moduleName: "clinic_os",
        eventType: ctx.event.eventName.replace(/\./g, "_"),
        entityId: typeof ctx.event.payload.entityId === "string" ? ctx.event.payload.entityId : null,
        entityType: typeof ctx.event.payload.entityType === "string" ? ctx.event.payload.entityType : "calendar",
        eventMetadata: {
          platformEventId: ctx.event.id,
          sourceModule: ctx.event.sourceModule,
          payloadSummary: Object.keys(ctx.event.payload).slice(0, 12),
        },
      },
      {
        supabaseClientForTests: opts.supabaseClientForTests,
        validateEventType: false,
      }
    );

    logStructured("info", "fi_event_analytics_bridge", {
      tenantId: ctx.tenantId,
      eventId: ctx.event.id,
      eventName: ctx.event.eventName,
    });

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "analytics_bridge_failed";
    logStructured("warn", "fi_event_analytics_bridge_failed", {
      tenantId: ctx.tenantId,
      eventId: ctx.event.id,
      error: message,
    });
    return { ok: false, error: message };
  }
}

async function handleNotificationsCalendarConflictDetected(
  ctx: FiEventHandlerContext,
  opts: { supabaseClientForTests?: SupabaseClient }
): Promise<FiEventHandlerResult> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integrationId =
    typeof ctx.event.payload.integrationId === "string" ? ctx.event.payload.integrationId.trim() : null;

  if (!integrationId) {
    return { ok: true, skipped: true };
  }

  const externalEventId =
    typeof ctx.event.payload.externalEventId === "string" ? ctx.event.payload.externalEventId : "unknown";
  const idempotencyKey =
    typeof ctx.event.metadata.idempotencyKey === "string"
      ? ctx.event.metadata.idempotencyKey
      : `fi-bus-conflict:${ctx.event.id}:${externalEventId}`;

  const { data: existing } = await supabase
    .from("fi_admin_notifications")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, skipped: true };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("fi_admin_notifications").insert({
    id: randomUUID(),
    tenant_id: ctx.tenantId,
    integration_id: integrationId,
    source: "google_calendar_sync",
    event_type: "calendar_reconciliation_conflict",
    severity: "warning",
    title: "Calendar reconciliation conflict detected",
    message: `Review required for Google Calendar event ${externalEventId}.`,
    status: "open",
    idempotency_key: idempotencyKey,
    metadata: {
      platformEventId: ctx.event.id,
      conflictType: ctx.event.payload.conflictType ?? null,
    },
    created_at: now,
    updated_at: now,
  });

  if (error) {
    if (error.code === "23505") return { ok: true, skipped: true };
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

async function handleAuditCalendarWebhookReceived(
  ctx: FiEventHandlerContext,
  opts: { supabaseClientForTests?: SupabaseClient }
): Promise<FiEventHandlerResult> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integrationId =
    typeof ctx.event.payload.integrationId === "string" ? ctx.event.payload.integrationId.trim() : null;

  if (!integrationId) {
    return { ok: true, skipped: true };
  }

  logStructured("info", "fi_event_audit_webhook_received", {
    tenantId: ctx.tenantId,
    eventId: ctx.event.id,
    integrationId,
    resourceState:
      typeof ctx.event.payload.resourceState === "string" ? ctx.event.payload.resourceState : null,
  });

  const channelId =
    typeof ctx.event.payload.channelId === "string" ? ctx.event.payload.channelId : null;

  if (channelId) {
    try {
      await supabase.from("fi_calendar_reconciliation_logs").insert({
        tenant_id: ctx.tenantId,
        integration_id: integrationId,
        provider: "google",
        google_calendar_id:
          typeof ctx.event.payload.googleCalendarId === "string"
            ? ctx.event.payload.googleCalendarId
            : null,
        external_event_id: `webhook:${channelId}`,
        decision: "webhook_received",
        metadata: {
          platformEventId: ctx.event.id,
          resourceState: ctx.event.payload.resourceState ?? null,
          messageNumber: ctx.event.payload.messageNumber ?? null,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Reconciliation log enrichment is optional for audit bridge.
    }
  }

  return { ok: true, skipped: true };
}

const HANDLER_MAP: Record<string, HandlerFn> = {
  "analytics.calendarEventCaptured": handleAnalyticsCalendarEventCaptured,
  "notifications.calendarConflictDetected": handleNotificationsCalendarConflictDetected,
  "audit.calendarWebhookReceived": handleAuditCalendarWebhookReceived,
  /** Used by unit tests only — no production subscribers reference this key. */
  "test.alwaysFails": async () => ({ ok: false, error: "simulated_handler_failure" }),
};

/** Dispatch a registered FI Event Bus handler (GC-10 foundation — non-destructive only). */
export async function dispatchFiEventHandler(
  ctx: FiEventHandlerContext,
  opts: { supabaseClientForTests?: SupabaseClient } = {}
): Promise<FiEventHandlerResult> {
  const handler = HANDLER_MAP[ctx.handlerKey.trim()];
  if (!handler) {
    logStructured("warn", "fi_event_unknown_handler", {
      tenantId: ctx.tenantId,
      handlerKey: ctx.handlerKey,
      eventId: ctx.event.id,
    });
    return { ok: true, skipped: true };
  }

  return handler(ctx, opts);
}

export function listRegisteredFiEventHandlerKeys(): string[] {
  return Object.keys(HANDLER_MAP);
}

import "server-only";

import type { FiEventName } from "./fiEventRegistry";
import { publishFiEventBestEffort, type PublishFiEventInput } from "./fiEventPublisher.server";

const CALENDAR_SOURCE = "calendar_os";

type CalendarPublishInput = Omit<PublishFiEventInput, "sourceModule" | "eventName"> & {
  eventName: FiEventName;
};

function calendarPayload(
  base: Record<string, unknown>,
  integrationId?: string | null
): Record<string, unknown> {
  return {
    ...base,
    ...(integrationId ? { integrationId } : {}),
  };
}

/** Best-effort CalendarOS event emission — never throws. */
export async function publishCalendarOsFiEvent(
  input: CalendarPublishInput,
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishFiEventBestEffort(
    {
      ...input,
      sourceModule: CALENDAR_SOURCE,
    },
    opts
  );
}

export async function emitCalendarSyncStarted(
  input: {
    tenantId: string;
    integrationId: string;
    source: string;
    correlationId?: string;
  },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.sync.started",
      entityType: "calendar_integration",
      entityId: input.integrationId,
      correlationId: input.correlationId,
      payload: calendarPayload({ source: input.source }, input.integrationId),
      metadata: {
        idempotencyKey: `calendar-sync-started:${input.integrationId}:${input.correlationId ?? Date.now()}`,
      },
    },
    opts
  );
}

export async function emitCalendarSyncCompleted(
  input: {
    tenantId: string;
    integrationId: string;
    source: string;
    correlationId?: string;
    result?: Record<string, unknown>;
  },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.sync.completed",
      entityType: "calendar_integration",
      entityId: input.integrationId,
      correlationId: input.correlationId,
      payload: calendarPayload({ source: input.source, ...(input.result ?? {}) }, input.integrationId),
      metadata: {
        idempotencyKey: `calendar-sync-completed:${input.integrationId}:${input.correlationId ?? "run"}`,
      },
    },
    opts
  );
}

export async function emitCalendarSyncFailed(
  input: {
    tenantId: string;
    integrationId: string;
    source: string;
    error: string;
    correlationId?: string;
  },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.sync.failed",
      entityType: "calendar_integration",
      entityId: input.integrationId,
      correlationId: input.correlationId,
      payload: calendarPayload(
        { source: input.source, errorSummary: input.error.slice(0, 500) },
        input.integrationId
      ),
      metadata: {
        idempotencyKey: `calendar-sync-failed:${input.integrationId}:${input.correlationId ?? Date.now()}`,
      },
    },
    opts
  );
}

export async function emitCalendarWebhookReceived(
  input: {
    tenantId: string;
    integrationId: string;
    channelId: string;
    resourceState: string;
    googleCalendarId?: string;
    messageNumber?: string;
  },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.webhook.received",
      entityType: "webhook_subscription",
      entityId: input.integrationId,
      payload: calendarPayload(
        {
          channelId: input.channelId,
          resourceState: input.resourceState,
          googleCalendarId: input.googleCalendarId ?? null,
          messageNumber: input.messageNumber ?? null,
        },
        input.integrationId
      ),
      metadata: {
        idempotencyKey: `calendar-webhook:${input.channelId}:${input.messageNumber ?? input.resourceState}`,
      },
    },
    opts
  );
}

export async function emitCalendarWebhookSubscriptionCreated(
  input: { tenantId: string; integrationId: string; subscriptionId: string; googleCalendarId: string },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.webhook.subscription.created",
      entityType: "webhook_subscription",
      entityId: input.subscriptionId,
      payload: calendarPayload(
        { googleCalendarId: input.googleCalendarId },
        input.integrationId
      ),
      metadata: { idempotencyKey: `calendar-webhook-created:${input.subscriptionId}` },
    },
    opts
  );
}

export async function emitCalendarWebhookSubscriptionRenewed(
  input: { tenantId: string; integrationId: string; subscriptionId: string; googleCalendarId: string },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.webhook.subscription.renewed",
      entityType: "webhook_subscription",
      entityId: input.subscriptionId,
      payload: calendarPayload(
        { googleCalendarId: input.googleCalendarId },
        input.integrationId
      ),
      metadata: {
        idempotencyKey: `calendar-webhook-renewed:${input.subscriptionId}:${Date.now()}`,
      },
    },
    opts
  );
}

export async function emitCalendarWebhookSubscriptionExpired(
  input: { tenantId: string; integrationId: string; subscriptionId: string; googleCalendarId: string },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.webhook.subscription.expired",
      entityType: "webhook_subscription",
      entityId: input.subscriptionId,
      payload: calendarPayload(
        { googleCalendarId: input.googleCalendarId },
        input.integrationId
      ),
      metadata: { idempotencyKey: `calendar-webhook-expired:${input.subscriptionId}` },
    },
    opts
  );
}

export async function emitCalendarReconciliationConflict(
  input: {
    tenantId: string;
    integrationId: string;
    externalEventId: string;
    conflictType?: string;
    decision?: string;
  },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.reconciliation.conflict_detected",
      entityType: "calendar_event",
      payload: calendarPayload(
        {
          externalEventId: input.externalEventId,
          conflictType: input.conflictType ?? null,
          decision: input.decision ?? null,
        },
        input.integrationId
      ),
      metadata: {
        idempotencyKey: `calendar-conflict:${input.integrationId}:${input.externalEventId}:${input.conflictType ?? "generic"}`,
      },
    },
    opts
  );
}

export async function emitCalendarEventUpdated(
  input: {
    tenantId: string;
    integrationId: string;
    localEventId?: string | null;
    externalEventId: string;
    decision: string;
  },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.event.updated",
      entityType: "calendar_event",
      entityId: input.localEventId ?? undefined,
      payload: calendarPayload(
        { externalEventId: input.externalEventId, decision: input.decision },
        input.integrationId
      ),
      metadata: {
        idempotencyKey: `calendar-event-updated:${input.externalEventId}:${input.decision}`,
      },
    },
    opts
  );
}

export async function emitCalendarEventCancelled(
  input: {
    tenantId: string;
    integrationId: string;
    externalEventId: string;
    localEventId?: string | null;
    decision: string;
  },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.event.cancelled",
      entityType: "calendar_event",
      entityId: input.localEventId ?? undefined,
      payload: calendarPayload(
        { externalEventId: input.externalEventId, decision: input.decision },
        input.integrationId
      ),
      metadata: {
        idempotencyKey: `calendar-event-cancelled:${input.externalEventId}:${input.decision}`,
      },
    },
    opts
  );
}

export async function emitCalendarReviewItemCreated(
  input: {
    tenantId: string;
    integrationId: string;
    reviewItemId: string;
    externalEventId: string;
    conflictType: string;
  },
  opts?: { supabaseClientForTests?: import("@supabase/supabase-js").SupabaseClient }
): Promise<string | null> {
  return publishCalendarOsFiEvent(
    {
      tenantId: input.tenantId,
      eventName: "calendar.review_item.created",
      entityType: "sync_review_item",
      entityId: input.reviewItemId,
      payload: calendarPayload(
        {
          externalEventId: input.externalEventId,
          conflictType: input.conflictType,
        },
        input.integrationId
      ),
      metadata: {
        idempotencyKey: `calendar-review-item:${input.reviewItemId}`,
      },
    },
    opts
  );
}

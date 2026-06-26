import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

export const GOOGLE_CALENDAR_WEBHOOK_ALERT_EVENT_TYPES = [
  "webhook_subscription_failed",
  "webhook_subscription_expired",
  "webhook_notification_failed",
  "calendar_reconciliation_conflict",
  "webhook_renewal_required",
] as const;

export type GoogleCalendarWebhookAlertEventType =
  (typeof GOOGLE_CALENDAR_WEBHOOK_ALERT_EVENT_TYPES)[number];

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type CreateGoogleCalendarWebhookAlertInput = {
  tenantId: string;
  integrationId: string;
  eventType: GoogleCalendarWebhookAlertEventType;
  title: string;
  message: string;
  severity?: "info" | "warning" | "high";
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

/** Idempotent FI Admin notification for Google Calendar webhook / reconciliation alerts. */
export async function createGoogleCalendarWebhookAlertIfNeeded(
  input: CreateGoogleCalendarWebhookAlertInput,
  opts: ServerOpts = {}
): Promise<{ created: boolean; alertId: string | null }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const idempotencyKey = input.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const { data: existing, error: existingError } = await supabase
      .from("fi_admin_notifications")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing?.id) {
      return { created: false, alertId: String(existing.id) };
    }
  }

  const alertId = randomUUID();
  const now = new Date().toISOString();
  const { error } = await supabase.from("fi_admin_notifications").insert({
    id: alertId,
    tenant_id: input.tenantId.trim(),
    integration_id: input.integrationId,
    source: "google_calendar_webhook",
    event_type: input.eventType,
    severity: input.severity ?? "warning",
    title: input.title.trim(),
    message: input.message.trim().slice(0, 1000),
    status: "open",
    idempotency_key: idempotencyKey,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  });

  if (error) {
    if (error.code === "23505" && idempotencyKey) {
      return { created: false, alertId: null };
    }
    throw new Error(error.message);
  }

  logStructured("info", input.eventType, {
    tenantId: input.tenantId,
    integrationId: input.integrationId,
    alertId,
    severity: input.severity ?? "warning",
  });

  return { created: true, alertId };
}

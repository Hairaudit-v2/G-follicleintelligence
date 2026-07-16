import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

import type { ScheduledOutcome } from "./hubspotScheduledIncrementalBackupCore";

export const HUBSPOT_INCREMENTAL_ALERT_SOURCE = "hubspot_incremental_backup";

export const HUBSPOT_INCREMENTAL_ALERT_EVENT_TYPES = [
  "hubspot_incremental_backup_partial",
  "hubspot_incremental_backup_failed",
  "hubspot_incremental_backup_verification_failed",
  "hubspot_incremental_backup_stuck",
  "hubspot_incremental_backup_overlap_blocked",
  "hubspot_incremental_backup_missing_credentials",
  "hubspot_incremental_backup_missing_watermark",
  "hubspot_incremental_backup_tenant_ambiguous",
  "hubspot_incremental_backup_api_failures",
  "hubspot_incremental_backup_notification_test",
] as const;

export type HubspotIncrementalAlertEventType =
  (typeof HUBSPOT_INCREMENTAL_ALERT_EVENT_TYPES)[number];

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type CreateHubspotIncrementalAlertInput = {
  tenantId: string;
  integrationId: string;
  eventType: HubspotIncrementalAlertEventType;
  title: string;
  message: string;
  severity?: "info" | "warning" | "high";
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

/** Idempotent FI Admin notification for HubSpot incremental backup ops alerts. */
export async function createHubspotIncrementalBackupAlertIfNeeded(
  input: CreateHubspotIncrementalAlertInput,
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
    // integration_id FK targets calendar connector rows; keep HubSpot ID in metadata.
    integration_id: null,
    source: HUBSPOT_INCREMENTAL_ALERT_SOURCE,
    event_type: input.eventType,
    severity: input.severity ?? "warning",
    title: input.title.trim(),
    message: input.message.trim().slice(0, 1000),
    status: "open",
    idempotency_key: idempotencyKey,
    metadata: {
      runbook: "docs/runbooks/hubspot-incremental-backup.md",
      note_bodies_included: false,
      hubspot_integration_id: input.integrationId,
      ...(input.metadata ?? {}),
    },
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

export function alertEventForOutcome(
  outcome: ScheduledOutcome
): HubspotIncrementalAlertEventType | null {
  switch (outcome) {
    case "partial":
      return "hubspot_incremental_backup_partial";
    case "failure":
      return "hubspot_incremental_backup_failed";
    case "overlap_blocked":
      return "hubspot_incremental_backup_overlap_blocked";
    case "missing_credentials":
      return "hubspot_incremental_backup_missing_credentials";
    case "missing_watermark":
      return "hubspot_incremental_backup_missing_watermark";
    case "validation_error":
      return "hubspot_incremental_backup_tenant_ambiguous";
    case "stuck_requires_intervention":
      return "hubspot_incremental_backup_stuck";
    default:
      return null;
  }
}

/** Privacy-safe notification dry-run / test injection — no backup side effects. */
export async function sendHubspotIncrementalBackupNotificationTest(
  input: {
    tenantId: string;
    integrationId: string;
    suffix?: string;
  },
  opts: ServerOpts = {}
): Promise<{ created: boolean; alertId: string | null; idempotencyKey: string }> {
  const suffix = input.suffix?.trim() || new Date().toISOString();
  const idempotencyKey = `hubspot-incremental-notification-test:${input.tenantId}:${suffix}`;
  const result = await createHubspotIncrementalBackupAlertIfNeeded(
    {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      eventType: "hubspot_incremental_backup_notification_test",
      title: "HubSpot incremental backup notification test",
      message:
        "Privacy-safe Stage P3 notification path test. No backup run, watermark, or HubSpot object was modified.",
      severity: "info",
      idempotencyKey,
      metadata: {
        test: true,
        dataset: "notes",
        outcome: "notification_test",
      },
    },
    opts
  );
  return { ...result, idempotencyKey };
}

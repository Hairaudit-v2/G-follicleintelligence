/**
 * FI-PATIENT-APP-P1 — in-app patient notification feed + push best-effort fan-out.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { patientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayGateCore";
import type { PatientGatewayNotificationEvent } from "@/src/lib/patientPortal/patientGatewayNotificationCore";
import { sendPatientNotificationBestEffort } from "@/src/lib/patientPortal/patientNotificationDispatch.server";
import type { PatientGatewayContext, PatientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayTypes";

export type PatientGatewayNotificationItem = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  actionId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  readAt: string | null;
  actionCompletedAt: string | null;
  createdAt: string;
};

export type PatientGatewayNotificationsResponse = {
  ok: true;
  notifications: PatientGatewayNotificationItem[];
};

export type PatientNotificationFeedOptions = {
  supabase?: SupabaseClient;
  nowIso?: string;
  sendPush?: boolean;
};

type NotificationRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  event_type: string;
  title: string;
  body: string;
  action_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  read_at: string | null;
  action_completed_at: string | null;
  created_at: string;
};

function mapRow(raw: Record<string, unknown>): NotificationRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: String(raw.patient_id),
    event_type: String(raw.event_type ?? ""),
    title: String(raw.title ?? ""),
    body: String(raw.body ?? ""),
    action_id: raw.action_id != null ? String(raw.action_id) : null,
    resource_type: raw.resource_type != null ? String(raw.resource_type) : null,
    resource_id: raw.resource_id != null ? String(raw.resource_id) : null,
    read_at: raw.read_at != null ? String(raw.read_at) : null,
    action_completed_at: raw.action_completed_at != null ? String(raw.action_completed_at) : null,
    created_at: String(raw.created_at ?? ""),
  };
}

function toItem(row: NotificationRow): PatientGatewayNotificationItem {
  return {
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    actionId: row.action_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    readAt: row.read_at,
    actionCompletedAt: row.action_completed_at,
    createdAt: row.created_at,
  };
}

/** Map journey / feed event types onto 2G push event union (extended in P1). */
export function mapToGatewayNotificationEvent(
  eventType: string
): PatientGatewayNotificationEvent | null {
  const e = eventType.trim();
  const known: PatientGatewayNotificationEvent[] = [
    "new_message",
    "appointment_upcoming",
    "appointment_changed",
    "images_due",
    "invoice_due",
    "payment_received",
    "review_due",
    "quote_delivered",
    "quote_reminder",
    "deposit_due",
    "blood_request_issued",
    "pathology_received_awaiting_review",
    "pathology_cleared",
    "document_required",
    "document_rejected",
    "action_overdue",
  ] as PatientGatewayNotificationEvent[];
  if ((known as string[]).includes(e)) return e as PatientGatewayNotificationEvent;
  // Fallbacks for domain-ish aliases
  if (e === "pathology_results_received") return "pathology_received_awaiting_review" as PatientGatewayNotificationEvent;
  if (e === "document_packet_released") return "document_required" as PatientGatewayNotificationEvent;
  if (e === "deposit_received") return "payment_received";
  return "review_due";
}

export async function listPatientNotificationsForGateway(
  ctx: PatientGatewayContext,
  options?: PatientNotificationFeedOptions
): Promise<PatientGatewayNotificationsResponse | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_notifications")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to load notifications.");
  const notifications = (data ?? []).map((r) => toItem(mapRow(r as Record<string, unknown>)));
  return { ok: true, notifications };
}

export async function markPatientNotificationRead(
  ctx: PatientGatewayContext,
  notificationId: string,
  options?: PatientNotificationFeedOptions
): Promise<{ ok: true; notification: PatientGatewayNotificationItem } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  let nid: string;
  try {
    nid = assertNonEmptyUuid(notificationId, "notificationId");
  } catch {
    return patientGatewayDeny("not_found", 404, "Notification not found.");
  }
  const now = options?.nowIso ?? new Date().toISOString();
  const { data: existing, error: ge } = await supabase
    .from("fi_patient_notifications")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .eq("id", nid)
    .maybeSingle();
  if (ge) return patientGatewayDeny("misconfigured", 500, "Unable to load notification.");
  if (!existing) return patientGatewayDeny("not_found", 404, "Notification not found.");

  const row = mapRow(existing as Record<string, unknown>);
  if (row.read_at) return { ok: true, notification: toItem(row) };

  const { data, error } = await supabase
    .from("fi_patient_notifications")
    .update({ read_at: now })
    .eq("id", nid)
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .select("*")
    .single();
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to update notification.");
  return { ok: true, notification: toItem(mapRow(data as Record<string, unknown>)) };
}

export async function createPatientNotification(
  args: {
    tenantId: string;
    patientId: string;
    eventType: string;
    title: string;
    body: string;
    actionId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    authUserId?: string | null;
    dedupeKey?: string | null;
  },
  options?: PatientNotificationFeedOptions
): Promise<{ ok: true; notification: PatientGatewayNotificationItem; reused: boolean }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const now = options?.nowIso ?? new Date().toISOString();

  if (args.dedupeKey) {
    const { data: existing } = await supabase
      .from("fi_patient_notifications")
      .select("*")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .eq("dedupe_key", args.dedupeKey)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        notification: toItem(mapRow(existing as Record<string, unknown>)),
        reused: true,
      };
    }
  }

  const { data, error } = await supabase
    .from("fi_patient_notifications")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      event_type: args.eventType,
      title: args.title,
      body: args.body,
      action_id: args.actionId ?? null,
      resource_type: args.resourceType ?? null,
      resource_id: args.resourceId ?? null,
      dedupe_key: args.dedupeKey ?? null,
      created_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = mapRow(data as Record<string, unknown>);

  if (options?.sendPush !== false) {
    const pushEvent = mapToGatewayNotificationEvent(args.eventType);
    if (pushEvent) {
      await sendPatientNotificationBestEffort({
        patientId: pid,
        tenantId: tid,
        eventType: pushEvent,
        sourceEntity: row.id,
        resourceId: args.resourceId ?? args.actionId ?? null,
        authUserId: args.authUserId ?? null,
      });
    }
  }

  return { ok: true, notification: toItem(row), reused: false };
}
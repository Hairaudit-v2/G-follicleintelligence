/**
 * FI-PATIENT-APP-1F — patient gateway messaging ownership wrapper.
 * Persists to fi_patient_gateway_* tables and surfaces into staff workflows via
 * CRM activity + patient timeline + CRM message preview (does not replace CRM).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { createCrmMessagePreview } from "@/src/lib/crm/messages";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { appendPatientTimelineEvent } from "@/src/lib/integrations/hubspot/appendPatientTimelineEvent.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { patientGatewayDeny } from "./patientGatewayGateCore";
import {
  PATIENT_GATEWAY_MESSAGE_RATE_MAX,
  evaluateMessageDuplicate,
  evaluateMessageRateLimit,
  mapMessageRowToItem,
  mapThreadRowToSummary,
  sanitizePatientMessageClientPayload,
  subjectForMessageCategory,
  validatePatientGatewayMessageBody,
  type PatientGatewayMessageCategory,
  type PatientGatewayThreadDetail,
  type PatientGatewayThreadSummary,
} from "./patientGatewayMessagingCore";
import { decideNotificationDispatch } from "./patientGatewayNotificationCore";
import { loadPatientGatewayNotificationPreferences } from "./patientGatewayNotificationPreferences.server";
import { assertOwnedMessageThreadRow } from "./patientGatewayOwnershipCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";

type ThreadRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  category: string;
  subject: string;
  status: string;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  thread_id: string;
  direction: string;
  body: string;
  sender_label: string;
  status: string;
  sent_at: string;
  patient_read_at: string | null;
};

export type PatientGatewayMessagingOptions = {
  supabase?: SupabaseClient;
  writeAudit?: boolean;
  nowIso?: string;
  /** Test seams */
  appendActivity?: typeof appendCrmActivityEvent;
  appendTimeline?: typeof appendPatientTimelineEvent;
  createCrmPreview?: typeof createCrmMessagePreview;
};

function mapThread(raw: Record<string, unknown>): ThreadRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: String(raw.patient_id),
    category: String(raw.category ?? "general"),
    subject: String(raw.subject ?? "General enquiry"),
    status: String(raw.status ?? "open"),
    last_message_at: raw.last_message_at != null ? String(raw.last_message_at) : null,
  };
}

function mapMessage(raw: Record<string, unknown>): MessageRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: String(raw.patient_id),
    thread_id: String(raw.thread_id),
    direction: String(raw.direction),
    body: String(raw.body ?? ""),
    sender_label: String(raw.sender_label ?? ""),
    status: String(raw.status ?? "sent"),
    sent_at: String(raw.sent_at ?? raw.created_at ?? new Date().toISOString()),
    patient_read_at: raw.patient_read_at != null ? String(raw.patient_read_at) : null,
  };
}

export function requirePatientGatewayOwnedThread(
  ctx: PatientGatewayContext,
  row: { tenant_id: string; patient_id: string | null | undefined },
  threadId?: string | null,
  writeAudit = true
): PatientGatewayDeny | null {
  const deny = assertOwnedMessageThreadRow(ctx, row);
  if (!deny) return null;
  if (writeAudit) {
    writePatientGatewayAudit({
      action: "message_ownership_denied",
      outcome: "deny",
      code: deny.code,
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "message",
      resourceId: threadId ?? null,
    });
  }
  return deny;
}

async function ensureDefaultGeneralThread(
  ctx: PatientGatewayContext,
  client: SupabaseClient
): Promise<ThreadRow> {
  const { data: existing } = await client
    .from("fi_patient_gateway_message_threads")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .eq("category", "general")
    .eq("status", "open")
    .maybeSingle();
  if (existing) return mapThread(existing as Record<string, unknown>);

  const { data, error } = await client
    .from("fi_patient_gateway_message_threads")
    .insert({
      tenant_id: ctx.tenantId,
      patient_id: ctx.patientId,
      category: "general",
      subject: subjectForMessageCategory("general"),
      status: "open",
    })
    .select("*")
    .single();
  if (error) {
    // Unique race — re-read
    const { data: again } = await client
      .from("fi_patient_gateway_message_threads")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("patient_id", ctx.patientId)
      .eq("category", "general")
      .eq("status", "open")
      .maybeSingle();
    if (again) return mapThread(again as Record<string, unknown>);
    throw new Error(error.message);
  }
  return mapThread(data as Record<string, unknown>);
}

async function unreadCountForThread(
  client: SupabaseClient,
  tenantId: string,
  threadId: string
): Promise<number> {
  // Avoid head:true count queries — some gateway runtimes mishandle Prefer/count HEAD.
  const { data, error } = await client
    .from("fi_patient_gateway_messages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("thread_id", threadId)
    .eq("direction", "clinic_to_patient")
    .is("patient_read_at", null)
    .limit(100);
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

function sortThreadsByLastMessage(
  threads: PatientGatewayThreadSummary[]
): PatientGatewayThreadSummary[] {
  return [...threads].sort((a, b) => {
    const aMs = a.lastMessageAt ? Date.parse(a.lastMessageAt) : Number.NEGATIVE_INFINITY;
    const bMs = b.lastMessageAt ? Date.parse(b.lastMessageAt) : Number.NEGATIVE_INFINITY;
    const aSafe = Number.isFinite(aMs) ? aMs : Number.NEGATIVE_INFINITY;
    const bSafe = Number.isFinite(bMs) ? bMs : Number.NEGATIVE_INFINITY;
    return bSafe - aSafe;
  });
}

export async function listPatientGatewayMessageThreads(
  ctx: PatientGatewayContext,
  options?: PatientGatewayMessagingOptions
): Promise<{ ok: true; threads: PatientGatewayThreadSummary[] } | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();

  try {
    await ensureDefaultGeneralThread(ctx, supabase);
    // Sort in memory — avoid PostgREST nullsFirst order options that have failed in prod.
    const { data, error } = await supabase
      .from("fi_patient_gateway_message_threads")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("patient_id", ctx.patientId);
    if (error) throw new Error(error.message);

    const threads: PatientGatewayThreadSummary[] = [];
    for (const raw of data ?? []) {
      const row = mapThread(raw as Record<string, unknown>);
      const ownership = requirePatientGatewayOwnedThread(
        ctx,
        { tenant_id: row.tenant_id, patient_id: row.patient_id },
        row.id,
        writeAudit
      );
      if (ownership) {
        if (writeAudit) {
          writePatientGatewayAudit({
            action: "message_threads_list_denied",
            outcome: "deny",
            code: ownership.code,
            authUserId: ctx.authUserId,
            patientId: ctx.patientId,
            tenantId: ctx.tenantId,
            resourceKind: "message",
            resourceId: row.id,
          });
        }
        return ownership;
      }
      let unread = 0;
      try {
        unread = await unreadCountForThread(supabase, ctx.tenantId, row.id);
      } catch {
        unread = 0;
      }
      threads.push(
        mapThreadRowToSummary({
          id: row.id,
          subject: row.subject,
          category: row.category,
          status: row.status,
          last_message_at: row.last_message_at,
          unreadCount: unread,
        })
      );
    }

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "message_threads_list_success",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "message",
      });
    }
    return { ok: true, threads: sortThreadsByLastMessage(threads) };
  } catch (e) {
    const safeError =
      e instanceof Error ? e.message.replace(/[^\w\s.:()-]/g, "").slice(0, 160) : "unknown";
    logStructured("error", "patient_gateway_messaging_list_failed", {
      error: safeError,
      tenant_id: ctx.tenantId,
      patient_id: ctx.patientId,
    });
    const deny = patientGatewayDeny("misconfigured", 500, "Could not load messages.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "message_threads_list_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "message",
      });
    }
    return deny;
  }
}

export async function getPatientGatewayMessageThread(
  ctx: PatientGatewayContext,
  threadId: string,
  options?: PatientGatewayMessagingOptions
): Promise<{ ok: true; thread: PatientGatewayThreadDetail } | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();

  let tid: string;
  try {
    tid = assertNonEmptyUuid(threadId, "threadId").trim();
  } catch {
    const deny = patientGatewayDeny("not_found", 404, "Thread not found.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "message_thread_read_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "message",
        resourceId: threadId,
      });
    }
    return deny;
  }

  try {
    const { data, error } = await supabase
      .from("fi_patient_gateway_message_threads")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", tid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const deny = patientGatewayDeny("not_found", 404, "Thread not found.");
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "message_thread_read_denied",
          outcome: "deny",
          code: deny.code,
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "message",
          resourceId: tid,
        });
      }
      return deny;
    }

    const row = mapThread(data as Record<string, unknown>);
    const ownership = requirePatientGatewayOwnedThread(
      ctx,
      { tenant_id: row.tenant_id, patient_id: row.patient_id },
      row.id,
      writeAudit
    );
    if (ownership) {
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "message_thread_read_denied",
          outcome: "deny",
          code: ownership.code,
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "message",
          resourceId: row.id,
        });
      }
      return ownership;
    }

    const { data: msgs, error: me } = await supabase
      .from("fi_patient_gateway_messages")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("thread_id", row.id)
      .order("sent_at", { ascending: true })
      .limit(200);
    if (me) throw new Error(me.message);

    const nowIso = options?.nowIso ?? new Date().toISOString();
    await supabase
      .from("fi_patient_gateway_messages")
      .update({ patient_read_at: nowIso })
      .eq("tenant_id", ctx.tenantId)
      .eq("thread_id", row.id)
      .eq("direction", "clinic_to_patient")
      .is("patient_read_at", null);

    const messages = (msgs ?? []).map((m) =>
      mapMessageRowToItem(mapMessage(m as Record<string, unknown>))
    );
    const unread = 0;
    const thread: PatientGatewayThreadDetail = {
      ...mapThreadRowToSummary({
        id: row.id,
        subject: row.subject,
        category: row.category,
        status: row.status,
        last_message_at: row.last_message_at,
        unreadCount: unread,
      }),
      messages,
    };

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "message_thread_read_success",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "message",
        resourceId: row.id,
      });
    }
    return { ok: true, thread };
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not load thread.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "message_thread_read_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "message",
        resourceId: tid,
      });
    }
    return deny;
  }
}

export async function sendPatientGatewayMessage(
  ctx: PatientGatewayContext,
  threadId: string,
  rawBody: Record<string, unknown>,
  options?: PatientGatewayMessagingOptions
): Promise<
  | { ok: true; message: ReturnType<typeof mapMessageRowToItem>; staffSurfaced: true }
  | PatientGatewayDeny
> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();
  const appendActivity = options?.appendActivity ?? appendCrmActivityEvent;
  const appendTimeline = options?.appendTimeline ?? appendPatientTimelineEvent;
  const createCrmPreview = options?.createCrmPreview ?? createCrmMessagePreview;
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  const denySend = (deny: PatientGatewayDeny, resourceId?: string | null) => {
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_message_send_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "message",
        resourceId: resourceId ?? null,
      });
    }
    return deny;
  };

  let tid: string;
  try {
    tid = assertNonEmptyUuid(threadId, "threadId").trim();
  } catch {
    return denySend(patientGatewayDeny("not_found", 404, "Thread not found."), threadId);
  }

  const { body: bodyRaw } = sanitizePatientMessageClientPayload(rawBody);
  const validated = validatePatientGatewayMessageBody(bodyRaw);
  if (!validated.ok) {
    return denySend(patientGatewayDeny(validated.code, 400, validated.message), tid);
  }

  try {
    const { data: threadRaw, error: te } = await supabase
      .from("fi_patient_gateway_message_threads")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", tid)
      .maybeSingle();
    if (te) throw new Error(te.message);
    if (!threadRaw) {
      return denySend(patientGatewayDeny("not_found", 404, "Thread not found."), tid);
    }
    const thread = mapThread(threadRaw as Record<string, unknown>);
    const ownership = requirePatientGatewayOwnedThread(
      ctx,
      { tenant_id: thread.tenant_id, patient_id: thread.patient_id },
      thread.id,
      writeAudit
    );
    if (ownership) return denySend(ownership, thread.id);
    if (thread.status === "closed") {
      return denySend(
        patientGatewayDeny("thread_closed", 409, "This conversation is closed."),
        thread.id
      );
    }

    const { data: recentRows } = await supabase
      .from("fi_patient_gateway_messages")
      .select("body, sent_at")
      .eq("tenant_id", ctx.tenantId)
      .eq("patient_id", ctx.patientId)
      .eq("direction", "patient_to_clinic")
      .order("sent_at", { ascending: false })
      .limit(PATIENT_GATEWAY_MESSAGE_RATE_MAX + 5);

    const recent = (recentRows ?? []).map((r) => ({
      body: String((r as { body?: string }).body ?? ""),
      sentAt: String((r as { sent_at?: string }).sent_at ?? ""),
    }));
    const rate = evaluateMessageRateLimit({
      recentSentAtIsos: recent.map((r) => r.sentAt),
      nowMs,
    });
    if (!rate.ok) {
      return denySend(patientGatewayDeny(rate.code, 429, rate.message), thread.id);
    }
    const dup = evaluateMessageDuplicate({
      recentBodies: recent,
      candidateBody: validated.body,
      nowMs,
    });
    if (!dup.ok) {
      return denySend(patientGatewayDeny(dup.code, 409, dup.message), thread.id);
    }

    const { data: inserted, error: ie } = await supabase
      .from("fi_patient_gateway_messages")
      .insert({
        tenant_id: ctx.tenantId,
        patient_id: ctx.patientId,
        thread_id: thread.id,
        direction: "patient_to_clinic",
        body: validated.body,
        sender_label: "You",
        status: "sent",
        sent_at: nowIso,
        metadata: { source: "patient_gateway" },
      })
      .select("*")
      .single();
    if (ie) throw new Error(ie.message);

    await supabase
      .from("fi_patient_gateway_message_threads")
      .update({ last_message_at: nowIso, updated_at: nowIso })
      .eq("tenant_id", ctx.tenantId)
      .eq("id", thread.id);

    const preview =
      validated.body.length > 160 ? `${validated.body.slice(0, 157)}...` : validated.body;

    // Staff workflow surfaces (best-effort; message already persisted).
    try {
      await appendActivity(
        {
          tenantId: ctx.tenantId,
          patientId: ctx.patientId,
          activityKind: "patient_app.message.received",
          title: "Patient app message received",
          detail: {
            thread_id: thread.id,
            message_id: String((inserted as { id: string }).id),
            category: thread.category,
            body_preview: preview,
          },
          occurredAt: nowIso,
        },
        supabase
      );
      await appendTimeline(supabase, {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        personId: ctx.personId,
        crmLeadId: null,
        source: "patient_gateway",
        eventType: "patient_message_received",
        eventTimestamp: nowIso,
        title: "Patient message",
        description: preview,
        dedupeKey: `patient_gateway_message:${String((inserted as { id: string }).id)}`,
        metadata: { thread_id: thread.id },
      });
      const leadId = await findLeadIdForPatient(ctx.tenantId, ctx.patientId, supabase);
      if (leadId) {
        await createCrmPreview(
          {
            tenantId: ctx.tenantId,
            leadId,
            patientId: ctx.patientId,
            preview: {
              channel: "patient_app",
              direction: "inbound",
              subject: thread.subject,
              body_preview: preview,
              sent_at: nowIso,
              metadata: {
                patient_gateway_thread_id: thread.id,
                patient_gateway_message_id: String((inserted as { id: string }).id),
              },
            },
          },
          supabase
        );
      }
    } catch {
      /* staff surface best-effort — message remains in gateway store */
    }

    // Provider-neutral notification dispatch foundation (staff-facing new_message is
    // not patient push; policy decision recorded for contract readiness).
    try {
      const prefs = await loadPatientGatewayNotificationPreferences(ctx, {
        supabase,
        writeAudit: false,
      });
      if (prefs.ok) {
        const decision = decideNotificationDispatch({
          event: "new_message",
          preferences: prefs.preferences,
        });
        if (writeAudit) {
          writePatientGatewayAudit({
            action: "notification_dispatch_requested",
            outcome: "allow",
            authUserId: ctx.authUserId,
            patientId: ctx.patientId,
            tenantId: ctx.tenantId,
            resourceKind: "notification",
            resourceId: thread.id,
          });
          writePatientGatewayAudit({
            action:
              decision.skippedReason != null
                ? "notification_dispatch_failed"
                : "notification_dispatch_succeeded",
            outcome: decision.skippedReason != null ? "deny" : "allow",
            authUserId: ctx.authUserId,
            patientId: ctx.patientId,
            tenantId: ctx.tenantId,
            resourceKind: "notification",
            resourceId: thread.id,
          });
        }
        void decision.preview;
      }
    } catch {
      /* notification foundation best-effort */
    }

    const message = mapMessageRowToItem(mapMessage(inserted as Record<string, unknown>));
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_message_sent",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "message",
        resourceId: message.id,
      });
    }
    return { ok: true, message, staffSurfaced: true };
  } catch {
    return denySend(
      patientGatewayDeny("misconfigured", 500, "Could not send message."),
      tid
    );
  }
}

async function findLeadIdForPatient(
  tenantId: string,
  patientId: string,
  client: SupabaseClient
): Promise<string | null> {
  const { data } = await client
    .from("fi_crm_leads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

/** Constrained category thread ensure (deferred free-form new-thread). */
export async function ensurePatientGatewayCategoryThread(
  ctx: PatientGatewayContext,
  category: PatientGatewayMessageCategory,
  options?: PatientGatewayMessagingOptions
): Promise<ThreadRow> {
  const supabase = options?.supabase ?? supabaseAdmin();
  if (category === "general") return ensureDefaultGeneralThread(ctx, supabase);

  const { data: existing } = await supabase
    .from("fi_patient_gateway_message_threads")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .eq("category", category)
    .eq("status", "open")
    .maybeSingle();
  if (existing) return mapThread(existing as Record<string, unknown>);

  const { data, error } = await supabase
    .from("fi_patient_gateway_message_threads")
    .insert({
      tenant_id: ctx.tenantId,
      patient_id: ctx.patientId,
      category,
      subject: subjectForMessageCategory(category),
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapThread(data as Record<string, unknown>);
}

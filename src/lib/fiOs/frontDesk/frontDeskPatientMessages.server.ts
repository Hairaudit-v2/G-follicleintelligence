/**
 * FI-PATIENT-APP-2F.3 — Front Desk patient-message inbox (server).
 * Reads/writes the canonical fi_patient_gateway_* store only.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { logStructured } from "@/src/lib/server/structuredLog";
import {
  mapMessageRowToItem,
  validatePatientGatewayMessageBody,
} from "@/src/lib/patientPortal/patientGatewayMessagingCore";

import {
  FRONT_DESK_PATIENT_MESSAGE_POLL_MS,
  buildFrontDeskPatientHref,
  buildFrontDeskSafeMessagePreview,
  categoryLabelForFrontDesk,
  deriveFrontDeskStaffWorkState,
  filterFrontDeskPatientMessageQueueItems,
  resolveFrontDeskMessageCategory,
  type FrontDeskPatientMessageQueueFilter,
  type FrontDeskPatientMessageQueueItem,
  type FrontDeskPatientMessageQueuePayload,
  type FrontDeskPatientMessageThreadDetail,
  type FrontDeskPatientMessageThreadMessage,
} from "./frontDeskPatientMessagesCore";

export type FrontDeskPatientMessagesOptions = {
  supabase?: SupabaseClient;
  nowIso?: string;
  writeAudit?: boolean;
};

type ThreadRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  category: string;
  subject: string;
  status: string;
  last_message_at: string | null;
  staff_handled_at: string | null;
  staff_handled_by: string | null;
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
  staff_read_at: string | null;
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
    staff_handled_at: raw.staff_handled_at != null ? String(raw.staff_handled_at) : null,
    staff_handled_by: raw.staff_handled_by != null ? String(raw.staff_handled_by) : null,
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
    staff_read_at: raw.staff_read_at != null ? String(raw.staff_read_at) : null,
  };
}

function writeStaffMessageAudit(input: {
  action:
    | "patient_message_staff_viewed"
    | "patient_message_staff_acknowledged"
    | "patient_message_staff_replied"
    | "patient_message_staff_handled"
    | "patient_message_staff_denied";
  outcome: "allow" | "deny";
  tenantId: string;
  threadId?: string | null;
  patientId?: string | null;
  staffUserId?: string | null;
  messageId?: string | null;
}): void {
  logStructured(input.outcome === "deny" ? "warn" : "info", "front_desk_patient_message_audit", {
    action: input.action,
    outcome: input.outcome,
    tenant_id: input.tenantId.trim() || null,
    thread_id: input.threadId?.trim() || null,
    patient_id: input.patientId?.trim() || null,
    staff_user_id: input.staffUserId?.trim() || null,
    message_id: input.messageId?.trim() || null,
  });
}

async function loadPatientDisplayNames(
  tenantId: string,
  patientIds: string[],
  client: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(patientIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return map;

  const { data: patients } = await client
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tenantId)
    .in("id", ids);

  const personIds = [
    ...new Set(
      (patients ?? [])
        .map((p) => (p as { person_id?: string | null }).person_id)
        .filter((id): id is string => Boolean(id?.trim()))
    ),
  ];

  const personMeta = new Map<string, Record<string, unknown>>();
  if (personIds.length > 0) {
    const { data: people } = await client
      .from("fi_people")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .in("id", personIds);
    for (const row of people ?? []) {
      const id = String((row as { id: string }).id);
      const meta = ((row as { metadata?: unknown }).metadata ?? {}) as Record<string, unknown>;
      personMeta.set(id, meta);
    }
  }

  for (const row of patients ?? []) {
    const pid = String((row as { id: string }).id);
    const personId = (row as { person_id?: string | null }).person_id;
    const patientMeta = ((row as { metadata?: unknown }).metadata ?? {}) as Record<
      string,
      unknown
    >;
    const person = personId ? personMeta.get(String(personId)) ?? {} : {};
    const display = displayFromPersonMetadata(person, patientMeta);
    map.set(pid, display.name.trim() || "Patient");
  }

  for (const id of ids) {
    if (!map.has(id)) map.set(id, "Patient");
  }
  return map;
}

function lastPatientMessageAt(messages: MessageRow[]): string | null {
  const patientMsgs = messages
    .filter((m) => m.direction === "patient_to_clinic")
    .sort((a, b) => Date.parse(b.sent_at) - Date.parse(a.sent_at));
  return patientMsgs[0]?.sent_at ?? null;
}

function unreadStaffCount(messages: MessageRow[]): number {
  return messages.filter(
    (m) => m.direction === "patient_to_clinic" && m.staff_read_at == null
  ).length;
}

function latestPatientBody(messages: MessageRow[]): string | null {
  const patientMsgs = messages
    .filter((m) => m.direction === "patient_to_clinic")
    .sort((a, b) => Date.parse(b.sent_at) - Date.parse(a.sent_at));
  return patientMsgs[0]?.body ?? null;
}

export async function loadFrontDeskPatientMessageQueue(
  tenantId: string,
  opts?: FrontDeskPatientMessagesOptions & {
    filter?: FrontDeskPatientMessageQueueFilter;
  }
): Promise<FrontDeskPatientMessageQueuePayload> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const filter = opts?.filter === "unread" ? "unread" : "all";
  const supabase = opts?.supabase ?? supabaseAdmin();
  const nowIso = opts?.nowIso ?? new Date().toISOString();

  const { data: threadRows, error: te } = await supabase
    .from("fi_patient_gateway_message_threads")
    .select(
      "id, tenant_id, patient_id, category, subject, status, last_message_at, staff_handled_at, staff_handled_by"
    )
    .eq("tenant_id", tid)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (te) throw new Error(te.message);

  const threads = (threadRows ?? []).map((r) => mapThread(r as Record<string, unknown>));
  if (threads.length === 0) {
    return {
      tenantId: tid,
      unreadCount: 0,
      filter,
      items: [],
      loadedAt: nowIso,
      refreshStrategy: "bounded_polling",
      refreshIntervalMs: FRONT_DESK_PATIENT_MESSAGE_POLL_MS,
    };
  }

  const threadIds = threads.map((t) => t.id);
  const { data: messageRows, error: me } = await supabase
    .from("fi_patient_gateway_messages")
    .select(
      "id, tenant_id, patient_id, thread_id, direction, body, sender_label, status, sent_at, staff_read_at"
    )
    .eq("tenant_id", tid)
    .in("thread_id", threadIds)
    .order("sent_at", { ascending: false });
  if (me) throw new Error(me.message);

  const messages = (messageRows ?? []).map((r) => mapMessage(r as Record<string, unknown>));
  const byThread = new Map<string, MessageRow[]>();
  for (const msg of messages) {
    const list = byThread.get(msg.thread_id) ?? [];
    list.push(msg);
    byThread.set(msg.thread_id, list);
  }

  const names = await loadPatientDisplayNames(
    tid,
    threads.map((t) => t.patient_id),
    supabase
  );

  const items: FrontDeskPatientMessageQueueItem[] = [];
  for (const thread of threads) {
    const threadMessages = byThread.get(thread.id) ?? [];
    // Skip threads with no patient→clinic traffic (clinic-only drafts shouldn't clutter inbox).
    if (!threadMessages.some((m) => m.direction === "patient_to_clinic")) continue;

    const unreadCount = unreadStaffCount(threadMessages);
    const lastPatientAt = lastPatientMessageAt(threadMessages);
    const workState = deriveFrontDeskStaffWorkState({
      unreadCount,
      staffHandledAt: thread.staff_handled_at,
      lastPatientMessageAt: lastPatientAt,
    });
    const category = resolveFrontDeskMessageCategory(thread.category);
    const safe = buildFrontDeskSafeMessagePreview({
      category,
      body: latestPatientBody(threadMessages),
    });

    items.push({
      threadId: thread.id,
      patientId: thread.patient_id,
      patientDisplayName: names.get(thread.patient_id) ?? "Patient",
      category,
      categoryLabel: categoryLabelForFrontDesk(category),
      subject: thread.subject,
      status: thread.status === "closed" ? "closed" : "open",
      lastMessageAt: thread.last_message_at,
      unreadCount,
      workState,
      preview: safe.preview,
      previewPolicy: safe.previewPolicy,
      patientHref: buildFrontDeskPatientHref(tid, thread.patient_id, thread.id),
    });
  }

  const filtered = filterFrontDeskPatientMessageQueueItems(items, filter);
  const unreadCount = items.reduce((sum, i) => sum + (i.unreadCount > 0 ? 1 : 0), 0);

  return {
    tenantId: tid,
    unreadCount,
    filter,
    items: filtered,
    loadedAt: nowIso,
    refreshStrategy: "bounded_polling",
    refreshIntervalMs: FRONT_DESK_PATIENT_MESSAGE_POLL_MS,
  };
}

export async function loadFrontDeskPatientMessageThread(
  tenantId: string,
  threadId: string,
  opts?: FrontDeskPatientMessagesOptions & {
    /** When true, mark patient_to_clinic messages staff-read (ack). */
    acknowledge?: boolean;
    staffUserId?: string | null;
    canReply?: boolean;
  }
): Promise<FrontDeskPatientMessageThreadDetail | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const thid = assertNonEmptyUuid(threadId, "threadId").trim();
  const supabase = opts?.supabase ?? supabaseAdmin();
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const writeAudit = opts?.writeAudit !== false;

  const { data: threadRaw, error: te } = await supabase
    .from("fi_patient_gateway_message_threads")
    .select(
      "id, tenant_id, patient_id, category, subject, status, last_message_at, staff_handled_at, staff_handled_by"
    )
    .eq("tenant_id", tid)
    .eq("id", thid)
    .maybeSingle();
  if (te) throw new Error(te.message);
  if (!threadRaw) return null;

  const thread = mapThread(threadRaw as Record<string, unknown>);

  if (opts?.acknowledge) {
    await supabase
      .from("fi_patient_gateway_messages")
      .update({ staff_read_at: nowIso })
      .eq("tenant_id", tid)
      .eq("thread_id", thid)
      .eq("direction", "patient_to_clinic")
      .is("staff_read_at", null);

    if (writeAudit) {
      writeStaffMessageAudit({
        action: "patient_message_staff_viewed",
        outcome: "allow",
        tenantId: tid,
        threadId: thid,
        patientId: thread.patient_id,
        staffUserId: opts.staffUserId ?? null,
      });
      writeStaffMessageAudit({
        action: "patient_message_staff_acknowledged",
        outcome: "allow",
        tenantId: tid,
        threadId: thid,
        patientId: thread.patient_id,
        staffUserId: opts.staffUserId ?? null,
      });
    }
  }

  const { data: messageRows, error: me } = await supabase
    .from("fi_patient_gateway_messages")
    .select(
      "id, tenant_id, patient_id, thread_id, direction, body, sender_label, status, sent_at, staff_read_at"
    )
    .eq("tenant_id", tid)
    .eq("thread_id", thid)
    .order("sent_at", { ascending: true });
  if (me) throw new Error(me.message);

  const messages = (messageRows ?? []).map((r) => mapMessage(r as Record<string, unknown>));
  const names = await loadPatientDisplayNames(tid, [thread.patient_id], supabase);
  const unreadCount = unreadStaffCount(messages);
  const category = resolveFrontDeskMessageCategory(thread.category);
  const workState = deriveFrontDeskStaffWorkState({
    unreadCount,
    staffHandledAt: thread.staff_handled_at,
    lastPatientMessageAt: lastPatientMessageAt(messages),
  });

  const detailMessages: FrontDeskPatientMessageThreadMessage[] = messages.map((m) => ({
    id: m.id,
    direction:
      m.direction === "clinic_to_patient" ? "clinic_to_patient" : "patient_to_clinic",
    senderLabel:
      m.direction === "clinic_to_patient"
        ? m.sender_label.trim() || "Clinical Team"
        : m.sender_label.trim() || "Patient",
    body: m.body,
    sentAt: m.sent_at,
    staffReadAt: m.staff_read_at,
  }));

  return {
    tenantId: tid,
    threadId: thread.id,
    patientId: thread.patient_id,
    patientDisplayName: names.get(thread.patient_id) ?? "Patient",
    category,
    categoryLabel: categoryLabelForFrontDesk(category),
    subject: thread.subject,
    status: thread.status === "closed" ? "closed" : "open",
    lastMessageAt: thread.last_message_at,
    unreadCount,
    workState,
    staffHandledAt: thread.staff_handled_at,
    messages: detailMessages,
    patientHref: buildFrontDeskPatientHref(tid, thread.patient_id, thread.id),
    canReply: opts?.canReply !== false && thread.status !== "closed",
  };
}

export async function markFrontDeskPatientMessageHandled(
  tenantId: string,
  threadId: string,
  opts?: FrontDeskPatientMessagesOptions & {
    staffUserId?: string | null;
    fiUserId?: string | null;
  }
): Promise<{ ok: true } | { ok: false; code: "not_found" }> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const thid = assertNonEmptyUuid(threadId, "threadId").trim();
  const supabase = opts?.supabase ?? supabaseAdmin();
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const writeAudit = opts?.writeAudit !== false;

  const { data: threadRaw, error: te } = await supabase
    .from("fi_patient_gateway_message_threads")
    .select("id, patient_id")
    .eq("tenant_id", tid)
    .eq("id", thid)
    .maybeSingle();
  if (te) throw new Error(te.message);
  if (!threadRaw) return { ok: false, code: "not_found" };

  // Opening/handling also clears staff unread — handled implies acknowledged.
  await supabase
    .from("fi_patient_gateway_messages")
    .update({ staff_read_at: nowIso })
    .eq("tenant_id", tid)
    .eq("thread_id", thid)
    .eq("direction", "patient_to_clinic")
    .is("staff_read_at", null);

  const { error: ue } = await supabase
    .from("fi_patient_gateway_message_threads")
    .update({
      staff_handled_at: nowIso,
      staff_handled_by: opts?.fiUserId?.trim() || null,
      updated_at: nowIso,
    })
    .eq("tenant_id", tid)
    .eq("id", thid);
  if (ue) throw new Error(ue.message);

  if (writeAudit) {
    writeStaffMessageAudit({
      action: "patient_message_staff_handled",
      outcome: "allow",
      tenantId: tid,
      threadId: thid,
      patientId: String((threadRaw as { patient_id: string }).patient_id),
      staffUserId: opts?.staffUserId ?? null,
    });
  }
  return { ok: true };
}

export async function replyFrontDeskPatientMessage(
  tenantId: string,
  threadId: string,
  rawBody: unknown,
  opts?: FrontDeskPatientMessagesOptions & {
    staffUserId?: string | null;
    senderLabel?: string;
  }
): Promise<
  | { ok: true; message: ReturnType<typeof mapMessageRowToItem> }
  | { ok: false; code: "not_found" | "thread_closed" | "message_empty" | "message_too_long"; message: string }
> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const thid = assertNonEmptyUuid(threadId, "threadId").trim();
  const supabase = opts?.supabase ?? supabaseAdmin();
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const writeAudit = opts?.writeAudit !== false;

  const validated = validatePatientGatewayMessageBody(rawBody);
  if (!validated.ok) {
    return { ok: false, code: validated.code, message: validated.message };
  }

  const { data: threadRaw, error: te } = await supabase
    .from("fi_patient_gateway_message_threads")
    .select(
      "id, tenant_id, patient_id, category, subject, status, last_message_at, staff_handled_at, staff_handled_by"
    )
    .eq("tenant_id", tid)
    .eq("id", thid)
    .maybeSingle();
  if (te) throw new Error(te.message);
  if (!threadRaw) return { ok: false, code: "not_found", message: "Thread not found." };

  const thread = mapThread(threadRaw as Record<string, unknown>);
  if (thread.status === "closed") {
    return { ok: false, code: "thread_closed", message: "This conversation is closed." };
  }

  const senderLabel = (opts?.senderLabel ?? "Clinical Team").trim() || "Clinical Team";

  const { data: inserted, error: ie } = await supabase
    .from("fi_patient_gateway_messages")
    .insert({
      tenant_id: tid,
      patient_id: thread.patient_id,
      thread_id: thread.id,
      direction: "clinic_to_patient",
      body: validated.body,
      sender_label: senderLabel,
      status: "sent",
      sent_at: nowIso,
      metadata: { source: "front_desk_staff" },
    })
    .select("*")
    .single();
  if (ie) throw new Error(ie.message);

  await supabase
    .from("fi_patient_gateway_message_threads")
    .update({
      last_message_at: nowIso,
      updated_at: nowIso,
      // Reply does not auto-handle; leave staff_handled_at as-is.
    })
    .eq("tenant_id", tid)
    .eq("id", thread.id);

  // Staff reply implies the inbound thread was seen.
  await supabase
    .from("fi_patient_gateway_messages")
    .update({ staff_read_at: nowIso })
    .eq("tenant_id", tid)
    .eq("thread_id", thid)
    .eq("direction", "patient_to_clinic")
    .is("staff_read_at", null);

  const message = mapMessageRowToItem(mapMessage(inserted as Record<string, unknown>));
  if (writeAudit) {
    writeStaffMessageAudit({
      action: "patient_message_staff_replied",
      outcome: "allow",
      tenantId: tid,
      threadId: thid,
      patientId: thread.patient_id,
      staffUserId: opts?.staffUserId ?? null,
      messageId: message.id,
    });
  }
  return { ok: true, message };
}

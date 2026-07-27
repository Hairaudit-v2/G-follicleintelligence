import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPatientGatewayMessageThread,
  listPatientGatewayMessageThreads,
  requirePatientGatewayOwnedThread,
  sendPatientGatewayMessage,
} from "./patientGatewayMessaging.server";
import { messagingPayloadExposesStaffFields } from "./patientGatewayMessagingCore";
import type { PatientGatewayContext } from "./patientGatewayTypes";

const AUTH_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT_A = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const TENANT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const THREAD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MSG_A = "99999999-9999-4999-8999-999999999999";

const CTX_A: PatientGatewayContext = {
  authUserId: AUTH_A,
  patientId: PATIENT_A,
  tenantId: TENANT_A,
  personId: "55555555-5555-4555-8555-555555555555",
  patientStatus: "active",
  clinicName: "Clinic A",
};

const NOW = "2026-07-27T12:00:00.000Z";

type Thread = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  category: string;
  subject: string;
  status: string;
  last_message_at: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

type Message = {
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
  metadata?: Record<string, unknown>;
  created_at?: string;
};

function createMessagingStore(seed?: {
  threads?: Thread[];
  messages?: Message[];
  /** When null, findLeadIdForPatient returns no lead. Default: demo lead id. */
  leadId?: string | null;
}) {
  const threads = [...(seed?.threads ?? [])];
  const messages = [...(seed?.messages ?? [])];
  let msgSeq = 0;
  const linkedLeadId =
    seed && "leadId" in seed ? seed.leadId : "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  function matches(row: Record<string, unknown>, filters: { col: string; val: unknown }[]) {
    return filters.every((f) => String(row[f.col] ?? "") === String(f.val ?? ""));
  }

  function from(table: string) {
    const filters: { col: string; val: unknown }[] = [];
    let orderCol: string | null = null;
    let ascending = true;
    let limitN: number | null = null;
    let headCount = false;
    let nullCol: string | null = null;
    let insertPayload: Record<string, unknown> | null = null;
    let updatePayload: Record<string, unknown> | null = null;

    const builder: Record<string, unknown> = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (opts?.head && opts?.count === "exact") headCount = true;
        return builder;
      },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        insertPayload = Array.isArray(payload) ? payload[0]! : payload;
        return builder;
      },
      update(payload: Record<string, unknown>) {
        updatePayload = payload;
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return builder;
      },
      is(col: string, val: null) {
        nullCol = col;
        void val;
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col;
        ascending = opts?.ascending !== false;
        return builder;
      },
      limit(n: number) {
        limitN = n;
        return builder;
      },
      maybeSingle: async () => {
        if (table === "fi_crm_leads") {
          return {
            data: linkedLeadId ? { id: linkedLeadId } : null,
            error: null,
          };
        }
        if (table === "fi_patient_gateway_message_threads") {
          if (insertPayload) {
            const row: Thread = {
              id: THREAD_A,
              tenant_id: String(insertPayload.tenant_id),
              patient_id: String(insertPayload.patient_id),
              category: String(insertPayload.category ?? "general"),
              subject: String(insertPayload.subject ?? "General enquiry"),
              status: String(insertPayload.status ?? "open"),
              last_message_at: null,
              created_at: NOW,
              updated_at: NOW,
            };
            threads.push(row);
            return { data: row, error: null };
          }
          const rows = threads.filter((t) =>
            matches(t as unknown as Record<string, unknown>, filters)
          );
          return { data: rows[0] ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (table === "fi_patient_gateway_message_threads" && insertPayload) {
          const row: Thread = {
            id: crypto.randomUUID(),
            tenant_id: String(insertPayload.tenant_id),
            patient_id: String(insertPayload.patient_id),
            category: String(insertPayload.category ?? "general"),
            subject: String(insertPayload.subject ?? "General enquiry"),
            status: String(insertPayload.status ?? "open"),
            last_message_at: null,
            created_at: NOW,
            updated_at: NOW,
          };
          threads.push(row);
          return { data: row, error: null };
        }
        if (table === "fi_patient_gateway_messages" && insertPayload) {
          msgSeq += 1;
          const row: Message = {
            id: msgSeq === 1 ? MSG_A : crypto.randomUUID(),
            tenant_id: String(insertPayload.tenant_id),
            patient_id: String(insertPayload.patient_id),
            thread_id: String(insertPayload.thread_id),
            direction: String(insertPayload.direction),
            body: String(insertPayload.body),
            sender_label: String(insertPayload.sender_label ?? "You"),
            status: String(insertPayload.status ?? "sent"),
            sent_at: String(insertPayload.sent_at ?? NOW),
            patient_read_at: null,
            metadata: (insertPayload.metadata as Record<string, unknown>) ?? {},
            created_at: NOW,
          };
          messages.push(row);
          return { data: row, error: null };
        }
        return { data: null, error: { message: "not found" } };
      },
      then(resolve: (v: { data: unknown; error: null; count?: number | null }) => unknown) {
        if (table === "fi_patient_gateway_message_threads") {
          if (updatePayload) {
            for (const t of threads) {
              if (matches(t as unknown as Record<string, unknown>, filters)) {
                Object.assign(t, updatePayload);
              }
            }
            return Promise.resolve(resolve({ data: null, error: null }));
          }
          let rows = threads.filter((t) => matches(t as unknown as Record<string, unknown>, filters));
          if (orderCol) {
            rows = [...rows].sort((a, b) => {
              const av = String((a as Record<string, unknown>)[orderCol!] ?? "");
              const bv = String((b as Record<string, unknown>)[orderCol!] ?? "");
              return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
            });
          }
          return Promise.resolve(resolve({ data: rows, error: null }));
        }
        if (table === "fi_patient_gateway_messages") {
          if (updatePayload) {
            for (const m of messages) {
              if (matches(m as unknown as Record<string, unknown>, filters)) {
                if (nullCol && (m as Record<string, unknown>)[nullCol] != null) continue;
                Object.assign(m, updatePayload);
              }
            }
            return Promise.resolve(resolve({ data: null, error: null }));
          }
          let rows = messages.filter((m) => {
            if (!matches(m as unknown as Record<string, unknown>, filters)) return false;
            if (nullCol && (m as Record<string, unknown>)[nullCol] != null) return false;
            return true;
          });
          if (orderCol) {
            rows = [...rows].sort((a, b) => {
              const av = String((a as Record<string, unknown>)[orderCol!] ?? "");
              const bv = String((b as Record<string, unknown>)[orderCol!] ?? "");
              return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
            });
          }
          if (limitN != null) rows = rows.slice(0, limitN);
          if (headCount) {
            return Promise.resolve(resolve({ data: null, error: null, count: rows.length }));
          }
          return Promise.resolve(resolve({ data: rows, error: null }));
        }
        return Promise.resolve(resolve({ data: [], error: null }));
      },
    };
    return builder;
  }

  return {
    from,
    _threads: threads,
    _messages: messages,
  };
}

describe("patientGatewayMessaging.server", () => {
  it("A. Patient A lists only own threads (auto general)", async () => {
    const store = createMessagingStore();
    const result = await listPatientGatewayMessageThreads(CTX_A, {
      writeAudit: false,
      supabase: store as never,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.threads.length, 1);
    assert.equal(result.threads[0]?.category, "general");
    assert.equal(messagingPayloadExposesStaffFields(result), false);
  });

  it("B. Patient A reads own thread", async () => {
    const store = createMessagingStore({
      threads: [
        {
          id: THREAD_A,
          tenant_id: TENANT_A,
          patient_id: PATIENT_A,
          category: "general",
          subject: "General enquiry",
          status: "open",
          last_message_at: NOW,
        },
      ],
      messages: [
        {
          id: MSG_A,
          tenant_id: TENANT_A,
          patient_id: PATIENT_A,
          thread_id: THREAD_A,
          direction: "clinic_to_patient",
          body: "Please upload photos.",
          sender_label: "Clinical Team",
          status: "delivered",
          sent_at: NOW,
          patient_read_at: null,
        },
      ],
    });
    const result = await getPatientGatewayMessageThread(CTX_A, THREAD_A, {
      writeAudit: false,
      nowIso: NOW,
      supabase: store as never,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.thread.messages.length, 1);
    assert.equal(result.thread.messages[0]?.senderLabel, "Clinical Team");
  });

  it("C. Patient A cannot read Patient B thread", async () => {
    const store = createMessagingStore({
      threads: [
        {
          id: THREAD_B,
          tenant_id: TENANT_A,
          patient_id: PATIENT_B,
          category: "general",
          subject: "General enquiry",
          status: "open",
          last_message_at: null,
        },
      ],
    });
    const result = await getPatientGatewayMessageThread(CTX_A, THREAD_B, {
      writeAudit: false,
      supabase: store as never,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "ownership_denied");
  });

  it("D. wrong-tenant thread denied", async () => {
    const store = createMessagingStore({
      threads: [
        {
          id: THREAD_A,
          tenant_id: TENANT_B,
          patient_id: PATIENT_A,
          category: "general",
          subject: "General enquiry",
          status: "open",
          last_message_at: null,
        },
      ],
    });
    // Query filters by ctx.tenantId so row is not found → 404 (fail closed)
    const result = await getPatientGatewayMessageThread(CTX_A, THREAD_A, {
      writeAudit: false,
      supabase: store as never,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.code === "not_found" || result.code === "wrong_tenant");
  });

  it("E. orphaned thread not exposed", async () => {
    const deny = requirePatientGatewayOwnedThread(
      CTX_A,
      { tenant_id: TENANT_A, patient_id: null },
      THREAD_A,
      false
    );
    assert.equal(deny?.code, "ownership_denied");
  });

  it("G. foreign patientId cannot alter ownership wrapper", () => {
    const deny = requirePatientGatewayOwnedThread(
      CTX_A,
      { tenant_id: TENANT_A, patient_id: PATIENT_B },
      THREAD_A,
      false
    );
    assert.equal(deny?.code, "ownership_denied");
  });

  it("H/I. valid send persists and surfaces to staff workflow seams", async () => {
    const store = createMessagingStore({
      threads: [
        {
          id: THREAD_A,
          tenant_id: TENANT_A,
          patient_id: PATIENT_A,
          category: "general",
          subject: "General enquiry",
          status: "open",
          last_message_at: null,
        },
      ],
    });
    const activityCalls: unknown[] = [];
    const timelineCalls: unknown[] = [];
    const previewCalls: unknown[] = [];

    const result = await sendPatientGatewayMessage(
      CTX_A,
      THREAD_A,
      {
        body: "I have uploaded my 3-month photos.",
        direction: "clinic_to_patient",
        status: "read",
        senderLabel: "Dr Fake",
      },
      {
        writeAudit: false,
        nowIso: NOW,
        supabase: store as never,
        appendActivity: async (input) => {
          activityCalls.push(input);
          return { ok: true } as never;
        },
        appendTimeline: async (_client, input) => {
          timelineCalls.push(input);
          return { ok: true } as never;
        },
        createCrmPreview: async (input) => {
          previewCalls.push(input);
          return { ok: true } as never;
        },
      }
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.message.direction, "patient_to_clinic");
    assert.equal(result.message.senderLabel, "You");
    assert.equal(result.message.status, "sent");
    assert.equal(store._messages.length, 1);
    assert.equal(activityCalls.length, 1);
    assert.equal(timelineCalls.length, 1);
    assert.equal(previewCalls.length, 1);
    assert.equal(result.staffSurfaced, true);
    const activity = activityCalls[0] as {
      activityKind: string;
      leadId: string | null;
      detail: Record<string, unknown>;
    };
    assert.equal(activity.activityKind, "patient_app.message.received");
    assert.equal(activity.leadId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    assert.equal(activity.detail.thread_id, THREAD_A);
    assert.ok(typeof activity.detail.message_id === "string");
    const timeline = timelineCalls[0] as { crmLeadId: string | null };
    assert.equal(timeline.crmLeadId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  });

  it("2F.2 send without linked lead still surfaces patient activity without leadId", async () => {
    const store = createMessagingStore({
      leadId: null,
      threads: [
        {
          id: THREAD_A,
          tenant_id: TENANT_A,
          patient_id: PATIENT_A,
          category: "general",
          subject: "General enquiry",
          status: "open",
          last_message_at: null,
        },
      ],
    });

    const activityCalls: unknown[] = [];
    const previewCalls: unknown[] = [];
    const result = await sendPatientGatewayMessage(
      CTX_A,
      THREAD_A,
      { body: "No lead linked yet." },
      {
        writeAudit: false,
        nowIso: NOW,
        supabase: store as never,
        appendActivity: async (input) => {
          activityCalls.push(input);
          return { ok: true } as never;
        },
        appendTimeline: async () => ({ ok: true } as never),
        createCrmPreview: async (input) => {
          previewCalls.push(input);
          return { ok: true } as never;
        },
      }
    );
    assert.equal(result.ok, true);
    assert.equal(activityCalls.length, 1);
    assert.equal(previewCalls.length, 0);
    const activity = activityCalls[0] as { leadId: string | null | undefined };
    assert.ok(activity.leadId == null || activity.leadId === "");
  });

  it("J. foreign thread send denied", async () => {
    const store = createMessagingStore({
      threads: [
        {
          id: THREAD_B,
          tenant_id: TENANT_A,
          patient_id: PATIENT_B,
          category: "general",
          subject: "General enquiry",
          status: "open",
          last_message_at: null,
        },
      ],
    });
    const result = await sendPatientGatewayMessage(
      CTX_A,
      THREAD_B,
      { body: "hello" },
      { writeAudit: false, nowIso: NOW, supabase: store as never }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "ownership_denied");
    assert.equal(store._messages.length, 0);
  });

  it("K/L. empty and oversized send rejected", async () => {
    const store = createMessagingStore({
      threads: [
        {
          id: THREAD_A,
          tenant_id: TENANT_A,
          patient_id: PATIENT_A,
          category: "general",
          subject: "General enquiry",
          status: "open",
          last_message_at: null,
        },
      ],
    });
    const empty = await sendPatientGatewayMessage(
      CTX_A,
      THREAD_A,
      { body: "  " },
      { writeAudit: false, nowIso: NOW, supabase: store as never }
    );
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.code, "message_empty");

    const oversized = await sendPatientGatewayMessage(
      CTX_A,
      THREAD_A,
      { body: "x".repeat(4001) },
      { writeAudit: false, nowIso: NOW, supabase: store as never }
    );
    assert.equal(oversized.ok, false);
    if (!oversized.ok) assert.equal(oversized.code, "message_too_long");
  });

  it("O. duplicate send controlled", async () => {
    const store = createMessagingStore({
      threads: [
        {
          id: THREAD_A,
          tenant_id: TENANT_A,
          patient_id: PATIENT_A,
          category: "general",
          subject: "General enquiry",
          status: "open",
          last_message_at: null,
        },
      ],
      messages: [
        {
          id: MSG_A,
          tenant_id: TENANT_A,
          patient_id: PATIENT_A,
          thread_id: THREAD_A,
          direction: "patient_to_clinic",
          body: "same text",
          sender_label: "You",
          status: "sent",
          sent_at: NOW,
          patient_read_at: null,
        },
      ],
    });
    const result = await sendPatientGatewayMessage(
      CTX_A,
      THREAD_A,
      { body: "same text" },
      { writeAudit: false, nowIso: NOW, supabase: store as never }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "message_duplicate");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadFrontDeskPatientMessageQueue,
  loadFrontDeskPatientMessageThread,
  markFrontDeskPatientMessageHandled,
  replyFrontDeskPatientMessage,
} from "./frontDeskPatientMessages.server";

const TENANT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PATIENT_A = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const THREAD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MSG_A = "99999999-9999-4999-8999-999999999999";
const MSG_B = "88888888-8888-4888-8888-888888888888";
const PERSON_A = "55555555-5555-4555-8555-555555555555";
const PERSON_B = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-07-27T12:00:00.000Z";

type Thread = {
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
  staff_read_at: string | null;
  metadata?: Record<string, unknown>;
};

type Patient = {
  id: string;
  tenant_id: string;
  person_id: string;
  metadata: Record<string, unknown>;
};

type Person = {
  id: string;
  tenant_id: string;
  metadata: Record<string, unknown>;
};

function matches(row: Record<string, unknown>, filters: { col: string; val: unknown }[]) {
  return filters.every((f) => String(row[f.col] ?? "") === String(f.val ?? ""));
}

function createMockDb(seed: {
  threads: Thread[];
  messages: Message[];
  patients: Patient[];
  people: Person[];
}) {
  const threads = [...seed.threads];
  const messages = [...seed.messages];
  const patients = [...seed.patients];
  const people = [...seed.people];
  let msgSeq = 0;

  function from(table: string) {
    const filters: { col: string; val: unknown }[] = [];
    let inFilter: { col: string; vals: string[] } | null = null;
    let orderCol: string | null = null;
    let ascending = true;
    let limitN: number | null = null;
    let nullCol: string | null = null;
    let insertPayload: Record<string, unknown> | null = null;
    let updatePayload: Record<string, unknown> | null = null;

    const builder: Record<string, unknown> = {
      select() {
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
      in(col: string, vals: string[]) {
        inFilter = { col, vals };
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
        if (table === "fi_patient_gateway_message_threads") {
          const rows = threads.filter((t) =>
            matches(t as unknown as Record<string, unknown>, filters)
          );
          return { data: rows[0] ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (table === "fi_patient_gateway_messages" && insertPayload) {
          msgSeq += 1;
          const row: Message = {
            id: `clinic-msg-${msgSeq}`,
            tenant_id: String(insertPayload.tenant_id),
            patient_id: String(insertPayload.patient_id),
            thread_id: String(insertPayload.thread_id),
            direction: String(insertPayload.direction),
            body: String(insertPayload.body),
            sender_label: String(insertPayload.sender_label ?? "Clinical Team"),
            status: String(insertPayload.status ?? "sent"),
            sent_at: String(insertPayload.sent_at ?? NOW),
            staff_read_at: null,
            metadata: (insertPayload.metadata as Record<string, unknown>) ?? {},
          };
          messages.push(row);
          return { data: row, error: null };
        }
        return { data: null, error: { message: "not found" } };
      },
      then(resolve: (v: { data: unknown; error: null }) => unknown) {
        if (updatePayload) {
          if (table === "fi_patient_gateway_messages") {
            for (const m of messages) {
              const row = m as unknown as Record<string, unknown>;
              if (!matches(row, filters)) continue;
              if (nullCol && row[nullCol] != null) continue;
              if (inFilter && !inFilter.vals.includes(String(row[inFilter.col] ?? ""))) continue;
              Object.assign(m, updatePayload);
            }
          }
          if (table === "fi_patient_gateway_message_threads") {
            for (const t of threads) {
              const row = t as unknown as Record<string, unknown>;
              if (!matches(row, filters)) continue;
              Object.assign(t, updatePayload);
            }
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        }

        let rows: Record<string, unknown>[] = [];
        if (table === "fi_patient_gateway_message_threads") {
          rows = threads as unknown as Record<string, unknown>[];
        } else if (table === "fi_patient_gateway_messages") {
          rows = messages as unknown as Record<string, unknown>[];
        } else if (table === "fi_patients") {
          rows = patients as unknown as Record<string, unknown>[];
        } else if (table === "fi_people") {
          rows = people as unknown as Record<string, unknown>[];
        }

        rows = rows.filter((row) => matches(row, filters));
        if (inFilter) {
          rows = rows.filter((row) => inFilter!.vals.includes(String(row[inFilter!.col] ?? "")));
        }
        if (nullCol) {
          rows = rows.filter((row) => row[nullCol!] == null);
        }
        if (orderCol) {
          rows = [...rows].sort((a, b) => {
            const av = String(a[orderCol!] ?? "");
            const bv = String(b[orderCol!] ?? "");
            return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
          });
        }
        if (limitN != null) rows = rows.slice(0, limitN);
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };

    return builder;
  }

  return {
    from,
    _state: { threads, messages, patients, people },
  } as unknown as SupabaseClient & {
    _state: {
      threads: Thread[];
      messages: Message[];
      patients: Patient[];
      people: Person[];
    };
  };
}

function baseSeed() {
  return {
    threads: [
      {
        id: THREAD_A,
        tenant_id: TENANT_A,
        patient_id: PATIENT_A,
        category: "general",
        subject: "General enquiry",
        status: "open",
        last_message_at: "2026-07-27T11:00:00.000Z",
        staff_handled_at: null,
        staff_handled_by: null,
      },
      {
        id: THREAD_B,
        tenant_id: TENANT_B,
        patient_id: PATIENT_B,
        category: "post_op",
        subject: "Post-operative care",
        status: "open",
        last_message_at: "2026-07-27T11:30:00.000Z",
        staff_handled_at: null,
        staff_handled_by: null,
      },
    ] satisfies Thread[],
    messages: [
      {
        id: MSG_A,
        tenant_id: TENANT_A,
        patient_id: PATIENT_A,
        thread_id: THREAD_A,
        direction: "patient_to_clinic",
        body: "I've uploaded my photos for review",
        sender_label: "You",
        status: "sent",
        sent_at: "2026-07-27T11:00:00.000Z",
        staff_read_at: null,
      },
      {
        id: MSG_B,
        tenant_id: TENANT_B,
        patient_id: PATIENT_B,
        thread_id: THREAD_B,
        direction: "patient_to_clinic",
        body: "Wound looks red and painful",
        sender_label: "You",
        status: "sent",
        sent_at: "2026-07-27T11:30:00.000Z",
        staff_read_at: null,
      },
    ] satisfies Message[],
    patients: [
      {
        id: PATIENT_A,
        tenant_id: TENANT_A,
        person_id: PERSON_A,
        metadata: {},
      },
      {
        id: PATIENT_B,
        tenant_id: TENANT_B,
        person_id: PERSON_B,
        metadata: {},
      },
    ] satisfies Patient[],
    people: [
      {
        id: PERSON_A,
        tenant_id: TENANT_A,
        metadata: { display_name: "Demo Patient" },
      },
      {
        id: PERSON_B,
        tenant_id: TENANT_B,
        metadata: { display_name: "Other Tenant Patient" },
      },
    ] satisfies Person[],
  };
}

describe("frontDeskPatientMessages.server", () => {
  it("A/B/C — queue surfaces patient message with unread badge count", async () => {
    const db = createMockDb(baseSeed());
    const queue = await loadFrontDeskPatientMessageQueue(TENANT_A, {
      supabase: db,
      nowIso: NOW,
      filter: "all",
    });
    assert.equal(queue.tenantId, TENANT_A);
    assert.equal(queue.unreadCount, 1);
    assert.equal(queue.items.length, 1);
    assert.equal(queue.items[0]?.threadId, THREAD_A);
    assert.equal(queue.items[0]?.patientDisplayName, "Demo Patient");
    assert.equal(queue.items[0]?.unreadCount, 1);
    assert.equal(queue.refreshStrategy, "bounded_polling");
  });

  it("D — wrong-tenant staff cannot see other tenant messages", async () => {
    const db = createMockDb(baseSeed());
    const queue = await loadFrontDeskPatientMessageQueue(TENANT_A, {
      supabase: db,
      nowIso: NOW,
    });
    assert.ok(!queue.items.some((i) => i.threadId === THREAD_B));
    assert.ok(!queue.items.some((i) => i.patientId === PATIENT_B));
  });

  it("I — sensitive post_op preview is withheld", async () => {
    const db = createMockDb(baseSeed());
    const queue = await loadFrontDeskPatientMessageQueue(TENANT_B, {
      supabase: db,
      nowIso: NOW,
    });
    assert.equal(queue.items.length, 1);
    assert.equal(queue.items[0]?.previewPolicy, "generic_sensitive");
    assert.equal(queue.items[0]?.preview, null);
    assert.ok(!JSON.stringify(queue.items[0]).includes("painful"));
  });

  it("E/F/G — open/ack clears staff unread without mutating body", async () => {
    const db = createMockDb(baseSeed());
    const beforeBody = db._state.messages.find((m) => m.id === MSG_A)?.body;
    const detail = await loadFrontDeskPatientMessageThread(TENANT_A, THREAD_A, {
      supabase: db,
      nowIso: NOW,
      acknowledge: true,
      staffUserId: "staff-1",
      writeAudit: false,
    });
    assert.ok(detail);
    assert.equal(detail!.unreadCount, 0);
    assert.equal(detail!.workState, "open");
    assert.equal(db._state.messages.find((m) => m.id === MSG_A)?.body, beforeBody);
    assert.equal(db._state.messages.find((m) => m.id === MSG_A)?.staff_read_at, NOW);

    const queue = await loadFrontDeskPatientMessageQueue(TENANT_A, {
      supabase: db,
      nowIso: NOW,
    });
    assert.equal(queue.unreadCount, 0);
  });

  it("H — dismiss is client-only; handled requires explicit mark", async () => {
    const db = createMockDb(baseSeed());
    await loadFrontDeskPatientMessageThread(TENANT_A, THREAD_A, {
      supabase: db,
      nowIso: NOW,
      acknowledge: true,
      writeAudit: false,
    });
    assert.equal(db._state.threads.find((t) => t.id === THREAD_A)?.staff_handled_at, null);

    const handled = await markFrontDeskPatientMessageHandled(TENANT_A, THREAD_A, {
      supabase: db,
      nowIso: NOW,
      writeAudit: false,
    });
    assert.equal(handled.ok, true);
    assert.equal(db._state.threads.find((t) => t.id === THREAD_A)?.staff_handled_at, NOW);
  });

  it("J — staff reply enters same canonical thread as clinic_to_patient", async () => {
    const db = createMockDb(baseSeed());
    const result = await replyFrontDeskPatientMessage(
      TENANT_A,
      THREAD_A,
      "Thanks — we received your photos.",
      { supabase: db, nowIso: NOW, writeAudit: false }
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.message.direction, "clinic_to_patient");
    const inserted = db._state.messages.filter(
      (m) => m.thread_id === THREAD_A && m.direction === "clinic_to_patient"
    );
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0]?.body, "Thanks — we received your photos.");
    assert.equal(inserted[0]?.tenant_id, TENANT_A);
  });

  it("L — multiple messages same thread stay deterministic (one queue row)", async () => {
    const seed = baseSeed();
    seed.messages.push({
      id: "77777777-7777-4777-8777-777777777777",
      tenant_id: TENANT_A,
      patient_id: PATIENT_A,
      thread_id: THREAD_A,
      direction: "patient_to_clinic",
      body: "Second message",
      sender_label: "You",
      status: "sent",
      sent_at: "2026-07-27T11:45:00.000Z",
      staff_read_at: null,
    });
    seed.threads[0]!.last_message_at = "2026-07-27T11:45:00.000Z";
    const db = createMockDb(seed);
    const queue = await loadFrontDeskPatientMessageQueue(TENANT_A, {
      supabase: db,
      nowIso: NOW,
    });
    assert.equal(queue.items.length, 1);
    assert.equal(queue.items[0]?.unreadCount, 2);
    assert.equal(queue.items[0]?.threadId, THREAD_A);
  });

  it("K — payload never includes internal note fields", async () => {
    const db = createMockDb(baseSeed());
    const detail = await loadFrontDeskPatientMessageThread(TENANT_A, THREAD_A, {
      supabase: db,
      nowIso: NOW,
      acknowledge: false,
      writeAudit: false,
    });
    const serialized = JSON.stringify(detail);
    assert.ok(!serialized.includes("internal_note"));
    assert.ok(!serialized.includes("fi_crm_lead_notes"));
  });
});

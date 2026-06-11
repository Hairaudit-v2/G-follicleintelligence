import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { TherapyEventType } from "./medicationOsTypes";
import { mirrorTherapyEventRowToTimeline } from "./medicationOsTimeline.server";

function baseRow(over: Partial<{ event_type: TherapyEventType; case_id: string | null }> = {}) {
  return {
    id: "evt-11111111-1111-4111-8111-111111111111",
    event_type: "plan_activated" as TherapyEventType,
    occurred_at: "2024-01-01T00:00:00.000Z",
    plan_id: "plan-22222222-2222-4222-8222-222222222222",
    plan_item_id: null as string | null,
    canonical_code: null as string | null,
    case_id: "case-33333333-3333-4333-8333-333333333333" as string | null,
    ...over,
  };
}

describe("mirrorTherapyEventRowToTimeline (MedicationOS → fi_timeline_events)", () => {
  it("returns low_signal for plan_created without touching Supabase", async () => {
    let fromCalls = 0;
    const sb = {
      from: (t: string) => {
        fromCalls++;
        throw new Error(`unexpected ${t}`);
      },
    } as unknown as SupabaseClient;
    const r = await mirrorTherapyEventRowToTimeline(sb, {
      tenantId: "t1",
      patientId: "p1",
      row: baseRow({ event_type: "plan_created" }),
    });
    assert.equal(fromCalls, 0);
    assert.equal(r.skipReason, "low_signal");
  });

  it("returns low_signal for adherence_note", async () => {
    const sb = { from: () => ({}) } as unknown as SupabaseClient;
    const r = await mirrorTherapyEventRowToTimeline(sb, {
      tenantId: "t1",
      patientId: "p1",
      row: baseRow({ event_type: "adherence_note" }),
    });
    assert.equal(r.skipReason, "low_signal");
  });

  it("returns missing_case_id for high-signal event without case context (no Supabase)", async () => {
    let fromCalls = 0;
    const sb = {
      from: () => {
        fromCalls++;
        throw new Error("no db");
      },
    } as unknown as SupabaseClient;
    const r = await mirrorTherapyEventRowToTimeline(sb, {
      tenantId: "t1",
      patientId: "p1",
      caseId: null,
      row: baseRow({ event_type: "plan_activated", case_id: null }),
    });
    assert.equal(fromCalls, 0);
    assert.equal(r.skipReason, "missing_case_id");
    assert.equal(r.timelineEventKind, "therapy.plan_activated");
  });

  it("inserts on dedupe miss and returns created", async () => {
    let fromCalls = 0;
    let insertCount = 0;
    const sb = {
      from: (table: string) => {
        if (table !== "fi_timeline_events") throw new Error(table);
        fromCalls++;
        if (fromCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    contains: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          insert: () => ({
            select: () => ({
              single: async () => {
                insertCount++;
                return { data: { id: "tl-new" }, error: null };
              },
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;
    const r = await mirrorTherapyEventRowToTimeline(sb, {
      tenantId: "t1",
      patientId: "p1",
      row: baseRow({}),
    });
    assert.equal(fromCalls, 2);
    assert.equal(insertCount, 1);
    assert.ok("created" in r && r.created === true);
    assert.equal(r.timelineEventId, "tl-new");
    assert.equal(r.timelineEventKind, "therapy.plan_activated");
  });

  it("returns duplicate without insert when dedupe hits", async () => {
    let fromCalls = 0;
    let insertCount = 0;
    const sb = {
      from: (table: string) => {
        if (table !== "fi_timeline_events") throw new Error(table);
        fromCalls++;
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  contains: () => ({
                    maybeSingle: async () => ({ data: { id: "tl-existing" }, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: () => {
            insertCount++;
            throw new Error("insert should not run");
          },
        };
      },
    } as unknown as SupabaseClient;
    const r = await mirrorTherapyEventRowToTimeline(sb, {
      tenantId: "t1",
      patientId: "p1",
      row: baseRow({}),
    });
    assert.equal(fromCalls, 1);
    assert.equal(insertCount, 0);
    assert.equal(r.skipReason, "duplicate");
    assert.equal(r.timelineEventId, "tl-existing");
  });

  it("returns mirror_error when insert fails (never throws)", async () => {
    let fromCalls = 0;
    const sb = {
      from: (table: string) => {
        if (table !== "fi_timeline_events") throw new Error(table);
        fromCalls++;
        if (fromCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    contains: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: null, error: { message: "rls denied" } }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;
    const r = await mirrorTherapyEventRowToTimeline(sb, {
      tenantId: "t1",
      patientId: "p1",
      row: baseRow({}),
    });
    assert.equal(r.skipReason, "mirror_error");
    assert.ok("errorMessage" in r && r.errorMessage.includes("rls"));
  });
});

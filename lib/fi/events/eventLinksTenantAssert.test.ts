import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertFiEventBelongsToTenant, getLatestFiEventLink, linkEventToEntities } from "./mapping";

/** Minimal thenable query builder that resolves to `{ data, error }`. */
function builderResult<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } }
) {
  const b = {
    select: () => b,
    eq: () => b,
    order: () => b,
    limit: () => b,
    insert: () => b,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then(onFulfilled: (v: typeof result) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return b;
}

describe("assertFiEventBelongsToTenant", () => {
  it("resolves when fi_events row exists for tenant", async () => {
    const supabase = {
      from() {
        return builderResult({ data: { id: "ev-1", tenant_id: "t-a" }, error: null });
      },
    } as unknown as SupabaseClient;
    await assert.doesNotReject(() => assertFiEventBelongsToTenant(supabase, "ev-1", "t-a"));
  });

  it("throws when fi_events row is missing for tenant", async () => {
    const supabase = {
      from() {
        return builderResult({ data: null, error: null });
      },
    } as unknown as SupabaseClient;
    await assert.rejects(
      () => assertFiEventBelongsToTenant(supabase, "ev-1", "t-a"),
      /ownership mismatch|no fi_events row/i
    );
  });
});

describe("getLatestFiEventLink", () => {
  it("returns link fields when event belongs to tenant and link exists", async () => {
    let fromN = 0;
    const supabase = {
      from(table: string) {
        fromN += 1;
        if (fromN === 1) {
          assert.equal(table, "fi_events");
          return builderResult({ data: { id: "ev-1", tenant_id: "t-a" }, error: null });
        }
        assert.equal(table, "fi_event_links");
        return builderResult({
          data: { fi_case_id: "c1", global_case_id: "g1", global_patient_id: "p1" },
          error: null,
        });
      },
    } as unknown as SupabaseClient;

    const out = await getLatestFiEventLink(supabase, "ev-1", "t-a");
    assert.equal(out.fi_case_id, "c1");
    assert.equal(out.global_case_id, "g1");
    assert.equal(out.global_patient_id, "p1");
  });

  it("throws when event belongs to a different tenant (no fi_events row)", async () => {
    const supabase = {
      from() {
        return builderResult({ data: null, error: null });
      },
    } as unknown as SupabaseClient;

    await assert.rejects(
      () => getLatestFiEventLink(supabase, "ev-1", "wrong-tenant"),
      /ownership mismatch/i
    );
  });
});

describe("linkEventToEntities", () => {
  it("inserts when event belongs to tenant and no matching link exists", async () => {
    let eventsFrom = 0;
    let linkFrom = 0;
    const inserted = {
      id: "link-1",
      event_id: "ev-1",
      global_case_id: "g1",
      fi_case_id: "c1",
      global_patient_id: "p1",
      created_at: "2020-01-01T00:00:00Z",
    };

    const supabase = {
      from(table: string) {
        if (table === "fi_events") {
          eventsFrom += 1;
          return builderResult({ data: { id: "ev-1", tenant_id: "t-a" }, error: null });
        }
        if (table === "fi_event_links") {
          linkFrom += 1;
          if (linkFrom === 1) {
            const sel = {
              select: () => sel,
              eq: () => sel,
              then(onFulfilled: (v: { data: unknown[]; error: null }) => unknown) {
                return Promise.resolve({ data: [], error: null }).then(onFulfilled);
              },
            };
            return sel;
          }
          const ins = {
            insert: () => ins,
            select: () => ins,
            single: () => Promise.resolve({ data: inserted, error: null }),
          };
          return ins;
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;

    const row = await linkEventToEntities({
      tenantId: "t-a",
      eventId: "ev-1",
      globalCaseId: "g1",
      fiCaseId: "c1",
      globalPatientId: "p1",
      client: supabase,
    });
    assert.equal(row.id, "link-1");
    assert.equal(row.event_id, "ev-1");
    assert.equal(eventsFrom, 1);
    assert.equal(linkFrom, 2);
  });

  it("throws before touching links when tenant does not own event", async () => {
    const supabase = {
      from() {
        return builderResult({ data: null, error: null });
      },
    } as unknown as SupabaseClient;

    await assert.rejects(
      () =>
        linkEventToEntities({
          tenantId: "t-a",
          eventId: "ev-1",
          globalCaseId: "g1",
          fiCaseId: "c1",
          client: supabase,
        }),
      /ownership mismatch/i
    );
  });
});

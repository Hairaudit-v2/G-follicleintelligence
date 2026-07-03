import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { insertShiftCandidatesForTests } from "@/src/lib/workforce-os/rosterGeneration.server";
import type { RosterShiftCandidate } from "@/src/lib/workforce-os/rosterGenerationCore";
import {
  ROSTER_ACTOR_FI_USER_NOT_LINKED_MESSAGE,
  resolveCurrentTenantFiUserId,
} from "@/src/lib/workforce-os/resolveCurrentTenantFiUserId.server";

/** Connor Green — live tenant actor (auth id differs from fi_users.id). */
const TENANT_EVOLVED = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const AUTH_USER_CONNOR = "593e9dba-93c2-4e9a-a493-d5202ec9257d";
const FI_USER_CONNOR = "872bf5e0-3ea6-4d49-8a7e-7085e3587b2f";
const STAFF_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type FiUserRow = {
  id: string;
  tenant_id: string;
  auth_user_id: string;
};

function createFiUsersMockSupabase(rows: FiUserRow[]) {
  const insertedShiftRows: Array<{ created_by: string | null }> = [];

  const client = {
    from(table: string) {
      if (table === "fi_users") {
        return {
          select(_cols?: string) {
            return {
              eq(col: string, val: string) {
                const filters = [{ col, val }];
                const chain = {
                  eq(col2: string, val2: string) {
                    filters.push({ col: col2, val: val2 });
                    return chain;
                  },
                  maybeSingle: async () => {
                    const row = rows.find((r) =>
                      filters.every(
                        (f) => String((r as Record<string, unknown>)[f.col]) === f.val
                      )
                    );
                    return { data: row ? { id: row.id } : null, error: null };
                  },
                };
                return chain;
              },
            };
          },
        };
      }

      if (table === "fi_staff_shifts") {
        return {
          insert(rows: Array<{ created_by: string | null }>) {
            insertedShiftRows.push(...rows);
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    get insertedShiftRows() {
      return insertedShiftRows;
    },
  };

  return client as unknown as SupabaseClient & {
    insertedShiftRows: typeof insertedShiftRows;
  };
}

function sampleCandidate(overrides: Partial<RosterShiftCandidate> = {}): RosterShiftCandidate {
  return {
    staff_id: STAFF_A,
    clinic_id: null,
    shift_type: "clinical",
    starts_at: "2026-07-06T01:00:00.000Z",
    ends_at: "2026-07-06T09:00:00.000Z",
    shift_source: "standard_hours",
    notes: null,
    localDate: "2026-07-06",
    weekday: 1,
    ...overrides,
  };
}

describe("resolveCurrentTenantFiUserId", () => {
  it("returns fi_users.id when auth_user_id differs from fi_users.id", async () => {
    const supabase = createFiUsersMockSupabase([
      {
        id: FI_USER_CONNOR,
        tenant_id: TENANT_EVOLVED,
        auth_user_id: AUTH_USER_CONNOR,
      },
    ]);

    const fiUserId = await resolveCurrentTenantFiUserId({
      supabase,
      tenantId: TENANT_EVOLVED,
      authUserIdForTests: AUTH_USER_CONNOR,
      skipPlatformAdminLookupForTests: true,
    });

    assert.equal(fiUserId, FI_USER_CONNOR);
    assert.notEqual(fiUserId, AUTH_USER_CONNOR);
  });

  it("throws a controlled error when no fi_users row exists for the actor", async () => {
    const supabase = createFiUsersMockSupabase([]);

    await assert.rejects(
      () =>
        resolveCurrentTenantFiUserId({
          supabase,
          tenantId: TENANT_EVOLVED,
          authUserIdForTests: AUTH_USER_CONNOR,
          skipPlatformAdminLookupForTests: true,
        }),
      (err: unknown) => {
        assert.ok(err instanceof CrmAccessError);
        assert.equal(err.status, 403);
        assert.equal(err.message, ROSTER_ACTOR_FI_USER_NOT_LINKED_MESSAGE);
        return true;
      }
    );
  });
});

describe("fi_staff_shifts.created_by write paths", () => {
  async function resolveActorForScenario(
    supabase: SupabaseClient & { insertedShiftRows: Array<{ created_by: string | null }> }
  ): Promise<string> {
    return resolveCurrentTenantFiUserId({
      supabase,
      tenantId: TENANT_EVOLVED,
      authUserIdForTests: AUTH_USER_CONNOR,
      skipPlatformAdminLookupForTests: true,
    });
  }

  it("generate roster inserts shifts with fi_users.id as created_by", async () => {
    const supabase = createFiUsersMockSupabase([
      {
        id: FI_USER_CONNOR,
        tenant_id: TENANT_EVOLVED,
        auth_user_id: AUTH_USER_CONNOR,
      },
    ]);
    const actorFiUserId = await resolveActorForScenario(supabase);

    await insertShiftCandidatesForTests(
      TENANT_EVOLVED,
      [sampleCandidate()],
      actorFiUserId,
      supabase
    );

    assert.equal(supabase.insertedShiftRows.length, 1);
    assert.equal(supabase.insertedShiftRows[0]?.created_by, FI_USER_CONNOR);
    assert.notEqual(supabase.insertedShiftRows[0]?.created_by, AUTH_USER_CONNOR);
  });

  it("regenerate generated roster inserts replacement shifts with fi_users.id", async () => {
    const supabase = createFiUsersMockSupabase([
      {
        id: FI_USER_CONNOR,
        tenant_id: TENANT_EVOLVED,
        auth_user_id: AUTH_USER_CONNOR,
      },
    ]);
    const actorFiUserId = await resolveActorForScenario(supabase);

    await insertShiftCandidatesForTests(
      TENANT_EVOLVED,
      [
        sampleCandidate({ shift_source: "standard_hours" }),
        sampleCandidate({
          shift_source: "standard_hours",
          starts_at: "2026-07-07T01:00:00.000Z",
          ends_at: "2026-07-07T09:00:00.000Z",
        }),
      ],
      actorFiUserId,
      supabase
    );

    assert.equal(supabase.insertedShiftRows.length, 2);
    for (const row of supabase.insertedShiftRows) {
      assert.equal(row.created_by, FI_USER_CONNOR);
    }
  });

  it("copy previous week inserts copied shifts with fi_users.id", async () => {
    const supabase = createFiUsersMockSupabase([
      {
        id: FI_USER_CONNOR,
        tenant_id: TENANT_EVOLVED,
        auth_user_id: AUTH_USER_CONNOR,
      },
    ]);
    const actorFiUserId = await resolveActorForScenario(supabase);

    await insertShiftCandidatesForTests(
      TENANT_EVOLVED,
      [
        sampleCandidate({
          shift_source: "copy_week",
          notes: "Copied from previous week",
        }),
      ],
      actorFiUserId,
      supabase
    );

    assert.equal(supabase.insertedShiftRows.length, 1);
    assert.equal(supabase.insertedShiftRows[0]?.created_by, FI_USER_CONNOR);
  });

  it("missing fi_users actor fails before insert with controlled error", async () => {
    const supabase = createFiUsersMockSupabase([]);

    await assert.rejects(
      async () => {
        const actorFiUserId = await resolveActorForScenario(supabase);
        await insertShiftCandidatesForTests(
          TENANT_EVOLVED,
          [sampleCandidate()],
          actorFiUserId,
          supabase
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof CrmAccessError);
        assert.equal(err.message, ROSTER_ACTOR_FI_USER_NOT_LINKED_MESSAGE);
        return true;
      }
    );

    assert.equal(supabase.insertedShiftRows.length, 0);
  });
});

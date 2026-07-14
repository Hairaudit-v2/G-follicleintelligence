import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  resolveWorkforceActorFiUserId,
  WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE,
} from "@/src/lib/workforce-os/resolveWorkforceActorFiUserId.server";

const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const AUTH_USER = "593e9dba-93c2-4e9a-a493-d5202ec9257d";
const FI_USER = "872bf5e0-3ea6-4d49-8a7e-7085e3587b2f";

function createFiUsersMockSupabase(
  rows: Array<{ id: string; tenant_id: string; auth_user_id: string }>
) {
  return {
    from(table: string) {
      if (table !== "fi_users") throw new Error(`Unexpected table: ${table}`);
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
                    filters.every((f) => String((r as Record<string, unknown>)[f.col]) === f.val)
                  );
                  return { data: row ? { id: row.id } : null, error: null };
                },
              };
              return chain;
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("resolveWorkforceActorFiUserId", () => {
  it("returns fi_users.id when auth_user_id differs from fi_users.id", async () => {
    const supabase = createFiUsersMockSupabase([
      { id: FI_USER, tenant_id: TENANT, auth_user_id: AUTH_USER },
    ]);

    const fiUserId = await resolveWorkforceActorFiUserId(TENANT, {
      supabase,
      authUserIdForTests: AUTH_USER,
      skipPlatformAdminLookupForTests: true,
    });

    assert.equal(fiUserId, FI_USER);
    assert.notEqual(fiUserId, AUTH_USER);
  });

  it("throws a friendly error when no fi_users row exists for the actor", async () => {
    const supabase = createFiUsersMockSupabase([]);

    await assert.rejects(
      () =>
        resolveWorkforceActorFiUserId(TENANT, {
          supabase,
          authUserIdForTests: AUTH_USER,
          skipPlatformAdminLookupForTests: true,
        }),
      (e: unknown) => {
        assert.ok(e instanceof CrmAccessError);
        assert.equal(e.message, WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE);
        return true;
      }
    );
  });
});

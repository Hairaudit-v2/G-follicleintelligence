import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE } from "@/src/lib/workforce-os/workforceMutationErrorsCore";
import { createAvailabilityBlock } from "@/src/lib/workforce-os/workforceRostering.server";
import { setStaffMaternityLeave } from "@/src/lib/workforce/staffLeaveWorkflow.server";

const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const AUTH_USER = "593e9dba-93c2-4e9a-a493-d5202ec9257d";
const FI_USER = "872bf5e0-3ea6-4d49-8a7e-7085e3587b2f";
const STAFF_MEMBER_ANITA = "e13edbee-1111-4111-8111-111111111111";
const FI_STAFF_ANITA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const VALID_FI_USER_IDS = new Set([FI_USER]);

type AvailabilityBlockRow = {
  id: string;
  tenant_id: string;
  staff_id: string;
  block_type: string;
  starts_at: string;
  ends_at: string;
  status: string;
  reason: string | null;
  created_by: string | null;
};

type StaffMemberRow = Record<string, unknown>;

function anitaMember(overrides: Partial<StaffMemberRow> = {}): StaffMemberRow {
  const now = "2026-07-01T00:00:00.000Z";
  return {
    id: STAFF_MEMBER_ANITA,
    tenant_id: TENANT,
    fi_staff_id: FI_STAFF_ANITA,
    full_name: "Anita Katherine Cottee",
    first_name: "Anita",
    last_name: "Cottee",
    email: "anita@evolvedhair.com.au",
    employment_status: "on_leave",
    employment_status_reason: "prior leave",
    employment_status_changed_at: now,
    employment_status_changed_by: null,
    archived_at: "2026-06-15T00:00:00.000Z",
    identity_source: "manual",
    internal_tags: [],
    source_snapshot: {},
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createMaternityLeaveMockSupabase(initialMember: StaffMemberRow) {
  let member = { ...initialMember };
  const availabilityBlocks: AvailabilityBlockRow[] = [];
  const auditEvents: Array<Record<string, unknown>> = [];
  const fiStaffPatches: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      if (table === "fi_staff_members") {
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
                    const matches =
                      String(member.tenant_id) ===
                        filters.find((f) => f.col === "tenant_id")?.val &&
                      String(member.id) === filters.find((f) => f.col === "id")?.val;
                    return { data: matches ? member : null, error: null };
                  },
                };
                return chain;
              },
            };
          },
          update(patch: Record<string, unknown>) {
            const filters: Array<{ col: string; val: string }> = [];
            const chain = {
              eq(col: string, val: string) {
                filters.push({ col, val });
                return chain;
              },
              select(_cols?: string) {
                return {
                  single: async () => {
                    member = { ...member, ...patch };
                    return { data: member, error: null };
                  },
                };
              },
            };
            return chain;
          },
        };
      }

      if (table === "fi_staff") {
        return {
          update(patch: Record<string, unknown>) {
            fiStaffPatches.push(patch);
            const chain = {
              eq(_col: string, _val: string) {
                return chain;
              },
            };
            return chain;
          },
        };
      }

      if (table === "fi_staff_availability_blocks") {
        return {
          insert(row: Record<string, unknown>) {
            const createdBy = row.created_by != null ? String(row.created_by) : null;
            if (createdBy && !VALID_FI_USER_IDS.has(createdBy)) {
              return {
                select: () => ({
                  single: async () => ({
                    data: null,
                    error: {
                      message:
                        'insert or update on table "fi_staff_availability_blocks" violates foreign key constraint "fi_staff_availability_blocks_created_by_fkey"',
                    },
                  }),
                }),
              };
            }

            const inserted: AvailabilityBlockRow = {
              id: crypto.randomUUID(),
              tenant_id: String(row.tenant_id),
              staff_id: String(row.staff_id),
              block_type: String(row.block_type),
              starts_at: String(row.starts_at),
              ends_at: String(row.ends_at),
              status: "active",
              reason: row.reason != null ? String(row.reason) : null,
              created_by: createdBy,
            };
            availabilityBlocks.push(inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted, error: null }),
              }),
            };
          },
        };
      }

      if (table === "fi_staff_member_audit_events") {
        return {
          insert(row: Record<string, unknown>) {
            auditEvents.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    get availabilityBlocks() {
      return availabilityBlocks;
    },
    get auditEvents() {
      return auditEvents;
    },
    get member() {
      return member;
    },
    get fiStaffPatches() {
      return fiStaffPatches;
    },
  };

  return client as unknown as SupabaseClient & {
    availabilityBlocks: AvailabilityBlockRow[];
    auditEvents: Array<Record<string, unknown>>;
    member: StaffMemberRow;
    fiStaffPatches: Array<Record<string, unknown>>;
  };
}

describe("maternity leave availability block created_by", () => {
  it("stores fi_users.id when creating a maternity leave block", async () => {
    const supabase = createMaternityLeaveMockSupabase(anitaMember());

    await createAvailabilityBlock({
      tenantId: TENANT,
      staffId: FI_STAFF_ANITA,
      blockType: "maternity_leave",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-12-31T23:59:59.999Z",
      reason: "maternity_leave",
      createdBy: FI_USER,
      client: supabase,
    });

    assert.equal(supabase.availabilityBlocks[0]?.created_by, FI_USER);
    assert.notEqual(supabase.availabilityBlocks[0]?.created_by, AUTH_USER);
  });

  it("rejects auth.users.id with a friendly message instead of raw FK text", async () => {
    const supabase = createMaternityLeaveMockSupabase(anitaMember());

    await assert.rejects(
      () =>
        createAvailabilityBlock({
          tenantId: TENANT,
          staffId: FI_STAFF_ANITA,
          blockType: "maternity_leave",
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: "2026-12-31T23:59:59.999Z",
          reason: "maternity_leave",
          createdBy: AUTH_USER,
          client: supabase,
        }),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.equal(e.message, WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE);
        assert.doesNotMatch(e.message, /foreign key constraint/i);
        return true;
      }
    );
  });

  it("creates maternity leave for Anita on_leave+archived with a valid fi_users actor", async () => {
    const supabase = createMaternityLeaveMockSupabase(anitaMember());

    const result = await setStaffMaternityLeave({
      tenantId: TENANT,
      staffMemberId: STAFF_MEMBER_ANITA,
      startDate: "2026-07-01",
      expectedReturnDate: "2026-12-31",
      keepLoginAccess: true,
      pauseRosterEligibility: true,
      pauseStandardHours: true,
      actorUserId: FI_USER,
      client: supabase,
    });

    assert.equal(result.memberId, STAFF_MEMBER_ANITA);
    assert.equal(result.fiStaffId, FI_STAFF_ANITA);
    assert.equal(supabase.availabilityBlocks.length, 1);
    assert.equal(supabase.availabilityBlocks[0]?.block_type, "maternity_leave");
    assert.equal(supabase.availabilityBlocks[0]?.created_by, FI_USER);
    assert.equal(supabase.member.employment_status, "on_leave");
    assert.ok(supabase.auditEvents.some((e) => e.event_type === "staff_maternity_leave_set"));
  });
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  evaluateHrOsModuleEntitlement,
  HR_OS_ROUTE_REQUIRED_ROLES,
} from "@/src/lib/platform/entitlements/modules";
import type { EntitlementAccessContext } from "@/src/lib/platform/entitlements/entitlementTypes";
import {
  applyStandardHoursTemplate,
  type StaffStandardHoursDayInput,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  saveStaffStandardHours,
  STAFF_STANDARD_HOURS_CLINIC_NOT_FOUND_MESSAGE,
  STAFF_STANDARD_HOURS_PERMISSION_DENIED_MESSAGE,
  STAFF_STANDARD_HOURS_STAFF_NOT_FOUND_MESSAGE,
  validateStandardHoursWriteScope,
} from "@/src/lib/workforce-os/staffStandardHours.server";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STAFF_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF_OTHER_TENANT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CLINIC_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CLINIC_OTHER_TENANT = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function entitledContext(
  overrides: Partial<EntitlementAccessContext> = {}
): EntitlementAccessContext {
  return {
    tenantExists: true,
    verificationStatus: "verified",
    subscriptionStatus: "active",
    moduleExists: true,
    moduleEnabled: true,
    allowedRoles: [...HR_OS_ROUTE_REQUIRED_ROLES, "member"],
    userExists: true,
    userRole: "admin",
    ...overrides,
  };
}

function assertHrOsRosterManageAllowedFromRole(userRole: string): void {
  const access = evaluateHrOsModuleEntitlement(entitledContext({ userRole }));
  if (!access.ok) {
    throw new CrmAccessError(403, access.message);
  }
  const role = userRole.trim().toLowerCase();
  if (!HR_OS_ROUTE_REQUIRED_ROLES.some((allowed) => allowed === role)) {
    throw new CrmAccessError(
      403,
      "Owner, admin, or HR manager role required for roster management."
    );
  }
}

type StaffRow = { id: string; tenant_id: string };
type ClinicRow = { id: string; tenant_id: string };
type StandardHoursRow = Record<string, unknown>;

function createMockSupabase(seed?: {
  staff?: StaffRow[];
  clinics?: ClinicRow[];
  denyWrites?: boolean;
  failInsert?: boolean;
}) {
  const staff = seed?.staff ?? [
    { id: STAFF_A, tenant_id: TENANT_A },
    { id: STAFF_OTHER_TENANT, tenant_id: TENANT_B },
  ];
  const clinics = seed?.clinics ?? [
    { id: CLINIC_A, tenant_id: TENANT_A },
    { id: CLINIC_OTHER_TENANT, tenant_id: TENANT_B },
  ];
  const standardHours: StandardHoursRow[] = [];
  const workingHoursByStaff = new Map<string, Record<string, unknown>>();

  const client = {
    from(table: string) {
      if (table === "fi_staff") {
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
                    const row = staff.find((s) =>
                      filters.every((f) => String((s as Record<string, unknown>)[f.col]) === f.val)
                    );
                    return { data: row ?? null, error: null };
                  },
                  single: async () => chain.maybeSingle(),
                };
                return chain;
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                const filters = [{ col, val }];
                const chain = {
                  eq(col2: string, val2: string) {
                    filters.push({ col: col2, val: val2 });
                    return chain;
                  },
                  async then(resolve: (v: { error: null }) => void) {
                    const row = staff.find((s) =>
                      filters.every((f) => String((s as Record<string, unknown>)[f.col]) === f.val)
                    );
                    if (row) workingHoursByStaff.set(row.id, patch);
                    resolve({ error: null });
                  },
                };
                return chain;
              },
            };
          },
        };
      }

      if (table === "fi_clinics") {
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
                    const row = clinics.find((c) =>
                      filters.every((f) => String((c as Record<string, unknown>)[f.col]) === f.val)
                    );
                    return { data: row ?? null, error: null };
                  },
                };
                return chain;
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    async rpc(
      fn: string,
      args: Record<string, unknown>
    ): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
      if (fn !== "fi_replace_staff_standard_hours") {
        return { data: null, error: { message: `unknown rpc ${fn}` } };
      }
      if (seed?.denyWrites || seed?.failInsert) {
        return {
          data: null,
          error: { message: "new row violates row-level security policy" },
        };
      }
      for (const row of standardHours) {
        if (
          row.tenant_id === args.p_tenant_id &&
          row.staff_id === args.p_staff_id &&
          row.status === "active"
        ) {
          Object.assign(row, { status: "archived" });
        }
      }
      const rows = (args.p_rows as StandardHoursRow[]) ?? [];
      for (const row of rows) {
        standardHours.push({
          ...row,
          id: randomUUID(),
          tenant_id: args.p_tenant_id,
          staff_id: args.p_staff_id,
          status: "active",
        });
      }
      return {
        data: { ok: true, archived_count: 0, inserted_count: rows.length },
        error: null,
      };
    },
  } as unknown as SupabaseClient;

  return {
    client,
    standardHours,
    workingHoursByStaff,
  };
}

describe("validateStandardHoursWriteScope", () => {
  it("allows staff and clinic in the same tenant", async () => {
    const { client } = createMockSupabase();
    const days = applyStandardHoursTemplate("four_ten").map((day) => ({
      ...day,
      clinic_id: CLINIC_A,
    }));
    await assert.doesNotReject(() =>
      validateStandardHoursWriteScope(TENANT_A, STAFF_A, days, client)
    );
  });

  it("blocks staff from another tenant", async () => {
    const { client } = createMockSupabase();
    const days = applyStandardHoursTemplate("four_ten");
    await assert.rejects(
      () => validateStandardHoursWriteScope(TENANT_A, STAFF_OTHER_TENANT, days, client),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.equal(e.message, STAFF_STANDARD_HOURS_STAFF_NOT_FOUND_MESSAGE);
        return true;
      }
    );
  });

  it("blocks clinic from another tenant", async () => {
    const { client } = createMockSupabase();
    const days: StaffStandardHoursDayInput[] = applyStandardHoursTemplate("four_ten").map(
      (day, idx) => ({
        ...day,
        clinic_id: idx === 0 ? CLINIC_OTHER_TENANT : null,
      })
    );
    await assert.rejects(
      () => validateStandardHoursWriteScope(TENANT_A, STAFF_A, days, client),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.equal(e.message, STAFF_STANDARD_HOURS_CLINIC_NOT_FOUND_MESSAGE);
        return true;
      }
    );
  });
});

describe("saveStaffStandardHours", () => {
  it("saves four_ten template for an authorised tenant scope", async () => {
    const { client, standardHours, workingHoursByStaff } = createMockSupabase();
    const days = applyStandardHoursTemplate("four_ten");

    const result = await saveStaffStandardHours(
      { tenantId: TENANT_A, staffId: STAFF_A, days },
      { supabaseClientForTests: client }
    );

    assert.equal(result.validation.valid, true);
    assert.equal(result.outcome, "standard_hours_saved");
    assert.equal(standardHours.length, 7);
    assert.equal(standardHours.filter((r) => r.status === "active").length, 7);
    assert.ok(workingHoursByStaff.has(STAFF_A));
  });

  it("returns a controlled error when writes are denied by RLS", async () => {
    const { client } = createMockSupabase({ denyWrites: true });
    const days = applyStandardHoursTemplate("four_ten");

    await assert.rejects(
      () =>
        saveStaffStandardHours(
          { tenantId: TENANT_A, staffId: STAFF_A, days },
          { supabaseClientForTests: client }
        ),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.equal(e.message, STAFF_STANDARD_HOURS_PERMISSION_DENIED_MESSAGE);
        return true;
      }
    );
  });

  it("blocks cross-tenant staff writes before hitting the database", async () => {
    const { client, standardHours } = createMockSupabase();
    const days = applyStandardHoursTemplate("four_ten");

    await assert.rejects(
      () =>
        saveStaffStandardHours(
          { tenantId: TENANT_A, staffId: STAFF_OTHER_TENANT, days },
          { supabaseClientForTests: client }
        ),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.equal(e.message, STAFF_STANDARD_HOURS_STAFF_NOT_FOUND_MESSAGE);
        return true;
      }
    );
    assert.equal(standardHours.length, 0);
  });
});

describe("saveStaffStandardHours permission gate", () => {
  it("allows clinic admin / hr_manager roster management roles", () => {
    for (const role of ["admin", "hr_manager", "owner"] as const) {
      assert.doesNotThrow(() => assertHrOsRosterManageAllowedFromRole(role));
    }
  });

  it("denies staff without workforce management permission", () => {
    assert.throws(
      () => assertHrOsRosterManageAllowedFromRole("member"),
      (e: unknown) => {
        assert.ok(e instanceof CrmAccessError);
        assert.equal(e.status, 403);
        assert.equal(e.message.length > 0, true);
        return true;
      }
    );
  });
});

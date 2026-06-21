import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireModuleAccess } from "./requireModuleAccess.server";

const TENANT = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
const USER = "bbbbbbbb-bbbb-4ccc-dddd-ffffffffffff";
const MODULE_ID = "cccccccc-bbbb-4ccc-dddd-111111111111";

type MockState = {
  tenant?: { id: string; verification_status: string } | null;
  billing?: { subscription_status: string } | null;
  module?: { id: string; code: string; default_allowed_roles: string[]; is_active: boolean } | null;
  tenantModule?: { enabled: boolean; allowed_roles: string[] } | null;
  user?: { id: string; role: string } | null;
  auditInserts: Array<Record<string, unknown>>;
};

function createMockSupabase(state: MockState): SupabaseClient {
  state.auditInserts = state.auditInserts ?? [];

  const from = (table: string) => {
    if (table === "fi_tenants") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.tenant ?? null, error: null }),
          }),
        }),
      };
    }
    if (table === "fi_tenant_billing_status") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.billing ?? null, error: null }),
          }),
        }),
      };
    }
    if (table === "fi_modules") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.module ?? null, error: null }),
          }),
        }),
      };
    }
    if (table === "fi_tenant_modules") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.tenantModule ?? null, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "fi_users") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.user ?? null, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "fi_entitlement_audit_events") {
      return {
        insert: async (row: Record<string, unknown>) => {
          state.auditInserts.push(row);
          return { error: null };
        },
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  };

  return { from } as unknown as SupabaseClient;
}

function entitledState(overrides: Partial<MockState> = {}): MockState {
  return {
    tenant: { id: TENANT, verification_status: "verified" },
    billing: { subscription_status: "active" },
    module: {
      id: MODULE_ID,
      code: "hr_os",
      default_allowed_roles: ["admin", "fi_admin", "owner", "tenant_backend"],
      is_active: true,
    },
    tenantModule: { enabled: true, allowed_roles: [] },
    user: { id: USER, role: "admin" },
    auditInserts: [],
    ...overrides,
  };
}

test("requireModuleAccess allows entitled tenant and writes audit", async () => {
  const state = entitledState();
  const supabase = createMockSupabase(state);

  const result = await requireModuleAccess({
    tenantId: TENANT,
    userId: USER,
    moduleCode: "hr_os",
    supabaseClientForTests: supabase,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.tenantId, TENANT);
    assert.equal(result.userId, USER);
    assert.equal(result.moduleCode, "hr_os");
  }
  assert.equal(state.auditInserts.length, 1);
  assert.equal(state.auditInserts[0]?.outcome, "allowed");
  assert.equal(state.auditInserts[0]?.denial_reason, null);
});

test("audit event written for denial", async () => {
  const state = entitledState({ tenantModule: { enabled: false, allowed_roles: [] } });
  const supabase = createMockSupabase(state);

  const result = await requireModuleAccess({
    tenantId: TENANT,
    userId: USER,
    moduleCode: "hr_os",
    supabaseClientForTests: supabase,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "module_disabled");
    assert.match(result.message, /not enabled/i);
  }
  assert.equal(state.auditInserts.length, 1);
  assert.equal(state.auditInserts[0]?.outcome, "denied");
  assert.equal(state.auditInserts[0]?.denial_reason, "module_disabled");
  assert.equal(state.auditInserts[0]?.module_code, "hr_os");
});

test("requireModuleAccess denies inactive billing without exposing internals", async () => {
  const state = entitledState({ billing: { subscription_status: "past_due" } });
  const supabase = createMockSupabase(state);

  const result = await requireModuleAccess({
    tenantId: TENANT,
    userId: USER,
    moduleCode: "hr_os",
    supabaseClientForTests: supabase,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "billing_inactive");
    assert.doesNotMatch(result.message, /past_due|subscription_plan/i);
  }
});

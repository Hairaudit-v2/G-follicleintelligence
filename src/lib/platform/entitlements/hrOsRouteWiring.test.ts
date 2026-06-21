import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { activateTenantModule, deactivateTenantModule } from "./activateTenantModule.server";
import type { EntitlementAccessContext } from "./entitlementTypes";
import {
  evaluateHrOsModuleEntitlement,
  HR_OS_ROUTE_REQUIRED_ROLES,
  canShowModuleNav,
} from "./modules";
import { resolveHrOsRouteAccessWithOptions } from "./hrOsRouteGateCore.server";
import { loadClientSafeTenantEntitlements } from "./tenantEntitlements.server";

const TENANT = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
const USER = "bbbbbbbb-bbbb-4ccc-dddd-ffffffffffff";
const AUTH_USER = "cccccccc-bbbb-4ccc-dddd-111111111111";
const MODULE_ID = "dddddddd-bbbb-4ccc-dddd-222222222222";

type MockState = {
  tenant?: { id: string; verification_status: string } | null;
  billing?: { subscription_status: string } | null;
  module?: { id: string; code: string; default_allowed_roles: string[]; is_active: boolean } | null;
  tenantModule?: { enabled: boolean; allowed_roles: string[] } | null;
  user?: { id: string; role: string; auth_user_id?: string } | null;
  auditInserts: Array<Record<string, unknown>>;
  tenantUpdates: Array<Record<string, unknown>>;
  billingUpserts: Array<Record<string, unknown>>;
  tenantModuleUpserts: Array<Record<string, unknown>>;
};

function createMockSupabase(state: MockState): SupabaseClient {
  state.auditInserts = state.auditInserts ?? [];
  state.tenantUpdates = state.tenantUpdates ?? [];
  state.billingUpserts = state.billingUpserts ?? [];
  state.tenantModuleUpserts = state.tenantModuleUpserts ?? [];

  const from = (table: string) => {
    if (table === "fi_tenants") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.tenant ?? null, error: null }),
          }),
        }),
        update: (row: Record<string, unknown>) => ({
          eq: async () => {
            state.tenantUpdates.push(row);
            return { error: null };
          },
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
        upsert: async (row: Record<string, unknown>) => {
          state.billingUpserts.push(row);
          return { error: null };
        },
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
        upsert: async (row: Record<string, unknown>) => {
          state.tenantModuleUpserts.push(row);
          return { error: null };
        },
      };
    }
    if (table === "fi_users") {
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.user ?? null, error: null }),
            }),
            maybeSingle: async () => ({ data: state.user ?? null, error: null }),
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

function entitledContext(overrides: Partial<EntitlementAccessContext> = {}): EntitlementAccessContext {
  return {
    tenantExists: true,
    verificationStatus: "verified",
    subscriptionStatus: "active",
    moduleExists: true,
    moduleEnabled: true,
    allowedRoles: ["admin", "owner", "hr_manager", "crm_operator"],
    userExists: true,
    userRole: "admin",
    ...overrides,
  };
}

function entitledState(overrides: Partial<MockState> = {}): MockState {
  return {
    tenant: { id: TENANT, verification_status: "verified" },
    billing: { subscription_status: "active" },
    module: {
      id: MODULE_ID,
      code: "hr_os",
      default_allowed_roles: ["admin", "owner", "hr_manager"],
      is_active: true,
    },
    tenantModule: { enabled: true, allowed_roles: [] },
    user: { id: USER, role: "admin", auth_user_id: AUTH_USER },
    auditInserts: [],
    tenantUpdates: [],
    billingUpserts: [],
    tenantModuleUpserts: [],
    ...overrides,
  };
}

test("verified + active + enabled + allowed role can access HR OS", () => {
  const result = evaluateHrOsModuleEntitlement(entitledContext({ userRole: "admin" }));
  assert.equal(result.ok, true);
});

test("verified + active + enabled + wrong role denied", () => {
  const result = evaluateHrOsModuleEntitlement(entitledContext({ userRole: "crm_operator" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "role_not_allowed");
  assert.deepEqual([...HR_OS_ROUTE_REQUIRED_ROLES], ["owner", "admin", "hr_manager"]);
});

test("verified + active + disabled module denied", () => {
  const result = evaluateHrOsModuleEntitlement(entitledContext({ moduleEnabled: false }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "module_disabled");
});

test("unverified tenant denied", () => {
  const result = evaluateHrOsModuleEntitlement(entitledContext({ verificationStatus: "unverified" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "tenant_unverified");
});

test("inactive billing denied", () => {
  const result = evaluateHrOsModuleEntitlement(entitledContext({ subscriptionStatus: "past_due" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "billing_inactive");
});

test("trialing billing allowed", () => {
  const result = evaluateHrOsModuleEntitlement(entitledContext({ subscriptionStatus: "trialing" }));
  assert.equal(result.ok, true);
});

test("nav hidden when module unavailable", () => {
  const entitlements = {
    tenantId: TENANT,
    userId: USER,
    modules: {
      hr_os: { moduleCode: "hr_os", canAccess: false, showInNav: false },
    },
  };
  assert.equal(canShowModuleNav(entitlements, "hr_os"), false);
});

test("nav shown when module available", () => {
  const entitlements = {
    tenantId: TENANT,
    userId: USER,
    modules: {
      hr_os: { moduleCode: "hr_os", canAccess: true, showInNav: true },
    },
  };
  assert.equal(canShowModuleNav(entitlements, "hr_os"), true);
});

test("loadClientSafeTenantEntitlements hides nav when disabled module", async () => {
  const state = entitledState({ tenantModule: { enabled: false, allowed_roles: [] } });
  const supabase = createMockSupabase(state);

  const entitlements = await loadClientSafeTenantEntitlements({
    tenantId: TENANT,
    userId: USER,
    moduleCodes: ["hr_os"],
    supabaseClientForTests: supabase,
  });

  assert.equal(canShowModuleNav(entitlements, "hr_os"), false);
});

test("loadClientSafeTenantEntitlements shows nav when entitled", async () => {
  const state = entitledState();
  const supabase = createMockSupabase(state);

  const entitlements = await loadClientSafeTenantEntitlements({
    tenantId: TENANT,
    userId: USER,
    moduleCodes: ["hr_os"],
    supabaseClientForTests: supabase,
  });

  assert.equal(canShowModuleNav(entitlements, "hr_os"), true);
});

test("manual activation enables HR OS", async () => {
  const state = entitledState({ tenantModule: { enabled: false, allowed_roles: [] } });
  const supabase = createMockSupabase(state);

  const result = await activateTenantModule({
    tenantId: TENANT,
    moduleCode: "hr_os",
    subscriptionStatus: "active",
    verificationStatus: "verified",
    supabaseClientForTests: supabase,
  });

  assert.equal(result.ok, true);
  assert.equal(state.tenantModuleUpserts.length, 1);
  assert.equal(state.tenantModuleUpserts[0]?.enabled, true);
  assert.equal(state.billingUpserts[0]?.subscription_status, "active");
  assert.equal(state.auditInserts.some((row) => row.source === "hr_os_module_manual_enable"), true);
});

test("manual deactivation writes disable audit", async () => {
  const state = entitledState();
  const supabase = createMockSupabase(state);

  const result = await deactivateTenantModule({
    tenantId: TENANT,
    moduleCode: "hr_os",
    supabaseClientForTests: supabase,
  });

  assert.equal(result.ok, true);
  assert.equal(state.tenantModuleUpserts[0]?.enabled, false);
  assert.equal(state.auditInserts.some((row) => row.source === "hr_os_module_manual_disable"), true);
});

test("audit written on route denial", async () => {
  const state = entitledState({ tenantModule: { enabled: false, allowed_roles: [] } });
  const supabase = createMockSupabase(state);

  const result = await resolveHrOsRouteAccessWithOptions(TENANT, {
    supabaseClientForTests: supabase,
    authUserId: AUTH_USER,
    platformAdminPreview: false,
  });

  assert.equal(result.ok, false);
  assert.equal(state.auditInserts.length, 1);
  assert.equal(state.auditInserts[0]?.source, "hr_os_route_access");
  assert.equal(state.auditInserts[0]?.outcome, "denied");
  assert.equal(state.auditInserts[0]?.denial_reason, "module_disabled");
});

test("route access allowed writes hr_os_route_access audit", async () => {
  const state = entitledState();
  const supabase = createMockSupabase(state);

  const result = await resolveHrOsRouteAccessWithOptions(TENANT, {
    supabaseClientForTests: supabase,
    authUserId: AUTH_USER,
    platformAdminPreview: false,
  });

  assert.equal(result.ok, true);
  assert.equal(state.auditInserts.length, 1);
  assert.equal(state.auditInserts[0]?.source, "hr_os_route_access");
  assert.equal(state.auditInserts[0]?.outcome, "allowed");
});

test("hr_manager role allowed through HR OS route gate", async () => {
  const state = entitledState({ user: { id: USER, role: "hr_manager", auth_user_id: AUTH_USER } });
  const supabase = createMockSupabase(state);

  const result = await resolveHrOsRouteAccessWithOptions(TENANT, {
    supabaseClientForTests: supabase,
    authUserId: AUTH_USER,
    platformAdminPreview: false,
  });

  assert.equal(result.ok, true);
});

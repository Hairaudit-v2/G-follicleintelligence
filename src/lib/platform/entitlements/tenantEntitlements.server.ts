import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type {
  ClientSafeModuleEntitlement,
  ClientSafeTenantEntitlements,
  EntitlementAccessContext,
  FiSubscriptionStatus,
  FiTenantVerificationStatus,
  ModuleAccessResult,
} from "./entitlementTypes";
import {
  defaultAllowedRolesForModule,
  evaluateModuleAccess,
  FI_OS_MODULE_CODES,
  isFiModuleCode,
  resolveEffectiveAllowedRoles,
  type FiModuleCode,
} from "./modules";

export type LoadEntitlementContextOptions = {
  supabaseClientForTests?: SupabaseClient;
};

type TenantRow = { id: string; verification_status: string | null };
type BillingRow = { subscription_status: string | null };
type ModuleRow = { id: string; code: string; default_allowed_roles: string[] | null; is_active: boolean | null };
type TenantModuleRow = { enabled: boolean | null; allowed_roles: string[] | null };
type UserRow = { id: string; role: string | null };

export async function loadEntitlementAccessContext(opts: {
  tenantId: string;
  userId: string;
  moduleCode: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<EntitlementAccessContext> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const tenantId = opts.tenantId.trim();
  const userId = opts.userId.trim();
  const moduleCode = opts.moduleCode.trim();

  const [tenantRes, billingRes, moduleRes, userRes] = await Promise.all([
    supabase.from("fi_tenants").select("id, verification_status").eq("id", tenantId).maybeSingle(),
    supabase.from("fi_tenant_billing_status").select("subscription_status").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("fi_modules").select("id, code, default_allowed_roles, is_active").eq("code", moduleCode).maybeSingle(),
    supabase
      .from("fi_users")
      .select("id, role")
      .eq("tenant_id", tenantId)
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const tenant = tenantRes.data as TenantRow | null;
  const billing = billingRes.data as BillingRow | null;
  const moduleRow = moduleRes.data as ModuleRow | null;
  const user = userRes.data as UserRow | null;

  let tenantModule: TenantModuleRow | null = null;
  if (tenant && moduleRow) {
    const { data } = await supabase
      .from("fi_tenant_modules")
      .select("enabled, allowed_roles")
      .eq("tenant_id", tenantId)
      .eq("module_id", moduleRow.id)
      .maybeSingle();
    tenantModule = (data as TenantModuleRow | null) ?? null;
  }

  const moduleExists = Boolean(moduleRow && moduleRow.is_active !== false);
  const allowedRoles = moduleExists
    ? resolveEffectiveAllowedRoles(moduleCode, tenantModule?.allowed_roles, moduleRow?.default_allowed_roles)
    : [...defaultAllowedRolesForModule(moduleCode)];

  return {
    tenantExists: Boolean(tenant),
    verificationStatus: (tenant?.verification_status as FiTenantVerificationStatus | null) ?? null,
    subscriptionStatus: (billing?.subscription_status as FiSubscriptionStatus | null) ?? "inactive",
    moduleExists,
    moduleEnabled: Boolean(tenantModule?.enabled),
    allowedRoles,
    userExists: Boolean(user),
    userRole: user?.role ? String(user.role) : null,
  };
}

export async function loadClientSafeTenantEntitlements(opts: {
  tenantId: string;
  userId: string;
  moduleCodes?: readonly FiModuleCode[];
  supabaseClientForTests?: SupabaseClient;
}): Promise<ClientSafeTenantEntitlements> {
  const tenantId = opts.tenantId.trim();
  const userId = opts.userId.trim();
  const codes = opts.moduleCodes?.length ? opts.moduleCodes : FI_OS_MODULE_CODES;

  const modules: Record<string, ClientSafeModuleEntitlement> = {};
  for (const moduleCode of codes) {
    const ctx = await loadEntitlementAccessContext({
      tenantId,
      userId,
      moduleCode,
      supabaseClientForTests: opts.supabaseClientForTests,
    });
    const result = evaluateModuleAccess(ctx);
    const canAccess = result.ok;
    modules[moduleCode] = {
      moduleCode,
      canAccess,
      showInNav: canAccess,
    };
  }

  return { tenantId, userId, modules };
}

export function finalizeModuleAccessResult(
  result: ModuleAccessResult,
  opts: { tenantId: string; userId: string; moduleCode: string }
): ModuleAccessResult {
  if (!result.ok) return result;
  return {
    ok: true,
    tenantId: opts.tenantId,
    userId: opts.userId,
    moduleCode: opts.moduleCode,
    userRole: result.userRole,
  };
}

export function assertKnownModuleCode(moduleCode: string): FiModuleCode | null {
  return isFiModuleCode(moduleCode) ? moduleCode : null;
}

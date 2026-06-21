import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { writeEntitlementAuditEvent } from "./entitlementAudit.server";
import type { FiSubscriptionStatus, FiTenantVerificationStatus } from "./entitlementTypes";
import { isFiModuleCode } from "./modules";

export type ActivateTenantModuleInput = {
  tenantId: string;
  moduleCode: string;
  subscriptionStatus: Extract<FiSubscriptionStatus, "active" | "trialing">;
  verificationStatus: Extract<FiTenantVerificationStatus, "verified" | "enterprise_verified">;
  /** Unit tests only — bypass {@link supabaseAdmin} singleton. */
  supabaseClientForTests?: SupabaseClient;
};

export type DeactivateTenantModuleInput = {
  tenantId: string;
  moduleCode: string;
  supabaseClientForTests?: SupabaseClient;
};

type ModuleActivationResult = { ok: true } | { ok: false; message: string };

async function loadModuleId(
  supabase: SupabaseClient,
  moduleCode: string
): Promise<{ ok: true; moduleId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("fi_modules")
    .select("id, is_active")
    .eq("code", moduleCode)
    .maybeSingle();

  if (error) return { ok: false, message: "Could not load module catalog." };
  if (!data || (data as { is_active: boolean | null }).is_active === false) {
    return { ok: false, message: "Module is not available." };
  }

  return { ok: true, moduleId: String((data as { id: string }).id) };
}

/**
 * Manual tenant module activation (admin-only until Stripe).
 * Sets verification, billing status, and enables the module for the tenant.
 */
export async function activateTenantModule(opts: ActivateTenantModuleInput): Promise<ModuleActivationResult> {
  const tenantId = opts.tenantId.trim();
  const moduleCode = opts.moduleCode.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  if (!tenantId) return { ok: false, message: "tenantId is required." };
  if (!isFiModuleCode(moduleCode)) return { ok: false, message: "Unknown module code." };

  const { data: tenant, error: tenantErr } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (tenantErr) return { ok: false, message: "Could not verify tenant." };
  if (!tenant) return { ok: false, message: "Tenant not found." };

  const moduleRef = await loadModuleId(supabase, moduleCode);
  if (!moduleRef.ok) return moduleRef;

  const now = new Date().toISOString();

  const { error: verifyErr } = await supabase
    .from("fi_tenants")
    .update({ verification_status: opts.verificationStatus })
    .eq("id", tenantId);
  if (verifyErr) return { ok: false, message: "Could not update tenant verification." };

  const { error: billingErr } = await supabase.from("fi_tenant_billing_status").upsert(
    {
      tenant_id: tenantId,
      subscription_status: opts.subscriptionStatus,
      updated_at: now,
    },
    { onConflict: "tenant_id" }
  );
  if (billingErr) return { ok: false, message: "Could not update billing status." };

  const { error: moduleErr } = await supabase.from("fi_tenant_modules").upsert(
    {
      tenant_id: tenantId,
      module_id: moduleRef.moduleId,
      enabled: true,
      enabled_at: now,
      updated_at: now,
    },
    { onConflict: "tenant_id,module_id" }
  );
  if (moduleErr) return { ok: false, message: "Could not enable module for tenant." };

  const auditSource = moduleCode === "hr_os" ? "hr_os_module_manual_enable" : "module_manual_enable";
  const audit = await writeEntitlementAuditEvent(
    {
      tenantId,
      fiUserId: null,
      moduleCode,
      outcome: "allowed",
      source: auditSource,
      metadata: {
        action: "manual_enable",
        subscription_status: opts.subscriptionStatus,
        verification_status: opts.verificationStatus,
      },
    },
    { supabaseClientForTests: opts.supabaseClientForTests }
  );

  if (!audit.ok) return { ok: false, message: audit.message };
  return { ok: true };
}

/**
 * Manual tenant module deactivation (admin-only until Stripe).
 */
export async function deactivateTenantModule(opts: DeactivateTenantModuleInput): Promise<ModuleActivationResult> {
  const tenantId = opts.tenantId.trim();
  const moduleCode = opts.moduleCode.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  if (!tenantId) return { ok: false, message: "tenantId is required." };
  if (!isFiModuleCode(moduleCode)) return { ok: false, message: "Unknown module code." };

  const moduleRef = await loadModuleId(supabase, moduleCode);
  if (!moduleRef.ok) return moduleRef;

  const now = new Date().toISOString();
  const { error: moduleErr } = await supabase.from("fi_tenant_modules").upsert(
    {
      tenant_id: tenantId,
      module_id: moduleRef.moduleId,
      enabled: false,
      enabled_at: null,
      updated_at: now,
    },
    { onConflict: "tenant_id,module_id" }
  );
  if (moduleErr) return { ok: false, message: "Could not disable module for tenant." };

  const auditSource = moduleCode === "hr_os" ? "hr_os_module_manual_disable" : "module_manual_disable";
  const audit = await writeEntitlementAuditEvent(
    {
      tenantId,
      fiUserId: null,
      moduleCode,
      outcome: "denied",
      denialReason: "module_disabled",
      source: auditSource,
      metadata: { action: "manual_disable" },
    },
    { supabaseClientForTests: opts.supabaseClientForTests }
  );

  if (!audit.ok) return { ok: false, message: audit.message };
  return { ok: true };
}

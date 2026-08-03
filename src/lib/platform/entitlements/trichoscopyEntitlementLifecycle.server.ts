import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { writeModuleLifecycleAudit } from "@/src/lib/platform/entitlements/moduleLifecycleAudit.server";
import { invalidateTrichoscopyAccessCache } from "@/src/lib/platform/entitlements/resolveFiosTrichoscopyAccess.server";
import {
  capabilitiesForTier,
  HLI_TRICHOSCOPY_MODULE_KEY,
  intersectCapabilities,
  isTrichoscopyCapability,
  isTrichoscopyCapabilityTier,
  type TrichoscopyCapability,
  type TrichoscopyCapabilityTier,
  type TrichoscopyEntitlementStatus,
  type TrichoscopyModuleSettings,
} from "@/src/lib/platform/entitlements/trichoscopyCapabilities";

export type UpsertTrichoscopyEntitlementInput = {
  tenantId: string;
  status: TrichoscopyEntitlementStatus;
  capabilityTier: TrichoscopyCapabilityTier;
  enabledCapabilities?: TrichoscopyCapability[];
  source?: "subscription" | "manual_grant" | "trial" | "partner" | "legacy";
  subscriptionPlanId?: string | null;
  subscriptionId?: string | null;
  priceId?: string | null;
  startsAt?: string | null;
  trialEndsAt?: string | null;
  gracePeriodEndsAt?: string | null;
  expiresAt?: string | null;
  grantedBy?: string | null;
  actorUserId?: string | null;
  reason?: string | null;
  supabaseClientForTests?: SupabaseClient;
};

export async function upsertTrichoscopyEntitlement(
  input: UpsertTrichoscopyEntitlementInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const tenantId = input.tenantId.trim();
  if (!tenantId) return { ok: false, message: "tenantId required" };
  if (!isTrichoscopyCapabilityTier(input.capabilityTier)) {
    return { ok: false, message: "Invalid capability tier" };
  }

  const capabilities =
    input.enabledCapabilities?.filter(isTrichoscopyCapability) ??
    [...capabilitiesForTier(input.capabilityTier)];

  const supabase = input.supabaseClientForTests ?? supabaseAdmin();
  const { data: previous } = await supabase
    .from("fi_tenant_module_entitlements")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("module_key", HLI_TRICHOSCOPY_MODULE_KEY)
    .maybeSingle();

  const row = {
    tenant_id: tenantId,
    module_key: HLI_TRICHOSCOPY_MODULE_KEY,
    status: input.status,
    capability_tier: input.capabilityTier,
    enabled_capabilities: capabilities,
    source: input.source ?? "subscription",
    subscription_plan_id: input.subscriptionPlanId ?? null,
    subscription_id: input.subscriptionId ?? null,
    price_id: input.priceId ?? null,
    starts_at: input.startsAt ?? new Date().toISOString(),
    trial_ends_at: input.trialEndsAt ?? null,
    grace_period_ends_at: input.gracePeriodEndsAt ?? null,
    expires_at: input.expiresAt ?? null,
    granted_by: input.grantedBy ?? input.actorUserId ?? null,
    granted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("fi_tenant_module_entitlements").upsert(row, {
    onConflict: "tenant_id,module_key",
  });
  if (error) return { ok: false, message: error.message };

  invalidateTrichoscopyAccessCache(tenantId);
  await writeModuleLifecycleAudit({
    tenantId,
    eventType: previous ? "entitlement_changed" : "entitlement_granted",
    previousState: previous as Record<string, unknown> | null,
    newState: row,
    actorUserId: input.actorUserId,
    source: input.source ?? "subscription",
    reason: input.reason,
    subscriptionReference: input.subscriptionId,
    supabaseClientForTests: input.supabaseClientForTests,
  });

  return { ok: true };
}

export type SetTrichoscopyModuleConfigInput = {
  tenantId: string;
  enabled: boolean;
  settings?: TrichoscopyModuleSettings;
  actorUserId?: string | null;
  disableReason?: string | null;
  supabaseClientForTests?: SupabaseClient;
};

/**
 * Activate/deactivate operational module config.
 * Cannot enable capabilities outside the subscribed entitlement set.
 */
export async function setTrichoscopyModuleConfiguration(
  input: SetTrichoscopyModuleConfigInput
): Promise<{ ok: true; effectiveSettings: TrichoscopyModuleSettings } | { ok: false; message: string }> {
  const tenantId = input.tenantId.trim();
  const supabase = input.supabaseClientForTests ?? supabaseAdmin();

  const { data: entitlement } = await supabase
    .from("fi_tenant_module_entitlements")
    .select("status, capability_tier, enabled_capabilities")
    .eq("tenant_id", tenantId)
    .eq("module_key", HLI_TRICHOSCOPY_MODULE_KEY)
    .maybeSingle();

  if (input.enabled) {
    const status = String((entitlement as { status?: string } | null)?.status ?? "not_entitled");
    if (!["active", "trial", "grace_period"].includes(status)) {
      return {
        ok: false,
        message: "Cannot activate Trichoscopy without an active subscription entitlement.",
      };
    }
  }

  const tier = isTrichoscopyCapabilityTier(
    (entitlement as { capability_tier?: string } | null)?.capability_tier
  )
    ? ((entitlement as { capability_tier: TrichoscopyCapabilityTier }).capability_tier)
    : "capture";
  const subscribed = intersectCapabilities(
    ((entitlement as { enabled_capabilities?: string[] } | null)?.enabled_capabilities ?? []).filter(
      isTrichoscopyCapability
    ),
    capabilitiesForTier(tier)
  );

  const requested = input.settings ?? {};
  const effectiveSettings: TrichoscopyModuleSettings = {
    allowPatientUploads: Boolean(requested.allowPatientUploads),
    allowClinicCapture: requested.allowClinicCapture !== false,
    allowLongitudinalMonitoring:
      Boolean(requested.allowLongitudinalMonitoring) &&
      subscribed.includes("trichoscopy.longitudinal"),
    allowSurgicalPlanning:
      Boolean(requested.allowSurgicalPlanning) && subscribed.includes("trichoscopy.surgical_planning"),
    allowProcedureDayCapture:
      Boolean(requested.allowProcedureDayCapture) && subscribed.includes("trichoscopy.procedure_day"),
    allowPatientReports:
      Boolean(requested.allowPatientReports) && subscribed.includes("trichoscopy.patient_reports"),
    defaultReviewerRole: requested.defaultReviewerRole,
    defaultCaptureProtocol: requested.defaultCaptureProtocol,
    defaultDeviceId: requested.defaultDeviceId,
  };

  if (requested.allowSurgicalPlanning && !subscribed.includes("trichoscopy.surgical_planning")) {
    return { ok: false, message: "Surgical planning is not included in your subscription." };
  }
  if (requested.allowLongitudinalMonitoring && !subscribed.includes("trichoscopy.longitudinal")) {
    return { ok: false, message: "Longitudinal monitoring is not included in your subscription." };
  }
  if (requested.allowProcedureDayCapture && !subscribed.includes("trichoscopy.procedure_day")) {
    return { ok: false, message: "Procedure-day capture is not included in your subscription." };
  }
  if (requested.allowPatientReports && !subscribed.includes("trichoscopy.patient_reports")) {
    return { ok: false, message: "Patient reports are not included in your subscription." };
  }

  const now = new Date().toISOString();
  const row = {
    tenant_id: tenantId,
    module_key: HLI_TRICHOSCOPY_MODULE_KEY,
    enabled: input.enabled,
    settings: effectiveSettings,
    enabled_at: input.enabled ? now : null,
    enabled_by: input.enabled ? (input.actorUserId ?? null) : null,
    disabled_at: input.enabled ? null : now,
    disabled_by: input.enabled ? null : (input.actorUserId ?? null),
    disable_reason: input.enabled ? null : (input.disableReason ?? null),
    updated_at: now,
  };

  const { error } = await supabase.from("fi_tenant_module_configurations").upsert(row, {
    onConflict: "tenant_id,module_key",
  });
  if (error) return { ok: false, message: error.message };

  invalidateTrichoscopyAccessCache(tenantId);
  await writeModuleLifecycleAudit({
    tenantId,
    eventType: input.enabled ? "module_enabled" : "module_disabled",
    newState: row,
    actorUserId: input.actorUserId,
    reason: input.disableReason,
    supabaseClientForTests: input.supabaseClientForTests,
  });

  return { ok: true, effectiveSettings };
}

export type CreateTrichoscopyOverrideInput = {
  tenantId: string;
  capabilities: TrichoscopyCapability[];
  startsAt: string;
  endsAt: string;
  reason: string;
  approvedBy: string;
  createdBy: string;
  supabaseClientForTests?: SupabaseClient;
};

export async function createTrichoscopyOverride(
  input: CreateTrichoscopyOverrideInput
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    return { ok: false, message: "Override end must be after start." };
  }
  const caps = input.capabilities.filter(isTrichoscopyCapability);
  if (!caps.length) return { ok: false, message: "At least one capability required." };

  const supabase = input.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_module_overrides")
    .insert({
      tenant_id: input.tenantId.trim(),
      module_key: HLI_TRICHOSCOPY_MODULE_KEY,
      capabilities: caps,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      reason: input.reason.trim(),
      approved_by: input.approvedBy,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed" };

  invalidateTrichoscopyAccessCache(input.tenantId);
  await writeModuleLifecycleAudit({
    tenantId: input.tenantId,
    eventType: "manual_override",
    newState: { override_id: data.id, capabilities: caps, ends_at: input.endsAt },
    actorUserId: input.createdBy,
    reason: input.reason,
    supabaseClientForTests: input.supabaseClientForTests,
  });

  return { ok: true, id: String((data as { id: string }).id) };
}

export async function recordTrichoscopyUsage(opts: {
  tenantId: string;
  capability?: TrichoscopyCapability | null;
  usageType: string;
  quantity?: number;
  occurredAt?: string;
  sourceReference?: string | null;
  idempotencyKey: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<{ ok: true; inserted: boolean } | { ok: false; message: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { error } = await supabase.from("fi_tenant_module_usage").insert({
    tenant_id: opts.tenantId.trim(),
    module_key: HLI_TRICHOSCOPY_MODULE_KEY,
    capability: opts.capability ?? null,
    usage_type: opts.usageType,
    quantity: opts.quantity ?? 1,
    occurred_at: opts.occurredAt ?? new Date().toISOString(),
    source_reference: opts.sourceReference ?? null,
    idempotency_key: opts.idempotencyKey,
  });

  if (error) {
    if (String(error.message).toLowerCase().includes("duplicate") || error.code === "23505") {
      return { ok: true, inserted: false };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true, inserted: true };
}

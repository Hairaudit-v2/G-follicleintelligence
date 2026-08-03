import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HLI_TRICHOSCOPY_MODULE_CODE } from "@/src/lib/platform/entitlements/modules";
import { requireModuleAccess } from "@/src/lib/platform/entitlements/requireModuleAccess.server";
import {
  capabilitiesForTier,
  capabilitiesFromModuleSettings,
  evaluateTrichoscopyAccessLayers,
  HLI_TRICHOSCOPY_MODULE_KEY,
  isTrichoscopyCapability,
  isTrichoscopyCapabilityTier,
  TRICHOSCOPY_CAPABILITIES,
  type FiosTrichoscopyAccessResult,
  type TrichoscopyCapability,
  type TrichoscopyCapabilityTier,
  type TrichoscopyEntitlementStatus,
  type TrichoscopyModuleSettings,
} from "@/src/lib/platform/entitlements/trichoscopyCapabilities";

const PLATFORM_FLAG = "FI_ENABLE_HLI_TRICHOSCOPY";

/** Short-lived in-process cache (deny on ambiguity; invalidate on writes). */
const ACCESS_CACHE_TTL_MS = 15_000;
type CacheEntry = { expiresAt: number; value: FiosTrichoscopyAccessResult };
const accessCache = new Map<string, CacheEntry>();

export function isHliTrichoscopyPlatformEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env[PLATFORM_FLAG] ?? "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function invalidateTrichoscopyAccessCache(tenantId?: string): void {
  if (!tenantId?.trim()) {
    accessCache.clear();
    return;
  }
  const prefix = `${tenantId.trim()}:`;
  for (const key of accessCache.keys()) {
    if (key.startsWith(prefix)) accessCache.delete(key);
  }
}

type EntitlementRow = {
  status: string;
  capability_tier: string;
  enabled_capabilities: string[] | null;
  subscription_plan_id: string | null;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  expires_at: string | null;
};

type ConfigRow = {
  enabled: boolean;
  settings: TrichoscopyModuleSettings | Record<string, unknown> | null;
};

type OverrideRow = {
  capabilities: string[] | null;
  starts_at: string;
  ends_at: string;
  revoked_at: string | null;
};

function parseCapabilities(raw: string[] | null | undefined): TrichoscopyCapability[] {
  if (!raw?.length) return [];
  return raw.filter(isTrichoscopyCapability);
}

async function loadEntitlementProjection(
  tenantId: string,
  supabase: SupabaseClient
): Promise<EntitlementRow | null> {
  const { data, error } = await supabase
    .from("fi_tenant_module_entitlements")
    .select(
      "status, capability_tier, enabled_capabilities, subscription_plan_id, trial_ends_at, grace_period_ends_at, expires_at"
    )
    .eq("tenant_id", tenantId)
    .eq("module_key", HLI_TRICHOSCOPY_MODULE_KEY)
    .maybeSingle();
  if (error || !data) return null;
  return data as EntitlementRow;
}

async function loadModuleConfiguration(
  tenantId: string,
  supabase: SupabaseClient
): Promise<ConfigRow | null> {
  const { data, error } = await supabase
    .from("fi_tenant_module_configurations")
    .select("enabled, settings")
    .eq("tenant_id", tenantId)
    .eq("module_key", HLI_TRICHOSCOPY_MODULE_KEY)
    .maybeSingle();
  if (error || !data) return null;
  return data as ConfigRow;
}

async function loadActiveOverrides(
  tenantId: string,
  supabase: SupabaseClient,
  now: Date
): Promise<TrichoscopyCapability[]> {
  const { data, error } = await supabase
    .from("fi_tenant_module_overrides")
    .select("capabilities, starts_at, ends_at, revoked_at")
    .eq("tenant_id", tenantId)
    .eq("module_key", HLI_TRICHOSCOPY_MODULE_KEY)
    .is("revoked_at", null);
  if (error || !data?.length) return [];
  const nowMs = now.getTime();
  const caps = new Set<TrichoscopyCapability>();
  for (const row of data as OverrideRow[]) {
    const start = new Date(row.starts_at).getTime();
    const end = new Date(row.ends_at).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || nowMs < start || nowMs > end) continue;
    for (const c of parseCapabilities(row.capabilities)) caps.add(c);
  }
  return [...caps];
}

async function assertResourceBelongsToTenant(opts: {
  tenantId: string;
  patientId?: string | null;
  caseId?: string | null;
  supabase: SupabaseClient;
}): Promise<boolean> {
  const { tenantId, patientId, caseId, supabase } = opts;
  if (!patientId?.trim() && !caseId?.trim()) return true;

  if (patientId?.trim()) {
    const { data, error } = await supabase
      .from("fi_patients")
      .select("id")
      .eq("id", patientId.trim())
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return false;
  }

  if (caseId?.trim()) {
    const { data, error } = await supabase
      .from("fi_cases")
      .select("id")
      .eq("id", caseId.trim())
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return false;
  }

  return true;
}

export type ResolveFiosTrichoscopyAccessInput = {
  tenantId: string;
  userId: string;
  capability: TrichoscopyCapability;
  patientId?: string | null;
  caseId?: string | null;
  /** Skip requireModuleAccess role check (platform admin preview). */
  bypassUserPermission?: boolean;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
  now?: Date;
  skipCache?: boolean;
};

/**
 * Layered trichoscopy access resolver.
 * Platform flag ∩ entitlement ∩ config ∩ capability ∩ user ∩ resource.
 */
export async function resolveFiosTrichoscopyAccess(
  input: ResolveFiosTrichoscopyAccessInput
): Promise<FiosTrichoscopyAccessResult> {
  const tenantId = input.tenantId.trim();
  const userId = input.userId.trim();
  const capability = input.capability;
  const now = input.now ?? new Date();
  const cacheKey = `${tenantId}:${userId}:${capability}:${input.patientId ?? ""}:${input.caseId ?? ""}`;

  if (!input.skipCache) {
    const hit = accessCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
  }

  const env = input.env ?? process.env;
  const platformEnabled = isHliTrichoscopyPlatformEnabled(env);
  const supabase = input.supabaseClientForTests ?? supabaseAdmin();

  let userPermitted = Boolean(input.bypassUserPermission);
  if (!userPermitted) {
    const moduleAccess = await requireModuleAccess({
      tenantId,
      userId,
      moduleCode: HLI_TRICHOSCOPY_MODULE_CODE,
      writeAudit: false,
      supabaseClientForTests: input.supabaseClientForTests,
    });
    userPermitted = moduleAccess.ok;
  }

  const [entitlement, config, overrides, resourceAccessible] = await Promise.all([
    loadEntitlementProjection(tenantId, supabase),
    loadModuleConfiguration(tenantId, supabase),
    loadActiveOverrides(tenantId, supabase, now),
    assertResourceBelongsToTenant({
      tenantId,
      patientId: input.patientId,
      caseId: input.caseId,
      supabase,
    }),
  ]);

  const tier: TrichoscopyCapabilityTier | null = entitlement
    ? isTrichoscopyCapabilityTier(entitlement.capability_tier)
      ? entitlement.capability_tier
      : "capture"
    : null;

  const subscribedFromRow = parseCapabilities(entitlement?.enabled_capabilities);
  const subscribedCapabilities =
    subscribedFromRow.length > 0
      ? subscribedFromRow
      : tier
        ? [...capabilitiesForTier(tier)]
        : [];

  const settings = (config?.settings ?? {}) as TrichoscopyModuleSettings;
  const tenantConfigCapabilities = config?.enabled
    ? capabilitiesFromModuleSettings(settings)
    : [];

  const result = evaluateTrichoscopyAccessLayers({
    platformEnabled,
    entitlementStatus: (entitlement?.status as TrichoscopyEntitlementStatus) ?? "not_entitled",
    capabilityTier: tier,
    subscribedCapabilities,
    tenantModuleEnabled: Boolean(config?.enabled),
    tenantConfigCapabilities,
    platformCapabilities: [...TRICHOSCOPY_CAPABILITIES],
    overrideCapabilities: overrides,
    userPermitted,
    resourceAccessible,
    requestedCapability: capability,
    now,
    trialEndsAt: entitlement?.trial_ends_at,
    expiresAt: entitlement?.expires_at,
    gracePeriodEndsAt: entitlement?.grace_period_ends_at,
  });

  if (entitlement?.subscription_plan_id) {
    result.subscriptionPlan = entitlement.subscription_plan_id;
  }

  accessCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS, value: result });
  return result;
}

export async function hasTenantCapability(
  tenantId: string,
  capability: TrichoscopyCapability,
  opts?: { userId?: string; supabaseClientForTests?: SupabaseClient; env?: NodeJS.ProcessEnv }
): Promise<boolean> {
  const access = await resolveFiosTrichoscopyAccess({
    tenantId,
    userId: opts?.userId?.trim() || "00000000-0000-0000-0000-000000000000",
    capability,
    bypassUserPermission: !opts?.userId,
    supabaseClientForTests: opts?.supabaseClientForTests,
    env: opts?.env,
    skipCache: true,
  });
  return access.allowed || Boolean(access.historicalReadOnly && access.capabilityIncluded);
}

export async function getTenantEnabledModules(
  tenantId: string,
  opts?: { userId: string; supabaseClientForTests?: SupabaseClient; env?: NodeJS.ProcessEnv }
): Promise<Array<{ key: string; label: string; href: string; requiredCapability: TrichoscopyCapability }>> {
  if (!opts?.userId) return [];
  const access = await resolveFiosTrichoscopyAccess({
    tenantId,
    userId: opts.userId,
    capability: "trichoscopy.view",
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });
  if (!access.allowed && !access.historicalReadOnly) return [];
  return [
    {
      key: HLI_TRICHOSCOPY_MODULE_KEY,
      label: "Trichoscopy",
      href: `/fi-admin/${tenantId.trim()}/trichoscopy`,
      requiredCapability: "trichoscopy.view",
    },
  ];
}

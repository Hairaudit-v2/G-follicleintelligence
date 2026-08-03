import "server-only";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { writeModuleLifecycleAudit } from "@/src/lib/platform/entitlements/moduleLifecycleAudit.server";
import {
  resolveFiosTrichoscopyAccess,
  type ResolveFiosTrichoscopyAccessInput,
} from "@/src/lib/platform/entitlements/resolveFiosTrichoscopyAccess.server";
import type {
  FiosTrichoscopyAccessDenialReason,
  FiosTrichoscopyAccessResult,
  TrichoscopyCapability,
} from "@/src/lib/platform/entitlements/trichoscopyCapabilities";
import { HLI_TRICHOSCOPY_MODULE_KEY } from "@/src/lib/platform/entitlements/trichoscopyCapabilities";

export type RequireTenantModuleCapabilityInput = {
  tenantId: string;
  userId: string;
  moduleKey?: typeof HLI_TRICHOSCOPY_MODULE_KEY;
  capability: TrichoscopyCapability;
  patientId?: string | null;
  caseId?: string | null;
  /** Prefer 404 to conceal module existence (default for clinical users). */
  concealModule?: boolean;
  /** Allow historical read-only when entitlement expired but capability is view/evidence. */
  allowHistoricalReadOnly?: boolean;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
  writeAudit?: boolean;
};

export type RequireTenantModuleCapabilityOk = {
  ok: true;
  access: FiosTrichoscopyAccessResult;
  historicalReadOnly: boolean;
};

export type RequireTenantModuleCapabilityDenied = {
  ok: false;
  access: FiosTrichoscopyAccessResult;
  httpStatus: 403 | 404;
  response: NextResponse;
};

export type RequireTenantModuleCapabilityResult =
  | RequireTenantModuleCapabilityOk
  | RequireTenantModuleCapabilityDenied;

const UPGRADE_HINT_REASONS = new Set<FiosTrichoscopyAccessDenialReason>([
  "subscription_not_included",
  "entitlement_inactive",
  "subscription_expired",
  "trial_expired",
  "capability_not_included",
]);

function denialMessage(reason: FiosTrichoscopyAccessDenialReason | undefined, conceal: boolean): string {
  if (conceal) return "Not found.";
  switch (reason) {
    case "platform_disabled":
      return "Trichoscopy Intelligence is temporarily unavailable.";
    case "subscription_not_included":
      return "Trichoscopy Intelligence is not included in your current subscription.";
    case "tenant_module_disabled":
      return "Trichoscopy Intelligence is included but not yet activated for your clinic.";
    case "capability_not_included":
      return "This trichoscopy capability is not included in your current plan.";
    case "user_not_permitted":
      return "Your role does not include this trichoscopy action.";
    case "resource_not_accessible":
      return "The requested patient or case is not available in this clinic.";
    case "subscription_expired":
    case "trial_expired":
      return "Your trichoscopy subscription or trial has ended. Historical records remain available where permitted.";
    case "account_suspended":
      return "Trichoscopy access is suspended for this clinic.";
    case "entitlement_inactive":
      return "Trichoscopy access is currently inactive.";
    default:
      return "You do not have access to this trichoscopy action.";
  }
}

/**
 * Canonical server-side guard for tenant module capabilities.
 * Must run before HLI commands, evidence retrieval, deep links, and task creation.
 */
export async function requireTenantModuleCapability(
  opts: RequireTenantModuleCapabilityInput
): Promise<RequireTenantModuleCapabilityResult> {
  const moduleKey = opts.moduleKey ?? HLI_TRICHOSCOPY_MODULE_KEY;
  if (moduleKey !== HLI_TRICHOSCOPY_MODULE_KEY) {
    const access: FiosTrichoscopyAccessResult = {
      allowed: false,
      platformEnabled: false,
      tenantEntitled: false,
      tenantModuleEnabled: false,
      userPermitted: false,
      capabilityIncluded: false,
      resourceAccessible: false,
      enabledCapabilities: [],
      denialReason: "subscription_not_included",
    };
    return {
      ok: false,
      access,
      httpStatus: 404,
      response: NextResponse.json({ error: "Not found." }, { status: 404 }),
    };
  }

  const resolveInput: ResolveFiosTrichoscopyAccessInput = {
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability: opts.capability,
    patientId: opts.patientId,
    caseId: opts.caseId,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  };

  const access = await resolveFiosTrichoscopyAccess(resolveInput);
  const historicalOk =
    Boolean(opts.allowHistoricalReadOnly) &&
    Boolean(access.historicalReadOnly) &&
    access.capabilityIncluded &&
    access.platformEnabled &&
    access.userPermitted &&
    access.resourceAccessible;

  if (opts.writeAudit !== false) {
    await writeModuleLifecycleAudit({
      tenantId: opts.tenantId,
      moduleKey,
      capability: opts.capability,
      eventType: access.allowed || historicalOk ? "access_granted" : "access_denied",
      actorUserId: opts.userId,
      source: "require_tenant_module_capability",
      reason: access.denialReason ?? null,
      newState: {
        allowed: access.allowed,
        historical_read_only: historicalOk,
        denial_reason: access.denialReason ?? null,
      },
      supabaseClientForTests: opts.supabaseClientForTests,
    });
  }

  if (access.allowed || historicalOk) {
    return { ok: true, access, historicalReadOnly: historicalOk && !access.allowed };
  }

  const conceal =
    opts.concealModule !== false &&
    (access.denialReason === "platform_disabled" ||
      access.denialReason === "subscription_not_included" ||
      access.denialReason === "tenant_module_disabled");

  const httpStatus: 403 | 404 = conceal ? 404 : 403;
  const body: Record<string, unknown> = {
    error: denialMessage(access.denialReason, conceal),
    code: access.denialReason ?? "access_denied",
  };

  if (!conceal && UPGRADE_HINT_REASONS.has(access.denialReason as FiosTrichoscopyAccessDenialReason)) {
    body.upgradeState = {
      moduleKey,
      entitlementStatus: access.entitlementStatus ?? "not_entitled",
      capabilityTier: access.capabilityTier ?? null,
      message:
        "Contact your account representative or upgrade your plan to activate Trichoscopy Intelligence.",
    };
  }

  return {
    ok: false,
    access,
    httpStatus,
    response: NextResponse.json(body, { status: httpStatus }),
  };
}

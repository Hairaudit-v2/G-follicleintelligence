import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ModuleAccessResult } from "./entitlementTypes";
import { writeEntitlementAuditEvent } from "./entitlementAudit.server";
import { evaluateModuleAccess } from "./modules";
import {
  finalizeModuleAccessResult,
  loadEntitlementAccessContext,
} from "./tenantEntitlements.server";

export type RequireModuleAccessInput = {
  tenantId: string;
  /** `fi_users.id` for the tenant member being authorized. */
  userId: string;
  moduleCode: string;
  /** Optional tighter role gate on top of module allow-list. */
  requiredRoles?: readonly string[] | null;
  /** Unit tests only — bypass {@link supabaseAdmin} singleton. */
  supabaseClientForTests?: SupabaseClient;
  /** When false, skip audit insert (tests that assert audit separately). Default true. */
  writeAudit?: boolean;
};

/**
 * Server-side module gate. Returns a safe access result; never exposes billing internals.
 * Writes entitlement audit events for allowed and denied checks by default.
 */
export async function requireModuleAccess(
  opts: RequireModuleAccessInput
): Promise<ModuleAccessResult> {
  const tenantId = opts.tenantId.trim();
  const userId = opts.userId.trim();
  const moduleCode = opts.moduleCode.trim();
  const writeAudit = opts.writeAudit !== false;

  const ctx = await loadEntitlementAccessContext({
    tenantId,
    userId,
    moduleCode,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  const evaluated = evaluateModuleAccess(ctx, { requiredRoles: opts.requiredRoles });
  const result = finalizeModuleAccessResult(evaluated, { tenantId, userId, moduleCode });

  if (writeAudit) {
    await writeEntitlementAuditEvent(
      {
        tenantId,
        fiUserId: userId,
        moduleCode,
        outcome: result.ok ? "allowed" : "denied",
        denialReason: result.ok ? null : result.reason,
        metadata: {
          required_roles: opts.requiredRoles?.length ? [...opts.requiredRoles] : undefined,
        },
      },
      { supabaseClientForTests: opts.supabaseClientForTests }
    );
  }

  return result;
}

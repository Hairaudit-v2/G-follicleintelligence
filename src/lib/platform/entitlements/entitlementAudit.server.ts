import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { EntitlementAuditEventInput } from "./entitlementTypes";

export type WriteEntitlementAuditEventOptions = {
  /** Unit tests only — bypass {@link supabaseAdmin} singleton. */
  supabaseClientForTests?: SupabaseClient;
};

export async function writeEntitlementAuditEvent(
  input: EntitlementAuditEventInput,
  opts?: WriteEntitlementAuditEventOptions
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = opts?.supabaseClientForTests ?? supabaseAdmin();
  const tenantId = input.tenantId.trim();
  const moduleCode = input.moduleCode.trim();
  if (!tenantId || !moduleCode) {
    return { ok: false, message: "tenantId and moduleCode are required." };
  }

  const { error } = await supabase.from("fi_entitlement_audit_events").insert({
    tenant_id: tenantId,
    fi_user_id: input.fiUserId?.trim() || null,
    module_code: moduleCode,
    outcome: input.outcome,
    denial_reason: input.outcome === "denied" ? input.denialReason ?? null : null,
    source: input.source?.trim() || "require_module_access",
    metadata: input.metadata ?? {},
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

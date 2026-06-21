import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { NexusRollbackPayload, RollbackResult } from "@/src/lib/nexus/nexusProvisioningTypes";
import { GLOBAL_PROFESSIONAL_ID_RE, UUID_RE } from "@/src/lib/nexus/nexusProvisioningTypes";
import {
  readExternalProfessionalState,
  writeNexusProvisioningAudit,
} from "@/src/lib/nexus/readExternalProfessionalState.server";

function validateRollbackPayload(payload: NexusRollbackPayload): { ok: true } | { ok: false; error: string } {
  const globalProfessionalId = payload.globalProfessionalId?.trim() ?? "";
  if (!GLOBAL_PROFESSIONAL_ID_RE.test(globalProfessionalId)) {
    return { ok: false, error: "Invalid globalProfessionalId." };
  }

  const tenantId = payload.tenantId?.trim() ?? "";
  if (!UUID_RE.test(tenantId)) {
    return { ok: false, error: "Invalid tenantId." };
  }

  const reason = payload.reason?.trim() ?? "";
  if (!reason) {
    return { ok: false, error: "reason is required." };
  }

  return { ok: true };
}

export async function rollbackExternalProfessionalProvisioning(
  payload: NexusRollbackPayload,
  client?: SupabaseClient
): Promise<RollbackResult> {
  const validation = validateRollbackPayload(payload);
  if (!validation.ok) {
    return { ok: false, error: validation.error, httpStatus: 400 };
  }

  const globalProfessionalId = payload.globalProfessionalId.trim();
  const tenantId = payload.tenantId.trim();
  const supabase = client ?? supabaseAdmin();

  const beforeStateResult = await readExternalProfessionalState(globalProfessionalId, supabase);
  const beforeState = beforeStateResult.ok ? beforeStateResult.state : null;

  try {
    const now = new Date().toISOString();

    const { error: rolesErr } = await supabase
      .from("fi_nexus_role_assignments")
      .update({ active: false, revoked_at: now })
      .eq("global_professional_id", globalProfessionalId)
      .eq("tenant_id", tenantId)
      .eq("nexus_created", true)
      .eq("active", true);

    if (rolesErr) throw new Error(rolesErr.message);

    const { error: staffErr } = await supabase
      .from("fi_nexus_staff_profiles")
      .update({ active: false })
      .eq("global_professional_id", globalProfessionalId)
      .eq("tenant_id", tenantId)
      .eq("nexus_created", true);

    if (staffErr) throw new Error(staffErr.message);

    const { error: membershipErr } = await supabase
      .from("fi_nexus_tenant_memberships")
      .update({ membership_status: "revoked" })
      .eq("global_professional_id", globalProfessionalId)
      .eq("tenant_id", tenantId)
      .eq("nexus_created", true);

    if (membershipErr) throw new Error(membershipErr.message);

    const { markNexusIdentityLinkRevoked } = await import("@/src/lib/workforce-os/nexusFiStaffBridge.server");
    await markNexusIdentityLinkRevoked(tenantId, globalProfessionalId, supabase);

    const stateResult = await readExternalProfessionalState(globalProfessionalId, supabase);
    if (!stateResult.ok) {
      return { ok: false, error: stateResult.error, httpStatus: stateResult.httpStatus };
    }

    await writeNexusProvisioningAudit(
      {
        globalProfessionalId,
        actionType: "rollback",
        payload: { ...payload, reason: payload.reason.trim() } as unknown as Record<string, unknown>,
        beforeState: beforeState as unknown as Record<string, unknown> | null,
        afterState: stateResult.state as unknown as Record<string, unknown>,
        result: "success",
      },
      supabase
    );

    return { ok: true, state: stateResult.state };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rollback failed.";
    try {
      await writeNexusProvisioningAudit(
        {
          globalProfessionalId,
          actionType: "rollback",
          payload: payload as unknown as Record<string, unknown>,
          beforeState: beforeState as unknown as Record<string, unknown> | null,
          result: "failure",
          failureReason: message,
        },
        supabase
      );
    } catch {
      /* best effort */
    }
    return { ok: false, error: message, httpStatus: 500 };
  }
}

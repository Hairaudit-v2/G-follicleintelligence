import "server-only";

import { cache } from "react";

import { assertCrmTenantWriteAllowed, CrmAccessError, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsFeatureAccessMapOrNullForViewer } from "@/src/lib/fi-os/featureAccess.server";
import { evaluateModuleAccess } from "@/src/lib/platform/entitlements/modules";
import { loadEntitlementAccessContext } from "@/src/lib/platform/entitlements/tenantEntitlements.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function loadFiUserIdForAuth(tenantId: string, authUserId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

async function getPatientImagingCaptureCapabilityImpl(tenantId: string): Promise<{ canCapture: boolean }> {
  const tid = tenantId.trim();
  if (!tid) return { canCapture: false };

  try {
    await assertCrmTenantWriteAllowed({ tenantId: tid });
  } catch {
    return { canCapture: false };
  }

  const featureAccess = await loadFiOsFeatureAccessMapOrNullForViewer(tid);
  if (featureAccess && featureAccess.get("imaging") === false) {
    return { canCapture: false };
  }

  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) return { canCapture: false };

  const fiUserId = await loadFiUserIdForAuth(tid, authUserId);
  if (!fiUserId) return { canCapture: false };

  const ctx = await loadEntitlementAccessContext({
    tenantId: tid,
    userId: fiUserId,
    moduleCode: "imaging_os",
  });
  const moduleResult = evaluateModuleAccess(ctx);
  if (!moduleResult.ok) {
    return { canCapture: false };
  }

  return { canCapture: true };
}

/** Whether the current viewer may start ImagingOS guided capture for a patient. */
export const getPatientImagingCaptureCapability = cache(getPatientImagingCaptureCapabilityImpl);

export async function assertPatientImagingCaptureAllowed(tenantId: string): Promise<void> {
  const { canCapture } = await getPatientImagingCaptureCapability(tenantId);
  if (!canCapture) {
    throw new CrmAccessError(403, "Photo capture requires imaging access.");
  }
}

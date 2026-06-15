"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import { provisionPlatformTenant } from "@/src/lib/fiOs/platformTenantProvision.server";

const createBodySchema = z.object({
  tenantName: z.string().min(1).max(200),
  tenantSlug: z.string().min(1).max(80),
  defaultClinicDisplayName: z.string().min(1).max(200),
  defaultTimezone: z.string().min(1).max(120),
  firstTenantAdminEmail: z.string().email(),
  supportEmail: z.string().email().optional().nullable(),
});

export type FiPlatformTenantActionResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string };

export async function createPlatformTenantAction(body: unknown): Promise<FiPlatformTenantActionResult> {
  try {
    const parsed = createBodySchema.parse(body);
    const authId = await resolveAuthUserId(null);
    if (!authId) {
      return { ok: false, error: "Authentication required." };
    }
    const os = await loadFiOsIdentity(authId);
    if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
      return { ok: false, error: "Platform administrator access is required." };
    }

    const h = headers();
    const getHeader = (name: string) => h.get(name);
    const result = await provisionPlatformTenant(
      {
        actorAuthUserId: authId,
        tenantName: parsed.tenantName.trim(),
        tenantSlug: parsed.tenantSlug.trim(),
        defaultClinicDisplayName: parsed.defaultClinicDisplayName.trim(),
        defaultTimezone: parsed.defaultTimezone.trim(),
        firstTenantAdminEmail: parsed.firstTenantAdminEmail.trim(),
        supportEmail: parsed.supportEmail?.trim() || null,
      },
      { getHeader }
    );

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    revalidatePath("/fi-admin/system/tenants");
    revalidatePath("/fi-admin");
    return { ok: true, tenantId: result.tenantId };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

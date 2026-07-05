"use server";

import { revalidatePath } from "next/cache";

import {
  assertFiTenantExists,
  isFiAdminUuid,
  requireFiAdminKey,
} from "@/lib/server/fiAdminKeyGate";
import { insertFiTenantAdminAuditEvent } from "@/src/lib/tenantAdmin/tenantAdminAudit.server";
import {
  canManageTenantBranding,
  resolveActorFiUserIdForTenantAdminActions,
} from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import {
  removeTenantUploadedLogo,
  uploadTenantLogoFile,
} from "@/src/lib/fi/foundation/tenantBrandingStorage.server";

async function assertBrandingWriteAllowed(
  tenantId: string,
  adminKey: string | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sessionAllowed = await canManageTenantBranding(tenantId);
  if (sessionAllowed) return { ok: true };
  const gate = requireFiAdminKey(adminKey ?? "", tenantId);
  if (gate.ok) return { ok: true };
  return {
    ok: false,
    error: "You do not have permission to update branding for this clinic.",
  };
}

export async function uploadTenantLogoAction(input: {
  tenantId: string;
  adminKey?: string;
  file: File;
}): Promise<
  | { ok: true; signedUrl: string; storagePath: string }
  | { ok: false; error: string }
> {
  const tenantId = input.tenantId?.trim();
  if (!tenantId || !isFiAdminUuid(tenantId)) {
    return { ok: false, error: "Invalid tenant id." };
  }

  const perm = await assertBrandingWriteAllowed(tenantId, input.adminKey);
  if (!perm.ok) return perm;

  const t = await assertFiTenantExists(tenantId);
  if (!t.ok) return t;

  const result = await uploadTenantLogoFile(tenantId, input.file);
  if (!result.ok) return result;

  const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId);
  await insertFiTenantAdminAuditEvent({
    tenantId,
    eventKind: "settings.branding_updated",
    actorFiUserId,
    detail: { action: "logo_uploaded", storagePath: result.storagePath },
  });

  revalidatePath(`/fi-admin/${tenantId}/configuration`);
  revalidatePath(`/fi-admin/${tenantId}`);
  return result;
}

export async function removeTenantLogoAction(input: {
  tenantId: string;
  adminKey?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantId = input.tenantId?.trim();
  if (!tenantId || !isFiAdminUuid(tenantId)) {
    return { ok: false, error: "Invalid tenant id." };
  }

  const perm = await assertBrandingWriteAllowed(tenantId, input.adminKey);
  if (!perm.ok) return perm;

  const t = await assertFiTenantExists(tenantId);
  if (!t.ok) return t;

  const result = await removeTenantUploadedLogo(tenantId);
  if (!result.ok) return result;

  const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId);
  await insertFiTenantAdminAuditEvent({
    tenantId,
    eventKind: "settings.branding_updated",
    actorFiUserId,
    detail: { action: "logo_removed" },
  });

  revalidatePath(`/fi-admin/${tenantId}/configuration`);
  revalidatePath(`/fi-admin/${tenantId}`);
  return { ok: true };
}

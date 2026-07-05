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
import { loadTenantBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { brandingDebugEnabled, logBrandingDebug } from "@/src/lib/fi/foundation/brandingDebug";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** FI-BRANDING-SYSTEM-1C: identity snapshot for debug logs only. */
async function debugIdentity(): Promise<{ authUserId: string | null; email: string | null }> {
  if (!brandingDebugEnabled()) return { authUserId: null, email: null };
  try {
    const authUserId = await resolveAuthUserId(null);
    if (!authUserId) return { authUserId: null, email: null };
    const { data } = await supabaseAdmin().auth.admin.getUserById(authUserId);
    return { authUserId, email: data.user?.email ?? null };
  } catch {
    return { authUserId: null, email: null };
  }
}

async function assertBrandingWriteAllowed(
  tenantId: string,
  adminKey: string | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sessionAllowed = await canManageTenantBranding(tenantId);
  const gate = sessionAllowed ? null : requireFiAdminKey(adminKey ?? "", tenantId);
  logBrandingDebug("permission", {
    tenantId,
    canManageTenantBranding: sessionAllowed,
    adminKeyProvided: Boolean(adminKey?.trim()),
    adminKeyGateOk: gate?.ok ?? null,
  });
  if (sessionAllowed) return { ok: true };
  if (gate?.ok) return { ok: true };
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

  const identity = await debugIdentity();
  logBrandingDebug("uploadTenantLogoAction:start", {
    ...identity,
    tenantId,
    fileName: input.file?.name ?? null,
    fileType: input.file?.type ?? null,
    fileSize: input.file?.size ?? null,
  });

  const perm = await assertBrandingWriteAllowed(tenantId, input.adminKey);
  if (!perm.ok) {
    logBrandingDebug("uploadTenantLogoAction:denied", { tenantId, error: perm.error });
    return perm;
  }

  const t = await assertFiTenantExists(tenantId);
  if (!t.ok) return t;

  const existingBefore = brandingDebugEnabled()
    ? await loadTenantBranding(tenantId).catch(() => null)
    : null;
  logBrandingDebug("uploadTenantLogoAction:existingRow", {
    tenantId,
    existing: existingBefore
      ? {
          brand_name: existingBefore.brand_name,
          logo_url: existingBefore.logo_url,
          metadata: existingBefore.metadata,
        }
      : null,
  });

  const result = await uploadTenantLogoFile(tenantId, input.file);
  logBrandingDebug("uploadTenantLogoAction:result", {
    tenantId,
    ok: result.ok,
    error: result.ok ? null : result.error,
    storagePath: result.ok ? result.storagePath : null,
  });
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

  const identity = await debugIdentity();
  logBrandingDebug("removeTenantLogoAction:start", { ...identity, tenantId });

  const perm = await assertBrandingWriteAllowed(tenantId, input.adminKey);
  if (!perm.ok) {
    logBrandingDebug("removeTenantLogoAction:denied", { tenantId, error: perm.error });
    return perm;
  }

  const t = await assertFiTenantExists(tenantId);
  if (!t.ok) return t;

  const result = await removeTenantUploadedLogo(tenantId);
  logBrandingDebug("removeTenantLogoAction:result", {
    tenantId,
    ok: result.ok,
    error: result.ok ? null : result.error,
  });
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

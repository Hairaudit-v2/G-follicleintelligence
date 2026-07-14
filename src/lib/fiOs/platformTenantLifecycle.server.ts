import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isFiOsCrossTenantDirectoryRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";

import { insertFiPlatformTenantAuditEvent } from "./platformTenantAudit.server";
import { auditTenantDependencies } from "./platformTenantDependencyAudit.server";
import {
  canArchiveTenant,
  type FiPlatformTenantLifecycleRow,
  filterPlatformTenantList,
  isTenantArchived,
} from "./platformTenantLifecycleCore";

const TENANT_SELECT =
  "id, name, slug, created_at, archived_at, archived_by, archive_reason, is_demo, is_production_visible";

async function loadTenantLifecycleRow(
  tenantId: string
): Promise<FiPlatformTenantLifecycleRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenants")
    .select(TENANT_SELECT)
    .eq("id", tenantId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FiPlatformTenantLifecycleRow | null) ?? null;
}

async function loadActiveTenantIdsForActor(authUserId: string): Promise<string[]> {
  const supabase = supabaseAdmin();
  const os = await loadFiOsIdentity(authUserId);
  if (os && isFiOsCrossTenantDirectoryRole(os.osRole)) {
    const { data, error } = await supabase.from("fi_tenants").select("id").is("archived_at", null);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => String((r as { id: string }).id));
  }

  const { data: memberships, error: memErr } = await supabase
    .from("fi_users")
    .select("tenant_id")
    .eq("auth_user_id", authUserId);
  if (memErr) throw new Error(memErr.message);
  const ids = Array.from(
    new Set(
      (memberships ?? [])
        .map((r) => (r as { tenant_id: string | null }).tenant_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  if (ids.length === 0) return [];

  const { data: tenants, error: tenantErr } = await supabase
    .from("fi_tenants")
    .select("id")
    .in("id", ids)
    .is("archived_at", null);
  if (tenantErr) throw new Error(tenantErr.message);
  return (tenants ?? []).map((r) => String((r as { id: string }).id));
}

export type LoadPlatformTenantsOptions = {
  includeArchived?: boolean;
  includeDemo?: boolean;
};

export async function loadPlatformTenantsForAdmin(
  opts: LoadPlatformTenantsOptions = {}
): Promise<FiPlatformTenantLifecycleRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_tenants").select(TENANT_SELECT).order("name");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as FiPlatformTenantLifecycleRow[];
  return filterPlatformTenantList(rows, {
    includeArchived: opts.includeArchived,
    includeDemo: opts.includeDemo,
    includeHidden: opts.includeDemo,
  });
}

export type PlatformTenantLifecycleResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string };

export async function archiveTenantForPlatformAdmin(opts: {
  actorAuthUserId: string;
  tenantId: string;
  reason: string;
  sessionActiveTenantId?: string | null;
  allowProtectedArchive?: boolean;
}): Promise<PlatformTenantLifecycleResult> {
  const os = await loadFiOsIdentity(opts.actorAuthUserId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }

  const tenant = await loadTenantLifecycleRow(opts.tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const activeIds = await loadActiveTenantIdsForActor(opts.actorAuthUserId);
  const gate = canArchiveTenant({
    tenant,
    actorActiveTenantIds: activeIds,
    sessionActiveTenantId: opts.sessionActiveTenantId,
    allowProtectedArchive: opts.allowProtectedArchive,
  });
  if (!gate.ok) return { ok: false, error: gate.reason };

  const reason = opts.reason.trim();
  if (!reason) return { ok: false, error: "Archive reason is required." };

  const dependencyAudit = await auditTenantDependencies(tenant.id);
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("fi_tenants")
    .update({
      archived_at: now,
      archived_by: opts.actorAuthUserId,
      archive_reason: reason,
      is_production_visible: false,
      updated_at: now,
    })
    .eq("id", tenant.id)
    .is("archived_at", null);

  if (updateErr) return { ok: false, error: updateErr.message };

  const audit = await insertFiPlatformTenantAuditEvent({
    tenantId: tenant.id,
    eventKind: "tenant.archived",
    actorAuthUserId: opts.actorAuthUserId,
    detail: {
      slug: tenant.slug,
      name: tenant.name,
      reason,
      dependencyCounts: dependencyAudit.counts,
      totalLinkedRecords: dependencyAudit.totalLinkedRecords,
    },
  });
  if (!audit.ok) {
    console.error("[archiveTenantForPlatformAdmin] audit failed:", audit.message);
  }

  return { ok: true, tenantId: tenant.id };
}

export async function restoreTenantForPlatformAdmin(opts: {
  actorAuthUserId: string;
  tenantId: string;
}): Promise<PlatformTenantLifecycleResult> {
  const os = await loadFiOsIdentity(opts.actorAuthUserId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }

  const tenant = await loadTenantLifecycleRow(opts.tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!isTenantArchived(tenant)) {
    return { ok: false, error: "Tenant is not archived." };
  }

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const restoreVisible = tenant.is_demo ? false : true;

  const { error: updateErr } = await supabase
    .from("fi_tenants")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      is_production_visible: restoreVisible,
      updated_at: now,
    })
    .eq("id", tenant.id)
    .not("archived_at", "is", null);

  if (updateErr) return { ok: false, error: updateErr.message };

  const audit = await insertFiPlatformTenantAuditEvent({
    tenantId: tenant.id,
    eventKind: "tenant.restored",
    actorAuthUserId: opts.actorAuthUserId,
    detail: {
      slug: tenant.slug,
      name: tenant.name,
      previousArchiveReason: tenant.archive_reason,
      restoredProductionVisible: restoreVisible,
    },
  });
  if (!audit.ok) {
    console.error("[restoreTenantForPlatformAdmin] audit failed:", audit.message);
  }

  return { ok: true, tenantId: tenant.id };
}

export { auditTenantDependencies };

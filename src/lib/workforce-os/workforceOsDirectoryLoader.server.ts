import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  mapLifecycleRow,
  syncAllStaffProjectionsForTenant,
} from "@/src/lib/workforce-os/hrReconciliation.server";
import { loadStaffMemberLifecycle } from "@/src/lib/workforce-os/staffLifecycle.server";
import {
  loadStaffLifecycleForFiStaff,
  loadStaffMemberAuditTimeline,
} from "@/src/lib/workforce-os/staffLifecycle.server";
import type { StaffMemberLifecycleRow } from "@/src/lib/workforce-os/staffLifecycleTypes";

export async function loadWorkforceOsDirectoryPage(tenantId: string): Promise<{
  rows: StaffMemberLifecycleRow[];
  canManage: boolean;
} | null> {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  await syncAllStaffProjectionsForTenant(tenantId);
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_members")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);

  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);

  return {
    rows: ((data ?? []) as Record<string, unknown>[]).map(mapLifecycleRow),
    canManage,
  };
}

export async function loadWorkforceOsStaffProfilePage(
  tenantId: string,
  staffId: string
): Promise<{
  lifecycle: StaffMemberLifecycleRow;
  audit: Awaited<ReturnType<typeof loadStaffMemberAuditTimeline>>;
  canManage: boolean;
  iiohrCandidates: { id: string; full_name: string | null; email: string | null }[];
} | null> {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const tid = tenantId.trim();
  let lifecycle = await loadStaffMemberLifecycle(tid, staffId).catch(() => null);
  if (!lifecycle) {
    lifecycle = await loadStaffLifecycleForFiStaff(tid, staffId);
  }

  const audit = await loadStaffMemberAuditTimeline(tid, lifecycle.id);
  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);

  // Placeholder candidates — production loads from IIOHR feed API.
  const iiohrCandidates: { id: string; full_name: string | null; email: string | null }[] = [];

  return { lifecycle, audit, canManage, iiohrCandidates };
}

export async function loadWorkforceOsHrReconciliationPage(tenantId: string): Promise<{
  metrics: import("@/src/lib/workforce-os/staffLifecycleTypes").HrReconciliationMetrics;
  suggestions: import("@/src/lib/workforce-os/staffLifecycleTypes").HrReconciliationSuggestion[];
  archivedHistorical: import("@/src/lib/workforce-os/staffLifecycleTypes").HrReconciliationArchivedRecord[];
} | null> {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);
  if (!canManage) return null;

  await syncAllStaffProjectionsForTenant(tenantId);
  const { loadHrReconciliationPageData } = await import(
    "@/src/lib/workforce-os/hrReconciliation.server"
  );

  // Empty feed until IIOHR API wired — UI still renders active unlinked staff.
  const pageData = await loadHrReconciliationPageData({
    tenantId,
    evolvedStaffRecords: [],
  });

  return pageData;
}

export async function assertWorkforceOsReadAccess(tenantId: string): Promise<boolean> {
  assertNonEmptyUuid(tenantId, "tenantId");
  void resolveAuthUserId;
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  return access.ok;
}

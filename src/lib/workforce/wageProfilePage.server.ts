import "server-only";

import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import {
  computeSurgeryDayStaffingCostForDate,
  ensureDefaultAwardLoadingPlaceholders,
  listActiveStaffForWageProfiles,
  listAwardLoadingPlaceholders,
  listTimesheetEntries,
  listWorkforceWageProfiles,
} from "@/src/lib/workforce/wageProfile.server";
import { countWageProfilesByRateType } from "@/src/lib/workforce/wageProfileCore";

export async function loadWorkforceOsPayrollPage(tenantId: string, workDate?: string | null) {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const tid = tenantId.trim();
  await ensureDefaultAwardLoadingPlaceholders(tid);

  const date =
    workDate?.trim() ||
    new Date().toISOString().slice(0, 10);

  const [wageProfiles, awardLoadings, timesheetEntries, staffOptions, surgeryDayCost] =
    await Promise.all([
      listWorkforceWageProfiles(tid),
      listAwardLoadingPlaceholders(tid),
      listTimesheetEntries(tid, { limit: 50 }),
      listActiveStaffForWageProfiles(tid),
      computeSurgeryDayStaffingCostForDate(tid, date),
    ]);

  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);

  return {
    wageProfiles,
    awardLoadings,
    timesheetEntries,
    staffOptions,
    surgeryDayCost,
    rateTypeCounts: countWageProfilesByRateType(wageProfiles),
    workDate: date,
    canManage,
  };
}
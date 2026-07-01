import "server-only";

import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import {
  aggregatePayPeriodStaffTotals,
  resolvePayPeriodContaining,
} from "@/src/lib/workforce/payPeriodCore";
import { buildRosterActualVarianceForPeriod } from "@/src/lib/workforce/rosterActualVariance.server";
import { listWorkforceTimePunches } from "@/src/lib/workforce/staffTimeClock.server";
import { loadWorkforceTimeClockPolicy } from "@/src/lib/workforce/staffTimeClockPolicy.server";
import { calendarDateStringFromInstant, resolveTenantCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  computeSurgeryDayStaffingCostForDate,
  ensureDefaultAwardLoadingPlaceholders,
  listActiveStaffForWageProfiles,
  listAwardLoadingPlaceholders,
  listTimesheetEntries,
  listWorkforceWageProfiles,
} from "@/src/lib/workforce/wageProfile.server";
import { countWageProfilesByRateType } from "@/src/lib/workforce/wageProfileCore";

export async function loadWorkforceOsPayrollPage(
  tenantId: string,
  workDate?: string | null,
  periodDate?: string | null
) {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const tid = tenantId.trim();
  await ensureDefaultAwardLoadingPlaceholders(tid);

  const date =
    workDate?.trim() ||
    new Date().toISOString().slice(0, 10);

  const timeClockPolicy = await loadWorkforceTimeClockPolicy(tid);
  const supabase = supabaseAdmin();
  const { data: tzRow } = await supabase
    .from("fi_tenant_settings")
    .select("default_timezone, metadata")
    .eq("tenant_id", tid)
    .maybeSingle();
  const calendarTimezone = resolveTenantCalendarTimezone(
    tzRow as { default_timezone?: string | null; metadata?: Record<string, unknown> | null } | null
  );
  const anchorDate =
    periodDate?.trim() ||
    calendarDateStringFromInstant(new Date(), calendarTimezone);
  const payPeriod = resolvePayPeriodContaining(
    anchorDate,
    timeClockPolicy.payPeriodFrequency,
    timeClockPolicy.payPeriodAnchor
  );

  const [
    wageProfiles,
    awardLoadings,
    timesheetEntries,
    timePunches,
    staffOptions,
    surgeryDayCost,
    rosterVariance,
    autoClosedPunches,
    openPunches,
  ] = await Promise.all([
    listWorkforceWageProfiles(tid),
    listAwardLoadingPlaceholders(tid),
    listTimesheetEntries(tid, {
      periodStart: payPeriod.start,
      periodEnd: payPeriod.end,
      limit: 200,
    }),
    listWorkforceTimePunches(tid, {
      periodStart: payPeriod.start,
      periodEnd: payPeriod.end,
      limit: 200,
    }),
    listActiveStaffForWageProfiles(tid),
    computeSurgeryDayStaffingCostForDate(tid, date),
    buildRosterActualVarianceForPeriod(
      tid,
      payPeriod.start,
      payPeriod.end,
      calendarTimezone
    ),
    listWorkforceTimePunches(tid, { source: "auto_close", limit: 20 }),
    listWorkforceTimePunches(tid, { openOnly: true, limit: 20 }),
  ]);

  const payPeriodStaffTotals = aggregatePayPeriodStaffTotals(
    timesheetEntries.map((e) => ({
      staffMemberId: e.staffMemberId,
      staffFullName: e.staffFullName,
      minutesWorked: e.minutesWorked,
      grossCostCents: e.grossCostCents,
      status: e.status,
    }))
  );

  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);

  return {
    wageProfiles,
    awardLoadings,
    timesheetEntries,
    timePunches,
    staffOptions,
    surgeryDayCost,
    rateTypeCounts: countWageProfilesByRateType(wageProfiles),
    workDate: date,
    canManage,
    timeClockPolicy,
    payPeriod,
    payPeriodStaffTotals,
    rosterVariance,
    autoClosedPunches,
    openPunches,
    calendarTimezone,
  };
}